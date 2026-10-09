/* Together · SDK 2 entry room. Reuses the native activities without storing data. */
(function(){
  'use strict';
  if(!window.IBApps)return;
  var icon='<circle cx="9" cy="8.4" r="3.5"/><path d="M3.6 19.6a5.4 5.4 0 0 1 10.8 0"/><path d="M15.4 5.7a3.5 3.5 0 0 1 0 5.4"/><path d="M16.6 14.4a5.4 5.4 0 0 1 3.6 5.2"/>';
  var activities=[
    {id:'listen',title:'Listen Together',name:'一起听',text:'选一首歌，把这一刻留给旋律。',icon:'<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'},
    {id:'read',title:'Read Together',name:'一起读',text:'翻开一页，慢慢聊书里的故事。',icon:'<path d="M12 6.6c-1.7-1.4-3.9-2.1-6.6-2.1v13c2.7 0 4.9.7 6.6 2.1 1.7-1.4 3.9-2.1 6.6-2.1v-13c-2.7 0-4.9.7-6.6 2.1z"/><path d="M12 6.6v13"/>'},
    {id:'watch',title:'Watch Together',name:'一起看',text:'选一段视频，一起走进画面里的世界。',icon:'<rect x="3.5" y="6" width="17" height="12" rx="2.5"/><path d="M3.5 9.5h17M7.5 6v12M16.5 6v12"/><path d="M10.8 11v4l3.4-2z"/>'}
  ];
  IBApps.register({
    id:'together',name:'Together / 一起',version:'1.0.0',sdk:2,builtin:true,wall:true,icon:icon,
    mount:function(host,ctx){
      var style=document.createElement('style');
      style.textContent='.ib-together{max-width:640px;margin:0 auto;padding:16px 2px 8px;color:var(--o2tx);overflow-wrap:anywhere}.ib-together h1{font:600 clamp(2rem,9vw,3rem)/1.15 var(--serif);margin:8px 0 14px}.ib-together .tg-intro{font-size:.88rem;line-height:1.9;color:var(--o2tx2);margin:0 0 28px}.ib-together .tg-kicker{font-size:.7rem;letter-spacing:.18em;color:var(--o2acc)}.ib-together .tg-card{display:block;width:100%;box-sizing:border-box;text-align:left;margin:0 0 16px;padding:22px 20px;cursor:pointer;font:inherit;color:var(--o2tx);-webkit-tap-highlight-color:transparent}.ib-together .tg-top{display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--o2acc);font-size:.7rem;letter-spacing:.12em}.ib-together svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;flex:none}.ib-together .tg-title{display:block;font:600 clamp(1.3rem,6vw,1.7rem)/1.35 var(--serif);margin:15px 0 4px}.ib-together .tg-name{display:block;font-size:.95rem}.ib-together .tg-text{display:block;margin-top:12px;font-size:.8rem;line-height:1.8;color:var(--o2tx2)}.ib-together .tg-card:focus-visible{outline:2px solid var(--o2acc);outline-offset:3px}.ib-together .tg-card:active{border-color:var(--o2acc)}';
      host.appendChild(style);
      var room=document.createElement('section');room.className='ib-together';room.setAttribute('aria-label','Together / 一起');
      room.innerHTML='<div class="tg-kicker">A LITTLE TIME TOGETHER</div><h1>Together</h1><p class="tg-intro">一起听、一起读、一起看。<br>给日常留一点共同的时间。</p>';
      activities.forEach(function(a,i){
        var button=document.createElement('button');button.type='button';button.className='ov2-card tg-card';button.dataset.activity=a.id;
        button.innerHTML='<span class="tg-top"><span>0'+(i+1)+' / '+a.id.toUpperCase()+'</span><svg viewBox="0 0 24 24" aria-hidden="true">'+a.icon+'</svg></span><span class="tg-title">'+a.title+'</span><span class="tg-name">'+a.name+'</span><span class="tg-text">'+a.text+'</span>';
        button.addEventListener('click',async function(){
          if(a.id==='listen'){
            // The SDK has no music opener; use the existing public native entry.
            if(typeof window.openMusicApp!=='function'){ctx.ui.toast('音乐入口尚未就绪，请稍后再试');return;}
            button.disabled=true;
            try{await window.openMusicApp();IBApps.close('together');}
            catch(e){button.disabled=false;ctx.ui.toast('暂时无法打开音乐，请稍后再试');}
            return;
          }
          var target=a.id==='read'?'coread':'cinema';
          IBApps.close('together');
          if(IBApps.installed().indexOf(target)!==-1&&IBApps.open(target))return;
          // Keep the native install/loading/missing-file flow and its controls.
          IBApps.openStore();
          ctx.ui.toast(target==='cinema'?'请在应用中启用或打开「观影室」':'请在应用中打开「共读间」');
        });
        room.appendChild(button);
      });
      host.appendChild(room);
    }
  });
})();
