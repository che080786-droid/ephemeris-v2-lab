/* Native Chat adapter: existing genReply/provider/context/saveAi remain the request path. */
(function(){
  const rhythm=window.IBReplyRhythm,receive=document.getElementById('cv-receive');
  const histories=new Map(),saving=new Map();let current='',generation=0,unsub=null;
  const key=(cfg,thread)=>'chat:'+JSON.stringify([cfg.id,thread?.id||'']);
  function active(cfg,thread,seq){return generation===seq&&_activeCfg?.id===cfg.id&&(_activeThread?.id||'')===(thread?.id||'')&&document.getElementById('conv').classList.contains('open')&&!document.getElementById('music-app').classList.contains('open')}
  function paint(){if(!current){receive.disabled=true;return}rhythm.paint(receive,current,{blocked:!!saving.get(current)});if(_sendKeys.has(_convKey(_activeCfg))&&!rhythm.get(current).turn){receive.disabled=false;receive.textContent='■';receive.setAttribute('aria-label','停止本轮回复')}}
  function leave(){generation++;if(current)rhythm.stop(current);unsub?.();unsub=null;current='';paint()}
  async function open(cfg,thread){
    leave();const seq=generation,k=key(cfg,thread);
    const messages=(await dbGetByIndex('chatMessages','byFriend',cfg.id)).filter(m=>(m.threadId||'')===(thread?.id||'')&&(m.timestamp||0)>sealOf(cfg,thread)).sort((a,b)=>a.timestamp-b.timestamp||a.id.localeCompare(b.id));
    if(generation!==seq)return;
    histories.set(k,messages);rhythm.seed(k,messages,{persistent:true});current=k;unsub=rhythm.subscribe(k,paint);paint();
  }
  function observe(cfg,thread,message){const k=key(cfg,thread),history=histories.get(k);if(history&&!history.some(m=>m.id===message.id))history.push(message)}
  async function saveUser(cfg,thread,message){const k=key(cfg,thread);saving.set(k,(saving.get(k)||0)+1);paint();try{await dbPut('chatMessages',message);observe(cfg,thread,message);rhythm.enqueue(k,message)}finally{saving.set(k,saving.get(k)-1);paint()}}
  receive.addEventListener('click',async()=>{
    const cfg=_activeCfg,thread=_activeThread;if(!cfg||!current)return;const k=current;
    if(rhythm.get(k).turn){rhythm.stop(k);return}
    const native=_acMap[_convKey(cfg)];if(native){native.abort();return}
    if(!cfg.apiKey&&!cfg._group){toast('这个配置还没有 API Key，请到 API 页填写');return}
    const seq=generation,messages=(histories.get(k)||_msgs).slice();
    try{await rhythm.run(k,async turn=>{
      const options={rhythmTurn:turn,messages,thread,active:()=>active(cfg,thread,seq)};
      if(cfg._group)await genReplyGroup(cfg,{rhythm:options});else await genReply(cfg,options);
    })}catch(e){if(e.name!=='AbortError')toast('收取失败，请重试')}
    paint();
  });
  window.IBChatRhythm={open,leave,paint,saveUser,observe,settle(cfg,thread,messages){rhythm.acknowledge(key(cfg,thread),messages.filter(m=>m.role==='user').map(m=>m.id))}};
  const conv=document.getElementById('conv'),music=document.getElementById('music-app');
  let musicOpen=music.classList.contains('open');
  new MutationObserver(()=>{if(!conv.classList.contains('open'))leave()}).observe(conv,{attributes:true,attributeFilter:['class']});
  new MutationObserver(()=>{const next=music.classList.contains('open');if(next===musicOpen)return;musicOpen=next;if(next){if(current)leave()}else if(conv.classList.contains('open')&&_activeCfg)open(_activeCfg,_activeThread).catch(()=>toast('待回复状态读取失败'))}).observe(music,{attributes:true,attributeFilter:['class']});
})();
