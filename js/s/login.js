/* #24 | /root/js/s/login.js | v 2.3 | u 18/09/2026 • 02:35:00 | xu : ke-7 | note : #noteresponse
- v2.2 -> v2.3 (HEADER UPDATE: nickname + status online/offline real-time):
  * TAMBAH getNickname(user, profile): helper ambil nickname. Fallback: kata
    pertama dari nama bila field nickname tidak ada di Firestore/user.
  * UPDATE renderHeader(): render nickname ke #sUserNickname sebagai
    "Hi, [nickname] 👋" (kosong bila nickname kosong).
  * UPDATE startClock(): menulis jam ke elemen #sClockText (struktur baru
    sDateLine di sp.html v4.7). Format tetap sama, hanya target elemen.
  * TAMBAH setupConnectionMonitor(): listener 'online'/'offline' event,
    update elemen #connRadar (class online/offline) dan #connLabel
    ("Online"/"Offline") secara real-time. Dipanggil sekali saat renderHeader.
  * UPDATE loadProfileExtended(): sync nickname ke PS.user bila profile
    Firestore punya field nickname, lalu update #sUserNickname.
  * UPDATE login submit handler: simpan field nickname ke PS.user bila ada
    di dokumen Firestore siswa.
  * TETAP dari v2.2: saveSession/readSession/clearSession, showDashboard
    via showScreen('app'), restore dengan auto-resume, safetyNet, toggle
    PIN visibility, form submit handler, logout conditional.
- EXPOSE: window.showStudentDashboard, window.saveStudentSession,
  window.clearStudentSession. */

(function(){
  'use strict';
  function $(id){ return document.getElementById(id); }

  function saveSession(user){
    var s = JSON.stringify(user);
    try{ localStorage.setItem('student_session', s); }catch(e){}
    try{ sessionStorage.setItem('student_session', s); }catch(e){}
  }
  function readSession(){
    var s = null;
    try{ s = localStorage.getItem('student_session') || sessionStorage.getItem('student_session'); }catch(e){}
    return s;
  }
  function clearSession(){
    try{ localStorage.removeItem('student_session'); }catch(e){}
    try{ sessionStorage.removeItem('student_session'); }catch(e){}
  }

  // Helper: ambil nickname (fallback: kata pertama nama)
  function getNickname(user, profile){
    if (profile && profile.nickname && String(profile.nickname).trim()) {
      return String(profile.nickname).trim();
    }
    if (user && user.nickname && String(user.nickname).trim()) {
      return String(user.nickname).trim();
    }
    if (user && user.name) {
      return String(user.name).split(/\s+/)[0];
    }
    return '';
  }

  // UPDATE v2.3: jam ditulis ke #sClockText (struktur baru sDateLine)
  function startClock(){
    var hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    var bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    function upd(){
      var now = new Date();
      var el = $('sClockText');
      if (el) {
        var p = function(n){ return String(n).padStart(2,'0'); };
        el.textContent = hari[now.getDay()] + ', ' + now.getDate() + ' ' + bulan[now.getMonth()] + ' ' + now.getFullYear() +
          '  •  ' + p(now.getHours()) + ':' + p(now.getMinutes()) + ':' + p(now.getSeconds());
      }
    }
    upd();
    if (!window.__sClock) window.__sClock = setInterval(upd, 1000);
  }

  // UPDATE v2.3: monitor koneksi online/offline + update UI real-time
  function setupConnectionMonitor(){
    var radar = $('connRadar');
    var label = $('connLabel');
    function updateConn(){
      var on = navigator.onLine !== false;
      if (radar) {
        radar.classList.remove('online','offline');
        radar.classList.add(on ? 'online' : 'offline');
      }
      if (label) label.textContent = on ? 'Online' : 'Offline';
    }
    updateConn();
    window.removeEventListener('online', updateConn);
    window.removeEventListener('offline', updateConn);
    window.addEventListener('online', updateConn);
    window.addEventListener('offline', updateConn);
  }

  // UPDATE v2.3: render nickname + ID + nama, plus koneksi monitor
  function renderHeader(user){
    var u = $('sUserId'); if (u) u.textContent = user.id;
    var n = $('sUserName'); if (n) n.textContent = user.name || '';
    var nickEl = $('sUserNickname');
    if (nickEl) {
      var nick = getNickname(user, PS.myProfile);
      nickEl.textContent = nick ? ('Hi, ' + nick + ' 👋') : '';
    }
    startClock();
    setupConnectionMonitor();
  }

  async function loadProfileExtended(){
    if (!PS.user || !PS.user.id) return;
    try {
      var d = await db.collection('students').doc(PS.user.id).get();
      if (d.exists) {
        PS.myProfile = Object.assign({ id: d.id }, d.data());
        if (PS.myProfile.name && PS.myProfile.name !== PS.user.name) {
          PS.user.name = PS.myProfile.name;
          var n = $('sUserName'); if (n) n.textContent = PS.user.name;
        }
        // UPDATE v2.3: sync nickname
        if (PS.myProfile.nickname) PS.user.nickname = PS.myProfile.nickname;
        var nickEl = $('sUserNickname');
        if (nickEl) {
          var nick = getNickname(PS.user, PS.myProfile);
          nickEl.textContent = nick ? ('Hi, ' + nick + ' 👋') : '';
        }
        if (window.renderProfileTab) window.renderProfileTab();
      }
    } catch(e){ console.warn('[PS] loadProfileExtended error:', e); }
  }

  async function showDashboard(){
    if (window.showScreen) showScreen('app');
    else {
      var ls = $('loginScreen'); if (ls) ls.style.display = 'none';
      var sa = $('studentApp'); if (sa) sa.style.display = 'block';
      var tp = $('testPage'); if (tp) tp.style.display = 'none';
      var rp = $('resultPage'); if (rp) rp.style.display = 'none';
    }
    renderHeader(PS.user);
    await loadProfileExtended();
    if (window.loadDashboard) await loadDashboard();
    if (window.PS && typeof PS.setTab === 'function') PS.setTab(PS.activeTab || 'home');
  }

  async function restore(){
    var raw = readSession();
    if (!raw) return;
    var user;
    try{ user = JSON.parse(raw); }catch(e){ clearSession(); return; }
    if (!user || !user.id) { clearSession(); return; }

    PS.user = user;
    renderHeader(user);
    await loadProfileExtended();

    try{
      var snap = await db.collection('attempts').where('studentId','==',user.id).get();
      var inc = null;
      snap.forEach(function(d){
        var a = d.data();
        if (a.status === 'in_progress') inc = { id: d.id, data: a };
      });
      if (inc && inc.data.sessionId && window.autoResume) {
        await window.autoResume(inc.data.sessionId);
        return;
      }
    }catch(e){ console.warn('[PS] cek resume gagal:', e); }

    await showDashboard();
  }

  function safetyNet(){
    try{
      var ls = $('loginScreen'), ap = $('studentApp');
      if (PS.user && ls && ap &&
          ls.style.display === 'none' &&
          (ap.style.display === 'none' || ap.style.display === '')) {
        if (window.showScreen) showScreen('app');
        else { ap.style.display = 'block'; }
        renderHeader(PS.user);
        if (window.PS && typeof PS.setTab === 'function') PS.setTab(PS.activeTab || 'home');
      }
    }catch(e){}
  }

  var tp = $('togglePin');
  if (tp) tp.addEventListener('click', function(){
    var p = $('loginPin');
    var icon = tp.querySelector('.material-icons');
    if (p.type === 'password') { p.type = 'text'; icon.textContent = 'visibility'; }
    else { p.type = 'password'; icon.textContent = 'visibility_off'; }
  });

  var form = $('loginForm');
  if (form) form.addEventListener('submit', async function(e){
    e.preventDefault();
    var err = $('loginErr');
    var id = $('loginId').value.trim();
    var pin = $('loginPin').value;
    var btn = form.querySelector('button[type="submit"]');

    err.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Verifikasi...';

    try {
      var snap = await db.collection('students').doc(id).get();
      if (!snap.exists) {
        err.textContent = 'ID Siswa tidak ditemukan!';
        err.style.display = 'block'; btn.disabled = false;
        btn.innerHTML = '<span class="material-icons">login</span>Masuk'; return;
      }
      var data = snap.data();
      if (data.status === false) {
        err.textContent = 'Akun Anda nonaktif. Hubungi admin.';
        err.style.display = 'block'; btn.disabled = false;
        btn.innerHTML = '<span class="material-icons">login</span>Masuk'; return;
      }
      var valid = await verifyPin(pin, data.pinHash);
      if (!valid) {
        err.textContent = 'PIN salah!';
        err.style.display = 'block'; btn.disabled = false;
        btn.innerHTML = '<span class="material-icons">login</span>Masuk'; return;
      }

      // UPDATE v2.3: simpan nickname ke PS.user bila ada di Firestore
      PS.user = {
        id: id,
        name: data.name,
        nickname: data.nickname || '',
        batch: data.batch,
        year: data.year,
        sequence: data.sequence
      };
      PS.myProfile = Object.assign({ id: id }, data);
      saveSession(PS.user);
      await showDashboard();
    } catch (error) {
      err.textContent = 'Error: ' + error.message;
      err.style.display = 'block'; btn.disabled = false;
      btn.innerHTML = '<span class="material-icons">login</span>Masuk';
    }
  });

  var lo = $('sLogoutBtn');
  if (lo) lo.addEventListener('click', function(){
    confirm2('Logout', 'Keluar dari panel siswa?', function(){
      clearSession();
      location.reload();
    });
  });

  function boot(){
    restore().catch(function(e){
      console.error('[PS] restore error:', e);
      safetyNet();
    }).then(function(){ safetyNet(); });
  }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);

  window.showStudentDashboard = showDashboard;
  window.saveStudentSession = saveSession;
  window.clearStudentSession = clearSession;

  console.log('✅ login.js v2.3 loaded (nickname + koneksi online/offline real-time)');
})();