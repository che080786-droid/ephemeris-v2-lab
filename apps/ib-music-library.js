/* Local collection metadata only. Never store audio URLs, blobs or credentials. */
export const LIBRARY_KEY='ib_music_library_v1';
export const BACKGROUND_KEY='ib_listen_background_v1';
export const BACKGROUNDS=[['default','默认背景'],['cover','歌曲封面'],['dawn','晨光'],['sea','海雾'],['night','夜色']];
export function trackKey(track){
  if(!track)return '';
  if(track.publicTrack?.id)return 'online:'+track.publicTrack.source+':'+track.publicTrack.id;
  if(track.ncm&&track.nid!=null)return 'online:netease:'+track.nid;
  if(track.qqm&&track.qmid)return 'online:qq:'+track.qmid;
  return track.id?'local:'+track.id:'';
}
export function readLibrary(){
  const raw=localStorage.getItem(LIBRARY_KEY);
  if(!raw)return {version:2,tracks:{},liked:[],actorLikes:{mingyue:[],yanjing:[]},playlists:[]};
  const data=JSON.parse(raw);
  if(![1,2].includes(data.version)||!data.tracks||!Array.isArray(data.liked)||!Array.isArray(data.playlists))throw new Error('Invalid music collection');
  data.actorLikes={mingyue:[...new Set([...(data.actorLikes?.mingyue||[]),...data.liked])],yanjing:[...new Set(data.actorLikes?.yanjing||[])]};
  data.version=2;data.liked=[...data.actorLikes.mingyue];
  return data;
}
function remember(data,track){
  const key=trackKey(track);if(!key)throw new Error('No current track');
  data.tracks[key]={key,recordId:String(track.id||''),title:String(track.title||track.name||'未命名歌曲'),artist:String(track.artist||''),album:String(track.album||'')};
  return key;
}
function save(data){localStorage.setItem(LIBRARY_KEY,JSON.stringify(data));window.dispatchEvent(new Event('ib-music-library-change'))}
export function likeState(track){const data=readLibrary(),key=trackKey(track);return {mingyue:data.actorLikes.mingyue.includes(key),yanjing:data.actorLikes.yanjing.includes(key)}}
export function setLike(track,actor,liked){
  if(!['mingyue','yanjing'].includes(actor))throw new Error('Invalid actor');
  const data=readLibrary(),key=remember(data,track),list=data.actorLikes[actor],index=list.indexOf(key);
  if(liked&&index<0)list.push(key);if(!liked&&index>=0)list.splice(index,1);
  data.liked=[...data.actorLikes.mingyue];save(data);return liked;
}
export function toggleLike(track,actor='mingyue'){return setLike(track,actor,!likeState(track)[actor])}
export function addToPlaylist(track,{id,name}={}){
  const data=readLibrary(),key=remember(data,track);let playlist;
  if(id){playlist=data.playlists.find(p=>p.id===id);if(!playlist)throw new Error('Playlist missing')}
  else{
    name=String(name||'').trim().slice(0,60);if(!name)throw new Error('Empty playlist name');
    playlist=data.playlists.find(p=>p.name===name);
    if(!playlist){playlist={id:crypto.randomUUID(),name,createdAt:Date.now(),trackKeys:[]};data.playlists.push(playlist)}
  }
  const duplicate=playlist.trackKeys.includes(key);if(!duplicate)playlist.trackKeys.push(key);
  save(data);return {name:playlist.name,duplicate};
}
export function readBackground(){const value=localStorage.getItem(BACKGROUND_KEY);return BACKGROUNDS.some(([id])=>id===value)?value:'default'}
export function saveBackground(value){if(!BACKGROUNDS.some(([id])=>id===value))throw new Error('Unknown background');localStorage.setItem(BACKGROUND_KEY,value);window.dispatchEvent(new Event('ib-listen-background-change'))}
