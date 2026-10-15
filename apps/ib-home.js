/* Our home is a local view of the original Home / Desk section. No AI requests. */
(function(){
  const host=document.getElementById('sec-profile-cal');
  if(!host)return;
  const KEY='homeTogetherV1';
  const phrases=['今天也别把自己弄太累','忙完再来找我','晚一点没关系','先吃饭','记得喝水','我在','慢慢来','别熬太晚'];
  const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  function day(value){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return null;
    const [y,m,d]=value.split('-').map(Number),date=new Date(0);
    date.setUTCFullYear(y,m-1,d);date.setUTCHours(0,0,0,0);
    return date.toISOString().slice(0,10)===value?date.getTime()/86400000:null;
  }
  function phrase(date){let seed=0;for(const c of date)seed=(seed*31+c.charCodeAt(0))>>>0;return phrases[seed%phrases.length]}
  let since='',about={},mate=null,ready=false,request=0;
  const tabs=document.createElement('div');tabs.className='our-home-switch';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Home 视图');
  tabs.innerHTML='<button type="button" data-view="home" aria-pressed="true">我们的家</button><button type="button" data-view="desk" aria-pressed="false">Desk</button>';
  const home=document.createElement('div');home.id='our-home';home.className='our-home';home.setAttribute('aria-label','月序 · 我们的家');
  home.innerHTML=`<header class="oh-clock">
    <div class="oh-label" id="oh-date"></div><time id="oh-time" aria-label="当前时间"></time>
    <div class="oh-phase" id="oh-phase"></div><p class="oh-greeting" id="oh-greeting"></p>
  </header>
  <section class="oh-days" aria-labelledby="oh-days-title">
    <h2 class="oh-label" id="oh-days-title">OUR DAYS</h2>
    <div class="oh-pair"><div class="oh-person"><div class="oh-avatar" id="oh-me-avatar" role="img" aria-label="明月头像"></div><small id="oh-me-name">明月</small></div>
    <svg class="oh-heartbeat" viewBox="0 0 240 30" preserveAspectRatio="none" aria-hidden="true"><path d="M1 15H100L108 15 112 11 117 20 122 8 127 17 132 15H239"/></svg>
    <div class="oh-person"><div class="oh-avatar" id="oh-mate-avatar" role="img" aria-label="晏景头像"></div><small>晏景</small></div></div>
    <div class="oh-count" id="oh-count">待设置</div>
    <p class="oh-label">MINGYUE WITH YANJING</p><p class="oh-since" id="oh-since">从哪一天开始，由你决定</p>
    <button type="button" class="oh-edit" id="oh-date-edit" aria-expanded="false" aria-controls="oh-date-form">设置起始日期</button>
    <form class="oh-date-form" id="oh-date-form" hidden><label for="oh-start-date">我们的起始日期</label>
      <input type="date" id="oh-start-date" required><button class="oh-save" type="submit">保存</button>
      <button class="oh-edit" type="button" id="oh-date-cancel">取消</button><p class="oh-error" id="oh-date-error" role="status"></p>
    </form>
  </section>
  <section class="oh-today" aria-labelledby="oh-today-title"><h2 class="oh-label" id="oh-today-title">FROM YANJING · TODAY</h2>
    <p class="oh-phrase" id="oh-phrase"></p><p class="oh-source">本地短句 · 非 AI 生成</p></section>
  <div class="oh-now"><span>晏景 · 此刻</span><span>在这里</span></div>
  <div class="oh-doors"><button type="button" class="oh-door" id="oh-note"><b>Note</b><span>打开便笺</span></button>
    <button type="button" class="oh-door" id="oh-letters"><b>Letters</b><span>打开信箱</span></button></div>
  <section aria-labelledby="oh-album-title"><div class="oh-album-head"><h2 id="oh-album-title">Album</h2><button class="oh-edit" type="button" id="oh-space">Space 照片</button></div>
    <div class="oh-photos" id="oh-photos"></div><p class="oh-empty" id="oh-photo-empty">这里还没有照片</p><p class="oh-source" id="oh-photo-source" hidden>来自 Space 的本地照片</p></section>`;
  host.prepend(tabs,home);host.dataset.homeView='home';
  const $=id=>document.getElementById(id);
  const form=$('oh-date-form'),input=$('oh-start-date'),error=$('oh-date-error'),edit=$('oh-date-edit');
  function view(value){
    host.dataset.homeView=value;
    tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===value)));
    if(value==='desk')requestAnimationFrame(()=>{window.dispatchEvent(new Event('resize'))});
  }
  tabs.addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)view(b.dataset.view)});
  function tick(){
    const now=new Date(),date=iso(now),hour=now.getHours(),night=hour<6||hour>=18;
    home.dataset.phase=night?'night':'day';
    $('oh-date').textContent=now.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase();
    $('oh-time').textContent=now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false});
    $('oh-time').dateTime=now.toISOString();
    $('oh-phase').textContent=night?'NIGHT  ☾':'DAY  ☼';
    $('oh-greeting').textContent=hour<6?'还没睡啊':hour<11?'早上好':hour<18?'今天怎么样':'回来啦';
    $('oh-phrase').textContent=phrase(date);input.max=date;
    const start=day(since),today=day(date),valid=start!==null&&start<=today;
    $('oh-count').textContent=valid?String(today-start):'待设置';
    $('oh-count').classList.toggle('is-empty',!valid);
    $('oh-since').textContent=valid?'Since '+since.replaceAll('-','.'):'从哪一天开始，由你决定';
    edit.textContent=valid?'调整起始日期':'设置起始日期';
  }
  function avatars(){
    const name=about.name||'明月';$('oh-me-name').textContent=name;
    $('oh-me-avatar').setAttribute('aria-label',name+'头像');
    setAvaEl($('oh-me-avatar'),_pfAvatar(about),name);
    setAvaEl($('oh-mate-avatar'),mate?_pfAvatar(mate):'','晏景');
    const photos=_pfGallery(about).filter(src=>typeof src==='string'&&/^(data:image\/|blob:)/i.test(src)).slice(0,3);
    const box=$('oh-photos');box.replaceChildren();
    photos.forEach((src,i)=>{const frame=document.createElement('div');frame.className='oh-photo';const image=document.createElement('img');image.src=src;image.alt='Space 本地照片 '+(i+1);image.loading='lazy';frame.append(image);box.append(frame)});
    $('oh-photo-empty').hidden=!!photos.length;$('oh-photo-source').hidden=!photos.length;
  }
  async function refresh(){
    if(!window._ibBootDone)return;
    const seq=++request;
    try{
      const [profile,cfgs,settings,calendar,notes]=await Promise.all([dbGet('about','main'),dbGetAll('apiConfigs'),dbGet('apiSettings',KEY),dbGet('apiSettings','calendarSettings'),dbGetAll('calNotes')]);
      if(seq!==request)return;
      about=profile||{};
      const matches=cfgs.filter(c=>!c.archived&&!c._group&&/晏景|yanjing/i.test(String(c.nickname||'')+' '+String(c.name||'')+' '+String(c.id||'')));
      // Ambiguous identities never supply an arbitrary avatar or anniversary.
      mate=matches.length===1?matches[0]:null;
      since=settings?.since||(mate?calendar?.meetSet?.[mate.id]:'')||'';
      ready=true;edit.disabled=false;avatars();tick();
      $('oh-note').querySelector('span').textContent=notes.length?'查看 '+notes.length+' 张便笺':'还没有便笺 · 打开';
    }catch(e){ready=false;edit.disabled=true;$('oh-count').textContent='暂时无法读取';$('oh-since').textContent='本地资料读取失败，请稍后重试'}
  }
  function closeDate(){form.hidden=true;edit.setAttribute('aria-expanded','false');edit.focus()}
  edit.addEventListener('click',()=>{if(!ready)return;form.hidden=false;edit.setAttribute('aria-expanded','true');input.value=day(since)!==null?since:'';error.textContent='';input.focus()});
  $('oh-date-cancel').addEventListener('click',closeDate);
  form.addEventListener('submit',async e=>{
    e.preventDefault();const value=input.value,start=day(value);
    if(start===null||start>day(iso(new Date()))){error.textContent='请选择今天或以前的真实日期';return}
    const save=form.querySelector('[type="submit"]');save.disabled=true;
    try{const previous=await dbGet('apiSettings',KEY);await dbPut('apiSettings',{...previous,id:KEY,since:value});since=value;tick();closeDate()}
    catch(e){error.textContent='没有保存成功，请重试'}finally{save.disabled=false}
  });
  $('oh-note').addEventListener('click',async()=>{try{await loadCal();drawCalNotes();openSheet('sheet-notes-all')}catch(e){toast('便笺暂时无法读取')}});
  $('oh-letters').addEventListener('click',()=>navTo('letters'));
  $('oh-space').addEventListener('click',()=>{_sec.profile='card';navTo('profile')});
  const original=SEC_RENDER['profile:cal'];
  SEC_RENDER['profile:cal']=async function(){if(original)await original.apply(this,arguments);await refresh()};
  new MutationObserver(()=>{if(ready)avatars()}).observe(document.body,{attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){tick();refresh()}});
  // Minute cadence; local calendar arithmetic avoids DST changing day counts.
  setInterval(()=>{if(!document.hidden&&host.classList.contains('on'))tick()},60000);
  tick();
  if(window._ibBootDone)refresh();
})();
