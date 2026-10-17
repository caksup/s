(function(){
  'use strict';

  function booleanValue(value){
    if (value === true || value === false) return value;
    if (value === 1 || value === '1') return true;
    if (value === 0 || value === '0') return false;
    var token = String(value == null ? '' : value).trim().toLowerCase();
    if (/^(b|benar|true|t|yes|y|ya)$/.test(token)) return true;
    if (/^(s|salah|false|f|no|n|tidak)$/.test(token)) return false;
    return null;
  }

  window.normalizeQuestionBooleanAnswers = function(value){
    if (Array.isArray(value)) {
      var result = [];
      for (var i=0;i<value.length;i++) {
        var parsed = booleanValue(value[i]);
        if (parsed === null) return null;
        result.push(parsed);
      }
      return result;
    }
    var raw = String(value == null ? '' : value).trim();
    if (!raw) return null;
    var tokens = raw.replace(/^(?:(?:j|kunci|jawaban)\s*:\s*)/i, '')
      .split(/\s*(?:[,;|/])\s*|\s+(?:dan|and)\s+/i);
    var answers = [];
    for (var j=0;j<tokens.length;j++) {
      var answer = booleanValue(tokens[j]);
      if (answer === null) return null;
      answers.push(answer);
    }
    return answers;
  };

  window.isQuestionBooleanAnswerCorrect = function(question, answer){
    if (!question || question.type !== 'PGK') return false;
    var expected = window.normalizeQuestionBooleanAnswers(question.correctAnswer);
    var actual = window.normalizeQuestionBooleanAnswers(answer);
    if (!expected || !actual || actual.length !== expected.length) return false;
    if (question.statements && expected.length !== question.statements.length) return false;
    for (var i=0;i<expected.length;i++) if (actual[i] !== expected[i]) return false;
    return true;
  };

  window.isQuestionBooleanAnswerComplete = function(question, answer){
    if (!question || question.type !== 'PGK') return false;
    var actual = window.normalizeQuestionBooleanAnswers(answer);
    return !!(actual && question.statements && actual.length === question.statements.length);
  };

  window.questionImageHtml = function(question){
    if (!question || !question.imageUrl) return '';
    var url;
    try {
      url = new URL(String(question.imageUrl).trim());
    } catch(e) {
      return '';
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    var safeUrl = url.href.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return '<div class="question-image" style="margin:.75rem 0;text-align:center;">' +
      '<img src="' + safeUrl + '" alt="Gambar soal" loading="lazy" decoding="async" style="max-width:100%;max-height:380px;object-fit:contain;border-radius:8px;">' +
      '</div>';
  };
})();
