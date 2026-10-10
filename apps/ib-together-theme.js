/* Neutral room foregrounds only; no playback or application-wide theme changes. */
const KEY='ib_listen_theme_v1',MODES=[['auto','自动'],['light','浅色'],['dark','深色']];
const valid=value=>MODES.some(([mode])=>mode===value)?value:'auto';
function readMode(){try{return valid(localStorage.getItem(KEY))}catch(e){return 'auto'}}
const samples=new Map();
function imageBrightness(url){
  if(!samples.has(url)){
    if(samples.size>=16)samples.delete(samples.keys().next().value);
    samples.set(url,new Promise(resolve=>{
      const image=new Image();image.crossOrigin='anonymous';let settled=false;
      const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value)};
      const timer=setTimeout(()=>finish(null),2500);
      image.onerror=()=>finish(null);
      image.onload=()=>{
        try{
          const canvas=document.createElement('canvas');canvas.width=24;canvas.height=24;
          const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,24,24);
          const pixels=ctx.getImageData(0,0,24,24).data;let brightness=0,alpha=0;
          for(let i=0;i<pixels.length;i+=4){const a=pixels[i+3]/255;brightness+=(.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2])/255*a;alpha+=a}
          finish({brightness:brightness/576,alpha:alpha/576});
        }catch(e){finish(null)}
      };image.src=url;
    }));
  }
  return samples.get(url);
}
function imageUrl(element){const value=element?getComputedStyle(element).backgroundImage:'';return /^url\(["']?(.*?)["']?\)$/.exec(value)?.[1]||''}
export function mountTogetherTheme(player,background){
  let disposed=false,sequence=0,signature='',mode=readMode(),pickerSync=null;
  function apply(value){if(!disposed&&player.dataset.tgTheme!==value)player.dataset.tgTheme=value}
  async function refresh(){
    if(disposed)return;
    const globalDark=document.body.classList.contains('theme-infernal'),base=globalDark?.09:.94;
    const kind=player.dataset.tgBackground||'default';
    const photo=kind==='custom'||kind==='cover'?background:kind==='default'?(player.classList.contains('has-cover')?player.querySelector('#ma-bg'):player.querySelector('.ma-wall')):null;
    const url=imageUrl(photo),opacity=photo?Number(getComputedStyle(photo).opacity):0;
    const next=[mode,kind,url,opacity,globalDark].join('|');if(next===signature)return;signature=next;const ticket=++sequence;
    if(mode!=='auto'){apply(mode);return}
    // Presets follow the native light/dark background; image opacity is composited over that base.
    const sample=url?await imageBrightness(url):null;if(disposed||ticket!==sequence)return;
    const brightness=sample?sample.brightness*opacity+base*(1-sample.alpha*opacity):base;
    apply(brightness>=.5?'light':'dark');
  }
  const playerObserver=new MutationObserver(refresh);playerObserver.observe(player,{attributes:true,attributeFilter:['class']});
  const bodyObserver=new MutationObserver(refresh);bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
  const storage=event=>{if(event.key===KEY){mode=readMode();refresh();pickerSync?.()}};
  window.addEventListener('storage',storage);refresh();
  function picker(card){
    const label=document.createElement('label');label.className='tg-theme-setting';label.textContent='显示模式';
    const select=document.createElement('select');select.setAttribute('aria-label','Together 显示模式');
    for(const [value,text] of MODES){const option=document.createElement('option');option.value=value;option.textContent=text;select.appendChild(option)}
    label.appendChild(select);card.appendChild(label);select.value=mode;pickerSync=()=>{if(card.isConnected)select.value=mode};
    select.addEventListener('change',()=>{
      const next=valid(select.value);
      try{localStorage.setItem(KEY,next);mode=next;refresh()}catch(e){select.value=mode;window.toast?.('未能保存显示模式，请检查浏览器存储空间')}
    });
  }
  return {refresh,picker,dispose(){disposed=true;++sequence;bodyObserver.disconnect();playerObserver.disconnect();window.removeEventListener('storage',storage);pickerSync=null;delete player.dataset.tgTheme}};
}
