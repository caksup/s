/* s#15 | /root/js/s/homework.js | v 1.8 | u 18/09/2026 • 07:00:00 | xu : ke-6 | note : #noteresponse
- v1.2 (baseline user) -> v1.8 (PR ALA QUIZZIZ: RETAKE UNLIMITED tanpa syarat nilai):
  * KEPUTUSAN USER: jumlah percobaan PR = UNLIMITED (bebas) selama deadline
    belum lewat, TANPA syarat nilai <50. Mode 'once' tetap membatasi 1x.
  * startHomework():
    - Gate nilai & gate "maks 2 percobaan" DIHAPUS.
    - Mode 'once'      : setelah 1 attempt completed -> buka hasil terbaik.
    - Mode lain (free) : SELALU boleh mulai attempt berikutnya (attemptNo =
      atts.length + 1, tanpa batas) selama deadline belum lewat.
    - Modal konfirmasi kini menampilkan baris "Skor terbaik" bila sudah ada
      percobaan, dan label tombol "Coba Lagi (Percobaan N)" untuk retake.
    - Modal retry terpisah (showRetryModalFromHome) DIHAPUS — tidak perlu
      lagi karena retake bebas lewat card dashboard / alur normal.
  * submitHomework(): cabang modal retry setelah submit DIHAPUS; setelah
    submit langsung showResult(). Retake dilakukan dari card dashboard
    (dashboard.js v2.15 berikutnya) sesuai pola Quizizz.
  * Helper baru: getRetryMode(s) & isUnlimited(s). hwRetryAvailable &
    RETRY_THRESHOLD DIHAPUS (tidak dipakai lagi).
  * TETAP IDENTIK dari v1.2:
    - showScreen('test'/'app'/'result') (fix dua layar block).
    - localStorage (hwQKey/hwAKey), loadQuestionsHw, initHomework,
      resumeHomework, persistHw, checkpointHw, startHwTimers/stopHwTimers,
      deadlineTick (auto-submit), cleanupHwAnti, onHwVis/onHwBlur/onHwHide,
      hwViolation, lockedCount, renderHwNav, renderHwQuestion, isCorrectHw,
      getPembahasan, lockAndFeedback, hwAnswerPGS/hwToggleMCMA/hwSetPGK/
      hwSetIsian/hwCheck, confirmHwSubmit.
    - submitHomework: counter recompute session (best per siswa) + update
      students (lastScore, totalAttempts hanya increment pada attempt 1).
    - Feedback langsung per soal + kunci + pembahasan setelah diperiksa.
- EXPOSE: window.startHomework, window.initHomework, window.resumeHomework,
  window.exitHomework, window.hwGoto, window.hwNav, window.hwAnswerPGS,
  window.hwToggleMCMA, window.hwSetPGK, window.hwSetIsian, window.hwCheck,
  window.confirmHwSubmit, window.submitHomework, window.isHomeworkSession. */

(function(){
  'use strict';
  function $(id){ return document.getElementById(id); }
  function escH(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  var BULAN_S = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

  function lsGet(k){ try{ var v=localStorage.getItem(k); return v?JSON.parse(v):null; }catch(e){ return null; } }
  function lsSet(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  function lsDel(k){ try{ localStorage.removeItem(k); }catch(e){} }
  function hwQKey(sid){ return 'hw_q_'+sid; }
  function hwAKey(uid,sid){ return 'hw_att_'+uid+'_'+sid; }
  function verMs(s){
    try{ if(s.updatedAt && s.updatedAt.toDate) return s.updatedAt.toDate().getTime(); }catch(e){}
    try{ if(s.createdAt && s.createdAt.toDate) return s.createdAt.toDate().getTime(); }catch(e){}
    return 0;
  }
  function p2(n){ return String(n).padStart(2,'0'); }
  function hwrFmtDurHw(sec){
    sec = Math.max(0, Math.round(sec||0));
    var m = Math.floor(sec/60), s = sec%60;
    if (m > 0) return m+'m '+s+'s';
    return s+'s';
  }

  window.isHomeworkSession = function(sid){
    var s = PS.sessions.find(function(x){ return x.id===sid; }) || PS.currentSession;
    return !!(s && s.mode === 'homework');
  };
  function hwAntiOn(){
    if (!PS.settings.antiCheatEnabled) return false;
    return !!(PS.currentSession && PS.currentSession.antiCheat !== false);
  }
  function hwCompleted(sid){
    return PS.myAttempts.filter(function(a){ return a.sessionId===sid && a.status==='completed'; })
      .sort(function(a,b){ return (a.attemptNumber||1)-(b.attemptNumber||1); });
  }
  function hwBest(sid){
    var atts = hwCompleted(sid), best=null;
    atts.forEach(function(a){ if(!best || (a.score||0)>(best.score||0)) best=a; });
    return best;
  }
  // v1.8: mode percobaan. 'once' = 1x; nilai lain = UNLIMITED s.d. deadline.
  function getRetryMode(s){
    if (!s) return 'once';
    if (s.retryMode && typeof s.retryMode === 'string') return s.retryMode;
    return (s.mode === 'homework') ? 'free' : 'once';
  }
  function isUnlimited(s){ return getRetryMode(s) !== 'once'; }
  function hwExpired(s){
    if (!s.endTime) return false;
    var t = new Date(s.endTime).getTime();
    return !isNaN(t) && Date.now() > t;
  }
  function deadlineInfo(s){
    if (!s.endTime) return { text:'Tanpa deadline', urgent:false, over:false, ms:Infinity };
    var end = new Date(s.endTime);
    if (isNaN(end.getTime())) return { text:'Tanpa deadline', urgent:false, over:false, ms:Infinity };
    var abs = end.getDate()+' '+BULAN_S[end.getMonth()]+' '+end.getFullYear()+', '+p2(end.getHours())+':'+p2(end.getMinutes());
    var diff = end.getTime()-Date.now();
    if (diff<=0) return { text:'Deadline lewat: '+abs, urgent:true, over:true, ms:diff };
    var m=Math.floor(diff/60000), d=Math.floor(m/1440); m%=1440;
    var h=Math.floor(m/60); m%=60;
    var rel = d>0 ? d+' hari '+h+' jam' : (h>0 ? h+' jam '+m+' menit' : m+' menit');
    return { text:'Deadline: '+abs+' ('+rel+' lagi)', urgent: diff < 24*3600*1000, over:false, ms:diff };
  }
  function isAssignedHw(sess){
    var arr = sess && sess.assignedStudents;
    var studentId = PS.user && PS.user.id;
    if(!Array.isArray(arr) || !arr.length || studentId == null) return false;
    return arr.some(function(id){ return String(id).trim() === String(studentId).trim(); });
  }

  // ===== START (v1.8: unlimited retake, tanpa syarat nilai) =====
  window.startHomework = async function(id){
    console.log('[hw] startHomework:', id);
    var s = PS.sessions.find(function(x){ return x.id===id; });
    if (!s) { toast('Sesi tidak ditemukan','warning'); return; }
    if (s.mode !== 'homework') { if (window.startSession) startSession(id,'available'); return; }
    if (!isAssignedHw(s)) {
      alert2('Akses Ditolak','Anda belum bisa akses simulasi tka ini, silahkan hubungi Mentor Teknis Simulasi TKA. terimakasih.','error');
      return;
    }
    if (hwExpired(s)) { alert2('Deadline Lewat','Homework ini sudah melewati deadline. Hubungi mentor jika perlu perpanjangan.','warning'); return; }

    var atts = hwCompleted(id);
    var unlimited = isUnlimited(s);

    // Mode 'once': setelah 1 attempt completed -> buka hasil terbaik
    if (!unlimited && atts.length >= 1) {
      var b0 = hwBest(id);
      if (b0 && window.showResultFromAttempt) showResultFromAttempt(b0.id);
      return;
    }
    // Mode free/unlimited: selalu boleh mulai attempt berikutnya s.d. deadline

    // resume in_progress
    try {
      var inc = await db.collection('attempts').where('studentId','==',PS.user.id).where('sessionId','==',id).where('status','==','in_progress').get();
      var incDoc=null; inc.forEach(function(d){ incDoc={id:d.id,data:d.data()}; });
      if (incDoc) { resumeHomework(id, incDoc); return; }
    } catch(e){}

    var attemptNo = atts.length + 1;   // unlimited: tanpa batas atas
    var qcount = 0;
    var cached = lsGet(hwQKey(id));
    if (cached && cached.items && cached.items.length) qcount = cached.items.length;
    else {
      var qSnap = await db.collection('questions').where('sessionId','==',id).get();
      qcount = qSnap.size;
    }
    var dl = deadlineInfo(s);
    var best = hwBest(id);

    function row(icon,label,val){
      return '<div style="display:flex;align-items:center;gap:.75rem;background:#fffbeb;border:1px solid #f59e0b;border-radius:10px;padding:.625rem .75rem;">' +
        '<span class="material-icons" style="color:#f59e0b;font-size:20px;">'+icon+'</span>' +
        '<div style="flex:1;"><div style="font-size:.7rem;color:#92400e;">'+label+'</div>' +
        '<div style="font-size:.875rem;font-weight:600;color:#78350f;">'+val+'</div></div></div>';
    }

    var bestRow = best
      ? row('emoji_events','Skor terbaik saat ini', best.score+' (benar '+(best.correctAnswers||0)+'/'+(best.totalQuestions||0)+')')
      : '';

    var content =
      '<div style="text-align:center;margin-bottom:1rem;">' +
        '<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#d97706);display:inline-flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(245,158,11,.35);">' +
          '<span class="material-icons" style="font-size:32px;color:#fff;">menu_book</span></div>' +
        '<h3 style="margin-top:.75rem;">Homework / PR</h3>' +
        '<p style="color:#64748b;font-size:.8125rem;">Kerjakan santai, feedback muncul langsung tiap soal</p>' +
      '</div>' +
      '<div style="display:grid;gap:.5rem;margin-bottom:.875rem;">' +
        row('event_available','Sesi', escH(s.name)) +
        row('quiz','Jumlah Soal', qcount+' soal') +
        row('schedule','Deadline', dl.text) +
        bestRow +
        row('refresh','Percobaan', 'Ke-'+attemptNo + (unlimited ? ' (bebas s.d. deadline)' : ' dari 1')) +
        row('shield','Anti-Cheat', hwAntiOn() ? '<span style="color:#10b981;">Aktif</span>' : '<span style="color:#94a3b8;">Nonaktif</span>') +
      '</div>' +
      '<div style="background:#eff6ff;border-left:3px solid #2563eb;padding:.75rem;border-radius:6px;font-size:.8125rem;color:#1e40af;">' +
      'Jawaban tiap soal akan <b>terkunci setelah diperiksa</b>. Nilai tertinggi dari semua percobaan Anda yang dicatat.</div>';

    M.custom({
      title: atts.length ? 'Coba Lagi Homework' : 'Mulai Homework',
      message: content, type:'info',
      buttons:[
        { text:'Nanti Dulu', class:'btn-secondary' },
        { text: atts.length ? ('Coba Lagi (Percobaan '+attemptNo+')') : 'Mulai Mengerjakan',
          class: atts.length ? 'btn-warning' : 'btn-primary',
          action:function(){ initHomework(id, attemptNo, atts.length>0); } }
      ]
    });
  };

  // ===== INIT / RESUME =====
  async function loadQuestionsHw(sid, sess){
    var ver = verMs(sess);
    var cached = lsGet(hwQKey(sid));
    if (cached && cached.ver===ver && cached.items && cached.items.length) {
      cached.items.forEach(function(question){
        if (question.type === 'PGK' && window.normalizeQuestionBooleanAnswers) {
          var normalized = window.normalizeQuestionBooleanAnswers(question.correctAnswer);
          if (normalized) question.correctAnswer = normalized;
        }
      });
      return cached.items;
    }
    var snap = await db.collection('questions').where('sessionId','==',sid).get();
    var arr=[]; snap.forEach(function(d){
      var question = Object.assign({id:d.id},d.data());
      if (question.type === 'PGK' && window.normalizeQuestionBooleanAnswers) {
        var normalized = window.normalizeQuestionBooleanAnswers(question.correctAnswer);
        if (normalized) question.correctAnswer = normalized;
      }
      arr.push(question);
    });
    arr.sort(function(a,b){ return (a.order||0)-(b.order||0); });
    lsSet(hwQKey(sid), { ver:ver, items:arr });
    return arr;
  }

  window.initHomework = async function(sid, attemptNo, isRetry){
    console.log('[hw] initHomework: sid='+sid+' attemptNo='+attemptNo+' isRetry='+!!isRetry);
    var load = loading('Menyiapkan homework...');
    try {
      var sessSnap = await db.collection('sessions').doc(sid).get();
      if (!sessSnap.exists) { load.close(); alert2('Error','Sesi tidak ditemukan','error'); return; }
      PS.currentSession = Object.assign({id:sid}, sessSnap.data());
      if (!isAssignedHw(PS.currentSession)) {
        load.close();
        alert2('Akses Ditolak','Sesi Homework ini tidak ditugaskan kepada akun Anda.','error');
        return;
      }
      PS.questions = await loadQuestionsHw(sid, PS.currentSession);
      if (!PS.questions.length) { load.close(); alert2('Error','Sesi belum punya soal','error'); return; }

      var ref = await db.collection('attempts').add({
        studentId: PS.user.id, sessionId: sid, status:'in_progress',
        mode:'homework', attemptNumber: attemptNo||1,
        answers:{}, locked:{}, progress:0, totalQuestions: PS.questions.length,
        tabSwitchCount:0, blurCount:0, antiCheatLog:[],
        startedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      PS.attemptId = ref.id;
      PS.answers={}; PS.hwLocked={}; PS.hwFb={}; PS.currentIndex=0;
      PS.tabSwitch=0; PS.blur=0; PS.antiLog=[];
      PS.startTime=Date.now(); PS.attemptNumber=attemptNo||1;
      PS.isRetry=!!isRetry;
      PS.hwEndMs = PS.currentSession.endTime ? new Date(PS.currentSession.endTime).getTime() : 0;
      persistHw();
      load.close();
      showHomeworkPage();
    } catch(e){ load.close(); alert2('Error','Gagal memulai: '+e.message,'error'); }
  };

  window.resumeHomework = async function(sid, incDoc){
    var load = loading('Melanjutkan homework...');
    try {
      var sessSnap = await db.collection('sessions').doc(sid).get();
      if (!sessSnap.exists) { load.close(); alert2('Error','Sesi tidak ditemukan','error'); return; }
      PS.currentSession = Object.assign({id:sid}, sessSnap.data());
      if (!isAssignedHw(PS.currentSession)) {
        load.close();
        alert2('Akses Ditolak','Sesi Homework ini tidak ditugaskan kepada akun Anda.','error');
        return;
      }
      PS.questions = await loadQuestionsHw(sid, PS.currentSession);

      var doc = incDoc;
      if (!doc) {
        var snap = await db.collection('attempts').where('studentId','==',PS.user.id).where('sessionId','==',sid).where('status','==','in_progress').get();
        snap.forEach(function(d){ doc={id:d.id,data:d.data()}; });
      }
      if (!doc) { load.close(); startHomework(sid); return; }

      var cache = lsGet(hwAKey(PS.user.id, sid));
      PS.attemptId = doc.id;
      PS.attemptNumber = doc.data.attemptNumber||1;
      PS.isRetry = (PS.attemptNumber > 1);
      if (cache && cache.attemptId===doc.id) {
        PS.answers = cache.answers||{}; PS.hwLocked = cache.locked||{}; PS.currentIndex = cache.progress||0;
      } else {
        PS.answers = doc.data.answers||{}; PS.hwLocked = doc.data.locked||{}; PS.currentIndex = doc.data.progress||0;
      }
      PS.hwFb={}; PS.tabSwitch=doc.data.tabSwitchCount||0; PS.blur=doc.data.blurCount||0; PS.antiLog=doc.data.antiCheatLog||[];
      PS.startTime=Date.now();
      PS.hwEndMs = PS.currentSession.endTime ? new Date(PS.currentSession.endTime).getTime() : 0;
      persistHw();
      load.close();
      showHomeworkPage();
    } catch(e){ load.close(); alert2('Error','Gagal melanjutkan: '+e.message,'error'); }
  };

  function persistHw(){
    if (!PS.attemptId || !PS.currentSession) return;
    lsSet(hwAKey(PS.user.id, PS.currentSession.id), {
      attemptId:PS.attemptId, sessionId:PS.currentSession.id, studentId:PS.user.id,
      answers:PS.answers, locked:PS.hwLocked, progress:PS.currentIndex,
      attemptNumber:PS.attemptNumber, isRetry:!!PS.isRetry,
      startedAtMs:PS.startTime, savedAtMs:Date.now()
    });
  }
  async function checkpointHw(){
    if (!PS.attemptId) return;
    persistHw();
    try {
      await db.collection('attempts').doc(PS.attemptId).update({
        answers:PS.answers, locked:PS.hwLocked, progress:PS.currentIndex,
        tabSwitchCount:PS.tabSwitch, blurCount:PS.blur, antiCheatLog:(PS.antiLog||[]).slice(-20)
      });
    } catch(e){}
  }
  function startHwTimers(){ stopHwTimers(); PS.hwCpTimer = setInterval(checkpointHw, 30000); PS.hwDlTimer = setInterval(deadlineTick, 1000); }
  function stopHwTimers(){
    if (PS.hwCpTimer) { clearInterval(PS.hwCpTimer); PS.hwCpTimer=null; }
    if (PS.hwDlTimer) { clearInterval(PS.hwDlTimer); PS.hwDlTimer=null; }
  }
  function deadlineTick(){
    var el = $('hwDeadline');
    var dl = deadlineInfo(PS.currentSession||{});
    if (el) {
      el.textContent = dl.text;
      el.parentElement.classList.toggle('urgent', dl.urgent);
    }
    if (dl.over) { stopHwTimers(); alert2('Deadline Lewat','Waktu homework berakhir. Jawaban dikumpulkan otomatis.','warning', function(){ submitHomework(true); }); }
  }

  function showHomeworkPage(){
    if (window.showScreen) showScreen('test');
    else {
      var ls=$('loginScreen'); if(ls) ls.style.display='none';
      var sa=$('studentApp'); if(sa) sa.style.display='none';
      var rp=$('resultPage'); if(rp) rp.style.display='none';
      var tp=$('testPage'); tp.style.display='block';
    }

    var dl = deadlineInfo(PS.currentSession||{});
    var tp = $('testPage');
    var retryBadge = PS.isRetry
      ? '<span style="display:inline-flex;align-items:center;gap:.25rem;background:#fef3c7;color:#92400e;border:1px solid #f59e0b;padding:.125rem .5rem;border-radius:50px;font-size:.7rem;font-weight:700;margin-left:.375rem;">' +
          '<span class="material-icons" style="font-size:12px;">refresh</span>PERCOBAAN '+ (PS.attemptNumber||1) +'</span>'
      : '';

    tp.innerHTML =
      '<div class="test-header">' +
        '<div class="th-left" style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;">' +
          '<span class="mode-badge-hw"><span class="material-icons">menu_book</span>PR</span>' +
          retryBadge +
          '<span>Soal <span id="hwCur">1</span>/<span id="hwTot">'+PS.questions.length+'</span></span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:.5rem;">' +
          '<div class="hw-deadline'+(dl.urgent?' urgent':'')+'"><span class="material-icons">schedule</span><span id="hwDeadline">'+dl.text+'</span></div>' +
          '<button class="btn btn-secondary btn-sm" onclick="exitHomework()" title="Simpan & keluar"><span class="material-icons">logout</span></button>' +
        '</div>' +
      '</div>' +
      '<div class="num-strip-row"><div class="num-strip" id="hwStrip"></div></div>' +
      '<div style="padding:0 1rem;"><div class="hw-progress"><div class="hw-progress-fill" id="hwProgressFill" style="width:0%;"></div></div></div>' +
      '<div class="test-body" id="testBody"></div>' +
      '<div class="bottom-nav">' +
        '<button class="btn btn-secondary" id="hwPrev" onclick="hwNav(-1)"><span class="material-icons">arrow_back</span>Prev</button>' +
        '<button class="btn btn-primary" id="hwNext" onclick="hwNav(1)">Next<span class="material-icons">arrow_forward</span></button>' +
        '<button class="btn btn-success" id="hwSubmit" style="display:none;" onclick="confirmHwSubmit()"><span class="material-icons">send</span>Kumpulkan</button>' +
      '</div>';

    renderHwNav();
    renderHwQuestion();
    startHwTimers();
    cleanupHwAnti();
    document.addEventListener('visibilitychange', onHwVis);
    window.addEventListener('blur', onHwBlur);
    window.addEventListener('pagehide', onHwHide);
  }

  function onHwHide(){ checkpointHw(); }
  function onHwVis(){ if (!PS.attemptId) return; if (document.hidden) { if (hwAntiOn()) hwViolation('tab_switch'); } }
  function onHwBlur(){ if (PS.attemptId) { PS.blur++; PS.antiLog.push({t:Date.now(),type:'blur'}); persistHw(); } }
  function cleanupHwAnti(){
    document.removeEventListener('visibilitychange', onHwVis);
    window.removeEventListener('blur', onHwBlur);
    window.removeEventListener('pagehide', onHwHide);
  }
  function hwViolation(type){
    PS.tabSwitch++;
    PS.antiLog.push({t:Date.now(),type:type});
    persistHw(); checkpointHw();
    try{ if(navigator.vibrate) navigator.vibrate([200,100,200]); }catch(e){}
    if (PS.tabSwitch >= (PS.settings.maxTabSwitches||3)) {
      alert2('Pelanggaran!','Batas pelanggaran tercapai. Jawaban dikumpulkan.','error', function(){ submitHomework(true); });
    }
  }

  window.exitHomework = function(){
    confirm2('Simpan & Keluar','Progress homework tersimpan. Anda bisa melanjutkan sebelum deadline.', function(){
      checkpointHw();
      stopHwTimers(); cleanupHwAnti();
      if (window.showScreen) showScreen('app');
      else {
        var tp=$('testPage'); if(tp) tp.style.display='none';
        var sa=$('studentApp'); if(sa) sa.style.display='block';
      }
      if (PS.setTab) PS.setTab('home');
      if (window.loadAllData) loadAllData().then(function(){ if (window.renderHomeTab) renderHomeTab(); });
      toast('Progress disimpan','success');
    });
  };

  function lockedCount(){ var n=0; PS.questions.forEach(function(q){ if (PS.hwLocked && PS.hwLocked[q.id]) n++; }); return n; }
  function renderHwNav(){
    var strip=$('hwStrip');
    if (strip) {
      strip.innerHTML = PS.questions.map(function(q,i){
        var cls='num-dot';
        if (i===PS.currentIndex) cls+=' current';
        else if (PS.hwLocked && PS.hwLocked[q.id]) cls+=' answered';
        return '<button class="'+cls+'" onclick="hwGoto('+i+')">'+(i+1)+'</button>';
      }).join('');
    }
    var fill=$('hwProgressFill');
    if (fill) fill.style.width = Math.round(lockedCount()/PS.questions.length*100)+'%';
    var cur=$('hwCur'); if(cur) cur.textContent = PS.currentIndex+1;
  }
  window.hwGoto=function(i){ PS.currentIndex=i; renderHwNav(); renderHwQuestion(); };
  window.hwNav=function(d){ var n=PS.currentIndex+d; if(n<0||n>=PS.questions.length)return; PS.currentIndex=n; renderHwNav(); renderHwQuestion(); };

  function isCorrectHw(q,a){
    if(q.type==='PGS')  return (a===q.correctAnswer);
    if(q.type==='MCMA') return JSON.stringify((a||[]).slice().sort())===JSON.stringify((q.correctAnswer||[]).slice().sort());
    if(q.type==='PGK')  return window.isQuestionBooleanAnswerCorrect
      ? window.isQuestionBooleanAnswerCorrect(q,a)
      : JSON.stringify(a||[])===JSON.stringify(q.correctAnswer||[]);
    if(q.type==='ISIAN')return String(a||'').toLowerCase().trim()===String(q.correctAnswer||'').toLowerCase().trim();
    return false;
  }
  function getPembahasan(q){ return q.pembahasan || q.explanation || q.pembahasanText || ''; }

  function renderHwQuestion(){
    var q = PS.questions[PS.currentIndex];
    if (!q) return;
    var locked = !!(PS.hwLocked && PS.hwLocked[q.id]);
    var labels={PGS:'Pilihan Ganda',MCMA:'Pilihan Ganda Kompleks',PGK:'Kategori Benar/Salah',ISIAN:'Isian Singkat'};

    var html = '<div class="question-card">' +
      '<div class="q-head">' +
        '<div class="q-head-left">Soal '+(PS.currentIndex+1)+' <span class="question-type-badge '+q.type.toLowerCase()+'">'+(labels[q.type]||q.type)+'</span>' +
        (locked?' <span class="badge badge-success">Terkunci</span>':'') + '</div>' +
        '<div class="q-ctrl"><button onclick="openFeedbackFor(\''+q.id+'\')" title="Laporkan soal"><span class="material-icons">flag</span></button></div>' +
      '</div>' +
      '<div class="question-text" style="font-size:'+(PS.qFont||16)+'px;">'+escH(q.text||'')+'</div>' +
      (window.questionImageHtml ? window.questionImageHtml(q) : '');

    if (q.type==='PGS'){
      html+='<div class="options-list">';
      ['A','B','C','D'].forEach(function(l){
        if(!q.options||!q.options[l])return;
        var sel=PS.answers[q.id]===l; var extra='';
        if (locked) { if (l===q.correctAnswer) extra=' hw-correct'; else if (sel) extra=' hw-wrong'; }
        html+='<div class="option-item'+(sel?' selected':'')+extra+'" '+(locked?'':'onclick="hwAnswerPGS(\''+q.id+'\',\''+l+'\')"')+' style="'+(locked?'cursor:default;':'')+'"><div class="option-label">'+l+'</div><div class="option-text">'+escH(q.options[l])+'</div></div>';
      });
      html+='</div>';
    } else if (q.type==='MCMA'){
      var cur=PS.answers[q.id]||[];
      html+='<div class="options-list">';
      ['A','B','C','D','E'].forEach(function(l){
        if(!q.options||!q.options[l])return;
        var sel=cur.indexOf(l)!==-1; var extra='';
        if (locked) { if ((q.correctAnswer||[]).indexOf(l)!==-1) extra=' hw-correct'; else if (sel) extra=' hw-wrong'; }
        html+='<div class="option-item'+(sel?' selected':'')+extra+'" '+(locked?'':'onclick="hwToggleMCMA(\''+q.id+'\',\''+l+'\')"')+' style="'+(locked?'cursor:default;':'')+'"><div class="option-label">'+l+'</div><div class="option-text">'+escH(q.options[l])+'</div></div>';
      });
      html+='</div>';
      if (!locked) html+='<button class="btn btn-warning w-full" style="margin-top:.75rem;" onclick="hwCheck(\''+q.id+'\')"><span class="material-icons">fact_check</span>Periksa Jawaban</button>';
    } else if (q.type==='PGK'){
      var arr=PS.answers[q.id]||[];
      html+='<div class="statement-list">';
      (q.statements||[]).forEach(function(st,i){
        var v=arr[i]; var cv=(q.correctAnswer||[])[i];
        html+='<div class="statement-item"><div class="statement-text">'+(i+1)+'. '+escH(st)+'</div><div class="statement-options">' +
          '<button class="statement-btn'+(v===true?' selected':'')+(locked&&cv===true?' hw-correct':'')+(locked&&v===true&&cv!==true?' hw-wrong':'')+'" '+(locked?'':'onclick="hwSetPGK(\''+q.id+'\','+i+',true)"')+'>True</button>' +
          '<button class="statement-btn'+(v===false?' selected':'')+(locked&&cv===false?' hw-correct':'')+(locked&&v===false&&cv!==false?' hw-wrong':'')+'" '+(locked?'':'onclick="hwSetPGK(\''+q.id+'\','+i+',false)"')+'>False</button></div></div>';
      });
      html+='</div>';
      if (!locked) html+='<button class="btn btn-warning w-full" style="margin-top:.75rem;" onclick="hwCheck(\''+q.id+'\')"><span class="material-icons">fact_check</span>Periksa Jawaban</button>';
    } else if (q.type==='ISIAN'){
      html+='<input type="text" class="answer-input" placeholder="Ketik jawaban..." value="'+escH(PS.answers[q.id]||'')+'" '+(locked?'disabled':'oninput="hwSetIsian(\''+q.id+'\', this.value)"')+'>';
      if (locked) html+='<div style="margin-top:.5rem;font-size:.8125rem;color:#64748b;">Jawaban benar: <b style="color:#10b981;">'+escH(q.correctAnswer||'')+'</b></div>';
      else html+='<button class="btn btn-warning w-full" style="margin-top:.75rem;" onclick="hwCheck(\''+q.id+'\')"><span class="material-icons">fact_check</span>Periksa Jawaban</button>';
    }

    if (locked) {
      var ok = isCorrectHw(q, PS.answers[q.id]);
      html += ok
        ? '<div class="hw-fb-benar"><span class="material-icons">check_circle</span>Benar! Kerja bagus.</div>'
        : '<div class="hw-fb-salah"><span class="material-icons">cancel</span>Belum tepat.</div>';
      var pb = getPembahasan(q);
      if (pb) html += '<div class="hw-fb-pembahasan"><b>Pembahasan:</b><br>'+escH(pb)+'</div>';
    }
    html+='</div>';

    $('testBody').innerHTML = html;

    var last = PS.currentIndex === PS.questions.length-1;
    var allLocked = lockedCount() === PS.questions.length;
    $('hwPrev').disabled = PS.currentIndex===0;
    $('hwNext').style.display = last?'none':'inline-flex';
    $('hwSubmit').style.display = (last && allLocked) ? 'inline-flex' : (allLocked ? 'inline-flex' : 'none');
    renderHwNav();
  }

  function lockAndFeedback(qid){
    PS.hwLocked = PS.hwLocked||{};
    PS.hwLocked[qid]=true;
    persistHw(); checkpointHw(); renderHwQuestion();
  }
  window.hwAnswerPGS=function(qid,l){ if (PS.hwLocked && PS.hwLocked[qid]) return; PS.answers[qid]=l; lockAndFeedback(qid); };
  window.hwToggleMCMA=function(qid,l){
    if (PS.hwLocked && PS.hwLocked[qid]) return;
    var c=PS.answers[qid]||[]; var i=c.indexOf(l);
    if(i===-1)c.push(l); else c.splice(i,1);
    PS.answers[qid]=c; persistHw(); renderHwQuestion();
  };
  window.hwSetPGK=function(qid,i,v){ if (PS.hwLocked && PS.hwLocked[qid]) return; var a=PS.answers[qid]||[]; a[i]=v; PS.answers[qid]=a; persistHw(); renderHwQuestion(); };
  window.hwSetIsian=function(qid,v){ if (PS.hwLocked && PS.hwLocked[qid]) return; PS.answers[qid]=v.trim(); persistHw(); };
  window.hwCheck=function(qid){
    if (PS.hwLocked && PS.hwLocked[qid]) return;
    var q=PS.questions.find(function(x){return x.id===qid;});
    if (!q) return;
    var a=PS.answers[qid];
    var empty = (q.type==='MCMA') ? (!a||!a.length)
              : (q.type==='PGK') ? (!a||a.length<(q.statements||[]).length||a.some(function(v){return v===undefined;}))
              : (q.type==='ISIAN') ? (!a||a==='')
              : false;
    if (empty) { alert2('Belum lengkap','Lengkapi jawaban terlebih dahulu sebelum diperiksa.','warning'); return; }
    lockAndFeedback(qid);
  };

  window.confirmHwSubmit=function(){
    var un = PS.questions.length - lockedCount();
    var msg='Kumpulkan homework ini?';
    if(un>0) msg+='<br><span style="color:#f59e0b;font-weight:600;">'+un+' soal belum diperiksa.</span>';
    confirm2('Submit Homework', msg, function(){ submitHomework(false); });
  };

  // ===== SUBMIT (v1.8: tanpa modal retry; retake via card dashboard) =====
  window.submitHomework = async function(auto){
    stopHwTimers(); cleanupHwAnti();
    var load = loading('Menghitung nilai...');
    var correct=0;
    PS.questions.forEach(function(q){ if (isCorrectHw(q, PS.answers[q.id])) correct++; });
    var score=Math.round((correct/PS.questions.length)*100);
    var totalTime=Math.round((Date.now()-PS.startTime)/1000);
    var sid=PS.currentSession.id, attemptNo=PS.attemptNumber||1;

    console.log('[hw] submit: score='+score+' correct='+correct+' attemptNo='+attemptNo+' auto='+auto);

    try {
      await db.collection('attempts').doc(PS.attemptId).update({
        status:'completed', mode:'homework', attemptNumber:attemptNo,
        answers:PS.answers, locked:PS.hwLocked, score:score, correctAnswers:correct,
        totalQuestions:PS.questions.length, totalTime:totalTime,
        finishedAt:firebase.firestore.FieldValue.serverTimestamp(),
        tabSwitchCount:PS.tabSwitch, blurCount:PS.blur, antiCheatLog:(PS.antiLog||[]).slice(-20),
        autoSubmitted:!!auto
      });

      // Counter sesi: recompute berbasis nilai terbaik per siswa
      var snap = await db.collection('attempts').where('sessionId','==',sid).where('status','==','completed').get();
      var bestBy={};
      snap.forEach(function(d){ var a=d.data(); var b=bestBy[a.studentId]; if(!b||(a.score||0)>(b.score||0)) bestBy[a.studentId]=a; });
      var cnt=Object.keys(bestBy).length, sum=0;
      Object.keys(bestBy).forEach(function(k){ sum+=bestBy[k].score||0; });
      await db.collection('sessions').doc(sid).update({ completedCount:cnt, scoreSum:sum, questionsCount:PS.questions.length }).catch(function(){});

      var mine=null; snap.forEach(function(d){ var a=d.data(); if(a.studentId===PS.user.id && (!mine||(a.score||0)>(mine.score||0))) mine=a; });
      var stuUpd={ lastScore: mine?mine.score:score, lastSessionId:sid, updatedAt:firebase.firestore.FieldValue.serverTimestamp() };
      if (attemptNo===1) stuUpd.totalAttempts = firebase.firestore.FieldValue.increment(1);
      await db.collection('students').doc(PS.user.id).update(stuUpd).catch(function(){});

      lsDel(hwAKey(PS.user.id, sid));
      if (window.loadAllData) { await loadAllData(); }

      load.close();
      // v1.8: langsung tampilkan hasil; retake bebas lewat card dashboard
      showResult(score, correct, totalTime, auto);
    } catch(e){ load.close(); alert2('Error','Gagal menyimpan: '+e.message,'error'); }
  };

  console.log('✅ s/homework.js v1.8 loaded — retake UNLIMITED tanpa syarat nilai (ala Quizizz)');
})();
