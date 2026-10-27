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
    expect(page.locator('#oh-count')).to_have_class('oh-count is-empty')
    assert page.locator('#oh-count').evaluate('(e)=>getComputedStyle(e).fontSize')=='16px'
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
    expect(page.locator('#oh-count')).to_have_class('oh-count')
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

    # Touch ownership: Safari edge, vertical/diagonal intent, thresholds and cancellation.
    def swipe(x,y,dx,dy,cancel=False,multi=False,target='#our-home'):
        return page.evaluate("""({x,y,dx,dy,cancel,multi,target})=>{
            const el=document.querySelector(target), make=(x,y,id=1)=>new Touch({identifier:id,target:el,clientX:x,clientY:y});
            const start=make(x,y),end=make(x+dx,y+dy);
            el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[start]}));
            const move=new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:multi?[end,make(x,y,2)]:[end]});
            el.dispatchEvent(move);
            el.dispatchEvent(new TouchEvent(cancel?'touchcancel':'touchend',{bubbles:true,touches:[],changedTouches:[end]}));
            return {prevented:move.defaultPrevented,view:document.querySelector('#sec-profile-cal').dataset.homeView};
        }""",dict(x=x,y=y,dx=dx,dy=dy,cancel=cancel,multi=multi,target=target))

    page.evaluate('()=>window.scrollTo(0,150)')
    home_scroll=page.evaluate('scrollY')
    page.locator('#oh-date-edit').click()
    page.locator('#oh-start-date').fill('2026-09-10')
    home_scroll=page.evaluate('scrollY')
    page.evaluate("()=>window.__homeNode=document.querySelector('#our-home')")
    for x in [0,12,23]:
        assert swipe(x,250,110,0)=={'prevented':False,'view':'home'}
    for dx,dy in [(-90,100),(-90,65),(-59,0)]:
        assert swipe(200,250,dx,dy)['view']=='home'
    assert not swipe(200,250,-20,100)['prevented']
    assert swipe(200,250,-100,0,cancel=True)['view']=='home'
    assert not swipe(200,250,-100,0,multi=True)['prevented']
    assert not swipe(200,250,-100,0,target='#oh-start-date')['prevented']
    assert swipe(200,250,-100,0)=={'prevented':True,'view':'desk'}
    assert page.evaluate("()=>document.querySelector('#sb-desk')!==null")
    assert page.evaluate("()=>document.querySelector('#sec-profile-cal').getAnimations({subtree:true}).some(a=>a.effect.getTiming().duration===260)")
    page.wait_for_timeout(300)
    page.evaluate("()=>window.__deskNode=document.querySelector('#sb-desk')")
    assert swipe(0,250,120,0,target='#sec-profile-cal')=={'prevented':False,'view':'desk'}
    assert swipe(80,250,100,0,target='#sec-profile-cal')['view']=='home'
    page.wait_for_timeout(350)
    assert abs(page.evaluate('scrollY')-home_scroll)<=1
    assert page.evaluate("()=>window.__homeNode===document.querySelector('#our-home')")
    expect(page.locator('#oh-start-date')).to_have_value('2026-09-10')
    expect(page.locator('#oh-date-form')).to_be_visible()
    # Repeat while reduced motion is enabled: no transition animations.
    page.emulate_media(reduced_motion='reduce')
    assert swipe(200,250,-100,0)['view']=='desk'
    assert page.evaluate("()=>window.__deskNode===document.querySelector('#sb-desk')")
    assert not page.evaluate("()=>document.querySelector('#sec-profile-cal').getAnimations({subtree:true}).length")
    page.wait_for_timeout(350)
    pager=page.locator('#dk-osw')
    if pager.count() and pager.locator(':scope > .desk-pg').count()>1:
        page.evaluate("()=>{const p=document.querySelector('#dk-osw');p._pg=1;p.scrollLeft=p.clientWidth}")
        assert swipe(80,250,100,0,target='#dk-osw')['view']=='desk'
        page.locator('.our-home-switch [data-view=home]').click()
        page.locator('.our-home-switch [data-view=desk]').click()
        assert page.evaluate("()=>document.querySelector('#dk-osw')._pg")==1
        assert abs(page.evaluate("()=>{const p=document.querySelector('#dk-osw');return p.scrollLeft-p.clientWidth}"))<=1
    page.locator('.our-home-switch [data-view=home]').click()
    page.emulate_media(reduced_motion='no-preference')
    page.locator('#oh-date-cancel').click()
    page.evaluate('()=>window.scrollTo(0,0)')

    for width in [320,375,390,430]:
        page.set_viewport_size({'width':width,'height':844})
        for dark in [False,True]:
            page.evaluate('(dark)=>document.body.classList.toggle("theme-infernal",dark)',dark)
            assert page.evaluate('()=>document.documentElement.scrollWidth<=innerWidth'),(width,dark)
            assert page.locator('#oh-time').evaluate('(e)=>e.scrollWidth<=e.clientWidth'),width
            sizes=page.locator('.oh-avatar').evaluate_all('(xs)=>xs.map(e=>e.getBoundingClientRect().width)')
            assert sizes==[38,38],sizes
            assert page.locator('#oh-count').evaluate('(e)=>getComputedStyle(e).color')!='rgba(0, 0, 0, 0)'
    # First-screen magazine hierarchy, including a shorter Safari-like viewport.
    # Insets are simulated; this is not a claim of physical iPhone validation.
    for width,height,top,bottom in [(320,568,0,0),(375,667,0,0),(390,664,20,34),(390,744,0,0),(430,932,59,34)]:
        page.set_viewport_size({'width':width,'height':height})
        for dark in [False,True]:
            page.evaluate('''({top,bottom,dark})=>{
                document.documentElement.style.setProperty('--sat',top+'px');
                document.documentElement.style.setProperty('--sab',bottom+'px');
                document.body.classList.toggle('theme-infernal',dark);window.scrollTo(0,0);
            }''',{'top':top,'bottom':bottom,'dark':dark})
            bounds=page.evaluate('''()=>Object.fromEntries(['.our-home-switch','.oh-clock','.oh-days','.oh-heartbeat','#oh-time','#oh-today-title','.oh-phrase','#dock'].map(s=>{
                const e=document.querySelector(s),r=e.getBoundingClientRect();return [s,{top:r.top,bottom:r.bottom,height:r.height,width:r.width,left:r.left,font:parseFloat(getComputedStyle(e).fontSize)}];
            }))''')
            dock=bounds['#dock']['top']
            assert bounds['.oh-days']['bottom']<=dock,(width,height,bounds)
            assert bounds['#oh-today-title']['bottom']<=dock,(width,height,bounds)
            assert bounds['.oh-phrase']['top']+12<=dock,(width,height,bounds)
            assert 150<=bounds['.oh-days']['height']<=190,(width,height,bounds)
            assert 10<=bounds['.oh-days']['left']<=14,(width,height,bounds)
            assert bounds['.oh-heartbeat']['width']>=bounds['.oh-days']['width']*.5
            assert 56<=bounds['#oh-time']['font']<=68
            assert bounds['.oh-clock']['height']<=180
            assert bounds['.our-home-switch']['height']<=40
            assert page.evaluate('()=>document.documentElement.scrollWidth<=innerWidth')
            page.evaluate('()=>window.scrollTo(0,document.documentElement.scrollHeight)')
            assert page.locator('#oh-photos').evaluate('(e)=>e.getBoundingClientRect().bottom')<=page.locator('#dock').evaluate('(e)=>e.getBoundingClientRect().top')-8
            if width==390 and height==744:
                page.evaluate('()=>window.scrollTo(0,0)')
                page.screenshot(path='/tmp/ib-home-density-'+('dark' if dark else 'light')+'.png')
            print('layout',width,height,'dark' if dark else 'light','card',round(bounds['.oh-days']['height'],1),'Today bottom',round(bounds['#oh-today-title']['bottom'],1),'dock',round(dock,1))
    page.evaluate("()=>{document.documentElement.style.removeProperty('--sat');document.documentElement.style.removeProperty('--sab')}")
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
