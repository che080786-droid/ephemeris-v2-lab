/* Shared batching and delivery, used by native Chat and Listen Together. */
(function(){
  if(window.IBReplyRhythm)return;
  const states=new Map();let clock=0;
  const protocol=`【本轮聊天回复格式 · 多气泡】
用户可能连续发送多条消息，请把本轮连续表达一起理解。正文只返回 JSON 对象，唯一字段 messages，值为 1～4 个非空字符串；每个字符串就是一条独立发送、保存和显示的 assistant 消息，不是段落数组的摘要。
默认优先像微信聊天一样回复成 2～4 个独立气泡。如果回复包含多个自然语义单元（例如回应感受、补充想法、接着提问），优先拆成多个 messages；只有非常短、单一语义的回复才使用单条。
每条尽量只有 1 句话，必要时最多 2 句短句。不要把多个语义单元或整段完整回复塞进 messages[0]，也不要先发一条完整回复再用其他条重复它。先按意思组织，再逐条表达；不要为了凑数量添加内容、拆碎一句话或把称呼单独成条。代码、引用和工具标签保持完整，原有工具/语音标记放在所属字符串内并正确 JSON 转义。若启用了单独的 thinking 标签，标签外的正式正文仍必须遵循此 JSON 格式。
多语义示例：{"messages":["今天这么忙，辛苦了。","我陪你慢慢缓一会儿。","想聊聊刚才发生的事吗？"]}
短回答示例：{"messages":["好，等你。"]}
输出前检查：多个自然语义单元是否已经分别放入 messages？每条是否简短且不重复？不要输出 Markdown 围栏或格式说明。`;
  function parse(raw){
    const original=String(raw||''),text=original.trim();
    // Recover a whole JSON fence, including compact fences used by some relays.
    const json=text.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i,'$1');
    try{const value=JSON.parse(json);
      if(value&&Array.isArray(value.messages)&&value.messages.length>=1&&value.messages.length<=4&&value.messages.every(t=>typeof t==='string'&&t.trim())&&Object.keys(value).length===1)return value.messages.map(t=>t.trim());
      // Malformed envelopes stay lossless; never expose only a partial messages list.
      return text?[original]:[];
    }catch(e){}
    // Only failed structured parsing may fall back to explicit prose paragraphs.
    // Do not cut at punctuation, or split JSON, code, quotations, lists or tool tags.
    if(!/[{}\[\]<>`]|^[ \t]*(?:[-*#>“”「」『』"'|]|\d+[.)、])/m.test(text)){
      const paragraphs=text.split(/\r?\n[ \t]*\r?\n+/).map(t=>t.trim()).filter(Boolean);
      if(paragraphs.length>=2&&paragraphs.length<=4&&paragraphs.every(t=>t.length>=4))return paragraphs;
    }
    return text?[original]:[];
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
