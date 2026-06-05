/* ===== 軍事美語題型練習系統 - 核心邏輯 ===== */

/** 題數超過此值不顯示圓點導覽（避免卡頓） */
const DOTS_MAX = 60;

const DATA_FILES = [
  { file: 'data/army_vocabulary.json', key: 'vocabulary' },
  { file: 'data/army_translation.json', key: 'translation' },
];

// ===== State =====
const state = {
  banks: {},
  examMode: 'practice',
  practiceBankKey: null,
  examQuestions: [],
  currentIndex: 0,
  userAnswers: [],   // null = unanswered, 1-based index
  flagged: [],
};

// ===== DOM Refs =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  // btnSimulation 已移除
  screenHome: $('#screen-home'),
  screenExam: $('#screen-exam'),
  screenResult: $('#screen-result'),
  practiceTypeGrid: $('#practice-type-grid'),
  btnPrev: $('#btn-prev'),
  btnNext: $('#btn-next'),
  btnFlag: $('#btn-flag'),
  btnSubmitExam: $('#btn-submit-exam'),
  modalSubmit: $('#modal-submit'),
  btnCancelSubmit: $('#btn-cancel-submit'),
  btnConfirmSubmit: $('#btn-confirm-submit'),
  modalSubmitInfo: $('#modal-submit-info'),
  examCurrentNum: $('#exam-current-num'),
  examTotalNum: $('#exam-total-num'),
  examProgressFill: $('#exam-progress-fill'),
  examNav: $('.exam-nav'),
  questionCategory: $('#question-category'),
  questionType: $('#question-type'),
  questionNumber: $('#question-number'),
  questionText: $('#question-text'),
  optionsContainer: $('#options-container'),
  questionDots: $('#question-dots'),
  btnRetry: $('#btn-retry'),
  btnResultHome: $('#btn-result-home'),
};

function getExamTotal() {
  return state.examQuestions.length;
}

function isPracticeLocked(idx) {
  return state.examMode === 'practice' && state.userAnswers[idx] !== null;
}

// ===== Data Loading =====
async function loadQuestionBanks() {
  const results = await Promise.all(
    DATA_FILES.map(async ({ file, key }) => {
      const res = await fetch(file);
      const data = await res.json();
      return { key, data };
    })
  );
  results.forEach(({ key, data }) => { state.banks[key] = data; });
}

// ===== Random Sampling =====
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}



/**
 * 題型練習：單一題庫全部題目，依 id 遞增
 * @param {string} bankKey vocabulary | translation
 */
function buildPracticeSession(bankKey) {
  const bank = state.banks[bankKey];
  if (!bank || !Array.isArray(bank.questions)) {
    console.error('無效的題庫鍵：', bankKey);
    return;
  }
  state.examMode = 'practice';
  state.practiceBankKey = bankKey;
  const sorted = [...bank.questions].sort((a, b) => {
    const ida = typeof a.id === 'number' ? a.id : 0;
    const idb = typeof b.id === 'number' ? b.id : 0;
    return ida - idb;
  });
  state.examQuestions = sorted.map((q) => ({
    ...q,
    _type: bank.type,
    _category: bank.category,
  }));
  const len = state.examQuestions.length;
  state.userAnswers = new Array(len).fill(null);
  state.flagged = new Array(len).fill(false);
  state.currentIndex = 0;
}

// ===== Screen Management =====
function showScreen(screen) {
  $$('.screen').forEach((s) => s.classList.remove('active'));
  screen.classList.add('active');
  window.scrollTo(0, 0);
}

function removePracticeFeedbackEl() {
  const el = document.getElementById('practice-feedback');
  if (el) el.remove();
}

function getCorrectAnswerDisplay(q) {
  return q.options[q.answer - 1];
}

function renderPracticeFeedback(q, idx) {
  if (state.examMode !== 'practice') {
    removePracticeFeedbackEl();
    return;
  }
  const userAns = state.userAnswers[idx];
  if (userAns === null) {
    removePracticeFeedbackEl();
    return;
  }
  const isCorrect = userAns === q.answer;
  let el = document.getElementById('practice-feedback');
  if (!el) {
    el = document.createElement('div');
    el.id = 'practice-feedback';
    dom.optionsContainer.parentNode.insertBefore(el, dom.optionsContainer.nextSibling);
  }
  el.className = isCorrect
    ? 'practice-feedback practice-feedback--correct'
    : 'practice-feedback practice-feedback--wrong';

  if (isCorrect) {
    el.textContent = '答對了！';
  } else {
    const correctText = getCorrectAnswerDisplay(q);
    const expText = q.explanation ? `　解析：${q.explanation}` : '';
    el.textContent = `答錯了。正解：${correctText}${expText}`;
  }
}

// ===== Exam Rendering =====
function renderQuestion() {
  const idx = state.currentIndex;
  const q = state.examQuestions[idx];
  const total = getExamTotal();

  if (state.examMode !== 'practice') {
    removePracticeFeedbackEl();
  }

  // Header
  dom.examCurrentNum.textContent = idx + 1;
  dom.examTotalNum.textContent = total;
  dom.examProgressFill.style.width = `${((idx + 1) / total) * 100}%`;

  // Meta badges
  dom.questionCategory.textContent = q._category;
  dom.questionCategory.className = 'question-category-badge' +
    (q._category === '英翻中' ? ' mechanical' : '');
  dom.questionType.textContent = '選擇題';
  const questionIdText = typeof q.id === 'number' ? `（題庫 ID: ${q.id}）` : '';
  dom.questionNumber.textContent = `第 ${idx + 1} 題 ${questionIdText}`;

  // Question text
  dom.questionText.textContent = q.question;

  // No image support needed for this bank
  let imgContainer = $('#question-image-container');
  if (!imgContainer) {
    imgContainer = document.createElement('div');
    imgContainer.id = 'question-image-container';
    dom.questionText.parentNode.appendChild(imgContainer);
  }
  imgContainer.innerHTML = '';
  imgContainer.style.display = 'none';

  // Options
  dom.optionsContainer.innerHTML = '';
  renderMultipleChoiceOptions(q, idx);

  renderPracticeFeedback(q, idx);

  // Navigation
  dom.btnPrev.disabled = idx === 0;
  if (idx < total - 1) {
    dom.btnNext.innerHTML = '下一題 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg>';
  } else {
    dom.btnNext.innerHTML = '交卷 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>';
  }

  // Flag
  dom.btnFlag.classList.toggle('flagged', state.flagged[idx]);

  // Dots
  if (dom.examNav) {
    dom.examNav.classList.toggle('exam-nav--no-dots', total > DOTS_MAX);
  }
  if (total <= DOTS_MAX) {
    renderDots();
  } else {
    dom.questionDots.innerHTML = '';
  }
}

function renderMultipleChoiceOptions(q, idx) {
  const locked = isPracticeLocked(idx);
  const userAns = state.userAnswers[idx];
  const labels = ['A', 'B', 'C', 'D'];
  q.options.forEach((opt, i) => {
    const answerValue = i + 1;
    const btn = document.createElement('button');
    let revealClass = '';
    if (locked) {
      const isCorrectOpt = answerValue === q.answer;
      const isUserPick = userAns === answerValue;
      if (isCorrectOpt) revealClass = ' option-reveal-correct';
      else if (isUserPick) revealClass = ' option-reveal-wrong';
      else revealClass = ' option-reveal-neutral';
    }
    btn.type = 'button';
    btn.className = 'option-btn' + (userAns === answerValue ? ' selected' : '') + revealClass;
    btn.innerHTML = `
      <span class="option-label">${labels[i]}</span>
      <span class="option-text">${opt}</span>
    `;
    if (locked) {
      btn.disabled = true;
    } else {
      btn.addEventListener('click', () => {
        state.userAnswers[idx] = answerValue;
        renderQuestion();
      });
    }
    dom.optionsContainer.appendChild(btn);
  });
}

function renderDots() {
  dom.questionDots.innerHTML = '';
  state.examQuestions.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'q-dot';
    if (i === state.currentIndex) dot.classList.add('current');
    if (state.userAnswers[i] !== null) dot.classList.add('answered');
    if (state.flagged[i]) dot.classList.add('flagged');
    dot.addEventListener('click', () => {
      state.currentIndex = i;
      renderQuestion();
    });
    dom.questionDots.appendChild(dot);
  });
}

// ===== Scoring =====
function calculateResults() {
  let correct = 0;
  let wrong = 0;
  let unanswered = 0;

  const categories = {
    '字彙選擇題': { correct: 0, total: 0 },
    '英翻中選擇題': { correct: 0, total: 0 },
  };

  const reviewData = state.examQuestions.map((q, i) => {
    const userAns = state.userAnswers[i];
    const catKey = q._category + '選擇題';
    if (categories[catKey]) categories[catKey].total++;

    const isCorrect = userAns === q.answer;
    const correctAnswerText = q.options[q.answer - 1];
    const userAnswerText = userAns === null ? '未作答' : q.options[userAns - 1];

    if (userAns === null) {
      unanswered++;
    } else if (isCorrect) {
      correct++;
      if (categories[catKey]) categories[catKey].correct++;
    } else {
      wrong++;
    }

    return {
      index: i,
      questionId: typeof q.id === 'number' ? q.id : null,
      question: q.question,
      isCorrect,
      userAns,
      userAnswerText,
      correctAnswerText,
      explanation: q.explanation || null,
      category: q._category,
      unanswered: userAns === null,
    };
  });

  const total = state.examQuestions.length;
  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;

  return {
    displayScore: scorePercent,
    scoreUnit: '%',
    correct,
    wrong,
    unanswered,
    categories,
    reviewData,
    totalQuestions: total,
  };
}

// ===== Result Rendering =====
function renderResult(results) {
  const {
    displayScore,
    scoreUnit,
    correct,
    wrong,
    unanswered,
    categories,
    reviewData,
  } = results;

  // Icon & verdict（純練習模式）
  const iconEl = $('#result-icon');
  const verdictEl = $('#result-verdict');
  iconEl.className = 'result-icon practice';
  iconEl.textContent = '\u2714';
  verdictEl.className = 'result-verdict practice';
  verdictEl.textContent = '練習完成';

  // Score
  $('#result-score').textContent = displayScore;
  const unitEl = $('.result-score-unit');
  if (unitEl) unitEl.textContent = scoreUnit;
  $('#result-correct').textContent = correct;
  $('#result-wrong').textContent = wrong;
  $('#result-unanswered').textContent = unanswered;

  // Category breakdown
  const catContainer = $('#result-categories');
  catContainer.innerHTML = '';
  const breakdownTitle = $('.result-breakdown h2');
  if (breakdownTitle) breakdownTitle.textContent = '本次練習';

  const catEntries = Object.entries(categories).filter(([, data]) => data.total > 0);
  catEntries.forEach(([name, data]) => {
    const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
    const div = document.createElement('div');
    div.className = 'cat-bar-item';
    div.innerHTML = `
      <div class="cat-bar-label">
        <span class="cat-bar-name">${name}</span>
        <span class="cat-bar-value">${data.correct}/${data.total} (${pct}%)</span>
      </div>
      <div class="cat-bar-track">
        <div class="cat-bar-fill ${pct < 60 ? 'low' : ''}" style="width:0%"></div>
      </div>
    `;
    catContainer.appendChild(div);
    requestAnimationFrame(() => {
      setTimeout(() => {
        div.querySelector('.cat-bar-fill').style.width = pct + '%';
      }, 100);
    });
  });

  // Review list
  const reviewList = $('#review-list');
  reviewList.innerHTML = '';
  reviewData.forEach((r) => {
    const statusClass = r.unanswered ? 'unanswered-answer' : (r.isCorrect ? '' : 'wrong-answer');
    const badgeClass = r.unanswered ? 'unanswered' : (r.isCorrect ? 'correct' : 'wrong');
    const badgeText = r.unanswered ? '未作答' : (r.isCorrect ? '正確' : '錯誤');

    let answersHTML = '';
    if (!r.isCorrect) {
      answersHTML = `<div class="review-answers">`;
      if (!r.unanswered) {
        answersHTML += `<span class="user-ans">你的答案：${r.userAnswerText}</span>`;
      }
      answersHTML += `<span class="correct-ans">正確答案：${r.correctAnswerText}</span></div>`;
    }

    let explanationHTML = '';
    if (r.explanation && !r.isCorrect) {
      explanationHTML = `<div class="review-explanation">解析：${r.explanation}</div>`;
    }

    const div = document.createElement('div');
    div.className = `review-item ${statusClass}`;
    const reviewIdText = r.questionId !== null ? `（ID: ${r.questionId}）` : '';
    div.innerHTML = `
      <div class="review-item-header">
        <span class="review-num">#${r.index + 1} ${reviewIdText}</span>
        <span class="review-result-badge ${badgeClass}">${badgeText}</span>
      </div>
      <div class="review-question">${r.question}</div>
      ${answersHTML}
      ${explanationHTML}
    `;
    reviewList.appendChild(div);
  });
}

// ===== Submit Flow =====
function showSubmitModal() {
  const total = getExamTotal();
  const unanswered = state.userAnswers.filter((a) => a === null).length;
  const flaggedCount = state.flagged.filter(Boolean).length;

  let msg = `共 ${total} 題，已作答 ${total - unanswered} 題。`;
  if (unanswered > 0) msg += `\n尚有 ${unanswered} 題未作答，未作答將以零分計算。`;
  if (flaggedCount > 0) msg += `\n有 ${flaggedCount} 題已標記待檢查。`;
  msg += '\n\n確定要交卷嗎？';

  dom.modalSubmitInfo.textContent = msg;
  dom.modalSubmitInfo.style.whiteSpace = 'pre-line';
  dom.modalSubmit.classList.add('active');
}

function submitExam() {
  dom.modalSubmit.classList.remove('active');
  const results = calculateResults();
  renderResult(results);
  showScreen(dom.screenResult);
}

// ===== Event Binding =====
function bindEvents() {

  if (dom.practiceTypeGrid) {
    dom.practiceTypeGrid.addEventListener('click', (e) => {
      const t = e.target.closest('[data-practice-bank]');
      if (!t || t.disabled) return;
      buildPracticeSession(t.dataset.practiceBank);
      showScreen(dom.screenExam);
      renderQuestion();
    });
  }

  dom.btnPrev.addEventListener('click', () => {
    if (state.currentIndex > 0) {
      state.currentIndex--;
      renderQuestion();
    }
  });

  dom.btnNext.addEventListener('click', () => {
    const total = getExamTotal();
    if (state.currentIndex < total - 1) {
      state.currentIndex++;
      renderQuestion();
    } else {
      showSubmitModal();
    }
  });

  dom.btnFlag.addEventListener('click', () => {
    state.flagged[state.currentIndex] = !state.flagged[state.currentIndex];
    dom.btnFlag.classList.toggle('flagged', state.flagged[state.currentIndex]);
    if (getExamTotal() <= DOTS_MAX) renderDots();
  });

  dom.btnSubmitExam.addEventListener('click', showSubmitModal);
  dom.btnCancelSubmit.addEventListener('click', () => {
    dom.modalSubmit.classList.remove('active');
  });
  dom.btnConfirmSubmit.addEventListener('click', submitExam);

  dom.btnRetry.addEventListener('click', () => {
    if (state.practiceBankKey) {
      buildPracticeSession(state.practiceBankKey);
      showScreen(dom.screenExam);
      renderQuestion();
    } else {
      showScreen(dom.screenHome);
    }
  });

  if (dom.btnResultHome) {
    dom.btnResultHome.addEventListener('click', () => {
      removePracticeFeedbackEl();
      showScreen(dom.screenHome);
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (!dom.screenExam.classList.contains('active')) return;
    if (dom.modalSubmit.classList.contains('active')) return;

    if (e.key === 'ArrowRight' || e.key === 'n') dom.btnNext.click();
    if (e.key === 'ArrowLeft' || e.key === 'p') dom.btnPrev.click();
    if (e.key === 'f') dom.btnFlag.click();

    if (isPracticeLocked(state.currentIndex)) return;

    const q = state.examQuestions[state.currentIndex];
    if (!q) return;
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= q.options.length) {
      state.userAnswers[state.currentIndex] = num;
      renderQuestion();
    }
  });
}

function enableHomeButtons() {
  $$('.btn-practice-type').forEach((btn) => { btn.disabled = false; });
}

// ===== Init =====
async function init() {
  bindEvents();
  try {
    await loadQuestionBanks();
    enableHomeButtons();
  } catch (err) {
    console.error('Failed to load question banks:', err);
    $$('.btn-practice-type').forEach((btn) => {
      btn.textContent = '題庫載入失敗';
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
