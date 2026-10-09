/* One Listen room, two views. Session UI state only; no playback or auth writes. */
import {createAiAdapter,mockProvider,MOCK_CASES} from './ib-together-ai-adapter.js';
const sessions=new Map();
const mockEnabled=()=>new URLSearchParams(location.search).get('ib-ai-mock')==='1';
function roomKey(){return (typeof _mp!=='undefined'&&_mp?.musicAi?.mate)||'unpaired'}
function session(key){if(!sessions.has(key))sessions.set(key,{mode:'music',messages:[],draft:'',scenario:'short',scrollTop:0});return sessions.get(key)}
function currentTrack(){return typeof _pw!=='undefined'?_pw.list?.[_pw.idx]:null}
function context(player){const a=typeof _pw!=='undefined'?_pw.a:null,track=currentTrack();return {songTitle:track?.title||track?.name||'',artist:track?.artist||'',currentLyric:player.querySelector('.ma-ln.on')?.textContent||'',currentTime:a?.currentTime||0,connected:!!player.querySelector('#ma-duo .ma-duo2'),connectionKind:'native-companion-selected'}}
export function mountListenRoom(player){
  let key=roomKey(),state=session(key),controller=null,disposed=false,lyricSnapshot=null;
  const adapter=createAiAdapter(mockProvider),body=player.querySelector('.ma-body'),foot=player.querySelector('.ma-foot'),lyrics=player.querySelector('.ma-lyr');
  const title=player.querySelector('.ma-title'),oldTitle=title.textContent;title.textContent='Listen Together';
  const identity=document.createElement('button');identity.type='button';identity.className='tg-room-identity';identity.setAttribute('aria-label','共听伙伴与状态');
  const avatarPlaceholder='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>';
  identity.innerHTML='<span class="tg-room-pair" aria-hidden="true"><span class="ma-ava">'+avatarPlaceholder+'</span><i class="tg-pair-link">∞</i><span class="ma-ava">'+avatarPlaceholder+'</span></span><span class="tg-pair-copy"><strong>01 / LISTEN TOGETHER</strong><span class="tg-pair-subtitle"></span><small></small></span>';
  identity.addEventListener('click',()=>player.querySelector('#ma-mate').click());body.insertAdjacentElement('beforebegin',identity);
  const stage=document.createElement('div');stage.className='tg-room-stage';body.insertAdjacentElement('beforebegin',stage);stage.appendChild(body);
  const chat=document.createElement('section');chat.className='tg-room-chat';chat.setAttribute('aria-label','一起听对话');
  chat.innerHTML='<div class="tg-now-playing"><div class="tg-now-cover" aria-hidden="true"></div><div><b></b><small></small></div><span></span></div>'
    +'<div class="tg-message-list" role="log" aria-live="polite" aria-label="一起听消息" tabindex="0"></div>'
    +'<form class="tg-chat-composer"><textarea rows="1" maxlength="2000" aria-label="留下一段感受" placeholder="说说这首歌，或此刻的心情…"></textarea><button type="submit" aria-label="发送">发送</button></form>';
  stage.appendChild(chat);
  const list=chat.querySelector('.tg-message-list'),input=chat.querySelector('textarea'),form=chat.querySelector('form');
  const modes=document.createElement('div');modes.className='tg-room-modes';modes.setAttribute('role','group');modes.setAttribute('aria-label','一起听模式');
  modes.innerHTML='<button type="button" data-view="music">音乐</button><button type="button" data-view="chat">对话</button>';player.appendChild(modes);
  const nativeObserver=new MutationObserver(refreshContext);
  for(const selector of ['#ma-duo','#ma-t','#ma-s','#ma-bg']){const element=player.querySelector(selector);if(element)nativeObserver.observe(element,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['style','src']})}
  nativeObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
  function text(element,value){if(element.textContent!==value)element.textContent=value}
  function paintPair(){
    const nativeAvatars=player.querySelectorAll('#ma-duo .pair .ma-ava');
    const cfg=(typeof _cfgs!=='undefined'?_cfgs:[])?.find(c=>c.id===key);
    const profiles=[typeof _about!=='undefined'?_about:null,cfg];
    identity.querySelectorAll('.ma-ava').forEach((slot,index)=>{
      const profile=profiles[index];
      const src=nativeAvatars[index]?.querySelector('img')?.getAttribute('src')
        ||(profile?(typeof _pfAvatar==='function'?_pfAvatar(profile):profile.avatar)||'':'');
      if((slot.dataset.avatar||'')===src)return;
      slot.dataset.avatar=src;slot.replaceChildren();
      if(src){const image=document.createElement('img');image.alt='';image.src=src;image.addEventListener('error',()=>{if(slot.firstChild===image)slot.innerHTML=avatarPlaceholder},{once:true});slot.appendChild(image)}
      else slot.innerHTML=avatarPlaceholder;
    });
  }
  function names(){
    const cfg=(typeof _cfgs!=='undefined'?_cfgs:[])?.find(c=>c.id===key);
    return {me:'明月',mate:cfg?(typeof cfgName==='function'?cfgName(cfg):cfg.name)||'晏景':'晏景'};
  }
  function refreshContext(){
    if(disposed)return;
    const nextKey=roomKey();if(key!==nextKey){cancelPending();key=nextKey;state=session(key);input.value=state.draft;renderMessages();setMode(state.mode)}
    const paired=!!player.querySelector('#ma-duo .ma-duo2'),n=names();
    paintPair();identity.classList.toggle('is-paired',paired);
    identity.setAttribute('aria-label',n.me+' × '+n.mate+'，'+(paired?'共听伙伴与状态':'选择共听伙伴'));
    text(identity.querySelector('.tg-pair-subtitle'),paired?'WITH YOU · SAME SONG':'WAITING FOR YOU');
    const ms=typeof _mp!=='undefined'?Number(_mp?.musicAi?.mateTime?.[key])||0:0;
    text(identity.querySelector('small'),paired?'一起听 · '+(ms<60000?'不到 1 分钟':Math.floor(ms/60000)+' 分钟'):'等待共听');
    const track=currentTrack(),cover=chat.querySelector('.tg-now-cover'),art=track?.cover?String(track.cover):'';
    // Copy the native cover style; metadata URLs never become HTML.
    const bg=art?player.querySelector('#ma-bg')?.style.backgroundImage||'':'';
    if(cover.style.backgroundImage!==bg)cover.style.backgroundImage=bg;
    text(chat.querySelector('.tg-now-playing b'),track?.title||track?.name||'选一首歌');
    text(chat.querySelector('.tg-now-playing small'),track?.artist||'');
    const a=typeof _pw!=='undefined'?_pw.a:null;
    text(chat.querySelector('.tg-now-playing>span'),track&&a&&!a.paused?(paired?'正在一起听':'正在播放'):track?'已暂停':'');
  }
  function scrollBottom(){state.needsBottom=true;requestAnimationFrame(()=>{if(!disposed&&state.mode==='chat'){list.scrollTop=list.scrollHeight;state.scrollTop=list.scrollTop;state.needsBottom=false}})}
  function renderMessages(bottom=false){
    list.replaceChildren();
    if(!state.messages.length){const empty=document.createElement('div');empty.className='tg-chat-empty';empty.innerHTML='<b>这一首歌还很安静</b><p>可以在此刻留下一段感受，或和晏景聊聊这首歌。</p>';list.appendChild(empty)}
    const n=names();
    for(const message of state.messages){
      const row=document.createElement('div');row.className='tg-message '+(message.author==='me'?'from-me':'from-mate');
      const label=document.createElement('small');label.textContent=message.author==='me'?n.me:n.mate;
      const bubble=document.createElement('div');bubble.className='tg-message-bubble';bubble.textContent=message.pending?'正在想…':message.text;
      if(message.pending){bubble.classList.add('is-pending');bubble.setAttribute('aria-busy','true')}
      if(message.error)bubble.classList.add('is-error');row.append(label,bubble);list.appendChild(row);
    }
    if(bottom)scrollBottom();else list.scrollTop=state.scrollTop;
  }
  function cancelPending(){
    controller?.abort();controller=null;
    for(const message of state.messages)if(message.pending){message.pending=false;message.error=true;message.text='这条回应暂时没有到达。'}
  }
  async function requestReply(scenario=state.scenario){
    if(!mockEnabled()||disposed)return;
    cancelPending();controller=new AbortController();const signal=controller.signal,owner=state;
    const message={author:'mate',text:'',pending:true};owner.messages.push(message);renderMessages(true);
    try{
      const response=await adapter.respond(context(player),{scenario,signal});
      if(disposed||signal.aborted||owner!==state)return;
      message.text=response.text;message.pending=false;
    }catch(e){
      if(disposed||signal.aborted||owner!==state)return;
      message.text='这一句暂时没有回应，稍后再聊吧。';message.pending=false;message.error=true;
    }
    if(!disposed&&!signal.aborted&&owner===state)renderMessages(true);
  }
  function setMode(mode){
    const next=mode==='chat'?'chat':'music',previous=state.mode;
    if(next==='chat'&&player.dataset.tgView!=='chat')lyricSnapshot={top:lyrics.scrollTop,line:lyrics.querySelector('.on')};
    if(previous==='chat'&&next==='music')state.scrollTop=list.scrollTop;
    state.mode=next;player.dataset.tgView=next;
    // Keep both views and all native lyric nodes mounted. Only visibility changes.
    body.inert=next==='chat';body.setAttribute('aria-hidden',String(next==='chat'));
    foot.inert=next==='chat';foot.setAttribute('aria-hidden',String(next==='chat'));
    chat.inert=next==='music';chat.setAttribute('aria-hidden',String(next==='music'));
    for(const button of modes.children)button.setAttribute('aria-pressed',String(button.dataset.view===next));
    if(next==='chat'){list.scrollTop=state.scrollTop;if(state.needsBottom)scrollBottom();input.style.height='auto';input.style.height=Math.min(input.scrollHeight,96)+'px';refreshContext()}
    else if(lyricSnapshot){const saved=lyricSnapshot;requestAnimationFrame(()=>{if(disposed||state.mode!=='music')return;const line=lyrics.querySelector('.on');lyrics.scrollTop=line===saved.line?saved.top:(line?line.offsetTop-lyrics.clientHeight/2+line.offsetHeight/2:saved.top)})}
  }
  modes.addEventListener('click',event=>{const mode=event.target.closest('[data-view]')?.dataset.view;if(mode){input.blur();setMode(mode)}});
  list.addEventListener('scroll',()=>{if(state.mode==='chat')state.scrollTop=list.scrollTop});
  input.addEventListener('input',()=>{state.draft=input.value;input.style.height='auto';input.style.height=Math.min(input.scrollHeight,96)+'px'});
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229){event.preventDefault();form.requestSubmit()}});
  form.addEventListener('submit',event=>{
    event.preventDefault();const value=input.value.trim();if(!value)return;
    state.messages.push({author:'me',text:value});state.draft='';input.value='';input.style.height='';renderMessages(true);requestReply();
  });
  // iOS visual viewport: resize only the room UI when the software keyboard opens.
  const viewport=window.visualViewport;
  function keyboard(){const focused=player.contains(document.activeElement)&&document.activeElement===input;const inset=focused&&viewport&&viewport.scale===1?Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop):0;player.style.setProperty('--tg-keyboard',inset+'px');if(focused)scrollBottom()}
  viewport?.addEventListener('resize',keyboard);viewport?.addEventListener('scroll',keyboard);input.addEventListener('focus',keyboard);input.addEventListener('blur',keyboard);
  input.value=state.draft;renderMessages();refreshContext();setMode(state.mode);
  return {
    setMode,
    mockCases:mockEnabled()?MOCK_CASES:[],
    preview(scenario){state.scenario=scenario;setMode('chat');requestReply(scenario)},
    dispose(){
      if(disposed)return;state.draft=input.value;cancelPending();disposed=true;
      nativeObserver.disconnect();viewport?.removeEventListener('resize',keyboard);viewport?.removeEventListener('scroll',keyboard);
      body.inert=false;foot.inert=false;body.removeAttribute('aria-hidden');foot.removeAttribute('aria-hidden');
      stage.insertAdjacentElement('beforebegin',body);stage.remove();identity.remove();modes.remove();title.textContent=oldTitle;
      delete player.dataset.tgView;player.style.removeProperty('--tg-keyboard');
    }
  };
}
