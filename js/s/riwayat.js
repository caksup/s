/* s#37 | /root/js/s/riwayat.js | v 1.5 | u 18/10/2026 | xu : ke-6 | note : #noteresponse
- v1.4 -> v1.5 (UPDATE: tambah sub-tab Assignment/Asesmen):
  * UPDATE #1 (KONSISTENSI dengan result.js v2.3): sessModeFlag() kini memiliki
    fallback — bila session homework tidak punya field retryMode, dianggap
    'conditional' (sesuai desain default sistem). Dengan ini badge "𝟭ˢᵗ Try" /
    "𝟮ⁿᵈ Try" di judul attempt akan MUNCUL konsisten untuk semua homework,
    tidak hanya yang eksplisit diset admin.
  * UPDATE #2: TAMBAH SUB-TAB "Assignment" untuk attempt Asesmen.
    - Sub-tabs kini berurutan: Assignment | Homework | Live | Realtime (4 tab).
    - Attempt Asesmen dibuka melalui halaman hasil dan pembahasan Asesmen.
    - Filter 'realtime' untuk attempt dengan mode==='realtime'.
    - Counter per tab update otomatis.
    - Badge mode "Realtime" ungu untuk item realtime.
  * UPDATE #3: BADGE MODE berwarna di judul attempt (selain badge status):
    - Homework: kuning (menu_book icon)
    - Live Exercise: biru (bolt icon)
    - Realtime: ungu (sports_esports icon)
    Ini membantu siswa cepat membedakan jenis sesi tanpa harus masuk detail.
  * UPDATE #4: DEBUG LOG di Console DevTools (tag [riwayat]) untuk troubleshoot
    kenapa attempt tidak muncul di sub-tab tertentu, atau kenapa badge Try tidak
    muncul.
  * UPDATE #5: Auto-pilih default tab mengikuti urutan kategori yang tersedia.
  * TETAP IDENTIK dari v1.3:
    - 2 tab internal (sekarang 4) dengan counter jumlah item per kategori.
    - Filter disimpan di PS.riwayatFilter (survive re-render tab).
    - Label "𝟭ˢᵗ Try" / "𝟮ⁿᵈ Try" untuk homework conditional.
    - fetchAttempts langsung, ensureSessions, resolveSessionNames.
    - sync PS.myAttempts (biar tab Nilai & result.js konsisten).
    - sort in_progress dulu lalu completed desc by tanggal, attemptNumber desc
      untuk retry di sesi yang sama.
    - klik completed -> showResultFromAttempt (tombol Retry muncul di result
      bila eligible, sudah di-handle result.js v2.3).
    - klik in_progress -> resumeRiwayat.
- EXPOSE: window.renderRiwayatTab, window.setRiwayatFilter, window.resumeRiwayat. */

(function(){
  'use strict';

  function escR(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function dbg(){ var a=['[riwayat]']; for(var i=0;i<arguments.length;i++) a.push(arguments[i]); console.log.apply(console, a); }
  function sessionForAttempt(a){
    return (PS.sessions||[]).find(function(s){ return String(s.id) === String(a.sessionId); });
  }

  function fmtDur(sec){
    if (!sec && sec !== 0) return '-';
    sec = Math.floor(sec);
    var m = Math.floor(sec/60), s = sec%60;
    var p = function(n){ return String(n).padStart(2,'0'); };
    return p(m) + ':' + p(s);
  }
  function fmtDate(ts){
    if (!ts) return '-';
    var d;
    try { d = ts.toDate ? ts.toDate() : new Date(ts); } catch(e){ return '-'; }
    var p = function(n){ return String(n).padStart(2,'0'); };
    return p(d.getDate()) + '/' + p(d.getMonth()+1) + '/' + d.getFullYear() +
           ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function tsValue(ts){
    if (!ts) return 0;
    try { return ts.toDate ? ts.toDate().getTime() : new Date(ts).getTime(); } catch(e){ return 0; }
  }

  // ===== Helpers mode (dengan fallback retryMode) =====
  function isHwMode(a){
    if (a && a.mode === 'homework') return true;
    var s = sessionForAttempt(a);
    return !!(s && s.mode === 'homework');
  }
  function isRtMode(a){
    if (a && a.mode === 'realtime') return true;
    var s = sessionForAttempt(a);
    return !!(s && s.mode === 'realtime');
  }
  function isAssessmentMode(a){
    if (a && a.mode === 'assessment') return true;
    var s = sessionForAttempt(a);
    return !!(s && s.mode === 'assessment');
  }
  function isLiveMode(a){
    return !isHwMode(a) && !isRtMode(a) && !isAssessmentMode(a);
  }

  // UPDATE #1: fallback retryMode='conditional' untuk homework (konsisten result.js v2.3)
  function sessModeFlag(sid){
    var s = PS.sessions.find(function(x){ return x.id === sid; });
    if (!s) return false;
    if (s.mode !== 'homework') return false;
    var retryMode = s.retryMode;
    if (!retryMode || typeof retryMode !== 'string') retryMode = 'conditional';
    return retryMode === 'conditional';
  }
  function attemptNumber(a){ return a.attemptNumber || 1; }

  function tryLabel(a){
    if (!isHwMode(a)) return '';
    if (!sessModeFlag(a.sessionId)) return '';
    var num = attemptNumber(a);
    if (num === 1) return '<span class="try-label try-1">𝟭ˢᵗ Try</span>';
    if (num === 2) return '<span class="try-label try-2">𝟮ⁿᵈ Try</span>';
    if (num > 2) return '<span class="try-label try-n">#'+num+'</span>';
    return '';
  }

  // UPDATE #3: badge mode berwarna
  function modeBadge(a){
    if (isAssessmentMode(a)) return '<span class="mode-mini mode-assessment"><span class="material-icons" style="font-size:12px;">assignment_turned_in</span>Assignment</span>';
    if (isHwMode(a)) return '<span class="mode-mini mode-hw"><span class="material-icons" style="font-size:12px;">menu_book</span>PR</span>';
    if (isRtMode(a)) return '<span class="mode-mini mode-rt"><span class="material-icons" style="font-size:12px;">sports_esports</span>Realtime</span>';
    return '<span class="mode-mini mode-live"><span class="material-icons" style="font-size:12px;">bolt</span>Live</span>';
  }

  // ===== Cache nama sesi =====
  function sessNameFromList(sid){
    var s = PS.sessions.find(function(x){ return x.id === sid; });
    return s ? (s.name || null) : null;
  }
  function nameOf(sid){
    if (!sid) return '-';
    return PS.sessionNameCache[sid] || sessNameFromList(sid) || '(Sesi tidak diketahui)';
  }

  async function resolveSessionNames(items){
    PS.sessionNameCache = PS.sessionNameCache || {};
    var missing = {};
    items.forEach(function(a){
      var sid = a.sessionId;
      if (!sid || PS.sessionNameCache[sid]) return;
      var n = sessNameFromList(sid);
      if (n) { PS.sessionNameCache[sid] = n; return; }
      missing[sid] = 1;
    });
    var ids = Object.keys(missing);
    if (!ids.length) return;
    try {
      var F = firebase.firestore;
      for (var i = 0; i < ids.length; i += 30) {
        var chunk = ids.slice(i, i + 30);
        var snap = await db.collection('sessions').where(F.FieldPath.documentId(), 'in', chunk).get();
        var found = {};
        snap.forEach(function(d){ found[d.id] = d.data().name || '(Tanpa nama)'; });
        chunk.forEach(function(sid){ PS.sessionNameCache[sid] = found[sid] || '(Sesi dihapus)'; });
      }
      dbg('resolve names:', ids.length);
    } catch(e){ console.warn('[riwayat] resolve names gagal:', e); }
  }

  async function fetchAttempts(){
    var items = [];
    try {
      var snap = await db.collection('attempts').where('studentId','==',PS.user.id).get();
      snap.forEach(function(d){ items.push(Object.assign({id:d.id}, d.data())); });
    } catch(e){ console.error('[riwayat] fetch attempts error:', e); }
    dbg('attempts loaded:', items.length);
    return items;
  }

  async function ensureSessions(){
    if (PS.sessions && PS.sessions.length) return;
    try {
      var snap = await db.collection('sessions').get();
      PS.sessions = [];
      snap.forEach(function(d){
        var s = Object.assign({id:d.id}, d.data());
        if (s.status !== false && s.visible !== false) PS.sessions.push(s);
      });
    } catch(e){}
  }

  // ===== Inject style (v1.5) =====
  function injectRiwayatStyle(){
    if (document.getElementById('riwayat-v15-style')) {
      // hapus versi lama bila ada
      var previous = document.getElementById('riwayat-v14-style');
      if (previous) previous.remove();
      var old = document.getElementById('riwayat-v13-style');
      if (old) old.remove();
      return;
    }
    var previous = document.getElementById('riwayat-v14-style');
    if (previous) previous.remove();
    var old = document.getElementById('riwayat-v13-style');
    if (old) old.remove();

    var st = document.createElement('style');
    st.id = 'riwayat-v15-style';
    st.textContent = [
      '.riwayat-subtabs{display:flex;gap:.375rem;margin-bottom:1rem;background:#f1f5f9;padding:.25rem;border-radius:10px;}',
      '.riwayat-subtab{flex:1;padding:.5rem .375rem;border:none;background:transparent;font-weight:600;font-size:.75rem;color:#64748b;cursor:pointer;border-radius:8px;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:.25rem;font-family:inherit;flex-direction:column;}',
      '.riwayat-subtab.active{background:#fff;color:#2563eb;box-shadow:0 1px 3px rgba(0,0,0,.08);}',
      '.riwayat-subtab .material-icons{font-size:16px;}',
      '.riwayat-subtab .try-count{font-size:.65rem;background:#e2e8f0;color:#475569;padding:.1rem .45rem;border-radius:50px;font-weight:700;}',
      '.riwayat-subtab.active .try-count{background:#dbeafe;color:#1e40af;}',
      /* Mode mini badge */
      '.mode-mini{display:inline-flex;align-items:center;gap:.125rem;padding:.125rem .375rem;border-radius:50px;font-size:.625rem;font-weight:700;vertical-align:middle;margin-left:.25rem;}',
      '.mode-mini.mode-hw{background:#fef3c7;color:#92400e;}',
      '.mode-mini.mode-live{background:#dbeafe;color:#1e40af;}',
      '.mode-mini.mode-rt{background:#ede9fe;color:#5b21b6;}',
      '.mode-mini.mode-assessment{background:#f3e8ff;color:#7e22ce;}',
      '.try-label{display:inline-block;font-size:.6875rem;font-weight:700;padding:.1rem .45rem;border-radius:6px;margin-left:.25rem;vertical-align:middle;}',
      '.try-label.try-1{background:#dbeafe;color:#1e40af;}',
      '.try-label.try-2{background:#fef3c7;color:#92400e;}',
      '.try-label.try-n{background:#e2e8f0;color:#475569;}',
      '.riwayat-empty{text-align:center;padding:2rem;color:#94a3b8;}',
      '.riwayat-empty .material-icons{font-size:40px;margin-bottom:.5rem;color:#cbd5e1;}',
      '.riwayat-subtab{min-width:0;}',
      '@media (max-width:480px){.riwayat-subtab{font-size:.6875rem;padding:.4rem .125rem;}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  // ===== State filter (default mengikuti urutan Assignment, Homework, Live, Realtime) =====
  function getFilter(){
    if (['assignment','homework','live','realtime'].indexOf(PS.riwayatFilter) === -1) {
      PS.riwayatFilter = 'assignment';
    }
    return PS.riwayatFilter;
  }

  // ===== RENDER =====
  async function renderRiwayatTab(){
    injectRiwayatStyle();
    var wrap = document.getElementById('riwayatList');
    if (!wrap) { console.warn('[riwayat] #riwayatList tidak ditemukan'); return; }

    var items = await fetchAttempts();
    await ensureSessions();
    await resolveSessionNames(items);

    // Sync ke PS.myAttempts (penting: result.js v2.3 pakai ini untuk cek later attempt)
    PS.myAttempts = items;

    // Sort: in_progress dulu, lalu completed desc by tanggal
    items.sort(function(a,b){
      if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
      if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
      if (a.sessionId === b.sessionId && a.status === 'completed' && b.status === 'completed') {
        var an = attemptNumber(a), bn = attemptNumber(b);
        if (an !== bn) return bn - an;
      }
      return tsValue(b.finishedAt||b.startedAt) - tsValue(a.finishedAt||a.startedAt);
    });

    // Split attempts into the four available history categories.
    var assignmentItems = items.filter(isAssessmentMode);
    var hwItems = items.filter(isHwMode);
    var liveItems = items.filter(isLiveMode);
    var rtItems = items.filter(isRtMode);

    dbg('filter counts: assignment='+assignmentItems.length+', hw='+hwItems.length+', live='+liveItems.length+', rt='+rtItems.length);

    // Keep an empty category selectable, but start on the first category with history.
    var filter = getFilter();
    var categorizedItems = {
      assignment:assignmentItems, homework:hwItems, live:liveItems, realtime:rtItems
    };
    if (!categorizedItems[filter].length) {
      var firstWithHistory = ['assignment','homework','live','realtime'].find(function(name){
        return categorizedItems[name].length > 0;
      });
      if (firstWithHistory) {
        PS.riwayatFilter = firstWithHistory;
        filter = firstWithHistory;
      }
    }

    var activeItems = categorizedItems[filter];

    // ===== Sub-tabs (4 tab) =====
    var subtabsHtml =
      '<div class="riwayat-subtabs">' +
        '<button type="button" class="riwayat-subtab'+(filter==='assignment'?' active':'')+'" onclick="setRiwayatFilter(\'assignment\')">' +
          '<span class="material-icons">assignment_turned_in</span>' +
          '<span>Assignment</span>' +
          '<span class="try-count">'+assignmentItems.length+'</span>' +
        '</button>' +
        '<button type="button" class="riwayat-subtab'+(filter==='homework'?' active':'')+'" onclick="setRiwayatFilter(\'homework\')">' +
          '<span class="material-icons">menu_book</span>' +
          '<span>Homework</span>' +
          '<span class="try-count">'+hwItems.length+'</span>' +
        '</button>' +
        '<button type="button" class="riwayat-subtab'+(filter==='live'?' active':'')+'" onclick="setRiwayatFilter(\'live\')">' +
          '<span class="material-icons">bolt</span>' +
          '<span>Live</span>' +
          '<span class="try-count">'+liveItems.length+'</span>' +
        '</button>' +
        '<button type="button" class="riwayat-subtab'+(filter==='realtime'?' active':'')+'" onclick="setRiwayatFilter(\'realtime\')">' +
          '<span class="material-icons">sports_esports</span>' +
          '<span>Realtime</span>' +
          '<span class="try-count">'+rtItems.length+'</span>' +
        '</button>' +
      '</div>';

    // ===== Items =====
    var itemsHtml = '';
    if (activeItems.length === 0) {
      var emptyIcon = filter==='assignment'?'assignment_turned_in':(filter==='homework'?'menu_book':(filter==='realtime'?'sports_esports':'bolt'));
      var emptyLabel = filter==='assignment'?'Assignment/Asesmen':(filter==='homework'?'Homework':(filter==='realtime'?'Realtime Exercise':'Live Exercise'));
      itemsHtml =
        '<div class="riwayat-empty">' +
          '<span class="material-icons">'+emptyIcon+'</span>' +
          '<p>Belum ada riwayat '+emptyLabel+'.</p>' +
        '</div>';
    } else {
      itemsHtml = activeItems.map(function(a){
        var nama = nameOf(a.sessionId);
        var badge = '', meta = '', action = '';
        var tryBadge = tryLabel(a);
        var mBadge = modeBadge(a);

        if (a.status === 'in_progress') {
          badge = '<span class="badge" style="background:#fef3c7;color:#92400e;">Berjalan</span>';
          meta = '<span><span class="material-icons">tune</span>Progress: ' + (a.progress||0) + '/' + (a.totalQuestions||0) + '</span>' +
                 '<span><span class="material-icons">timer</span>Sisa: ' + fmtDur(a.remaining) + '</span>' +
                 '<span><span class="material-icons">calendar_today</span>' + fmtDate(a.startedAt) + '</span>';
          action = 'onclick="resumeRiwayat(\'' + a.sessionId + '\')"';
        } else {
          var score = a.score || 0;
          var color = score >= 80 ? '#10b981' : (score < 50 ? '#ef4444' : '#2563eb');
          badge = '<span class="badge" style="background:' + color + ';color:#fff;">Selesai</span>';
          // UPDATE: untuk realtime, tampilkan realtimePoints juga
          var pointsInfo = '';
          if (isRtMode(a) && a.realtimePoints) {
            pointsInfo = '<span><span class="material-icons">star</span>Poin: ' + a.realtimePoints + '</span>';
          }
          meta = '<span><span class="material-icons">emoji_events</span>Nilai: <b>' + score + '</b></span>' +
                 pointsInfo +
                 '<span><span class="material-icons">check_circle</span>' + (a.correctAnswers||0) + '/' + (a.totalQuestions||0) + '</span>' +
                 '<span><span class="material-icons">hourglass_bottom</span>' + fmtDur(a.totalTime) + '</span>' +
                 '<span><span class="material-icons">calendar_today</span>' + fmtDate(a.finishedAt||a.startedAt) + '</span>';
          action = isAssessmentMode(a)
            ? 'onclick="openAssessmentResult(\'' + a.sessionId + '\',\'' + a.id + '\')"'
            : 'onclick="showResultFromAttempt(\'' + a.id + '\')"';
        }

        return '<div class="riwayat-item" ' + action + ' style="cursor:pointer;">' +
          '<div class="riwayat-main">' +
            '<div class="riwayat-title">' +
              '<span class="material-icons" style="color:#2563eb;font-size:18px;">event_available</span>' +
              escR(nama) + mBadge + tryBadge + ' ' + badge +
            '</div>' +
            '<div class="riwayat-meta">' + meta + '</div>' +
          '</div>' +
          '<span class="material-icons" style="color:#94a3b8;">chevron_right</span>' +
        '</div>';
      }).join('');
    }

    wrap.innerHTML = subtabsHtml + itemsHtml;
  }

  window.setRiwayatFilter = function(name){
    if (['assignment','homework','live','realtime'].indexOf(name) === -1) return;
    PS.riwayatFilter = name;
    renderRiwayatTab();
  };

  window.resumeRiwayat = function(sid){
    if (window.autoResume) window.autoResume(sid);
    else toast('Gagal melanjutkan sesi', 'error');
  };

  window.renderRiwayatTab = renderRiwayatTab;

  console.log('✅ riwayat.js v1.5 loaded (4 sub-tab + assessment results + mode badge)');
})();