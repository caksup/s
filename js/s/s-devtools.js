/* #30 | /root/js/s/s-devtools.js | v 1.5 | u 21/09/2026 • 14:30:00 | xu : ke-6 | note : #noteresponse
- v1.4 -> v1.5 (ERUDA PERSIST + INJECT SCRIPT + TREE PATH UPDATE):
  * ERUDA (menu paling depan + persist saat refresh):
    - Tool 'eruda' dipindah ke POSISI PERTAMA dalam bar tools.
    - localStorage key 'sdt_eruda' menyimpan state Eruda (aktif/tidak).
    - Saat halaman reload dengan ?devtools, Eruda auto-inject & show bila
      flag true. Tombol toggle Eruda di panel akan update flag tsb.
    - Eruda dimuat dari CDN jsdelivr (fallback unpkg bila gagal).
  * INJECT SCRIPT (di menu Console):
    - Tombol baru "Inject" di atas daftar log.
    - Prompt multiline untuk kode JS -> jalankan via new Function() dengan
      try/catch; tampilkan hasil atau error di result.
    - Shortcut: 5 inject preset (PS dump, FLS dump, window globals count,
      clear all listeners via clone node, reload dengan cache bust).
  * TREE PATH UPDATE (devlive + cek JS + integration):
    - STUDENT_FILES diperluas mencakup SEMUA file siswa dari tree path
      baseline 21/09/2026: css/g/s/brand, js/fc*, hash, modal, rwmonitor,
      js/s/* (state/login/dashboard/test/result/feedback/profile/info/
      nilai/riwayat/homework/realtime/s-rt-lobby-vocab/s-rt-render/
      s-rt-session/s-devtools), js/fl/* (fl-student/full-materi/ex-materi/
      fun-learn/fl-connect/fl-dnd/fl-tf/fl-testaccount).
    - Cek JS (tJs): cek 28 globals (firebase,db,dbMateri,hashPin,verifyPin,
      M,toast,PS,RT,FLS,FLST,FLMAT,FLEX,FLFUN,FLGAMES,FLCONN,FLDND,FLTF,
      FLTEST,loadDashboard,loadSessions,startSession,answerPGS,submitTest,
      showResult,reviewAnswers,openFeedback,openProfile).
    - Integration (tIntegration): 17 file (termasuk brand.css, rwmonitor.js,
      fl-student.js, full-materi.js, ex-materi.js, fun-learn.js, 3 game
      files, fl-testaccount.js).
  * STATE TETAP IDENTIK v1.4: 3 boolean (open, fullscreen, minimized),
    FAB draggable instagram gradient, header gradient, hacker body.
- EXPOSE: window.DT */

(function(){
'use strict';
if (!new URLSearchParams(location.search).has('devtools')) return;

var HK = {
  bg:'#050805', bg2:'#0a0f0a', bg3:'#001a00',
  line:'#00ff4133', line2:'#00ff4155',
  fg:'#00ff41', fgDim:'#00b32d', fgSoft:'#00ff4122',
  accent:'#39ff14', bad:'#ff3b3b', warn:'#ffb000',
  ig:'linear-gradient(45deg,#405DE6,#833AB4,#C13584,#E1306C,#FD1D1D,#F56040,#F77737,#FCAF45)'
};

// ===== TREE PATH LENGKAP (baseline 21/09/2026 13:59:53) =====
var STUDENT_FILES = [
  'sp.html',
  'css/g.css','css/s.css','css/brand.css',
  'js/fc.js','js/fc-materi.js','js/hash.js','js/modal.js','js/rwmonitor.js',
  'js/s/state.js','js/s/login.js','js/s/dashboard.js','js/s/test.js',
  'js/s/result.js','js/s/feedback.js','js/s/profile.js','js/s/info.js',
  'js/s/nilai.js','js/s/riwayat.js','js/s/homework.js','js/s/realtime.js',
  'js/s/s-rt-lobby-vocab.js','js/s/s-rt-render.js','js/s/s-rt-session.js',
  'js/s/s-devtools.js',
  'js/fl/fl-student.js','js/fl/full-materi.js','js/fl/ex-materi.js',
  'js/fl/fun-learn.js','js/fl/fl-connect.js','js/fl/fl-dnd.js',
  'js/fl/fl-tf.js','js/fl/fl-testaccount.js'
];

var DT = {
  open:false, fullscreen:false, minimized:false,
  logs:[], _cap:false, _lastResultShown:false,
  pos:{x:null,y:null}, lastAuto:null, clockInterval:null,
  devliveFiles: STUDENT_FILES.slice(), devliveData: [],

  init:function(){
    this.injectCSS();
    this.captureLogs();
    this.loadPos();
    this.buildFab();
    this.buildPanel();
    this.startClock();
    this.maybeRestoreEruda();
    var s=this; setTimeout(function(){ s.autoScan(true); },1200);
  },

  injectCSS:function(){
    if (document.getElementById('sdt-theme')) return;
    var st=document.createElement('style'); st.id='sdt-theme';
    st.textContent=[
      '@keyframes sdtIg{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}',
      '#adt-fab{background:'+HK.ig+' !important;background-size:300% 300% !important;animation:sdtIg 6s ease infinite !important;border:1px solid rgba(255,255,255,.5) !important;box-shadow:0 4px 18px rgba(195,53,132,.6) !important;}',
      '#adt-fab .material-icons{color:#fff !important;text-shadow:0 1px 3px rgba(0,0,0,.4);}',
      '#adt-panel{background:'+HK.bg+' !important;border:1px solid '+HK.line2+' !important;font-family:"Courier New",ui-monospace,monospace !important;box-shadow:0 0 24px '+HK.line+', inset 0 0 60px #00ff4108 !important;}',
      '#adt-header{background:'+HK.ig+' !important;background-size:300% 300% !important;animation:sdtIg 8s ease infinite !important;border-bottom:1px solid rgba(255,255,255,.3) !important;color:#fff !important;}',
      '#adt-header > span:first-child{color:#fff !important;text-shadow:0 1px 3px rgba(0,0,0,.5);}',
      '#adt-header > span:first-child .material-icons{color:#fff !important;}',
      '#adt-header button[id]{background:rgba(255,255,255,.25) !important;border:1px solid rgba(255,255,255,.4) !important;color:#fff !important;}',
      '#adt-header button[id]:hover{background:rgba(255,255,255,.45) !important;}',
      '#adt-header button[id] .material-icons{color:#fff !important;}',
      '#adt-tools{background:'+HK.bg2+' !important;border-bottom:1px solid '+HK.line+' !important;}',
      '#adt-tools button{background:#0a140a !important;border:1px solid '+HK.line+' !important;}',
      '#adt-tools button:hover{background:'+HK.fgSoft+' !important;border-color:'+HK.fg+' !important;}',
      '#adt-tools button .material-icons{color:'+HK.fg+' !important;}',
      '#adt-tools button span:last-child{color:'+HK.fg+' !important;}',
      '#adt-tools button.eruda-on{background:'+HK.accent+' !important;border-color:'+HK.accent+' !important;}',
      '#adt-tools button.eruda-on .material-icons,#adt-tools button.eruda-on span:last-child{color:#000 !important;}',
      '#adt-result{background:'+HK.bg+' !important;}',
      '#adt-result pre{background:#000 !important;color:'+HK.fg+' !important;border:1px solid '+HK.line+' !important;text-shadow:0 0 4px '+HK.line+';}',
      '#adt-result table{background:transparent !important;}',
      '#adt-result thead tr{background:'+HK.bg3+' !important;}',
      '#adt-result th{background:'+HK.bg3+' !important;color:'+HK.fg+' !important;border-bottom:1px solid '+HK.line2+' !important;}',
      '#adt-result td{background:transparent !important;color:'+HK.fgDim+' !important;border-bottom:1px solid '+HK.line+' !important;}',
      '#adt-result td b,#adt-result td strong{color:'+HK.fg+' !important;}',
      '#adt-result tr:hover td{background:'+HK.fgSoft+' !important;}',
      '#adt-result input,#adt-result select,#adt-result textarea{background:#000 !important;color:'+HK.fg+' !important;border:1px solid '+HK.line2+' !important;font-family:monospace !important;}',
      '#adt-copy{background:'+HK.bg3+' !important;color:'+HK.fg+' !important;border:1px solid '+HK.line2+' !important;}',
      '#adt-copy:hover{background:'+HK.fg+' !important;color:#000 !important;}',
      '#adt-badge{background:'+HK.accent+' !important;color:#000 !important;border-color:'+HK.bg+' !important;}',
      '#adt-result::-webkit-scrollbar,#adt-tools::-webkit-scrollbar{width:6px;height:6px;}',
      '#adt-result::-webkit-scrollbar-thumb,#adt-tools::-webkit-scrollbar-thumb{background:'+HK.fgDim+';border-radius:3px;}',
      '#adt-result::-webkit-scrollbar-track,#adt-tools::-webkit-scrollbar-track{background:'+HK.bg2+';}',
      '.sdt-preset{padding:3px 6px;margin:2px;font-size:8px;font-weight:700;background:'+HK.bg3+' !important;color:'+HK.fg+' !important;border:1px solid '+HK.line+' !important;border-radius:4px;cursor:pointer;}',
      '.sdt-preset:hover{background:'+HK.fg+' !important;color:#000 !important;}'
    ].join('\n');
    document.head.appendChild(st);
  },

  loadPos:function(){ try{ var p=JSON.parse(localStorage.getItem('sdt_pos')); if(p) this.pos=p; }catch(e){} if(!this.pos.x) this.pos={x:innerWidth-62,y:innerHeight-62}; },
  savePos:function(){ try{ localStorage.setItem('sdt_pos',JSON.stringify(this.pos)); }catch(e){} },

  startClock:function(){
    if(this.clockInterval) clearInterval(this.clockInterval);
    var upd=function(){ var el=document.getElementById('devlive-clock'); if(el){ var n=new Date(); var p=function(x){return String(x).padStart(2,'0');}; el.textContent=p(n.getHours())+':'+p(n.getMinutes())+':'+p(n.getSeconds()); } };
    upd(); this.clockInterval=setInterval(upd,1000);
  },

  mp:function(title,def){
    if (window.M && typeof window.M.prompt==='function') return window.M.prompt(title,{defaultValue:(def===undefined||def===null)?'':String(def)});
    return window.prompt(title,(def===undefined||def===null)?'':String(def));
  },

  // ===== ERUDA PERSIST =====
  isErudaActive:function(){ try{return localStorage.getItem('sdt_eruda')==='1';}catch(e){return false;} },
  setErudaActive:function(v){ try{localStorage.setItem('sdt_eruda',v?'1':'0');}catch(e){} this.updateErudaBtn(); },
  updateErudaBtn:function(){
    var b=document.querySelector('[data-tool="eruda"]'); if(!b) return;
    var on = (window.eruda && typeof eruda.show==='function') || this.isErudaActive();
    b.classList.toggle('eruda-on', on);
  },
  maybeRestoreEruda:function(){
    if(!this.isErudaActive()) return;
    var self=this;
    var load=function(cdn){
      var s=document.createElement('script'); s.src=cdn;
      s.onload=function(){ try{ eruda.init({tool:['console','elements','network','storage','info','resources']}); eruda.show(); self.updateErudaBtn(); }catch(e){} };
      s.onerror=function(){ if(cdn.indexOf('jsdelivr')>-1) load('https://unpkg.com/eruda'); };
      document.head.appendChild(s);
    };
    if(window.eruda){ try{eruda.show();self.updateErudaBtn();}catch(e){} return; }
    load('https://cdn.jsdelivr.net/npm/eruda');
  },

  buildFab:function(){
    var fab=document.createElement('div'); fab.id='adt-fab';
    fab.innerHTML='<span class="material-icons" style="font-size:24px;color:#fff;">school</span>';
    fab.style.cssText='position:fixed;width:48px;height:48px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;z-index:2147483640;cursor:grab;user-select:none;touch-action:none;transition:box-shadow .2s;';
    fab.style.left=this.pos.x+'px'; fab.style.top=this.pos.y+'px';
    var b=document.createElement('span'); b.id='adt-badge';
    b.style.cssText='position:absolute;top:-4px;right:-4px;background:'+HK.accent+';color:#000;border-radius:10px;font-size:9px;padding:1px 5px;font-weight:800;border:1.5px solid '+HK.bg+';pointer-events:none;';
    b.textContent='…'; fab.appendChild(b);
    var self=this; var dr=false,mv=false,sx,sy,ox,oy;
    var st=function(e){ dr=true;mv=false; var t=e.touches?e.touches[0]:e; sx=t.clientX;sy=t.clientY; ox=fab.offsetLeft;oy=fab.offsetTop; };
    var mo=function(e){ if(!dr)return; e.preventDefault(); var t=e.touches?e.touches[0]:e; var dx=t.clientX-sx,dy=t.clientY-sy; if(Math.abs(dx)>4||Math.abs(dy)>4)mv=true; var nx=Math.max(0,Math.min(ox+dx,innerWidth-48)),ny=Math.max(0,Math.min(oy+dy,innerHeight-48)); fab.style.left=nx+'px'; fab.style.top=ny+'px'; };
    var en=function(){ if(!dr)return; dr=false; self.pos={x:fab.offsetLeft,y:fab.offsetTop}; self.savePos(); if(!mv) self.toggle(); };
    fab.addEventListener('mousedown',st); fab.addEventListener('touchstart',st,{passive:false});
    document.addEventListener('mousemove',mo); document.addEventListener('touchmove',mo,{passive:false});
    document.addEventListener('mouseup',en); document.addEventListener('touchend',en);
    document.body.appendChild(fab);
  },

  buildPanel:function(){
    var self=this;
    var p=document.createElement('div'); p.id='adt-panel';
    p.style.cssText='position:fixed;left:8px;right:8px;bottom:80px;top:50%;max-height:60vh;border-radius:12px;z-index:2147483641;display:none;flex-direction:column;overflow:hidden;font-family:"Courier New",ui-monospace,monospace;';

    var hb=function(id,icon,title){
      return '<button type="button" id="'+id+'" title="'+title+'" style="cursor:pointer;padding:4px 8px;border-radius:5px;display:flex;align-items:center;justify-content:center;min-width:32px;height:32px;"><span class="material-icons" style="font-size:18px;">'+icon+'</span></button>';
    };

    var h='<div id="adt-header" style="padding:10px 14px;display:flex;justify-content:space-between;align-items:center;cursor:move;user-select:none;">';
    h+='<span style="font-size:13px;font-weight:800;display:flex;align-items:center;gap:6px;"><span class="material-icons" style="font-size:18px;">school</span> DevTools Siswa <small style="opacity:.85;font-weight:500;">v1.5</small></span>';
    h+='<div style="display:flex;gap:6px;">';
    h+=hb('adt-togglemm','minimize','Minimize / Maximize');
    h+=hb('adt-togglefs','fullscreen','Fullscreen');
    h+='</div></div>';

    // ===== TOOLS: ERUDA DI POSISI PERTAMA =====
    h+='<div id="adt-tools" style="overflow-x:auto;white-space:nowrap;padding:8px 10px;scrollbar-width:none;-webkit-overflow-scrolling:touch;">';
    h+='<div style="display:inline-flex;gap:6px;">';
    var tools=[
      ['eruda','bug_report','Eruda'],
      ['devlive','sensors','DevLive'],['history','history','Riwayat'],['jscheck','code','Cek JS'],
      ['logs','terminal','Console'],['integration','link','Integration'],['fbcheck','cloud','Firebase'],
      ['state','person','State'],['fsquery','search','Query FS'],['lsinspect','folder','Storage'],
      ['cookies','cookie','Cookies'],['network','wifi','Network'],['dom','account_tree','DOM'],
      ['performance','speed','Perf'],['screen','devices','Screen'],
      ['pinhash','lock','Hash PIN'],['clearcache','cleaning_services','Cache'],['clearls','delete_sweep','Data'],['reload','refresh','Reload']
    ];
    tools.forEach(function(t){
      h+='<button type="button" data-tool="'+t[0]+'" title="'+t[2]+'" style="flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 10px;border-radius:8px;cursor:pointer;min-width:56px;transition:all .15s;">';
      h+='<span class="material-icons" style="font-size:20px;">'+t[1]+'</span>';
      h+='<span style="font-size:9px;font-weight:700;white-space:nowrap;">'+t[2]+'</span></button>';
    });
    h+='</div></div>';

    // RESULT
    h+='<div id="adt-result" style="flex:1;overflow-y:auto;padding:10px;display:none;">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
    h+='<span style="font-size:10px;font-weight:800;color:'+HK.fgDim+';display:flex;align-items:center;gap:3px;"><span class="material-icons" style="font-size:12px;">output</span> HASIL</span>';
    h+='<button type="button" id="adt-copy" style="padding:4px 10px;border-radius:5px;font-size:9px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:3px;"><span class="material-icons" style="font-size:11px;">content_copy</span> Salin</button>';
    h+='</div>';
    h+='<pre id="adt-result-text" style="font-size:9px;white-space:pre-wrap;margin:0;font-family:monospace;line-height:1.4;user-select:text;padding:8px;border-radius:6px;"></pre>';
    h+='</div>';

    p.innerHTML=h;
    document.body.appendChild(p);

    document.getElementById('adt-togglemm').addEventListener('click',function(e){ e.stopPropagation(); self.toggleMinMax(); });
    document.getElementById('adt-togglefs').addEventListener('click',function(e){ e.stopPropagation(); self.toggleFullClose(); });
    document.getElementById('adt-copy').addEventListener('click',function(){ self.copyResult(); });

    this.initDrag();
    p.querySelectorAll('[data-tool]').forEach(function(btn){ btn.addEventListener('click',function(){ self.run(btn.dataset.tool); }); });
    this.updateErudaBtn();
  },

  initDrag:function(){
    var header=document.getElementById('adt-header'); var panel=document.getElementById('adt-panel');
    if(!header||!panel) return;
    var isDragging=false,startY=0,startTop=0;
    var down=function(e){
      var t=e.target;
      if(t&&t.closest&&t.closest('#adt-togglemm,#adt-togglefs')) return;
      isDragging=true;
      startY=e.clientY||(e.touches&&e.touches[0].clientY);
      var r=panel.getBoundingClientRect();
      startTop=r.top;
      panel.style.transition='none';
      e.preventDefault();
    };
    var move=function(e){
      if(!isDragging)return;
      var cy=e.clientY||(e.touches&&e.touches[0].clientY);
      if(!cy)return;
      var nt=startTop+(cy-startY);
      var maxTop=innerHeight-160;
      panel.style.top=Math.max(0,Math.min(nt,maxTop))+'px';
      panel.style.bottom='auto';
    };
    var up=function(){ if(isDragging){ isDragging=false; panel.style.transition=''; } };
    header.addEventListener('mousedown',down); header.addEventListener('touchstart',down,{passive:false});
    document.addEventListener('mousemove',move); document.addEventListener('touchmove',move,{passive:false});
    document.addEventListener('mouseup',up); document.addEventListener('touchend',up);
  },

  toggle:function(){
    this.open=!this.open;
    var panel=document.getElementById('adt-panel');
    if(!panel) return;
    panel.style.display=this.open?'flex':'none';
  },

  toggleFullClose:function(){
    var panel=document.getElementById('adt-panel');
    var btn=document.getElementById('adt-togglefs');
    if(!panel||!btn) return;

    if(!this.open){
      this.open=true;
      panel.style.display='flex';
      this.fullscreen=false;
      this.minimized=false;
      btn.innerHTML='<span class="material-icons" style="font-size:18px;">fullscreen</span>';
      btn.title='Fullscreen';
      return;
    }

    if(this.fullscreen){
      this.open=false;
      this.fullscreen=false;
      this.minimized=false;
      panel.style.display='none';
      return;
    }

    if(this.minimized) this.toggleMinMax();
    this.fullscreen=true;
    panel.style.cssText='position:fixed;left:0;right:0;top:0;bottom:0;width:100%;height:100%;max-height:none;z-index:2147483647;display:flex;flex-direction:column;overflow:hidden;border-radius:0;font-family:"Courier New",monospace;';
    btn.innerHTML='<span class="material-icons" style="font-size:18px;">close</span>';
    btn.title='Tutup';
  },

  toggleMinMax:function(){
    var panel=document.getElementById('adt-panel');
    var tb=document.getElementById('adt-tools');
    var rs=document.getElementById('adt-result');
    var btn=document.getElementById('adt-togglemm');
    if(!panel||!btn) return;

    if(this.fullscreen){
      this.fullscreen=false;
      var fsb=document.getElementById('adt-togglefs');
      if(fsb){ fsb.innerHTML='<span class="material-icons" style="font-size:18px;">fullscreen</span>'; fsb.title='Fullscreen'; }
    }

    this.minimized=!this.minimized;

    if(this.minimized){
      if(tb) tb.style.display='none';
      if(rs) rs.style.display='none';
      panel.style.top='auto';
      panel.style.bottom='8px';
      panel.style.left='8px';
      panel.style.right='8px';
      panel.style.maxHeight='none';
      panel.style.height='auto';
      panel.style.borderRadius='12px';
      btn.innerHTML='<span class="material-icons" style="font-size:18px;">maximize</span>';
      btn.title='Maximize';
    } else {
      if(tb) tb.style.display='';
      if(rs && this._lastResultShown) rs.style.display='block';
      panel.style.top='50%';
      panel.style.bottom='80px';
      panel.style.left='8px';
      panel.style.right='8px';
      panel.style.height='';
      panel.style.maxHeight='60vh';
      panel.style.borderRadius='12px';
      btn.innerHTML='<span class="material-icons" style="font-size:18px;">minimize</span>';
      btn.title='Minimize';
    }
  },

  show:function(t){ var r=document.getElementById('adt-result'),x=document.getElementById('adt-result-text'); if(r&&x){ x.textContent=t; r.style.display='block'; this._lastResultShown=true; } },
  showHTML:function(h){ var r=document.getElementById('adt-result'),x=document.getElementById('adt-result-text'); if(r&&x){ x.innerHTML=h; r.style.display='block'; this._lastResultShown=true; } },

  copyResult:function(){
    var t=document.getElementById('adt-result-text'); if(!t)return; var x=t.innerText;
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(x).then(function(){ if(window.M)window.M.toast('Tersalin','success'); });
    else { var ta=document.createElement('textarea'); ta.value=x; ta.style.cssText='position:fixed;opacity:0;'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); if(window.M)window.M.toast('Tersalin','success'); }
  },

  run:function(id){
    var self=this;
    var m={
      devlive:function(){ self.tDevlive(); },
      history:function(){ self.tHistory(); },
      jscheck:function(){ self.tJs(); },
      logs:function(){ self.tLogs(); },
      integration:function(){ self.tIntegration(); },
      fbcheck:function(){ self.tFb(); },
      state:function(){ self.tState(); },
      fsquery:function(){ self.tQuery(); },
      lsinspect:function(){ self.tLs(); },
      cookies:function(){ self.tCookies(); },
      network:function(){ self.tNetwork(); },
      dom:function(){ self.tDOM(); },
      performance:function(){ self.tPerformance(); },
      screen:function(){ self.tScreen(); },
      eruda:function(){ self.tEruda(); },
      pinhash:function(){ self.tPin(); },
      clearcache:function(){ self.tCache(); },
      clearls:function(){ self.tClearLs(); },
      reload:function(){ location.reload(true); }
    };
    if(m[id]) m[id]();
  },

  captureLogs:function(){
    if(this._cap)return; this._cap=true; var s=this;
    ['log','info','warn','error'].forEach(function(k){
      var o=console[k].bind(console);
      console[k]=function(){ var a=[]; for(var i=0;i<arguments.length;i++){ var x=arguments[i]; try{ a.push(typeof x==='object'?JSON.stringify(x):String(x)); }catch(e){ a.push(String(x)); } } s.logs.push({t:Date.now(),type:k,msg:a.join(' ')}); if(s.logs.length>300)s.logs.shift(); o.apply(console,arguments); };
    });
    window.addEventListener('error',function(e){ s.logs.push({t:Date.now(),type:'error',msg:'ERR: '+e.message}); });
    window.addEventListener('unhandledrejection',function(e){ s.logs.push({t:Date.now(),type:'error',msg:'REJECT: '+((e.reason&&e.reason.message)||e.reason)}); });
  },

  // ===== CONSOLE + INJECT SCRIPT =====
  tLogs:function(){
    if(!this.logs.length){ this.show('(belum ada log)\n\nKlik "Inject" untuk menyuntikkan kode JS.'); return; }
    var o='CONSOLE ('+this.logs.length+')\n'+'═'.repeat(36)+'\n';
    o+='Klik tombol "Inject" di atas untuk menyuntikkan kode JS.\n\n';
    this.logs.slice(-60).forEach(function(l){ o+='['+new Date(l.t).toLocaleTimeString('id-ID')+'] '+l.type.toUpperCase()+': '+l.msg+'\n'; });
    this.show(o);
    // Tambah tombol inject + presets di atas log
    var r=document.getElementById('adt-result'); if(!r) return;
    var bar=document.createElement('div');
    bar.style.cssText='margin-bottom:8px;padding:6px;background:'+HK.bg3+';border:1px solid '+HK.line+';border-radius:6px;';
    bar.innerHTML='<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">' +
      '<button type="button" class="sdt-preset" id="sdtInjectBtn" style="background:'+HK.accent+' !important;color:#000 !important;font-size:9px;padding:4px 8px;">⚡ INJECT SCRIPT</button>' +
      '<button type="button" class="sdt-preset" data-preset="ps">PS dump</button>' +
      '<button type="button" class="sdt-preset" data-preset="fls">FLS dump</button>' +
      '<button type="button" class="sdt-preset" data-preset="rt">RT dump</button>' +
      '<button type="button" class="sdt-preset" data-preset="globals">Globals count</button>' +
      '<button type="button" class="sdt-preset" data-preset="reload">Cache-bust reload</button>' +
      '</div>';
    r.insertBefore(bar, r.firstChild);
    var self=this;
    document.getElementById('sdtInjectBtn').addEventListener('click',function(){ self.openInjectModal(); });
    bar.querySelectorAll('[data-preset]').forEach(function(btn){
      btn.addEventListener('click',function(){ self.runPreset(btn.dataset.preset); });
    });
  },

  openInjectModal:function(){
    var code = this.mp(
      'INJECT SCRIPT\n\nMasukkan kode JS untuk dijalankan.\nContoh: console.log("hi")\n       PS.user\n       FLS.topics.length',
      'console.log("hello from inject"); return "OK";'
    );
    if(!code) return;
    this.runInject(code);
  },

  runPreset:function(id){
    var codes = {
      ps: 'return JSON.stringify(window.PS || {}, null, 2);',
      fls: 'var f=window.FLS; if(!f) return "FLS not found"; return JSON.stringify({sid:f.sid,bid:f.bid,subjects:f.subjects,topics:f.topics.length,asg:f.asg}, null, 2);',
      rt: 'return JSON.stringify(window.RT || {}, null, 2);',
      globals: 'var count=0; for(var k in window) if(window.hasOwnProperty(k)) count++; return "Total window globals: " + count;',
      reload: 'location.href=location.pathname + "?devtools&cb=" + Date.now(); return "reloading...";'
    };
    if(codes[id]) this.runInject(codes[id]);
  },

  runInject:function(code){
    var out = 'INJECT SCRIPT\n'+'═'.repeat(36)+'\n';
    out += 'CODE:\n'+code+'\n\n'+'─'.repeat(36)+'\nRESULT:\n';
    try{
      var fn = new Function(code);
      var result = fn();
      if(typeof result==='object'){ try{ out += JSON.stringify(result,null,2); }catch(e){ out += String(result); } }
      else { out += (result===undefined?'(undefined)':String(result)); }
    }catch(e){
      out += '❌ ERROR: '+(e.message||e);
    }
    this.show(out);
  },

  // ===== ERUDA =====
  tEruda:function(){
    if(window.eruda){
      try{
        // toggle show/hide
        var panel = document.querySelector('.eruda');
        if(panel && panel.style.display !== 'none'){
          eruda.hide();
          this.setErudaActive(false);
          this.show('Eruda disembunyikan (state tersimpan: OFF)');
        } else {
          eruda.show();
          this.setErudaActive(true);
          this.show('Eruda aktif (state tersimpan: ON, akan auto-restore saat refresh)');
        }
      }catch(e){ this.show('Eruda toggle error: '+e.message); }
      return;
    }
    this.show('Memuat Eruda...');
    var self=this;
    var load=function(cdn){
      var s=document.createElement('script'); s.src=cdn;
      s.onload=function(){
        try{
          eruda.init({tool:['console','elements','network','storage','info','resources','sources']});
          eruda.show();
          self.setErudaActive(true);
          self.show('✅ Eruda aktif\n\nState tersimpan di localStorage "sdt_eruda".\nAkan auto-restore saat halaman di-refresh (dengan ?devtools).');
        }catch(e){ self.show('Eruda init error: '+e.message); }
      };
      s.onerror=function(){
        if(cdn.indexOf('jsdelivr')>-1){ load('https://unpkg.com/eruda'); }
        else { self.show('CDN Eruda gagal (jsdelivr & unpkg).'); }
      };
      document.head.appendChild(s);
    };
    load('https://cdn.jsdelivr.net/npm/eruda');
  },

  // ===== CEK JS (28 globals sesuai tree path v1.5) =====
  tJs:function(){
    var checks=[
      ['firebase','object','Firebase SDK'],['db','object','Firestore jec-extka'],
      ['dbMateri','object','Firestore jec-theory'],
      ['hashPin','function','js/hash.js'],['verifyPin','function','js/hash.js'],
      ['M','object','js/modal.js'],['toast','function','js/modal.js'],
      ['PS','object','js/s/state.js'],['RT','object','js/s/realtime.js'],
      ['FLS','object','js/fl/fl-student.js (data layer)'],
      ['FLST','object','js/fl/fl-student.js (shell)'],
      ['FLMAT','object','js/fl/full-materi.js'],
      ['FLEX','object','js/fl/ex-materi.js'],
      ['FLFUN','object','js/fl/fun-learn.js'],
      ['FLGAMES','object','js/fl/fun-learn.js (registry)'],
      ['FLCONN','object','js/fl/fl-connect.js'],
      ['FLDND','object','js/fl/fl-dnd.js'],
      ['FLTF','object','js/fl/fl-tf.js'],
      ['FLTEST','object','js/fl/fl-testaccount.js'],
      ['loadDashboard','function','js/s/dashboard.js'],
      ['loadSessions','function','js/s/dashboard.js'],
      ['startSession','function','js/s/test.js'],
      ['answerPGS','function','js/s/test.js'],
      ['submitTest','function','js/s/test.js'],
      ['showResult','function','js/s/result.js'],
      ['reviewAnswers','function','js/s/result.js'],
      ['openFeedback','function','js/s/feedback.js'],
      ['openProfile','function','js/s/profile.js']
    ];
    var ok=0, html='<div style="font-size:10px;font-weight:800;margin-bottom:6px;display:flex;align-items:center;gap:4px;color:'+HK.fg+';"><span class="material-icons" style="font-size:12px;">code</span> CEK JS (SISWA — 28 globals)</div>';
    html+='<table style="width:100%;border-collapse:collapse;font-size:9px;border-radius:6px;overflow:hidden;">';
    html+='<thead><tr><th style="padding:4px 3px;text-align:left;">Name</th><th style="padding:4px 3px;">File</th><th style="padding:4px 3px;">St</th></tr></thead><tbody>';
    checks.forEach(function(c){ var ex=typeof window[c[0]]!=='undefined'; var tm=typeof window[c[0]]===c[1]; if(tm)ok++;
      html+='<tr style="border-bottom:1px solid '+HK.line+';"><td style="padding:3px;font-weight:600;">'+c[0]+'</td><td style="padding:3px;font-size:8px;color:'+HK.fgDim+';">'+c[2]+'</td><td style="padding:3px;text-align:center;">'+(tm?'<span style="color:'+HK.accent+';font-weight:800;">OK</span>':(ex?'<span style="color:'+HK.warn+';">TYPE</span>':'<span style="color:#666;">MISS</span>'))+'</td></tr>'; });
    html+='</tbody></table>';
    html+='<div style="margin-top:6px;text-align:center;font-weight:700;color:'+(ok===checks.length?HK.accent:HK.warn)+';">'+ok+'/'+checks.length+' LOADED</div>';
    this.showHTML(html);
  },

  tFb:function(){
    this.show('Menguji Firebase...');
    if(typeof window.db==='undefined'){this.show('db tidak ditemukan');return;}
    var o='FIREBASE (project: jec-extka)\n'+'═'.repeat(36)+'\n';
    var cols=['students','sessions','questions','attempts','feedback','settings'];
    var ch=Promise.resolve(); var self=this;
    cols.forEach(function(c){ ch=ch.then(function(){ return window.db.collection(c).limit(1).get().then(function(s){ o+='[OK] '+c+' ('+s.size+')\n'; }).catch(function(e){ o+='[XX] '+c+': '+e.message+'\n'; }); }); });
    ch.then(function(){
      // jec-theory
      if(window.dbMateri){
        o+='\nFIREBASE (project: jec-theory)\n'+'═'.repeat(36)+'\n';
        var mcols=['topics','grade_map','fl_config','fl_batch_assign','fl_student_progress','fl_submissions','fl_ex_result'];
        var ch2=Promise.resolve();
        mcols.forEach(function(c){ ch2=ch2.then(function(){ return window.dbMateri.collection(c).limit(1).get().then(function(s){ o+='[OK] '+c+' ('+s.size+')\n'; }).catch(function(e){ o+='[XX] '+c+': '+e.message+'\n'; }); }); });
        ch2.then(function(){ self.show(o); });
      } else { self.show(o); }
    });
  },

  tState:function(){
    var o='STATE (SISWA)\n'+'═'.repeat(36)+'\n';
    o+='Session: '+(sessionStorage.getItem('student_session')||'none')+'\n';
    o+='URL: '+location.href+'\n';
    o+='Window.PS: '+(window.PS?'exists':'missing')+'\n';
    if(window.PS){ o+='PS.user: '+JSON.stringify(window.PS.user)+'\n'; o+='PS.questions: '+(window.PS.questions||[]).length+'\n'; o+='PS.currentIndex: '+window.PS.currentIndex+'\n'; o+='PS.attemptId: '+(window.PS.attemptId||'-')+'\n'; o+='PS.activeTab: '+(window.PS.activeTab||'-')+'\n'; o+='PS.myProfile: '+(window.PS.myProfile?JSON.stringify(window.PS.myProfile):'null')+'\n'; }
    if(window.FLS){ o+='\nFLS:\n  sid='+FLS.sid+' bid='+FLS.bid+'\n  topics='+FLS.topics.length+' asg='+Object.keys(FLS.asg||{}).length+'\n'; }
    if(window.RT){ o+='\nRT:\n  roomCode='+RT.roomCode+' online='+RT.online+'\n'; }
    this.show(o);
  },

  tQuery:function(){
    var self=this;
    Promise.resolve(this.mp('Collection (students/sessions/questions/attempts/feedback/settings\ndbMateri: topics/grade_map/fl_batch_assign):','sessions')).then(function(col){
      if(!col)return;
      Promise.resolve(self.mp('Limit:','3')).then(function(l){
        var lim=parseInt(l)||3; self.show('Query '+col+'...');
        var useMateri = ['topics','grade_map','fl_config','fl_batch_assign','fl_student_progress','fl_submissions','fl_ex_result','materi_logs'].indexOf(col)>-1;
        var ref = useMateri ? window.dbMateri : window.db;
        if(!ref){ self.show('db tidak tersedia'); return; }
        ref.collection(col).limit(lim).get().then(function(s){
          var o=col+' ('+s.size+')\n'+'═'.repeat(36)+'\n'; if(s.empty)o+='(kosong)';
          s.forEach(function(d){ o+='\n['+d.id+']\n'+JSON.stringify(d.data(),null,1)+'\n'; });
          self.show(o);
        }).catch(function(e){ self.show('Error: '+e.message); });
      });
    });
  },

  tLs:function(){
    var self=this;
    var o='LOCALSTORAGE ('+localStorage.length+')\n'+'═'.repeat(36)+'\n';
    for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);var v=localStorage.getItem(k);o+=k+' = '+(v.length>80?v.slice(0,80)+'…':v)+'\n';}
    o+='\nSESSIONSTORAGE ('+sessionStorage.length+')\n'+'═'.repeat(36)+'\n';
    for(var j=0;j<sessionStorage.length;j++){var k2=sessionStorage.key(j);var v2=sessionStorage.getItem(k2);o+=k2+' = '+(v2.length>80?v2.slice(0,80)+'…':v2)+'\n';}
    this.show(o);
    Promise.resolve(this.mp('Hapus key (kosong=batal):','')).then(function(d){ if(d){localStorage.removeItem(d);sessionStorage.removeItem(d);self.tLs();} });
  },

  tPin:function(){
    var self=this;
    Promise.resolve(this.mp('PIN:','1234')).then(function(pin){ if(!pin)return;
      if(typeof window.hashPin!=='function'){self.show('hashPin tidak tersedia');return;}
      window.hashPin(pin).then(function(h){ self.show('HASH PIN\n'+'═'.repeat(36)+'\nPIN: '+pin+'\nHash: '+h); }); });
  },

  tCache:function(){
    var self=this; this.show('Clearing...'); var done=[];
    var p1=(typeof caches!=='undefined')?caches.keys().then(function(ks){ks.forEach(function(k){caches.delete(k);});if(ks.length)done.push('Cache: '+ks.length);}).catch(function(){}):Promise.resolve();
    var p2=(navigator.serviceWorker&&navigator.serviceWorker.getRegistrations)?navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister();});if(rs.length)done.push('SW: '+rs.length);}).catch(function(){}):Promise.resolve();
    Promise.all([p1,p2]).then(function(){ self.show('Done\n'+(done.join('\n')||'(tidak ada)')); });
  },

  tClearLs:function(){
    if(!confirm('Hapus SEMUA localStorage & sessionStorage?\nSession login siswa akan hilang.'))return;
    var n=localStorage.length; try{localStorage.clear();sessionStorage.clear();}catch(e){}
    this.show(n+' key dihapus. Reload...'); setTimeout(function(){location.reload();},800);
  },

  // ===== INTEGRATION (17 file sesuai tree path) =====
  tIntegration:function(){
    var scripts=[
      {f:'css/g.css',g:null,n:'Global CSS'},
      {f:'css/s.css',g:null,n:'Student CSS'},
      {f:'css/brand.css',g:null,n:'Brand CSS'},
      {f:'js/fc.js',g:'db',n:'Firebase Core'},
      {f:'js/fc-materi.js',g:'dbMateri',n:'Firebase Materi'},
      {f:'js/hash.js',g:'hashPin',n:'Hash PIN'},
      {f:'js/modal.js',g:'M',n:'Modal'},
      {f:'js/rwmonitor.js',g:null,n:'RW Monitor'},
      {f:'js/s/state.js',g:'PS',n:'State Siswa'},
      {f:'js/s/login.js',g:null,n:'Login'},
      {f:'js/s/dashboard.js',g:'loadDashboard',n:'Dashboard'},
      {f:'js/s/test.js',g:'startSession',n:'Test'},
      {f:'js/s/result.js',g:'showResult',n:'Result'},
      {f:'js/s/realtime.js',g:'RT',n:'Realtime'},
      {f:'js/fl/fl-student.js',g:'FLS',n:'Learn Shell'},
      {f:'js/fl/full-materi.js',g:'FLMAT',n:'Materi'},
      {f:'js/fl/ex-materi.js',g:'FLEX',n:'Exercise'},
      {f:'js/fl/fun-learn.js',g:'FLFUN',n:'Fun Learn'},
      {f:'js/fl/fl-connect.js',g:'FLCONN',n:'Game Connect'},
      {f:'js/fl/fl-dnd.js',g:'FLDND',n:'Game DnD'},
      {f:'js/fl/fl-tf.js',g:'FLTF',n:'Game TF'},
      {f:'js/fl/fl-testaccount.js',g:'FLTEST',n:'Test Account'},
      {f:'js/s/s-devtools.js',g:'DT',n:'DevTools (this)'}
    ];
    var loaded=Array.from(document.querySelectorAll('script[src],link[rel="stylesheet"]')).map(function(s){return (s.src||s.href||'').split('/').pop().split('?')[0];});
    var html='<div style="font-size:10px;font-weight:800;margin-bottom:6px;display:flex;align-items:center;gap:4px;color:'+HK.fg+';"><span class="material-icons" style="font-size:12px;">link</span> INTEGRATION (SISWA — '+scripts.length+' files)</div>';
    html+='<table style="width:100%;border-collapse:collapse;font-size:9px;border-radius:6px;overflow:hidden;">';
    html+='<thead><tr><th style="padding:4px 3px;text-align:left;">File</th><th style="padding:4px 3px;">Global</th><th style="padding:4px 3px;">St</th></tr></thead><tbody>';
    var ok=0;
    scripts.forEach(function(s,i){ var isL=loaded.indexOf(s.f.split('/').pop())!==-1; var isG=s.g?(window[s.g]!==undefined):true;
      var st=(isL&&isG)?'<span style="color:'+HK.accent+';font-weight:800;">WORK</span>':(isL?'<span style="color:'+HK.warn+';">LOAD</span>':'<span style="color:'+HK.bad+';">MISS</span>');
      if(isL&&isG) ok++;
      html+='<tr style="border-bottom:1px solid '+HK.line+';"><td style="padding:3px;font-weight:600;">'+(i+1)+'. '+s.f+'</td><td style="padding:3px;text-align:center;color:'+HK.fgDim+';font-size:8px;">'+(s.g||'-')+'</td><td style="padding:3px;text-align:center;">'+st+'</td></tr>'; });
    html+='</tbody></table>';
    html+='<div style="margin-top:6px;text-align:center;font-weight:700;color:'+(ok===scripts.length?HK.accent:HK.warn)+';">'+ok+'/'+scripts.length+' INTEGRATED</div>';
    this.showHTML(html);
  },

  tDevlive:function(){ if(this.devliveData.length)this.renderTable(); this.autoScan(false); },

  tHistory:function(){
    var self=this; this.show('Memindai riwayat update file siswa...');
    var results=[]; var idx=0;
    var next=function(){ if(idx>=STUDENT_FILES.length){ renderAll(); return; }
      var f=STUDENT_FILES[idx++];
      fetch(f+'?_t='+Date.now(),{cache:'no-store'}).then(function(r){ if(!r.ok)throw new Error(r.status); return r.text(); })
        .then(function(text){ var i=self.parseInfo(text,f); results.push({file:f,path:i.path,version:i.version,ts:i.ts,hasHeader:i.hasHeader,note:self.extractNote(text)}); next(); })
        .catch(function(e){ results.push({file:f,path:f,version:'-',ts:0,hasHeader:false,note:'Gagal ('+e.message+')'}); next(); }); };
    next();
    function renderAll(){ results.sort(function(a,b){return b.ts-a.ts;});
      var html='<div style="font-size:10px;font-weight:800;margin-bottom:6px;display:flex;align-items:center;gap:4px;color:'+HK.fg+';"><span class="material-icons" style="font-size:12px;">history</span> RIWAYAT UPDATE ('+results.length+' files)</div>';
      html+='<table style="width:100%;border-collapse:collapse;font-size:9px;border-radius:6px;overflow:hidden;">';
      html+='<thead><tr><th style="padding:4px 3px;text-align:left;">FILE</th><th style="padding:4px 3px;">VER</th><th style="padding:4px 3px;">UPDATE</th></tr></thead><tbody>';
      results.forEach(function(r){ var ic=r.hasHeader?'✅':'⚠️';
        html+='<tr style="border-bottom:1px solid '+HK.line+';"><td style="padding:4px 3px;font-weight:600;">'+ic+' '+r.path+'</td><td style="padding:4px 3px;text-align:center;color:'+HK.fg+';font-weight:700;">'+r.version+'</td><td style="padding:4px 3px;text-align:center;white-space:nowrap;">'+self.fmtTs(r.ts)+'</td></tr>'; });
      html+='</tbody></table>'; self.showHTML(html); }
  },

  autoScan:function(silent){
    var self=this;
    Promise.resolve().then(function(){ return self.scan(); }).then(function(){
      self.lastAuto=new Date(); if(!silent)self.renderTable();
      var b=document.getElementById('adt-badge'); if(b)b.textContent=self.devliveData.filter(function(r){return r.status==='connect';}).length+'✅'; });
  },

  parseInfo:function(text,file){
    var head=(text||'').split('\n').slice(0,10).join('\n'); var path=file;
    var mR=head.match(/#root\s*:\s*([^\s|]+)/i), mP=head.match(/#path\s*:\s*root\/([^\s|]+)/i), mI=head.match(/^[\/\*<!\-#\s]*#(\d+)\s*\|\s*([^\s|]+)/i);
    if(mR)path=mR[1].trim(); else if(mP)path=mP[1].trim(); else if(mI)path=mI[2].trim();
    var vm=head.match(/v(?:ersion)?[:\s•]*([0-9]+(?:\.[0-9]+)+)/i);
    var um=head.match(/update[d]?[:\s•]*([^|\n]+)/i)||head.match(/u\s+([^|\n]+)/i);
    var ts=0; if(um){ var dm=um[1].match(/(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/); if(dm){ var yy=+dm[3]; if(yy<100)yy+=2000; var tm=um[1].match(/(\d{2}):(\d{2}):(\d{2})/); ts=new Date(yy,+dm[2]-1,+dm[1],tm?+tm[1]:0,tm?+tm[2]:0,tm?+tm[3]:0).getTime(); } }
    return { path:path, version:vm?vm[1]:'-', ts:ts, hasHeader:!!(vm||um||mR||mP||mI) };
  },

  extractNote:function(text){
    var head=(text||'').split('\n').slice(0,5).join('\n');
    var m=head.match(/note\s*:\s*([^\n]+)/i); if(m)return m[1].replace(/\-\->/g,'').replace(/\*-->/g,'').trim();
    return '';
  },

  scan:function(){
    var self=this; var res=[]; var idx=0;
    return new Promise(function(resolve){ var next=function(){ if(idx>=self.devliveFiles.length){ res.sort(function(a,b){return b.ts-a.ts;}); self.devliveData=res; resolve(); return; }
      var f=self.devliveFiles[idx++];
      fetch(f+(f.indexOf('?')>-1?'&':'?')+'_dl='+Date.now(),{cache:'no-store'}).then(function(r){ if(!r.ok)throw new Error(r.status); return r.text(); })
        .then(function(t){ var i=self.parseInfo(t,f); res.push(Object.assign({file:f,status:i.hasHeader?'connect':'no-header'},i)); }).catch(function(){ res.push({file:f,path:f,version:'-',ts:0,status:'missing'}); }).then(next); };
      next(); });
  },

  fmtTs:function(ts){ if(!ts)return'-'; var d=new Date(ts),p=function(n){return String(n).padStart(2,'0');}; return p(d.getDate())+'/'+p(d.getMonth()+1)+' '+p(d.getHours())+':'+p(d.getMinutes()); },

  renderTable:function(){
    var self=this; var ok=this.devliveData.filter(function(r){return r.status==='connect';}).length;
    var ico={connect:'✅','no-header':'⚠️',missing:'❌'};
    var h='<div style="font-size:9px;margin-bottom:4px;background:'+HK.bg2+';padding:5px 6px;border-radius:5px;display:flex;align-items:center;gap:4px;flex-wrap:wrap;border:1px solid '+HK.line+';">';
    h+='<span class="material-icons" style="font-size:12px;color:'+HK.accent+';">sensors</span>';
    h+='<b style="color:'+HK.fg+';">DevLive</b>';
    h+='<span style="color:'+HK.accent+';font-weight:800;">✅ '+ok+'/'+this.devliveData.length+'</span>';
    h+='<span id="devlive-clock" style="font-weight:700;color:'+HK.fg+';font-family:monospace;">--:--:--</span>';
    h+='</div>';
    h+='<table style="width:100%;border-collapse:collapse;font-size:8px;border-radius:6px;overflow:hidden;"><thead><tr><th style="padding:3px 2px;text-align:left;">FILE</th><th style="padding:3px 2px;">VER</th><th style="padding:3px 2px;">UPDATE</th><th style="padding:3px 2px;">ST</th></tr></thead><tbody>';
    this.devliveData.forEach(function(r,i){ h+='<tr style="border-bottom:1px solid '+HK.line+';'+(i===0&&r.ts>0?'background:'+HK.fgSoft+';':'')+'">';
      h+='<td style="padding:3px 2px;font-weight:600;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+r.path+'</td>';
      h+='<td style="padding:3px 2px;text-align:center;color:'+HK.fg+';font-weight:700;">'+r.version+'</td>';
      h+='<td style="padding:3px 2px;text-align:center;white-space:nowrap;color:'+HK.fgDim+';">'+self.fmtTs(r.ts)+'</td>';
      h+='<td style="padding:3px 2px;text-align:center;">'+(ico[r.status]||'?')+'</td></tr>'; });
    h+='</tbody></table>'; this.showHTML(h);
  },

  tCookies:function(){
    var c=document.cookie.split(';').map(function(x){return x.trim();});
    if(!c.length||(c.length===1&&c[0]==='')){this.show('Tidak ada cookie.');return;}
    var html='<div style="font-size:10px;font-weight:800;margin-bottom:6px;display:flex;align-items:center;gap:4px;color:'+HK.fg+';"><span class="material-icons" style="font-size:12px;">cookie</span> COOKIES</div>';
    html+='<table style="width:100%;border-collapse:collapse;font-size:9px;border-radius:6px;overflow:hidden;">';
    html+='<thead><tr><th style="padding:4px 3px;text-align:left;">Name</th><th style="padding:4px 3px;text-align:left;">Value</th></tr></thead><tbody>';
    c.forEach(function(x){ var p=x.split('='); html+='<tr style="border-bottom:1px solid '+HK.line+';"><td style="padding:3px;font-weight:600;">'+p.shift()+'</td><td style="padding:3px;word-break:break-all;font-size:8px;">'+p.join('=')+'</td></tr>'; });
    html+='</tbody></table>'; this.showHTML(html);
  },

  tNetwork:function(){
    var conn=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    var html='<div style="font-size:10px;font-weight:800;margin-bottom:6px;display:flex;align-items:center;gap:4px;color:'+HK.fg+';"><span class="material-icons" style="font-size:12px;">wifi</span> NETWORK INFO</div>';
    html+='<table style="width:100%;border-collapse:collapse;font-size:9px;border-radius:6px;overflow:hidden;">';
    html+='<tr><td style="padding:4px 3px;font-weight:600;">Online</td><td style="padding:4px 3px;">'+(navigator.onLine?'<b style="color:'+HK.accent+';">YES</b>':'<b style="color:'+HK.bad+';">NO</b>')+'</td></tr>';
    if(conn){ html+='<tr><td style="padding:4px 3px;">Type</td><td style="padding:4px 3px;">'+(conn.effectiveType||'?')+'</td></tr><tr><td style="padding:4px 3px;">Downlink</td><td style="padding:4px 3px;">'+(conn.downlink||'?')+' Mbps</td></tr>'; }
    html+='<tr><td style="padding:4px 3px;">Host</td><td style="padding:4px 3px;">'+location.host+'</td></tr></table>'; this.showHTML(html);
  },

  tDOM:function(){
    var html='<div style="font-size:10px;font-weight:800;margin-bottom:6px;display:flex;align-items:center;gap:4px;color:'+HK.fg+';"><span class="material-icons" style="font-size:12px;">account_tree</span> DOM INSPECTOR</div>';
    html+='<table style="width:100%;border-collapse:collapse;font-size:9px;border-radius:6px;overflow:hidden;">';
    html+='<tr><td style="padding:4px 3px;font-weight:600;">Total Elements</td><td style="padding:4px 3px;">'+document.querySelectorAll('*').length+'</td></tr>';
    html+='<tr><td style="padding:4px 3px;">Scripts</td><td style="padding:4px 3px;">'+document.querySelectorAll('script').length+'</td></tr>';
    html+='<tr><td style="padding:4px 3px;">Links</td><td style="padding:4px 3px;">'+document.querySelectorAll('link').length+'</td></tr></table>'; this.showHTML(html);
  },

  tPerformance:function(){
    var html='<div style="font-size:10px;font-weight:800;margin-bottom:6px;display:flex;align-items:center;gap:4px;color:'+HK.fg+';"><span class="material-icons" style="font-size:12px;">speed</span> PERFORMANCE</div>';
    html+='<table style="width:100%;border-collapse:collapse;font-size:9px;border-radius:6px;overflow:hidden;">';
    if(performance.memory){ html+='<tr><td style="padding:4px 3px;">Heap Used</td><td style="padding:4px 3px;">'+(performance.memory.usedJSHeapSize/1048576).toFixed(2)+' MB</td></tr>'; }
    var nav=performance.getEntriesByType&&performance.getEntriesByType('navigation')[0];
    if(nav){ html+='<tr><td style="padding:4px 3px;">DOM Complete</td><td style="padding:4px 3px;">'+nav.domComplete.toFixed(0)+' ms</td></tr>'; }
    html+='</table>'; this.showHTML(html);
  },

  tScreen:function(){
    var html='<div style="font-size:10px;font-weight:800;margin-bottom:6px;display:flex;align-items:center;gap:4px;color:'+HK.fg+';"><span class="material-icons" style="font-size:12px;">devices</span> SCREEN INFO</div>';
    html+='<table style="width:100%;border-collapse:collapse;font-size:9px;border-radius:6px;overflow:hidden;">';
    html+='<tr><td style="padding:4px 3px;">Screen</td><td style="padding:4px 3px;">'+screen.width+'x'+screen.height+'</td></tr>';
    html+='<tr><td style="padding:4px 3px;">Viewport</td><td style="padding:4px 3px;">'+innerWidth+'x'+innerHeight+'</td></tr>';
    html+='<tr><td style="padding:4px 3px;">DPR</td><td style="padding:4px 3px;">'+devicePixelRatio+'</td></tr></table>'; this.showHTML(html);
  }
};

window.DT = DT;

try{
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',function(){ DT.init(); }); }
  else { DT.init(); }
}
catch(e){
  var d=document.createElement('div');
  d.style.cssText='position:fixed;bottom:8px;right:8px;background:#dc2626;color:#fff;padding:8px 12px;border-radius:8px;z-index:2147483647;font:700 11px sans-serif;max-width:280px;box-shadow:0 4px 12px rgba(0,0,0,.3);';
  d.textContent='❌ s-devtools error: '+(e.message||e);
  document.body.appendChild(d);
}
})();