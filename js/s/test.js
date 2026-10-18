/* s#16 | /root/js/s/test.js | v 2.1 | u 13/09/2026 • 21:00:00 | xu : ke-13 | note : #noteresponse
- v2.0 -> v2.1 (FIX BUG "siswa bisa langsung kerjakan sesi realtime tanpa host"):
  * TAMBAH guard di awal startSession(): bila sesi ber-mode realtime, tampilkan
    alert2 info "Sesi ini harus dimulai melalui kode Realtime dari guru Anda" dan
    return (tidak lanjut ke initTest). Ini adalah pertahanan lapis kedua setelah
    dashboard.js v2.6 yang sudah menyembunyikan tombol "Mulai" untuk realtime.
  * TAMBAH guard di autoResume(): bila mode realtime, jangan auto-resume test biasa.
  * TAMBAH guard di initTest(): defense in depth — bila somehow berhasil lewat
    layer 1 & 2 (misal via URL ?jecact=), tetap diblokir di sini.
- TETAP (tidak dipotong dari v2.0): routing cerdas mode HOMEWORK vs LIVE, counter
  pelanggaran, True/False, modal modern, Menu Soal icon-only, assigned-check,
  4 tipe soal, timer, saveRemaining, saveProgress, submitTest, confirmSubmit,
  anti-cheat per sesi, back trap, playAlarm, enterFS/exitFS, infoRow,
  updateViolDisplay, isAssigned/blockNotAssigned. FIX "dua layar block bersamaan"
  (showScreen terpusat) & FIX typo answerPGK (q.id -> qid) tetap ada. */

(function(){
  'use strict';
  function $(id){ return document.getElementById(id); }

  var AC = null;

  function isAntiCheatOn(){
    if (!PS.settings.antiCheatEnabled) return false;
    if (PS.currentSession && PS.currentSession.antiCheat === false) return false;
    return true;
  }

  function playAlarm(){
    if (!isAntiCheatOn()) return;
    try{
      AC = AC || new (window.AudioContext||window.webkitAudioContext)();
      var t = AC.currentTime;
      for (var i=0;i<3;i++){
        var o=AC.createOscillator(), g=AC.createGain();
        o.type='sawtooth'; o.frequency.value=880;
        o.connect(g); g.connect(AC.destination);
        g.gain.setValueAtTime(0.0001, t+i*0.3);
        g.gain.exponentialRampToValueAtTime(0.3, t+i*0.3+0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t+i*0.3+0.25);
        o.start(t+i*0.3); o.stop(t+i*0.3+0.3);
      }
    }catch(e){}
    try{ if(navigator.vibrate) navigator.vibrate([200,100,200,100,200]); }catch(e){}
  }

  function enterFS(){ var el=document.documentElement;
    try{ if(el.requestFullscreen) el.requestFullscreen().catch(function(){}); else if(el.webkitRequestFullscreen) el.webkitRequestFullscreen(); }catch(e){} }
  function exitFS(){ try{ if(document.fullscreenElement) document.exitFullscreen().catch(function(){}); }catch(e){} }

  function infoRow(icon, label, value){
    return '<div style="display:flex;align-items:center;gap:.75rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:.625rem .75rem;">' +
      '<span class="material-icons" style="color:#2563eb;font-size:20px;">'+icon+'</span>' +
      '<div style="flex:1;"><div style="font-size:.7rem;color:#64748b;">'+label+'</div>' +
      '<div style="font-size:.875rem;font-weight:600;">'+value+'</div></div></div>';
  }

  function updateViolDisplay(){
    var el=$('violDisplay');
    var max=PS.settings.maxTabSwitches||3;
    var c=$('violCounter');
    if (!isAntiCheatOn()) {
      if (el) el.textContent = 'OFF';
      if (c) { c.style.background = '#f1f5f9'; c.style.color = '#94a3b8'; }
      return;
    }
    if(el) el.textContent = PS.tabSwitch + '/' + max;
    if(c){
      c.style.background = PS.tabSwitch>0 ? '#fee2e2' : '#f1f5f9';
      c.style.color = PS.tabSwitch>0 ? '#991b1b' : '#64748b';
    }
  }

  function isAssigned(sess){
    var arr = sess && sess.assignedStudents;
    var studentId = PS.user && PS.user.id;
    if(!Array.isArray(arr) || !arr.length || studentId == null) return false;
    return arr.some(function(id){ return String(id).trim() === String(studentId).trim(); });
  }
  function blockNotAssigned(){
    alert2('Akses Ditolak',
      'Anda belum bisa akses simulasi tka ini, silahkan hubungi Mentor Teknis Simulasi TKA. terimakasih.',
      'error');
  }

  async function startSession(id, status){
    console.log('[TKA] startSession dipanggil, id=', id, 'status=', status);
    if (status === 'locked' || status === 'expired') { toast('Sesi belum/tidak tersedia', 'warning'); return; }
    var s = PS.sessions.find(function(x){ return x.id === id; });
    if (!s) { toast('Sesi tidak ditemukan atau sedang tidak tersedia','warning'); return; }
    if (!isAssigned(s)) { blockNotAssigned(); return; }
    if (status === 'completed') {
      var done = PS.myAttempts.find(function(a){ return a.sessionId === id; });
      if (done) showResultFromAttempt(done.id);
      return;
    }
    var name = s ? s.name : 'Sesi';
    var dur = s ? (s.duration||60) : 60;

    if (s && s.mode === 'assessment' && window.openAssessmentDetails) {
      return window.openAssessmentDetails(id);
    }

    // ===== FIX v2.1: BLOCK sesi realtime =====
    if (s && s.mode === 'realtime') {
      alert2('Sesi Realtime',
        'Sesi <b>'+escapeHtmlS(name)+'</b> adalah sesi <b>Realtime Exercise</b> ' +
        'yang harus dimulai melalui <b>kode join dari guru Anda</b> di kelas.<br><br>' +
        'Minta guru membagikan kode 6 digit, lalu buka link:<br>' +
        '<code style="font-size:.75rem;word-break:break-all;">sp.html?jec-rt=KODE</code>',
        'info');
      return;
    }

    if (s && s.mode === 'homework' && window.startHomework) {
      return window.startHomework(id);
    }

    var qSnap = await db.collection('questions').where('sessionId','==',id).get();

    var startStr = (s && s.startTime) ? formatDate(s.startTime) : '-';
    var endStr = (s && s.endTime) ? formatDate(s.endTime) : '-';

    var acBadge = (s && s.antiCheat === false)
      ? infoRow('shield', 'Anti-Cheat', '<span style="color:#f59e0b;">Nonaktif</span>')
      : infoRow('shield', 'Anti-Cheat', '<span style="color:#10b981;">Aktif</span>');

    var content =
      '<div style="text-align:center;margin-bottom:1rem;">' +
        '<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#1e40af);display:inline-flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(37,99,235,.35);">' +
          '<span class="material-icons" style="font-size:32px;color:#fff;">quiz</span></div>' +
        '<h3 style="margin-top:.75rem;">Fokus Simulasi TKA</h3>' +
        '<p style="color:#64748b;font-size:.8125rem;">Periksa detail di bawah sebelum memulai</p>' +
      '</div>' +
      '<div style="display:grid;gap:.5rem;margin-bottom:.875rem;">' +
        infoRow('event_available', 'Sesi', name) +
        infoRow('quiz', 'Jumlah Soal', qSnap.size + ' soal') +
        infoRow('timer', 'Durasi', dur + ' menit') +
        infoRow('schedule', 'Waktu Pengerjaan', startStr + '  s/d  ' + endStr) +
        acBadge +
      '</div>' +
      '<div style="background:#fef3c7;border-left:3px solid #f59e0b;padding:.75rem;border-radius:6px;font-size:.8125rem;color:#92400e;">' +
      'Peringatan: Selama simulasi berlangsung Anda <b>TIDAK diperkenankan</b> keluar browser atau berpindah tab. Pelanggaran akan tercatat dan dapat mengakhiri sesi secara otomatis.</div>';

    var plainText = 'Fokus Simulasi TKA\n\nAnda akan memulai: '+name+'\nJumlah soal: '+qSnap.size+'\nDurasi: '+dur+' menit\nWaktu: '+startStr+' s/d '+endStr+'\n\nPeringatan: Dilarang keluar browser / pindah tab.';

    try {
      if (window.M && typeof M.custom === 'function') {
        M.custom({
          title: 'Konfirmasi Mulai',
          message: content,
          type: 'warning',
          blurStrong: true,
          buttons: [
            { text:'Batal', class:'btn-secondary' },
            { text:'Mulai Sekarang', class:'btn-primary', action: function(){ initTest(id); } }
          ]
        });
      } else if (window.M && typeof M.confirm === 'function') {
        M.confirm('Mulai Sesi', plainText.replace(/\n/g,'<br>'), function(){ initTest(id); });
      } else {
        if (confirm(plainText)) initTest(id);
      }
    } catch(e) {
      if (confirm(plainText)) initTest(id);
    }
  }

  window.autoResume = async function(sessionId){
    try {
      var snap = await db.collection('sessions').doc(sessionId).get();
      if (snap.exists && snap.data().mode === 'homework' && window.resumeHomework) {
        return window.resumeHomework(sessionId, null);
      }
      if (snap.exists && snap.data().mode === 'assessment' && window.resumeAssessment) {
        return window.resumeAssessment(sessionId);
      }
      // FIX v2.1: bila mode realtime, jangan auto-resume test biasa
      if (snap.exists && snap.data().mode === 'realtime') {
        alert2('Sesi Realtime', 'Sesi ini harus dimulai lewat kode join dari guru.', 'info');
        return;
      }
    } catch(e){ console.warn('[TKA] cek mode sesi gagal:', e); }
    return initTest(sessionId);
  };

  async function initTest(sessionId){
    var load = loading('Menyiapkan sesi...');
    try {
      var sessSnap = await db.collection('sessions').doc(sessionId).get();
      if (!sessSnap.exists) { load.close(); alert2('Error','Sesi tidak ditemukan','error'); return; }
      PS.currentSession = Object.assign({ id: sessionId }, sessSnap.data());

      // FIX v2.1: guard realtime juga di initTest (defense in depth)
      if (PS.currentSession.mode === 'realtime') {
        load.close();
        alert2('Sesi Realtime', 'Sesi ini harus dimulai lewat kode join dari guru.', 'info');
        return;
      }

      if (PS.currentSession.mode === 'homework' && window.resumeHomework) {
        load.close();
        return window.resumeHomework(sessionId, null);
      }

      if (!isAssigned(PS.currentSession)) { load.close(); blockNotAssigned(); return; }

      var qSnap = await db.collection('questions').where('sessionId','==',sessionId).get();
      PS.questions = [];
      qSnap.forEach(function(d){
        var question = Object.assign({ id:d.id }, d.data());
        if (question.type === 'PGK' && window.normalizeQuestionBooleanAnswers) {
          var normalized = window.normalizeQuestionBooleanAnswers(question.correctAnswer);
          if (normalized) question.correctAnswer = normalized;
        }
        PS.questions.push(question);
      });
      PS.questions.sort(function(a,b){ return (a.order||0)-(b.order||0); });
      if (PS.questions.length === 0) { load.close(); alert2('Error','Sesi belum punya soal','error'); return; }

      var exSnap = await db.collection('attempts').where('studentId','==',PS.user.id).get();
      var exDoc = null;
      exSnap.forEach(function(d){ var a=d.data(); if(a.sessionId===sessionId && a.status==='in_progress') exDoc={id:d.id,data:a}; });

      var fullTime = (PS.currentSession.duration||60)*60;
      if (exDoc) {
        PS.attemptId = exDoc.id;
        PS.answers = exDoc.data.answers || {};
        PS.currentIndex = exDoc.data.progress || 0;
        PS.tabSwitch = exDoc.data.tabSwitchCount || 0;
        PS.blur = exDoc.data.blurCount || 0;
        PS.antiLog = exDoc.data.antiCheatLog || [];
        PS.timeRemaining = (exDoc.data.remaining != null) ? exDoc.data.remaining : fullTime;
      } else {
        var ref = await db.collection('attempts').add({
          studentId: PS.user.id, sessionId: sessionId, status:'in_progress',
          answers:{}, progress:0, totalQuestions: PS.questions.length,
          tabSwitchCount:0, blurCount:0, antiCheatLog:[], remaining: fullTime,
          startedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        PS.attemptId = ref.id;
        PS.answers={}; PS.currentIndex=0; PS.tabSwitch=0; PS.blur=0; PS.antiLog=[];
        PS.timeRemaining = fullTime;
      }

      PS.flagged = new Set();
      PS.qFont = PS.qFont || 16;
      PS.startTime = Date.now();

      load.close();
      showTestPage();
      updateViolDisplay();
      enterFS();
    } catch(e){ load.close(); alert2('Error','Gagal memulai: '+e.message,'error'); }
  }

  function showTestPage(){
    if (window.showScreen) showScreen('test');
    else {
      var ls=$('loginScreen'); if(ls) ls.style.display='none';
      $('studentApp').style.display='none';
      $('resultPage').style.display='none';
      var tp=$('testPage'); tp.style.display='block';
    }

    var tp=$('testPage');
    tp.innerHTML =
      '<div class="test-header">' +
        '<div class="th-left">Soal <span id="curNum">1</span>/<span id="totNum">' + PS.questions.length + '</span></div>' +
        '<div style="display:flex;align-items:center;gap:.5rem;">' +
          '<div id="violCounter" title="Pelanggaran" style="display:flex;align-items:center;gap:.375rem;padding:.5rem .75rem;background:#f1f5f9;border-radius:8px;font-weight:700;color:#64748b;">' +
            '<span class="material-icons" style="font-size:18px;">shield</span><span id="violDisplay">0/' + (PS.settings.maxTabSwitches||3) + '</span></div>' +
          '<div class="test-timer" id="testTimer"><span class="material-icons">timer</span><span id="timerDisplay">00:00</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="num-strip-row">' +
        '<div class="num-strip" id="numStrip"></div>' +
        '<button class="btn btn-secondary btn-sm" onclick="toggleNavPanel()" title="Menu Soal"><span class="material-icons">grid_view</span></button>' +
      '</div>' +
      '<div class="test-body" id="testBody"></div>' +
      '<div class="bottom-nav">' +
        '<button class="btn btn-secondary" id="btnPrevQ" onclick="navQ(-1)"><span class="material-icons">arrow_back</span>Prev</button>' +
        '<button class="btn btn-primary" id="btnNextQ" onclick="navQ(1)">Next<span class="material-icons">arrow_forward</span></button>' +
        '<button class="btn btn-success" id="btnSubmitQ" style="display:none;" onclick="confirmSubmit()"><span class="material-icons">send</span>Kumpulkan</button>' +
      '</div>' +
      '<div class="question-nav-panel" id="questionNavPanel">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;"><strong>Navigasi Soal</strong>' +
        '<button class="menu-toggle" onclick="toggleNavPanel()"><span class="material-icons">close</span></button></div>' +
        '<div class="question-grid-nav" id="questionGridNav"></div>' +
        '<button class="btn btn-success w-full" onclick="confirmSubmit()"><span class="material-icons">send</span>Kumpulkan</button>' +
      '</div>';

    renderNav();
    renderQuestion();
    startTimer();
    updateViolDisplay();
    enterTestMode();
  }

  function enterTestMode(){
    history.pushState(null, '', location.href);
    window.addEventListener('popstate', onBack);
    initAntiCheat();
  }
  function exitTestMode(){
    window.removeEventListener('popstate', onBack);
    cleanupAntiCheat();
    exitFS();
  }
  function onBack(){
    history.pushState(null, '', location.href);
    if (!isAntiCheatOn()) return;
    registerViolation('coba kembali');
    alert2('Peringatan', 'Anda tidak dapat kembali selama simulasi berlangsung. Fokus pada soal.', 'warning');
  }

  function startTimer(){
    if (PS.timer) clearInterval(PS.timer);
    updateTimer();
    PS.timer = setInterval(function(){
      PS.timeRemaining--;
      updateTimer();
      if (PS.timeRemaining % 5 === 0) saveRemaining();
      var el=$('testTimer'); if(el && PS.timeRemaining<=300) el.classList.add('warning');
      if (PS.timeRemaining <= 0) { clearInterval(PS.timer); alert2('Waktu Habis','Jawaban dikumpulkan otomatis.','warning',function(){submitTest(true);}); }
    },1000);
  }
  function updateTimer(){
    var m=Math.floor(Math.max(0,PS.timeRemaining)/60), s=Math.max(0,PS.timeRemaining)%60;
    var el=$('timerDisplay'); if(el) el.textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  }
  function saveRemaining(){ if(PS.attemptId) db.collection('attempts').doc(PS.attemptId).update({remaining:PS.timeRemaining}).catch(function(){}); }

  function renderNav(){
    var strip=$('numStrip'); if(strip){
      strip.innerHTML = PS.questions.map(function(q,i){
        var cls='num-dot';
        if(i===PS.currentIndex) cls+=' current';
        else if(PS.answers[q.id]!==undefined && PS.answers[q.id]!=='') cls+=' answered';
        return '<button class="'+cls+'" onclick="gotoQ('+i+')">'+(i+1)+'</button>';
      }).join('');
    }
    var grid=$('questionGridNav'); if(grid){
      grid.innerHTML = PS.questions.map(function(q,i){
        var cls='q-nav-btn';
        if(i===PS.currentIndex) cls+=' current';
        else if(PS.answers[q.id]!==undefined && PS.answers[q.id]!=='') cls+=' answered';
        return '<button class="'+cls+'" onclick="gotoQ('+i+')">'+(i+1)+'</button>';
      }).join('');
    }
  }

  function renderQuestion(){
    var q = PS.questions[PS.currentIndex];
    if (!q) return;
    var cn=$('curNum'); if(cn) cn.textContent = PS.currentIndex+1;

    var labels={PGS:'Pilihan Ganda',MCMA:'Pilihan Ganda Kompleks',PGK:'Kategori Benar/Salah',ISIAN:'Isian Singkat'};
    var html = '<div class="question-card">' +
      '<div class="q-head">' +
        '<div class="q-head-left">Soal ' + (PS.currentIndex+1) + ' <span class="question-type-badge ' + q.type.toLowerCase() + '">' + (labels[q.type]||q.type) + '</span></div>' +
        '<div class="q-ctrl">' +
          '<button onclick="changeFont(-1)" title="Kecilkan teks"><span class="material-icons">remove</span></button>' +
          '<button onclick="changeFont(1)" title="Besarkan teks"><span class="material-icons">add</span></button>' +
          '<button onclick="openFeedbackFor(\'' + q.id + '\')" title="Laporkan soal"><span class="material-icons">flag</span></button>' +
        '</div>' +
      '</div>' +
      '<div class="question-text" id="qText" style="font-size:' + (PS.qFont||16) + 'px;">' + escapeHtml(q.text||'') + '</div>' +
      (window.questionImageHtml ? window.questionImageHtml(q) : '');

    if (q.type==='PGS'){ html+='<div class="options-list">';
      ['A','B','C','D'].forEach(function(l){ if(!q.options||!q.options[l])return; var sel=PS.answers[q.id]===l;
        html+='<div class="option-item'+(sel?' selected':'')+'" onclick="answerPGS(\''+q.id+'\',\''+l+'\')"><div class="option-label">'+l+'</div><div class="option-text">'+escapeHtml(q.options[l])+'</div></div>'; });
      html+='</div>';
    } else if (q.type==='MCMA'){ var cur=PS.answers[q.id]||[]; html+='<div class="options-list">';
      ['A','B','C','D','E'].forEach(function(l){ if(!q.options||!q.options[l])return; var sel=cur.indexOf(l)!==-1;
        html+='<div class="option-item'+(sel?' selected':'')+'" onclick="answerMCMA(\''+q.id+'\',\''+l+'\')"><div class="option-label">'+l+'</div><div class="option-text">'+escapeHtml(q.options[l])+'</div></div>'; });
      html+='</div>';
    } else if (q.type==='PGK'){ var arr=PS.answers[q.id]||[]; html+='<div class="statement-list">';
      (q.statements||[]).forEach(function(st,i){ var v=arr[i];
        html+='<div class="statement-item"><div class="statement-text">'+(i+1)+'. '+escapeHtml(st)+'</div><div class="statement-options">' +
          '<button class="statement-btn'+(v===true?' selected':'')+'" onclick="answerPGK(\''+q.id+'\','+i+',true)">True</button>' +
          '<button class="statement-btn'+(v===false?' selected':'')+'" onclick="answerPGK(\''+q.id+'\','+i+',false)">False</button></div></div>'; });
      html+='</div>';
    } else if (q.type==='ISIAN'){
      html+='<input type="text" class="answer-input" placeholder="Ketik jawaban..." value="'+escapeHtml(PS.answers[q.id]||'')+'" oninput="answerISIAN(\''+q.id+'\', this.value)">';
    }
    html+='</div>';

    $('testBody').innerHTML = html;

    var last = PS.currentIndex === PS.questions.length-1;
    $('btnPrevQ').disabled = PS.currentIndex===0;
    $('btnNextQ').style.display = last ? 'none' : 'inline-flex';
    $('btnSubmitQ').style.display = last ? 'inline-flex' : 'none';
  }

  window.changeFont = function(d){
    PS.qFont = Math.max(12, Math.min(24, (PS.qFont||16) + d*2));
    var el=$('qText'); if(el) el.style.fontSize = PS.qFont + 'px';
  };

  function saveProgress(){
    if(!PS.attemptId) return;
    db.collection('attempts').doc(PS.attemptId).update({ answers:PS.answers, progress:PS.currentIndex, remaining:PS.timeRemaining }).catch(function(){});
    renderNav();
  }

  window.answerPGS=function(qid,l){PS.answers[qid]=l;saveProgress();renderQuestion();};
  window.answerMCMA=function(qid,l){var c=PS.answers[qid]||[];var i=c.indexOf(l);if(i===-1)c.push(l);else c.splice(i,1);PS.answers[qid]=c;saveProgress();renderQuestion();};
  window.answerPGK=function(qid,i,v){var a=PS.answers[qid]||[];a[i]=v;PS.answers[qid]=a;saveProgress();renderQuestion();};
  window.answerISIAN=function(qid,v){PS.answers[qid]=v.trim();saveProgress();};
  window.navQ=function(d){var n=PS.currentIndex+d;if(n<0||n>=PS.questions.length)return;PS.currentIndex=n;saveProgress();renderQuestion();};
  window.gotoQ=function(i){PS.currentIndex=i;saveProgress();renderQuestion();var p=$('questionNavPanel');if(p)p.classList.remove('active');};
  window.toggleNavPanel=function(){var p=$('questionNavPanel');if(p)p.classList.toggle('active');};

  function registerViolation(type){
    PS.tabSwitch++;
    PS.antiLog.push({t:Date.now(),type:type});
    updateAnti();
    updateViolDisplay();
    playAlarm();
    if (isAntiCheatOn() && PS.tabSwitch >= PS.settings.maxTabSwitches) {
      alert2('Pelanggaran!','Anda melebihi batas pelanggaran. Jawaban dikumpulkan.','error',function(){submitTest(true);});
    }
  }
  function onVis(){
    if(!PS.attemptId) return;
    if(document.hidden){
      if (isAntiCheatOn()) registerViolation('tab_switch');
    } else {
      if (isAntiCheatOn()) showAntiWarning();
    }
  }
  function onBlur(){ if(PS.attemptId){ PS.blur++; PS.antiLog.push({t:Date.now(),type:'blur'}); updateAnti(); } }
  function updateAnti(){ if(PS.attemptId) db.collection('attempts').doc(PS.attemptId).update({tabSwitchCount:PS.tabSwitch,blurCount:PS.blur,antiCheatLog:PS.antiLog}).catch(function(){}); }
  function showAntiWarning(){
    var w=document.createElement('div'); w.className='anti-cheat-warning';
    w.innerHTML='<span class="material-icons">warning</span> Terdeteksi keluar/pindah! ('+PS.tabSwitch+'/'+(PS.settings.maxTabSwitches||3)+')';
    document.body.appendChild(w); setTimeout(function(){w.remove();},3000);
  }
  function initAntiCheat(){ cleanupAntiCheat(); document.addEventListener('visibilitychange',onVis); window.addEventListener('blur',onBlur); }
  function cleanupAntiCheat(){ document.removeEventListener('visibilitychange',onVis); window.removeEventListener('blur',onBlur); }

  window.submitTest = async function(auto){
    if (PS.timer) clearInterval(PS.timer);
    exitTestMode();
    var load = loading('Menghitung nilai...');
    var correct=0;
    PS.questions.forEach(function(q){ var a=PS.answers[q.id]; var ok=false;
      if(q.type==='PGS') ok=(a===q.correctAnswer);
      else if(q.type==='MCMA') ok=JSON.stringify((a||[]).slice().sort())===JSON.stringify((q.correctAnswer||[]).slice().sort());
      else if(q.type==='PGK') ok=window.isQuestionBooleanAnswerCorrect
        ? window.isQuestionBooleanAnswerCorrect(q,a)
        : JSON.stringify(a||[])===JSON.stringify(q.correctAnswer||[]);
      else if(q.type==='ISIAN') ok=String(a||'').toLowerCase().trim()===String(q.correctAnswer||'').toLowerCase().trim();
      if(ok)correct++; });
    var score=Math.round((correct/PS.questions.length)*100);
    var totalTime=Math.round((Date.now()-PS.startTime)/1000);
    try{
      await db.collection('attempts').doc(PS.attemptId).update({
        status:'completed', answers:PS.answers, score:score, correctAnswers:correct, totalQuestions:PS.questions.length,
        totalTime:totalTime, finishedAt:firebase.firestore.FieldValue.serverTimestamp(),
        tabSwitchCount:PS.tabSwitch, blurCount:PS.blur, antiCheatLog:PS.antiLog, remaining:0, autoSubmitted:!!auto });
      load.close();
      showResult(score, correct, totalTime, auto);
    }catch(e){ load.close(); alert2('Error','Gagal menyimpan: '+e.message,'error'); }
  };

  window.confirmSubmit = function(){
    var un=PS.questions.filter(function(q){
      var a=PS.answers[q.id];
      if (q.type==='PGK' && window.isQuestionBooleanAnswerComplete) return !window.isQuestionBooleanAnswerComplete(q,a);
      return a===undefined||a===''||(Array.isArray(a)&&a.length===0);
    }).length;
    var msg='Kumpulkan jawaban?';
    if(un>0) msg+='<br><span style="color:#f59e0b;font-weight:600;">'+un+' soal belum dijawab.</span>';
    confirm2('Submit', msg, function(){ submitTest(false); });
  };

  window.startSession = startSession;
  window.escapeHtml = function(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
})();

console.log('✅ test.js v2.1 loaded (block realtime dari startSession)');
