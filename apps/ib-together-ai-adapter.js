import {normalizeMusicAction} from './ib-music-actions.js';
/* Internal response contract. Providers translate external formats before returning here. */
export const MAX_RESPONSE_LENGTH=800;
export function normalizeResponse(value){
  if(!value||typeof value.text!=='string'||!value.text.trim())throw new Error('EMPTY_RESPONSE');
  const chars=Array.from(value.text.replace(/\r\n?/g,'\n'));
  const text=chars.length>MAX_RESPONSE_LENGTH?chars.slice(0,MAX_RESPONSE_LENGTH-1).join('')+'…':chars.join('');
  const actions=(value.actions||[]);if(!Array.isArray(actions)||actions.length>5)throw new Error('INVALID_ACTIONS');
  return Object.freeze({text,actions:actions.map(normalizeMusicAction),mood:['calm','warm','happy'].includes(value.mood)?value.mood:'calm',type:'comment'});
}
export function createAiAdapter(provider){
  return {async respond(context,options){return normalizeResponse(await provider.respond(context,options))}};
}
export const MOCK_CASES=[
  ['short','很短的一句话'],['normal','正常 2–3 行'],['long','很长的一段'],
  ['emoji','带 emoji'],['punctuation','中文标点'],['newline','带换行'],
  ['like','晏景喜欢当前歌曲'],['unlike','晏景取消喜欢'],['next','晏景下一首'],['previous','晏景上一首'],['play','晏景播放当前歌曲'],['playlist','晏景加入歌单'],['recommend','晏景推荐歌曲'],['invite','晏景主动邀请一起听'],['ordinary','普通聊天不邀请'],['accept','晏景接受用户邀请'],['decline','晏景拒绝用户邀请'],['loading','邀请回应 loading'],['error','模拟错误'],['empty','无响应']
];
// Static fixtures only: no network, credentials, storage, or generated content.
export const mockProvider={
  respond(context,{scenario='short',signal}={}){
    return new Promise((resolve,reject)=>{
      let timer;
      const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(new DOMException('Cancelled','AbortError'))};
      if(signal?.aborted){abort();return}
      signal?.addEventListener('abort',abort,{once:true});
      if(scenario==='loading')return; // Explicitly pending until switched, retried, or unmounted.
      timer=setTimeout(()=>{
        signal?.removeEventListener('abort',abort);
        if(scenario==='error'){reject(new Error('MOCK_ERROR'));return}
        if(scenario==='empty'){resolve(null);return}
        const actor='yanjing',track={recordId:context.trackRecordId||'',title:context.songTitle||'',artist:context.artist||''};
        const participation={
          like:['这首歌我也喜欢。',{type:'like_song',actor,track}],
          unlike:['这首歌先不放进我的喜欢里。',{type:'unlike_song',actor,track}],
          next:['我们换下一首听。',{type:'next_track',actor}],previous:['再听听上一首。',{type:'previous_track',actor}],
          play:['再听这首吧。',{type:'play_track',actor,track}],
          playlist:['把这首留在一起听的歌单里。',{type:'add_to_playlist',actor,track,playlist:{name:'一起听'}}],
          recommend:['刚刚听你这么说，我突然想到一首歌。',{type:'recommend_song',actor,track:{title:'晴天',artist:'周杰伦',reason:'想把这一段旋律分享给你。'}}],
          invite:['要不要一起听歌？',{type:'invite_listen_together',actor}],
          accept:['好。你想先听哪一首？',{type:'accept_listen_together',actor,inviteId:context.inviteId}],
          decline:['今天想安静陪你一会儿，先不听，好不好。',{type:'decline_listen_together',actor,inviteId:context.inviteId}]
        };
        if(participation[scenario]){const [text,action]=participation[scenario];resolve({text,actions:[action]});return}
        const fixtures={
          ordinary:'我在这里，听你慢慢说。',
          short:'这句歌词我也很喜欢。',
          normal:'先不急着说话。\n一起听完这一段，\n再慢慢聊今天。',
          long:'这首歌让人想起一些安静的日常。'+('有时候，一首歌会让普通的片刻变得柔软。我们可以慢慢听，也可以暂时安静，把今天的小事留到旋律结束以后再说。窗外的光、手边的杯子、刚刚想起的一句话，都可以成为这一刻的一部分。').repeat(12),
          emoji:'这一段好温柔。🌙\n一起听吧，给今天留一点光 ✨ 🎧',
          punctuation:'“这句歌词”，你也喜欢吗？\n嗯……我想再听一遍；不着急，一起慢慢听。',
          newline:'第一行：我们听到这里。\n\n空一行，留一点安静。\n最后一行：一起听完。'
        };
        resolve({text:fixtures[scenario]||fixtures.short,mood:scenario==='emoji'?'happy':'calm',type:'comment'});
      },600);
    });
  }
};
