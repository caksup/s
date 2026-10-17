/* #29 | /root/js/s/profile.js | v 2.0 | u 08/09/2026 • 09:10:00 | xu : ke-4 | note : #noteresponse
- ROMBAK: Profile jadi TAB (bukan modal lagi) dengan foto emoji 🎓, note motivasi,
  info batch/tahun, tombol Edit Profile, Ganti PIN, dan Logout di paling bawah.
- FIELD EXTENDED (disimpan di collection students):
  name, nickname, studentContact, school, className, address,
  parentName, parentContact (gantikan parentWA lama, backward compat),
  motivationNote, batch, year.
- openProfile() backward compat -> redirect ke tab profile.
- renderProfileTab() dipakai dispatcher di dashboard.js.
- Ganti PIN & save profile tetap jalan seperti sebelumnya. */

(function(){
  'use strict';

  function escP(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function normWA(v){
    if(!v) return '';
    var d=String(v).replace(/\D/g,'');
    if(d.indexOf('0')===0) d='62'+d.slice(1);
    return d;
  }

  function ensureProfile(){
    if (!PS.myProfile || PS.myProfile.id !== PS.user.id) {
      PS.myProfile = Object.assign({ id: PS.user.id }, PS.user);
    }
    return PS.myProfile;
  }

  // ===== TAB PROFILE =====
  async function renderProfileTab(){
    var wrap = document.getElementById('profileTabContent');
    if (!wrap) return;

    var p = ensureProfile();
    // Jika myProfile belum lengkap, fetch ulang
    try {
      var d = await db.collection('students').doc(PS.user.id).get();
      if (d.exists) {
        PS.myProfile = Object.assign({ id: d.id }, d.data());
        p = PS.myProfile;
      }
    } catch(e){}

    var motivasi = (p.motivationNote || '').trim();
    var motivasiHtml = motivasi
      ? '<div class="pf-motivasi">' + escP(motivasi) + '</div>'
      : '<div class="pf-motivasi pf-motivasi-empty">Belum ada catatan motivasi</div>';

    var initial = (p.name || PS.user.name || 'S').charAt(0).toUpperCase();
    var nickname = p.nickname ? '("' + escP(p.nickname) + '")' : '';

    wrap.innerHTML =
      '<div class="pf-photo-card">' +
        '<div class="pf-photo">' +
          '<span class="pf-emoji">🎓</span>' +
        '</div>' +
        '<h2 class="pf-name">' + escP(p.name || PS.user.name || '-') + ' ' + nickname + '</h2>' +
        '<div class="pf-id">ID: <strong>' + escP(PS.user.id) + '</strong></div>' +
        '<div class="pf-batch">' +
          '<span class="badge badge-info">Batch ' + escP(p.batch || PS.user.batch || '-') + '</span>' +
          ' <span class="badge badge-info">Tahun 20' + escP(p.year || PS.user.year || '-') + '</span>' +
        '</div>' +
        '<button class="btn btn-secondary btn-sm pf-edit-motivasi" onclick="editMotivasi()">' +
          '<span class="material-icons">edit_note</span>' + (motivasi ? 'Edit Motivasi' : 'Tambah Motivasi') +
        '</button>' +
        motivasiHtml +
      '</div>' +

      '<div class="pf-info-card">' +
        '<h3 class="pf-section-title"><span class="material-icons">person</span>Data Diri</h3>' +
        infoRow('badge', 'ID', PS.user.id) +
        infoRow('person', 'Nama Lengkap', p.name || '-') +
        infoRow('face', 'Nama Panggilan', p.nickname || '-') +
        infoRow('phone', 'Kontak Siswa', p.studentContact || '-') +
        infoRow('school', 'Asal Sekolah', p.school || '-') +
        infoRow('class', 'Kelas', p.className || '-') +
        infoRow('home', 'Alamat Lengkap', p.address || '-') +
      '</div>' +

      '<div class="pf-info-card">' +
        '<h3 class="pf-section-title"><span class="material-icons">family_restroom</span>Data Orang Tua</h3>' +
        infoRow('person', 'Nama Orang Tua', p.parentName || '-') +
        infoRow('phone', 'Kontak Orang Tua', p.parentContact || p.parentWA || '-') +
      '</div>' +

      '<div class="pf-actions">' +
        '<button class="btn btn-primary w-full" onclick="openEditProfile()">' +
          '<span class="material-icons">edit</span>Edit Profile' +
        '</button>' +
        '<button class="btn btn-secondary w-full" onclick="openGantiPin()">' +
          '<span class="material-icons">lock_reset</span>Ganti PIN' +
        '</button>' +
      '</div>' +

      '<div class="pf-logout-wrap">' +
        '<button class="btn btn-error w-full pf-logout-btn" onclick="doLogout()">' +
          '<span class="material-icons">logout</span>Logout' +
        '</button>' +
      '</div>';
  }

  function infoRow(icon, label, value){
    return '<div class="pf-info-row">' +
      '<div class="pf-info-label"><span class="material-icons">' + icon + '</span>' + escP(label) + '</div>' +
      '<div class="pf-info-value">' + escP(value) + '</div>' +
    '</div>';
  }

  // ===== EDIT MOTIVASI =====
  window.editMotivasi = function(){
    var p = ensureProfile();
    var cur = p.motivationNote || '';
    M.custom({
      title: 'Catatan Motivasi',
      message:
        '<p style="font-size:.8125rem;color:#64748b;margin-bottom:.5rem;">' +
        'Tuliskan motivasi / target belajar Exercise TKA Anda.</p>' +
        '<div class="form-group"><textarea class="form-control" id="pfMotivasiInput" rows="4" placeholder="Contoh: Target skor 90, konsisten tiap sesi...">' +
          escP(cur) + '</textarea></div>',
      type: 'info',
      buttons: [
        { text:'Batal', class:'btn-secondary' },
        { text:'Simpan', class:'btn-primary', action: saveMotivasi }
      ]
    });
  };

  async function saveMotivasi(){
    var txt = document.getElementById('pfMotivasiInput').value.trim();
    try {
      await db.collection('students').doc(PS.user.id).update({
        motivationNote: txt,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      if (PS.myProfile) PS.myProfile.motivationNote = txt;
      toast('Motivasi disimpan', 'success');
      renderProfileTab();
    } catch(e){
      alert2('Error', 'Gagal simpan: ' + e.message, 'error');
    }
  }

  // ===== EDIT PROFILE (modal) =====
  window.openEditProfile = async function(){
    var p = ensureProfile();
    var content =
      '<div class="form-group"><label class="form-label">Nama Lengkap</label>' +
        '<input type="text" class="form-control" id="epNama" value="' + escP(p.name || PS.user.name || '') + '"></div>' +
      '<div class="form-group"><label class="form-label">Nama Panggilan</label>' +
        '<input type="text" class="form-control" id="epNickname" value="' + escP(p.nickname || '') + '" placeholder="Contoh: Budi"></div>' +
      '<div class="form-group"><label class="form-label">Kontak Siswa</label>' +
        '<input type="tel" class="form-control" id="epContact" value="' + escP(p.studentContact || '') + '" placeholder="08xx..."></div>' +
      '<div class="form-group"><label class="form-label">Asal Sekolah</label>' +
        '<input type="text" class="form-control" id="epSchool" value="' + escP(p.school || '') + '" placeholder="SMA N 1..."></div>' +
      '<div class="form-group"><label class="form-label">Kelas</label>' +
        '<input type="text" class="form-control" id="epClass" value="' + escP(p.className || '') + '" placeholder="XII IPA 1"></div>' +
      '<div class="form-group"><label class="form-label">Alamat Lengkap</label>' +
        '<textarea class="form-control" id="epAddress" rows="2">' + escP(p.address || '') + '</textarea></div>' +
      '<hr style="margin:1rem 0;border:none;border-top:1px solid #e2e8f0;">' +
      '<h4 style="font-size:.875rem;font-weight:600;margin-bottom:.5rem;color:#2563eb;">Data Orang Tua</h4>' +
      '<div class="form-group"><label class="form-label">Nama Orang Tua</label>' +
        '<input type="text" class="form-control" id="epParentName" value="' + escP(p.parentName || '') + '"></div>' +
      '<div class="form-group"><label class="form-label">Kontak Orang Tua (WA)</label>' +
        '<input type="tel" class="form-control" id="epParentContact" value="' + escP(p.parentContact || p.parentWA || '') + '" placeholder="0812... / 62812..."></div>';

    M.custom({
      title: 'Edit Profile',
      message: content,
      type: 'info',
      buttons: [
        { text:'Batal', class:'btn-secondary' },
        { text:'Simpan', class:'btn-primary', action: saveEditProfile }
      ]
    });
  };

  async function saveEditProfile(){
    var nama = document.getElementById('epNama').value.trim();
    if (!nama) { alert2('Error','Nama wajib diisi','error'); return; }

    var upd = {
      name: nama,
      nickname: document.getElementById('epNickname').value.trim(),
      studentContact: document.getElementById('epContact').value.trim(),
      school: document.getElementById('epSchool').value.trim(),
      className: document.getElementById('epClass').value.trim(),
      address: document.getElementById('epAddress').value.trim(),
      parentName: document.getElementById('epParentName').value.trim(),
      parentContact: normWA(document.getElementById('epParentContact').value.trim()),
      parentWA: normWA(document.getElementById('epParentContact').value.trim()), // backward compat
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      await db.collection('students').doc(PS.user.id).update(upd);

      // Update state
      PS.user.name = nama;
      if (PS.myProfile) Object.assign(PS.myProfile, upd);

      // Update session
      try {
        var s = JSON.stringify(PS.user);
        sessionStorage.setItem('student_session', s);
        localStorage.setItem('student_session', s);
      } catch(e){}

      // Update header
      var n = document.getElementById('sUserName'); if (n) n.textContent = nama;

      toast('Profile disimpan', 'success');
      renderProfileTab();
    } catch(e){
      alert2('Error', 'Gagal simpan: ' + e.message, 'error');
    }
  }

  // ===== GANTI PIN =====
  window.openGantiPin = function(){
    var content =
      '<p style="font-size:.8125rem;color:#64748b;margin-bottom:.75rem;">' +
        'PIN digunakan untuk login. Pastikan PIN mudah diingat tapi sulit ditebak.' +
      '</p>' +
      '<div class="form-group"><label class="form-label">PIN Lama</label>' +
        '<input type="password" class="form-control" id="gpOld" placeholder="PIN saat ini" maxlength="6"></div>' +
      '<div class="form-group"><label class="form-label">PIN Baru (4-6 digit)</label>' +
        '<input type="password" class="form-control" id="gpNew" placeholder="PIN baru" maxlength="6"></div>' +
      '<div class="form-group"><label class="form-label">Konfirmasi PIN Baru</label>' +
        '<input type="password" class="form-control" id="gpConfirm" placeholder="Ulangi PIN baru" maxlength="6"></div>';

    M.custom({
      title: 'Ganti PIN',
      message: content,
      type: 'warning',
      buttons: [
        { text:'Batal', class:'btn-secondary' },
        { text:'Ganti PIN', class:'btn-primary', action: saveGantiPin }
      ]
    });
  };

  async function saveGantiPin(){
    var oldPin = document.getElementById('gpOld').value;
    var newPin = document.getElementById('gpNew').value;
    var confirmPin = document.getElementById('gpConfirm').value;

    if (!oldPin) { alert2('Error','PIN lama wajib diisi','error'); return; }
    if (!newPin || newPin.length < 4 || !/^\d+$/.test(newPin)) { alert2('Error','PIN baru 4-6 digit angka','error'); return; }
    if (newPin !== confirmPin) { alert2('Error','Konfirmasi PIN tidak cocok','error'); return; }

    try {
      var snap = await db.collection('students').doc(PS.user.id).get();
      if (!snap.exists) { alert2('Error','Data siswa tidak ditemukan','error'); return; }
      var valid = await verifyPin(oldPin, snap.data().pinHash);
      if (!valid) { alert2('Error','PIN lama salah','error'); return; }

      var newHash = await hashPin(newPin);
      await db.collection('students').doc(PS.user.id).update({
        pinHash: newHash,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      toast('PIN berhasil diganti', 'success');
    } catch(e){
      alert2('Error', 'Gagal ganti PIN: ' + e.message, 'error');
    }
  }

  // ===== LOGOUT =====
  window.doLogout = function(){
    confirm2('Logout', 'Keluar dari panel siswa?', function(){
      try { localStorage.removeItem('student_session'); } catch(e){}
      try { sessionStorage.removeItem('student_session'); } catch(e){}
      location.reload();
    });
  };

  // ===== BACKWARD COMPAT =====
  // openProfile() tanpa argumen -> buka tab profile
  window.openProfile = function(){
    if (window.PS && typeof PS.setTab === 'function') {
      PS.setTab('profile');
    } else {
      // Fallback: kalau PS belum siap, coba lagi
      setTimeout(function(){
        if (window.PS && typeof PS.setTab === 'function') PS.setTab('profile');
      }, 100);
    }
  };

  window.renderProfileTab = renderProfileTab;
})();