/* s-rt-render.js | v 1.1 | Render realtime (lobby, playing, leaderboard, peserta)
   - v1.0 -> v1.1: pakai helper ber-prefix rt* (rtGetCurrentQuestion,
     rtEndsAtMs, rtDurationSec, rtEnsureQuestionsLoaded, rtUnsubscribeAll);
     buildOptionsHtml diekspor sebagai window.rtBuildOptionsHtml agar tidak
     menimpa global milik test.js. */
(function(){
  'use strict';
  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function nowMs(){ return Date.now(); }
  function endsAt(){ return (typeof window.rtEndsAtMs === 'function') ? window.rtEndsAtMs() : 0; }
  function curQ(){ return (typeof window.rtGetCurrentQuestion === 'function') ? window.rtGetCurrentQuestion() : null; }

  // ===== LOBBY =====
  function rtRenderLobby(){
    if (!RT.room) return;

    var heroEl = $('rtLobbyHero');
    if (heroEl) {
      var radarClass = RT.online ? 'rt-online-radar' : 'rt-online-radar offline';
      heroEl.innerHTML =
        '<div class="rt-head-actions" style="justify-content:flex-end;width:100%;margin-bottom:.5rem;">' +
          '<button class="rt-head-btn" onclick="rtRefreshConnection()" title="Refresh koneksi">' +
            '<span class="material-icons">refresh</span></button>' +
        '</div>' +
        '<div style="font-size:.6875rem;text-transform:uppercase;letter-spacing:.1em;opacity:.8;">Kode Join</div>' +
        '<div class="rt-code" id="rtCodeDisplay">'+esc(RT.room.code||'------')+'</div>' +
        '<div style="font-size:.8125rem;margin-top:.25rem;">' +
          '<span class="'+radarClass+'" title="'+(RT.online?'Koneksi aktif':'Koneksi terputus')+'"></span>' +
          '<b>'+esc(RT.room.sessionName || 'Sesi Realtime')+'</b>' +
        '</div>' +
        '<p>Menunggu Mentor memulai soal...</p>';
    }

    var listEl = $('rtPlayerList');
    if (!listEl) return;

    var players = Object.keys(RT.players || {}).map(function(k){ return RT.players[k]; });
    if (!players.length) {
      listEl.innerHTML = '<div class="empty-state" style="padding:.5rem;"><p style="font-size:.8125rem;">Menunggu teman lain...</p></div>';
      return;
    }
    listEl.innerHTML =
      '<div style="font-size:.75rem;color:#64748b;margin-bottom:.375rem;font-weight:600;">' +
        '<span class="material-icons" style="font-size:14px;vertical-align:-2px;">groups</span> '+players.length+' pemain di lobby' +
      '</div>' +
      players.map(function(p,i){
        var isMe = p.id === RT.playerId || p.studentId === (PS.user && PS.user.id);
        return '<div class="rt-player-chip" style="'+(isMe?'background:#fffbeb;border-color:#fde68a;':'')+'">' +
          '<span style="color:#94a3b8;width:1.125rem;text-align:right;font-size:.75rem;">'+(i+1)+'.</span>' +
          '<span class="material-icons">person</span>' +
          '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(p.name||p.studentId||p.id)+'</span>' +
          (isMe ? '<span style="font-size:.6875rem;font-weight:700;color:#b45309;">Anda</span>' : '') +
        '</div>';
      }).join('');
  }
  window.rtRenderLobby = rtRenderLobby;

  // ===== PLAYING =====
  async function rtRenderQuestion(force){
    if (!RT.room || RT.room.status !== 'playing') return;
    if (typeof window.rtEnsureQuestionsLoaded === 'function') {
      var ok = await window.rtEnsureQuestionsLoaded();
      if (!ok) return;
    }

    var cur = curQ();
    if (!cur || cur.index == null || cur.index < 0) return;
    var q = cur.data;
    if (!q) {
      var te = $('rtQuestionText');
      if (te) te.textContent = 'Soal belum termuat. Menunggu sinkronisasi...';
      return;
    }

    var ansKey = RT.playerId + '_' + cur.index;
    var myAnsDoc = RT.answers ? RT.answers[ansKey] : null;
    var answerKey = myAnsDoc ? (ansKey + ':' + JSON.stringify(myAnsDoc.answer)) : 'no-answer';

    var shouldRender = force ||
      RT.currentQIndex !== cur.index ||
      RT.currentQId !== cur.id ||
      RT.lastRenderedAnswerKey !== answerKey;

    if (!shouldRender) {
      rtRenderCountdown();
      var sq = $('rtSubmitArea');
      if (sq) sq.style.display = (!RT.submitted && endsAt() > nowMs()) ? 'block' : 'none';
      return;
    }

    var isNewQuestion = (RT.currentQIndex !== cur.index || RT.currentQId !== cur.id);
    RT.currentQIndex = cur.index;
    RT.currentQId = cur.id;
    if (myAnsDoc) {
      RT.myAnswer = myAnsDoc.answer;
      RT.submitted = true;
    } else if (isNewQuestion) {
      RT.myAnswer = null;
      RT.submitted = false;
    }
    RT.lastRenderedAnswerKey = answerKey;

    var total = (RT.room.questionIds && RT.room.questionIds.length) ? RT.room.questionIds.length : (RT.questions||[]).length;

    var heroEl = $('rtPlayingHero');
    if (heroEl) {
      var radarClass = RT.online ? 'rt-online-radar' : 'rt-online-radar offline';
      heroEl.innerHTML =
        '<div style="display:flex;flex-direction:column;gap:.125rem;flex:1;min-width:0;">' +
          '<div style="display:flex;align-items:center;gap:.25rem;font-size:.75rem;opacity:.9;">' +
            '<span class="'+radarClass+'"></span>' +
            '<span>Soal <b id="rtQNum">'+(cur.index+1)+'</b> / <b id="rtQTotal">'+total+'</b></span>' +
          '</div>' +
          '<div id="rtTimerBig" class="rt-timer-big">--:--</div>' +
        '</div>' +
        '<div class="rt-head-actions">' +
          '<button class="rt-head-btn" onclick="rtRefreshConnection()" title="Refresh koneksi">' +
            '<span class="material-icons">refresh</span></button>' +
        '</div>';
    } else {
      var numEl = $('rtQNum'); if (numEl) numEl.textContent = cur.index + 1;
      var totalEl = $('rtQTotal'); if (totalEl) totalEl.textContent = total;
    }

    var labels = {PGS:'Pilihan Ganda',MCMA:'Pilihan Ganda Kompleks',PGK:'Kategori Benar/Salah',ISIAN:'Isian Singkat'};
    var typeEl = $('rtQuestionType');
    if (typeEl) typeEl.innerHTML = '<span class="rt-qmeta"><span class="question-type-badge '+esc(String(q.type||'').toLowerCase())+'">'+esc(labels[q.type]||q.type||'Soal')+'</span></span>';
    var textEl = $('rtQuestionText');
    if (textEl) textEl.innerHTML = esc(q.text || q.question || '') + (window.questionImageHtml ? window.questionImageHtml(q) : '');

    var optEl = $('rtOptions');
    if (optEl) optEl.innerHTML = rtBuildOptionsHtml(q);

    var submitEl = $('rtSubmitArea');
    if (submitEl) submitEl.style.display = (!RT.submitted && endsAt() > nowMs()) ? 'block' : 'none';

    rtRenderAnswerFeedback();
    rtRenderCountdown();
  }
  window.rtRenderQuestion = rtRenderQuestion;

  function letterSpan(l){ return '<span class="opt-letter">'+l+'</span>'; }

  function rtBuildOptionsHtml(q){
    var html = '';
    var dis = RT.submitted ? ' style="opacity:.75;pointer-events:none;"' : '';

    if (q.type === 'PGS') {
      ['A','B','C','D','E'].forEach(function(l){
        if (!q.options || q.options[l] == null || q.options[l] === '') return;
        html += '<div class="rt-option'+(RT.myAnswer===l?' selected':'')+'" data-val="'+l+'" onclick="rtSelectOption(\''+l+'\')"'+dis+'>'+letterSpan(l)+esc(q.options[l])+'</div>';
      });
    } else if (q.type === 'MCMA') {
      var sel = Array.isArray(RT.myAnswer) ? RT.myAnswer : [];
      ['A','B','C','D','E'].forEach(function(l){
        if (!q.options || q.options[l] == null || q.options[l] === '') return;
        html += '<div class="rt-option'+(sel.indexOf(l)!==-1?' selected':'')+'" data-val="'+l+'" onclick="rtToggleMCMA(\''+l+'\')"'+dis+'>'+letterSpan(l)+esc(q.options[l])+'</div>';
      });
    } else if (q.type === 'PGK') {
      var arr = Array.isArray(RT.myAnswer) ? RT.myAnswer : [];
      (q.statements || []).forEach(function(st,i){
        var v = arr[i];
        var bdis = RT.submitted ? ' disabled' : '';
        html += '<div class="rt-option" style="cursor:default;" data-stmt="'+i+'">' +
          '<div style="margin-bottom:.5rem;">'+(i+1)+'. '+esc(st)+'</div>' +
          '<div style="display:flex;gap:.5rem;">' +
            '<button type="button" class="btn btn-sm '+(v===true?'btn-primary':'btn-secondary')+'" data-val="true" onclick="rtTogglePGK('+i+',true)"'+bdis+'>True</button>' +
            '<button type="button" class="btn btn-sm '+(v===false?'btn-primary':'btn-secondary')+'" data-val="false" onclick="rtTogglePGK('+i+',false)"'+bdis+'>False</button>' +
          '</div></div>';
      });
    } else if (q.type === 'ISIAN') {
      html += '<input type="text" class="form-control" id="rtIsianInput" placeholder="Ketik jawaban..." value="'+esc(RT.myAnswer||'')+'" oninput="rtUpdateIsian(this.value)"'+(RT.submitted?' disabled':'')+'>';
    } else {
      html = '<div class="empty-state" style="padding:1rem;"><p>Tipe soal tidak dikenali.</p></div>';
    }
    return html;
  }
  window.rtBuildOptionsHtml = rtBuildOptionsHtml;

  function rtRenderCountdown(){
    var el = $('rtTimerBig');
    if (!el || !RT.room || RT.room.status !== 'playing') return;
    var ends = endsAt();
    if (!ends) { el.textContent = '--:--'; return; }
    var remain = Math.max(0, Math.floor((ends - nowMs())/1000));
    var m = Math.floor(remain/60), s = remain%60;
    el.textContent = String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
    el.classList.toggle('urgent', remain <= 5);
  }
  window.rtRenderCountdown = rtRenderCountdown;

  // ===== FEEDBACK =====
  function getExplanation(q){ return q.explanation || q.discussion || q.pembahasan || q.solution || ''; }

  function formatCorrect(q){
    if (!q) return '-';
    if (q.type === 'PGS') {
      var ca = q.correctAnswer;
      return ca + ((q.options && q.options[ca]) ? ' — ' + q.options[ca] : '');
    }
    if (q.type === 'ISIAN') return q.correctAnswer || '-';
    if (q.type === 'MCMA') {
      return (q.correctAnswer||[]).map(function(k){
        return k + ((q.options && q.options[k]) ? ' — ' + q.options[k] : '');
      }).join('<br>');
    }
    if (q.type === 'PGK') {
      return (q.correctAnswer||[]).map(function(v,i){
        var st = (q.statements && q.statements[i]) ? q.statements[i] : ('Pernyataan '+(i+1));
        return (i+1)+'. '+esc(st)+' = <b>'+(v?'True':'False')+'</b>';
      }).join('<br>');
    }
    return '-';
  }

  function rtRenderAnswerFeedback(){
    var el = $('rtAnswerFeedback');
    if (!el || !RT.room || RT.room.status !== 'playing') return;
    var cur = curQ();
    if (!cur || !cur.data) { el.style.display = 'none'; return; }
    var myAns = RT.answers ? RT.answers[RT.playerId + '_' + cur.index] : null;
    if (!myAns) { el.style.display = 'none'; return; }

    var q = cur.data;
    var expl = getExplanation(q);
    el.style.display = 'block';
    el.style.background = myAns.correct ? '#ecfdf5' : '#fef2f2';
    el.style.color = myAns.correct ? '#065f46' : '#991b1b';
    el.innerHTML =
      '<div style="font-weight:800;margin-bottom:.25rem;">' +
        (myAns.correct ? '✓ Benar' : '✗ Salah') +
        ' <span style="float:right;">+'+(myAns.points||0)+' poin</span>' +
      '</div>' +
      '<div style="font-size:.8125rem;margin-top:.25rem;"><b>Jawaban benar:</b><br>' + formatCorrect(q) + '</div>' +
      (expl ? '<div style="font-size:.8125rem;margin-top:.5rem;padding-top:.5rem;border-top:1px solid rgba(0,0,0,.08);"><b>Pembahasan:</b><br>' + esc(expl) + '</div>' : '');
  }
  window.rtRenderAnswerFeedback = rtRenderAnswerFeedback;

  // ===== LEADERBOARD =====
  function pointsForAnswer(a){
    if (!a || !a.correct) return 0;
    var dur = (typeof window.rtDurationSec === 'function') ? window.rtDurationSec() : 30;
    var usedSec = (a.timeMs || 0) / 1000;
    var remaining = Math.max(0, dur - usedSec);
    return 10 + Math.round(5 * remaining / Math.max(1, dur));
  }

  function buildLeaderboard(){
    var agg = {};
    Object.keys(RT.answers || {}).forEach(function(k){
      var a = RT.answers[k];
      var sid = a.studentId || a.playerId;
      if (!sid) return;
      var p = agg[sid] || (agg[sid] = { id:sid, studentId:sid, name:a.studentName||sid, score:0, correct:0 });
      p.score += pointsForAnswer(a);
      if (a.correct) p.correct++;
    });
    var list = Object.keys(agg).map(function(k){ return agg[k]; });
    list.sort(function(a,b){ return b.score - a.score; });
    return list;
  }

  function renderLeaderboardInto(el, list, limit){
    if (!el) return;
    if (!list.length) {
      el.innerHTML = '<div class="empty-state" style="padding:.5rem;"><p style="font-size:.8125rem;">Belum ada skor</p></div>';
      return;
    }
    el.innerHTML = list.slice(0, limit).map(function(p,i){
      var isMe = p.studentId === (PS.user && PS.user.id) || p.id === RT.playerId;
      var medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1);
      return '<div class="rt-leaderboard-row'+(isMe?' me':'')+'">' +
        '<span class="rt-rank">'+medal+'</span>' +
        '<span class="rt-name">'+esc(p.name)+(isMe?' (Anda)':'')+'</span>' +
        '<span class="rt-score">'+p.score+'</span>' +
      '</div>';
    }).join('');
  }

  function rtRenderLeaderboard(){
    var list = buildLeaderboard();
    renderLeaderboardInto($('rtLeaderboard'), list, 10);
    renderLeaderboardInto($('rtLeaderboardPlaying'), list, 10);
  }
  window.rtRenderLeaderboard = rtRenderLeaderboard;

  // ===== PESERTA =====
  function rtRenderParticipants(){
    var el = $('rtParticipants');
    if (!el) return;
    var players = Object.keys(RT.players || {}).map(function(k){ return RT.players[k]; });
    if (!players.length) {
      el.innerHTML = '<div class="empty-state" style="padding:.5rem;"><p style="font-size:.8125rem;">Belum ada peserta.</p></div>';
      return;
    }
    players.sort(function(a,b){ return (b.totalScore||0) - (a.totalScore||0); });
    el.innerHTML =
      '<div style="font-size:.75rem;color:#64748b;margin-bottom:.375rem;font-weight:600;">' +
        '<span class="material-icons" style="font-size:14px;vertical-align:-2px;">groups</span> '+players.length+' peserta' +
      '</div>' +
      '<div style="max-height:240px;overflow-y:auto;">' +
      players.map(function(p,i){
        var isMe = p.id === RT.playerId || p.studentId === (PS.user && PS.user.id);
        return '<div class="rt-player-chip" style="'+(isMe?'background:#fffbeb;border-color:#fde68a;':'')+'">' +
          '<span style="color:#94a3b8;width:1.125rem;text-align:right;font-size:.75rem;">'+(i+1)+'.</span>' +
          '<span class="material-icons">person</span>' +
          '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(p.name||p.studentId||p.id)+'</span>' +
          (isMe ? '<span style="font-size:.6875rem;font-weight:700;color:#b45309;">Anda</span>' : '') +
        '</div>';
      }).join('') +
      '</div>';
  }
  window.rtRenderParticipants = rtRenderParticipants;

  // ===== FINISHED =====
  function rtRenderFinished(){
    var list = buildLeaderboard();
    var myRank='-', myScore=0, myCorrect=0;
    list.forEach(function(p,i){
      if (p.id === RT.playerId || p.studentId === (PS.user && PS.user.id)) {
        myRank = '#'+(i+1); myScore = p.score; myCorrect = p.correct;
      }
    });
    var r = $('rtFinalRank'); if (r) r.textContent = myRank;
    var s = $('rtFinalScore'); if (s) s.textContent = myScore;
    var c = $('rtFinalCorrect'); if (c) c.textContent = myCorrect;
    renderLeaderboardInto($('rtFinalLeaderboard'), list, 5);
    if (PS.user && RT.roomCode) {
      try { localStorage.removeItem('rt_join_' + String(RT.roomCode).trim().toUpperCase() + '_' + String(PS.user.id).replace(/[^a-zA-Z0-9_-]/g,'_')); } catch(e){}
    }
    if (typeof window.rtUnsubscribeAll === 'function') window.rtUnsubscribeAll();
  }
  window.rtRenderFinished = rtRenderFinished;

  console.log('✅ s-rt-render.js v1.1 loaded (helper prefix rt*)');
})();