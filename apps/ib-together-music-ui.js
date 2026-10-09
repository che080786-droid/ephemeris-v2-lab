/* Shared Music presentation only: native audio, authentication and data providers stay intact. */
import {mountPublicSearch} from './ib-together-public-search.js';
import {currentPublicContext,restorePlaybackContext} from './ib-together-playback-context.js';
let installed=false;
export function installMusicUi(){
  if(installed)return;installed=true;
  const player=document.getElementById('music-app');if(!player)return;
  let search=null,more=null,menu=null,room=null,disposePreview=null,inertBefore=[];
  function closeMenu(){menu?.remove();menu=null}
  function closeRoom(){
    disposePreview?.();disposePreview=null;room?.remove();room=null;
    for(const [element,inert] of inertBefore)element.inert=inert;inertBefore=[];
    more?.focus();
  }
  function menuFor(kind){
    closeMenu();
    menu=document.createElement('div');menu.className='tg-music-menu';menu.setAttribute('role','dialog');menu.setAttribute('aria-label',kind==='add'?'添加音乐':'更多');
    const list=document.createElement('nav');menu.appendChild(list);player.appendChild(menu);
    function item(label,action){const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',()=>{closeMenu();action()});list.appendChild(button)}
    if(kind==='add'){
      item('搜索在线歌曲',()=>search.open());
      item('导入音乐 / 歌词',()=>window._pwPickFiles?.('audio'));
      item('音乐账户与歌单',()=>openSheet('sheet-masrc'));
    }else{
      item('一起听聊天室',openRoom);
      item('共听伙伴与设置',()=>player.querySelector('#ma-mate').click());
      item('迷你播放器',()=>player.querySelector('#ma-minipw').click());
      if(currentPublicContext())item('返回我的音乐',()=>restorePlaybackContext());
    }
    item('关闭',()=>more?.focus());
    menu.addEventListener('click',event=>{if(event.target===menu)closeMenu()});
    trap(menu,closeMenu);list.querySelector('button').focus();
  }
  function trap(dialog,close){dialog.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close();return}
    if(event.key!=='Tab')return;
    const nodes=[...dialog.querySelectorAll('button,select,input,summary,[tabindex="0"]')];const first=nodes[0],last=nodes[nodes.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  })}
  async function openRoom(){
    if(room)return;
    const dialog=document.createElement('section');room=dialog;dialog.className='tg-listen-chat';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','一起听聊天室');
    dialog.innerHTML='<header><button type="button" class="icon-btn" aria-label="返回播放器">←</button><h2>一起听聊天室</h2></header><div class="tg-chat-body"></div>';
    inertBefore=[...player.children].map(element=>[element,element.inert]);for(const [element] of inertBefore)element.inert=true;
    player.appendChild(dialog);dialog.querySelector('button').addEventListener('click',closeRoom);trap(dialog,closeRoom);dialog.querySelector('button').focus();
    const host=dialog.querySelector('.tg-chat-body');
    if(new URLSearchParams(location.search).get('ib-ai-mock')==='1'){
      try{const preview=await import('./ib-together-ai-preview.js');if(room===dialog)disposePreview=preview.mountAiPreview(player,host)}
      catch(e){if(room===dialog)host.textContent='预演暂时无法打开，请返回后重试。'}
    }else{host.textContent='这里留给一起听时的对话。当前尚未接入 AI。'}
  }
  function sync(){
    if(!player.classList.contains('open')){
      closeMenu();closeRoom();search?.();search=null;more?.remove();more=null;
      if(player.classList.contains('tg-music-ui'))player.classList.remove('tg-music-ui');
      return;
    }
    if(!search){
      player.classList.add('tg-music-ui');search=mountPublicSearch(player);
      more=document.createElement('button');more.type='button';more.className='icon-btn tg-music-more';more.textContent='⋯';more.setAttribute('aria-label','更多');more.addEventListener('click',()=>menuFor('more'));player.querySelector('.ma-head').appendChild(more);
    }
  }
  new MutationObserver(sync).observe(player,{attributes:true,attributeFilter:['class']});sync();
  // Capture before the native authenticated-source target listener, without changing it.
  window.addEventListener('click',event=>{
    if(!player.classList.contains('open')||!event.target.closest?.('#ma-addtop'))return;
    event.preventDefault();event.stopImmediatePropagation();sync();menuFor('add');
  },true);
}
