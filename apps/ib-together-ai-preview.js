import {createAiAdapter,mockProvider,MOCK_CASES,MAX_RESPONSE_LENGTH} from './ib-together-ai-adapter.js';

function readContext(player){
  const state=typeof _pw==='undefined'?null:_pw;
  const track=state?.list?.[state.idx];
  return {
    songTitle:track?.title||track?.name||'',artist:track?.artist||'',
    currentLyric:player.querySelector('.ma-ln.on')?.textContent||'',
    currentTime:Number.isFinite(state?.a?.currentTime)?state.a.currentTime:0,
    // Native pairing is a selected companion, not a verified live network connection.
    connected:!!player.querySelector('#ma-duo .ma-duo2'),connectionKind:'native-companion-selected'
  };
}
export function mountAiPreview(player){
  const adapter=createAiAdapter(mockProvider);
  const card=document.createElement('section');card.className='tg-ai-preview';card.setAttribute('aria-label','晏景回应格式预演');
  card.innerHTML='<header><strong>晏景的话</strong><small>MOCK · 无 AI 请求</small></header>'
    +'<div class="tg-ai-tools"><label>模拟回复 <select aria-label="模拟回复类型"></select></label><button type="button">重试 / 刷新上下文</button></div>'
    +'<div class="tg-ai-response" role="status" aria-live="polite" aria-atomic="true" tabindex="0" aria-label="晏景回应，可滚动"></div>'
    +'<small class="tg-ai-meta"></small><details><summary>播放上下文快照（只读）</summary><pre></pre></details>';
  const select=card.querySelector('select'),response=card.querySelector('.tg-ai-response'),meta=card.querySelector('.tg-ai-meta');
  for(const [value,label] of MOCK_CASES){const option=document.createElement('option');option.value=value;option.textContent=label;select.appendChild(option)}
  const footer=player.querySelector('.ma-foot');
  if(footer)footer.insertAdjacentElement('beforebegin',card);else player.appendChild(card);
  let controller=null,disposed=false;
  async function preview(){
    controller?.abort();controller=new AbortController();const signal=controller.signal;
    const context=readContext(player);
    card.querySelector('pre').textContent=JSON.stringify(context,null,2);
    card.dataset.state='loading';response.setAttribute('aria-busy','true');response.textContent='晏景的回应加载中…（模拟）';response.scrollTop=0;
    meta.textContent='仅预演；切换类型可取消等待。';
    try{
      const result=await adapter.respond(context,{scenario:select.value,signal});
      if(disposed||signal.aborted)return;
      card.dataset.state='ready';response.textContent=result.text;
      meta.textContent=result.mood+' · '+result.type+' · '+Array.from(result.text).length+'/'+MAX_RESPONSE_LENGTH+' 字符';
    }catch(e){
      if(disposed||signal.aborted)return;
      card.dataset.state='error';response.textContent=e.message==='EMPTY_RESPONSE'?'暂时没有收到回应。（模拟无响应）':'回应暂时无法显示。（模拟错误）';
      meta.textContent='可以点击重试，或切换其他模拟回复。';
    }finally{if(!disposed&&!signal.aborted)response.setAttribute('aria-busy','false')}
  }
  select.addEventListener('change',preview);card.querySelector('button').addEventListener('click',preview);preview();
  return ()=>{disposed=true;controller?.abort();card.remove()};
}
