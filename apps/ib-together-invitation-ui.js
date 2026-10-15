/* Invitation presentation only. The existing action executor owns all invitation state. */
import {executeMusicAction,invitation} from './ib-music-actions.js';
import {createAiAdapter,mockProvider} from './ib-together-ai-adapter.js';
import {requestInvitationReply} from './ib-together-invitation-ai.js';
const mockEnabled=()=>new URLSearchParams(location.search).get('ib-ai-mock')==='1';
let installed=false,view=null;
const incoming=[];
function partner(id){return (typeof _cfgs!=='undefined'?_cfgs:[]).find(c=>c.id===id&&!c._group)}
function context(i){return {conversationKey:i.conversationKey,friendId:i.friendId}}
function show(title,copy,id=''){
  if(view){view.root.close();}
  const root=document.createElement('dialog');root.className='tg-invitation';root.setAttribute('aria-labelledby','tg-invitation-title');root.setAttribute('aria-describedby','tg-invitation-copy');
  const card=document.createElement('div');card.className='tg-invitation-card';
  const name=document.createElement('span');name.className='tg-invitation-name';name.textContent='晏景 · Listen Together';
  const heading=document.createElement('h2');heading.id='tg-invitation-title';heading.textContent=title;
  const description=document.createElement('p');description.id='tg-invitation-copy';description.textContent=copy;description.setAttribute('role','status');
  const controls=document.createElement('div');controls.className='tg-invitation-controls';card.append(name,heading,description,controls);root.appendChild(card);
  const current={root,heading,description,controls,id,controller:null};view=current;
  root.addEventListener('close',()=>{current.controller?.abort();root.remove();if(view===current){view=null;queueMicrotask(nextIncoming)}});
  root.addEventListener('cancel',event=>{if(current.busy)event.preventDefault()});
  document.body.appendChild(root);root.showModal();return current;
}
function button(current,label,handler){
  const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',handler);current.controls.appendChild(b);return b;
}
function closeButton(current){button(current,'关闭',()=>current.root.close())}
function nextIncoming(){
  if(view)return;
  while(incoming.length){const id=incoming.shift(),i=invitation(id);if(i?.status==='pending'){showIncoming(i);return}}
}
function showIncoming(i){
  if(view?.id===i.id)return;
  if(view){if(!incoming.includes(i.id))incoming.push(i.id);return}
  const current=show('晏景邀请你一起听歌','要不要留一点时间，一起听一首歌？',i.id);
  const cfg=partner(i.friendId),src=cfg&&(typeof _pfAvatar==='function'?_pfAvatar(cfg):cfg.avatar);
  if(src){const image=document.createElement('img');image.className='tg-invitation-avatar';image.src=src;image.alt='';image.addEventListener('error',()=>image.remove(),{once:true});current.heading.before(image)}
  async function respond(type){
    if(current.busy)return;current.busy=true;
    for(const b of current.controls.querySelectorAll('button'))b.disabled=true;
    current.description.textContent='正在处理…';
    try{
      await executeMusicAction({type,actor:'mingyue',inviteId:i.id},context(i));
      if(type==='accept_listen_together')current.root.close();
      else{current.heading.textContent='这次先不一起听';current.description.textContent='已经婉拒邀请。';current.controls.replaceChildren();closeButton(current)}
    }catch(e){current.heading.textContent='晏景邀请你一起听歌';current.description.textContent='暂时没有完成，请稍后重试。'}
    finally{current.busy=false;for(const b of current.controls.querySelectorAll('button'))b.disabled=false}
  }
  button(current,'一起听',()=>respond('accept_listen_together'));
  button(current,'暂时不要',()=>respond('decline_listen_together'));
}
function mockControls(current,i){
  const select=document.createElement('select');select.setAttribute('aria-label','模拟邀请回应');
  for(const [value,label] of [['accept','晏景接受邀请'],['decline','晏景拒绝邀请'],['loading','保持等待'],['error','模拟回应失败']]){
    const option=document.createElement('option');option.value=value;option.textContent=label;select.appendChild(option);
  }
  current.controls.appendChild(select);
  button(current,'模拟回应',async()=>{
    if(current.busy||invitation(i.id)?.status!=='pending')return;
    current.controller?.abort();current.controller=new AbortController();const {signal}=current.controller;
    current.description.textContent='正在等待晏景回应…';
    try{
      const response=await createAiAdapter(mockProvider).respond({inviteId:i.id},{scenario:select.value,signal});
      if(signal.aborted||view!==current)return;
      for(const action of response.actions)await executeMusicAction(action,{...context(i),signal,active:()=>view===current});
      if(invitation(i.id)?.status==='declined'){
        current.heading.textContent='晏景这次先不一起听';current.description.textContent=response.text;current.controls.replaceChildren();closeButton(current);
      }
    }catch(e){if(!signal.aborted&&view===current){current.heading.textContent='正在邀请晏景一起听…';current.description.textContent='暂时没有完成，可以稍后重试。'}}
    finally{
      if(view===current&&invitation(i.id)?.status==='pending'){
        current.busy=false;for(const b of current.controls.querySelectorAll('button,select'))b.disabled=false;
      }
    }
  });
}
async function realReply(current,i,cfg){
  if(current.requesting||invitation(i.id)?.status!=='pending')return;
  current.requesting=true;current.controller?.abort();current.controller=new AbortController();
  const {signal}=current.controller;
  const timeout=setTimeout(()=>current.controller.abort(),60000);
  current.replyText='';current.description.textContent='正在等待晏景回应…';
  const retry=current.controls.querySelector('[data-invitation-retry]');if(retry)retry.disabled=true;
  try{
    const response=await requestInvitationReply(cfg,{signal});
    if(signal.aborted||view!==current||!current.root.open||invitation(i.id)?.status!=='pending')return;
    current.replyText=response.text;current.description.textContent=response.text;
    await executeMusicAction({type:response.decision,actor:'yanjing',inviteId:i.id},{...context(i),signal,active:()=>view===current&&current.root.open});
  }catch(e){
    if(view===current&&current.root.open){
      current.heading.textContent='正在邀请晏景一起听…';current.description.textContent='暂时没有收到有效回应，请稍后重试。';
      current.busy=false;
      for(const b of current.controls.querySelectorAll('button'))b.disabled=false;
      if(!retry){const b=button(current,'重试',()=>realReply(current,i,cfg));b.dataset.invitationRetry='1'}
    }
  }finally{clearTimeout(timeout);current.requesting=false;if(retry)retry.disabled=false}
}
export async function inviteFromTogether(){
  installInvitationUi();await window.loadCfgs();
  const configs=(typeof _cfgs!=='undefined'?_cfgs:[]).filter(c=>!c._group&&String(window.cfgName(c)).includes('晏景'));
  const mate=typeof _mp!=='undefined'?_mp?.musicAi?.mate:'';
  const cfg=configs.find(c=>c.id===mate)||configs[0];
  if(!mockEnabled()&&(!cfg||!cfg.apiKey)){
    const current=show('需要先配置晏景后才能发送邀请','请先在 API 页面配置晏景。配置完成后，再回来邀请。');closeButton(current);return;
  }
  const owner={conversationKey:'together:'+(cfg?.id||'unpaired'),friendId:cfg?.id||''};
  const result=await executeMusicAction({type:'invite_listen_together',actor:'mingyue'},owner),i=invitation(result.id);
  const current=show('正在邀请晏景一起听…','正在等待晏景回应…',i.id);
  closeButton(current);if(mockEnabled())mockControls(current,i);else realReply(current,i,cfg);
}
export function installInvitationUi(){
  if(installed)return;installed=true;
  window.addEventListener('ib-music-action-result',({detail:{action,result}})=>{
    if(action.type==='invite_listen_together'&&action.actor==='yanjing'&&result.kind==='invitation'){
      const i=invitation(result.id);if(i?.status==='pending')showIncoming(i);
    }
  });
  window.addEventListener('ib-music-invitation-accepting',({detail})=>{
    const current=view;if(!current||current.id!==detail.invitation.id)return;
    current.busy=true;current.heading.textContent=detail.actor==='yanjing'?'晏景接受了邀请':'邀请已接受';current.description.textContent=current.replyText||'正在为你们打开一起听…';
    for(const b of current.controls.querySelectorAll('button,select'))b.disabled=true;
    detail.waitUntil(new Promise(resolve=>setTimeout(resolve,current.replyText?1200:650)));
  });
  window.addEventListener('ib-music-invitation-change',()=>{
    const current=view;if(!current?.id)return;const i=invitation(current.id);
    if(i?.status==='accepted'){current.root.close();window.IBApps?.close('together')}
    else if(i?.status==='declined'){
      current.heading.textContent=i.actor==='mingyue'?'晏景这次先不一起听':'这次先不一起听';
      current.description.textContent=current.replyText||'这次先不一起听';current.controls.replaceChildren();closeButton(current);
    }
  });
}
