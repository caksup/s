/* #28 | /root/js/s/feedback.js | v 2.1 | u 08/09/2026 • 12:05:00 | xu : ke-3 | note : #noteresponse
- FIX "$ is not defined": tambah helper $(id) di dalam IIFE (v2.0 lupa mendefinisikannya).
- Tetap: tab Feedback = kritik & saran saja + list riwayat feedback siswa + balasan admin.
- Tetap: openFeedbackFor(qid) modal cepat lapor soal (backward compat test.js).
- Tetap: openFeedback() tanpa argumen -> buka tab feedback. */

(function(){
  'use strict';

  function $(id){ return document.getElementById(id); }   // <-- FIX: helper yang hilang

  function escFb(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function formatDateFb(ts){
    if (!ts) return '-';
    var d;
    try { d = ts.toDate ? ts.toDate() : new Date(ts); } catch(e){ return '-'; }
    var p = function(n){ return String(n).padStart(2,'0'); };
    return p(d.getDate()) + '/' + p(d.getMonth()+1) + '/' + d.getFullYear() +
           ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  // ===== MODAL CEPAT (khusus lapor soal dari tombol flag di test.js) =====
  function openFeedbackForSoal(questionId, questionText){
    var content =
      '<div class="form-group"><label class="form-label">Jenis Laporan</label>' +
      '<select class="form-control" id="fbType">' +
      '<option value="keliru">Soal Keliru / Typo</option>' +
      '<option value="salah">Kunci Jawaban Salah</option>' +
      '<option value="kritik">Kritik Soal</option>' +
      '<option value="saran">Saran Perbaikan</option>' +
      '</select></div>' +
      '<div class="form-group"><label class="form-label">Subjek (singkat)</label>' +
      '<input type="text" class="form-control" id="fbSubject" placeholder="Contoh: Soal nomor 3 typo" value="' +
        escFb(questionText ? 'Soal: ' + questionText.slice(0,40) : '') + '"></div>' +
      '<div class="form-group"><label class="form-label">Pesan</label>' +
      '<textarea class="form-control" id="fbMessage" rows="4" placeholder="Jelaskan laporan Anda..."></textarea></div>';

    M.custom({
      title: 'Laporkan Soal',
      message: content,
      type: 'warning',
      buttons: [
        { text:'Batal', class:'btn-secondary' },
        { text:'Kirim Laporan', class:'btn-primary', action: function(){ submitFeedback(questionId, questionText); } }
      ]
    });
  }

  async function submitFeedback(questionId, questionText){
    var type = document.getElementById('fbType').value;
    var subject = document.getElementById('fbSubject').value.trim();
    var message = document.getElementById('fbMessage').value.trim();

    if (!message) { alert2('Error', 'Pesan wajib diisi', 'error'); return; }

    try {
      await db.collection('feedback').add({
        studentId: PS.user.id,
        studentName: PS.user.name,
        type: type,
        subject: subject || '(tanpa subjek)',
        message: message,
        sessionId: PS.currentSession ? PS.currentSession.id : null,
        questionId: questionId || null,
        questionText: questionText || null,
        status: 'baru',
        adminNote: '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      toast('Laporan terkirim. Terima kasih!', 'success');
    } catch(e){
      alert2('Error', 'Gagal kirim: ' + e.message, 'error');
    }
  }

  // ===== TAB FEEDBACK: form Kritik & Saran + list riwayat =====
  async function renderFeedbackTab(){
    var wrap = $('feedbackTabContent');
    if (!wrap) return;

    wrap.innerHTML =
      '<div class="fb-form-card">' +
        '<h3 style="font-size:1rem;font-weight:700;margin-bottom:.75rem;display:flex;align-items:center;gap:.375rem;">' +
          '<span class="material-icons" style="color:#2563eb;">rate_review</span>' +
          'Kirim Kritik & Saran' +
        '</h3>' +
        '<p style="font-size:.8125rem;color:#64748b;margin-bottom:1rem;">' +
          'Sampaikan kritik atau saran Anda untuk meningkatkan kualitas Exercise TKA.' +
        '</p>' +
        '<div class="form-group">' +
          '<label class="form-label">Jenis</label>' +
          '<div style="display:flex;gap:.5rem;">' +
            '<label class="fb-radio-label">' +
              '<input type="radio" name="fbTabType" value="kritik" checked>' +
              '<span class="material-icons">thumbs_up_down</span>Kritik' +
            '</label>' +
            '<label class="fb-radio-label">' +
              '<input type="radio" name="fbTabType" value="saran">' +
              '<span class="material-icons">lightbulb</span>Saran' +
            '</label>' +
          '</div>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Subjek (singkat)</label>' +
          '<input type="text" class="form-control" id="fbTabSubject" placeholder="Contoh: Durasi terlalu singkat">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Pesan</label>' +
          '<textarea class="form-control" id="fbTabMessage" rows="4" placeholder="Jelaskan kritik atau saran Anda..."></textarea>' +
        '</div>' +
        '<button class="btn btn-primary w-full" onclick="submitTabFeedback()">' +
          '<span class="material-icons">send</span>Kirim' +
        '</button>' +
      '</div>' +
      '<div class="fb-list-section">' +
        '<h3 style="font-size:1rem;font-weight:700;margin-bottom:.75rem;display:flex;align-items:center;gap:.375rem;">' +
          '<span class="material-icons" style="color:#2563eb;">history</span>' +
          'Riwayat Feedback Saya' +
        '</h3>' +
        '<div id="fbMyList"><div class="empty-state" style="padding:1rem;"><span class="material-icons">hourglass_empty</span><p>Memuat...</p></div></div>' +
      '</div>';

    await loadMyFeedback();
  }

  async function loadMyFeedback(){
    var list = $('fbMyList');
    if (!list) return;
    try {
      var snap = await db.collection('feedback')
        .where('studentId','==',PS.user.id)
        .get();
      var items = [];
      snap.forEach(function(d){ items.push(Object.assign({id:d.id},d.data())); });
      items.sort(function(a,b){
        var ta = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0;
        var tb = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0;
        return tb - ta;
      });

      if (items.length === 0) {
        list.innerHTML =
          '<div class="empty-state" style="padding:1.5rem;">' +
            '<span class="material-icons">inbox</span>' +
            '<p>Belum ada feedback. Silakan kirim kritik atau saran Anda.</p>' +
          '</div>';
        return;
      }

      list.innerHTML = items.map(function(f){
        var stBadge = f.status === 'resolved'
          ? '<span class="badge badge-success">Selesai</span>'
          : '<span class="badge badge-warning">Menunggu</span>';
        var note = f.adminNote
          ? '<div style="margin-top:.5rem;padding:.5rem;background:#eff6ff;border-radius:6px;font-size:.8125rem;">' +
              '<strong style="color:#2563eb;">Balasan Admin:</strong> ' + escFb(f.adminNote) +
            '</div>'
          : '';
        return '<div class="fb-item">' +
          '<div class="fb-item-head">' +
            '<div>' +
              '<span class="badge badge-info" style="margin-right:.375rem;">' + escFb(f.type || '-') + '</span>' +
              stBadge +
            '</div>' +
            '<span style="font-size:.7rem;color:#94a3b8;">' + formatDateFb(f.createdAt) + '</span>' +
          '</div>' +
          '<div class="fb-item-subject">' + escFb(f.subject || '(tanpa subjek)') + '</div>' +
          '<div class="fb-item-msg">' + escFb(f.message || '') + '</div>' +
          note +
        '</div>';
      }).join('');
    } catch(e){
      list.innerHTML = '<div class="empty-state"><span class="material-icons">error</span><p>Gagal memuat: '+escFb(e.message)+'</p></div>';
    }
  }

  // Submit dari tab feedback (hanya kritik / saran)
  window.submitTabFeedback = async function(){
    var typeEl = document.querySelector('input[name="fbTabType"]:checked');
    var type = typeEl ? typeEl.value : 'kritik';
    var subject = document.getElementById('fbTabSubject').value.trim();
    var message = document.getElementById('fbTabMessage').value.trim();
    if (!subject) { alert2('Error','Subjek wajib diisi','error'); return; }
    if (!message) { alert2('Error','Pesan wajib diisi','error'); return; }

    try {
      await db.collection('feedback').add({
        studentId: PS.user.id,
        studentName: PS.user.name,
        type: type,
        subject: subject,
        message: message,
        sessionId: null,
        questionId: null,
        questionText: null,
        status: 'baru',
        adminNote: '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      toast('Feedback terkirim. Terima kasih!', 'success');
      document.getElementById('fbTabSubject').value = '';
      document.getElementById('fbTabMessage').value = '';
      await loadMyFeedback();
    } catch(e){
      alert2('Error', 'Gagal kirim: ' + e.message, 'error');
    }
  };

  // Backward compat: openFeedback() tanpa argumen = buka tab feedback
  window.openFeedback = function(){
    if (window.PS && typeof PS.setTab === 'function') {
      PS.setTab('feedback');
    } else {
      openFeedbackForSoal(null, null);
    }
  };
  // openFeedbackFor(qid) tetap modal cepat utk lapor soal (dipakai test.js)
  window.openFeedbackFor = function(qid){
    var q = (window.__lastResult && window.__lastResult.questions || []).find(function(x){ return x.id === qid; });
    openFeedbackForSoal(qid, q ? q.text : null);
  };

  window.renderFeedbackTab = renderFeedbackTab;
})();