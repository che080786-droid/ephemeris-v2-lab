/* Safari chrome hint and root/safe-area paint, owned only while the Listen room is open. */
const ATTRIBUTE='data-ib-together-chrome',COLORS={light:'#efeeeb',dark:'#171717'};
export function mountTogetherBrowserChrome(player){
  const root=document.documentElement;
  let active=false,disposed=false,meta=null,temporary=false,nativeContent=null,nativeAttribute=null,color='';
  const observer=new MutationObserver(()=>{
    if(!active)return;
    const current=meta.getAttribute('content');
    // Preserve native IB theme/PWA updates made while the room owns the visible chrome.
    if(current!==color){nativeContent=current;meta.setAttribute('content',color)}
  });
  function restore(){
    if(!active)return;
    const current=meta.getAttribute('content');if(current!==color)nativeContent=current;
    observer.disconnect();active=false;
    if(temporary)meta.remove();else if(nativeContent===null)meta.removeAttribute('content');else meta.setAttribute('content',nativeContent);
    if(nativeAttribute===null)root.removeAttribute(ATTRIBUTE);else root.setAttribute(ATTRIBUTE,nativeAttribute);
    meta=null;color='';
  }
  function sync(){
    if(disposed)return;
    if(!player.classList.contains('open')||!player.classList.contains('tg-listen')){restore();return}
    const scheme=player.dataset.tgTheme==='dark'?'dark':'light',nextColor=COLORS[scheme];
    if(!active){
      meta=document.querySelector('meta[name="theme-color"]');temporary=!meta;
      if(!meta){meta=document.createElement('meta');meta.name='theme-color';document.head.appendChild(meta)}
      nativeContent=meta.getAttribute('content');nativeAttribute=root.getAttribute(ATTRIBUTE);active=true;
      observer.observe(meta,{attributes:true,attributeFilter:['content']});
    }else{
      const current=meta.getAttribute('content');if(current!==color)nativeContent=current;
    }
    color=nextColor;
    if(meta.getAttribute('content')!==color)meta.setAttribute('content',color);
    if(root.getAttribute(ATTRIBUTE)!==scheme)root.setAttribute(ATTRIBUTE,scheme);
  }
  return {sync,dispose(){restore();disposed=true;observer.disconnect()}};
}
