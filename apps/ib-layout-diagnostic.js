/* Temporary, opt-in layout probe. No preference/storage writes or layout repairs. */
(function(){
  'use strict';
  if(window.IBLayoutDiagnostic)return;
  var panel=document.createElement('div');
  panel.id='ib-layout-diagnostic';
  panel.style.cssText='position:fixed;left:8px;right:8px;bottom:8px;width:auto;max-width:620px;max-height:45vh;margin:0 auto;z-index:2147483647;contain:layout style paint;';
  var shadow=panel.attachShadow({mode:'open'});
  shadow.innerHTML='<style>:host{color-scheme:light}*{box-sizing:border-box}section{background:#fff;color:#172033;border:1px solid #aaa;border-radius:12px;padding:10px;font:12px/1.5 system-ui}nav{display:flex;flex-wrap:wrap;gap:6px}button{font:inherit;padding:5px 9px}textarea{display:block;width:100%;height:20vh;margin-top:8px;resize:none;font:11px/1.4 monospace}p{margin:6px 0}</style><section><nav><button data-action="capture">采集当前布局</button><button data-action="copy">复制报告</button><button data-action="fold">收起</button><button data-action="close">关闭</button></nav><p>仅测量，不修复布局；报告不包含聊天、密钥或页面文字。</p><textarea readonly aria-label="布局诊断报告"></textarea></section>';
  document.body.appendChild(panel);
  var output=shadow.querySelector('textarea'),history=[],timers=[],stopped=false;
  function round(n){return Math.round(n*100)/100}
  function label(el){return el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(el.classList.length?'.'+Array.from(el.classList).slice(0,5).join('.'):'')+(el.dataset.dk?'[data-dk="'+el.dataset.dk+'"]':'')}
  function measure(el){
    var r=el.getBoundingClientRect(),s=getComputedStyle(el),clip=null;
    for(var a=el.parentElement;a&&a!==document.body&&a!==document.documentElement;a=a.parentElement){var cs=getComputedStyle(a);if(/^(auto|scroll|hidden|clip)$/.test(cs.overflowX)){clip=label(a);break}}
    return {element:label(el),rect:{left:round(r.left),right:round(r.right),top:round(r.top),bottom:round(r.bottom),width:round(r.width),height:round(r.height)},clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,offsetWidth:el.offsetWidth,scrollLeft:round(el.scrollLeft),clipAncestor:clip,css:{width:s.width,minWidth:s.minWidth,maxWidth:s.maxWidth,overflowX:s.overflowX,position:s.position,display:s.display,transform:s.transform,zoom:s.zoom,gridTemplateColumns:s.gridTemplateColumns,flexBasis:s.flexBasis}};
  }
  function capture(reason){
    if(stopped)return;
    var root=document.documentElement,vv=window.visualViewport;
    var elements=Array.from(document.querySelectorAll('body *')).filter(function(el){return el!==panel&&!panel.contains(el)&&el.getClientRects().length&&getComputedStyle(el).display!=='none'}).map(measure);
    var outside=elements.filter(function(e){return e.rect.left<-1||e.rect.right>root.clientWidth+1});
    var mp=typeof _mp==='object'&&_mp?_mp:{},desk=mp.desk||{},ui=mp.ui||{};
    var report={reason:reason,time:new Date().toISOString(),userAgent:navigator.userAgent,viewport:{innerWidth:window.innerWidth,innerHeight:window.innerHeight,clientWidth:root.clientWidth,scrollWidth:root.scrollWidth,scrollX:round(window.scrollX),visualViewport:vv?{width:round(vv.width),height:round(vv.height),scale:vv.scale,offsetLeft:vv.offsetLeft,pageLeft:vv.pageLeft}:null},root:measure(root),body:measure(document.body),widest10:elements.slice().sort(function(a,b){return Math.max(b.rect.width,b.scrollWidth)-Math.max(a.rect.width,a.scrollWidth)}).slice(0,10),outsideViewport10:outside.sort(function(a,b){return b.rect.right-a.rect.right}).slice(0,10),unclippedOutside10:outside.filter(function(e){return !e.clipAncestor}).sort(function(a,b){return b.rect.right-a.rect.right}).slice(0,10),layout:[],desk:{uiScale:ui.uiScale,deskLayout:ui.deskLayout,deskPages:ui.deskPages,fontScale:ui.fs,topScale:ui.szTop,dockScale:ui.szDock,items:Array.from(document.querySelectorAll('#sec-profile-cal .sb-desk>[data-dk]')).map(function(el){return {key:el.dataset.dk,order:el.style.order,page:Array.from(el.closest('.desk-pg')?.parentElement.children||[]).indexOf(el.closest('.desk-pg')),width:el.offsetWidth,height:el.offsetHeight,display:getComputedStyle(el).display}}),order:desk.order||[],hidden:desk.hidden||[],pages:desk.pages||{},installed:window.IBApps?IBApps.installed():[]}};
    ['#topbar','main','#page-profile','#sec-profile-cal','#dock','#dk-osw','#dk-dots2','#desk-pager','[data-dk="app:x:together"]','.desk-pg','.dk-osgrid'].forEach(function(selector){document.querySelectorAll(selector).forEach(function(el){var m=measure(el);if(el.id==='dk-osw'){m.pageCount=el.children.length;m.intendedPage=el._pg;m.gridScale=el._dkk}report.layout.push(m)})});
    history.push(report);if(history.length>8)history.shift();
    output.value=JSON.stringify({diagnosticVersion:1,snapshots:history},null,2);
    console.log('[IB layout diagnostic]',report);
    return report;
  }
  function close(){stopped=true;timers.forEach(clearTimeout);panel.remove();window.removeEventListener('resize',onResize);if(window.visualViewport)window.visualViewport.removeEventListener('resize',onResize);delete window.IBLayoutDiagnostic}
  function onResize(){capture('viewport resize')}
  shadow.addEventListener('click',async function(event){var action=event.target.dataset.action;if(action==='capture')capture('manual');if(action==='close')close();if(action==='fold'){output.hidden=!output.hidden;output.style.display=output.hidden?'none':'block';event.target.textContent=output.hidden?'展开':'收起'}if(action==='copy'){try{await navigator.clipboard.writeText(output.value);event.target.textContent='已复制'}catch(e){output.hidden=false;output.style.display='block';output.focus();output.select();event.target.textContent='请长按报告全选复制'}}});
  window.IBLayoutDiagnostic={capture:function(){return capture('console')},close:close};
  window.addEventListener('resize',onResize);if(window.visualViewport)window.visualViewport.addEventListener('resize',onResize);
  [0,1000,3000,8000].forEach(function(delay){timers.push(setTimeout(function(){capture('startup '+delay+'ms')},delay))});
})();
