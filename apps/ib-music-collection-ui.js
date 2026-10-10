import {readLibrary,trackKey,toggleLike,addToPlaylist,readBackground,saveBackground,BACKGROUNDS} from './ib-music-library.js';
const currentTrack=()=>typeof _pw!=='undefined'?_pw.list?.[_pw.idx]:null;
const notify=message=>window.toast?.(message);
export function mountMusicCollection(player){
  let dialog=null,disposed=false;
  const heart=document.createElement('button');heart.type='button';heart.className='icon-btn tg-song-heart';
  heart.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.2C10.6 19 3.4 13.9 3.4 9.1c0-2.5 1.9-4.4 4.3-4.4 1.8 0 3.3 1 4.3 2.6 1-1.6 2.5-2.6 4.3-2.6 2.4 0 4.3 1.9 4.3 4.4 0 4.8-7.2 9.9-8.6 11.1z"/></svg>';
  player.querySelector('.ma-head').appendChild(heart);
  const background=document.createElement('i');background.className='tg-room-background';background.setAttribute('aria-hidden','true');player.querySelector('.ma-scrim').before(background);
  function refresh(){
    if(disposed)return;
    const track=currentTrack(),key=trackKey(track);let liked=false;
    try{liked=readLibrary().liked.includes(key)}catch(e){/* Leave damaged storage intact; writes report a failure. */}
    heart.disabled=!key;heart.setAttribute('aria-pressed',String(liked));heart.setAttribute('aria-label',liked?'取消喜欢当前歌曲':'喜欢当前歌曲');heart.title=liked?'取消喜欢':'喜欢';
    let value='default';try{value=readBackground()}catch(e){}
    if(player.dataset.tgBackground!==value)player.dataset.tgBackground=value;
    const cover=value==='cover'?player.querySelector('#ma-bg').style.backgroundImage:'';
    if(background.style.backgroundImage!==cover)background.style.backgroundImage=cover;
  }
  heart.addEventListener('click',()=>{try{const track=currentTrack();if(!trackKey(track))return;notify(toggleLike(track)?'已喜欢':'已取消喜欢')}catch(e){notify('未能保存喜欢状态，请检查浏览器存储空间')}});
  function close(){dialog?.remove();dialog=null;if(!disposed)player.querySelector('.tg-music-more')?.focus()}
  function open(label){
    close();dialog=document.createElement('section');dialog.className='tg-collection-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',label);
    const card=document.createElement('div');card.className='tg-collection-card';const heading=document.createElement('h2');heading.textContent=label;card.appendChild(heading);dialog.appendChild(card);player.appendChild(dialog);
    dialog.addEventListener('click',e=>{if(e.target===dialog)close()});
    dialog.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();close()}
      if(e.key==='Tab'){const nodes=[...dialog.querySelectorAll('button:not(:disabled),input')],first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}
    });return card;
  }
  function button(card,label,action){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',action);card.appendChild(b);return b}
  function playlistPicker(){
    const track=currentTrack();if(!trackKey(track)){notify('先选一首歌');return}
    let data;try{data=readLibrary()}catch(e){notify('暂时无法读取本地歌单');return}
    const card=open('加入歌单'),caption=document.createElement('p');caption.textContent=track.title||track.name||'当前歌曲';card.appendChild(caption);
    const status=document.createElement('p');status.setAttribute('role','status');
    function add(options){try{const result=addToPlaylist(track,options);notify(result.duplicate?'这首歌已在「'+result.name+'」中':'已加入「'+result.name+'」');close()}catch(e){status.textContent='未能保存歌单，请检查浏览器存储空间'}}
    const rows=document.createElement('div');rows.className='tg-playlist-options';card.appendChild(rows);
    for(const p of data.playlists)button(rows,p.name+' · '+p.trackKeys.length+' 首',()=>add({id:p.id}));
    if(!data.playlists.length){const empty=document.createElement('p');empty.textContent='还没有歌单，建一个留住喜欢的歌。';rows.appendChild(empty)}
    const form=document.createElement('form'),input=document.createElement('input');input.placeholder='新歌单名称';input.setAttribute('aria-label','新歌单名称');input.maxLength=60;input.required=true;
    const create=document.createElement('button');create.type='submit';create.textContent='新建并加入';form.append(input,create);card.append(form,status);
    form.addEventListener('submit',e=>{e.preventDefault();if(!input.value.trim()){status.textContent='请填写歌单名称';input.focus();return}add({name:input.value})});
    button(card,'取消',close);(rows.querySelector('button')||input).focus();
  }
  function backgroundPicker(){
    const card=open('房间背景');let selected='default';try{selected=readBackground()}catch(e){}
    const status=document.createElement('p');status.setAttribute('role','status');
    for(const [value,label] of BACKGROUNDS){const b=button(card,label,()=>{try{saveBackground(value);refresh();close()}catch(e){status.textContent='未能保存背景，请检查浏览器存储空间'}});b.setAttribute('aria-pressed',String(value===selected))}
    card.appendChild(status);button(card,'取消',close);card.querySelector('button').focus();
  }
  const observer=new MutationObserver(refresh);
  for(const selector of ['#ma-t','#ma-s','#ma-bg']){const node=player.querySelector(selector);if(node)observer.observe(node,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['style']})}
  window.addEventListener('ib-music-library-change',refresh);window.addEventListener('ib-listen-background-change',refresh);window.addEventListener('storage',refresh);refresh();
  return {playlistPicker,backgroundPicker,dispose(){disposed=true;close();observer.disconnect();window.removeEventListener('ib-music-library-change',refresh);window.removeEventListener('ib-listen-background-change',refresh);window.removeEventListener('storage',refresh);heart.remove();background.remove();delete player.dataset.tgBackground}};
}
