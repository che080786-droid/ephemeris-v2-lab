import {installMusicParticipationChat} from './ib-music-participation-chat.js';
/* Shared Music presentation only: native audio, authentication and data providers stay intact. */
import {mountPublicSearch} from './ib-together-public-search.js';
import {currentPublicContext,restorePlaybackContext} from './ib-together-playback-context.js';
import {mountMusicCollection} from './ib-music-collection-ui.js';
import {mountListenRoom} from './ib-together-listen-room.js';
let installed=false;
export function installMusicUi(){
  if(installed)return;installed=true;installMusicParticipationChat();
  const player=document.getElementById('music-app');if(!player)return;
  let search=null,more=null,menu=null,room=null,collection=null;
  function closeMenu(){menu?.remove();menu=null}
  function menuFor(kind){
    closeMenu();
    menu=document.createElement('div');menu.className='tg-music-menu';menu.setAttribute('role','dialog');menu.setAttribute('aria-label',kind==='add'?'添加音乐':'更多');
    const list=document.createElement('nav');menu.appendChild(list);player.appendChild(menu);
    function item(label,action){const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',()=>{closeMenu();action()});list.appendChild(button)}
    if(kind==='mock'){
      for(const [scenario,label] of room?.mockCases||[])item(label,()=>room?.preview(scenario));
    }else if(kind==='add'){
      item('搜索在线歌曲',()=>search.open());
      item('导入音乐 / 歌词',()=>window._pwPickFiles?.('audio'));
      item('音乐账户与歌单',()=>openSheet('sheet-masrc'));
    }else{
      item('加入歌单',()=>collection?.playlistPicker());
      if(room)item('房间背景',()=>collection?.backgroundPicker());
      if(!room)item('一起听空间',()=>{player.classList.add('tg-listen');sync()});
      if(room?.mockCases.length)item('Mock 测试',()=>menuFor('mock'));
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
  function sync(){
    if(!player.classList.contains('open')){
      closeMenu();collection?.dispose();collection=null;room?.dispose();room=null;search?.();search=null;more?.remove();more=null;
      if(player.classList.contains('tg-music-ui'))player.classList.remove('tg-music-ui');
      if(player.classList.contains('tg-listen'))player.classList.remove('tg-listen');
      return;
    }
    if(player.classList.contains('tg-listen')&&!room)room=mountListenRoom(player);
    if(!player.classList.contains('tg-listen')&&room){room.dispose();room=null}
    if(!search){
      player.classList.add('tg-music-ui');search=mountPublicSearch(player);collection=mountMusicCollection(player);
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
