/* #36 | /root/js/s/nilai.js | v 1.2 | u 10/09/2026 • 08:05:00 | xu : ke-3 | note : #noteresponse
- FIX NAMA SESI ACAK (ID Firestore) di Ringkasan & Tabel:
  Penyebab: PS.sessions hanya memuat sesi status!==false && visible!==false. Sesi yang
  sudah di-OFF/HIDDEN admin tidak masuk list, sehingga lookup nama gagal dan fallback ke
  sessionId (ID acak Firestore).
  Solusi: resolveSessionNames() -> cache nama di PS.sessionNameCache; sesi yang tidak ada
  di PS.sessions di-fetch langsung via query where(FieldPath.documentId(),'in',[...])
  (chunk 30), sehingga nama tetap tampil di Ringkasan Per Sesi & tabel detail.
- TETAP (tidak dipotong dari v1.1): fetch attempts langsung, ensureSessions, sinkron
  PS.myAttempts, rekap global (avg/max/min), group per sesi + hitung stat (avg/max/min),
  ringkasan card per sesi, tabel detail 7 kolom (No, Sesi, Nilai, Benar, Waktu, Tanggal,
  Aksi), klik baris -> review, console.log debug. */

(function(){
  'use strict';

  function escN(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

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

  // ===== Cache nama sesi (sid -> name) =====
  function sessNameFromList(sid){
    var s = PS.sessions.find(function(x){ return x.id === sid; });
    return s ? (s.name || null) : null;
  }
  function nameOf(sid){
    if (!sid) return '-';
    return PS.sessionNameCache[sid] || sessNameFromList(sid) || '(Sesi tidak diketahui)';
  }

  // Ambil nama untuk semua sessionId pada attempts; yg tidak ada di PS.sessions di-fetch by ID
  async function resolveSessionNames(attempts){
    PS.sessionNameCache = PS.sessionNameCache || {};
    var missing = {};
    attempts.forEach(function(a){
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
      console.log('[PS] nilai resolve names:', ids.length);
    } catch(e){ console.warn('[PS] resolve names gagal:', e); }
  }

  async function fetchAttempts(){
    var items = [];
    try {
      var snap = await db.collection('attempts').where('studentId','==',PS.user.id).get();
      snap.forEach(function(d){ items.push(Object.assign({id:d.id}, d.data())); });
    } catch(e){ console.error('[PS] nilai fetch attempts error:', e); }
    console.log('[PS] nilai attempts:', items.length);
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

  async function renderNilaiTab(){
    var wrap = document.getElementById('nilaiTable');
    if (!wrap) return;

    var allAttempts = await fetchAttempts();
    await ensureSessions();
    await resolveSessionNames(allAttempts);   // FIX: nama sesi akurat walau sesi di-off/hidden

    // Sinkronkan
    PS.myAttempts = allAttempts;

    // Filter completed + sort by tanggal desc
    var completed = allAttempts.filter(function(a){ return a.status === 'completed'; });
    completed.sort(function(a,b){ return tsValue(b.finishedAt||b.startedAt) - tsValue(a.finishedAt||a.startedAt); });

    // ===== REKAP GLOBAL =====
    var scores = completed.map(function(a){ return a.score||0; });
    var avg = scores.length ? Math.round(scores.reduce(function(x,y){return x+y;},0)/scores.length) : 0;
    var max = scores.length ? Math.max.apply(null, scores) : 0;
    var min = scores.length ? Math.min.apply(null, scores) : 0;

    var rekap = '<div class="mini-grid" style="margin-bottom:1rem;">' +
      '<div class="mini-card mini-card-primary"><div class="mini-icon"><span class="material-icons">trending_up</span></div>' +
        '<div class="mini-label">Rata-rata</div><div class="mini-value">' + avg + '</div></div>' +
      '<div class="mini-card mini-card-success"><div class="mini-icon"><span class="material-icons">emoji_events</span></div>' +
        '<div class="mini-label">Tertinggi</div><div class="mini-value">' + max + '</div></div>' +
      '<div class="mini-card mini-card-warning"><div class="mini-icon"><span class="material-icons">trending_down</span></div>' +
        '<div class="mini-label">Terendah</div><div class="mini-value">' + min + '</div></div>' +
    '</div>';

    if (completed.length === 0) {
      wrap.innerHTML = rekap +
        '<div class="empty-state" style="padding:2rem;">' +
          '<span class="material-icons">emoji_events</span>' +
          '<p>Belum ada nilai. Silakan kerjakan Exercise TKA terlebih dahulu.</p>' +
        '</div>';
      return;
    }

    // ===== GROUP PER SESI =====
    var perSesi = {};
    completed.forEach(function(a){
      var sid = a.sessionId;
      if (!perSesi[sid]) perSesi[sid] = { sessionId: sid, attempts: [] };
      perSesi[sid].attempts.push(a);
    });

    // Hitung stat per sesi
    Object.keys(perSesi).forEach(function(sid){
      var grp = perSesi[sid];
      var sc = grp.attempts.map(function(a){ return a.score||0; });
      grp.count = grp.attempts.length;
      grp.avg = Math.round(sc.reduce(function(x,y){return x+y;},0)/sc.length);
      grp.max = Math.max.apply(null, sc);
      grp.min = Math.min.apply(null, sc);
    });

    // ===== RINGKASAN PER SESI =====
    var ringkasanHtml = '<div style="margin-bottom:1.25rem;">' +
      '<h3 class="section-title" style="margin-top:0;"><span class="material-icons">analytics</span>Ringkasan Per Sesi</h3>' +
      '<div style="display:grid;gap:.5rem;">';

    Object.keys(perSesi).forEach(function(sid){
      var grp = perSesi[sid];
      var nama = nameOf(sid);   // FIX: pakai nameOf (cache-aware)
      var color = grp.avg >= 80 ? '#10b981' : (grp.avg < 50 ? '#ef4444' : '#2563eb');
      ringkasanHtml +=
        '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:.75rem;display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;">' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:.875rem;font-weight:600;color:#1e293b;margin-bottom:.25rem;">' + escN(nama) + '</div>' +
            '<div style="display:flex;gap:.75rem;font-size:.7rem;color:#64748b;flex-wrap:wrap;">' +
              '<span>' + grp.count + ' attempt</span>' +
              '<span>Avg: <b>' + grp.avg + '</b></span>' +
              '<span>Max: <b>' + grp.max + '</b></span>' +
              '<span>Min: <b>' + grp.min + '</b></span>' +
            '</div>' +
          '</div>' +
          '<div style="font-size:1.5rem;font-weight:700;color:' + color + ';">' + grp.avg + '</div>' +
        '</div>';
    });

    ringkasanHtml += '</div></div>';

    // ===== TABEL DETAIL SEMUA ATTEMPT =====
    var rows = completed.map(function(a, i){
      var nama = nameOf(a.sessionId);   // FIX: pakai nameOf (cache-aware)
      var score = a.score || 0;
      var cls = score >= 80 ? 'high' : (score < 50 ? 'low' : '');
      return '<tr onclick="showResultFromAttempt(\'' + a.id + '\')" style="cursor:pointer;">' +
        '<td style="text-align:center;font-weight:600;color:#94a3b8;">' + (i+1) + '</td>' +
        '<td>' + escN(nama) + '</td>' +
        '<td class="nilai-score ' + cls + '">' + score + '</td>' +
        '<td>' + (a.correctAnswers||0) + '/' + (a.totalQuestions||0) + '</td>' +
        '<td>' + fmtDur(a.totalTime) + '</td>' +
        '<td style="font-size:.7rem;color:#64748b;">' + fmtDate(a.finishedAt||a.startedAt) + '</td>' +
        '<td><span class="material-icons" style="font-size:16px;color:#2563eb;">chevron_right</span></td>' +
      '</tr>';
    }).join('');

    var tabelHtml =
      '<div style="overflow-x:auto;"><table class="nilai-table">' +
        '<thead><tr>' +
          '<th style="width:40px;">No</th>' +
          '<th>Sesi</th>' +
          '<th style="width:60px;">Nilai</th>' +
          '<th style="width:70px;">Benar</th>' +
          '<th style="width:65px;">Waktu</th>' +
          '<th>Tanggal</th>' +
          '<th style="width:30px;"></th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table></div>' +
      '<p style="font-size:.7rem;color:#94a3b8;text-align:center;margin-top:.75rem;">' +
        'Total ' + completed.length + ' attempt selesai. Klik baris untuk review jawaban.' +
      '</p>';

    wrap.innerHTML = rekap + ringkasanHtml + tabelHtml;
  }

  window.renderNilaiTab = renderNilaiTab;
})();