/* #33 | /root/js/s/info.js | v 2.0 | u 18/10/2026 | xu : ke-5 | note : #noteresponse
- v1.3 -> v2.0 (INFO DIPERBARUI untuk Assignment/Asesmen dan mode pengerjaan):
  * UPDATE INJECT STYLE: semua warna biru (#2563eb, #1e40af, #dbeafe) diganti
    dengan palette WhatsApp (#00A884, #008069, #E7F7F2). Tidak mengandalkan
    override s.css (karena <style> di sini specificity-nya menang).
    - .info-app-header: gradient #00A884 -> #008069
    - .info-app-header .info-app-ver: background putih transparan
    - .info-card h3 .material-icons: #00A884
    - .info-step-num: background #00A884
    - .mode-tag.live: background #E7F7F2, color #008069
    - .mode-tag.hw: background #FFF3CD, color #8A6D3B (kuning lembut, tetap)
    - .info-card: border #E9EDEF, radius 16px, shadow halus
  * TETAP: tema WhatsApp, Laporkan Masalah via WA, Tentang, override setTab,
    wrapper renderStudentTab, dan bind_nav.
- EXPOSE: window.renderInfoTab, window.openLaporMasalah, window.submitLaporMasalah. */

(function(){
  'use strict';

  var WA_TEKNIS = '6285335913758';
  var APP_VER = '2.0';

  function injectStyle(){
    if (document.getElementById('info-style')) document.getElementById('info-style').remove();
    var st = document.createElement('style');
    st.id = 'info-style';
    st.textContent = [
      /* Header card (gradient WhatsApp) */
      '.info-app-header{background:linear-gradient(135deg,#00A884 0%,#008069 100%);color:#fff;border-radius:20px;padding:1.5rem 1rem;margin-bottom:1rem;text-align:center;box-shadow:0 8px 24px rgba(0,168,132,.28);position:relative;overflow:hidden;}',
      '.info-app-header::before{content:"";position:absolute;top:-30px;right:-30px;width:120px;height:120px;background:rgba(255,255,255,.08);border-radius:50%;}',
      '.info-app-header::after{content:"";position:absolute;bottom:-40px;left:-20px;width:140px;height:140px;background:rgba(255,255,255,.05);border-radius:50%;}',
      '.info-app-header .info-app-logo{font-size:3rem;margin-bottom:.25rem;position:relative;z-index:1;}',
      '.info-app-header h2{font-size:1.25rem;font-weight:800;margin:0 0 .25rem 0;letter-spacing:.3px;position:relative;z-index:1;color:#fff;}',
      '.info-app-header .info-app-ver{font-size:.8125rem;font-weight:600;opacity:1;background:rgba(255,255,255,.2);color:#fff;display:inline-block;padding:.25rem .875rem;border-radius:50px;border:1px solid rgba(255,255,255,.25);position:relative;z-index:1;}',

      /* Card umum */
      '.info-card{background:#fff;border:1px solid #E9EDEF;border-radius:16px;padding:1rem;margin-bottom:.875rem;box-shadow:0 1px 3px rgba(17,27,33,.04);}',
      '.info-card h3{display:flex;align-items:center;gap:.5rem;font-size:.9375rem;font-weight:700;margin-bottom:.75rem;color:#111B21;}',
      '.info-card h3 .material-icons{color:#00A884;font-size:20px;}',

      /* Step numbering (lingkaran hijau WA) */
      '.info-step{display:flex;gap:.75rem;margin-bottom:.75rem;}',
      '.info-step-num{flex:0 0 auto;width:26px;height:26px;border-radius:50%;background:#00A884;color:#fff;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;box-shadow:0 2px 4px rgba(0,168,132,.3);}',
      '.info-step-body{flex:1;font-size:.8125rem;color:#667781;line-height:1.65;}',
      '.info-step-body b{color:#111B21;}',

      /* Mode tag (pill) */
      '.info-step-body .mode-tag{display:inline-block;font-size:.6875rem;font-weight:700;padding:.125rem .5rem;border-radius:50px;margin-right:.25rem;vertical-align:middle;}',
      '.info-step-body .mode-tag.live{background:#E7F7F2;color:#008069;}',
      '.info-step-body .mode-tag.hw{background:#FFF3CD;color:#8A6D3B;}',

      /* About */
      '.info-about p{font-size:.8125rem;color:#667781;line-height:1.7;margin-bottom:.5rem;}',
      '.info-about .info-logo{font-size:2.5rem;text-align:center;margin:.5rem 0;}',

      /* Version footer */
      '.info-ver{font-size:.7rem;color:#667781;text-align:center;margin-top:.75rem;padding-top:.75rem;border-top:1px solid #E9EDEF;}',

      /* Tombol di info-card */
      '.info-card .btn{border-radius:24px!important;font-weight:600;}',
      '.info-card .btn-warning{background:#FFA726!important;color:#fff!important;border:none!important;box-shadow:0 2px 6px rgba(255,167,38,.3);}',
      '.info-card .btn-success{background:#25D366!important;color:#fff!important;border:none!important;box-shadow:0 2px 6px rgba(37,211,102,.3);}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function step(n, txt){
    return '<div class="info-step"><div class="info-step-num">' + n + '</div><div class="info-step-body">' + txt + '</div></div>';
  }

  function renderInfoTab(){
    injectStyle();
    var wrap = document.getElementById('infoTabContent');
    if (!wrap) return;
    wrap.innerHTML =
      // ===== HEADER APP (paling atas) =====
      '<div class="info-app-header">' +
        '<div class="info-app-logo">🎓</div>' +
        '<h2>JEC Exercise ACT</h2>' +
        '<span class="info-app-ver">Version '+APP_VER+'</span>' +
      '</div>' +

      // ===== CARA PENGGUNAAN =====
      '<div class="info-card">' +
        '<h3><span class="material-icons">menu_book</span>Cara Penggunaan Aplikasi</h3>' +
        step(1,'Login menggunakan <b>ID Siswa</b> dan <b>PIN</b> yang diberikan oleh mentor.') +
        step(2,'Di <b>Home</b>, periksa <b>Overview</b> dan bagian <b>Assignment (Asesmen/Ulangan)</b>, <b>Homework</b>, serta <b>Live Exercise</b>. Sesi Realtime yang sedang berlangsung muncul di Overview dan diikuti menggunakan kode dari mentor.') +
        step(3,'<b>Assignment / Asesmen (Ulangan):</b> buka sesi aktif, baca detail, tekan <b>Mulai Mengerjakan</b>, kerjakan lalu <b>Kumpulkan</b>. Setelah selesai, Anda dapat melihat nilai, jawaban, dan pembahasan.') +
        step(4,'Asesmen mendukung 11 tipe soal: <b>PGS</b>, <b>MCMA</b>, <b>PGK</b>, <b>Short Answer</b>, <b>Benar/Salah</b>, <b>Cloze Test</b>, <b>Matching Test</b>, <b>Error Identification</b>, <b>Sentence Transformation</b>, <b>Interactive Test</b>, dan <b>Dialog Completion</b>. Tipe yang tersedia mengikuti susunan soal dari mentor.') +
        step(5,'<span class="mode-tag hw">PR</span><b>Homework:</b> buka detail untuk memeriksa jumlah soal, deadline, dan aturan percobaan. Soal dapat memberikan feedback dan pembahasan langsung sesuai pengaturan sesi.') +
        step(6,'<span class="mode-tag live">Live</span><b>Live Exercise:</b> periksa durasi dan instruksi sebelum mulai. Ikuti aturan anti-cheat yang ditampilkan; bila anti-cheat aktif, tetap berada di tab yang sama.') +
        step(7,'<b>Realtime Exercise:</b> minta kode join dari mentor, lalu gabung ke room yang sedang berjalan. Jangan menutup halaman selama sesi berlangsung.') +
        step(8,'Gunakan tombol <b>Prev / Next</b>, <b>Menu Soal</b> untuk berpindah nomor, dan <b>Ragu</b> untuk menandai soal yang ingin diperiksa kembali. Tekan <b>Kumpulkan</b> untuk mengakhiri pengerjaan.') +
        step(9,'Aturan percobaan Homework mengikuti pengaturan mentor: dapat dibatasi satu kali atau mengizinkan percobaan ulang selama sesi masih tersedia. Periksa deadline dan detail sesi sebelum mulai.') +
        step(10,'Tab <b>Riwayat</b> berisi tab <b>Assignment</b>, <b>Homework</b>, <b>Live</b>, dan <b>Realtime</b>. Buka attempt untuk melihat hasil; tab <b>Nilai</b> menampilkan ringkasan nilai, dan <b>Profile</b> menyimpan data diri.') +
      '</div>' +

      // ===== LAPORKAN MASALAH =====
      '<div class="info-card">' +
        '<h3><span class="material-icons">bug_report</span>Laporkan Masalah</h3>' +
        '<p style="font-size:.8125rem;color:#667781;margin-bottom:.75rem;">Menemui kendala teknis? Kirim laporan langsung ke Mentor Teknis Simulasi melalui WhatsApp.</p>' +
        '<button class="btn btn-warning w-full" onclick="openLaporMasalah()"><span class="material-icons">support_agent</span>Laporkan Masalah</button>' +
      '</div>' +

      // ===== TENTANG =====
      '<div class="info-card info-about">' +
        '<h3><span class="material-icons">info</span>Tentang JEC Exercise ACT</h3>' +
        '<div class="info-logo">🎓</div>' +
        '<p><b>JEC Exercise ACT</b> (Jagat Education Center — Exercise Academic Competence Test) adalah platform latihan simulasi kompetensi akademik berbasis web dari <b>Jagat Education Center</b>.</p>' +
        '<p>Modul <b>Exercise TKA</b> menyediakan <b>Assignment / Asesmen (Ulangan)</b> dengan 11 tipe soal, serta <b>Live Exercise</b>, <b>Homework / PR</b>, dan <b>Realtime Exercise</b>. Aturan pengerjaan, deadline, dan percobaan mengikuti pengaturan pada setiap sesi.</p>' +
        '<p>Dikembangkan untuk membantu siswa berlatih secara terukur dan terstruktur dalam menghadapi asesmen kompetensi.</p>' +
        '<div class="info-ver">JEC Exercise ACT v'+APP_VER+' &copy; 2026 Jagat Education Center</div>' +
      '</div>';
  }

  window.openLaporMasalah = function(){
    var content =
      '<div class="form-group"><label class="form-label">Judul Masalah</label>' +
      '<input type="text" class="form-control" id="lmJudul" placeholder="Contoh: Tidak bisa memulai sesi"></div>' +
      '<div class="form-group"><label class="form-label">Jelaskan Masalah</label>' +
      '<textarea class="form-control" id="lmPesan" rows="4" placeholder="Jelaskan kendala yang Anda alami secara detail..."></textarea></div>' +
      '<p style="font-size:.75rem;color:#667781;">Laporan akan dikirim via WhatsApp ke Mentor Teknis Simulasi.</p>';
    M.custom({
      title: 'Laporkan Masalah', message: content, type: 'warning',
      buttons: [
        { text:'Batal', class:'btn-secondary' },
        { text:'Kirim via WhatsApp', class:'btn-success', action: submitLaporMasalah }
      ]
    });
  };

  window.submitLaporMasalah = function(){
    var judul = document.getElementById('lmJudul').value.trim();
    var pesan = document.getElementById('lmPesan').value.trim();
    if (!judul) { alert2('Error','Judul masalah wajib diisi','error'); return; }
    if (!pesan) { alert2('Error','Penjelasan masalah wajib diisi','error'); return; }
    var now = new Date();
    var p = function(n){ return String(n).padStart(2,'0'); };
    var msg = '*LAPORAN MASALAH APLIKASI*\nJEC Exercise ACT (Exercise TKA) v'+APP_VER+'\n\n' +
      'Nama: ' + (PS.user.name||'-') + '\nID Siswa: ' + (PS.user.id||'-') + '\n' +
      'Judul: ' + judul + '\nMasalah:\n' + pesan + '\n\n' +
      'Waktu: ' + p(now.getDate()) + '/' + p(now.getMonth()+1) + '/' + now.getFullYear() + ' ' + p(now.getHours()) + ':' + p(now.getMinutes()) + '\n' +
      'Perangkat: ' + ((navigator.userAgent||'').indexOf('Mobile')>-1?'Mobile':'Desktop');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(msg).catch(function(){});
    window.open('https://wa.me/' + WA_TEKNIS + '?text=' + encodeURIComponent(msg), '_blank');
    toast('Laporan disalin & WhatsApp dibuka. Tekan kirim di WA.','success');
  };

  (function(){
    var orig = window.renderStudentTab;
    window.renderStudentTab = function(name){
      if (name === 'info') { renderInfoTab(); return; }
      if (typeof orig === 'function') orig(name);
    };
  })();

  (function(){
    if (!window.PS || typeof PS.setTab !== 'function') return;
    var origSet = PS.setTab;
    PS.setTab = function(name){
      if (name === 'info') {
        PS.activeTab = 'info';
        if (window.showTabPage) window.showTabPage('info');
        if (window.highlightBnNav) window.highlightBnNav('info');
        if (window.renderStudentTab) window.renderStudentTab('info');
        return;
      }
      origSet(name);
    };
  })();

  function bindNav(){
    document.querySelectorAll('.bn-item[data-tab="info"]').forEach(function(el){
      if (!el._infoBound) { el._infoBound = true; el.addEventListener('click', function(){ PS.setTab('info'); }); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindNav);
  else bindNav();

  window.renderInfoTab = renderInfoTab;
})();