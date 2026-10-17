/* #23 | /root/js/s/state.js | v 2.2 | u 10/09/2026 • 08:15:00 | xu : ke-4 | note : #noteresponse
- TAMBAH: window.showScreen(name) -> PUSAT KONTROL visibilitas 4 layar utama
  (loginScreen, studentApp, testPage, resultPage).
  * Selalu menyembunyikan ketiga layar lain, lalu menampilkan satu layar tujuan.
  * Valid name: 'login' | 'app' | 'test' | 'result'.
  * Dipakai oleh semua transisi (showDashboard, showTestPage, showHomeworkPage,
    showResult, backToDashboard, exitHomework, retryHomeworkNow, showDashboard/safetyNet).
  * Ini menutup bug "dua layar block bersamaan" (studentApp + testPage block
    bersamaan = soal retry nongkrong di bawah semua menu).
- TETAP (tidak dipotong dari v2.1): defaults PS, showTabPage, highlightBnNav,
  setTab, refreshProfile, console.log boot. */

(function(){
  'use strict';
  var defaults = {
    user: null,
    sessions: [],
    questions: [],
    currentSession: null,
    answers: {},
    flagged: new Set(),
    currentIndex: 0,
    timeRemaining: 0,
    timer: null,
    startTime: null,
    tabSwitch: 0,
    blur: 0,
    antiLog: [],
    settings: { antiCheatEnabled: true, maxTabSwitches: 3 },
    attemptId: null,
    myAttempts: [],

    activeTab: 'home',
    myProfile: null,
    myValues: []
  };

  window.PS = window.PS || {};
  Object.keys(defaults).forEach(function(k){
    if (window.PS[k] === undefined) window.PS[k] = defaults[k];
  });

  // ===== PUSAT KONTROL LAYAR (baru) =====
  // name: 'login' | 'app' | 'test' | 'result' | 'assessment'
  // Selalu menyembunyikan 3 layar lain, menampilkan 1 layar tujuan.
  window.showScreen = function(name){
    var map = {
      login:  'loginScreen',
      app:    'studentApp',
      test:   'testPage',
      result: 'resultPage',
      assessment: 'assessmentPage'
    };
    var targetId = map[name];
    if (!targetId) {
      console.warn('[PS] showScreen: nama tidak valid ->', name);
      return;
    }
    Object.keys(map).forEach(function(k){
      var el = document.getElementById(map[k]);
      if (!el) return;
      el.style.display = (k === name) ? 'block' : 'none';
    });
    // Header studentApp disembunyikan kecuali di layar app
    var hdr = document.getElementById('sHeader');
    if (hdr) hdr.style.display = (name === 'app') ? 'flex' : 'none';
  };

  // ===== Helper: tampilkan container tab-page (tetap) =====
  window.showTabPage = function(name){
    document.querySelectorAll('.tab-page').forEach(function(el){
      if (el.id === 'page-' + name) el.classList.add('active');
      else el.classList.remove('active');
    });
  };

  // ===== Helper: highlight bottom nav (tetap) =====
  window.highlightBnNav = function(name){
    document.querySelectorAll('.bn-item').forEach(function(el){
      if (el.dataset.tab === name) el.classList.add('active');
      else el.classList.remove('active');
    });
  };

  // ===== Ganti tab (tetap) =====
  window.PS.setTab = function(name){
    var valid = ['home','riwayat','nilai','feedback','profile'];
    if (valid.indexOf(name) === -1) return;
    PS.activeTab = name;
    if (window.showTabPage) window.showTabPage(name);
    if (window.highlightBnNav) window.highlightBnNav(name);
    if (window.renderStudentTab) window.renderStudentTab(name);
  };

  // ===== Reload snapshot profil (tetap) =====
  window.PS.refreshProfile = function(){
    if (!PS.user || !PS.user.id) return Promise.resolve();
    return db.collection('students').doc(PS.user.id).get().then(function(d){
      if (d.exists) {
        PS.myProfile = Object.assign({id:d.id}, d.data());
        if (window.renderProfileTab) window.renderProfileTab();
      }
    });
  };

  console.log('✅ s/state.js v2.2 loaded — showScreen/showTabPage/highlightBnNav siap');
})();