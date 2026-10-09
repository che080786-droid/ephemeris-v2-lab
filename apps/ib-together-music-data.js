/* Public Meting data adapter, adapted from che080786-droid/- @ ab9a187.
 * ES module scope; no old state/UI, auth storage, credentials or Audio instances.
 */
const MUSIC_API_BASES=['https://music.yuncan.xyz/api','https://api.injahow.cn/meting/'];
const resolved=new Map();
function endpoint(base,source,type,id,extra=''){
  return base+(base.includes('?')?'&':'?')+'server='+encodeURIComponent(source)+'&type='+type+'&id='+encodeURIComponent(id)+extra;
}
function httpUrl(value){return typeof value==='string'&&/^https?:\/\//i.test(value)?value:''}
function cancelled(signal){if(signal?.aborted)throw new DOMException('Cancelled','AbortError')}
async function request(url,signal,read){
  cancelled(signal);
  const controller=new AbortController(),abort=()=>controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,9000);
  try{
    const response=await fetch(url,{signal:controller.signal,credentials:'omit',cache:'no-store',redirect:'follow',referrerPolicy:'no-referrer'});
    if(!response.ok)throw new Error('HTTP '+response.status);
    return await read(response);
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
export function normalizeMusicList(data){
  for(const value of [data,data?.data,data?.songs,data?.result,data?.result?.songs,data?.result?.data])if(Array.isArray(value))return value;
  return [];
}
function normalizeOpenTrack(r,source,apiBase){
  const artist=r.artist||r.artists||r.ar||r.author||r.singer;
  const joinArtist=v=>typeof v==='string'?v:(v?.name||'');
  const id=String(r.id||r.songid||r.songId||r.url_id||r.mid||'');
  const picId=String(r.pic_id||r.picId||r.album?.pic_id||r.album?.picId||'');
  return {id,urlId:String(r.url_id||id),lyricId:String(r.lyric_id||id),source,apiBase,
    name:r.name||r.title||r.songname||'未知歌曲',artist:(Array.isArray(artist)?artist.map(joinArtist).filter(Boolean).join(' / '):joinArtist(artist))||'未知歌手',
    album:typeof r.album==='string'?r.album:(r.album?.name||r.album_name||r.collection||''),
    cover:httpUrl(r.pic||r.cover||r.picUrl||r.artwork||r.album?.picUrl)||(picId?endpoint(apiBase,source,'pic',picId):'')};
}
async function searchOneMusicSource(term,source,signal){
  for(const base of MUSIC_API_BASES){
    try{
      const data=await request(endpoint(base,source,'search',term,'&limit=25'),signal,r=>r.json());
      const list=normalizeMusicList(data).map(r=>normalizeOpenTrack(r,source,base)).filter(t=>t.id&&t.name);
      if(list.length)return list;
    }catch(e){cancelled(signal)}
  }
  return [];
}
export async function verifyTrack(track,{signal}={}){
  const key=track.source+'|'+track.id,cached=resolved.get(key);
  if(cached&&cached.expiresAt>Date.now())return {...track,verifiedUrl:cached.url};
  const bases=[track.apiBase,...MUSIC_API_BASES.filter(b=>b!==track.apiBase)].filter(Boolean);
  for(const base of bases){
    try{
      const url=await request(endpoint(base,track.source,'url',track.urlId||track.id,base.includes('yuncan')?'&json=1':''),signal,async r=>{
        if((r.headers.get('content-type')||'').includes('audio/')){r.body?.cancel().catch(()=>{});return httpUrl(r.url)}
        const raw=(await r.text()).trim();let value='';
        try{const j=JSON.parse(raw);value=j?.url||j?.data?.url||j?.data||j?.play_url||j?.music_url||'';if(Array.isArray(value))value=value[0]?.url||value[0]||''}
        catch(e){value=raw.replace(/^["']|["']$/g,'')}
        return httpUrl(value)||(r.redirected?httpUrl(r.url):'');
      });
      if(url){resolved.set(key,{url,expiresAt:Date.now()+6*60*60*1000});return {...track,verifiedUrl:url}}
    }catch(e){cancelled(signal)}
  }
  return null;
}
export async function onlineMusicSearch(term,source='all',{signal}={}){
  term=String(term||'').trim();if(!term)return [];
  const sources=source==='all'?['netease','kugou','kuwo']:[source];
  if(sources.some(s=>!['netease','kugou','kuwo'].includes(s)))throw new Error('Unknown public source');
  const groups=await Promise.all(sources.map(s=>searchOneMusicSource(term,s,signal)));
  cancelled(signal);
  const seen=new Set(),candidates=groups.flat().filter(t=>{const key=t.source+'|'+t.id;if(seen.has(key))return false;seen.add(key);return true}).slice(0,16);
  let cursor=0;const results=[];
  async function worker(){while(cursor<candidates.length&&results.length<10){cancelled(signal);const t=await verifyTrack(candidates[cursor++],{signal});cancelled(signal);if(t)results.push(t)}}
  await Promise.all([worker(),worker()]);return results.slice(0,10);
}
export function parseLyrics(raw){
  // Existing IB parser handles LRC tags/offsets. Never invent timestamps for plain text.
  const lyrics=window.IBMusicCore.parseLyrics(String(raw||''),'public.lrc');
  lyrics.timed=lyrics.segments.length>0;
  if(!lyrics.timed)lyrics.text=String(raw||'').trim();
  return lyrics;
}
export async function tryLoadLyrics(track,{signal}={}){
  for(const type of ['lrc','lyric']){
    try{
      const raw=await request(endpoint(track.apiBase||MUSIC_API_BASES[0],track.source,type,track.lyricId||track.id),signal,r=>r.text());
      let lyric=raw;
      try{const j=JSON.parse(raw);lyric=j?.lyric||j?.lrc?.lyric||j?.lrc||j?.data?.lyric||''}catch(e){}
      if(typeof lyric==='string'&&lyric.trim())return parseLyrics(lyric);
    }catch(e){cancelled(signal)}
  }
  return {source:'lrc',segments:[],text:'',timed:false,none:true};
}
export function syncLyrics(){
  // Delegate rendering and Audio.timeupdate highlighting to native Music; no second clock.
  if(typeof window._maRefreshMusicM==='function')window._maRefreshMusicM();
}
