/* One internal event through Chat's existing context builders and provider transport. */
const EVENT='明月现在邀请你一起听歌。\n请根据你当前的人设、你们最近的对话状态和自己的表达方式，决定接受还是拒绝。\n不要因为这是系统功能而固定接受。';
const FORMAT='【本次内部邀请事件的输出协议】\n这不是用户发送的聊天消息。只返回一个 JSON 对象，不加 Markdown 或其他文字：\n{"reply":"一句你自然说出的回复","decision":"accept_listen_together 或 decline_listen_together 中的一个"}\nreply 必须是给明月的自然回复；decision 必须恰好为 accept_listen_together 或 decline_listen_together。两种选择都允许，不执行其他动作。';
export function parseInvitationReply(raw){
  if(typeof raw!=='string'||raw.length>12000)throw new Error('INVALID_INVITATION_REPLY');
  const text=raw.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/,'$1');
  const value=JSON.parse(text);
  if(!value||Array.isArray(value)||typeof value.reply!=='string'||!value.reply.trim()||value.reply.length>1200||
    !['accept_listen_together','decline_listen_together'].includes(value.decision)||
    Object.keys(value).some(k=>!['reply','decision'].includes(k)))throw new Error('INVALID_INVITATION_REPLY');
  return {text:value.reply.trim(),decision:value.decision};
}
export async function buildInvitationContext(cfg){
  await window.loadMP();
  const about=await window.loadAbout(),pa=window.mpAi(cfg);
  // Match the selected friend's active thread; another friend's thread is never included.
  const thread=typeof _activeCfg!=='undefined'&&_activeCfg?.id===cfg.id&&typeof _activeThread!=='undefined'?_activeThread:null;
  const quiet=!!thread?.quiet,memOn=thread?!!thread.memoryEnabled:pa.memInject!==false;
  const settings=await window.getSummarySettingsM();
  const summary=settings.enabled?await window.getChatSummaryM(cfg,thread?.id||null):null;
  const limit=summary?.summary&&settings.summaryScope!=='ctx'?Math.max(2,settings.keepCount||6):Math.max(4,pa.histLimit||40);
  const messages=await window._apiHistSrcM(cfg.id,thread?.id||null,limit);
  const hist=window.buildHist(messages,limit,{...cfg,sealTimestamp:window.sealOf(cfg,thread)});
  const query=String(hist.at(-1)?.content||'')+'\n'+EVENT;
  const parts=[cfg.systemPrompt?.trim(),window._ibSiteNoteM(about),cfg.systemPrompt?.trim()?'':_IB_NOPERSONA_NOTE,window.buildUserCtx(about,cfg)];
  const am=await window.buildAmBlocks(cfg,query);
  if(am?.sys)parts.push(am.sys);
  parts.push(_SYS_SPLIT_M+(am?.stable?am.stable+'\n\n':'')+_IB_PERSONA_LOCK.replace(/^\n+/,''));
  const tails=['当前时间：'+new Date().toLocaleString('zh-CN')+'。'];
  if(summary?.summary)tails.push('【对话历史备忘（后台参考）】\n'+summary.summary);
  if(memOn){
    let memories=await window.dbGetAll('memories');
    if(quiet)memories=memories.filter(m=>m&&(m.createdBy===cfg.id||m.createdBy==='user'||!m.createdBy));
    tails.push(window.buildMemBlock(memories,cfg.id,await window.loadMS(),undefined,undefined,query));
  }
  if(am?.dyn)tails.push(am.dyn);
  if(!quiet){
    if(parseInt(pa.postsLimit,10))tails.push(await window.buildPostsBlock(parseInt(pa.postsLimit,10)));
    tails.push(await window.buildCalBlock(cfg));
    tails.push(window.buildMusicTail(query,cfg.id));
  }
  // A transient transport message, never dbPut/saveAi/sendQuickText and never a Chat turn.
  hist.push({role:'user',content:tails.filter(Boolean).join('\n\n')+'\n\n【内部邀请事件，非用户聊天原话】\n'+EVENT});
  return {hist,sys:parts.filter(Boolean).join('\n\n')+'\n\n'+FORMAT,pa};
}
export async function requestInvitationReply(cfg,{signal}={}){
  if(!cfg?.apiKey||cfg._group)throw new Error('MISSING_INVITATION_API');
  const {hist,sys,pa}=await buildInvitationContext(cfg);
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  // Same endpoint/key/model/provider and Chat's request/error handling. One event, no auto-continuation.
  // Request-local options only; the user's saved configuration is never changed.
  const result=await window.callAI({...cfg,streaming:false,thinkingEnabled:false},hist,sys,()=>{},signal,{...pa,_noWS:true});
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  if(window._finTruncM(result.fin))throw new Error('TRUNCATED_INVITATION_REPLY');
  return parseInvitationReply(result.t);
}
