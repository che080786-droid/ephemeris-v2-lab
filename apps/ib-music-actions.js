/* All effects go through existing native Music entry points. No Audio or provider implementations. */
import {setLike,trackKey,addToPlaylist} from './ib-music-library.js';
import {onlineMusicSearch} from './ib-together-music-data.js';
import {playPublicTrack} from './ib-together-track-playback.js';
export const ACTION_TYPES=['like_song','unlike_song','next_track','previous_track','play_track','recommend_song','invite_listen_together','accept_listen_together','decline_listen_together','add_to_playlist'];
const STORE='ib_music_participation_v1';export const INVITE_COOLDOWN_MS=5*60*1000;
const resolvingInvitations=new Set();
export const currentTrack=()=>typeof _pw!=='undefined'?_pw.list?.[_pw.idx]:null;
export function normalizeMusicAction(value){
  if(!value||!ACTION_TYPES.includes(value.type)||!['mingyue','yanjing'].includes(value.actor))throw new Error('INVALID_MUSIC_ACTION');
  const text=(v,n=160)=>typeof v==='string'?v.trim().slice(0,n):'';
  const action={id:text(value.id)||crypto.randomUUID(),type:value.type,actor:value.actor};
  if(value.track)action.track={recordId:text(value.track.recordId),title:text(value.track.title),artist:text(value.track.artist),reason:text(value.track.reason,400)};
  if(value.playlist)action.playlist={id:text(value.playlist.id),name:text(value.playlist.name,60)};
  if(value.inviteId)action.inviteId=text(value.inviteId);
  if(['play_track','recommend_song'].includes(action.type)&&!action.track?.recordId&&!action.track?.title)throw new Error('MISSING_TRACK');
  if(action.type==='recommend_song'&&(!action.track?.title||!action.track?.artist))throw new Error('MISSING_RECOMMENDATION_METADATA');
  if(action.type==='add_to_playlist'&&!action.playlist?.id&&!action.playlist?.name)throw new Error('MISSING_PLAYLIST');
  if(['accept_listen_together','decline_listen_together'].includes(action.type)&&!action.inviteId)throw new Error('MISSING_INVITATION');
  return action;
}
function readState(){const raw=localStorage.getItem(STORE);return raw?JSON.parse(raw):{invitations:{},lastInviteAt:0}}
function saveState(state){localStorage.setItem(STORE,JSON.stringify(state));window.dispatchEvent(new Event('ib-music-invitation-change'))}
export function pendingInvitation(conversationKey,actor='mingyue'){return Object.values(readState().invitations).find(i=>i.conversationKey===conversationKey&&i.actor===actor&&i.status==='pending')||null}
export function invitation(id){return readState().invitations[id]||null}
export async function openListenTogether(friendId){
  if(friendId){await window.loadMP();const cfg=(typeof _cfgs!=='undefined'?_cfgs:[]).find(c=>c.id===friendId&&!c._group);if(!cfg)throw new Error('FRIEND_UNAVAILABLE');_mp.musicAi={..._mp.musicAi,mate:friendId,share:true};await window.saveMP()}
  const ui=await import('./ib-together-music-ui.js');ui.installMusicUi();
  if(!document.querySelector('link[data-ib-music-actions-style]')&&!document.querySelector('link[href="apps/ib-listen-together.css"]')){
    await new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href='apps/ib-listen-together.css';link.dataset.ibMusicActionsStyle='1';link.onload=resolve;link.onerror=()=>{link.remove();reject(new Error('STYLE_UNAVAILABLE'))};document.head.appendChild(link)})
  }
  await window.openMusicApp();document.getElementById('music-app').classList.add('tg-listen');
}
function actionTrack(action){if(!action.track?.recordId)return currentTrack();return _pw.list.find(t=>t.id===action.track.recordId)||null}
export async function executeMusicAction(value,{conversationKey='room',friendId='',signal,active=()=>true}={}){
  const action=normalizeMusicAction(value);if(signal?.aborted||!active())throw new DOMException('Cancelled','AbortError');
  const name=action.actor==='yanjing'?'晏景':'明月';let result;
  switch(action.type){
    case 'like_song':case 'unlike_song':{
      const track=actionTrack(action);if(!trackKey(track))throw new Error('NO_CURRENT_TRACK');setLike(track,action.actor,action.type==='like_song');result={kind:'notice',text:name+(action.type==='like_song'?'喜欢了这首歌':'取消了喜欢')};break;
    }
    case 'next_track':case 'previous_track':{
      if(!_pw.list?.length)throw new Error('EMPTY_QUEUE');document.getElementById(action.type==='next_track'?'pw-next':'pw-prev').click();result={kind:'notice',text:name+'换了一首'};break;
    }
    case 'play_track':{
      const index=action.track.recordId?_pw.list.findIndex(t=>t.id===action.track.recordId):-1;
      if(index>=0)await window._pwPlayIdx(index);
      else{
        const tracks=await onlineMusicSearch([action.track.title,action.track.artist].filter(Boolean).join(' '),'all',{signal});
        if(signal?.aborted||!active())throw new DOMException('Cancelled','AbortError');
        const match=v=>String(v||'').replace(/\s+/g,'').toLowerCase();
        const selected=tracks.find(t=>match(t.name)===match(action.track.title)&&(!action.track.artist||match(t.artist).includes(match(action.track.artist))));
        if(!selected)throw new Error('TRACK_NOT_FOUND');await playPublicTrack(selected,{signal,active});
      }
      if(_pw.a?.paused)throw new Error('PLAYBACK_NOT_STARTED');result={kind:'notice',text:name+'选了一首歌'};break;
    }
    case 'recommend_song':result={kind:'recommendation',id:action.id,actor:action.actor,song:action.track,status:'pending'};break;
    case 'add_to_playlist':{
      const track=actionTrack(action);if(!trackKey(track))throw new Error('NO_CURRENT_TRACK');const p=addToPlaylist(track,action.playlist);result={kind:'notice',text:name+'把歌曲加入「'+p.name+'」'};break;
    }
    case 'invite_listen_together':{
      const state=readState(),now=Date.now();
      if(action.actor==='yanjing'&&state.lastInviteAt&&now-state.lastInviteAt<INVITE_COOLDOWN_MS)return {kind:'notice',text:'先留一点时间，稍后再邀请。',cooldown:true};
      const existing=Object.values(state.invitations).find(i=>i.status==='pending'&&i.actor===action.actor&&i.conversationKey===conversationKey);
      if(existing)return {kind:'invitation',id:existing.id,status:existing.status};
      const i={id:action.id,actor:action.actor,conversationKey,friendId,status:'pending',createdAt:now};state.invitations[i.id]=i;if(action.actor==='yanjing')state.lastInviteAt=now;saveState(state);result={kind:'invitation',id:i.id,status:i.status};break;
    }
    case 'accept_listen_together':case 'decline_listen_together':{
      const state=readState(),i=state.invitations[action.inviteId];
      if(!i||i.conversationKey!==conversationKey||i.actor===action.actor)throw new Error('INVALID_INVITATION');
      if(i.status!=='pending')return {kind:'notice',text:'这份邀请已处理。'};
      if(resolvingInvitations.has(i.id))throw new Error('INVITATION_BUSY');
      resolvingInvitations.add(i.id);
      try{
        if(action.type==='accept_listen_together')await openListenTogether(i.friendId);
        const latest=readState(),resolved=latest.invitations[i.id];
        resolved.status=action.type==='accept_listen_together'?'accepted':'declined';resolved.resolvedAt=Date.now();saveState(latest);
        result={kind:'notice',text:resolved.status==='accepted'?'一起听已开启':'这次先不一起听'};
      }finally{resolvingInvitations.delete(i.id)}
      break;
    }
  }
  window.dispatchEvent(new CustomEvent('ib-music-action-result',{detail:{action,result}}));return result;
}
