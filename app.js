/* ===== 駕照模擬考試系統 - 核心邏輯 ===== */

const EXAM_CONFIG = {
  questionsPerType: 10,
  totalQuestions: 40,
  pointsPerQuestion: 2.5,
  passingScore: 95,
};

const DATA_FILES = [
  { file: 'data/traffic_true_false.json', key: 'trafficTF' },
  { file: 'data/traffic_multiple_choice.json', key: 'trafficMC' },
  { file: 'data/mechanical_true_false.json', key: 'mechanicalTF' },
  { file: 'data/mechanical_multiple_choice.json', key: 'mechanicalMC' },
];

// ===== State =====
const state = {
  banks: {},
  examQuestions: [],
  currentIndex: 0,
  userAnswers: [],   // null = unanswered, for TF: true/false, for MC: 1-based index
  flagged: [],
};

// ===== DOM Refs =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  screenHome: $('#screen-home'),
  screenExam: $('#screen-exam'),
  screenResult: $('#screen-result'),
  btnStart: $('#btn-start'),
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
  questionCategory: $('#question-category'),
  questionType: $('#question-type'),
  questionNumber: $('#question-number'),
  questionText: $('#question-text'),
  optionsContainer: $('#options-container'),
  questionDots: $('#question-dots'),
  btnRetry: $('#btn-retry'),
};

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

function sampleQuestions(bank, count) {
  const shuffled = shuffleArray(bank.questions);
  return shuffled.slice(0, count).map((q) => ({
    ...q,
    _type: bank.type,
    _category: bank.category,
  }));
}

function generateExam() {
  const n = EXAM_CONFIG.questionsPerType;
  const parts = [
    sampleQuestions(state.banks.trafficTF, n),
    sampleQuestions(state.banks.trafficMC, n),
    sampleQuestions(state.banks.mechanicalTF, n),
    sampleQuestions(state.banks.mechanicalMC, n),
  ];
  state.examQuestions = shuffleArray(parts.flat());
  state.userAnswers = new Array(EXAM_CONFIG.totalQuestions).fill(null);
  state.flagged = new Array(EXAM_CONFIG.totalQuestions).fill(false);
  state.currentIndex = 0;
}

// ===== Screen Management =====
function showScreen(screen) {
  $$('.screen').forEach((s) => s.classList.remove('active'));
  screen.classList.add('active');
  window.scrollTo(0, 0);
}

// ===== Exam Rendering =====
function renderQuestion() {
  const idx = state.currentIndex;
  const q = state.examQuestions[idx];
  const total = EXAM_CONFIG.totalQuestions;

  // Header
  dom.examCurrentNum.textContent = idx + 1;
  dom.examTotalNum.textContent = total;
  dom.examProgressFill.style.width = `${((idx + 1) / total) * 100}%`;

  // Meta badges
  dom.questionCategory.textContent = q._category;
  dom.questionCategory.className = 'question-category-badge' +
    (q._category === '機械常識' ? ' mechanical' : '');
  dom.questionType.textContent = q._type === 'trueFalse' ? '是非題' : '選擇題';
  dom.questionNumber.textContent = `第 ${idx + 1} 題`;

  // Question text
  dom.questionText.textContent = q.question;

  // Options
  dom.optionsContainer.innerHTML = '';
  if (q._type === 'trueFalse') {
    renderTrueFalseOptions(q, idx);
  } else {
    renderMultipleChoiceOptions(q, idx);
  }

  // Navigation
  dom.btnPrev.disabled = idx === 0;
  dom.btnNext.textContent = idx === total - 1 ? '交卷' : '';
  if (idx < total - 1) {
    dom.btnNext.innerHTML = '下一題 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg>';
  } else {
    dom.btnNext.innerHTML = '交卷 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>';
  }

  // Flag
  dom.btnFlag.classList.toggle('flagged', state.flagged[idx]);

  // Dots
  renderDots();
}

function renderTrueFalseOptions(q, idx) {
  const options = [
    { label: 'O', value: true, text: '正確 (O)' },
    { label: 'X', value: false, text: '錯誤 (X)' },
  ];
  options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn' + (state.userAnswers[idx] === opt.value ? ' selected' : '');
    btn.innerHTML = `
      <span class="option-label">${opt.label}</span>
      <span class="option-text">${opt.text}</span>
    `;
    btn.addEventListener('click', () => {
      state.userAnswers[idx] = opt.value;
      renderQuestion();
    });
    dom.optionsContainer.appendChild(btn);
  });
}

function renderMultipleChoiceOptions(q, idx) {
  const labels = ['A', 'B', 'C', 'D'];
  q.options.forEach((opt, i) => {
    const answerValue = i + 1;
    const btn = document.createElement('button');
    btn.className = 'option-btn' + (state.userAnswers[idx] === answerValue ? ' selected' : '');
    btn.innerHTML = `
      <span class="option-label">${labels[i]}</span>
      <span class="option-text">${opt}</span>
    `;
    btn.addEventListener('click', () => {
      state.userAnswers[idx] = answerValue;
      renderQuestion();
    });
    dom.optionsContainer.appendChild(btn);
  });
}

function renderDots() {
  dom.questionDots.innerHTML = '';
  state.examQuestions.forEach((_, i) => {
    const dot = document.createElement('button');
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
    '交通法規是非題': { correct: 0, total: 0 },
    '交通法規選擇題': { correct: 0, total: 0 },
    '機械常識是非題': { correct: 0, total: 0 },
    '機械常識選擇題': { correct: 0, total: 0 },
  };

  const reviewData = state.examQuestions.map((q, i) => {
    const userAns = state.userAnswers[i];
    const catKey = q._category + (q._type === 'trueFalse' ? '是非題' : '選擇題');
    categories[catKey].total++;

    let isCorrect = false;
    let correctAnswerText = '';
    let userAnswerText = '';

    if (q._type === 'trueFalse') {
      isCorrect = userAns === q.answer;
      correctAnswerText = q.answer ? '正確 (O)' : '錯誤 (X)';
      userAnswerText = userAns === null ? '未作答' : (userAns ? '正確 (O)' : '錯誤 (X)');
    } else {
      isCorrect = userAns === q.answer;
      correctAnswerText = q.options[q.answer - 1];
      userAnswerText = userAns === null ? '未作答' : q.options[userAns - 1];
    }

    if (userAns === null) {
      unanswered++;
    } else if (isCorrect) {
      correct++;
      categories[catKey].correct++;
    } else {
      wrong++;
    }

    // Filter out "O" as explanation (artifact from xlsx parsing)
    let explanation = q.explanation;
    if (explanation === 'O' || explanation === 'o') explanation = null;

    return {
      index: i,
      question: q.question,
      isCorrect,
      userAns,
      userAnswerText,
      correctAnswerText,
      explanation,
      category: q._category,
      type: q._type,
      unanswered: userAns === null,
    };
  });

  const score = correct * EXAM_CONFIG.pointsPerQuestion;
  const passed = score >= EXAM_CONFIG.passingScore;

  return { score, correct, wrong, unanswered, passed, categories, reviewData };
}

// ===== Result Rendering =====
function renderResult(results) {
  const { score, correct, wrong, unanswered, passed, categories, reviewData } = results;

  // Icon & verdict
  const iconEl = $('#result-icon');
  const verdictEl = $('#result-verdict');
  iconEl.className = 'result-icon ' + (passed ? 'pass' : 'fail');
  iconEl.textContent = passed ? '\u2714' : '\u2718';
  verdictEl.className = 'result-verdict ' + (passed ? 'pass' : 'fail');
  verdictEl.textContent = passed ? '恭喜通過！' : '未達及格標準';

  // Score
  $('#result-score').textContent = score;
  $('#result-correct').textContent = correct;
  $('#result-wrong').textContent = wrong;
  $('#result-unanswered').textContent = unanswered;

  // Category breakdown
  const catContainer = $('#result-categories');
  catContainer.innerHTML = '';
  Object.entries(categories).forEach(([name, data]) => {
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
    // Animate bar
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
    div.innerHTML = `
      <div class="review-item-header">
        <span class="review-num">#${r.index + 1}</span>
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
  const unanswered = state.userAnswers.filter((a) => a === null).length;
  const flaggedCount = state.flagged.filter(Boolean).length;

  let msg = `共 ${EXAM_CONFIG.totalQuestions} 題，已作答 ${EXAM_CONFIG.totalQuestions - unanswered} 題。`;
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
  dom.btnStart.addEventListener('click', () => {
    generateExam();
    showScreen(dom.screenExam);
    renderQuestion();
  });

  dom.btnPrev.addEventListener('click', () => {
    if (state.currentIndex > 0) {
      state.currentIndex--;
      renderQuestion();
    }
  });

  dom.btnNext.addEventListener('click', () => {
    if (state.currentIndex < EXAM_CONFIG.totalQuestions - 1) {
      state.currentIndex++;
      renderQuestion();
    } else {
      showSubmitModal();
    }
  });

  dom.btnFlag.addEventListener('click', () => {
    state.flagged[state.currentIndex] = !state.flagged[state.currentIndex];
    dom.btnFlag.classList.toggle('flagged', state.flagged[state.currentIndex]);
    renderDots();
  });

  dom.btnSubmitExam.addEventListener('click', showSubmitModal);
  dom.btnCancelSubmit.addEventListener('click', () => {
    dom.modalSubmit.classList.remove('active');
  });
  dom.btnConfirmSubmit.addEventListener('click', submitExam);

  dom.btnRetry.addEventListener('click', () => {
    generateExam();
    showScreen(dom.screenExam);
    renderQuestion();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (!dom.screenExam.classList.contains('active')) return;
    if (dom.modalSubmit.classList.contains('active')) return;

    if (e.key === 'ArrowRight' || e.key === 'n') dom.btnNext.click();
    if (e.key === 'ArrowLeft' || e.key === 'p') dom.btnPrev.click();
    if (e.key === 'f') dom.btnFlag.click();

    const q = state.examQuestions[state.currentIndex];
    if (q._type === 'trueFalse') {
      if (e.key === '1' || e.key === 'o') {
        state.userAnswers[state.currentIndex] = true;
        renderQuestion();
      }
      if (e.key === '2' || e.key === 'x') {
        state.userAnswers[state.currentIndex] = false;
        renderQuestion();
      }
    } else {
      const num = parseInt(e.key);
      if (num >= 1 && num <= q.options.length) {
        state.userAnswers[state.currentIndex] = num;
        renderQuestion();
      }
    }
  });
}

// ===== Init =====
async function init() {
  bindEvents();
  try {
    await loadQuestionBanks();
    dom.btnStart.disabled = false;
    dom.btnStart.querySelector('.btn-text').textContent = '開始測驗';
  } catch (err) {
    dom.btnStart.querySelector('.btn-text').textContent = '題庫載入失敗';
    console.error('Failed to load question banks:', err);
  }
}

document.addEventListener('DOMContentLoaded', init);
