import {verifyTrack,tryLoadLyrics,syncLyrics} from './ib-together-music-data.js';
import {beginPublicPlayback} from './ib-together-playback-context.js';
export async function playPublicTrack(track,{signal,active=()=>true}={}){
  function check(){if(signal?.aborted||!active())throw new DOMException('Cancelled','AbortError')}
  check();
  const verified=await verifyTrack(track,{signal});if(!verified)throw new Error('播放地址暂时不可用');
  const lyrics=await tryLoadLyrics(track,{signal});check();
  const id='tg_public_'+track.source+'_'+encodeURIComponent(track.id);
  const previous=await window.dbGet('music',id);check();
  const record={id,name:track.name,title:track.name,artist:track.artist,album:track.album,cover:track.cover,data:verified.verifiedUrl,addedAt:previous?.addedAt||Date.now(),src:'together-public',publicTrack:{source:track.source,id:track.id,urlId:track.urlId,lyricId:track.lyricId,apiBase:track.apiBase},lyrics};
  await window.dbPut('music',record);check();
  beginPublicPlayback();
  await _pwLoad();check();
  const index=_pw.list.findIndex(r=>r.id===id);if(index<0)throw new Error('歌曲未进入本地曲库');
  await _pwPlayIdx(index);check();
  syncLyrics();
  return record;
}
