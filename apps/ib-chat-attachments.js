/* Chat entry layout only. Move the original nodes, preserving their event handlers. */
(function(){
  const conv=document.getElementById('conv'),bar=conv.querySelector('.cv-input');
  const plus=document.getElementById('cv-plus'),input=document.getElementById('cv-ta');
  const panel=document.createElement('section');panel.id='cv-attachment-panel';panel.className='glass';panel.hidden=true;panel.setAttribute('aria-label','聊天附件');
  panel.innerHTML='<div class="cv-tools-heading"><span>聊天工具</span><small>语音输入请按住</small><button type="button" aria-label="收起附件">×</button></div><div class="cv-tools-grid"></div>';
  conv.insertBefore(panel,document.getElementById('cv-attach-strip'));
  const grid=panel.querySelector('.cv-tools-grid');
  plus.setAttribute('aria-controls',panel.id);plus.setAttribute('aria-expanded','false');
  function close(){panel.hidden=true;plus.setAttribute('aria-expanded','false')}
  function decorate(button,name,kind){
    if(button.dataset.chatTool)return;
    button.type='button';button.classList.add('cv-tool');button.dataset.chatTool=kind;
    const icon=document.createElement('span');icon.className='cv-tool-icon';icon.setAttribute('aria-hidden','true');
    const svg=button.querySelector('svg');if(svg)icon.appendChild(svg);
    const label=document.createElement('span');label.className='cv-tool-label';label.textContent=name;
    button.replaceChildren(icon,label);
  }
  function fileTool(name,kind,icon,run){
    const b=document.createElement('button');b.innerHTML='<svg viewBox="0 0 24 24">'+icon+'</svg>';decorate(b,name,kind);
    b.addEventListener('click',()=>{close();run()});grid.appendChild(b);return b;
  }
  fileTool('图片','image','<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 16 5-5 4 4 3-3 6 6"/>',()=>{
    if(_pendImgs.length>=4){toast('一次最多 4 张');return}document.getElementById('chat-img-file').click();
  });
  const files=fileTool('文件','file','<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',()=>{
    if(_pendFiles.length>=4){toast('一次最多 4 个文件');return}document.getElementById('chat-doc-file').click();
  });files.title='发送文件（文本类）';
  function moveOriginalTools(){
    const sticker=document.getElementById('cv-kao'),mic=document.getElementById('cv-mic');
    if(sticker){decorate(sticker,'表情包','sticker');sticker.setAttribute('aria-label','表情包与颜文字');if(sticker.parentNode!==grid)grid.insertBefore(sticker,mic?.parentNode===grid?mic:files)}
    if(mic){decorate(mic,'语音输入','voice');mic.setAttribute('aria-label','语音输入，按住说话');mic.title='按住说话，松开发送，上滑取消';if(mic.parentNode!==grid)grid.insertBefore(mic,files)}
  }
  moveOriginalTools();
  // The existing sticker pack may install its button after app initialization.
  new MutationObserver(moveOriginalTools).observe(bar,{childList:true});
  panel.addEventListener('click',event=>{
    if(event.target.closest('#cv-kao'))close();
  });
  panel.addEventListener('click',event=>{
    // Keep the original toggle handler; only choose its existing sticker tab first.
    if(event.target.closest('#cv-kao'))window._ibKaoPanel?.mode('stk');
  },true);
  panel.querySelector('.cv-tools-heading button').addEventListener('click',()=>{close();plus.focus()});
  const mic=document.getElementById('cv-mic');let recording=mic?.classList.contains('rec');
  if(mic)new MutationObserver(()=>{const next=mic.classList.contains('rec');if(recording&&!next)close();recording=next}).observe(mic,{attributes:true,attributeFilter:['class']});
  input.addEventListener('focus',close);input.addEventListener('pointerdown',close);
  conv.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();close();plus.focus()}});
  new MutationObserver(()=>{if(!conv.classList.contains('open')||conv.classList.contains('sel-mode'))close()}).observe(conv,{attributes:true,attributeFilter:['class']});
  const openConv=window.openConv;
  window.openConv=function(){close();return openConv.apply(this,arguments)};
  const viewport=window.visualViewport;let height=viewport?.height||0;
  viewport?.addEventListener('resize',()=>{if(viewport.height<height-80)close();height=viewport.height});
  window.IBChatAttachments={close,toggle(){
    if(!panel.hidden){close();return}
    const messages=document.getElementById('cv-msgs'),bottom=messages.scrollHeight-messages.scrollTop-messages.clientHeight<140;
    input.blur();window._ibKaoPanel?.close();moveOriginalTools();panel.hidden=false;plus.setAttribute('aria-expanded','true');
    if(bottom)requestAnimationFrame(()=>{messages.scrollTop=messages.scrollHeight});
  }};
})();
