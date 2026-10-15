"""Invitation-only Together entry; browser fixtures never contact a real AI service."""
import os
from playwright.sync_api import sync_playwright, expect

BASE_URL = os.environ.get('IB_TEST_BASE_URL', 'http://localhost:8771').rstrip('/')
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    errors = []

    def start(mock=False):
        context = browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
        context.route('https://**/*', lambda r: r.abort())
        page = context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(BASE_URL + ('/?ib-ai-mock=1' if mock else '/'))
        page.wait_for_function('()=>window._ibBootDone===true')
        page.evaluate('()=>_lkUnlock()')
        page.wait_for_selector('#ib-splash', state='hidden', timeout=45000)
        page.wait_for_function('()=>IBApps.list().some(a=>a.id==="together")')
        page.evaluate('()=>IBApps.open("together")')
        page.locator('[data-activity=listen]').wait_for()
        return page

    def enter(page):
        page.locator('[data-activity=listen]').click()
        page.locator('dialog.tg-invitation[open]').wait_for()
        assert page.locator('#music-app.open.tg-listen').count() == 0
        box = page.locator('dialog.tg-invitation[open]').bounding_box()
        assert 19 <= box['x'] <= 21 and box['y'] > 40 and box['height'] < 500, box

    def mock_reply(page, scenario):
        dialog = page.locator('dialog.tg-invitation[open]')
        dialog.get_by_label('模拟邀请回应').select_option(scenario)
        dialog.get_by_role('button', name='模拟回应', exact=True).click()
        return dialog

    # Normal mode: no credentials -> no invitation, no fake contact, no mock controls.
    plain = start()
    enter(plain)
    expect(plain.locator('dialog h2')).to_have_text('需要先配置晏景后才能发送邀请')
    assert plain.get_by_label('模拟邀请回应').count() == 0
    assert plain.evaluate('async()=> (await dbGetAll("apiConfigs")).length') == 0
    assert plain.evaluate('()=>localStorage.getItem("ib_music_participation_v1")') is None
    plain.locator('dialog').get_by_role('button', name='关闭', exact=True).click()
    # Test-only credential; blocked network must show retry, never fabricate acceptance.
    plain.evaluate("async()=>{await dbPut('apiConfigs',{id:'configured-test',nickname:'晏景',provider:'openai',apiKey:'test-only-not-a-real-key'});await loadCfgs()}")
    enter(plain)
    expect(plain.locator('dialog p')).to_contain_text('暂时没有收到有效回应')
    expect(plain.locator('dialog').get_by_role('button', name='重试', exact=True)).to_be_visible()
    assert plain.evaluate('()=>Object.values(JSON.parse(localStorage.ib_music_participation_v1).invitations).every(i=>i.status==="pending")')
    plain.locator('dialog').get_by_role('button', name='关闭', exact=True).click()
    enter(plain)
    assert plain.evaluate('()=>Object.keys(JSON.parse(localStorage.ib_music_participation_v1).invitations).length') == 1
    plain.context.close()

    # Mock mode works with no contact creation. Loading, error, refusal and retry stay outside the room.
    mock = start(True)
    enter(mock)
    mock_reply(mock, 'loading')
    expect(mock.locator('dialog h2')).to_have_text('正在邀请晏景一起听…')
    assert mock.locator('#music-app.open.tg-listen').count() == 0
    mock_reply(mock, 'error')
    expect(mock.locator('dialog p')).to_contain_text('暂时没有完成')
    mock_reply(mock, 'decline')
    expect(mock.locator('dialog p')).to_have_text('今天想安静陪你一会儿，先不听，好不好。')
    assert mock.locator('#music-app.open.tg-listen').count() == 0
    mock.locator('dialog').get_by_role('button', name='关闭', exact=True).click()
    enter(mock)
    # A room startup failure leaves the same invitation pending and can be retried.
    mock.evaluate('()=>{window.savedMusicOpener=window.openMusicApp;window.openMusicApp=async()=>{throw new Error("TEST_START_FAILURE")}}')
    mock_reply(mock, 'accept')
    expect(mock.locator('dialog p')).to_contain_text('暂时没有完成')
    expect(mock.locator('dialog').get_by_role('button', name='模拟回应', exact=True)).to_be_enabled()
    assert mock.locator('#music-app.open.tg-listen').count() == 0
    mock.evaluate('()=>{window.openMusicApp=window.savedMusicOpener}')
    mock_reply(mock, 'accept')
    expect(mock.locator('dialog h2')).to_have_text('晏景接受了邀请')
    mock.locator('#music-app.open.tg-listen').wait_for()
    mock.wait_for_function('()=>!document.querySelector("dialog.tg-invitation[open]")')
    assert mock.evaluate('async()=> (await dbGetAll("apiConfigs")).length') == 0
    mock.locator('#ma-back').click()

    # The existing executor emits an incoming invitation. Neither button is chosen automatically.
    def incoming(key):
        return mock.evaluate("""async(key)=>{
            const m=await import('./apps/ib-music-actions.js');
            return await m.executeMusicAction({type:'invite_listen_together',actor:'yanjing'},
                {conversationKey:key});
        }""", key)

    first = incoming('incoming-test')
    expect(mock.locator('dialog h2')).to_have_text('晏景邀请你一起听歌')
    assert mock.locator('#music-app.open.tg-listen').count() == 0
    assert mock.evaluate('(id)=>JSON.parse(localStorage.ib_music_participation_v1).invitations[id].status', first['id']) == 'pending'
    mock.locator('dialog').get_by_role('button', name='暂时不要', exact=True).click()
    expect(mock.locator('dialog h2')).to_have_text('这次先不一起听')
    assert mock.locator('#music-app.open.tg-listen').count() == 0
    assert mock.evaluate('(id)=>JSON.parse(localStorage.ib_music_participation_v1).invitations[id].status', first['id']) == 'declined'
    mock.locator('dialog').get_by_role('button', name='关闭', exact=True).click()
    # Expire cooldown in the test fixture only; production retains its existing five-minute rule.
    mock.evaluate('()=>{const s=JSON.parse(localStorage.ib_music_participation_v1);s.lastInviteAt=0;localStorage.ib_music_participation_v1=JSON.stringify(s)}')
    second = incoming('incoming-accept-test')
    mock.locator('dialog').get_by_role('button', name='一起听', exact=True).click()
    mock.locator('#music-app.open.tg-listen').wait_for()
    mock.wait_for_function('()=>!document.querySelector("dialog.tg-invitation[open]")')
    assert mock.evaluate('(id)=>JSON.parse(localStorage.ib_music_participation_v1).invitations[id].status', second['id']) == 'accepted'
    assert not errors, errors
    print('PASS: Together entry never opens directly; normal missing/configured API handling; no fake contacts; pending reuse; explicit Mock loading/error/decline/accept; acceptance notice before room; proactive modal waits for user; decline stays outside; accept opens existing room; no page errors.')
    browser.close()
