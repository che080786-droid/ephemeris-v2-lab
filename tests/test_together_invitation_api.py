"""Exercise Chat's real provider transport with intercepted responses, never live credentials."""
import json
import os
from playwright.sync_api import sync_playwright, expect

BASE_URL = os.environ.get('IB_TEST_BASE_URL', 'http://localhost:8772').rstrip('/')
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    errors = []

    def start(provider='openai', mock=False):
        context = browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
        context.route('https://**/*', lambda r: r.abort())
        page = context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(BASE_URL + ('/?ib-ai-mock=1' if mock else '/'))
        page.wait_for_function('()=>window._ibBootDone===true')
        page.evaluate('()=>_lkUnlock()')
        page.wait_for_selector('#ib-splash', state='hidden', timeout=45000)
        page.evaluate("""async({provider,base})=>{
            const cfg={id:'api-fixture',nickname:'晏景',provider,endpoint:base+'/api/'+provider,
                apiKey:'fixture-key-not-a-secret',model:'fixture-model',systemPrompt:'PERSONA_SENTINEL',
                relationship:'相伴',autoMem:true,autoMemMode:'full',sealTimestamp:100};
            await dbPut('apiConfigs',cfg);await loadCfgs();window.fixtureOriginal=JSON.stringify(await dbGet('apiConfigs',cfg.id));
            await dbPut('about',{id:'main',name:'明月',bio:'PRIVATE_BIO_SENTINEL',bioPrivate:true});
            for(const m of [
                {id:'msg_001',role:'user',content:'SEALED_SENTINEL',friendId:cfg.id,timestamp:50},
                {id:'msg_002',role:'user',content:'RECENT_SENTINEL',friendId:cfg.id,timestamp:200},
                {id:'msg_003',role:'assistant',content:'RECENT_REPLY',friendId:cfg.id,timestamp:201},
                {id:'msg_004',role:'user',content:'OTHER_THREAD_SENTINEL',friendId:cfg.id,threadId:'other',timestamp:202},
                {id:'msg_005',role:'user',content:'OTHER_FRIEND_SENTINEL',friendId:'other',timestamp:203}
            ])await dbPut('chatMessages',m);
            await dbPut('apiSettings',{id:'summarySettings',enabled:true,keepCount:6});
            await dbPut('chatSummaries',{id:'sum_'+cfg.id,summary:'SUMMARY_SENTINEL',sealTimestamp:100});
            await dbPut('memories',{id:'visible',visibility:'only',visibleTo:[cfg.id],content:'MEMORY_SENTINEL',pinned:true});
            await dbPut('memories',{id:'hidden',visibility:'private',content:'PRIVATE_MEMORY_SENTINEL',pinned:true});
            await dbPut('autoMemory',{id:'auto',friendId:cfg.id,priority:'always',content:'AUTO_MEMORY_SENTINEL',created:1});
            window.fixtureHistory=JSON.stringify(await dbGetAll('chatMessages'));
            IBApps.open('together');
        }""", {'provider': provider, 'base': BASE_URL})
        page.locator('[data-activity=listen]').wait_for()
        return page

    def transport(page, provider, output, requests):
        def handle(route):
            request = route.request
            body = request.post_data_json
            requests.append({'body': body, 'headers': request.headers, 'url': request.url})
            value = output['value']
            if value == 'http-error':
                route.fulfill(status=401, content_type='application/json', body='{"error":"fixture failure"}')
                return
            if value == 'hold':
                output['held'] = route
                return
            raw = json.dumps(value, ensure_ascii=False) if isinstance(value, dict) else value
            if provider == 'anthropic':
                payload = {'content': [{'type': 'text', 'text': raw}], 'stop_reason': 'end_turn'}
            elif provider == 'gemini':
                payload = {'candidates': [{'content': {'parts': [{'text': raw}]}, 'finishReason': 'STOP'}]}
            else:
                payload = {'choices': [{'message': {'content': raw}, 'finish_reason': 'stop'}]}
            route.fulfill(status=200, content_type='application/json', body=json.dumps(payload))
        page.route('**/api/**', handle)

    def unchanged(page):
        assert page.evaluate('async()=>JSON.stringify(await dbGet("apiConfigs","api-fixture"))===fixtureOriginal')
        assert page.evaluate('async()=>JSON.stringify(await dbGetAll("chatMessages"))===fixtureHistory')

    # All provider formats go through the existing callAI, preserving endpoint/auth/model and persona.
    for provider in ['openai', 'anthropic', 'gemini']:
        page = start(provider)
        output = {'value': {'reply': '好呀，但今天我想先自己听。', 'decision': 'decline_listen_together'}}
        requests = []
        transport(page, provider, output, requests)
        page.locator('[data-activity=listen]').click()
        expect(page.locator('dialog p')).to_have_text(output['value']['reply'])
        assert page.locator('#music-app.open.tg-listen').count() == 0
        assert len(requests) == 1
        request = requests[0]
        sent = json.dumps(request['body'], ensure_ascii=False)
        for marker in ['PERSONA_SENTINEL', 'RECENT_SENTINEL', 'SUMMARY_SENTINEL', 'MEMORY_SENTINEL', 'AUTO_MEMORY_SENTINEL', 'accept_listen_together', 'decline_listen_together']:
            assert marker in sent, (provider, marker)
        assert '【记忆（系统参考' in sent
        for marker in ['SEALED_SENTINEL', 'OTHER_THREAD_SENTINEL', 'OTHER_FRIEND_SENTINEL', 'PRIVATE_BIO_SENTINEL', 'PRIVATE_MEMORY_SENTINEL']:
            assert marker not in sent, (provider, marker)
        if provider == 'gemini':
            assert request['url'].startswith(BASE_URL+'/api/gemini?key=fixture-key-not-a-secret')
        else:
            assert request['body']['model'] == 'fixture-model'
            assert request['body']['stream'] is False
            header = 'x-api-key' if provider == 'anthropic' else 'authorization'
            assert 'fixture-key-not-a-secret' in request['headers'][header]
        assert page.get_by_label('模拟邀请回应').count() == 0
        unchanged(page)
        page.context.close()

    page = start()
    requests = []
    output = {'value': 'http-error'}
    transport(page, 'openai', output, requests)
    page.locator('[data-activity=listen]').click()
    expect(page.locator('dialog p')).to_contain_text('暂时没有收到有效回应')
    retry = page.locator('dialog').get_by_role('button', name='重试', exact=True)
    # Plain words and malformed/ambiguous structure never imply acceptance.
    for invalid in ['好，一起听。', {'reply': '好', 'decision': 'accept'}, {'reply': '', 'decision': 'accept_listen_together'}, {'reply': '好', 'decision': 'accept_listen_together', 'inviteId': 'other'}]:
        output['value'] = invalid
        retry.click()
        expect(retry).to_be_enabled()
        expect(page.locator('dialog p')).to_contain_text('暂时没有收到有效回应')
        assert page.locator('#music-app.open.tg-listen').count() == 0
        assert page.evaluate('()=>Object.values(JSON.parse(localStorage.ib_music_participation_v1).invitations).every(i=>i.status==="pending")')
    output['value'] = {'reply': '刚才还有点犹豫，现在想和你听一首。', 'decision': 'accept_listen_together'}
    retry.click()
    expect(page.locator('dialog h2')).to_have_text('晏景接受了邀请')
    expect(page.locator('dialog p')).to_have_text(output['value']['reply'])
    assert page.locator('#music-app.open.tg-listen').count() == 0
    page.locator('#music-app.open.tg-listen').wait_for()
    assert len(requests) == 6
    unchanged(page)
    page.context.close()

    # Thread-specific memory switch and history use the normal Chat builders, without changing a turn.
    page = start()
    result = page.evaluate("""async()=>{
        _activeCfg=_cfgs.find(c=>c.id==='api-fixture');
        _activeThread={id:'other',memoryEnabled:false,quiet:true,sealTimestamp:0};
        const m=await import('./apps/ib-together-invitation-ai.js');
        const context=await m.buildInvitationContext(_activeCfg);
        return JSON.stringify(context);
    }""")
    assert 'OTHER_THREAD_SENTINEL' in result
    for marker in ['RECENT_SENTINEL', 'SUMMARY_SENTINEL', '【记忆（系统参考', 'PRIVATE_MEMORY_SENTINEL']:
        assert marker not in result
    unchanged(page)
    page.context.close()

    # Closing an in-flight invitation aborts it; a late response cannot enter the room.
    page = start()
    requests = []
    output = {'value': 'hold'}
    transport(page, 'openai', output, requests)
    with page.expect_request('**/api/openai'):
        page.locator('[data-activity=listen]').click()
    page.locator('dialog').get_by_role('button', name='关闭', exact=True).click()
    try:
        output['held'].fulfill(status=200, content_type='application/json', body=json.dumps({'choices':[{'message':{'content':json.dumps({'reply':'一起听','decision':'accept_listen_together'})}}]}))
    except Exception:
        pass  # Browser may already have cancelled the intercepted request.
    page.wait_for_timeout(1500)  # Outlast the acceptance notice: a late result must still not open a room.
    assert page.locator('#music-app.open.tg-listen').count() == 0
    unchanged(page)
    page.context.close()

    # A configured account in Mock mode still must not make a real provider request.
    page = start(mock=True)
    requests = []
    transport(page, 'openai', {'value': 'http-error'}, requests)
    page.locator('[data-activity=listen]').click()
    page.get_by_label('模拟邀请回应').select_option('decline')
    page.locator('dialog').get_by_role('button', name='模拟回应', exact=True).click()
    expect(page.locator('dialog h2')).to_have_text('晏景这次先不一起听')
    assert not requests
    unchanged(page)
    assert not errors, errors
    browser.close()
    print('PASS: existing OpenAI/Anthropic/Gemini transport; persona, history, summary and memories; privacy/seals/thread scoping; strict structured decisions; real reply before acceptance; failure/retry; dismissal abort; no Chat/config writes; Mock makes no provider requests.')
