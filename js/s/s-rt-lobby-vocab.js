/* s-rt-lobby-vocab.js | v 3.1 | u 18/09/2026 • 17:10:00 | xu : ke-14 | note : #noteresponse
   ========================================================================
   FILE INI BISA DIEDIT BEBAS oleh user untuk menambah/mengurangi kosakata.
   Format per entri: { en:'Inggris', id:'Indonesia', pos:'tipe' }
   Tipe pos: noun / verb / adj / adv / prep / conj / idiom
   Jaga struktur array (kurung siku, koma, tutup `];`).
   ========================================================================
   - v3.0 -> v3.1 (IDE USER: tombol waiting-room + modal modal.js):
     * BOTTOM-SHEET DIHAPUS TOTAL.
     * TOMBOL #rtVocabBtn: persegi 44x44, ikon sports_esports, kiri bawah
       MENYATU dengan ticker (ticker mulai left:44px), z-index maksimal.
       Hanya tampil saat lobby ter-render.
     * Tap tombol -> M.custom() (modal.js) dengan kotak PERSEGI 320px
       (class .vg-square), isi 2 tab mini-game:
         1) TEBAK KATA : kata + 3 pilihan, feedback warna, auto next, streak.
         2) FLASHCARD  : kata -> tap lihat arti -> tap kata berikutnya.
     * Interaksi modal via fungsi global vgTab/vgPick/vgFlip/vgNext yang
       memutasi #vgBody (modal tetap terbuka, tidak render ulang modal).
     * Ticker + pause (delegasi document) TETAP dari v3.0.
     * Hide bottom-nav saat realtime + hide leaderboard lobby TETAP.
   ======================================================================== */
var RT_VOCAB = [
  // ===== NOUNS =====
  { en:'book',       id:'buku',            pos:'noun' },
  { en:'student',    id:'siswa',           pos:'noun' },
  { en:'teacher',    id:'guru',            pos:'noun' },
  { en:'knowledge',  id:'pengetahuan',     pos:'noun' },
  { en:'happiness',  id:'kebahagiaan',     pos:'noun' },
  { en:'journey',    id:'perjalanan',      pos:'noun' },
  { en:'time',       id:'waktu',           pos:'noun' },
  { en:'friend',     id:'teman',           pos:'noun' },
  // ===== VERBS =====
  { en:'run',        id:'berlari',         pos:'verb' },
  { en:'write',      id:'menulis',         pos:'verb' },
  { en:'study',      id:'belajar',         pos:'verb' },
  { en:'achieve',    id:'mencapai',        pos:'verb' },
  { en:'discover',   id:'menemukan',       pos:'verb' },
  { en:'understand', id:'memahami',        pos:'verb' },
  { en:'create',     id:'menciptakan',     pos:'verb' },
  { en:'read',       id:'membaca',         pos:'verb' },
  // ===== ADJECTIVES =====
  { en:'beautiful',  id:'cantik',          pos:'adj' },
  { en:'brilliant',  id:'cemerlang',       pos:'adj' },
  { en:'curious',    id:'penasaran',       pos:'adj' },
  { en:'diligent',   id:'rajin',           pos:'adj' },
  { en:'honest',     id:'jujur',           pos:'adj' },
  { en:'intelligent',id:'cerdas',          pos:'adj' },
  // ===== ADVERBS =====
  { en:'quickly',    id:'dengan cepat',    pos:'adv' },
  { en:'carefully',  id:'dengan hati-hati',pos:'adv' },
  { en:'happily',    id:'dengan bahagia',  pos:'adv' },
  { en:'wisely',     id:'dengan bijak',    pos:'adv' },
  { en:'patiently',  id:'dengan sabar',    pos:'adv' },
  // ===== PREP / CONJ =====
  { en:'between',    id:'di antara',       pos:'prep' },
  { en:'although',   id:'meskipun',        pos:'conj' },
  { en:'however',    id:'namun',           pos:'conj' },
  { en:'therefore',  id:'oleh karena itu', pos:'conj' },
  // ===== IDIOMS =====
  { en:'break the ice', id:'memulai percakapan', pos:'idiom' },
  { en:'piece of cake', id:'sangat mudah',       pos:'idiom' },
  { en:'hit the books', id:'belajar giat',       pos:'idiom' }
];

// ==== Logic (JANGAN DIEDIT) ====
(function(){
  'use strict';
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function $(id){ return document.getElementById(id); }
  function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
  function vocabOk(){ return !!(window.RT_VOCAB && window.RT_VOCAB.length); }
  function wlog(){ var a=['[vocab]']; for(var i=0;i<arguments.length;i++) a.push(arguments[i]); console.warn(a.join(' ')); }

  var TICKER_CSS = 'position:fixed;left:44px;right:0;bottom:0;height:44px;z-index:2147483647;' +
    'background:linear-gradient(90deg,#4c1d95,#6d28d9);color:#fff;display:flex;' +
    'align-items:center;overflow:hidden;cursor:pointer;user-select:none;' +
    '-webkit-tap-highlight-color:transparent;';
  var BTN_CSS = 'position:fixed;left:0;bottom:0;width:44px;height:44px;z-index:2147483647;' +
    'background:linear-gradient(135deg,#4c1d95,#6d28d9);color:#fff;border:none;border-radius:0;' +
    'display:flex;align-items:center;justify-content:center;cursor:pointer;' +
    'box-shadow:2px 0 8px rgba(0,0,0,.25);-webkit-tap-highlight-color:transparent;';

  var VG = { mode:'tebak', deck:null, idx:0, revealed:false,
             word:null, opts:[], correctIdx:0, locked:false,
             streak:0, best:0, correct:0, total:0, modalOpen:false };
  var ST = { navHidden:false, lastState:null, warnedVocab:false, lastTick:0, paused:false, lastPause:0 };

  function injectCss(){
    if ($('#rt-vocab-v2-css')) return;
    var st = document.createElement('style');
    st.id = 'rt-vocab-v2-css';
    st.textContent = [
      'body:has(#realtimePage.active) .bottom-nav-tabs{display:none!important;}',
      '@keyframes rtTickerMove{from{transform:translateX(0);}to{transform:translateX(-50%);}}',
      '.rt-ticker-track{display:flex;width:max-content;animation:rtTickerMove var(--tkdur,60s) linear infinite;will-change:transform;}',
      '.rt-ticker-track.paused{animation-play-state:paused;}',
      '.rt-ticker-group{display:inline-flex;align-items:center;}',
      '.rt-ticker-item{display:inline-flex;align-items:center;gap:.375rem;margin:0 1.25rem;font-size:13px;font-weight:600;white-space:nowrap;}',
      '.rt-ticker-item .tk-pos{font-size:9px;font-weight:800;background:rgba(255,255,255,.22);padding:1px 6px;border-radius:50px;letter-spacing:.04em;}',
      '.rt-ticker-item .tk-sep{opacity:.45;margin-left:1.25rem;}',
      '#rtLobbyScreen .rt-card:has(#rtLeaderboard){display:none!important;}',
      /* modal persegi untuk waiting room */
      '.vg-square{max-width:320px!important;width:320px!important;}',
      '.vg-square .modal-content{max-height:52vh;overflow-y:auto;}',
      '.vg-tab{flex:1;padding:8px 4px;border:1.5px solid #e6eaf0;background:#f8fafc;border-radius:10px;',
      '  font-size:12px;font-weight:700;color:#475569;cursor:pointer;font-family:inherit;}',
      '.vg-tab.active{background:#ede9fe;border-color:#8b5cf6;color:#4c1d95;}',
      '.vg-opt{width:100%;text-align:left;padding:10px 12px;background:#f8fafc;border:1.5px solid #e6eaf0;',
      '  border-radius:10px;font-size:14px;font-weight:600;color:#334155;cursor:pointer;font-family:inherit;}',
      '.vg-opt.correct{background:#d1fae5;border-color:#10b981;color:#065f46;}',
      '.vg-opt.wrong{background:#fee2e2;border-color:#ef4444;color:#991b1b;}',
      '.vg-btn{width:100%;padding:10px 12px;background:#4c1d95;color:#fff;border:none;border-radius:10px;',
      '  font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;}'
    ].join('\n');
    document.head.appendChild(st);
  }

  // ===== TICKER =====
  function tickerItemHtml(v){
    return '<span class="rt-ticker-item">' + esc(v.en) +
      ' <span style="opacity:.75;">:</span> ' + esc(v.id) +
      ' <span class="tk-pos">'+esc(String(v.pos).toUpperCase())+'</span>' +
      '<span class="tk-sep">•</span></span>';
  }
  function ensureTicker(){
    if ($('#rtVocabTicker')) return;
    if (!vocabOk()) return;
    var bar = document.createElement('div');
    bar.id = 'rtVocabTicker';
    bar.setAttribute('style', TICKER_CSS);
    var group = '<span class="rt-ticker-group">' + window.RT_VOCAB.map(tickerItemHtml).join('') + '</span>';
    bar.innerHTML = '<div class="rt-ticker-track" id="rtTickerTrack" style="display:flex;width:max-content;">' + group + group + '</div>';
    try { bar.firstChild.style.animation = 'rtTickerMove ' + Math.max(30, window.RT_VOCAB.length * 2.9) + 's linear infinite'; } catch(e){}
    document.body.appendChild(bar);
  }
  function onTickerTap(e){
    try {
      var t = e.target;
      if (!t || !t.closest) return;
      if (!t.closest('#rtVocabTicker')) return;
      var now = Date.now();
      if (now - ST.lastPause < 500) return;
      ST.lastPause = now;
      ST.paused = !ST.paused;
      var tr = $('#rtTickerTrack');
      if (tr) {
        tr.classList.toggle('paused', ST.paused);
        tr.style.animationPlayState = ST.paused ? 'paused' : 'running';
      }
      wlog('ticker ' + (ST.paused ? 'paused' : 'resumed'));
    } catch(err){}
  }
  document.addEventListener('click', onTickerTap);
  document.addEventListener('touchend', onTickerTap);

  // ===== TOMBOL WAITING ROOM =====
  function ensureBtn(){
    if ($('#rtVocabBtn')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'rtVocabBtn';
    b.setAttribute('style', BTN_CSS);
    b.setAttribute('title', 'Waiting Room: mini-game kosakata');
    b.innerHTML = '<span class="material-icons" style="font-size:22px;">sports_esports</span>';
    document.body.appendChild(b);
    wlog('btn created');
  }
  document.addEventListener('click', function(e){
    try {
      var t = e.target;
      if (!t || !t.closest) return;
      if (!t.closest('#rtVocabBtn')) return;
      openVgModal();
    } catch(err){}
  });

  // ===== MODAL (modal.js) =====
  function modalVisible(){
    var ov = $('modalOverlay');
    return !!(ov && ov.style.display !== 'none');
  }
  function openVgModal(){
    if (!vocabOk()) return;
    if (VG.modalOpen && modalVisible()) return;
    VG.modalOpen = true;
    ensureDeck();
    if (VG.mode === 'tebak' && !VG.word) pickRound();
    if (typeof M !== 'undefined' && M.custom) {
      M.custom({
        title: 'Waiting Room',
        message:
          '<div style="display:flex;gap:6px;margin-bottom:10px;">' +
            '<button type="button" class="vg-tab active" id="vgTabTebak" onclick="vgTab(\'tebak\')">🎯 Tebak Kata</button>' +
            '<button type="button" class="vg-tab" id="vgTabCard" onclick="vgTab(\'card\')">📚 Flashcard</button>' +
          '</div>' +
          '<div id="vgBody">' + bodyHtml() + '</div>',
        type: 'info',
        buttons: [
          { text:'Tutup', class:'btn-secondary', action: function(){ VG.modalOpen = false; } }
        ]
      });
      setTimeout(function(){
        var mb = document.querySelector('.modal-box');
        if (mb) mb.classList.add('vg-square');
      }, 0);
      wlog('modal opened');
    } else {
      VG.modalOpen = false;
      wlog('modal.js tidak tersedia');
    }
  }

  function ensureDeck(){
    if (!VG.deck || VG.deck.length !== window.RT_VOCAB.length) {
      VG.deck = shuffle(window.RT_VOCAB.slice());
      VG.idx = 0; VG.revealed = false;
    }
  }
  function pickRound(){
    VG.word = window.RT_VOCAB[Math.floor(Math.random()*window.RT_VOCAB.length)];
    var others = shuffle(window.RT_VOCAB.filter(function(v){ return v.id !== VG.word.id; })).slice(0,2);
    VG.opts = shuffle([VG.word.id].concat(others.map(function(v){ return v.id; })));
    VG.correctIdx = VG.opts.indexOf(VG.word.id);
    VG.locked = false;
  }

  function tabsSync(){
    var a = $('vgTabTebak'), b = $('vgTabCard');
    if (a) a.classList.toggle('active', VG.mode === 'tebak');
    if (b) b.classList.toggle('active', VG.mode === 'card');
  }
  function renderBody(){
    var b = $('vgBody');
    if (b) b.innerHTML = bodyHtml();
    tabsSync();
  }

  function bodyHtml(){
    if (VG.mode === 'card') return cardHtml();
    return tebakHtml();
  }

  function tebakHtml(){
    var optsHtml = VG.opts.map(function(opt, i){
      return '<button type="button" class="vg-opt" data-i="'+i+'" onclick="vgPick('+i+')">' + esc(opt) + '</button>';
    }).join('');
    return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
        '<span style="font-size:12px;font-weight:700;color:#6d28d9;">🔥 ' + VG.streak + ' • ✓ ' + VG.correct + '/' + VG.total + '</span>' +
      '</div>' +
      '<div style="text-align:center;font-size:24px;font-weight:800;color:#111827;margin:4px 0 12px;">' + esc(VG.word ? VG.word.en : '—') + '</div>' +
      '<div style="display:grid;gap:8px;">' + optsHtml + '</div>';
  }

  function cardHtml(){
    var v = VG.deck[VG.idx % VG.deck.length];
    var n = (VG.idx % VG.deck.length) + 1;
    return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
        '<span style="font-size:12px;font-weight:700;color:#6d28d9;background:#ede9fe;padding:2px 8px;border-radius:50px;">' + n + '/' + VG.deck.length + '</span>' +
      '</div>' +
      '<div style="text-align:center;padding:8px 0 12px;">' +
        '<div style="font-size:26px;font-weight:800;color:#111827;">' + esc(v.en) + '</div>' +
        (VG.revealed
          ? '<div style="margin-top:8px;font-size:18px;font-weight:700;color:#047857;">' + esc(v.id) + '</div>' +
            '<span style="display:inline-block;margin-top:6px;font-size:10px;font-weight:800;color:#fff;background:#8b5cf6;padding:2px 8px;border-radius:50px;">' + esc(String(v.pos).toUpperCase()) + '</span>'
          : '<div style="margin-top:10px;font-size:12px;color:#94a3b8;">teks di atas = kata Inggris</div>') +
      '</div>' +
      (VG.revealed
        ? '<button type="button" class="vg-btn" onclick="vgNext()">Kata Berikutnya</button>'
        : '<button type="button" class="vg-btn" onclick="vgFlip()">Lihat Arti</button>');
  }

  // ===== API global untuk isi modal =====
  window.vgTab = function(m){
    VG.mode = m;
    if (m === 'tebak' && !VG.word) pickRound();
    renderBody();
  };
  window.vgPick = function(i){
    if (VG.locked || isNaN(i)) return;
    VG.locked = true;
    VG.total++;
    var ok = (i === VG.correctIdx);
    if (ok) { VG.correct++; VG.streak++; if (VG.streak > VG.best) VG.best = VG.streak; }
    else VG.streak = 0;
    var b = $('vgBody');
    if (b) {
      var btns = b.querySelectorAll('.vg-opt');
      btns.forEach(function(el, bi){
        if (bi === VG.correctIdx) el.classList.add('correct');
        else if (bi === i) el.classList.add('wrong');
        el.disabled = true;
      });
    }
    setTimeout(function(){ pickRound(); renderBody(); }, ok ? 800 : 1200);
  };
  window.vgFlip = function(){ VG.revealed = true; renderBody(); };
  window.vgNext = function(){ VG.idx++; VG.revealed = false; renderBody(); };

  // ===== VISIBILITY & TICK =====
  function lobbyRendered(){
    var el = $('#rtLobbyScreen');
    if (!el) return false;
    if (el.offsetParent === null) {
      try { var cs = window.getComputedStyle(el); if (!cs || cs.display === 'none') return false; }
      catch(e){ return false; }
    }
    return true;
  }
  function hideLobbyLeaderboard(){
    var lb = $('#rtLeaderboard');
    if (!lb) return false;
    var c = lb.parentElement, hop = 0;
    while (c && c !== document.body && hop < 4) {
      if (c.classList && c.classList.contains('rt-card')) { c.style.display = 'none'; return true; }
      c = c.parentElement; hop++;
    }
    return false;
  }

  function tick(){
    var now = Date.now();
    if (now - ST.lastTick < 400) return;
    ST.lastTick = now;
    try {
      if (!vocabOk()) {
        if (!ST.warnedVocab) { ST.warnedVocab = true; wlog('RT_VOCAB kosong/rusak -> widget dinonaktifkan'); }
        return;
      }
      var vis = lobbyRendered();

      var bn = $('#bottomNav');
      if (bn) {
        var rp = $('#realtimePage');
        var active = !!(rp && rp.classList.contains('active'));
        if (active && !ST.navHidden) { bn.style.display = 'none'; ST.navHidden = true; }
        else if (!active && ST.navHidden) { bn.style.display = ''; ST.navHidden = false; }
      }

      if (vis) {
        ensureTicker();
        ensureBtn();
        var t = $('#rtVocabTicker'); if (t && t.style.display === 'none') t.style.display = 'flex';
        var b = $('#rtVocabBtn'); if (b && b.style.display === 'none') b.style.display = 'flex';
        hideLobbyLeaderboard();
        if (ST.lastState !== true) { ST.lastState = true; wlog('lobby rendered -> widgets on'); }
      } else {
        var t2 = $('#rtVocabTicker'); if (t2 && t2.style.display !== 'none') t2.style.display = 'none';
        var b2 = $('#rtVocabBtn'); if (b2 && b2.style.display !== 'none') b2.style.display = 'none';
        if (VG.modalOpen && !modalVisible()) VG.modalOpen = false;
        if (ST.lastState !== false) { ST.lastState = false; }
      }
    } catch(e){ console.error('[vocab] tick error:', e); }
  }
  setInterval(tick, 800);
  (function loop(){ try { tick(); } catch(e){} setTimeout(loop, 800); })();

  // ===== API kompatibel (dipanggil realtime.js) =====
  window.toggleVocabBg = function(show){
    try {
      if (show) {
        injectCss();
        if (vocabOk()) { ensureTicker(); ensureBtn(); }
      } else {
        var t = $('#rtVocabTicker'); if (t) t.style.display = 'none';
        var b = $('#rtVocabBtn'); if (b) b.style.display = 'none';
      }
    } catch(e){ console.error('[vocab] toggle error:', e); }
  };

  window.__vgDebug = function(){
    var info = {
      ver:'3.1',
      vocabLen:(window.RT_VOCAB||[]).length,
      lobbyRendered:lobbyRendered(),
      ticker:!!$('#rtVocabTicker'),
      tickerPaused:ST.paused,
      btn:!!$('#rtVocabBtn'),
      modalOpen:VG.modalOpen,
      modalVisible:modalVisible(),
      mode:VG.mode
    };
    wlog('debug: ' + JSON.stringify(info));
    return info;
  };

  injectCss();
  wlog('v3.1 loaded (tombol waiting-room + modal modal.js)');
})();