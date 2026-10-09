/* Internal response contract. Providers translate external formats before returning here. */
export const MAX_RESPONSE_LENGTH=800;
export function normalizeResponse(value){
  if(!value||typeof value.text!=='string'||!value.text.trim())throw new Error('EMPTY_RESPONSE');
  const chars=Array.from(value.text.replace(/\r\n?/g,'\n'));
  const text=chars.length>MAX_RESPONSE_LENGTH?chars.slice(0,MAX_RESPONSE_LENGTH-1).join('')+'…':chars.join('');
  return Object.freeze({text,mood:['calm','warm','happy'].includes(value.mood)?value.mood:'calm',type:'comment'});
}
export function createAiAdapter(provider){
  return {async respond(context,options){return normalizeResponse(await provider.respond(context,options))}};
}
export const MOCK_CASES=[
  ['short','很短的一句话'],['normal','正常 2–3 行'],['long','很长的一段'],
  ['emoji','带 emoji'],['punctuation','中文标点'],['newline','带换行'],
  ['loading','持续 loading'],['error','模拟错误'],['empty','无响应']
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
        const fixtures={
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
