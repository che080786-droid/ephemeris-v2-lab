/* Shared Music search UI. Uses the old public data chain and native local playback. */
import {onlineMusicSearch} from './ib-together-music-data.js';
import {playPublicTrack} from './ib-together-track-playback.js';
export function mountPublicSearch(player){
  let panel=null,controller=null,disposed=false;
  function close(){controller?.abort();controller=null;panel?.remove();panel=null;if(!disposed)player.querySelector('#ma-addtop')?.focus()}
  function dispose(){disposed=true;close()}
  function open(){
    if(panel)return;
    panel=document.createElement('section');panel.className='tg-public-search';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','搜索歌曲');
    panel.innerHTML='<header><b>搜索歌曲</b><button type="button" class="ov2-btn" data-tg-close>关闭</button></header><form><input type="search" placeholder="歌名或歌手" aria-label="歌名或歌手" required maxlength="120"><button class="ov2-btn" type="submit">搜索</button></form><p role="status">搜一首歌，一起听。</p><div class="tg-public-results"></div>';
    player.appendChild(panel);
    const current=panel,input=panel.querySelector('input'),status=panel.querySelector('[role=status]'),results=panel.querySelector('.tg-public-results');
    const active=signal=>!disposed&&panel===current&&!signal.aborted&&player.classList.contains('open');
    panel.querySelector('[data-tg-close]').addEventListener('click',close);
    panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close()}if(event.key==='Tab'){const focusable=Array.from(current.querySelectorAll('button:not(:disabled),input,select'));const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}});
    panel.querySelector('form').addEventListener('submit',async event=>{
      event.preventDefault();controller?.abort();controller=new AbortController();const signal=controller.signal;
      results.replaceChildren();status.textContent='正在搜索…';
      try{
        const tracks=await onlineMusicSearch(input.value,'all',{signal});
        if(!active(signal))return;
        status.textContent=tracks.length?'找到 '+tracks.length+' 首歌曲，选一首开始听。':'没有找到歌曲，请换个关键词。';
        tracks.forEach(track=>{
          const button=document.createElement('button');button.type='button';button.className='ov2-card tg-public-result';
          const title=document.createElement('b'),meta=document.createElement('small');title.textContent=track.name;
          meta.textContent=track.artist||'';
          button.append(title,meta);results.appendChild(button);
          button.addEventListener('click',async()=>{
            controller?.abort();controller=new AbortController();const signal=controller.signal;
            results.querySelectorAll('button').forEach(b=>{b.disabled=true});status.textContent='正在获取歌词…';
            try{
              await playPublicTrack(track,{signal,active:()=>active(signal)});
              if(_pw.a?.paused){status.textContent='歌曲已添加，但播放未开始。请关闭搜索后用原生播放键重试。';return}
              close();
            }catch(error){if(active(signal))status.textContent='暂时无法播放，请重试'}
            finally{if(active(signal))results.querySelectorAll('button').forEach(b=>{b.disabled=false})}
          });
        });
      }catch(error){if(active(signal))status.textContent='搜索暂时不可用，请稍后重试。'}
    });
    input.focus();
  }
  dispose.open=open;return dispose;
}
