/* s-rt-session.js | v 1.1 | Subscribe & state management Realtime
   - v1.0 -> v1.1: pakai window.rtShowScreen (bukan showScreen global milik
     state.js) & semua ekspor ber-prefix rt* agar tidak menimpa global lain. */
(function(){
  'use strict';
  function $(id){ return document.getElementById(id); }
  function nowMs(){ return Date.now(); }

  function rtIdx(){
    if (!RT.room) return -1;
    var v = RT.room.currentQuestionIndex;
    return (typeof v === 'number' && !isNaN(v)) ? v : -1;
  }
  window.rtIdx = rtIdx;

  function rtEndsAtMs(){
    try {
      var t = RT.room && RT.room.questionEndsAt;
      if (!t) return 0;
      return t.toDate ? t.toDate().getTime() : new Date(t).getTime();
    } catch(e){ return 0; }
  }
  window.rtEndsAtMs = rtEndsAtMs;

  function rtDurationSec(){ return (RT.room && (RT.room.questionDurationSec || RT.room.questionDuration)) || 30; }
  window.rtDurationSec = rtDurationSec;

  function rtNormalPoints(correct, remainingMs){
    if (!correct) return 0;
    var dur = rtDurationSec() * 1000;
    var bonus = Math.round(5 * Math.max(0, remainingMs) / Math.max(1, dur));
    return 10 + bonus;
  }
  window.rtNormalPoints = rtNormalPoints;

  function rtResetAnswerState(){
    RT.myAnswer = null;
    RT.submitted = false;
    RT.currentQIndex = -999;
    RT.currentQId = null;
    RT.lastRenderedAnswerKey = '';
  }
  window.rtResetAnswerState = rtResetAnswerState;

  function rtUpdateOnlineIndicator(){
    var radarEls = document.querySelectorAll('.rt-online-radar');
    radarEls.forEach(function(el){
      if (RT.online) el.classList.remove('offline');
      else el.classList.add('offline');
      el.title = RT.online ? 'Koneksi realtime aktif' : 'Koneksi terputus';
    });
  }
  window.rtUpdateOnlineIndicator = rtUpdateOnlineIndicator;

  function rtUnsubscribeAll(){
    try { if (RT.unsubRoom) RT.unsubRoom(); } catch(e){}
    try { if (RT.unsubPlayers) RT.unsubPlayers(); } catch(e){}
    try { if (RT.unsubAnswers) RT.unsubAnswers(); } catch(e){}
    if (RT.tickTimer) clearInterval(RT.tickTimer);
    if (RT.watchTimer) clearInterval(RT.watchTimer);
    RT.unsubRoom = RT.unsubPlayers = RT.unsubAnswers = null;
    RT.tickTimer = null; RT.watchTimer = null;
  }
  window.rtUnsubscribeAll = rtUnsubscribeAll;

  function rtStartTick(){
    if (RT.tickTimer) clearInterval(RT.tickTimer);
    RT.tickTimer = setInterval(function(){
      if (typeof window.rtRenderCountdown === 'function') window.rtRenderCountdown();
      var sq = $('rtSubmitArea');
      if (sq && RT.room && RT.room.status === 'playing') {
        sq.style.display = (!RT.submitted && rtEndsAtMs() > nowMs()) ? 'block' : 'none';
      }
    }, 500);
  }
  window.rtStartTick = rtStartTick;

  function rtStartWatchdog(){
    if (RT.watchTimer) clearInterval(RT.watchTimer);
    RT.watchTimer = setInterval(function(){
      if (!RT.room || RT.room.status !== 'playing') return;
      var idx = rtIdx();
      if (idx >= 0 && idx !== RT.currentQIndex) {
        console.log('[rt] watchdog: drift terdeteksi, render ulang soal', idx);
        rtResetAnswerState();
        if (typeof window.rtRenderQuestion === 'function') window.rtRenderQuestion(true);
      }
    }, 2000);
  }
  window.rtStartWatchdog = rtStartWatchdog;

  function rtShow(screenId){
    if (typeof window.rtShowScreen === 'function') window.rtShowScreen(screenId);
  }

  function rtSubscribe(){
    rtUnsubscribeAll();
    if (!RT.roomId) return;

    RT.unsubRoom = db.collection('liveRooms').doc(RT.roomId).onSnapshot(function(doc){
      RT.online = true;
      rtUpdateOnlineIndicator();
      if (!doc.exists) {
        if (typeof window.alertSafe === 'function') window.alertSafe('Realtime Berakhir','Room tidak tersedia.','warning');
        if (typeof window.rtBackToHome === 'function') window.rtBackToHome();
        return;
      }

      var prevIndex = rtIdx();
      var prevStatus = RT.room ? RT.room.status : null;
      var prevEndsAt = rtEndsAtMs();

      RT.room = Object.assign({id:doc.id}, doc.data());

      var newIndex = rtIdx();
      var newStatus = RT.room.status;
      var newEndsAt = rtEndsAtMs();

      if (newStatus === 'finished') {
        rtShow('rtFinishedScreen');
        if (typeof window.rtRenderFinished === 'function') window.rtRenderFinished();
        return;
      }
      if (newStatus === 'lobby') {
        rtShow('rtLobbyScreen');
        if (typeof window.rtRenderLobby === 'function') window.rtRenderLobby();
        return;
      }
      if (newStatus === 'playing') {
        rtShow('rtPlayingScreen');

        var indexChanged = prevIndex !== newIndex;
        var statusChanged = prevStatus !== 'playing';
        var newTimerAfterSubmit = (RT.submitted && newEndsAt && newEndsAt !== prevEndsAt && newEndsAt > nowMs());

        if (indexChanged || statusChanged || newTimerAfterSubmit) {
          rtResetAnswerState();
          if (typeof window.rtRenderQuestion === 'function') window.rtRenderQuestion(true);
        } else {
          if (typeof window.rtRenderQuestion === 'function') window.rtRenderQuestion(false);
        }
      }
    }, function(err){
      console.error('[rt] room snapshot error:', err);
      RT.online = false;
      rtUpdateOnlineIndicator();
    });

    RT.unsubPlayers = db.collection('liveRooms').doc(RT.roomId).collection('players').onSnapshot(function(snap){
      RT.online = true;
      rtUpdateOnlineIndicator();
      RT.players = {};
      snap.forEach(function(d){ RT.players[d.id] = Object.assign({id:d.id}, d.data()); });
      if (typeof window.rtRenderLobby === 'function') window.rtRenderLobby();
      if (typeof window.rtRenderParticipants === 'function') window.rtRenderParticipants();
      if (typeof window.rtRenderLeaderboard === 'function') window.rtRenderLeaderboard();
    }, function(err){
      console.error('[rt] players snapshot error:', err);
      RT.online = false;
      rtUpdateOnlineIndicator();
    });

    RT.unsubAnswers = db.collection('liveRooms').doc(RT.roomId).collection('answers').onSnapshot(function(snap){
      RT.answers = {};
      snap.forEach(function(d){ RT.answers[d.id] = Object.assign({id:d.id}, d.data()); });
      if (typeof window.rtRenderAnswerFeedback === 'function') window.rtRenderAnswerFeedback();
      if (typeof window.rtRenderLeaderboard === 'function') window.rtRenderLeaderboard();
    }, function(err){
      console.error('[rt] answers snapshot error:', err);
    });

    rtStartTick();
    rtStartWatchdog();
  }
  window.rtSubscribe = rtSubscribe;

  console.log('✅ s-rt-session.js v1.1 loaded (rtShowScreen, ekspor prefix rt*)');
})();