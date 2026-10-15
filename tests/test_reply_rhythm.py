"""Manual turns through real Chat transport; all AI/audio traffic is fixture-controlled."""
import json
import os
import struct
import time
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('IB_TEST_BASE_URL', 'http://localhost:8774').rstrip('/')
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
    context.route('https://**/*', lambda r: r.abort())
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    requests, held = [], []
    output = {'value': 'hold'}

    def fulfill(route, value):
        if value == 'error':
            route.fulfill(status=500, content_type='application/json', body='{"error":"fixture failure"}')
            return
        raw = json.dumps(value, ensure_ascii=False) if isinstance(value, dict) else value
        if route.request.post_data_json.get('stream'):
            chunks = [{'choices': [{'delta': {'content': raw}, 'finish_reason': None}]},
                      {'choices': [{'delta': {}, 'finish_reason': 'stop'}]}]
            body = ''.join('data: '+json.dumps(chunk)+'\n\n' for chunk in chunks)+'data: [DONE]\n\n'
            route.fulfill(status=200, content_type='text/event-stream', body=body)
        else:
            route.fulfill(status=200, content_type='application/json', body=json.dumps({'choices': [{'message': {'content': raw}, 'finish_reason': 'stop'}]}))

    def api(route):
        requests.append(route.request.post_data_json)
        if output['value'] == 'hold': held.append(route)
        else: fulfill(route, output['value'])

    page.route('**/api/rhythm', api)
    def wait_call(count):
        deadline=time.monotonic()+5
        while len(requests)<count and time.monotonic()<deadline: page.wait_for_timeout(10)
        assert len(requests)>=count

    def boot():
        page.goto(BASE+'/')
        page.wait_for_function('()=>window._ibBootDone===true')
        page.evaluate('()=>_lkUnlock()')
        page.wait_for_selector('#ib-splash', state='hidden', timeout=45000)

    def open_chat(friend='rhythm', thread=None):
        page.evaluate('async({friend,thread})=>{await loadCfgs();await openConv(_cfgs.find(c=>c.id===friend),thread)}', {'friend': friend, 'thread': thread})

    def send(text):
        page.locator('#cv-ta').fill(text)
        page.locator('#cv-send').click()
        expect(page.locator('#cv-ta')).to_have_value('')
        page.wait_for_function('()=>!document.getElementById("cv-receive").disabled')

    def idle():
        page.wait_for_function('()=>_sendKeys.size===0&&document.getElementById("cv-receive").textContent==="✦"')

    def messages(friend='rhythm', thread=''):
        return page.evaluate('async({friend,thread})=>(await dbGetByIndex("chatMessages","byFriend",friend)).filter(m=>(m.threadId||"")===thread).sort((a,b)=>a.timestamp-b.timestamp)', {'friend': friend, 'thread': thread})

    boot()
    page.evaluate("""async(base)=>{
        for(const id of ['rhythm','other'])await dbPut('apiConfigs',{id,nickname:id==='rhythm'?'晏景':'另一位',provider:'openai',apiKey:'fixture-key',endpoint:base+'/api/rhythm',model:'fixture-model',systemPrompt:'PERSONA_KEEP',streaming:false});
        await loadCfgs();await openConv(_cfgs.find(c=>c.id==='rhythm'));
    }""", BASE)
    expect(page.locator('#cv-receive')).to_be_disabled()
    original_send = page.locator('#cv-send').inner_html()
    # A full/unavailable local hint store cannot roll back a successfully saved user bubble.
    page.evaluate("""()=>{window.realStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('ib_reply_rhythm_v1:'))throw new DOMException('fixture full','QuotaExceededError');return realStorageSet.call(this,k,v)}}""")
    send('BATCH_ONE_A');send('BATCH_ONE_B')
    assert not requests
    with page.expect_request('**/api/rhythm'):
        page.locator('#cv-receive').click()
    wait_call(1)
    assert len(requests) == 1
    sent = json.dumps(requests[-1], ensure_ascii=False)
    assert sent.index('BATCH_ONE_A') < sent.index('BATCH_ONE_B')
    assert 'PERSONA_KEEP' in sent and 'messages' in sent
    assert '默认优先像微信聊天一样回复成 2～4 个独立气泡' in sent
    assert '只有非常短、单一语义的回复才使用单条' in sent
    assert '每条尽量只有 1 句话' in sent
    for rule in ['【聊天标点与句式】','少用句号、逗号、分号、冒号','句号可以自然表达情绪','保留代码、链接、工具标签','与用户自己填写的 System Prompt 并存']: assert rule in sent,rule
    assert page.evaluate('async()=>(await dbGet("apiConfigs","rhythm")).systemPrompt')=='PERSONA_KEEP'
    assert sent.index('【本轮聊天回复格式 · 多气泡】') < sent.index('【聊天标点与句式】')
    assert '我陪你慢慢缓一会儿。' in sent
    send('NEXT_ROUND_C')
    expect(page.locator('#cv-ta')).to_be_enabled()
    assert page.locator('#cv-send').inner_html() == original_send
    assert 'NEXT_ROUND_C' not in json.dumps(requests[-1])
    fulfill(held.pop(0), {'messages': ['回应第一条', '回应第二条']})
    idle()
    rows = messages()
    assert [m['content'] for m in rows if m['role']=='user'] == ['BATCH_ONE_A','BATCH_ONE_B','NEXT_ROUND_C']
    answers = [m for m in rows if m['role']=='assistant']
    assert [m['content'] for m in answers] == ['回应第一条','回应第二条']
    assert answers[1]['timestamp'] - answers[0]['timestamp'] >= 200
    assert len({m['id'] for m in rows}) == len(rows)
    expect(page.locator('#cv-receive')).to_be_enabled()
    # C precedes the assistant timestamps but remains pending even after a reload.
    page.evaluate("""()=>{Storage.prototype.setItem=realStorageSet;for(const k of Object.keys(localStorage))if(k.startsWith('ib_reply_rhythm_v1:'))localStorage.removeItem(k)}""")
    boot();open_chat();expect(page.locator('#cv-receive')).to_be_enabled()
    output['value'] = {'messages':['部分回复一','后续不应出现二','后续不应出现三']}
    page.locator('#cv-receive').click()
    page.wait_for_function('()=>_msgs.some(m=>m.content==="部分回复一")')
    send('NEXT_AFTER_PARTIAL')
    page.locator('#cv-receive').click()  # Stop, retaining the already committed first bubble.
    idle()
    page.wait_for_timeout(450)
    assert not any(m['content'].startswith('后续不应出现') for m in messages())
    expect(page.locator('#cv-receive')).to_be_enabled()
    assert 'NEXT_AFTER_PARTIAL' not in json.dumps(requests[-1])

    # Stop before any answer, then a failed retry: the same batch remains available.
    output['value'] = 'hold'
    expected=len(requests)+1
    with page.expect_request('**/api/rhythm'):
        page.locator('#cv-receive').click()
    wait_call(expected)
    page.locator('#cv-receive').click();idle()
    try: held.pop(0).abort()
    except Exception: pass
    expect(page.locator('#cv-receive')).to_be_enabled()
    output['value'] = 'error'
    page.locator('#cv-receive').click();idle()
    expect(page.locator('#cv-receive')).to_be_enabled()
    output['value'] = '{"messages":["", "不能吞掉原文"]}'
    page.locator('#cv-receive').click();idle()
    assert messages()[-1]['content'] == output['value']
    expect(page.locator('#cv-receive')).to_be_disabled()

    # All pending messages exceed the configured history window, but none may be truncated away.
    page.evaluate("""async()=>{
        await loadMP();_mp.perAi.rhythm={histLimit:4};await saveMP();
        for(let i=0;i<12;i++){const stamp=IBReplyRhythm.stamp();await dbPut('chatMessages',{id:'msg_'+stamp+'_batch_'+i,role:'user',friendId:'rhythm',content:'LONG_BATCH_'+i,timestamp:stamp})}
        await openConv(_cfgs.find(c=>c.id==='rhythm'));
    }""")
    output['value'] = 'plain fallback reply'
    page.locator('#cv-receive').click();idle()
    for i in range(12): assert 'LONG_BATCH_'+str(i) in json.dumps(requests[-1])
    assert messages()[-1]['content'] == 'plain fallback reply'

    # Model-selected semantic units, short replies, fence recovery and prose fallback
    # all persist as independent assistant records via the real request/save path.
    cases = [
        ({'messages':['今天辛苦了。','我陪你缓一会儿。','想聊聊吗？']}, ['今天辛苦了。','我陪你缓一会儿。','想聊聊吗？']),
        ({'messages':['好，等你。']}, ['好，等你。']),
        ('```json{"messages":["我在听。","你慢慢说。"]}```', ['我在听。','你慢慢说。']),
        ('我在这里陪你。\n\n等你想说的时候再告诉我。', ['我在这里陪你。','等你想说的时候再告诉我。']),
    ]
    for i, (response, expected_parts) in enumerate(cases):
        before_ids={m['id'] for m in messages()}
        send('SEMANTIC_UNITS_'+str(i));output['value']=response
        page.locator('#cv-receive').click();idle()
        saved=[m for m in messages() if m['role']=='assistant' and m['id'] not in before_ids]
        assert [m['content'] for m in saved]==expected_parts
        assert len({m['id'] for m in saved})==len(expected_parts)
        for m in saved:
            expect(page.locator('#cv-msgs .m[data-id="'+m['id']+'"]')).to_contain_text(m['content'])

    # Friend and thread isolation, including a late result after navigating away.
    send('MAIN_ONLY_PENDING')
    thread = {'id':'thread-fixture','friendId':'rhythm','name':'测试话题','memoryEnabled':True}
    page.evaluate('async(t)=>dbPut("chatThreads",t)', thread)
    open_chat(thread=thread);expect(page.locator('#cv-receive')).to_be_disabled();send('THREAD_ONLY_PENDING')
    open_chat('other');expect(page.locator('#cv-receive')).to_be_disabled();send('OTHER_ONLY_PENDING')
    assert page.evaluate('()=>IBChatReplyStyle.forConfig(_cfgs.find(c=>c.id==="other"))')==''
    open_chat(thread=thread)
    output['value'] = 'hold'
    expected=len(requests)+1
    with page.expect_request('**/api/rhythm'): page.locator('#cv-receive').click()
    wait_call(expected)
    request_text = json.dumps(requests[-1])
    assert 'THREAD_ONLY_PENDING' in request_text and 'MAIN_ONLY_PENDING' not in request_text and 'OTHER_ONLY_PENDING' not in request_text
    open_chat('other')
    try: fulfill(held.pop(0), {'messages':['不应串进其他会话']})
    except Exception: pass
    page.wait_for_timeout(450)
    assert not any(m['content']=='不应串进其他会话' for m in messages('other'))
    open_chat(thread=thread);expect(page.locator('#cv-receive')).to_be_enabled()
    output['value'] = {'messages':['话题回复']}
    page.locator('#cv-receive').click();idle()
    assert messages(thread='thread-fixture')[-1]['content']=='话题回复'
    open_chat();expect(page.locator('#cv-receive')).to_be_enabled()

    # Streaming uses the same provider path; structured syntax stays out of displayed bubbles.
    page.evaluate('async()=>{const cfg=await dbGet("apiConfigs","rhythm");cfg.streaming=true;await dbPut("apiConfigs",cfg);await loadCfgs();await openConv(_cfgs.find(c=>c.id==="rhythm"))}')
    output['value']={'messages':['流式链路回复一','流式链路回复二']}
    page.locator('#cv-receive').click();idle()
    assert requests[-1]['stream'] is True
    assert messages()[-1]['content']=='流式链路回复二'
    expect(page.locator('#cv-receive')).to_be_disabled()

    # Group Chat also queues sends and splits each member's returned messages.
    page.evaluate("""async()=>{const g={id:'group_rhythm',name:'节奏群',members:['rhythm'],mentionOnly:[]};await dbPut('groups',g);await openConv(groupAsCfg(g))}""")
    before=len(requests);send('GROUP_BATCH_A');send('GROUP_BATCH_B');assert len(requests)==before
    output['value']={'messages':['群回复一','群回复二']}
    page.locator('#cv-receive').click();idle()
    assert [m['content'] for m in messages('group_rhythm') if m['role']=='assistant']==['群回复一','群回复二']
    page.locator('#cv-back').click()

    # Listen Together: same controller and real genReply, scene metadata, music continuity.
    wav=b'RIFF'+struct.pack('<I',36+1600000)+b'WAVEfmt '+struct.pack('<IHHIIHH',16,1,1,8000,16000,2,16)+b'data'+struct.pack('<I',1600000)+bytes(1600000)
    page.route('**/rhythm-audio.wav',lambda r:r.fulfill(status=200,content_type='audio/wav',body=wav))
    page.evaluate("""async(base)=>{
        const cfg=await dbGet('apiConfigs','rhythm');cfg.streaming=false;await dbPut('apiConfigs',cfg);await loadCfgs();
        await (await import('./apps/ib-music-actions.js')).openListenTogether('rhythm');
        await dbPut('music',{id:'rhythm-song',name:'歌曲上下文',title:'歌曲上下文',artist:'歌手上下文',data:base+'/rhythm-audio.wav',addedAt:1,metaScanned:true,lyrics:{segments:[{time:0,text:'歌词上下文'}],timed:true}});
        await _pwPlayIdx(0);window.rhythmAudio=_pw.a;window.rhythmQueue=_pw.list;window.rhythmLyrics=document.querySelector('.ma-lyr');
    }""",BASE)
    modes=page.locator('.tg-room-modes');modes.get_by_role('button',name='对话',exact=True).click()
    composer=page.locator('.tg-chat-composer');receive=composer.locator('.tg-receive')
    def room_send(text):
        composer.locator('textarea').fill(text);composer.get_by_role('button',name='发送',exact=True).click();expect(receive).to_be_enabled()
    expect(receive).to_be_disabled();before=len(requests)
    room_send('ROOM_BATCH_A');room_send('ROOM_BATCH_B');assert len(requests)==before
    modes.get_by_role('button',name='音乐',exact=True).click();modes.get_by_role('button',name='对话',exact=True).click();expect(receive).to_be_enabled()
    output['value']='hold'
    expected=len(requests)+1
    with page.expect_request('**/api/rhythm'): receive.click()
    wait_call(expected)
    room_send('ROOM_NEXT_ROUND')
    sent=json.dumps(requests[-1],ensure_ascii=False)
    for marker in ['ROOM_BATCH_A','ROOM_BATCH_B','歌曲上下文','歌手上下文','Together / Listen Together','currentLyric','currentTime','playing','mate','PERSONA_KEEP']:assert marker in sent,marker
    assert '默认优先像微信聊天一样回复成 2～4 个独立气泡' in sent
    assert '【聊天标点与句式】' in sent and 'PERSONA_KEEP' in sent
    assert sent.index('Together / Listen Together') < sent.index('【本轮聊天回复格式 · 多气泡】')
    for marker in ['ROOM_NEXT_ROUND','OTHER_ONLY_PENDING','MAIN_ONLY_PENDING']:assert marker not in sent
    time_before=page.evaluate('()=>_pw.a.currentTime')
    modes.get_by_role('button',name='音乐',exact=True).click()
    fulfill(held.pop(0),{'messages':['一起听回复一','一起听回复二']})
    page.wait_for_function('()=>!_sendKeys.size')
    modes.get_by_role('button',name='对话',exact=True).click();expect(receive).to_be_enabled()
    expect(page.locator('.tg-message-list')).to_contain_text('一起听回复二')
    assert page.evaluate('()=>_pw.a===rhythmAudio&&_pw.list===rhythmQueue&&document.querySelector(".ma-lyr")===rhythmLyrics&&!_pw.a.paused')
    assert page.evaluate('()=>_pw.a.currentTime')>time_before
    record=page.evaluate('async()=>dbGet("apiSettings","listen_chat_v1:"+sessionStorage.getItem("ib_listen_chat_session:rhythm"))')
    assert [m['text'] for m in record['messages'] if m['author']=='me']==['ROOM_BATCH_A','ROOM_BATCH_B','ROOM_NEXT_ROUND']
    assert [m['text'] for m in record['messages'] if m['author']=='mate']==['一起听回复一','一起听回复二']
    assert len({m['id'] for m in record['messages']})==5
    # A different companion has an independent room and no inherited pending batch.
    page.evaluate('async()=>{await (await import("./apps/ib-music-actions.js")).openListenTogether("other")}')
    expect(receive).to_be_disabled()
    expect(page.locator('.tg-message-list')).not_to_contain_text('ROOM_NEXT_ROUND')
    page.evaluate('async()=>{await (await import("./apps/ib-music-actions.js")).openListenTogether("rhythm")}')
    expect(receive).to_be_enabled()
    # Reduced motion removes the delivery delay, while retaining distinct ids/timestamps.
    page.emulate_media(reduced_motion='reduce');output['value']={'messages':['静态节奏一','静态节奏二']}
    receive.click();page.wait_for_function('()=>!_sendKeys.size');expect(receive).to_be_disabled()
    # Parser bounds and lossless fallback are shared by both UI adapters.
    for value in [{'messages':[]},{'messages':['a']*5},{'messages':['']},{'messages':[None]}]:
        raw=json.dumps(value)
        assert page.evaluate('(raw)=>IBReplyRhythm.parse(raw)',raw)==[raw]
    assert page.evaluate('()=>IBReplyRhythm.parse(JSON.stringify({messages:["a","b","c","d"]}))')==['a','b','c','d']
    # Valid model choices are never punctuation-split, even when overlong.
    long_reply='我听到你今天经历了很多。我们可以慢慢聊，不急着一次说完。你想从哪里开始？'
    assert page.evaluate('(t)=>IBReplyRhythm.parse(JSON.stringify({messages:[t]}))',long_reply)==[long_reply]
    for raw in ['一句话，不要切碎。', '第一句。第二句！第三句？', '```js\nconst a = 1;\n\nconst b = 2;\n```', '<ws_call/>\n\n我在这里陪你。', '- 第一个事项\n\n- 第二个事项', '“这是引用原文。\n\n请保持原样。”', '{"messages":["未完成的 JSON']:
        assert page.evaluate('(raw)=>IBReplyRhythm.parse(raw)',raw)==[raw]
    assert page.evaluate('(raw)=>IBReplyRhythm.parse(raw)','```JSON\n{"messages":["第一条。","第二条。"]}\n```')==['第一条。','第二条。']
    page.screenshot(path='/tmp/listen-reply-rhythm.png')
    assert not errors,errors
    print('PASS: send-only independent user bubbles; explicit receive; immutable batch and next queue; 1-4 delivery and fallback; stop before/after first bubble; errors/retry; reload; full batch beyond history cap; friend/thread/group isolation; native streaming; real Together API and music context; mode/partner isolation; durable room messages; uninterrupted playback; reduced motion; no page errors.')
    browser.close()
