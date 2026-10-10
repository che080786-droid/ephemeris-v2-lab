import {executeMusicAction,invitation,openListenTogether} from './ib-music-actions.js';
export function musicCard(result,context,onChange=()=>{}){
  const card=document.createElement('section');card.className='ib-music-card';
  const title=document.createElement('b'),description=document.createElement('p'),controls=document.createElement('div'),status=document.createElement('small');status.setAttribute('role','status');card.append(title,description,controls,status);
  let busy=false;
  async function run(action,done){
    if(busy)return;busy=true;controls.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='正在处理…';
    try{await action();await done();await onChange()}catch(e){status.textContent='暂时没有完成，可以稍后重试。'}
    finally{busy=false;controls.querySelectorAll('button').forEach(b=>b.disabled=false)}
  }
  function button(text,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',event=>{event.stopPropagation();fn()});controls.appendChild(b)}
  if(result.kind==='recommendation'){
    title.textContent='《'+result.song.title+'》';description.textContent=[result.song.artist,result.song.reason].filter(Boolean).join(' · ');
    if(result.status==='dismissed'){status.textContent='已忽略';return card}
    const play=()=>executeMusicAction({type:'play_track',actor:'mingyue',track:result.song},context);
    button('播放',()=>run(play,async()=>{status.textContent='已开始播放'}));
    button('一起听',()=>run(async()=>{await play();await openListenTogether(context.friendId)},async()=>{status.textContent='正在一起听'}));
    button('忽略',()=>run(async()=>{},async()=>{result.status='dismissed';controls.replaceChildren();status.textContent='已忽略'}));
  }else if(result.kind==='invitation'){
    let i;try{i=invitation(result.id)}catch(e){}title.textContent='一起听歌';
    description.textContent=i?.actor==='mingyue'?'明月邀请晏景一起听。':'晏景邀请你一起听歌。';
    if(!i||i.status!=='pending'){status.textContent=i?.status==='accepted'?'已经一起听':i?.status==='declined'?'这次先不一起听':'邀请暂时不可用';return card}
    if(i.actor==='mingyue'){status.textContent='等晏景回应';return card}
    function respond(type){run(()=>executeMusicAction({type,actor:'mingyue',inviteId:i.id},context),async()=>{controls.replaceChildren();status.textContent=type==='accept_listen_together'?'已经一起听':'这次先不一起听'})}
    button('一起听',()=>respond('accept_listen_together'));button('暂时不要',()=>respond('decline_listen_together'));
  }
  return card;
}
