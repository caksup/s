/* s#14 | /root/js/s/realtime.js | v 2.1 | u 18/09/2026 • 08:15:00 | xu : ke-11 | note : #noteresponse
- v2.0 -> v2.1 (FIX KRITIS: siswa tidak bisa login):
  * ROOT CAUSE: v2.0 mengekspor window.showScreen = showScreen (versi rt yang
    hanya mengatur 4 screen rt). Ini MENIMPA showScreen global milik
    state.js/login.js sehingga setelah login sukses layar tidak berpindah
    (studentApp tidak muncul) -> seolah "gagal login".
  * FIX #1: fungsi internal diganti nama menjadi rtShowScreen() dan DIEKSPOR
    sebagai window.rtShowScreen SAJA. window.showScreen TIDAK disentuh.
  * FIX #2: semua helper ekspor diberi prefix rt* agar tidak bentrok dengan
    global milik test.js/state.js: rtEnsureQuestionsLoaded,
    rtGetCurrentQuestion, rtNormalPoints, rtEndsAtMs, rtDurationSec, rtIdx,
    rtResetAnswerState, rtUpdateOnlineIndicator, rtSubscribe,
    rtUnsubscribeAll, rtStartTick, rtStartWatchdog.
    (buildOptionsHtml kini milik s-rt-render sebagai window.rtBuildOptionsHtml)
  * TETAP: validasi JEC-xxx/JEC-RTxxx/6-char, rtOpenJoin, auto-detect URL,
    rejoin localStorage, CSS injection, fix PGK in-place + wipe-guard,
    peserta & leaderboard via s-rt-render, vocab via s-rt-lobby-vocab.
- EXPOSE: window.rtJoinLobby, window.rtSubmitAnswer, window.rtBackToHome,
  window.rtSelectOption, window.rtToggleMCMA, window.rtTogglePGK,
  window.rtUpdateIsian, window.rtRefreshConnection, window.rtOpenJoin,
  window.rtShowScreen. */

(function(){
  'use strict';
  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function getParam(key){ try { return new URL(window.location.href).searchParams.get(key); } catch(e){ return null; } }
  function normCode(v){ return String(v || '').trim().toUpperCase(); }
  function safeId(v){ return String(v || '').replace(/[^a-zA-Z0-9_-]/g,'_'); }

  function toastSafe(msg,type){ if (typeof toast === 'function') toast(msg, type || 'info'); else console.log('[rt]', type || 'info', msg); }
  function alertSafe(title,msg,type){ if (typeof alert2 === 'function') alert2(title,msg,type || 'info'); else alert(title + '\n\n' + String(msg).replace(/<[^>]+>/g,'')); }
  window.alertSafe = alertSafe;
  function loadSafe(msg){ if (typeof loading === 'function') return loading(msg); return { close: function(){} }; }

  function isValidJoinCode(code){
    if (!code) return false;
    if (/^JEC-\d{3,}$/i.test(code)) return true;
    if (/^JEC-RT\d{3,}$/i.test(code)) return true;
    if (/^[A-Z0-9]{6}$/.test(code)) return true;
    return false;
  }

  function injectRtStyles(){
    if (document.getElementById('rt-style-v15')) return;
    var st = document.createElement('style');
    st.id = 'rt-style-v15';
    st.textContent = [
      '.rt-page{background:#f6f8fb;}',
      '.rt-container{max-width:560px;margin:0 auto;padding:.875rem .875rem 3rem;}',
      '.rt-hero{border-radius:16px;padding:1.125rem 1rem;margin-bottom:.875rem;text-align:center;background:linear-gradient(135deg,#6d28d9 0%,#4c1d95 100%);color:#fff;box-shadow:0 6px 18px rgba(76,29,149,.25);}',
      '.rt-hero h1{font-size:1.0625rem;font-weight:700;margin:.25rem 0 .125rem;}',
      '.rt-hero p{font-size:.8125rem;opacity:.85;margin:0;}',
      '.rt-hero .rt-code{font-size:1.625rem;font-weight:800;font-family:monospace;letter-spacing:.18em;margin:.625rem auto .25rem;background:rgba(255,255,255,.14);padding:.375rem .875rem;border-radius:10px;display:inline-block;}',
      '.rt-card{background:#fff;border:1px solid #e6eaf0;border-radius:14px;padding:.875rem;margin-bottom:.75rem;box-shadow:0 1px 3px rgba(16,24,40,.05);}',
      '.rt-player-chip{display:flex;align-items:center;gap:.5rem;padding:.4375rem .625rem;background:#f8fafc;border:1px solid #eef2f6;border-radius:8px;font-size:.8125rem;color:#334155;margin-bottom:.3125rem;}',
      '.rt-player-chip .material-icons{font-size:15px;color:#94a3b8;}',
      '#rtPlayingScreen .rt-hero{position:sticky;top:0;z-index:20;border-radius:0 0 14px 14px;padding:.625rem .875rem;margin:-0.875rem -0.875rem .875rem;display:flex;align-items:center;justify-content:space-between;gap:.625rem;text-align:left;}',
      '#rtPlayingScreen .rt-hero .rt-timer-big{font-size:1.375rem;margin:0;font-weight:800;color:#fff;}',
      '#rtPlayingScreen .rt-hero .rt-timer-big.urgent{color:#fecaca;}',
      '.rt-qmeta{font-size:.75rem;opacity:.9;}',
      '.rt-option{padding:.8125rem .875rem;background:#fff;border:1.5px solid #e6eaf0;border-radius:12px;margin-bottom:.5rem;cursor:pointer;font-size:.9375rem;line-height:1.45;transition:border-color .12s, background .12s;}',
      '.rt-option:active{transform:scale(.995);}',
      '.rt-option.selected{border-color:#6d28d9;background:#f5f3ff;font-weight:600;}',
      '.rt-option .opt-letter{display:inline-flex;align-items:center;justify-content:center;width:1.375rem;height:1.375rem;border-radius:8px;background:#f1f5f9;color:#475569;font-weight:700;font-size:.8125rem;margin-right:.5rem;flex:0 0 auto;}',
      '.rt-option.selected .opt-letter{background:#6d28d9;color:#fff;}',
      '#rtAnswerFeedback{border-radius:12px;padding:.75rem .875rem;}',
      '.rt-leaderboard-row{display:flex;align-items:center;gap:.5rem;padding:.4375rem .5rem;border-bottom:1px solid #f1f5f9;font-size:.8125rem;}',
      '.rt-leaderboard-row:last-child{border-bottom:none;}',
      '.rt-leaderboard-row.me{background:#fffbeb;border-radius:8px;}',
      '.rt-leaderboard-row .rt-rank{width:1.75rem;text-align:center;font-weight:700;color:#6d28d9;flex:0 0 auto;}',
      '.rt-leaderboard-row .rt-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.rt-leaderboard-row .rt-score{font-weight:700;color:#047857;flex:0 0 auto;}',
      '#rtSubmitArea .btn{border-radius:12px;}',
      '.rt-online-radar{display:inline-block;width:10px;height:10px;background:#10b981;border-radius:50%;margin-right:.375rem;vertical-align:middle;animation:rtRadarPulse 2s ease-in-out infinite;}',
      '.rt-online-radar.offline{background:#ef4444;animation:none;}',
      '@keyframes rtRadarPulse{0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.7);}50%{box-shadow:0 0 0 6px rgba(16,185,129,0);}}',
      '.rt-vocab-bg{position:fixed;top:0;left:0;width:100%;height:100%;overflow:hidden;pointer-events:none;z-index:0;}',
      '.rt-vocab-item{position:absolute;top:-40px;font-weight:600;font-size:.9375rem;color:#a78bfa;opacity:.45;white-space:nowrap;animation:rtVocabFloat var(--rt-dur, 22s) linear var(--rt-delay, 0s) infinite;text-shadow:0 1px 3px rgba(255,255,255,.8);}',
      '.rt-vocab-item .rt-pos{font-size:.625rem;font-weight:700;color:#fff;background:#8b5cf6;padding:1px 5px;border-radius:50px;margin-left:.25rem;text-transform:uppercase;letter-spacing:.03em;}',
      '@keyframes rtVocabFloat{0%{transform:translateY(-10vh) rotate(-3deg);opacity:0;}10%{opacity:.6;}90%{opacity:.6;}100%{transform:translateY(105vh) rotate(3deg);opacity:0;}}',
      '.rt-head-actions{display:flex;gap:.375rem;align-items:center;}',
      '.rt-head-btn{background:rgba(255,255,255,.18);border:none;color:#fff;padding:.375rem;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;transition:background .15s;}',
      '.rt-head-btn:hover{background:rgba(255,255,255,.3);}',
      '.rt-head-btn .material-icons{font-size:18px;}',
      '.rt-participants-card{margin-top:.75rem;}',
      '@media (max-width:400px){.rt-container{padding:.625rem .625rem 3rem;}#rtPlayingScreen .rt-hero{margin:-0.625rem -0.625rem .75rem;}.rt-option{font-size:.875rem;padding:.75rem;}.rt-vocab-item{font-size:.8125rem;}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  // FIX #1: nama baru, TIDAK menimpa window.showScreen
  function rtShowScreen(screenId){
    ['rtJoinScreen','rtLobbyScreen','rtPlayingScreen','rtFinishedScreen'].forEach(function(id){
      var el = $(id);
      if (el) el.style.display = (id === screenId) ? 'block' : 'none';
    });
    if (typeof window.toggleVocabBg === 'function') window.toggleVocabBg(screenId === 'rtLobbyScreen');
  }
  window.rtShowScreen = rtShowScreen;

  function setJoinError(msg){ var el = $('rtJoinError'); if (!el) return; el.textContent = msg || ''; el.style.display = msg ? 'block' : 'none'; }

  function showRealtimePage(){
    var rtPage = $('realtimePage');
    if (rtPage) rtPage.classList.add('active');
    ['loginScreen','studentApp','testPage','resultPage'].forEach(function(id){
      var el = $(id); if (el) el.style.display = 'none';
    });
  }

  function showLoginForRealtime(){
    var rtPage = $('realtimePage');
    if (rtPage) rtPage.classList.remove('active');
    var loginScreen = $('loginScreen');
    if (loginScreen) loginScreen.style.display = 'flex';
    ['studentApp','testPage','resultPage'].forEach(function(id){
      var el = $(id); if (el) el.style.display = 'none';
    });
    var err = $('loginErr');
    if (err) { err.style.display = 'block'; err.textContent = 'Login dulu untuk masuk Realtime Exercise.'; }
  }

  function hideManualNameInput(){
    var nameInput = $('rtNameInput');
    if (!nameInput) return;
    var fg = nameInput.closest ? nameInput.closest('.form-group') : null;
    if (fg) fg.style.display = 'none';
    var codeInput = $('rtCodeInput');
    if (codeInput) { codeInput.readOnly = true; codeInput.style.opacity = '.85'; }
  }

  function showManualNameInput(){
    var nameInput = $('rtNameInput');
    if (!nameInput) return;
    var fg = nameInput.closest ? nameInput.closest('.form-group') : null;
    if (fg) fg.style.display = 'block';
    var codeInput = $('rtCodeInput');
    if (codeInput) { codeInput.readOnly = false; codeInput.style.opacity = '1'; }
  }

  function updateJoinIdentityText(){
    var btn = document.querySelector('#rtJoinScreen button[onclick*="rtJoinLobby"]');
    if (btn && window.PS && PS.user) {
      btn.innerHTML = '<span class="material-icons">login</span>Masuk sebagai ' + esc(PS.user.name || PS.user.id);
    }
  }

  // ===== STATE =====
  window.RT = window.RT || {};
  RT.roomCode = RT.roomCode || null;
  RT.roomId = RT.roomId || null;
  RT.playerId = RT.playerId || null;
  RT.playerName = RT.playerName || null;
  RT.unsubRoom = RT.unsubRoom || null;
  RT.unsubPlayers = RT.unsubPlayers || null;
  RT.unsubAnswers = RT.unsubAnswers || null;
  RT.tickTimer = RT.tickTimer || null;
  RT.watchTimer = RT.watchTimer || null;
  RT.room = RT.room || null;
  RT.players = RT.players || {};
  RT.answers = RT.answers || {};
  RT.questions = RT.questions || [];
  RT.questionsById = RT.questionsById || {};
  RT.questionsLoadedForSession = RT.questionsLoadedForSession || null;
  RT.currentQIndex = RT.currentQIndex == null ? -999 : RT.currentQIndex;
  RT.currentQId = RT.currentQId || null;
  RT.myAnswer = RT.myAnswer == null ? null : RT.myAnswer;
  RT.submitted = !!RT.submitted;
  RT.lastRenderedAnswerKey = RT.lastRenderedAnswerKey || '';
  RT.realtimeParamCode = null;
  RT.waitLoginTimer = null;
  RT.online = true;

  // ===== QUESTIONS =====
  async function rtEnsureQuestionsLoaded(){
    if (!RT.room || !RT.room.sessionId) return false;
    if (RT.questionsLoadedForSession === RT.room.sessionId && RT.questionsById && Object.keys(RT.questionsById).length) return true;
    try {
      var snap = await db.collection('questions').where('sessionId','==',RT.room.sessionId).get();
      var arr = [], map = {};
      snap.forEach(function(d){
        var q = Object.assign({id:d.id}, d.data());
        if (q.deleted === true) return;
        if (q.type === 'PGK' && window.normalizeQuestionBooleanAnswers) {
          var normalized = window.normalizeQuestionBooleanAnswers(q.correctAnswer);
          if (normalized) q.correctAnswer = normalized;
        }
        arr.push(q); map[q.id] = q;
      });
      if (RT.room.questionIds && RT.room.questionIds.length) {
        arr.sort(function(a,b){ return RT.room.questionIds.indexOf(a.id) - RT.room.questionIds.indexOf(b.id); });
      } else {
        arr.sort(function(a,b){ return (a.order||0) - (b.order||0); });
      }
      RT.questions = arr; RT.questionsById = map; RT.questionsLoadedForSession = RT.room.sessionId;
      return true;
    } catch(e){ console.error('[rt] load questions failed:', e); return false; }
  }
  window.rtEnsureQuestionsLoaded = rtEnsureQuestionsLoaded;

  function rtGetCurrentQuestion(){
    if (!RT.room) return null;
    var idx = (typeof window.rtIdx === 'function') ? window.rtIdx() : -1;
    var qid = (RT.room.questionIds && idx >= 0) ? RT.room.questionIds[idx] : null;
    if (qid && RT.questionsById && RT.questionsById[qid]) return { index: idx, id: qid, data: RT.questionsById[qid] };
    if (RT.questions && RT.questions[idx]) return { index: idx, id: RT.questions[idx].id, data: RT.questions[idx] };
    return { index: idx, id: qid, data: null };
  }
  window.rtGetCurrentQuestion = rtGetCurrentQuestion;

  // ===== INIT URL =====
  function initRealtimeFromUrl(){
    injectRtStyles();
    var code = normCode(getParam('jec-rt'));
    if (!code) return;
    RT.realtimeParamCode = code;
    RT.roomCode = code;
    var codeInput = $('rtCodeInput');
    if (codeInput) codeInput.value = code;
    hideManualNameInput();
    if (!window.PS || !PS.user || !PS.user.id) {
      showLoginForRealtime();
      waitLoginThenJoin(code);
      return;
    }
    beginRealtimeForLoggedUser(code);
  }

  function waitLoginThenJoin(code){
    if (RT.waitLoginTimer) clearInterval(RT.waitLoginTimer);
    var tries = 0;
    RT.waitLoginTimer = setInterval(function(){
      tries++;
      if (window.PS && PS.user && PS.user.id) {
        clearInterval(RT.waitLoginTimer);
        RT.waitLoginTimer = null;
        beginRealtimeForLoggedUser(code);
        return;
      }
      if (tries > 600) { clearInterval(RT.waitLoginTimer); RT.waitLoginTimer = null; }
    }, 500);
  }

  function beginRealtimeForLoggedUser(code){
    showRealtimePage();
    rtShowScreen('rtJoinScreen');
    hideManualNameInput();
    updateJoinIdentityText();
    var codeInput = $('rtCodeInput');
    if (codeInput) codeInput.value = code;
    setTimeout(function(){ window.rtJoinLobby(); }, 250);
  }

  window.rtOpenJoin = function(){
    injectRtStyles();
    RT.realtimeParamCode = null;
    RT.roomCode = null;
    showRealtimePage();
    rtShowScreen('rtJoinScreen');
    showManualNameInput();
    var codeInput = $('rtCodeInput');
    if (codeInput) {
      codeInput.value = '';
      codeInput.readOnly = false;
      codeInput.style.opacity = '1';
      setTimeout(function(){ codeInput.focus(); }, 100);
    }
    setJoinError('');
    updateJoinIdentityText();
  };

  // ===== JOIN =====
  window.rtJoinLobby = async function(){
    setJoinError('');
    if (!window.PS || !PS.user || !PS.user.id) { showLoginForRealtime(); return; }
    var codeInput = $('rtCodeInput');
    var code = normCode((codeInput && codeInput.value) || RT.roomCode || RT.realtimeParamCode);
    if (!isValidJoinCode(code)) {
      setJoinError('Kode tidak valid. Format: JEC-001 (atau JEC-RTxxx / 6-char).');
      return;
    }
    var studentId = String(PS.user.id);
    var studentName = PS.user.name || PS.user.fullName || studentId;
    var playerId = safeId(studentId);

    try {
      var roomSnap = await db.collection('liveRooms').where('code','==',code).where('status','in',['lobby','playing']).get();
      if (roomSnap.empty) { setJoinError('Kode tidak ditemukan / room belum aktif / sesi selesai.'); return; }
      var roomDoc = null;
      roomSnap.forEach(function(d){ if (!roomDoc) roomDoc = Object.assign({id:d.id}, d.data()); });
      if (!roomDoc || !roomDoc.id) { setJoinError('Room tidak valid.'); return; }

      RT.roomCode = code; RT.roomId = roomDoc.id; RT.room = roomDoc;
      RT.playerId = playerId; RT.playerName = studentName;

      try {
        if (roomDoc.sessionId) {
          var sessDoc = await db.collection('sessions').doc(roomDoc.sessionId).get();
          if (sessDoc.exists) {
            var arr = sessDoc.data().assignedStudents || [];
            if (arr.length && arr.indexOf(studentId) === -1) {
              setJoinError('Anda tidak terdaftar pada sesi realtime ini.');
              return;
            }
          }
        }
      } catch(e){}

      await db.collection('liveRooms').doc(roomDoc.id).collection('players').doc(playerId).set({
        studentId: studentId, name: studentName, loginName: studentName,
        joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastActive: firebase.firestore.FieldValue.serverTimestamp(),
        totalScore: 0
      }, { merge:true });

      try {
        localStorage.setItem('rt_join_' + normCode(code) + '_' + safeId(studentId), JSON.stringify({
          code: code, roomId: roomDoc.id, playerId: playerId,
          playerName: studentName, studentId: studentId
        }));
      } catch(e){}

      showRealtimePage();
      if (typeof window.rtSubscribe === 'function') window.rtSubscribe();

      if (roomDoc.status === 'playing') {
        rtShowScreen('rtPlayingScreen');
        if (typeof window.rtRenderQuestion === 'function') await window.rtRenderQuestion(true);
      } else {
        rtShowScreen('rtLobbyScreen');
        if (typeof window.rtRenderLobby === 'function') window.rtRenderLobby();
      }
    } catch(e){
      console.error('[rt] join failed:', e);
      setJoinError('Gagal join: ' + e.message);
    }
  };

  // ===== INTERACTION =====
  window.rtSelectOption = function(val){
    if (RT.submitted) return;
    RT.myAnswer = val;
    document.querySelectorAll('#rtOptions .rt-option').forEach(function(el){
      el.classList.toggle('selected', el.dataset.val === val);
    });
  };

  window.rtToggleMCMA = function(val){
    if (RT.submitted) return;
    var sel = Array.isArray(RT.myAnswer) ? RT.myAnswer.slice() : [];
    var i = sel.indexOf(val);
    if (i === -1) sel.push(val); else sel.splice(i,1);
    RT.myAnswer = sel;
    document.querySelectorAll('#rtOptions .rt-option').forEach(function(el){
      el.classList.toggle('selected', sel.indexOf(el.dataset.val) !== -1);
    });
  };

  window.rtTogglePGK = function(i,val){
    if (RT.submitted) return;
    var arr = Array.isArray(RT.myAnswer) ? RT.myAnswer.slice() : [];
    while (arr.length <= i) arr.push(null);
    arr[i] = val;
    RT.myAnswer = arr;
    var box = document.querySelector('#rtOptions .rt-option[data-stmt="'+i+'"]');
    if (box) {
      box.querySelectorAll('button[data-val]').forEach(function(b){
        var on = (b.getAttribute('data-val') === 'true') ? (val === true) : (val === false);
        b.classList.toggle('btn-primary', on);
        b.classList.toggle('btn-secondary', !on);
      });
    }
  };

  window.rtUpdateIsian = function(val){
    if (RT.submitted) return;
    RT.myAnswer = val;
  };

  function rtCheckAnswer(q, ans){
    if (!q) return false;
    if (q.type === 'PGS') return String(ans).trim() === String(q.correctAnswer).trim();
    if (q.type === 'ISIAN') return String(ans||'').toLowerCase().trim() === String(q.correctAnswer||'').toLowerCase().trim();
    if (q.type === 'MCMA') {
      if (!Array.isArray(ans) || !Array.isArray(q.correctAnswer)) return false;
      return ans.slice().sort().join('|') === q.correctAnswer.slice().sort().join('|');
    }
    if (q.type === 'PGK') {
      if (window.isQuestionBooleanAnswerCorrect) return window.isQuestionBooleanAnswerCorrect(q, ans);
      if (!Array.isArray(ans) || !Array.isArray(q.correctAnswer)) return false;
      if (ans.length !== q.correctAnswer.length) return false;
      for (var i=0;i<q.correctAnswer.length;i++) if (ans[i] !== q.correctAnswer[i]) return false;
      return true;
    }
    return false;
  }

  // ===== SUBMIT =====
  window.rtSubmitAnswer = async function(){
    if (!RT.room || RT.room.status !== 'playing') return;
    var cur = rtGetCurrentQuestion();
    if (!cur || !cur.data) return;
    if (RT.submitted) return;
    if (RT.myAnswer == null || RT.myAnswer === '' || (Array.isArray(RT.myAnswer) && RT.myAnswer.length === 0)) {
      toastSafe('Pilih/isi jawaban dulu.','warning'); return;
    }
    var q = cur.data;
    if (q.type === 'PGK' && Array.isArray(RT.myAnswer)) {
      var need = (q.statements||[]).length;
      for (var z=0; z<need; z++) {
        if (RT.myAnswer[z] !== true && RT.myAnswer[z] !== false) {
          toastSafe('Pernyataan '+(z+1)+' belum dijawab True/False.','warning');
          return;
        }
      }
    }

    var ends = (typeof window.rtEndsAtMs === 'function') ? window.rtEndsAtMs() : 0;
    var now = Date.now();
    if (ends && now >= ends) { toastSafe('Waktu habis.','warning'); return; }

    var correct = rtCheckAnswer(q, RT.myAnswer);
    var remainingMs = ends ? Math.max(0, ends - now) : 0;
    var points = (typeof window.rtNormalPoints === 'function') ? window.rtNormalPoints(correct, remainingMs) : 0;

    try {
      await db.collection('liveRooms').doc(RT.roomId).collection('answers')
        .doc(RT.playerId + '_' + cur.index).set({
          studentId: PS.user.id, playerId: RT.playerId, studentName: RT.playerName,
          qIndex: cur.index, questionId: cur.id,
          answer: RT.myAnswer, correct: correct, points: points,
          timeMs: ((typeof window.rtDurationSec === 'function' ? window.rtDurationSec() : 30)*1000) - remainingMs,
          submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge:true });

      RT.submitted = true;
      RT.lastRenderedAnswerKey = '';
      toastSafe('Terkirim. +' + points + ' poin','success');
      if (typeof window.rtRenderQuestion === 'function') window.rtRenderQuestion(true);
    } catch(e){
      console.error('[rt] submit failed:', e);
      toastSafe('Gagal kirim: ' + e.message, 'error');
    }
  };

  // ===== REFRESH =====
  window.rtRefreshConnection = async function(){
    if (!RT.roomId) { toastSafe('Belum ada room aktif','warning'); return; }
    var load = loadSafe('Menyegarkan koneksi...');
    try {
      if (typeof window.rtUnsubscribeAll === 'function') window.rtUnsubscribeAll();
      var doc = await db.collection('liveRooms').doc(RT.roomId).get();
      if (!doc.exists) {
        load.close();
        alertSafe('Realtime Berakhir','Room tidak tersedia.','warning');
        window.rtBackToHome();
        return;
      }
      RT.room = Object.assign({id: doc.id}, doc.data());
      RT.questionsLoadedForSession = null;
      RT.questions = [];
      RT.questionsById = {};

      var pSnap = await db.collection('liveRooms').doc(RT.roomId).collection('players').get();
      RT.players = {};
      pSnap.forEach(function(d){ RT.players[d.id] = Object.assign({id:d.id}, d.data()); });

      RT.online = true;
      if (typeof window.rtUpdateOnlineIndicator === 'function') window.rtUpdateOnlineIndicator();

      if (typeof window.rtSubscribe === 'function') window.rtSubscribe();

      if (RT.room.status === 'playing') {
        rtShowScreen('rtPlayingScreen');
        if (typeof window.rtRenderQuestion === 'function') await window.rtRenderQuestion(true);
      } else if (RT.room.status === 'finished') {
        rtShowScreen('rtFinishedScreen');
        if (typeof window.rtRenderFinished === 'function') window.rtRenderFinished();
      } else {
        rtShowScreen('rtLobbyScreen');
        if (typeof window.rtRenderLobby === 'function') window.rtRenderLobby();
      }

      load.close();
      toastSafe('Koneksi di-refresh','success');
    } catch(e){
      load.close();
      RT.online = false;
      if (typeof window.rtUpdateOnlineIndicator === 'function') window.rtUpdateOnlineIndicator();
      toastSafe('Gagal refresh: '+e.message,'error');
    }
  };

  window.rtBackToHome = function(){
    if (typeof window.rtUnsubscribeAll === 'function') window.rtUnsubscribeAll();
    if (typeof window.toggleVocabBg === 'function') window.toggleVocabBg(false);
    if (window.__rtVocabTimer) clearInterval(window.__rtVocabTimer);
    window.location.href = window.location.href.split('?')[0];
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRealtimeFromUrl);
  } else {
    setTimeout(initRealtimeFromUrl, 50);
  }

  console.log('✅ realtime.js v2.1 loaded (FIX login: showScreen tidak ditimpa, helper prefix rt*)');
})();