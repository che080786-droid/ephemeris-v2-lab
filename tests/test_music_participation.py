from playwright.sync_api import sync_playwright
import json, struct, base64, os
BASE_URL=os.environ.get('IB_TEST_BASE_URL','http://localhost:8770').rstrip('/')
from urllib.parse import urlparse,parse_qs
wav=b'RIFF'+struct.pack('<I',36+1600000)+b'WAVEfmt '+struct.pack('<IHHIIHH',16,1,1,8000,16000,2,16)+b'data'+struct.pack('<I',1600000)+bytes(1600000)
audio='data:audio/wav;base64,'+base64.b64encode(wav).decode()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':390,'height':844},service_workers='block');page=c.new_page();errors=[];calls=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 def api(route):
  q=parse_qs(urlparse(route.request.url).query);calls.append(q);kind=q.get('type',[''])[0]
  payload=([{'id':'101','name':'晴天','artist':['周杰伦']}] if kind=='search' else {'url':BASE_URL+'/test-audio.wav'} if kind=='url' else '[00:00.00]测试歌词\n[00:02.00]第二句')
  route.fulfill(status=200,content_type='application/json' if kind!='lyric' else 'text/plain',body=json.dumps(payload) if kind!='lyric' else payload)
 c.route('https://music.yuncan.xyz/**',api);c.route('https://api.injahow.cn/**',api);c.route('**/test-audio.wav',lambda r:r.fulfill(status=200,content_type='audio/wav',body=wav))
 page.goto(BASE_URL+'/?ib-ai-mock=1');page.wait_for_function('()=>window._ibBootDone===true');page.evaluate('()=>_lkUnlock()')
 page.evaluate("async()=>{(await import('./apps/ib-together-music-ui.js')).installMusicUi();await openMusicApp()}")
 page.wait_for_selector('#ib-splash',state='hidden',timeout=45000)
 page.evaluate("async(audio)=>{for(const [i,id] of ['one','two'].entries())await dbPut('music',{id,name:'测试'+id,title:'测试'+id,artist:'歌手',data:audio,addedAt:i+1,metaScanned:true,lyrics:{segments:[{time:0,text:'测试歌词'},{time:2,text:'第二句'}],timed:true}});await _pwPlayIdx(0);window.originalAudio=_pw.a;localStorage.setItem('ib_music_library_v1',JSON.stringify({version:1,tracks:{'local:one':{key:'local:one',title:'测试one'}},liked:['local:one'],playlists:[{id:'old',name:'原歌单',trackKeys:['local:one']}]}));window.dispatchEvent(new Event('ib-music-library-change'))}",audio)
 page.wait_for_function('()=>document.querySelector(".tg-song-heart").getAttribute("aria-pressed")==="true"')
 def action(value,opts={}):
  return page.evaluate("async({value,opts})=>(await import('./apps/ib-music-actions.js')).executeMusicAction(value,opts)",{'value':value,'opts':opts})
 action({'type':'like_song','actor':'yanjing'});assert page.locator('.tg-song-heart').get_attribute('data-both')=='true'
 data=json.loads(page.evaluate("()=>localStorage.getItem('ib_music_library_v1')"));assert data['actorLikes']=={'mingyue':['local:one'],'yanjing':['local:one']};assert data['playlists'][0]['id']=='old'
 page.locator('.tg-song-heart').click();assert page.locator('.tg-song-heart').get_attribute('data-both')=='false';assert page.locator('.tg-song-heart').get_attribute('data-yanjing')=='true'
 action({'type':'unlike_song','actor':'yanjing'});action({'type':'like_song','actor':'mingyue'})
 action({'type':'add_to_playlist','actor':'yanjing','playlist':{'id':'old'}});action({'type':'add_to_playlist','actor':'yanjing','playlist':{'name':'一起听'}})
 data=json.loads(page.evaluate("()=>localStorage.getItem('ib_music_library_v1')"));assert data['playlists'][0]['trackKeys']==['local:one'];assert data['playlists'][1]['name']=='一起听'
 action({'type':'next_track','actor':'yanjing'});page.wait_for_function('()=>_pw.idx===1')
 action({'type':'previous_track','actor':'yanjing'});page.wait_for_function('()=>_pw.idx===0')
 action({'type':'play_track','actor':'yanjing','track':{'recordId':'two'}});assert page.evaluate('()=>_pw.idx===1&&_pw.a===originalAudio&&!_pw.a.paused')
 page.evaluate("async()=>{await dbPut('apiConfigs',{id:'yanjing-test',nickname:'晏景',provider:'openai',created:1});await loadCfgs();document.getElementById('music-app').classList.remove('open');await openConv(_cfgs.find(c=>c.id==='yanjing-test'))}")
 page.wait_for_selector('[data-music-participation=mock]',state='attached')
 def mock(scenario):
  previous=page.evaluate('()=>_msgs.at(-1)?.id||null')
  page.locator('[data-music-participation=mock]').evaluate('(b)=>b.click()')
  page.locator('.ib-music-mock-picker select').select_option(scenario);page.locator('.ib-music-mock-picker').get_by_role('button',name='发送',exact=True).click()
  if scenario!='loading':page.wait_for_function('(previous)=>_msgs.length>0&&_msgs.at(-1).id!==previous&&_msgs.at(-1).musicParticipation?.pending===false',arg=previous)
 mock('like');assert page.evaluate('()=>JSON.parse(localStorage.ib_music_library_v1).actorLikes.yanjing.includes("local:two")')
 mock('recommend');assert page.locator('#cv-msgs .ib-music-card').last.get_by_role('button',name='播放',exact=True).count()==1
 assert '晴天' in page.locator('#cv-msgs .ib-music-card').last.inner_text()
 page.locator('#cv-msgs .ib-music-card').last.get_by_role('button',name='播放',exact=True).click();page.wait_for_function('()=>_pw.list[_pw.idx]?.publicTrack?.id==="101"&&!_pw.a.paused')
 assert any(q.get('type')==['search'] and q.get('id')==['晴天 周杰伦'] for q in calls);assert page.evaluate('()=>_pw.a===originalAudio');publickey=page.evaluate("async()=>(await import('./apps/ib-music-library.js')).trackKey(_pw.list[_pw.idx])")
 page.locator('#cv-msgs .ib-music-card').last.get_by_role('button',name='忽略',exact=True).click();page.wait_for_function('()=>_msgs.at(-1).musicParticipation.results[0].status==="dismissed"')
 # Failed recommendation playback leaves the chat and current player intact, and permits retry.
 mock('recommend');before=page.evaluate('()=>_pw.list[_pw.idx].id');c.route('https://music.yuncan.xyz/**',lambda r:r.fulfill(status=200,content_type='application/json',body='[]'));c.route('https://api.injahow.cn/**',lambda r:r.fulfill(status=200,content_type='application/json',body='[]'))
 card=page.locator('#cv-msgs .ib-music-card').last;card.get_by_role('button',name='播放',exact=True).click();page.wait_for_function('()=>Array.from(document.querySelectorAll("#cv-msgs .ib-music-card small")).some(s=>s.textContent.includes("暂时没有完成"))')
 assert card.get_by_role('button',name='播放',exact=True).is_enabled();assert page.evaluate('(id)=>_pw.list[_pw.idx].id===id',before)
 mock('ordinary');assert page.evaluate('()=>_msgs.at(-1).musicParticipation.actions.length===0')
 assert page.evaluate("async()=>{const {normalizeResponse}=await import('./apps/ib-together-ai-adapter.js');return normalizeResponse({text:'下一首，喜欢这首歌'}).actions.length===0}")
 assert page.evaluate("async()=>{const {normalizeMusicAction}=await import('./apps/ib-music-actions.js');try{normalizeMusicAction({type:'next_track',actor:'unknown'});return false}catch(e){return true}}")
 mock('invite');card=page.locator('#cv-msgs .ib-music-card').last;assert card.get_by_role('button',name='暂时不要',exact=True).count()==1
 card.get_by_role('button',name='暂时不要',exact=True).click();page.wait_for_function('()=>Object.values(JSON.parse(localStorage.ib_music_participation_v1).invitations).some(i=>i.actor==="yanjing"&&i.status==="declined")')
 mock('invite');assert page.evaluate('()=>_msgs.at(-1).musicParticipation.results.length===0');assert '稍后再邀请' in page.locator('#cv-msgs').inner_text()
 mock('decline');assert '先不听，好不好' in page.locator('#cv-msgs').inner_text();assert '这次先不一起听' in page.locator('#cv-msgs .ib-music-card').last.inner_text()
 mock('loading');page.wait_for_function('()=>_msgs.at(-1)?.musicParticipation?.pending===true');mock('error');assert page.evaluate('()=>_msgs.at(-1).musicParticipation.pending===false')
 mock('accept');page.wait_for_selector('#music-app.open.tg-listen');assert page.evaluate('()=>_mp.musicAi.mate==="yanjing-test"&&_pw.a===originalAudio')
 assert '已经一起听' in page.locator('#cv-msgs .ib-music-card').last.inner_text()
 # Test room controls and keep native nodes/queue/audio unchanged through mode changes.
 page.evaluate('()=>{window.savedLyrics=document.querySelector(".ma-lyr");window.savedQueue=_pw.list}')
 def roommock(label):
  page.locator('.tg-music-more').click();page.get_by_role('button',name='Mock 测试',exact=True).click();page.get_by_role('button',name=label,exact=True).click();page.wait_for_function('()=>!document.querySelector(".tg-message-list .is-pending")')
 roommock('晏景喜欢当前歌曲');page.wait_for_function('()=>document.querySelector(".tg-song-heart").dataset.yanjing==="true"')
 page.locator('.tg-room-modes').get_by_role('button',name='音乐',exact=True).click();assert page.evaluate('()=>savedLyrics===document.querySelector(".ma-lyr")&&savedQueue===_pw.list&&originalAudio===_pw.a')
 # Refresh data and persisted native chat cards must not replay executed actions.
 page.reload();page.wait_for_function('()=>window._ibBootDone===true');page.evaluate('()=>_lkUnlock()')
 page.evaluate("async()=>{(await import('./apps/ib-together-music-ui.js')).installMusicUi();await loadCfgs();await openConv(_cfgs.find(c=>c.id==='yanjing-test'))}")
 assert page.locator('#cv-msgs .ib-music-card').count()>=4
 assert page.evaluate('(key)=>JSON.parse(localStorage.ib_music_library_v1).actorLikes.mingyue.includes("local:one")&&JSON.parse(localStorage.ib_music_library_v1).actorLikes.yanjing.includes(key)',publickey)
 assert page.evaluate('()=>Date.now()-JSON.parse(localStorage.ib_music_participation_v1).lastInviteAt<300000')
 assert page.locator('#cv-msgs').inner_text().find('mood')==-1
 # Mock developer entry must be absent without query flag.
 plain=c.new_page();plain.goto(BASE_URL+'/');plain.wait_for_function('()=>window._ibBootDone===true');plain.evaluate("async()=>{(await import('./apps/ib-together-music-ui.js')).installMusicUi();await loadCfgs();await openConv(_cfgs.find(c=>c.id==='yanjing-test'))}")
 assert plain.locator('[data-music-participation=mock]').count()==0;assert plain.locator('[data-music-participation=invite]').count()==1
 assert not errors,errors
 print('PASS: v1 favorite migration; independent/shared likes; playlist reuse/dedup; same native audio/queue next/previous/play; native chat Mock structured likes/recommendation/ordinary; public search+URL+lyrics playback; ignore persistence; proactive invitation decline/cooldown; user invitation loading/error/decline/accept; native Together entry+pairing; room shared controls and lyric preservation; reload chat cards/cooldown/likes; no Mock entry without flag; no page errors.')
 b.close()
