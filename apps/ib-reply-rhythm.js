/* Shared batching and delivery, used by native Chat and Listen Together. */
(function(){
  if(window.IBReplyRhythm)return;
  const states=new Map();let clock=0;
  const protocol='【本轮聊天回复格式】用户可能连续发送多条消息，请把本轮连续表达一起理解。只返回 JSON：{"messages":["自然回复"]}。messages 为 1～4 个非空字符串；短回答一条即可，只在内容自然需要分开时使用多条，不为凑数量拆碎短句。';
  function parse(raw){
    const original=String(raw||'');
    try{const value=JSON.parse(original.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/,'$1'));
      if(value&&Array.isArray(value.messages)&&value.messages.length>=1&&value.messages.length<=4&&value.messages.every(t=>typeof t==='string'&&t.trim())&&Object.keys(value).length===1)return value.messages.map(t=>t.trim());
    }catch(e){}
    return original.trim()?[original]:[];
  }
  function get(key){if(!states.has(key))states.set(key,{key,known:new Set(),pending:[],turn:null,listeners:new Set(),seeded:false,persist:false});return states.get(key)}
  // Saved assistant batch receipts are authoritative; this local hint may be unavailable/full.
  function persist(s){if(s.persist)try{localStorage.setItem('ib_reply_rhythm_v1:'+s.key,JSON.stringify({known:[...s.known],pending:s.pending,inflight:s.turn&&!s.turn.published?s.turn.ids:[]}))}catch(e){}}
  function notify(s){for(const fn of s.listeners)fn()}
  function seed(key,messages,{persistent=false}={}){
    const s=get(key);s.persist=persistent;
    if(!s.seeded){
      let saved=null;try{const raw=persistent?localStorage.getItem('ib_reply_rhythm_v1:'+key):null;if(raw){const value=JSON.parse(raw);if([value.known,value.pending,value.inflight].every(Array.isArray))saved=value}}catch(e){}
      if(saved){s.known=new Set(saved.known);s.pending=[...new Set([...saved.inflight,...saved.pending])];}
      else{let last=-1;messages.forEach((m,i)=>{if(m.role==='assistant'&&!m.replyBatch)last=i});messages.forEach((m,i)=>{if(m.role==='user'){s.known.add(m.id);if(i>last)s.pending.push(m.id)}})}
      s.seeded=true;
    }
    const users=new Set(messages.filter(m=>m.role==='user').map(m=>m.id));
    const committed=new Set(messages.filter(m=>m.role==='assistant'&&m.replyBatch?.key===key).flatMap(m=>m.replyBatch.ids));
    s.pending=s.pending.filter(id=>users.has(id)&&!committed.has(id));
    for(const m of messages)if(m.role==='user'&&!s.known.has(m.id)){s.known.add(m.id);if(!committed.has(m.id))s.pending.push(m.id)}
    persist(s);notify(s);return s;
  }
  function enqueue(key,m){const s=get(key);if(!s.known.has(m.id)){s.known.add(m.id);s.pending.push(m.id);persist(s);notify(s)}}
  function acknowledge(key,ids){const s=get(key),done=new Set(ids);s.pending=s.pending.filter(id=>!done.has(id));for(const id of done)s.known.add(id);persist(s);notify(s)}
  async function run(key,task){
    const s=get(key);if(s.turn||!s.pending.length)return;
    const turn={key,ids:s.pending.slice(),controller:new AbortController(),published:0};
    turn.signal=turn.controller.signal;s.pending=[];s.turn=turn;
    try{persist(s);notify(s);await task(turn)}
    finally{if(!turn.published)s.pending=[...new Set([...turn.ids,...s.pending])];s.turn=null;persist(s);notify(s)}
  }
  function stop(key){get(key).turn?.controller.abort()}
  function check(turn,active){if(turn.signal.aborted||!active())throw new DOMException('Cancelled','AbortError')}
  async function deliver(turn,raw,save,{active=()=>true,delay=350}={}){
    const parts=parse(raw);
    for(let index=0;index<parts.length;index++){
      check(turn,active);
      if(index&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&!document.body.classList.contains('ib-reduce')){
        await new Promise(resolve=>{const done=()=>{clearTimeout(timer);turn.signal.removeEventListener('abort',done);resolve()};const timer=setTimeout(done,delay);turn.signal.addEventListener('abort',done,{once:true})});check(turn,active);
      }
      await save(parts[index],index);turn.published++;persist(get(turn.key));notify(get(turn.key));
    }
    return parts;
  }
  function paint(button,key,{blocked=false}={}){const s=get(key),busy=!!s.turn;button.textContent=busy?'■':'✦';button.disabled=!busy&&(blocked||!s.pending.length);button.setAttribute('aria-label',busy?'停止本轮回复':'收取回复');button.title=busy?'停止本轮回复':'让晏景回复';button.setAttribute('aria-busy',String(busy))}
  window.IBReplyRhythm={protocol,parse,get,seed,enqueue,acknowledge,run,stop,deliver,paint,stamp:()=>clock=Math.max(Date.now(),clock+1),subscribe(key,fn){const s=get(key);s.listeners.add(fn);return()=>s.listeners.delete(fn)}};
})();
