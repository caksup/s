/* Student assessment lifecycle: dashboard cards, timed attempt, grading, and review. */
(function(){
  'use strict';

  var AS = {
    session:null, questions:[], answers:{}, attemptId:null, attempt:null,
    currentIndex:0, startedAtMs:0, timer:null, pendingSave:Promise.resolve(),
    submitting:false
  };

  var TYPE_ALIASES={PGS:'JEC_PGS',MCMA:'JEC_MCMA',PGK:'JEC_PGK',ISIAN:'JEC_SA'};
  function typeOf(question){
    var type=String(question&&question.type||'').toUpperCase();
    return TYPE_ALIASES[type]||type;
  }
  function $(id){ return document.getElementById(id); }
  function esc(value){
    return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function dateValue(value){
    if (!value) return null;
    try {
      var date=value.toDate ? value.toDate() : new Date(value);
      return isNaN(date.getTime()) ? null : date;
    } catch(e){ return null; }
  }
  function dateText(value){
    var date=dateValue(value);
    return date ? date.toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}) : 'Tidak ditentukan';
  }
  function assigned(session){
    var ids=session.assignedStudents;
    return !ids || !ids.length || ids.some(function(id){return String(id).trim()===String(PS.user&&PS.user.id||'').trim();});
  }
  function attemptsFor(sessionId){
    return (PS.myAttempts||[]).filter(function(attempt){ return attempt.sessionId===sessionId; });
  }
  function completedFor(sessionId){
    return attemptsFor(sessionId).filter(function(attempt){ return attempt.status==='completed'; });
  }
  function inProgressFor(sessionId){
    return attemptsFor(sessionId).filter(function(attempt){ return attempt.status==='in_progress'; });
  }
  function latest(attempts){
    return attempts.slice().sort(function(a,b){
      var ad=dateValue(a.finishedAt||a.startedAt), bd=dateValue(b.finishedAt||b.startedAt);
      return (bd?bd.getTime():0)-(ad?ad.getTime():0);
    })[0] || null;
  }
  function escapeId(value){ return String(value).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

  window.renderAssessmentDashboard=function(){
    var target=$('assessmentList');
    if (!target) return;
    var sessions=(PS.sessions||[]).filter(function(session){
      if (session.mode!=='assessment' || session.deleted===true || !assigned(session)) return false;
      var complete=completedFor(session.id).length>0;
      var inProgress=inProgressFor(session.id).length>0;
      var end=dateValue(session.endTime);
      return complete || inProgress || !end || end.getTime()>=Date.now();
    });
    if (!sessions.length) {
      target.innerHTML='<div class="empty-state" style="padding:1rem;"><span class="material-icons">assignment_turned_in</span>' +
        '<p>Tidak ada asesmen aktif untuk Anda saat ini.</p></div>';
      return;
    }
    target.innerHTML=sessions.map(function(session){
      var safeId=escapeId(session.id);
      var completed=latest(completedFor(session.id));
      var inProgress=latest(inProgressFor(session.id));
      var start=dateValue(session.startTime);
      var end=dateValue(session.endTime);
      var notStarted=start && start.getTime()>Date.now();
      var expired=end && end.getTime()<Date.now();
      var action=completed
        ? '<button type="button" class="btn btn-secondary btn-sm" onclick="openAssessmentResult(\''+safeId+'\',\''+escapeId(completed.id)+'\')"><span class="material-icons">fact_check</span>Lihat Hasil</button>'
        : inProgress
          ? '<button type="button" class="btn btn-primary btn-sm" onclick="resumeAssessment(\''+safeId+'\')"><span class="material-icons">play_arrow</span>Lanjutkan</button>'
          : '<button type="button" class="btn btn-primary btn-sm" '+(notStarted||expired?'disabled':'')+' onclick="openAssessmentDetails(\''+safeId+'\')"><span class="material-icons">assignment_turned_in</span>Kerjakan</button>';
      var status=completed
        ? '<span class="badge badge-success">Selesai • Nilai '+(completed.score==null?'-':completed.score)+'</span>'
        : inProgress
          ? '<span class="badge badge-warning">Sedang dikerjakan</span>'
          : notStarted
            ? '<span class="badge badge-info">Mulai '+esc(dateText(session.startTime))+'</span>'
            : expired
              ? '<span class="badge badge-error">Waktu asesmen berakhir</span>'
              : '<span class="badge badge-info">Aktif</span>';
      return '<div style="background:#fff;border:1px solid #bfdbfe;border-left:4px solid #2563eb;border-radius:10px;padding:.875rem 1rem;margin-bottom:.75rem;">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;flex-wrap:wrap;">' +
        '<div style="min-width:0;flex:1;"><div style="display:flex;align-items:center;gap:.375rem;flex-wrap:wrap;font-weight:700;color:#1e3a8a;">' +
        '<span class="material-icons">assignment_turned_in</span>'+esc(session.name||'Asesmen')+status+'</div>' +
        '<div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-top:.5rem;font-size:.75rem;color:#475569;">' +
        '<span><span class="material-icons" style="font-size:14px;vertical-align:middle;">quiz</span> '+(session.questionsCount==null?'Soal tersedia':session.questionsCount+' soal')+'</span>' +
        '<span><span class="material-icons" style="font-size:14px;vertical-align:middle;">timer</span> '+(session.duration||60)+' menit</span>' +
        (session.endTime?'<span><span class="material-icons" style="font-size:14px;vertical-align:middle;">schedule</span> Batas: '+esc(dateText(session.endTime))+'</span>':'')+
        '</div>'+(session.description?'<div style="font-size:.8125rem;color:#64748b;margin-top:.5rem;">'+esc(session.description)+'</div>':'')+
        '</div><div>'+action+'</div></div></div>';
    }).join('');
  };
  window.setAssessmentObjectAnswer=function(questionId,key,value){
    if(AS.submitting)return;
    var current=AS.answers[questionId]&&typeof AS.answers[questionId]==='object'?Object.assign({},AS.answers[questionId]):{};
    current[String(key)]=value;
    AS.answers[questionId]=current;
    queueProgress();
  };
  window.setAssessmentTextAnswer=function(questionId,value){
    if(AS.submitting)return;
    AS.answers[questionId]=value;
    queueProgress();
  };

  function loadQuestions(sessionId){
    return db.collection('questions').where('sessionId','==',sessionId).get().then(function(snapshot){
      var questions=[];
      snapshot.forEach(function(doc){
        var question=Object.assign({id:doc.id},doc.data());
        if (question.deleted !== true) questions.push(question);
      });
      questions.sort(function(a,b){ return (Number(a.order)||0)-(Number(b.order)||0); });
      return questions;
    });
  }

  async function refreshAttempts(){
    var snapshot=await db.collection('attempts').where('studentId','==',PS.user.id).get();
    PS.myAttempts=[];
    snapshot.forEach(function(doc){ PS.myAttempts.push(Object.assign({id:doc.id},doc.data())); });
  }

  function showAssessmentContent(html){
    var target=$('assessmentContent');
    if (target) target.innerHTML=html;
    if (window.showScreen) window.showScreen('assessment');
    else {
      $('studentApp').style.display='none';
      $('assessmentPage').style.display='block';
    }
    $('assessmentPage').scrollTop=0;
  }

  function backToDashboard(){
    stopTimer();
    if (window.showScreen) window.showScreen('app');
    if (window.PS && typeof PS.setTab==='function') PS.setTab('home');
  }
  window.backFromAssessment=backToDashboard;

  async function getSession(sessionId, allowClosed){
    var doc=await db.collection('sessions').doc(sessionId).get();
    if (!doc.exists) throw new Error('Sesi Asesmen tidak ditemukan.');
    var session=Object.assign({id:sessionId},doc.data());
    if (session.mode!=='assessment' || session.deleted===true) throw new Error('Sesi ini bukan Asesmen yang aktif.');
    if (!allowClosed && (session.status===false || session.visible===false)) throw new Error('Sesi Asesmen sedang tidak tersedia.');
    if (!assigned(session)) throw new Error('Sesi ini tidak ditugaskan kepada akun Anda.');
    return session;
  }

  window.openAssessmentDetails=async function(sessionId){
    try {
      AS.session=await getSession(sessionId);
      var questions=await loadQuestions(sessionId);
      if (!questions.length) throw new Error('Sesi ini belum memiliki soal.');
      var completed=latest(completedFor(sessionId));
      if (completed) return window.openAssessmentResult(sessionId,completed.id);
      var inProgress=latest(inProgressFor(sessionId));
      var start=dateValue(AS.session.startTime), end=dateValue(AS.session.endTime);
      var blocked=start && start.getTime()>Date.now();
      var expired=end && end.getTime()<Date.now();
      var groups={};
      questions.forEach(function(question){var type=typeOf(question);groups[type]=(groups[type]||0)+1;});
      var formatSummary=Object.keys(groups).map(function(type){return type.replace('JEC_','')+' '+groups[type];}).join(' • ');
      AS.questions=questions;
      showAssessmentContent(
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;margin-bottom:1rem;">' +
          '<button class="btn btn-secondary btn-sm" onclick="backFromAssessment()"><span class="material-icons">arrow_back</span>Kembali</button>' +
          '<span class="badge badge-info">Asesmen</span></div>' +
        '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:1.25rem;">' +
          '<h1 style="font-size:1.35rem;margin:0 0 .5rem;color:#1e3a8a;">'+esc(AS.session.name)+'</h1>' +
          (AS.session.description?'<p style="color:#475569;">'+esc(AS.session.description)+'</p>':'')+
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.625rem;margin:1rem 0;">' +
            '<div class="card" style="padding:.75rem;"><b>'+questions.length+'</b><br><small>Jumlah soal</small></div>' +
            '<div class="card" style="padding:.75rem;"><b>'+(AS.session.duration||60)+' menit</b><br><small>Durasi pengerjaan</small></div>' +
            '<div class="card" style="padding:.75rem;"><b>'+esc(formatSummary||'Tidak diketahui')+'</b><br><small>Format soal</small></div>' +
            '<div class="card" style="padding:.75rem;"><b>'+esc(dateText(AS.session.startTime))+'</b><br><small>Mulai</small></div>' +
          '</div>' +
          (AS.session.endTime?'<p style="font-size:.8125rem;color:#64748b;">Batas pengerjaan: '+esc(dateText(AS.session.endTime))+'</p>':'')+
          '<div style="background:#eff6ff;border-left:3px solid #2563eb;padding:.75rem;border-radius:6px;font-size:.8125rem;color:#1e3a8a;margin:1rem 0;">Jawaban akan dikoreksi otomatis setelah dikumpulkan. Setelah selesai, nilai, kunci jawaban, dan pembahasan tersedia untuk ditinjau.</div>' +
          (blocked?'<div class="badge badge-warning">Asesmen belum dimulai.</div>':'')+
          (expired?'<div class="badge badge-error">Batas waktu asesmen sudah berakhir.</div>':'')+
          '<button class="btn btn-primary w-full" style="margin-top:1rem;" '+(blocked||expired?'disabled':'')+' onclick="'+(inProgress?'resumeAssessment(\''+escapeId(sessionId)+'\')':'beginAssessment()')+'">' +
            '<span class="material-icons">'+(inProgress?'play_arrow':'assignment_turned_in')+'</span>'+(inProgress?'Lanjutkan Pengerjaan':'Mulai Asesmen')+
          '</button></div>'
      );
    } catch(error) {
      console.error('[asesmen] Gagal membuka detail:',error);
      if (window.alert2) alert2('Asesmen tidak tersedia',esc(error.message||'Kesalahan tidak diketahui'),'warning');
    }
  };

  function snapshotQuestions(questions){
    return questions.map(function(question){
      return JSON.parse(JSON.stringify(question));
    });
  }

  window.beginAssessment=async function(){
    try {
      if (!AS.session) throw new Error('Sesi Asesmen belum dipilih.');
      var session=await getSession(AS.session.id);
      var start=dateValue(session.startTime), end=dateValue(session.endTime);
      if (start && start.getTime()>Date.now()) throw new Error('Asesmen belum dimulai.');
      if (end && end.getTime()<Date.now()) throw new Error('Batas waktu asesmen sudah berakhir.');
      await refreshAttempts();
      if (completedFor(session.id).length) return window.openAssessmentResult(session.id,latest(completedFor(session.id)).id);
      if (inProgressFor(session.id).length) return window.resumeAssessment(session.id);
      AS.session=session;
      AS.questions=await loadQuestions(session.id);
      if (!AS.questions.length) throw new Error('Sesi ini belum memiliki soal.');
      AS.answers={}; AS.currentIndex=0; AS.startedAtMs=Date.now(); AS.submitting=false;
      var ref=await db.collection('attempts').add({
        studentId:PS.user.id,sessionId:session.id,status:'in_progress',mode:'assessment',attemptNumber:1,
        answers:{},progress:0,totalQuestions:AS.questions.length,questionsSnapshot:snapshotQuestions(AS.questions),
        startedAt:firebase.firestore.FieldValue.serverTimestamp(),startedAtMs:AS.startedAtMs
      });
      AS.attemptId=ref.id;
      AS.attempt={id:ref.id,studentId:PS.user.id,sessionId:session.id,status:'in_progress',mode:'assessment',
        answers:{},progress:0,totalQuestions:AS.questions.length,startedAtMs:AS.startedAtMs};
      PS.myAttempts.push(AS.attempt);
      renderQuestion();
      startTimer();
    } catch(error) {
      console.error('[asesmen] Gagal memulai:',error);
      if (window.alert2) alert2('Gagal memulai Asesmen',esc(error.message||'Kesalahan tidak diketahui'),'error');
    }
  };

  window.resumeAssessment=async function(sessionId){
    try {
      AS.session=await getSession(sessionId);
      await refreshAttempts();
      var attempt=latest(inProgressFor(sessionId));
      if (!attempt) return window.openAssessmentDetails(sessionId);
      AS.questions=attempt.questionsSnapshot && attempt.questionsSnapshot.length
        ? attempt.questionsSnapshot
        : await loadQuestions(sessionId);
      if (!AS.questions.length) throw new Error('Snapshot soal Asesmen tidak ditemukan.');
      AS.attempt=attempt;
      AS.attemptId=attempt.id;
      AS.answers=attempt.answers||{};
      AS.currentIndex=Math.max(0,Math.min(Number(attempt.progress)||0,AS.questions.length-1));
      var started=Number(attempt.startedAtMs)||((dateValue(attempt.startedAt)||new Date()).getTime());
      AS.startedAtMs=started;
      AS.submitting=false;
      renderQuestion();
      startTimer();
    } catch(error) {
      console.error('[asesmen] Gagal melanjutkan:',error);
      if (window.alert2) alert2('Gagal melanjutkan Asesmen',esc(error.message||'Kesalahan tidak diketahui'),'error');
    }
  };

  function durationSeconds(){
    return Math.max(1,Number(AS.session && AS.session.duration)||60)*60;
  }
  function remainingSeconds(){
    return Math.max(0,durationSeconds()-Math.floor((Date.now()-AS.startedAtMs)/1000));
  }
  function timerText(seconds){
    var h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),s=seconds%60;
    return (h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  }
  function stopTimer(){
    if (AS.timer) clearInterval(AS.timer);
    AS.timer=null;
  }
  function startTimer(){
    stopTimer();
    AS.timer=setInterval(function(){
      var label=$('assessmentTimer');
      var remaining=remainingSeconds();
      if (label) label.textContent=timerText(remaining);
      if (!remaining) window.submitAssessment(true);
    },1000);
  }

  function isCorrect(question,answer){
    var type=typeOf(question);
    if (type==='JEC_PGS'||type==='JEC_EI') return String(answer||'')===String(question.correctAnswer||'');
    if (type==='JEC_MCMA') {
      if (!Array.isArray(answer)||!Array.isArray(question.correctAnswer)) return false;
      var actual=answer.slice().sort(),expected=question.correctAnswer.slice().sort();
      return actual.length===expected.length&&actual.every(function(value,index){return value===expected[index];});
    }
    if (type==='JEC_PGK') return window.isQuestionBooleanAnswerCorrect
      ? window.isQuestionBooleanAnswerCorrect(Object.assign({},question,{type:'PGK'}),answer)
      : Array.isArray(answer)&&Array.isArray(question.correctAnswer)&&answer.length===question.correctAnswer.length&&
        answer.every(function(value,index){return value===question.correctAnswer[index];});
    if(type==='JEC_TF'){
      var expectedTF=question.correctAnswer;
      if(typeof expectedTF!=='boolean'&&window.parseBooleanAnswerList){
        var parsedTF=window.parseBooleanAnswerList(expectedTF);
        expectedTF=parsedTF&&parsedTF.length===1?parsedTF[0]:undefined;
      }
      return typeof answer==='boolean'&&answer===expectedTF;
    }
    if(type==='JEC_SA'||type==='JEC_ST'){
      function normalize(value){return String(value==null?'':value).trim().replace(/\s+/g,' ').toLocaleLowerCase();}
      var expectedAnswers=Array.isArray(question.correctAnswer)?question.correctAnswer:[question.correctAnswer];
      var actualText=normalize(answer);
      return !!actualText&&expectedAnswers.some(function(item){return normalize(item)===actualText;});
    }
    if(type==='JEC_CT'){
      var gaps=question.gaps||[];
      return gaps.length>0&&gaps.every(function(gap){return String((answer||{})[gap.id]||'')===String(gap.correctAnswer);});
    }
    if(type==='JEC_MT'){
      var left=question.leftItems||[], pairs=question.correctAnswer||{};
      return left.length>0&&left.every(function(_,index){return String((answer||{})[String(index)]||'')===String(pairs[String(index)]);});
    }
    if(type==='JEC_IT'){
      return isCorrect(Object.assign({},question,{type:question.interactionType||'JEC_PGS'}),answer);
    }
    if(type==='JEC_DC') return String(answer==null?'':answer)===String(question.correctAnswer);
    return false;
  }

  function queueProgress(){
    var answers=JSON.parse(JSON.stringify(AS.answers));
    var progress=AS.currentIndex;
    var operation=AS.pendingSave.catch(function(){}).then(function(){
      return db.collection('attempts').doc(AS.attemptId).update({answers:answers,progress:progress});
    });
    AS.pendingSave=operation;
    operation.catch(function(error){
      console.error('[asesmen] Gagal menyimpan progres:',error);
      if (window.alert2) alert2('Progres belum tersimpan',esc(error.message||'Periksa koneksi lalu coba lagi.'),'error');
    });
    return operation;
  }

  function setAnswer(questionId,value,multiple){
    if (AS.submitting) return;
    if (multiple) {
      var answers=Array.isArray(AS.answers[questionId])?AS.answers[questionId].slice():[];
      var index=answers.indexOf(value);
      if (index<0) answers.push(value); else answers.splice(index,1);
      AS.answers[questionId]=answers;
    } else AS.answers[questionId]=value;
    renderQuestion();
    queueProgress();
  }
  window.setAssessmentAnswer=function(questionId,value){setAnswer(questionId,value,false);};
  window.toggleAssessmentOption=function(questionId,value){setAnswer(questionId,value,true);};
  window.setAssessmentStatement=function(questionId,index,value){
    if (AS.submitting) return;
    var answers=Array.isArray(AS.answers[questionId])?AS.answers[questionId].slice():[];
    answers[index]=value;
    AS.answers[questionId]=answers;
    renderQuestion();
    queueProgress();
  };
  window.goAssessmentQuestion=function(index){
    if (index<0||index>=AS.questions.length) return;
    AS.currentIndex=index;
    renderQuestion();
    queueProgress();
  };

  function renderQuestion(){
    var question=AS.questions[AS.currentIndex];
    if (!question) return;
    var safeId=escapeId(question.id);
    var answer=AS.answers[question.id];
    var type=typeOf(question);
    var html='<div style="position:sticky;top:0;background:#f8fafc;padding:.25rem 0 .75rem;z-index:2;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;">' +
      '<button class="btn btn-secondary btn-sm" onclick="backFromAssessment()"><span class="material-icons">arrow_back</span>Keluar</button>' +
      '<b>Soal '+(AS.currentIndex+1)+'/'+AS.questions.length+'</b><span id="assessmentTimer" class="badge badge-warning">'+timerText(remainingSeconds())+'</span></div>' +
      '<div style="height:6px;background:#e2e8f0;border-radius:8px;margin-top:.5rem;"><div style="width:'+Math.round((AS.currentIndex+1)/AS.questions.length*100)+'%;height:100%;background:#2563eb;border-radius:8px;"></div></div></div>' +
      '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:1rem;margin:.5rem 0 1rem;">' +
      '<div style="font-size:1rem;line-height:1.6;">'+(type==='JEC_CT'?renderClozeText(question,answer,safeId):esc(question.text||''))+'</div>' +
      (window.questionImageHtml?window.questionImageHtml(question):'')+
      (type==='JEC_IT'?renderAssessmentMedia(question.mediaUrl):'');
    if (type==='JEC_PGS'||type==='JEC_MCMA'||type==='JEC_EI') {
      html+=renderAssessmentChoices(question,answer,safeId,type);
    } else if (type==='JEC_PGK') {
      html+='<div style="display:grid;gap:.625rem;margin-top:1rem;">';
      (question.statements||[]).forEach(function(statement,index){
        var value=Array.isArray(answer)?answer[index]:undefined;
        html+='<div style="border:1px solid #e2e8f0;border-radius:8px;padding:.75rem;">' +
          '<div style="font-size:.875rem;margin-bottom:.5rem;"><b>'+(index+1)+'.</b> '+esc(statement)+'</div>' +
          '<div style="display:flex;gap:.5rem;">' +
          '<button type="button" class="btn '+(value===true?'btn-primary':'btn-secondary')+' btn-sm" onclick="setAssessmentStatement(\''+safeId+'\','+index+',true)">Benar / Ya</button>' +
          '<button type="button" class="btn '+(value===false?'btn-primary':'btn-secondary')+' btn-sm" onclick="setAssessmentStatement(\''+safeId+'\','+index+',false)">Salah / Tidak</button>' +
          '</div></div>';
      });
      html+='</div>';
    } else if(type==='JEC_TF'){
      html+='<div style="display:flex;gap:.5rem;margin-top:1rem;">'+
        '<button type="button" class="btn '+(answer===true?'btn-primary':'btn-secondary')+'" onclick="setAssessmentAnswer(\''+safeId+'\',true)">Benar</button>'+
        '<button type="button" class="btn '+(answer===false?'btn-primary':'btn-secondary')+'" onclick="setAssessmentAnswer(\''+safeId+'\',false)">Salah</button></div>';
    } else if(type==='JEC_SA'){
      html+='<label style="display:block;margin-top:1rem;font-weight:600;">Jawaban singkat</label><input class="form-control" type="text" value="'+esc(answer||'')+'" oninput="setAssessmentTextAnswer(\''+safeId+'\',this.value)" autocomplete="off">';
    } else if(type==='JEC_CT'){
      html+='<div style="font-size:.75rem;color:#64748b;margin-top:.5rem;">Pilih jawaban pada setiap rumpang di teks.</div>';
    } else if(type==='JEC_MT'){
      html+='<div style="display:grid;gap:.625rem;margin-top:1rem;">';
      (question.leftItems||[]).forEach(function(item,index){
        var picked=answer&&answer[String(index)]!==undefined?String(answer[String(index)]):'';
        html+='<label style="display:grid;grid-template-columns:minmax(0,1fr) minmax(130px,1fr);gap:.5rem;align-items:center;border:1px solid #e2e8f0;border-radius:8px;padding:.625rem;">'+
          '<span>'+esc(item)+'</span><select class="form-control" onchange="setAssessmentObjectAnswer(\''+safeId+'\',\''+index+'\',this.value)"><option value="">Pilih pasangan</option>'+
          (question.rightItems||[]).map(function(option,rightIndex){return '<option value="'+rightIndex+'" '+(picked===String(rightIndex)?'selected':'')+'>'+esc(option)+'</option>';}).join('')+
          '</select></label>';
      });
      html+='</div>';
    } else if(type==='JEC_ST'){
      html+='<label style="display:block;margin-top:1rem;font-weight:600;">Tulis ulang kalimat</label><textarea class="form-control" rows="4" oninput="setAssessmentTextAnswer(\''+safeId+'\',this.value)">'+esc(answer||'')+'</textarea>';
    } else if(type==='JEC_IT'){
      var interactionType=typeOf({type:question.interactionType||'JEC_PGS'});
      if(interactionType==='JEC_SA'){
        html+='<label style="display:block;margin-top:1rem;font-weight:600;">Jawaban</label><input class="form-control" type="text" value="'+esc(answer||'')+'" oninput="setAssessmentTextAnswer(\''+safeId+'\',this.value)" autocomplete="off">';
      } else html+=renderAssessmentChoices(question,answer,safeId,interactionType);
    } else if(type==='JEC_DC'){
      html+='<div style="display:grid;gap:.5rem;margin-top:1rem;">';
      (question.dialogue||[]).forEach(function(line,index){
        var isBlank=!!line.blank||String(line.text||'').indexOf('[blank]')!==-1;
        var bubble=isBlank
          ? '<select class="form-control" style="margin-top:.25rem;" onchange="setAssessmentTextAnswer(\''+safeId+'\',this.value)"><option value="">Pilih respons</option>'+
            question.options.map(function(option,optionIndex){var text=typeof option==='string'?option:option.text;return '<option value="'+optionIndex+'" '+(String(answer)===String(optionIndex)?'selected':'')+'>'+esc(text)+'</option>';}).join('')+'</select>'
          : esc(String(line.text||'').replace(/\[blank\]/g,''));
        html+='<div style="max-width:85%;padding:.625rem .75rem;border-radius:12px;background:'+(index%2?'#eff6ff':'#f1f5f9')+';'+(index%2?'margin-left:auto;':'')+'"><small style="display:block;color:#64748b;font-weight:700;">'+esc(line.speaker||'')+'</small>'+bubble+'</div>';
      });
      html+='</div>';
    }
    html+='</div><div style="display:flex;gap:.5rem;justify-content:space-between;flex-wrap:wrap;">' +
      '<button class="btn btn-secondary" '+(AS.currentIndex===0?'disabled':'')+' onclick="goAssessmentQuestion('+(AS.currentIndex-1)+')"><span class="material-icons">arrow_back</span>Sebelumnya</button>' +
      '<div style="display:flex;gap:.5rem;">'+
      (AS.currentIndex<AS.questions.length-1
        ? '<button class="btn btn-primary" onclick="goAssessmentQuestion('+(AS.currentIndex+1)+')">Berikutnya<span class="material-icons">arrow_forward</span></button>'
        : '<button class="btn btn-success" onclick="submitAssessment(false)"><span class="material-icons">send</span>Kumpulkan Asesmen</button>')+
      '</div></div><div style="display:flex;flex-wrap:wrap;gap:.25rem;margin-top:1rem;">';
    AS.questions.forEach(function(item,index){
      var answered=AS.answers[item.id]!==undefined;
      html+='<button type="button" class="btn '+(index===AS.currentIndex?'btn-primary':answered?'btn-success':'btn-secondary')+' btn-sm" onclick="goAssessmentQuestion('+index+')">'+(index+1)+'</button>';
    });
    html+='</div>';
    showAssessmentContent(html);
    startTimer();
  }

  function renderAssessmentChoices(question,answer,safeId,type){
    var choices=question.options||{};
    var keys=Array.isArray(choices)?choices.map(function(_,i){return String(i);}):['A','B','C','D','E'];
    var multiple=type==='JEC_MCMA';
    var html='<div style="display:grid;gap:.5rem;margin-top:1rem;">';
    keys.forEach(function(key,index){
      var text=Array.isArray(choices)?choices[index]:choices[key];
      if(!text)return;
      var selected=multiple?Array.isArray(answer)&&answer.indexOf(key)!==-1:String(answer)===String(key);
      html+='<button type="button" class="option-item'+(selected?' selected':'')+'" style="text-align:left;width:100%;" onclick="'+
        (multiple?'toggleAssessmentOption(\''+safeId+'\',\''+key+'\')':'setAssessmentAnswer(\''+safeId+'\',\''+key+'\')')+'">'+
        '<b style="margin-right:.5rem;">'+esc(Array.isArray(choices)?String.fromCharCode(65+index):key)+'.</b>'+esc(typeof text==='string'?text:text.text||'')+'</button>';
    });
    return html+'</div>';
  }

  function renderClozeText(question,answer,safeId){
    var text=esc(question.text||'');
    (question.gaps||[]).forEach(function(gap){
      var key=String(gap.id);
      var value=answer&&answer[key]!==undefined?String(answer[key]):'';
      var select='<select class="form-control" style="display:inline-block;width:auto;min-width:110px;vertical-align:middle;" onchange="setAssessmentObjectAnswer(\''+safeId+'\',\''+escapeId(key)+'\',this.value)"><option value="">...</option>'+
        (gap.options||[]).map(function(option){return '<option value="'+esc(option)+'" '+(value===String(option)?'selected':'')+'>'+esc(option)+'</option>';}).join('')+'</select>';
      text=text.replace(new RegExp('\\['+key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\]','g'),select);
    });
    return text;
  }

  function renderAssessmentMedia(url){
    var normalized=window.normalizeQuestionImageUrl?window.normalizeQuestionImageUrl(url):'';
    if(!normalized)return '';
    if(/\.(mp3|wav|ogg|m4a)(?:$|\?)/i.test(normalized)) return '<audio controls src="'+esc(normalized)+'" style="display:block;max-width:100%;margin-top:.75rem;"></audio>';
    if(/\.(mp4|webm|mov)(?:$|\?)/i.test(normalized)) return '<video controls src="'+esc(normalized)+'" style="display:block;max-width:100%;max-height:300px;margin-top:.75rem;"></video>';
    return '<img src="'+esc(normalized)+'" alt="Media soal interaktif" style="display:block;max-width:100%;max-height:300px;object-fit:contain;margin-top:.75rem;border-radius:8px;">';
  }

  function answerComplete(question,answer){
    var type=typeOf(question);
    if(type==='JEC_IT') return answerComplete(Object.assign({},question,{type:question.interactionType||'JEC_PGS'}),answer);
    if (type==='JEC_PGS'||type==='JEC_EI'||type==='JEC_DC') return answer!==undefined&&answer!==null&&String(answer)!=='';
    if (type==='JEC_MCMA') return Array.isArray(answer)&&answer.length>0;
    if(type==='JEC_SA'||type==='JEC_ST') return typeof answer==='string'&&!!answer.trim();
    if(type==='JEC_TF') return typeof answer==='boolean';
    if (type==='JEC_PGK') return !!(answer&&question.statements&&answer.length===question.statements.length&&
      answer.every(function(value){return value===true||value===false;}));
    if(type==='JEC_CT') return (question.gaps||[]).length>0&&(question.gaps||[]).every(function(gap){return !!(answer||{})[gap.id];});
    if(type==='JEC_MT') return (question.leftItems||[]).length>0&&(question.leftItems||[]).every(function(_,index){return (answer||{})[String(index)]!==undefined&&String((answer||{})[String(index)])!=='';});
    return false;
  }

  window.submitAssessment=async function(autoSubmit){
    if (!AS.attemptId||AS.submitting) return;
    var unanswered=AS.questions.filter(function(question){return !answerComplete(question,AS.answers[question.id]);}).length;
    if (!autoSubmit&&unanswered&&!confirm('Masih ada '+unanswered+' soal belum dijawab. Tetap kumpulkan asesmen?')) return;
    AS.submitting=true;
    try {
      stopTimer();
      await AS.pendingSave;
      var correct=0;
      AS.questions.forEach(function(question){if(isCorrect(question,AS.answers[question.id]))correct++;});
      var score=Math.round(correct/AS.questions.length*100);
      var elapsed=Math.max(0,Math.round((Date.now()-AS.startedAtMs)/1000));
      var updates={
        status:'completed',mode:'assessment',answers:AS.answers,score:score,correctAnswers:correct,
        totalQuestions:AS.questions.length,totalTime:elapsed,autoSubmitted:!!autoSubmit,
        finishedAt:firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('attempts').doc(AS.attemptId).update(updates);
      AS.attempt=Object.assign({},AS.attempt,updates);
      var item=PS.myAttempts.find(function(attempt){return attempt.id===AS.attemptId;});
      if(item) Object.assign(item,AS.attempt);
      renderResult(AS.questions,AS.attempt,AS.session);
    } catch(error) {
      AS.submitting=false;
      console.error('[asesmen] Gagal mengumpulkan:',error);
      if (window.alert2) alert2('Asesmen belum terkumpul',esc(error.message||'Periksa koneksi dan coba lagi.'),'error');
    }
  };

  function renderResult(questions,attempt,session){
    stopTimer();
    var correct=Number(attempt.correctAnswers)||0;
    var score=Number(attempt.score)||0;
    var content='<div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;margin-bottom:1rem;">' +
      '<button class="btn btn-secondary btn-sm" onclick="backFromAssessment()"><span class="material-icons">home</span>Dashboard</button>' +
      '<span class="badge badge-success">Hasil Asesmen</span></div>' +
      '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:1.25rem;margin-bottom:1rem;text-align:center;">' +
      '<h1 style="font-size:1.25rem;color:#1e3a8a;">'+esc(session.name||'Asesmen')+'</h1>' +
      '<div style="font-size:2.5rem;font-weight:800;color:#2563eb;margin:.5rem 0;">'+score+'</div>' +
      '<div style="display:flex;justify-content:center;gap:1.5rem;flex-wrap:wrap;color:#475569;">' +
      '<span>Benar <b style="color:#059669;">'+correct+'</b></span><span>Salah <b style="color:#dc2626;">'+(questions.length-correct)+'</b></span>' +
      '<span>Total <b>'+questions.length+'</b></span><span>Waktu <b>'+Math.floor((attempt.totalTime||0)/60)+'m '+((attempt.totalTime||0)%60)+'d</b></span></div></div>' +
      '<h2 style="font-size:1.1rem;margin:1rem 0;">Koreksi, jawaban, dan pembahasan</h2>';
    questions.forEach(function(question,index){
      var answer=(attempt.answers||{})[question.id];
      var ok=isCorrect(question,answer);
      content+='<div style="background:#fff;border:1px solid '+(ok?'#86efac':'#fecaca')+';border-left:4px solid '+(ok?'#10b981':'#ef4444')+';border-radius:10px;padding:1rem;margin-bottom:.75rem;">' +
        '<div style="font-size:.75rem;font-weight:700;color:'+(ok?'#047857':'#b91c1c')+';margin-bottom:.5rem;">Soal '+(index+1)+' • '+(ok?'BENAR':'SALAH')+'</div>' +
        '<div style="line-height:1.6;">'+esc(question.text||'')+'</div>' +
        (window.questionImageHtml?window.questionImageHtml(question):'')+
        (type==='JEC_IT'?renderAssessmentMedia(question.mediaUrl):'');
      var type=typeOf(question);
      if (type==='JEC_PGS'||type==='JEC_MCMA'||type==='JEC_EI') {
        var selected=type==='JEC_PGS'||type==='JEC_EI'?(answer?[answer]:[]):(Array.isArray(answer)?answer:[]);
        var keys=type==='JEC_PGS'||type==='JEC_EI'?[question.correctAnswer]:(question.correctAnswer||[]);
        content+='<div style="display:grid;gap:.375rem;margin-top:.625rem;">';
        ['A','B','C','D','E'].forEach(function(key){
          if (!question.options||!question.options[key]) return;
          var isKey=keys.indexOf(key)!==-1,isSelected=selected.indexOf(key)!==-1;
          content+='<div style="padding:.5rem;border-radius:7px;background:'+(isKey?'#ecfdf5':isSelected?'#fef2f2':'#f8fafc')+';">'+
            '<b>'+key+'.</b> '+esc(question.options[key])+
            (isSelected?' <span class="badge badge-info">Jawaban Anda</span>':'')+
            (isKey?' <span class="badge badge-success">Kunci</span>':'')+'</div>';
        });
        content+='</div>';
      } else if (type==='JEC_PGK') {
        var keyAnswers=window.normalizeQuestionBooleanAnswers
          ? window.normalizeQuestionBooleanAnswers(question.correctAnswer)||[]
          : question.correctAnswer||[];
        content+='<div style="display:grid;gap:.375rem;margin-top:.625rem;">';
        (question.statements||[]).forEach(function(statement,index){
          var studentAnswer=Array.isArray(answer)?answer[index]:undefined;
          var keyAnswer=keyAnswers[index];
          content+='<div style="padding:.625rem;border-radius:7px;background:'+(studentAnswer===keyAnswer&&studentAnswer!==undefined?'#ecfdf5':'#fef2f2')+';">' +
            '<b>'+(index+1)+'.</b> '+esc(statement)+'<br><small>Jawaban Anda: <b>'+(studentAnswer===true?'Benar/Ya':studentAnswer===false?'Salah/Tidak':'Tidak dijawab')+
            '</b> • Kunci: <b>'+(keyAnswer===true?'Benar/Ya':'Salah/Tidak')+'</b></small></div>';
        });
        content+='</div>';
      } else if(type==='JEC_TF'){
        content+='<div style="margin-top:.625rem;padding:.625rem;border-radius:7px;background:'+(answer===question.correctAnswer?'#ecfdf5':'#fef2f2')+';">Jawaban Anda: <b>'+(answer===true?'Benar':answer===false?'Salah':'Tidak dijawab')+'</b> • Kunci: <b>'+(question.correctAnswer===true?'Benar':'Salah')+'</b></div>';
      } else if(type==='JEC_CT'){
        content+='<div style="display:grid;gap:.375rem;margin-top:.625rem;">';
        (question.gaps||[]).forEach(function(gap){
          var actual=(answer||{})[gap.id];
          var ok=String(actual==null?'':actual)===String(gap.correctAnswer);
          content+='<div style="padding:.5rem;border-radius:7px;background:'+(ok?'#ecfdf5':'#fef2f2')+';"><b>'+esc(gap.id)+':</b> Jawaban Anda '+esc(actual==null?'Tidak dijawab':actual)+' • Kunci '+esc(gap.correctAnswer)+'</div>';
        });
        content+='</div>';
      } else if(type==='JEC_MT'){
        content+='<div style="display:grid;gap:.375rem;margin-top:.625rem;">';
        (question.leftItems||[]).forEach(function(item,pairIndex){
          var actual=(answer||{})[String(pairIndex)];
          var expected=(question.correctAnswer||{})[String(pairIndex)];
          var ok=actual!==undefined&&String(actual)===String(expected);
          content+='<div style="padding:.5rem;border-radius:7px;background:'+(ok?'#ecfdf5':'#fef2f2')+';"><b>'+esc(item)+'</b> → Jawaban Anda: '+esc(actual===undefined?'Tidak dijawab':(question.rightItems||[])[Number(actual)]||'')+' • Kunci: '+esc((question.rightItems||[])[Number(expected)]||'')+'</div>';
        });
        content+='</div>';
      } else if(type==='JEC_DC'){
        var selectedDialogue=(question.options||[])[Number(answer)];
        var expectedDialogue=(question.options||[])[Number(question.correctAnswer)];
        content+='<div style="margin-top:.625rem;padding:.625rem;border-radius:7px;background:'+(String(answer)===String(question.correctAnswer)?'#ecfdf5':'#fef2f2')+';">Jawaban Anda: <b>'+esc(typeof selectedDialogue==='string'?selectedDialogue:(selectedDialogue&&selectedDialogue.text)||'Tidak dijawab')+'</b> • Kunci: <b>'+esc(typeof expectedDialogue==='string'?expectedDialogue:(expectedDialogue&&expectedDialogue.text)||'')+'</b></div>';
      } else if(type==='JEC_IT'&&question.interactionType!=='JEC_SA') {
        var nestedType=typeOf({type:question.interactionType||'JEC_PGS'});
        var selectedIT=nestedType==='JEC_MCMA'?(Array.isArray(answer)?answer:[(answer||'')]):(answer?[answer]:[]);
        var keyIT=nestedType==='JEC_MCMA'?(question.correctAnswer||[]):[question.correctAnswer];
        content+='<div style="display:grid;gap:.375rem;margin-top:.625rem;">';
        ['A','B','C','D','E'].forEach(function(key){
          if(!question.options||!question.options[key])return;
          var isKey=keyIT.indexOf(key)!==-1,isSelected=selectedIT.indexOf(key)!==-1;
          content+='<div style="padding:.5rem;border-radius:7px;background:'+(isKey?'#ecfdf5':isSelected?'#fef2f2':'#f8fafc')+';"><b>'+key+'.</b> '+esc(question.options[key])+
            (isSelected?' <span class="badge badge-info">Jawaban Anda</span>':'')+(isKey?' <span class="badge badge-success">Kunci</span>':'')+'</div>';
        });
        content+='</div>';
      }
      content+='<div style="margin-top:.625rem;"><b>Jawaban Anda:</b> '+esc(formatAnswer(question,answer))+'</div>' +
        '<div style="margin-top:.5rem;color:#065f46;"><b>Kunci jawaban:</b> '+esc(formatAnswer(question,question.correctAnswer))+'</div>' +
        (question.explanation?'<div style="margin-top:.625rem;padding:.625rem;background:#eff6ff;border-radius:7px;color:#1e3a8a;"><b>Pembahasan:</b><br>'+esc(question.explanation)+'</div>':'')+
        '</div>';
    });
    showAssessmentContent(content);
  }

  function formatAnswer(question,answer){
    if (answer===undefined||answer===null||answer==='') return 'Tidak dijawab';
    var type=typeOf(question);
    if (type==='JEC_PGK') {
      var list=window.normalizeQuestionBooleanAnswers?window.normalizeQuestionBooleanAnswers(answer):answer;
      return Array.isArray(list)?list.map(function(value,index){return (index+1)+': '+(value?'Benar/Ya':'Salah/Tidak');}).join(', '):'Tidak dijawab';
    }
    if(type==='JEC_TF') return answer===true?'Benar':answer===false?'Salah':String(answer);
    if(type==='JEC_MT'){
      return Object.keys(answer||{}).map(function(index){
        var right=(question.rightItems||[])[Number(answer[index])];
        return String((question.leftItems||[])[Number(index)]||('Premis '+(Number(index)+1)))+' → '+String(right||'Tidak dijawab');
      }).join('; ');
    }
    if(type==='JEC_CT'){
      return (question.gaps||[]).map(function(gap){return gap.id+': '+String(answer[gap.id]||'Tidak dijawab');}).join('; ');
    }
    if(type==='JEC_DC'){
      var option=(question.options||[])[Number(answer)];
      return typeof option==='string'?option:(option&&option.text)||String(answer);
    }
    if(type==='JEC_IT') return formatAnswer(Object.assign({},question,{type:question.interactionType||'JEC_PGS'}),answer);
    return Array.isArray(answer)?answer.join(', '):String(answer);
  }

  window.openAssessmentResult=async function(sessionId,attemptId){
    try {
      var session=await getSession(sessionId,true);
      var attempt=(PS.myAttempts||[]).find(function(item){return item.id===attemptId;});
      if (!attempt) {
        var doc=await db.collection('attempts').doc(attemptId).get();
        if (!doc.exists||doc.data().studentId!==PS.user.id||doc.data().sessionId!==sessionId) throw new Error('Hasil Asesmen tidak ditemukan.');
        attempt=Object.assign({id:doc.id},doc.data());
      }
      if (attempt.status!=='completed') throw new Error('Asesmen ini belum selesai.');
      var questions=attempt.questionsSnapshot&&attempt.questionsSnapshot.length
        ? attempt.questionsSnapshot
        : await loadQuestions(sessionId);
      if (!questions.length) throw new Error('Soal untuk hasil Asesmen tidak ditemukan.');
      AS.session=session;AS.questions=questions;AS.attempt=attempt;AS.attemptId=attempt.id;AS.answers=attempt.answers||{};
      renderResult(questions,attempt,session);
    } catch(error) {
      console.error('[asesmen] Gagal membuka hasil:',error);
      if (window.alert2) alert2('Hasil tidak tersedia',esc(error.message||'Kesalahan tidak diketahui'),'error');
    }
  };

  window.addEventListener('beforeunload',stopTimer);
})();

console.log('✅ s/asesmen.js v1.0 loaded');
