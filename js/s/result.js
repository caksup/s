/* s#27 | /root/js/s/result.js | v 2.8 | u 18/09/2026 • 08:00:00 | xu : ke-12 | note : #noteresponse
- v2.7 (baseline user) -> v2.8 (RETRY UNLIMITED, sesuai homework.js v1.8 &
  dashboard.js v2.15 — PR ala Quizizz):
  * canRetryNow() DIUBAH total:
    - Mode 'once'      : tidak ada retry (tetap).
    - Mode free/conditional : SELALU boleh retry s.d. deadline, TANPA
      syarat nilai, TANPA batas percobaan (unlimited).
    - TAMBAH gate hwExpired(): bila deadline lewat -> tombol retry TIDAK
      muncul (karena homework.js menolak memulai attempt setelah deadline).
  * buildModeSection():
    - Label "Percobaan N / 2" -> "Percobaan N" (tanpa pembatas).
    - Badge "Retry terpakai" DIHAPUS.
    - Tombol retry: "Coba Lagi (Percobaan N+1)" TANPA /M.
    - Teks "Anda sudah menggunakan semua kesempatan" DIHAPUS (unlimited).
    - Tombol hanya muncul bila !hwExpired && canRetryNow (mode free).
  * retryHomeworkNow():
    - attemptNumber baru dihitung dari jumlah attempt completed (tanpa
      batas atas), bukan hard-coded 2.
    - Konfirmasi menampilkan nomor percobaan berikutnya.
  * TETAP IDENTIK dari v2.7:
    - reviewAnswers menampilkan kunci + pembahasan untuk PR, Live tetap
      catatan "WhatsApp" (tidak berubah).
    - Helper getPembahasan(q), formatKunci(q), applyScoreIcon.
    - __lastResult menyimpan flag isHw, findSessionSync/Async,
      bestAttemptOf, attemptNumber (tetap dipakai).
    - showScreen terpusat, debug log [result], backToDashboard.
  * CATATAN: hwRetryAvailable/hwBestAttempt (dashboard) dan isUnlimited
    (homework) sudah sinkron dengan logika ini.
- EXPOSE: window.showResult, window.showResultFromAttempt, window.reviewAnswers,
  window.backToDashboard, window.retryHomeworkNow. */

(function(){
  'use strict';
  function $(id){ return document.getElementById(id); }

  function dbg(){ var a=['[result]']; for(var i=0;i<arguments.length;i++) a.push(arguments[i]); console.log.apply(console, a); }

  function isHwMode(s){ return !!(s && s.mode === 'homework'); }

  // v2.8: 'once' = 1x; nilai lain = free/unlimited s.d. deadline
  function getRetryMode(sess){
    if (!sess) return 'once';
    if (sess.retryMode && typeof sess.retryMode === 'string') return sess.retryMode;
    return isHwMode(sess) ? 'free' : 'once';
  }

  function findSessionSync(sid){
    var s = (PS.sessions||[]).find(function(x){ return x.id===sid; });
    if (!s && PS.currentSession && PS.currentSession.id===sid) s = PS.currentSession;
    return s || null;
  }

  async function findSessionAsync(sid){
    var s = findSessionSync(sid);
    if (s) return s;
    try {
      var ss = await db.collection('sessions').doc(sid).get();
      if (ss.exists) {
        var data = Object.assign({id:ss.id}, ss.data());
        PS.currentSession = data;
        return data;
      }
    } catch(e){ dbg('findSession fetch error:', e.message); }
    return null;
  }

  function bestAttemptOf(sid, excludeId){
    var atts = (PS.myAttempts||[]).filter(function(a){ return a.sessionId===sid && a.status==='completed' && a.id!==excludeId; });
    var best=null;
    atts.forEach(function(a){ if(!best || (a.score||0)>(best.score||0)) best=a; });
    return best;
  }

  function attemptNumber(a){
    var n = a && (a.attemptNumber || a.attemptNo);
    if (typeof n !== 'number' || n < 1) return 1;
    return n;
  }

  // v2.8: gate deadline
  function hwExpired(s){
    if (!s || !s.endTime) return false;
    var t = new Date(s.endTime).getTime();
    return !isNaN(t) && Date.now() > t;
  }

  // v2.8: unlimited retry s.d. deadline, tanpa syarat nilai
  function canRetryNow(sess, attempt){
    if (!isHwMode(sess)) { dbg('canRetry: bukan homework'); return false; }
    var retryMode = getRetryMode(sess);
    if (retryMode === 'once') { dbg('canRetry: mode once, tidak ada retry'); return false; }
    if (hwExpired(sess)) { dbg('canRetry: deadline lewat'); return false; }
    // Mode free/conditional: selalu boleh, tanpa syarat nilai, tanpa batas atas
    dbg('canRetry: TRUE (unlimited, score='+(attempt&&attempt.score)+')');
    return true;
  }

  function p2(n){ return String(n).padStart(2,'0'); }
  function fmtTime(sec){
    sec = Math.max(0, Math.floor(sec||0));
    return Math.floor(sec/60) + ':' + p2(sec%60);
  }
  function escapeHtmlR(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function getPembahasan(q){
    if (!q) return '';
    return q.pembahasan || q.explanation || q.pembahasanText || q.solution || '';
  }

  function formatKunci(q){
    if (!q) return '-';
    if (q.type === 'PGS') {
      var c = q.correctAnswer;
      if (!c) return '-';
      return String(c) + ((q.options && q.options[c]) ? ' — ' + q.options[c] : '');
    }
    if (q.type === 'ISIAN') return String(q.correctAnswer||'-');
    if (q.type === 'MCMA') {
      var arr = q.correctAnswer || [];
      if (!arr.length) return '-';
      return arr.map(function(k){
        return String(k) + ((q.options && q.options[k]) ? ' — ' + q.options[k] : '');
      }).join(', ');
    }
    if (q.type === 'PGK') {
      var arr2 = q.correctAnswer || [];
      if (!arr2.length) return '-';
      return arr2.map(function(v,i){ return (i+1)+':'+(v?'Benar':'Salah'); }).join(', ');
    }
    return '-';
  }

  function applyScoreIcon(icon, score){
    if (!icon) return;
    if(score>=80){ icon.style.background='#d1fae5'; icon.style.color='#10b981'; icon.innerHTML='<span class="material-icons">emoji_events</span>'; }
    else if(score>=60){ icon.style.background='#fef3c7'; icon.style.color='#f59e0b'; icon.innerHTML='<span class="material-icons">mood</span>'; }
    else { icon.style.background='#fee2e2'; icon.style.color='#ef4444'; icon.innerHTML='<span class="material-icons">sentiment_dissatisfied</span>'; }
  }

  function buildModeSection(sess, attempt){
    if (!sess) return '';
    var modeBadge = isHwMode(sess)
      ? '<div style="text-align:center;margin-bottom:.75rem;"><span class="mode-badge-hw"><span class="material-icons">menu_book</span>Homework / PR</span></div>'
      : '<div style="text-align:center;margin-bottom:.75rem;"><span class="mode-badge-live"><span class="material-icons">bolt</span>Live Exercise</span></div>';

    if (!isHwMode(sess)) return modeBadge;

    var num = attemptNumber(attempt);
    // v2.8: "Percobaan N" saja, tanpa /M
    var percobaanHtml = '<div style="display:flex;justify-content:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem;">' +
      '<span class="badge badge-info">Percobaan '+num+'</span>' +
      '</div>';

    var best = bestAttemptOf(sess.id, attempt.id);
    var bestHtml = '';
    if (best && num > 1) {
      var bestScore = Math.max((attempt.score||0), (best.score||0));
      bestHtml = '<div style="margin-top:.5rem;padding:.625rem;background:#ecfdf5;border:1px dashed #10b981;border-radius:8px;font-size:.8125rem;color:#065f46;">' +
        '<div style="font-weight:600;display:flex;align-items:center;justify-content:center;gap:.375rem;">' +
          '<span class="material-icons" style="font-size:16px;">emoji_events</span>' +
          'Nilai tertinggi (antar percobaan): <b style="font-size:1.125rem;">'+bestScore+'</b>' +
        '</div>' +
      '</div>';
    }

    var retryHtml = '';
    if (canRetryNow(sess, attempt)) {
      var nextNo = num + 1;
      retryHtml =
        '<div style="margin-top:1rem;padding:.875rem;background:linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%);border:2px solid #f59e0b;border-radius:12px;text-align:center;">' +
          '<div style="display:flex;align-items:center;justify-content:center;gap:.375rem;margin-bottom:.375rem;">' +
            '<span class="material-icons" style="font-size:24px;color:#d97706;">refresh</span>' +
            '<b style="color:#92400e;font-size:1rem;">Coba Lagi</b>' +
          '</div>' +
          '<div style="font-size:.8125rem;color:#78350f;margin-bottom:.5rem;">' +
            'Perbaiki nilai di percobaan berikutnya. Nilai tertinggi yang dicatat.' +
          '</div>' +
          '<button type="button" class="btn btn-warning w-full" style="margin-top:.5rem;position:relative;z-index:10;" onclick="retryHomeworkNow(\''+String(sess.id).replace(/'/g,"\\'")+'\')">' +
            '<span class="material-icons">refresh</span>Coba Lagi (Percobaan ' + nextNo + ')' +
          '</button>' +
        '</div>';
    } else if (hwExpired(sess) && num >= 1) {
      retryHtml = '<div style="margin-top:1rem;padding:.625rem;background:#f1f5f9;border-radius:8px;font-size:.8125rem;color:#475569;text-align:center;">' +
        '<span class="material-icons" style="font-size:14px;vertical-align:-2px;">schedule</span> ' +
        'Deadline sudah lewat. Tidak bisa mencoba lagi.' +
      '</div>';
    }

    return modeBadge + percobaanHtml + bestHtml + retryHtml;
  }

  function showResult(score, correct, totalTime, auto){
    dbg('showResult: score='+score+' correct='+correct+' auto='+auto);
    if (window.showScreen) showScreen('result');
    else {
      var ls=$('loginScreen'); if(ls) ls.style.display='none';
      var sa=$('studentApp'); if(sa) sa.style.display='none';
      var tp=$('testPage'); if(tp) tp.style.display='none';
      var rp=$('resultPage'); if(rp) rp.style.display='block';
    }

    var icon=$('resultIcon');
    if (icon) applyScoreIcon(icon, score);

    var scoreEl = $('resultScore'); if (scoreEl) scoreEl.textContent = score;
    var rcEl = $('rCorrect'); if (rcEl) rcEl.textContent = correct;
    var rwEl = $('rWrong'); if (rwEl) rwEl.textContent = (PS.questions||[]).length - correct;
    var rtEl = $('rTime'); if (rtEl) rtEl.textContent = fmtTime(totalTime);
    var raEl = $('rAcc'); if (raEl) raEl.textContent = Math.round((correct / Math.max(1,(PS.questions||[]).length)) * 100) + '%';

    window.__lastResult = {
      score:score, correct:correct,
      questions: PS.questions || [],
      answers: PS.answers || {},
      attemptId: PS.attemptId,
      attemptNumber: PS.attemptNumber || 1,
      isHw: !!(PS.currentSession && PS.currentSession.mode === 'homework')
    };

    injectModeSection(PS.currentSession, {
      id: PS.attemptId,
      score: score,
      correctAnswers: correct,
      totalQuestions: (PS.questions||[]).length,
      attemptNumber: PS.attemptNumber || 1
    });
  }

  async function showResultFromAttempt(id){
    dbg('showResultFromAttempt: id='+id);
    var d = await db.collection('attempts').doc(id).get();
    if(!d.exists){ toast('Attempt tidak ditemukan','warning'); return; }
    var a = Object.assign({id:id}, d.data());

    var qSnap = await db.collection('questions').where('sessionId','==',a.sessionId).get();
    var qs = [];
    qSnap.forEach(function(q){ qs.push(Object.assign({id:q.id}, q.data())); });
    qs.sort(function(x,y){ return (x.order||0)-(y.order||0); });

    if (window.showScreen) showScreen('result');
    else {
      var ls=$('loginScreen'); if(ls) ls.style.display='none';
      var sa=$('studentApp'); if(sa) sa.style.display='none';
      var tp=$('testPage'); if(tp) tp.style.display='none';
      var rp=$('resultPage'); if(rp) rp.style.display='block';
    }

    var icon=$('resultIcon'); var score=a.score||0;
    if (icon) applyScoreIcon(icon, score);

    var scoreEl = $('resultScore'); if (scoreEl) scoreEl.textContent = score;
    var rcEl = $('rCorrect'); if (rcEl) rcEl.textContent = a.correctAnswers||0;
    var rwEl = $('rWrong'); if (rwEl) rwEl.textContent = (a.totalQuestions||0)-(a.correctAnswers||0);
    var rtEl = $('rTime'); if (rtEl) rtEl.textContent = fmtTime(a.totalTime||0);
    var raEl = $('rAcc'); if (raEl) raEl.textContent = score+'%';

    var sess = await findSessionAsync(a.sessionId);
    var isHw = (a.mode === 'homework') || isHwMode(sess);

    window.__lastResult = {
      score:score, correct:a.correctAnswers,
      questions:qs, answers:a.answers||{},
      attemptId: a.id, attemptNumber: attemptNumber(a),
      isHw: isHw
    };

    injectModeSection(sess, a);
  }

  function injectModeSection(sess, attempt){
    var card = document.querySelector('.result-card');
    if (!card) { dbg('injectModeSection: card tidak ditemukan'); return; }
    var old = card.querySelector('.result-mode-section');
    if (old) old.remove();
    var sec = document.createElement('div');
    sec.className = 'result-mode-section';
    sec.innerHTML = buildModeSection(sess, attempt);
    var icon = card.querySelector('.result-icon');
    if (icon && icon.nextSibling) card.insertBefore(sec, icon.nextSibling);
    else card.appendChild(sec);
    dbg('injectModeSection: sess=', sess ? sess.id : 'null');
  }

  // v2.8: attemptNumber baru = jumlah attempt completed + 1 (tanpa batas atas)
  window.retryHomeworkNow = async function(sid){
    dbg('retryHomeworkNow: sid='+sid);
    if (!window.initHomework) {
      alert2('Error','Modul homework tidak tersedia. Refresh halaman dan coba lagi.','error');
      return;
    }
    var sess = await findSessionAsync(sid);
    if (!sess) { alert2('Error','Sesi tidak ditemukan','error'); return; }
    if (!canRetryNow(sess, null)) {
      alert2('Info','Sesi tidak bisa dicoba lagi (deadline lewat / mode sekali).','info');
      return;
    }
    var atts = (PS.myAttempts||[]).filter(function(a){ return a.sessionId===sid && a.status==='completed'; });
    var nextNo = atts.length + 1;
    if (!confirm('Mulai Percobaan ke-'+nextNo+'?\n\nSoal akan sama seperti percobaan sebelumnya.\nNilai tertinggi yang akan dicatat.')) return;
    try {
      await initHomework(sid, nextNo, true);
    } catch(e){
      alert2('Error','Gagal memulai percobaan: '+e.message,'error');
      if (window.backToDashboard) backToDashboard();
    }
  };

  window.reviewAnswers = function(){
    var r=window.__lastResult;
    if(!r||!r.questions||!r.questions.length){toast('Data review tidak tersedia','warning');return;}
    var isHw = !!r.isHw;

    var html='<div style="max-height:50vh;overflow-y:auto;">';
    r.questions.forEach(function(q,i){
      var a=r.answers[q.id];
      var ok=false;
      if(q.type==='PGS') ok=(a===q.correctAnswer);
      else if(q.type==='MCMA') ok=JSON.stringify((a||[]).slice().sort())===JSON.stringify((q.correctAnswer||[]).slice().sort());
      else if(q.type==='PGK') ok=window.isQuestionBooleanAnswerCorrect
        ? window.isQuestionBooleanAnswerCorrect(q,a)
        : JSON.stringify(a||[])===JSON.stringify(q.correctAnswer||[]);
      else if(q.type==='ISIAN') ok=String(a||'').toLowerCase().trim()===String(q.correctAnswer||'').toLowerCase().trim();

      var ans=a;
      if(q.type==='MCMA') ans=(a||[]).join(',');
      else if(q.type==='PGK') ans=(window.normalizeQuestionBooleanAnswers
        ? (window.normalizeQuestionBooleanAnswers(a)||[])
        : (a||[])).map(function(x){return x?'B':'S';}).join(',');

      var kunciHtml = '';
      if (isHw) {
        kunciHtml =
          '<div style="font-size:.75rem;margin-top:.5rem;padding:.5rem .625rem;background:#ecfdf5;border-left:3px solid #10b981;border-radius:6px;color:#065f46;">' +
            '<b>Jawaban benar:</b> '+escapeHtmlR(formatKunci(q)) +
          '</div>';
        var pb = getPembahasan(q);
        if (pb) {
          kunciHtml +=
            '<div style="font-size:.75rem;margin-top:.5rem;padding:.5rem .625rem;background:#eff6ff;border-left:3px solid #2563eb;border-radius:6px;color:#1e40af;">' +
              '<b>Pembahasan:</b><br>'+escapeHtmlR(pb) +
            '</div>';
        }
      }

      html+='<div style="border:1px solid '+(ok?'#10b981':'#ef4444')+';border-radius:8px;padding:.75rem;margin-bottom:.75rem;">'+
        '<div style="font-size:.75rem;font-weight:700;color:'+(ok?'#10b981':'#ef4444')+';margin-bottom:.375rem;">Soal '+(i+1)+' • '+(ok?'BENAR':'SALAH')+'</div>'+
        '<div style="font-size:.8125rem;margin-bottom:.5rem;">'+escapeHtmlR(q.text||'')+'</div>'+
        (window.questionImageHtml ? window.questionImageHtml(q) : '')+
        '<div style="font-size:.75rem;">Jawaban Anda: <b>'+escapeHtmlR(String(ans===undefined?'-':ans))+'</b></div>'+
        kunciHtml +
        '</div>';
    });
    html+='</div>';

    if (!isHw) {
      html+='<p style="font-size:.75rem;color:#64748b;margin-top:.5rem;">Pembahasan akan dibagikan oleh guru/admin melalui grup WhatsApp.</p>';
    }

    M.custom({ title:'Review Jawaban', message:html, type:'info', buttons:[{text:'Tutup',class:'btn-primary'}] });
  };

  window.backToDashboard = function(){
    PS.currentSession=null; PS.questions=[]; PS.answers={}; PS.attemptId=null;
    if (window.showScreen) showScreen('app');
    else {
      var ls=$('loginScreen'); if(ls) ls.style.display='none';
      var tp=$('testPage'); if(tp) tp.style.display='none';
      var rp=$('resultPage'); if(rp) rp.style.display='none';
      var sa=$('studentApp'); if(sa) sa.style.display='block';
    }
    if (PS.setTab) PS.setTab('home');
    if(window.loadDashboard) loadDashboard();
  };

  window.showResult = showResult;
  window.showResultFromAttempt = showResultFromAttempt;

  console.log('✅ result.js v2.8 loaded (retry unlimited s.d. deadline, tanpa syarat nilai)');
})();