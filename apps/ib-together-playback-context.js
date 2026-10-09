/* Temporary routing to the native local player. No auth state or storage writes. */
let context=null;
export const currentPublicContext=()=>context?.mode||null;
function nativeMode(){return window._ncmOn?.()?'ncm':(window._qqmOn?.()?'qqm':'local')}
function changed(){window.dispatchEvent(new Event('ib-together-public-context'))}
export function restorePlaybackContext(restoreAudio=true){
  if(!context)return;
  const saved=context;context=null;
  saved.audio.removeEventListener('ended',saved.ended,true);
  for(const [name,wrapper] of Object.entries(saved.wrappers))if(window[name]===wrapper)window[name]=saved.original[name];
  saved.audio.pause();
  // A user-selected native source/queue takes precedence over the saved scene.
  if(restoreAudio&&nativeMode()===saved.mode){
    _pw.list=saved.list;_pw.idx=saved.src?Math.min(saved.index,saved.list.length-1):-1;
    if(saved.src)saved.audio.src=saved.src;else saved.audio.removeAttribute('src');
    saved.audio.load();
    if(saved.src){const seek=()=>{if(!context&&saved.audio.src===saved.src)try{saved.audio.currentTime=saved.time}catch(e){}};saved.audio.addEventListener('loadedmetadata',seek,{once:true})}
    _pwPaint();_pwListDraw();window._maRefreshMusicM?.();
  }
  changed();
}
export function beginPublicPlayback(){
  if(context)return;
  const mode=nativeMode();if(mode==='local')return;
  const local=window.IBMusicLocalPath;if(!local)throw new Error('本地播放入口尚未就绪');
  const audio=_pwA();
  const saved={mode,audio,list:_pw.list,index:_pw.idx,src:audio.getAttribute('src')||'',time:audio.currentTime||0,original:{},wrappers:{}};
  const methods={_pwLoad:'load',_pwPlayIdx:'play',_pwListDraw:'draw',_pwAddFiles:'addFiles'};
  for(const [name,method] of Object.entries(methods)){
    saved.original[name]=window[name];
    const wrapper=function(...args){
      const authQueue=_pw.list===window._ncm?.q||_pw.list===window._qqm?.q;
      if(context&&(nativeMode()!==saved.mode||authQueue)){restorePlaybackContext(false)}
      return (context?local[method]:saved.original[name]).apply(this,args);
    };
    saved.wrappers[name]=wrapper;window[name]=wrapper;
  }
  saved.ended=function(event){
    if(context!==saved)return;
    // Restore before the native loop/next handler can replay the public/local queue.
    event.stopImmediatePropagation();restorePlaybackContext();
  };
  context=saved;audio.addEventListener('ended',saved.ended,true);
  // Clear only the shared playback scene, leaving native source mode and queues intact.
  audio.pause();audio.removeAttribute('src');audio.load();_pw.list=[];_pw.idx=-1;
  changed();
}
