/* Room presentation only. Images and selection are committed together in IndexedDB. */
import {BACKGROUNDS,readBackground} from './ib-music-library.js';
const DB_NAME='IB_ListenBackground',STORE='settings',KEY='room',OPACITY_KEY='opacity';
const opacityValue=value=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(100,Math.round(value))):65;
let database=null;
function openDatabase(){
  if(!database)database=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();database=null};resolve(db)};
    request.onerror=()=>{database=null;reject(request.error)};
    request.onblocked=()=>{database=null;reject(new Error('Background storage blocked'))};
  });
  return database;
}
export async function readRoomBackground(){
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction(STORE,'readonly'),store=transaction.objectStore(STORE),request=store.get(KEY),opacity=store.get(OPACITY_KEY);
    transaction.oncomplete=()=>{let fallback='default';try{fallback=readBackground()}catch(e){}resolve({...request.result||{mode:fallback},opacity:opacityValue(opacity.result)})};
    transaction.onabort=()=>reject(transaction.error||new Error('Background read failed'));
  });
}
export async function writeRoomBackground(mode,image){
  if(mode!=='custom'&&!BACKGROUNDS.some(([id])=>id===mode))throw new Error('Unknown background');
  if(mode==='custom'&&!(image instanceof Blob))throw new Error('Missing image');
  const db=await openDatabase();
  await new Promise((resolve,reject)=>{
    const transaction=db.transaction(STORE,'readwrite');
    // One record replaces the prior image; default/presets also release persisted image data.
    transaction.objectStore(STORE).put({mode,image:mode==='custom'?new Blob([image],{type:image.type}):null,updatedAt:Date.now()},KEY);
    transaction.oncomplete=resolve;
    transaction.onabort=()=>reject(transaction.error||new Error('Background save failed'));
  });
  window.dispatchEvent(new Event('ib-listen-background-change'));
}
// A separate tiny record avoids rewriting the image Blob during slider movement.
export async function writeRoomOpacity(value){
  const db=await openDatabase();
  await new Promise((resolve,reject)=>{
    const transaction=db.transaction(STORE,'readwrite');
    transaction.objectStore(STORE).put(opacityValue(value),OPACITY_KEY);
    transaction.oncomplete=resolve;
    transaction.onabort=()=>reject(transaction.error||new Error('Opacity save failed'));
  });
}
async function validateImage(file){
  if(!file||!file.size)throw new Error('Empty image');
  const url=URL.createObjectURL(file);
  try{
    await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>image.naturalWidth&&image.naturalHeight?resolve():reject(new Error('Invalid image'));image.onerror=()=>reject(new Error('Unsupported image'));image.src=url});
  }finally{URL.revokeObjectURL(url)}
}
export function mountRoomBackground(player,background){
  let disposed=false,generation=0,imageUrl='',record={mode:'default',opacity:65},loaded=false,opacityTimer=null,pendingOpacity=null,previewOpacity=null,opacityWrites=Promise.resolve(),sliderSync=null;
  function release(){if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=''}
  function refresh(){
    if(disposed)return;
    const mode=record.mode;
    background.style.opacity=mode==='custom'?String(opacityValue(record.opacity)/100):'';
    if(player.dataset.tgBackground!==mode)player.dataset.tgBackground=mode;
    const picture=mode==='custom'&&imageUrl?'url("'+imageUrl+'")':mode==='cover'?player.querySelector('#ma-bg').style.backgroundImage:'';
    if(background.style.backgroundImage!==picture)background.style.backgroundImage=picture;
  }
  async function load(){
    const ticket=++generation;
    try{
      const next=await readRoomBackground();if(disposed||ticket!==generation)return;
      const url=next.mode==='custom'&&next.image instanceof Blob?URL.createObjectURL(next.image):'';
      release();imageUrl=url;record=url||next.mode!=='custom'?next:{mode:'default',opacity:next.opacity};if(previewOpacity!==null)record.opacity=previewOpacity;loaded=true;refresh();sliderSync?.();
    }catch(e){if(!disposed&&ticket===generation)window.toast?.('暂时无法读取房间背景，请重试')}
  }
  window.addEventListener('ib-listen-background-change',load);
  window.addEventListener('storage',load);load();
  function persistOpacity(){
    clearTimeout(opacityTimer);opacityTimer=null;
    if(pendingOpacity===null)return;
    const value=pendingOpacity;pendingOpacity=null;
    opacityWrites=opacityWrites.then(()=>writeRoomOpacity(value)).catch(()=>window.toast?.('未能保存背景透明度，请检查浏览器存储空间'));
  }
  function picker({open,button,close}){
    const card=open('房间背景'),status=document.createElement('p');status.setAttribute('role','status');
    const input=document.createElement('input');input.type='file';input.accept='image/*';input.hidden=true;input.className='tg-background-file';input.setAttribute('aria-label','选择房间背景图片');card.appendChild(input);
    let busy=false;
    function lock(value){busy=value;card.querySelectorAll('button,input[type=range]').forEach(b=>{b.disabled=value})}
    async function save(mode,image){
      if(busy)return;lock(true);status.textContent='正在保存背景…';
      try{
        if(mode==='custom')await validateImage(image);
        // The user may dismiss the picker or leave the room while the image decodes.
        if(disposed||!card.isConnected)return;
        await writeRoomBackground(mode,image);
        if(!disposed&&card.isConnected){window.toast?.(mode==='default'?'已恢复默认背景':'背景已更换');close()}
      }catch(e){if(!disposed&&card.isConnected)status.textContent=mode==='custom'?'未能保存图片。请确认图片可打开、浏览器存储空间充足，或尝试 JPEG / PNG 图片。':'未能保存背景，请检查浏览器存储空间'}
      finally{lock(false)}
    }
    // Keep file selection directly in the user gesture for iPhone Safari. No capture attribute.
    const choose=button(card,'更换背景',()=>{input.value='';input.click()});
    input.addEventListener('change',()=>{const file=input.files?.[0];if(file)save('custom',file)});
    const note=document.createElement('p');note.textContent='从相册或文件选择自己的图片；背景会保留在此浏览器中。';card.appendChild(note);
    const opacityRow=document.createElement('div');opacityRow.className='tg-background-opacity';
    const caption=document.createElement('label');caption.textContent='背景透明度';caption.htmlFor='tg-background-opacity';
    const amount=document.createElement('output'),slider=document.createElement('input');slider.type='range';slider.id='tg-background-opacity';slider.min='0';slider.max='100';slider.step='1';slider.setAttribute('aria-label','背景透明度');
    function syncSlider(){if(!card.isConnected)return;slider.value=String(opacityValue(record.opacity));amount.value=slider.value+'%';slider.disabled=!loaded||busy}
    opacityRow.append(caption,amount,slider);card.appendChild(opacityRow);sliderSync=syncSlider;syncSlider();
    slider.addEventListener('input',()=>{record.opacity=Number(slider.value);pendingOpacity=record.opacity;previewOpacity=record.opacity;amount.value=slider.value+'%';refresh();clearTimeout(opacityTimer);opacityTimer=setTimeout(persistOpacity,150)});
    slider.addEventListener('change',persistOpacity);
    button(card,'恢复默认背景',()=>save('default'));
    for(const [mode,label] of BACKGROUNDS.filter(([id])=>id!=='default')){const b=button(card,label,()=>save(mode));b.setAttribute('aria-pressed',String(record.mode===mode))}
    card.appendChild(status);button(card,'取消',close);choose.focus();
  }
  return {refresh,picker,dispose(){persistOpacity();sliderSync=null;disposed=true;++generation;window.removeEventListener('ib-listen-background-change',load);window.removeEventListener('storage',load);release()}};
}
