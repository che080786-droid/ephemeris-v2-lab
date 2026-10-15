"""Local Home data, navigation and mobile layout. No live AI or external requests."""
import os
from datetime import datetime
from playwright.sync_api import sync_playwright, expect

BASE=os.environ.get('IB_TEST_BASE_URL','http://localhost:8780').rstrip('/')
PHOTO='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg=='
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':390,'height':844},timezone_id='Asia/Shanghai',service_workers='block')
    context.route('https://**/*',lambda r:r.abort())
    page=context.new_page();errors=[];posts=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:posts.append(r.url) if r.method=='POST' else None)
    page.clock.set_fixed_time(datetime.fromisoformat('2026-10-15T19:07:00+08:00'))

    def boot():
        page.goto(BASE+'/')
        page.wait_for_function('()=>window._ibBootDone===true')
        page.evaluate('()=>_lkUnlock()')
        page.wait_for_selector('#ib-splash',state='hidden',timeout=45000)
        expect(page.locator('#oh-date-edit')).to_be_enabled()

    def refresh():
        page.evaluate("async()=>{_sec.profile='cal';navTo('profile')}")
        page.wait_for_timeout(150)

    boot()
    expect(page.locator('#oh-count')).to_have_text('待设置')
    expect(page.locator('#oh-photo-empty')).to_be_visible()
    expect(page.locator('#oh-time')).to_have_text('19:07')
    expect(page.locator('#oh-phase')).to_contain_text('NIGHT')
    original_phrase=page.locator('#oh-phrase').inner_text()
    assert page.locator('#our-home').count()==1

    # A created timestamp / first chat is not an explicitly chosen anniversary.
    page.evaluate('''async(photo)=>{
        await dbPut('about',{id:'main',name:'明月',avatar:photo,galleryImages:[photo,photo,photo]});
        await dbPut('apiConfigs',{id:'home-yanjing',nickname:'晏景',provider:'openai',created:123456,avatar:photo,systemPrompt:'USER_PERSONA_UNCHANGED'});
        await dbPut('chatMessages',{id:'home-old-chat',friendId:'home-yanjing',role:'user',content:'历史消息',timestamp:123456});
        await dbPut('calNotes',{id:'home-real-note',body:'真实便笺测试',created:Date.now()});
    }''',PHOTO)
    refresh();expect(page.locator('#oh-count')).to_have_text('待设置')
    expect(page.locator('#oh-photos img')).to_have_count(3)
    expect(page.locator('#oh-photo-empty')).to_be_hidden()
    assert 'data:image' in page.locator('#oh-me-avatar').evaluate('(e)=>e.style.backgroundImage')
    assert 'data:image' in page.locator('#oh-mate-avatar').evaluate('(e)=>e.style.backgroundImage')
    page.locator('#oh-note').click()
    expect(page.locator('#sheet-notes-all')).to_have_class('sheet open')
    expect(page.locator('#cal-notes')).to_contain_text('真实便笺测试')
    page.locator('#sheet-notes-all [data-close]').click()

    page.evaluate("async()=>dbPut('apiSettings',{id:'calendarSettings',meetSet:{'home-yanjing':'2026-09-07'}})")
    refresh();expect(page.locator('#oh-count')).to_have_text('38')
    expect(page.locator('#oh-since')).to_have_text('Since 2026.09.07')
    page.locator('#oh-date-edit').click();page.locator('#oh-start-date').fill('2026-09-08')
    page.locator('#oh-date-form [type=submit]').click()
    expect(page.locator('#oh-count')).to_have_text('37')
    assert page.evaluate("async()=>(await dbGet('apiSettings','homeTogetherV1')).since")=='2026-09-08'
    assert page.evaluate("async()=>(await dbGet('apiSettings','calendarSettings')).meetSet['home-yanjing']")=='2026-09-07'
    assert page.evaluate("async()=>(await dbGet('apiConfigs','home-yanjing')).systemPrompt")=='USER_PERSONA_UNCHANGED'
    boot();expect(page.locator('#oh-count')).to_have_text('37')
    expect(page.locator('#oh-phrase')).to_have_text(original_phrase)
    page.locator('#oh-date-edit').click();page.locator('#oh-start-date').fill('2026-10-16')
    assert not page.locator('#oh-start-date').evaluate('(e)=>e.checkValidity()')
    page.locator('#oh-date-cancel').click()

    page.clock.set_fixed_time(datetime.fromisoformat('2026-10-16T07:04:00+08:00'))
    page.evaluate("()=>document.dispatchEvent(new Event('visibilitychange'))")
    expect(page.locator('#oh-count')).to_have_text('38')
    expect(page.locator('#oh-phase')).to_contain_text('DAY')
    expect(page.locator('#oh-greeting')).to_have_text('早上好')
    assert page.locator('#oh-phrase').inner_text()!=original_phrase
    next_phrase=page.locator('#oh-phrase').inner_text();boot()
    expect(page.locator('#oh-phrase')).to_have_text(next_phrase)

    # Original Desk, Space, Friends/Circle and Letters remain real entry points.
    page.locator('.our-home-switch [data-view=desk]').click()
    expect(page.locator('#our-home')).to_be_hidden()
    assert page.locator('#sb-desk').is_visible() or page.locator('#dk-osw').is_visible()
    page.locator('.our-home-switch [data-view=home]').click()
    page.locator('#oh-space').click();expect(page.locator('#sec-profile-card')).to_have_class('psec on')
    refresh();expect(page.locator('#our-home')).to_be_visible()
    page.locator('#oh-letters').click();expect(page.locator('#page-letters')).to_have_class('page active')
    refresh()

    for width in [320,375,390,430]:
        page.set_viewport_size({'width':width,'height':844})
        for dark in [False,True]:
            page.evaluate('(dark)=>document.body.classList.toggle("theme-infernal",dark)',dark)
            assert page.evaluate('()=>document.documentElement.scrollWidth<=innerWidth'),(width,dark)
            assert page.locator('#oh-time').evaluate('(e)=>e.scrollWidth<=e.clientWidth'),width
            sizes=page.locator('.oh-avatar').evaluate_all('(xs)=>xs.map(e=>e.getBoundingClientRect().width)')
            assert sizes==[56,56],sizes
            assert page.locator('#oh-count').evaluate('(e)=>getComputedStyle(e).color')!='rgba(0, 0, 0, 0)'
    page.emulate_media(reduced_motion='reduce')
    assert page.locator('.oh-heartbeat path').evaluate('(e)=>getComputedStyle(e).animationName')=='none'
    page.emulate_media(reduced_motion='no-preference')
    assert page.locator('.oh-heartbeat path').evaluate('(e)=>getComputedStyle(e).animationDuration')=='3.5s'
    page.evaluate("()=>document.body.classList.add('ib-reduce')")
    assert page.locator('.oh-heartbeat path').evaluate('(e)=>getComputedStyle(e).animationName')=='none'
    page.evaluate("()=>{document.body.classList.remove('ib-reduce');window.scrollTo(0,0)}")
    page.screenshot(path='/tmp/ib-home-v1-dark.png')
    page.evaluate("()=>document.body.classList.remove('theme-infernal')")
    page.screenshot(path='/tmp/ib-home-v1-light.png')
    assert not posts,posts
    assert not errors,errors
    print('PASS: no invented anniversary; explicit existing date; persisted user date; daily stable local phrase and day rollover; real profile/avatar/photos/notes/letters entries; original Desk/Space; 320–430px light/dark layout; reduced motion; no AI POST or page errors.')
    browser.close()
