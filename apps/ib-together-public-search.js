/* Listen Together search UI. Uses the old public data chain and the existing local Music path. */
import {onlineMusicSearch,verifyTrack,tryLoadLyrics,syncLyrics} from './ib-together-music-data.js';
import {beginPublicPlayback,currentPublicContext,restorePlaybackContext} from './ib-together-playback-context.js';
export function mountPublicSearch(player){
  const launch=document.createElement('button');launch.type='button';launch.className='ov2-btn tg-public-launch';launch.textContent='搜索歌曲';
  // Anchor to the visible header's actual parent, not the body section's nesting.
  const header=player.querySelector('.ma-head');
  if(header)header.insertAdjacentElement('afterend',launch);
  else player.prepend(launch);
  const returnButton=document.createElement('button');returnButton.type='button';returnButton.className='ov2-btn tg-public-return';
  launch.insertAdjacentElement('afterend',returnButton);
  function updateContext(){const mode=currentPublicContext();returnButton.hidden=!mode;returnButton.textContent=mode==='qqm'?'返回 QQ 音乐':'返回网易云音乐'}
  returnButton.addEventListener('click',()=>restorePlaybackContext());
  window.addEventListener('ib-together-public-context',updateContext);updateContext();
  let panel=null,controller=null,disposed=false;
  function close(){controller?.abort();controller=null;panel?.remove();panel=null;if(!disposed)launch.focus()}
  function dispose(){disposed=true;close();launch.remove();returnButton.remove();window.removeEventListener('ib-together-public-context',updateContext)}
  launch.addEventListener('click',()=>{
    if(panel)return;
    panel=document.createElement('section');panel.className='tg-public-search';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','搜索歌曲');
    panel.innerHTML='<header><b>搜索歌曲</b><button type="button" class="ov2-btn" data-tg-close>关闭</button></header><form><input type="search" placeholder="歌名或歌手" aria-label="歌名或歌手" required maxlength="120"><select aria-label="公开曲源"><option value="all">全部曲源</option><option value="netease">网易云</option><option value="kugou">酷狗</option><option value="kuwo">酷我</option></select><button class="ov2-btn" type="submit">搜索</button></form><p role="status">公开曲源搜索，不使用登录凭证。解析到地址不代表一定可播放。</p><div class="tg-public-results"></div>';
    player.appendChild(panel);
    const current=panel,input=panel.querySelector('input'),status=panel.querySelector('[role=status]'),results=panel.querySelector('.tg-public-results');
    const active=signal=>!disposed&&panel===current&&!signal.aborted&&player.classList.contains('open');
    panel.querySelector('[data-tg-close]').addEventListener('click',close);
    panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close()}if(event.key==='Tab'){const focusable=Array.from(current.querySelectorAll('button:not(:disabled),input,select'));const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}});
    panel.querySelector('form').addEventListener('submit',async event=>{
      event.preventDefault();controller?.abort();controller=new AbortController();const signal=controller.signal;
      results.replaceChildren();status.textContent='正在搜索并解析播放地址…';
      try{
        const tracks=await onlineMusicSearch(input.value,panel.querySelector('select').value,{signal});
        if(!active(signal))return;
        status.textContent=tracks.length?'找到 '+tracks.length+' 首曲源，选一首开始听。':'没有找到可用地址，请换个关键词或曲源。';
        tracks.forEach(track=>{
          const button=document.createElement('button');button.type='button';button.className='ov2-card tg-public-result';
          const title=document.createElement('b'),meta=document.createElement('small');title.textContent=track.name;
          meta.textContent=track.artist+' · '+({netease:'网易云',kugou:'酷狗',kuwo:'酷我'}[track.source]||track.source);
          button.append(title,meta);results.appendChild(button);
          button.addEventListener('click',async()=>{
            controller?.abort();controller=new AbortController();const signal=controller.signal;
            results.querySelectorAll('button').forEach(b=>{b.disabled=true});status.textContent='正在获取歌词…';
            try{
              const verified=await verifyTrack(track,{signal});if(!verified)throw new Error('播放地址暂时不可用');
              const lyrics=await tryLoadLyrics(track,{signal});if(!active(signal))return;
              const id='tg_public_'+track.source+'_'+encodeURIComponent(track.id);
              const previous=await dbGet('music',id);if(!active(signal))return;
              const record={id,name:track.name,title:track.name,artist:track.artist,album:track.album,cover:track.cover,data:verified.verifiedUrl,addedAt:previous?.addedAt||Date.now(),src:'together-public',publicTrack:{source:track.source,id:track.id,urlId:track.urlId,lyricId:track.lyricId,apiBase:track.apiBase},lyrics};
              await dbPut('music',record);if(!active(signal))return;
              beginPublicPlayback();
              await _pwLoad();if(!active(signal))return;
              const index=_pw.list.findIndex(r=>r.id===id);if(index<0)throw new Error('歌曲未进入本地曲库');
              await _pwPlayIdx(index);if(!active(signal))return;
              syncLyrics();
              if(_pw.a?.paused){status.textContent='歌曲已添加，但播放未开始。请关闭搜索后用原生播放键重试。';return}
              close();
            }catch(error){if(active(signal))status.textContent=error.message||'加载失败，请重试'}
            finally{if(active(signal))results.querySelectorAll('button').forEach(b=>{b.disabled=false})}
          });
        });
      }catch(error){if(active(signal))status.textContent='曲源请求失败，请稍后重试。'}
    });
    input.focus();
  });
  return dispose;
}
