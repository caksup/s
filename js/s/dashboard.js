/* s#15 | /root/js/s/dashboard.js | v 2.16 | u 18/10/2026 | xu : ke-21 | note : #noteresponse
- v2.15 -> v2.16 (strict assignment + jecact direct session links):
  * Aturan percobaan PR memakai isUnlimited(s):
    - retryMode 'once'  -> 1 percobaan (card hilang setelah 1 attempt completed)
    - nilai lain/'free' -> UNLIMITED percobaan s.d. deadline (ala Quizizz)
  * hwPending (aturan tampil):
      - in_progress            -> tampil (card lanjutkan)
      - deadline lewat         -> SEMBUNYI (selesai/terlewat; nilai di Nilai/Riwayat)
      - mode 'once'            -> tampil hanya bila belum ada attempt completed
      - mode free/unlimited    -> SELALU tampil selama deadline belum lewat
  * Card RETAKE (sudah >=1 attempt): info skor terbaik + "Percobaan: N"
    (TANPA pembatas /2) + tombol "Coba Lagi (Percobaan N+1)".
  * Card NORMAL (belum ada attempt): tidak berubah.
  * Assigned sessions are visible only to explicitly assigned student IDs.
  * Session links use ?jecact= and enter the selected session lobby directly.
  * TETAP:
    - detectActiveRooms query SATU 'in' + fallback per-sesi (fix "Menunggu Kode").
    - Auto-poll 20 dtk render ulang section Realtime saja.
    - refreshDashboard (refresh jaringan, spin + toast).
    - buildRtCard (card aktif hijau + kode + Gabung Sekarang).
    - filter realtime dari Live, fillMissingQuestionsCount, dispatcher 5 tab,
      debug log [dash].
  * Sinkron dengan homework.js v1.8 (retake unlimited tanpa syarat nilai).
- EXPOSE: window.loadDashboard, window.loadSessions, window.loadMyResults,
  window.renderHomeTab, window.loadAllData, window.renderStudentTab,
  window.refreshDashboard, window.detectActiveRooms, window.joinRealtimeRoom. */

(function(){
  'use strict';
  function $(id){ return document.getElementById(id); }
  var BULAN_S = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  var IN_CHUNK = 30;
  var RT_POLL_MS = 20000;
  var dashboardDataLoadedAt = 0;

  function dbg(){ var a=['[dash]']; for(var i=0;i<arguments.length;i++) a.push(arguments[i]); console.log.apply(console, a); }

  function injectDashStyles(){
    if (document.getElementById('s-dash-style-v215')) return;
    ['s-dash-style-v214','s-dash-style-v213','s-dash-style-v212','s-dash-style-v211','s-dash-style-v210','s-dash-style-v29','s-dash-style-v28','s-dash-style-v27','s-dash-style-v26'].forEach(function(id){
      var o = document.getElementById(id); if (o) o.remove();
    });
    var st = document.createElement('style');
    st.id = 's-dash-style-v215';
    st.textContent = [
      '.hw-card.hw-card-retry{background:linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%);border:2px solid #f59e0b;}',
      '.hw-card.hw-card-retry .hw-card-title{color:#92400e;font-weight:700;}',
      '.hw-retry-badge.big{background:#f59e0b;color:#fff;padding:.25rem .625rem;',
      '  border-radius:50px;font-size:.7rem;font-weight:700;display:inline-flex;',
      '  align-items:center;gap:.25rem;white-space:nowrap;}',
      '.hw-retry-info{font-size:.75rem;color:#78350f;padding:.5rem .625rem;',
      '  background:rgba(255,255,255,.6);border:1px dashed #f59e0b;border-radius:8px;',
      '  margin-top:.375rem;line-height:1.4;}',
      '.hw-retry-btn{margin-top:.625rem;width:100%;background:#f59e0b;color:#fff;',
      '  border:none;border-radius:10px;padding:.625rem .875rem;font-weight:700;',
      '  font-size:.875rem;display:inline-flex;align-items:center;justify-content:center;',
      '  gap:.375rem;cursor:pointer;transition:all .15s;font-family:inherit;',
      '  box-shadow:0 2px 6px rgba(245,158,11,.35);}',
      '.hw-retry-btn:hover{background:#d97706;}',
      '.hw-retry-btn:active{transform:scale(.99);}',
      '.hw-retry-btn .material-icons{font-size:18px;}',

      '.rt-section-head{display:flex;align-items:center;justify-content:space-between;gap:.5rem;width:100%;}',
      '.rt-section-head > div{display:flex;align-items:center;gap:.375rem;}',
      '.rt-refresh-btn{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;',
      '  width:30px;height:30px;border-radius:50%;border:none;cursor:pointer;',
      '  background:#ede9fe;color:#5b21b6;transition:all .15s;',
      '  box-shadow:0 1px 3px rgba(91,33,182,.2);}',
      '.rt-refresh-btn:hover{background:#ddd6fe;}',
      '.rt-refresh-btn:active{transform:scale(.92);}',
      '.rt-refresh-btn.loading .material-icons{animation:rtSpin .8s linear infinite;}',
      '@keyframes rtSpin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}',
      '.rt-refresh-btn .material-icons{font-size:17px;}',

      '.rt-card-active{background:linear-gradient(135deg,#ecfdf5 0%,#d1fae5 100%)!important;',
      '  border:2px solid #10b981!important;cursor:pointer;}',
      '.rt-card-active:hover{box-shadow:0 4px 12px rgba(16,185,129,.25);}',
      '.rt-card-active .session-title{color:#065f46;font-weight:700;}',
      '.rt-active-code{display:inline-block;font-family:monospace;font-size:1.125rem;',
      '  font-weight:800;letter-spacing:.15em;color:#047857;background:#fff;',
      '  padding:.25rem .625rem;border-radius:8px;border:1px solid #10b981;',
      '  margin:.375rem 0;}',
      '.rt-join-btn{margin-top:.5rem;width:100%;background:#10b981;color:#fff;',
      '  border:none;border-radius:10px;padding:.625rem .875rem;font-weight:700;',
      '  font-size:.875rem;display:inline-flex;align-items:center;justify-content:center;',
      '  gap:.375rem;cursor:pointer;font-family:inherit;',
      '  box-shadow:0 2px 6px rgba(16,185,129,.35);transition:all .15s;}',
      '.rt-join-btn:hover{background:#059669;}',
      '.rt-join-btn:active{transform:scale(.99);}',
      '.rt-join-btn .material-icons{font-size:18px;}',
      '.rt-live-badge{display:inline-flex;align-items:center;gap:.25rem;',
      '  background:#fee2e2;color:#991b1b;font-size:.65rem;font-weight:700;',
      '  padding:2px 8px;border-radius:50px;margin-left:.25rem;',
      '  animation:rtPulse 1.5s ease-in-out infinite;}',
      '@keyframes rtPulse{0%,100%{opacity:1;}50%{opacity:.7;}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  window.renderStudentTab = function(name){
    switch(name){
      case 'home':     renderHomeTab(); break;
      case 'riwayat':  if(window.renderRiwayatTab) renderRiwayatTab(); break;
      case 'nilai':    if(window.renderNilaiTab) renderNilaiTab(); break;
      case 'feedback': if(window.renderFeedbackTab) renderFeedbackTab(); break;
      case 'profile':  if(window.renderProfileTab) renderProfileTab(); break;
    }
  };

  async function loadAllData(){
    try {
      var set = await db.collection('settings').doc('global_settings').get();
      if (set.exists) {
        PS.settings.antiCheatEnabled = set.data().antiCheatEnabled !== false;
        PS.settings.maxTabSwitches = set.data().maxTabSwitches || 3;
      }
    } catch(e){}
    try {
      var snap = await db.collection('sessions').get();
      PS.sessions = [];
      snap.forEach(function(d){
        var s = Object.assign({id:d.id},d.data());
        if (s.deleted !== true && s.status !== false && s.visible !== false) PS.sessions.push(s);
      });
      console.log('[PS] sessions loaded:', PS.sessions.length);
    } catch(e){ console.error('[PS] load sessions error:', e); }
    try {
      var attSnap = await db.collection('attempts').where('studentId','==',PS.user.id).get();
      PS.myAttempts = [];
      attSnap.forEach(function(d){ PS.myAttempts.push(Object.assign({id:d.id}, d.data())); });
      console.log('[PS] attempts loaded:', PS.myAttempts.length);
    } catch(e){ console.error('[PS] load attempts error:', e); }
    dashboardDataLoadedAt=Date.now();
  }

  function computeStatus(s){
    var now = new Date();
    if (s.startTime && now < new Date(s.startTime)) return 'locked';
    if (s.endTime && now > new Date(s.endTime)) return 'expired';
    if (s.status === false || s.visible === false) return 'locked';
    return 'available';
  }

  function isHw(s){ return s.mode === 'homework'; }
  function isRealtime(s){ return s.mode === 'realtime'; }
  function isAssessment(s){ return s.mode === 'assessment'; }
  function isAssigned(s){
    var ids = s && s.assignedStudents;
    var studentId = PS.user && PS.user.id;
    if (!Array.isArray(ids) || !ids.length || studentId == null) return false;
    return ids.some(function(id){ return String(id).trim() === String(studentId).trim(); });
  }

  function hwCompletedAttempts(s){
    return PS.myAttempts.filter(function(a){ return a.sessionId===s.id && a.status==='completed'; });
  }
  function hwHasInProgress(s){
    return PS.myAttempts.some(function(a){ return a.sessionId===s.id && a.status==='in_progress'; });
  }

  // 'once' = 1x; nilai lain / kosong = free/unlimited s.d. deadline
  function getRetryMode(s){
    if (!s) return 'once';
    if (s.retryMode && typeof s.retryMode === 'string') return s.retryMode;
    return isHw(s) ? 'free' : 'once';
  }
  function isUnlimited(s){ return getRetryMode(s) !== 'once'; }

  function hwExpired(s){
    if (!s.endTime) return false;
    var end = new Date(s.endTime).getTime();
    return !isNaN(end) && Date.now() > end;
  }

  function hwBestAttempt(s){
    var atts = hwCompletedAttempts(s);
    var best = null;
    atts.forEach(function(a){ if(!best || (a.score||0)>(best.score||0)) best=a; });
    return best;
  }

  // ATURAN TAMPIL v2.15 (unlimited)
  function hwPending(s){
    if (!isHw(s)) return false;
    if (!isAssigned(s)) return false;
    if (hwHasInProgress(s)) return true;                 // sedang dikerjakan
    if (hwExpired(s)) return false;                     // deadline lewat -> tutup
    if (!isUnlimited(s)) return hwCompletedAttempts(s).length === 0;  // mode once
    return true;                                        // unlimited: tampil s.d. deadline
  }

  function p2(n){ return String(n).padStart(2,'0'); }
  function relTime(ms){
    var m = Math.floor(ms/60000);
    var d = Math.floor(m/1440); m %= 1440;
    var h = Math.floor(m/60);  m %= 60;
    if (d>0) return d+' hari '+h+' jam';
    if (h>0) return h+' jam '+m+' menit';
    return m+' menit';
  }
  function fmtDeadline(s){
    if (!s.endTime) return { text:'Tanpa deadline', urgent:false, over:false };
    var end = new Date(s.endTime);
    if (isNaN(end.getTime())) return { text:'Tanpa deadline', urgent:false, over:false };
    var abs = end.getDate()+' '+BULAN_S[end.getMonth()]+' '+end.getFullYear()+', '+p2(end.getHours())+':'+p2(end.getMinutes());
    var diff = end.getTime() - Date.now();
    if (diff <= 0) return { text:'Deadline lewat: '+abs, urgent:true, over:true };
    return { text:'Deadline: '+abs+' ('+relTime(diff)+' lagi)', urgent:(diff < 24*3600*1000), over:false };
  }

  function setSectionTitle(containerId, icon, text, color){
    var c = $(containerId);
    if (!c) return;
    var h = c.previousElementSibling;
    if (h && h.classList && h.classList.contains('section-title')) {
      h.innerHTML = '<span class="material-icons" style="color:'+(color||'#2563eb')+';">'+icon+'</span>' + text;
    }
  }

  function sessionView(s, att){
    if (att && att.status === 'completed')  return { label:'Selesai',   cls:'completed', disabled:true,  status:'completed' };
    if (att && att.status === 'in_progress')return { label:'Lanjutkan', cls:'completed', disabled:false, status:'available' };
    var st = computeStatus(s);
    if (st === 'locked')  return { label:'Belum Dimulai', cls:'locked',  disabled:true, status:'locked' };
    if (st === 'expired') return { label:'Terlewat',      cls:'expired', disabled:true, status:'expired' };
    return { label:'Mulai', cls:'available', disabled:false, status:'available' };
  }

  function openStart(sess){
    var tries = 0;
    (function attempt(){
      if (window.startSession) { window.startSession(sess.id, computeStatus(sess)); }
      else if (tries++ < 15) { setTimeout(attempt, 200); }
    })();
  }

  function clearParamOnce(){
    try {
      var url = new URL(location.href);
      url.searchParams.delete('jecact');
      url.searchParams.delete('jec-sim-tka');
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    } catch(e){ console.warn('[dash] Gagal menghapus parameter sesi:', e); }
  }

  async function handleSessionParam(){
    var code = null;
    try {
      var params = new URLSearchParams(location.search);
      code = params.get('jecact') || params.get('jec-sim-tka');
    } catch(e){ console.warn('[dash] Parameter sesi tidak dapat dibaca:', e); }
    if (!code) return;
    clearParamOnce();
    var sess = PS.sessions.find(function(s){ return String(s.code||'').toLowerCase() === String(code).toLowerCase(); });
    if (!sess) { toast('Sesi tidak ditemukan atau sedang tidak tersedia','warning'); return; }
    if (!isAssigned(sess)) { toast('Sesi ini tidak ditugaskan kepada akun Anda','error'); return; }
    var done = PS.myAttempts.find(function(a){ return a.sessionId===sess.id && a.status==='completed'; });
    if (done) {
      if (isAssessment(sess) && window.openAssessmentResult) {
        await window.openAssessmentResult(sess.id, done.id);
      } else if (window.showResultFromAttempt) {
        await window.showResultFromAttempt(done.id);
      }
      return;
    }
    var inProgress = PS.myAttempts.some(function(a){
      return a.sessionId===sess.id && a.status==='in_progress';
    });
    if (inProgress && window.autoResume) {
      await window.autoResume(sess.id);
      return;
    }
    openStart(sess);
  }

  async function loadDashboard(){
    var pN = $('pName'); if(pN) pN.textContent = PS.user.name;
    var pI = $('pId');   if(pI) pI.textContent = PS.user.id;
    var pB = $('pBatch'); if(pB) pB.textContent = 'Batch ' + (PS.user.batch||'-') + ' | Tahun ' + (PS.user.year||'-');
    await loadAllData();
    await handleSessionParam();
    if (window.PS && typeof PS.setTab === 'function') PS.setTab('home');
  }

  if (!window.startHomework) {
    window.startHomework = function(id){ if (window.startSession) startSession(id, 'available'); };
  }

  async function fillMissingQuestionsCount(sessionsToRender){
    var need = sessionsToRender.filter(function(s){ return !s.questionsCount && s.questionsCount !== 0; });
    if (!need.length) return;
    var ids = need.map(function(s){ return s.id; });
    var counts = {};
    try {
      for (var i = 0; i < ids.length; i += IN_CHUNK) {
        var chunk = ids.slice(i, i + IN_CHUNK);
        var snap = await db.collection('questions').where('sessionId', 'in', chunk).get();
        snap.forEach(function(d){
          var qd = d.data();
          if (qd.deleted === true) return;
          counts[qd.sessionId] = (counts[qd.sessionId] || 0) + 1;
        });
      }
      need.forEach(function(s){ if (counts[s.id] !== undefined) s.questionsCount = counts[s.id]; });
      console.log('[PS] questionsCount backfill:', counts);
    } catch(e){ console.warn('[PS] fill questionsCount gagal:', e.message); }
  }

  // ===== Card PR: RETAKE (>=1 attempt, unlimited) atau NORMAL (0 attempt) =====
  function buildHwPendingCard(s){
    var dl = fmtDeadline(s);
    var atts = hwCompletedAttempts(s);
    var qLabel = (s.questionsCount!=null) ? s.questionsCount : '-';
    var sid = s.id.replace(/'/g, "\\'");

    if (atts.length >= 1) {
      var best = hwBestAttempt(s);
      var nextNo = atts.length + 1;
      return '<div class="hw-card hw-card-retry">' +
        '<div class="hw-card-head">' +
          '<div class="hw-card-title"><span class="material-icons">refresh</span>' + escapeHtmlS(s.name) + '</div>' +
          '<span class="hw-retry-badge big"><span class="material-icons" style="font-size:12px;">refresh</span>COBA LAGI</span>' +
        '</div>' +
        '<div class="hw-retry-info">' +
          '<span class="material-icons" style="font-size:14px;vertical-align:-2px;">info</span> ' +
          'Skor terbaik: <b>'+(best && best.score!=null ? best.score : 0)+'</b> ' +
          '(benar '+(best && best.correctAnswers!=null ? best.correctAnswers : 0)+'/'+(best && best.totalQuestions!=null ? best.totalQuestions : 0)+')' +
          '<br>Percobaan terpakai: '+atts.length+' — nilai tertinggi yang dicatat.' +
        '</div>' +
        '<div class="hw-card-meta">' +
          '<span><span class="material-icons">quiz</span>' + qLabel + ' soal</span>' +
          '<span><span class="material-icons">timer</span>' + (s.duration||60) + ' mnt</span>' +
          '<span><span class="material-icons">history</span>Percobaan: ' + atts.length + '</span>' +
        '</div>' +
        '<button type="button" class="hw-retry-btn" onclick="startHomework(\'' + sid + '\')">' +
          '<span class="material-icons">refresh</span>Coba Lagi (Percobaan ' + nextNo + ')' +
        '</button>' +
        '<div class="hw-deadline' + (dl.urgent?' urgent':'') + '"><span class="material-icons">schedule</span>' + dl.text + '</div>' +
      '</div>';
    }

    return '<div class="hw-card" onclick="startHomework(\'' + sid + '\')">' +
      '<div class="hw-card-head">' +
        '<div class="hw-card-title"><span class="material-icons">menu_book</span>' + escapeHtmlS(s.name) + '</div>' +
      '</div>' +
      '<div class="hw-card-meta">' +
        '<span><span class="material-icons">quiz</span>' + qLabel + ' soal</span>' +
        '<span><span class="material-icons">timer</span>' + (s.duration||60) + ' mnt</span>' +
      '</div>' +
      '<div class="hw-deadline' + (dl.urgent?' urgent':'') + '"><span class="material-icons">schedule</span>' + dl.text + '</div>' +
    '</div>';
  }

  // ===== Refresh dashboard (re-fetch dari Firestore) =====
  window.refreshDashboard = async function(){
    var btn = document.querySelector('.rt-refresh-btn');
    if (btn) btn.classList.add('loading');
    try {
      await loadAllData();
      await renderHomeTab();
      if (typeof toast === 'function') toast('Dashboard disegarkan','success');
      dbg('refreshDashboard: done');
    } catch(e){
      console.error('[dash] refresh error:', e);
      if (typeof toast === 'function') toast('Gagal refresh: '+e.message,'error');
    } finally {
      if (btn) btn.classList.remove('loading');
    }
  };

  // ===== Deteksi room Realtime aktif (SATU filter 'in' + fallback) =====
  function tsMs(t){
    try { return t && t.toDate ? t.toDate().getTime() : (t ? new Date(t).getTime() : 0); }
    catch(e){ return 0; }
  }
  function isNewer(a, b){ return tsMs(a.createdAt) >= tsMs(b.createdAt); }

  window.detectActiveRooms = async function(sessionIds){
    var map = {};
    if (!sessionIds || !sessionIds.length) return map;
    var idSet = {};
    sessionIds.forEach(function(id){ idSet[id] = 1; });

    try {
      var snap = await db.collection('liveRooms')
        .where('status', 'in', ['lobby', 'playing'])
        .get();
      var best = {};
      snap.forEach(function(d){
        var data = Object.assign({id:d.id}, d.data());
        var sid = data.sessionId;
        if (!sid || !idSet[sid]) return;
        if (!best[sid] || isNewer(data, best[sid])) best[sid] = data;
      });
      var keys = Object.keys(best);
      for (var i = 0; i < keys.length; i++) {
        var r = best[keys[i]];
        var pc = 0;
        try {
          var pSnap = await db.collection('liveRooms').doc(r.id).collection('players').get();
          pc = pSnap.size;
        } catch(e){}
        map[keys[i]] = { roomId:r.id, code:r.code||'', status:r.status, playerCount:pc, createdAt:r.createdAt };
      }
      dbg('detectActiveRooms OK:', keys.length, 'room aktif');
      return map;
    } catch(e){
      console.warn('[dash] detectActiveRooms jalur utama gagal, fallback per-sesi:', e && e.message);
    }

    for (var j = 0; j < sessionIds.length; j++) {
      try {
        var sSnap = await db.collection('liveRooms')
          .where('sessionId', '==', sessionIds[j])
          .where('status', 'in', ['lobby', 'playing'])
          .get();
        var best2 = null;
        sSnap.forEach(function(d){
          var data = Object.assign({id:d.id}, d.data());
          if (!best2 || isNewer(data, best2)) best2 = data;
        });
        if (best2) {
          var pc2 = 0;
          try {
            var ps2 = await db.collection('liveRooms').doc(best2.id).collection('players').get();
            pc2 = ps2.size;
          } catch(e2){}
          map[sessionIds[j]] = { roomId:best2.id, code:best2.code||'', status:best2.status, playerCount:pc2, createdAt:best2.createdAt };
        }
      } catch(e3){}
    }
    dbg('detectActiveRooms fallback:', Object.keys(map).length, 'room aktif');
    return map;
  };

  window.joinRealtimeRoom = function(code){
    if (!code) {
      if (typeof toast === 'function') toast('Kode tidak tersedia','error');
      return;
    }
    var baseUrl = location.href.split('?')[0];
    window.location.href = baseUrl + '?jec-rt=' + encodeURIComponent(code);
  };

  function ensureRtSection(){
    var rtContainer = $('homeRtList');
    if (rtContainer) return rtContainer;
    var homePage = $('page-home');
    if (!homePage) return null;
    var h2 = document.createElement('h2');
    h2.className = 'section-title';
    h2.innerHTML =
      '<div class="rt-section-head">' +
        '<div>' +
          '<span class="material-icons" style="color:#7c3aed;">sports_esports</span>' +
          'Realtime Exercise' +
        '</div>' +
        '<button type="button" class="rt-refresh-btn" onclick="refreshDashboard()" title="Segarkan dashboard">' +
          '<span class="material-icons">refresh</span>' +
        '</button>' +
      '</div>';
    rtContainer = document.createElement('div');
    rtContainer.id = 'homeRtList';
    homePage.appendChild(h2);
    homePage.appendChild(rtContainer);
    return rtContainer;
  }

  function buildRtCard(s, activeRoom){
    var qLabel = (s.questionsCount!=null) ? s.questionsCount : '-';
    var code = activeRoom ? activeRoom.code : '';

    if (activeRoom && code) {
      var statusLabel = activeRoom.status === 'playing' ? 'LIVE' : 'LOBBY';
      var statusIcon = activeRoom.status === 'playing' ? 'radio_button_checked' : 'hourglass_empty';
      return '<div class="session-item rt-card-active" onclick="joinRealtimeRoom(\'' + escapeHtmlS(code) + '\')">' +
        '<div>' +
          '<div class="session-title"><span class="material-icons" style="color:#059669;">sports_esports</span>' +
            escapeHtmlS(s.name) +
            ' <span class="rt-live-badge"><span class="material-icons" style="font-size:10px;">'+statusIcon+'</span>'+statusLabel+'</span>' +
          '</div>' +
          '<div class="session-meta">' +
            '<span><span class="material-icons">timer</span>' + (s.duration||60) + ' mnt</span>' +
            '<span><span class="material-icons">quiz</span>' + qLabel + ' soal</span>' +
            '<span><span class="material-icons">groups</span>' + (activeRoom.playerCount||0) + ' pemain</span>' +
          '</div>' +
          '<div class="rt-active-code">'+escapeHtmlS(code)+'</div>' +
          '<button type="button" class="rt-join-btn" onclick="event.stopPropagation();joinRealtimeRoom(\'' + escapeHtmlS(code) + '\')">' +
            '<span class="material-icons">login</span>Gabung Sekarang' +
          '</button>' +
        '</div>' +
      '</div>';
    }

    return '<div class="session-item disabled">' +
      '<div><div class="session-title"><span class="material-icons" style="color:#7c3aed;">sports_esports</span>' +
        escapeHtmlS(s.name) +
        ' <span class="session-status" style="background:#ede9fe;color:#5b21b6;font-size:.65rem;padding:2px 6px;">Realtime</span>' +
      '</div>' +
      '<div class="session-meta">' +
        '<span><span class="material-icons">timer</span>' + (s.duration||60) + ' mnt</span>' +
        '<span><span class="material-icons">quiz</span>' + qLabel + ' soal</span>' +
      '</div>' +
      '<div style="font-size:.75rem;color:#7c3aed;margin-top:.25rem;font-weight:500;">' +
        'Sesi ini harus dimulai lewat kode Realtime dari guru. Kartu berubah otomatis saat guru memulai sesi.' +
      '</div></div>' +
      '<span class="session-status locked">Menunggu Kode</span></div>';
  }

  function renderRtSection(rtAssigned, activeRooms){
    var rtWrap = $('homeRtList');
    if (!rtWrap) return;
    if (!rtAssigned.length) {
      rtWrap.innerHTML =
        '<div class="empty-state" style="padding:1.5rem;"><span class="material-icons">sports_esports</span>' +
        '<p>Belum ada sesi realtime yang ditugaskan untuk Anda.</p></div>';
      return;
    }
    rtWrap.innerHTML = rtAssigned.map(function(s){
      return buildRtCard(s, activeRooms[s.id] || null);
    }).join('');
  }

  function rtAssignedSessions(){
    return PS.sessions.filter(function(s){
      if (!isRealtime(s)) return false;
      return isAssigned(s);
    });
  }

  var rtPollTimer = null;
  function startRtPoller(){
    if (rtPollTimer) return;
    rtPollTimer = setInterval(async function(){
      try {
        var home = $('page-home');
        if (!home || !home.classList.contains('active')) return;
        if (document.hidden) return;
        if (!PS.sessions || !PS.sessions.length) return;
        var rtAssigned = rtAssignedSessions();
        if (!rtAssigned.length) return;
        var activeRooms = await window.detectActiveRooms(rtAssigned.map(function(s){ return s.id; }));
        renderRtSection(rtAssigned, activeRooms);
      } catch(e){}
    }, RT_POLL_MS);
  }

  async function renderHomeTab(){
    injectDashStyles();
    dbg('renderHomeTab: start');
    if(!PS.sessions||!PS.sessions.length||Date.now()-dashboardDataLoadedAt>10000) await loadAllData();

    var sesiDikerjakan = PS.myAttempts.length;
    var soalDikerjakan = 0, totalScore = 0, countCompleted = 0;
    PS.myAttempts.forEach(function(a){
      if (a.status === 'completed') { soalDikerjakan += (a.totalQuestions||0); totalScore += (a.score||0); countCompleted++; }
      else if (a.progress) soalDikerjakan += a.progress;
    });
    var avgNilai = countCompleted ? Math.round(totalScore/countCompleted) : 0;

    var ov = $('homeOverview');
    if (ov) {
      ov.innerHTML =
        '<div class="mini-grid">' +
          '<div class="mini-card mini-card-primary"><div class="mini-icon"><span class="material-icons">event_available</span></div>' +
            '<div class="mini-label">Sesi Dikerjakan</div><div class="mini-value">' + sesiDikerjakan + '</div></div>' +
          '<div class="mini-card mini-card-success"><div class="mini-icon"><span class="material-icons">quiz</span></div>' +
            '<div class="mini-label">Soal Dikerjakan</div><div class="mini-value">' + soalDikerjakan + '</div></div>' +
          '<div class="mini-card mini-card-warning"><div class="mini-icon"><span class="material-icons">emoji_events</span></div>' +
            '<div class="mini-label">Rata-rata Nilai</div><div class="mini-value">' + avgNilai + '</div></div>' +
        '</div>';
    }

    var hwActive = PS.sessions.filter(hwPending);
    var assessmentSessions = PS.sessions.filter(function(s){ return isAssessment(s) && isAssigned(s); });
    var liveSessions = PS.sessions.filter(function(s){
      return !isHw(s) && !isRealtime(s) && !isAssessment(s) && isAssigned(s) && !hwExpired(s);
    });
    var perlu = liveSessions.filter(function(s){
      var att = PS.myAttempts.find(function(a){ return a.sessionId === s.id; });
      var v = sessionView(s, att);
      return (v.label === 'Mulai' || v.label === 'Lanjutkan');
    });
    var rtAssigned = rtAssignedSessions();

    dbg('filter: hwActive='+hwActive.length+', liveTersedia='+perlu.length+', rt='+rtAssigned.length);

    await fillMissingQuestionsCount([].concat(hwActive, perlu, rtAssigned, assessmentSessions));
    if (window.renderAssessmentDashboard) window.renderAssessmentDashboard();

    setSectionTitle('homeNotif', 'menu_book', 'Homework Pending (PR)', '#f59e0b');
    var hwWrap = $('homeNotif');
    if (hwWrap) {
      if (hwActive.length === 0) {
        hwWrap.innerHTML =
          '<div class="empty-state" style="padding:1.5rem;"><span class="material-icons">check_circle</span>' +
          '<p>Tidak ada homework pending. Kerja bagus!</p></div>';
      } else {
        var retakeCards = [], normalCards = [];
        hwActive.forEach(function(s){
          if (hwCompletedAttempts(s).length >= 1) retakeCards.push(buildHwPendingCard(s));
          else normalCards.push(buildHwPendingCard(s));
        });
        hwWrap.innerHTML = retakeCards.concat(normalCards).join('');
      }
    }

    setSectionTitle('homeSesiList', 'bolt', 'Live Exercise Tersedia', '#2563eb');
    var liveWrap = $('homeSesiList');
    if (liveWrap) {
      if (perlu.length === 0) {
        liveWrap.innerHTML =
          '<div class="empty-state" style="padding:1.5rem;"><span class="material-icons">event_busy</span>' +
          '<p>Tidak ada live exercise yang perlu dikerjakan saat ini.</p></div>';
      } else {
        liveWrap.innerHTML = perlu.map(function(s){
          var att = PS.myAttempts.find(function(a){ return a.sessionId === s.id; });
          var v = sessionView(s, att);
          var cls = 'session-item' + (v.label==='Lanjutkan' ? ' resume' : '');
          var sub = (v.label === 'Lanjutkan') ? ('Progress: ' + (att.progress||0) + '/' + (att.totalQuestions||0)) : 'Belum dikerjakan';
          var qLabel = (s.questionsCount!=null) ? s.questionsCount : '-';
          return '<div class="' + cls + '" onclick="startSession(\'' + s.id + '\',\'' + v.status + '\')">' +
            '<div><div class="session-title"><span class="material-icons">bolt</span>' + escapeHtmlS(s.name) + '</div>' +
            '<div class="session-meta">' +
              '<span><span class="material-icons">timer</span>' + (s.duration||60) + ' mnt</span>' +
              '<span><span class="material-icons">quiz</span>' + qLabel + ' soal</span>' +
            '</div>' +
            '<div style="font-size:.75rem;color:#64748b;margin-top:.25rem;">' + sub + '</div></div>' +
            '<span class="session-status ' + v.cls + '">' + v.label + '</span></div>';
        }).join('');
      }
    }

    ensureRtSection();
    var activeRooms = {};
    if (rtAssigned.length > 0) {
      activeRooms = await window.detectActiveRooms(rtAssigned.map(function(s){ return s.id; }));
    }
    renderRtSection(rtAssigned, activeRooms);
    startRtPoller();
  }

  async function loadSessions(){ if (!PS.sessions || !PS.sessions.length) await loadAllData(); }
  async function loadMyResults(){ if (!PS.myAttempts) await loadAllData(); }
  function escapeHtmlS(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  window.loadDashboard = loadDashboard;
  window.loadSessions = loadSessions;
  window.loadMyResults = loadMyResults;
  window.renderHomeTab = renderHomeTab;
  window.loadAllData = loadAllData;

  console.log('✅ dashboard.js v2.15 loaded (PR unlimited: card tampil s.d. deadline, retake bebas)');
})();
