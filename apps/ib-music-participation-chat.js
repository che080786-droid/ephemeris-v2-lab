/* Additive native Chat extension. Mock requests never invoke the app's real AI sender. */
import {createAiAdapter,mockProvider,MOCK_CASES} from './ib-together-ai-adapter.js';
import {executeMusicAction,currentTrack,pendingInvitation} from './ib-music-actions.js';
import {musicCard} from './ib-music-participation-cards.js';
let installed=false;
const mockEnabled=()=>new URLSearchParams(location.search).get('ib-ai-mock')==='1';
export function installMusicParticipationChat(){
  if(installed)return;installed=true;
  const adapter=createAiAdapter(mockProvider);let controller=null,panel=null,requestKey='';
  function context(){const cfg=typeof _activeCfg!=='undefined'?_activeCfg:null,thread=typeof _activeThread!=='undefined'?_activeThread:null;return {cfg,thread,friendId:cfg?.id||'',conversationKey:(cfg?.id||'')+'|'+(thread?.id||'')}}
  function same(owner){return context().conversationKey===owner.conversationKey&&document.getElementById('conv').classList.contains('open')}
  async function saveMessage(owner,message){
    await window.dbPut('chatMessages',message);
    if(same(owner)){
      const index=_msgs.findIndex(m=>m.id===message.id);if(index<0){_msgs.push(message);const host=document.getElementById('cv-msgs');host.querySelector('.empty')?.remove();host.appendChild(window.buildMsgEl(message,_msgs.at(-2)||null));host.scrollTop=host.scrollHeight}else{_msgs[index]=message;window.redrawMsg(message)}
    }
  }
  function message(owner,role,content){return {id:'msg_music_'+crypto.randomUUID(),role,content,friendId:owner.friendId,...(owner.thread?{threadId:owner.thread.id}:{}),timestamp:Date.now(),...(role==='assistant'?{senderName:'晏景'}:{})}}
  const nativeBuild=window.buildMsgEl;
  window.buildMsgEl=function(m,...args){
    const row=nativeBuild.call(this,m,...args);
    if(m.musicParticipation){const owner={conversationKey:m.friendId+'|'+(m.threadId||''),friendId:m.friendId};owner.active=()=>same(owner);const host=row.querySelector('.m-text')||row;
      for(const result of m.musicParticipation.results||[])if(['recommendation','invitation'].includes(result.kind))host.appendChild(musicCard(result,owner,async()=>{await window.dbPut('chatMessages',m);if(same(owner))window.redrawMsg(m)}));
    }
    return row;
  };
  window.addEventListener('ib-music-invitation-change',()=>{
    if(!document.getElementById('conv').classList.contains('open'))return;
    for(const m of _msgs)if(m.musicParticipation?.results?.some(r=>r.kind==='invitation'))window.redrawMsg(m);
  });
  async function sendInvitation(owner){
    const result=await executeMusicAction({type:'invite_listen_together',actor:'mingyue'},{...owner,active:()=>same(owner)});
    const m=message(owner,'user','要不要一起听歌？');m.musicParticipation={results:[result]};await saveMessage(owner,m);return result.id;
  }
  async function runMock(scenario){
    if(!mockEnabled())return;
    const owner=context();if(!owner.cfg||owner.cfg._group)return;
    controller?.abort();controller=new AbortController();const signal=controller.signal;requestKey=owner.conversationKey;
    let inviteId;
    try{if(['accept','decline','loading','error'].includes(scenario))inviteId=pendingInvitation(owner.conversationKey)?.id||await sendInvitation(owner)}catch(e){return}
    if(signal.aborted||!same(owner))return;
    const m=message(owner,'assistant','正在想…');m.musicParticipation={results:[],pending:true};await saveMessage(owner,m);
    try{
      const track=currentTrack();const response=await adapter.respond({songTitle:track?.title||track?.name||'',artist:track?.artist||'',trackRecordId:track?.id||'',inviteId},{scenario,signal});
      if(signal.aborted||!same(owner))throw new DOMException('Cancelled','AbortError');
      m.content=response.text;m.musicParticipation.actions=response.actions;m.musicParticipation.pending=false;
      for(const action of response.actions){
        try{const result=await executeMusicAction(action,{...owner,signal,active:()=>same(owner)});if(result.cooldown)m.content=result.text;else if(result.kind==='notice')m.content+='\n'+result.text;else m.musicParticipation.results.push(result)}
        catch(e){if(signal.aborted||!same(owner))throw e;m.content+='\n这次音乐操作暂时没有完成。'}
      }
    }catch(e){m.content=signal.aborted?'这一句暂时停在这里。':'这一句暂时没有回应，稍后再聊吧。';m.musicParticipation.pending=false}
    await saveMessage(owner,m);
  }
  function showMock(){
    panel?.remove();panel=document.createElement('section');panel.className='ib-music-mock-picker ib-music-card';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','音乐参与 Mock');
    const select=document.createElement('select');select.setAttribute('aria-label','音乐参与测试场景');
    for(const [value,label] of MOCK_CASES){const o=document.createElement('option');o.value=value;o.textContent=label;select.appendChild(o)}
    const run=document.createElement('button');run.textContent='发送';const close=document.createElement('button');close.textContent='关闭';
    run.addEventListener('click',()=>{const scenario=select.value;panel.remove();panel=null;runMock(scenario).catch(()=>window.toast?.('暂时无法保存这条消息'))});close.addEventListener('click',()=>{panel.remove();panel=null});panel.append(select,run,close);document.getElementById('conv').appendChild(panel);select.focus();
    panel.addEventListener('keydown',e=>{if(e.key==='Escape'){panel?.remove();panel=null}});
  }
  function sync(){
    const owner=context(),host=document.getElementById('cvd-ops');if(controller&&requestKey!==owner.conversationKey)controller.abort();if(!host)return;
    const enabled=owner.cfg&&!owner.cfg._group&&String(window.cfgName(owner.cfg)).includes('晏景');
    if(!enabled){host.querySelectorAll('[data-music-participation]').forEach(b=>b.remove());return}
    if(!host.querySelector('[data-music-participation=invite]')){
      const b=document.createElement('button');b.className='btn';b.dataset.musicParticipation='invite';b.textContent='邀请一起听';b.addEventListener('click',()=>{document.getElementById('cv-drawer').hidden=true;sendInvitation(context()).catch(()=>window.toast?.('邀请暂时没有发出'))});host.appendChild(b);
    }
    if(mockEnabled()&&!host.querySelector('[data-music-participation=mock]')){const b=document.createElement('button');b.className='btn';b.dataset.musicParticipation='mock';b.textContent='音乐参与 Mock';b.addEventListener('click',()=>{document.getElementById('cv-drawer').hidden=true;showMock()});host.appendChild(b)}
  }
  const observer=new MutationObserver(sync);for(const id of ['cvd-ops','cv-name']){const el=document.getElementById(id);if(el)observer.observe(el,{childList:true})}
  new MutationObserver(()=>{if(!document.getElementById('conv').classList.contains('open')){controller?.abort();panel?.remove();panel=null}}).observe(document.getElementById('conv'),{attributes:true,attributeFilter:['class']});
  sync();
}
