/* ===== 綜合模擬考試系統 - 核心邏輯 ===== */

const EXAM_CONFIG = {
  traffic: {
    questionsPerType: 10, // 4 types * 10 = 40
    totalQuestions: 40,
    pointsPerQuestion: 2.5,
    passingScore: 95,
  },
  army: {
    questionsPerType: 20, // 2 types * 20 = 40
    totalQuestions: 40,
    pointsPerQuestion: 2.5,
    passingScore: 85,
  }
};

/** 題數超過此值不顯示圓點導覽（避免卡頓） */
const DOTS_MAX = 60;

const DATA_FILES = [
  // 大車題庫
  { file: 'data/traffic_true_false.json', key: 'trafficTF' },
  { file: 'data/traffic_multiple_choice.json', key: 'trafficMC' },
  { file: 'data/mechanical_true_false.json', key: 'mechanicalTF' },
  { file: 'data/mechanical_multiple_choice.json', key: 'mechanicalMC' },
  // 軍事美語題庫
  { file: 'data/army_vocabulary.json', key: 'vocabulary' },
  { file: 'data/army_translation.json', key: 'translation' },
];

// ===== State =====
const state = {
  banks: {},
  examMode: 'simulation', // 'simulation' | 'practice'
  examType: 'traffic', // 'traffic' | 'army'
  practiceBankKey: null,
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
  btnSimulationTraffic: $('#btn-simulation-traffic'),
  btnSimulationArmy: $('#btn-simulation-army'),
  practiceTypeGridTraffic: $('#practice-type-grid-traffic'),
  practiceTypeGridArmy: $('#practice-type-grid-army'),
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

function randomPick(arr) {
  if (!arr || arr.length === 0) return null;
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
}

function sampleByIdWindows(questions, windows, count) {
  const selected = [];
  const usedIds = new Set();

  windows.forEach(([startId, endId]) => {
    const candidates = questions.filter((q) => (
      typeof q.id === 'number'
      && q.id >= startId
      && q.id <= endId
      && !usedIds.has(q.id)
    ));
    const picked = randomPick(candidates);
    if (picked) {
      selected.push(picked);
      usedIds.add(picked.id);
    } else {
      console.warn(`無可用題目可抽：id ${startId}-${endId}`);
    }
  });

  if (selected.length < count) {
    const remaining = shuffleArray(
      questions.filter((q) => !usedIds.has(q.id))
    );
    selected.push(...remaining.slice(0, count - selected.length));
  }

  return selected.slice(0, count);
}

function buildTrafficWindows() {
  const windows = [];
  for (let start = 1; start <= 201; start += 25) {
    windows.push([start, start + 24]);
  }
  windows.push([226, 250]);
  return windows;
}

function buildMechanicalWindows() {
  const windows = [];
  for (let start = 1; start <= 97; start += 12) {
    windows.push([start, start + 11]);
  }
  windows.push([109, 125]);
  return windows;
}

function sampleQuestions(bank, count) {
  const hasValidIds = bank.questions.every((q) => typeof q.id === 'number');
  let selected = [];

  if (!hasValidIds) {
    selected = shuffleArray(bank.questions).slice(0, count);
  } else if (bank.category === '交通法規') {
    selected = sampleByIdWindows(bank.questions, buildTrafficWindows(), count);
  } else if (bank.category === '機械常識') {
    selected = sampleByIdWindows(bank.questions, buildMechanicalWindows(), count);
  } else {
    selected = shuffleArray(bank.questions).slice(0, count);
  }

  return shuffleArray(selected).map((q) => ({
    ...q,
    _type: bank.type,
    _category: bank.category,
  }));
}

function generateExam(type) {
  state.examMode = 'simulation';
  state.examType = type;
  state.practiceBankKey = null;
  
  const config = EXAM_CONFIG[type];
  const n = config.questionsPerType;
  let parts = [];

  if (type === 'traffic') {
    parts = [
      sampleQuestions(state.banks.trafficTF, n),
      sampleQuestions(state.banks.trafficMC, n),
      sampleQuestions(state.banks.mechanicalTF, n),
      sampleQuestions(state.banks.mechanicalMC, n),
    ];
  } else if (type === 'army') {
    parts = [
      sampleQuestions(state.banks.vocabulary, n),
      sampleQuestions(state.banks.translation, n),
    ];
  }

  state.examQuestions = parts.flat();
  state.userAnswers = new Array(config.totalQuestions).fill(null);
  state.flagged = new Array(config.totalQuestions).fill(false);
  state.currentIndex = 0;
}

/**
 * 題型練習：單一題庫全部題目，依 id 遞增
 */
function buildPracticeSession(bankKey, examType) {
  const bank = state.banks[bankKey];
  if (!bank || !Array.isArray(bank.questions)) {
    console.error('無效的題庫鍵：', bankKey);
    return;
  }
  state.examMode = 'practice';
  state.examType = examType;
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
  if (q._type === 'trueFalse') return q.answer ? '正確 (O)' : '錯誤 (X)';
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
  el.textContent = isCorrect
    ? '答對了！'
    : `答錯了。正解：${getCorrectAnswerDisplay(q)}`;
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
  
  let categoryClass = 'question-category-badge';
  if (q._category === '機械常識' || q._category === '英翻中') categoryClass += ' mechanical';
  dom.questionCategory.className = categoryClass;
  
  dom.questionType.textContent = q._type === 'trueFalse' ? '是非題' : '選擇題';
  const questionIdText = typeof q.id === 'number' ? `（題庫ID: ${q.id}）` : '';
  dom.questionNumber.textContent = `第 ${idx + 1} 題 ${questionIdText}`;

  // Question text（去除 [圖示] 前綴，圖片另外顯示）
  const displayText = q.question.replace(/^\[圖示\]\s*/, '');
  dom.questionText.textContent = displayText;

  // Question image
  let imgContainer = $('#question-image-container');
  if (!imgContainer) {
    imgContainer = document.createElement('div');
    imgContainer.id = 'question-image-container';
    dom.questionText.parentNode.appendChild(imgContainer);
  }
  if (q.imagePath) {
    imgContainer.innerHTML = `<img src="${q.imagePath}" alt="題目圖示" class="question-sign-img" onerror="this.parentNode.style.display='none'">`;
    imgContainer.style.display = 'flex';
  } else {
    imgContainer.innerHTML = '';
    imgContainer.style.display = 'none';
  }

  // Options
  dom.optionsContainer.innerHTML = '';
  if (q._type === 'trueFalse') {
    renderTrueFalseOptions(q, idx);
  } else {
    renderMultipleChoiceOptions(q, idx);
  }

  renderPracticeFeedback(q, idx);

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

  // Dots：題數多時隱藏
  if (dom.examNav) {
    dom.examNav.classList.toggle('exam-nav--no-dots', total > DOTS_MAX);
  }
  if (total <= DOTS_MAX) {
    renderDots();
  } else {
    dom.questionDots.innerHTML = '';
  }
}

function renderTrueFalseOptions(q, idx) {
  const locked = isPracticeLocked(idx);
  const userAns = state.userAnswers[idx];
  const options = [
    { label: 'O', value: true, text: '正確 (O)' },
    { label: 'X', value: false, text: '錯誤 (X)' },
  ];
  options.forEach((opt) => {
    const btn = document.createElement('button');
    let revealClass = '';
    if (locked) {
      const isCorrectOpt = opt.value === q.answer;
      const isUserPick = userAns === opt.value;
      if (isCorrectOpt) revealClass = ' option-reveal-correct';
      else if (isUserPick) revealClass = ' option-reveal-wrong';
      else revealClass = ' option-reveal-neutral';
    }
    btn.type = 'button';
    btn.className = 'option-btn' + (userAns === opt.value ? ' selected' : '') + revealClass;
    btn.innerHTML = `
      <span class="option-label">${opt.label}</span>
      <span class="option-text">${opt.text}</span>
    `;
    if (locked) {
      btn.disabled = true;
    } else {
      btn.addEventListener('click', () => {
        state.userAnswers[idx] = opt.value;
        renderQuestion();
      });
    }
    dom.optionsContainer.appendChild(btn);
  });
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

  const categories = {};

  const reviewData = state.examQuestions.map((q, i) => {
    const userAns = state.userAnswers[i];
    const catKey = q._category + (q._type === 'trueFalse' ? '是非題' : '選擇題');
    
    if (!categories[catKey]) categories[catKey] = { correct: 0, total: 0 };
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
      questionId: typeof q.id === 'number' ? q.id : null,
      question: q.question,
      imagePath: q.imagePath || null,
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

  const config = EXAM_CONFIG[state.examType];
  const total = state.examQuestions.length;
  const isPractice = state.examMode === 'practice';
  const scorePoints = correct * config.pointsPerQuestion;
  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const passed = !isPractice && scorePoints >= config.passingScore;

  return {
    isPractice,
    displayScore: isPractice ? scorePercent : scorePoints,
    scoreUnit: isPractice ? '%' : '分',
    score: isPractice ? scorePercent : scorePoints,
    correct,
    wrong,
    unanswered,
    passed,
    categories,
    reviewData,
    totalQuestions: total,
  };
}

// ===== Result Rendering =====
function renderResult(results) {
  const {
    isPractice,
    displayScore,
    scoreUnit,
    correct,
    wrong,
    unanswered,
    passed,
    categories,
    reviewData,
  } = results;

  // Icon & verdict
  const iconEl = $('#result-icon');
  const verdictEl = $('#result-verdict');
  if (isPractice) {
    iconEl.className = 'result-icon practice';
    iconEl.textContent = '\u2714';
    verdictEl.className = 'result-verdict practice';
    verdictEl.textContent = '練習完成';
  } else {
    iconEl.className = 'result-icon ' + (passed ? 'pass' : 'fail');
    iconEl.textContent = passed ? '\u2714' : '\u2718';
    verdictEl.className = 'result-verdict ' + (passed ? 'pass' : 'fail');
    verdictEl.textContent = passed ? '恭喜通過！' : '未達及格標準';
  }

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
  if (breakdownTitle) {
    breakdownTitle.textContent = isPractice ? '本次練習' : '題型分析';
  }

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

    const reviewQuestion = r.question.replace(/^\[圖示\]\s*/, '');
    const reviewImgHTML = r.imagePath
      ? `<div class="review-sign-img-wrap"><img src="${r.imagePath}" alt="題目圖示" class="review-sign-img" onerror="this.parentNode.style.display='none'"></div>`
      : '';

    const div = document.createElement('div');
    div.className = `review-item ${statusClass}`;
    const reviewIdText = r.questionId !== null ? `（ID: ${r.questionId}）` : '';
    div.innerHTML = `
      <div class="review-item-header">
        <span class="review-num">#${r.index + 1} ${reviewIdText}</span>
        <span class="review-result-badge ${badgeClass}">${badgeText}</span>
      </div>
      ${reviewImgHTML}
      <div class="review-question">${reviewQuestion}</div>
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
  // 大車模擬考
  dom.btnSimulationTraffic.addEventListener('click', () => {
    generateExam('traffic');
    showScreen(dom.screenExam);
    renderQuestion();
  });

  // 軍事美語模擬考
  dom.btnSimulationArmy.addEventListener('click', () => {
    generateExam('army');
    showScreen(dom.screenExam);
    renderQuestion();
  });

  // 練習模式點擊監聽
  const setupPracticeClick = (grid, examType) => {
    if (grid) {
      grid.addEventListener('click', (e) => {
        const t = e.target.closest('[data-practice-bank]');
        if (!t || t.disabled) return;
        buildPracticeSession(t.dataset.practiceBank, examType);
        showScreen(dom.screenExam);
        renderQuestion();
      });
    }
  };
  
  setupPracticeClick(dom.practiceTypeGridTraffic, 'traffic');
  setupPracticeClick(dom.practiceTypeGridArmy, 'army');

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
    if (state.examMode === 'practice' && state.practiceBankKey) {
      buildPracticeSession(state.practiceBankKey, state.examType);
    } else {
      generateExam(state.examType);
    }
    showScreen(dom.screenExam);
    renderQuestion();
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
    if (q._type === 'trueFalse') {
      if (e.key === '1' || e.key === 'o' || e.key === 'O') {
        state.userAnswers[state.currentIndex] = true;
        renderQuestion();
      }
      if (e.key === '2' || e.key === 'x' || e.key === 'X') {
        state.userAnswers[state.currentIndex] = false;
        renderQuestion();
      }
    } else {
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= q.options.length) {
        state.userAnswers[state.currentIndex] = num;
        renderQuestion();
      }
    }
  });
}

function enableHomeButtons() {
  dom.btnSimulationTraffic.disabled = false;
  const txtT = dom.btnSimulationTraffic.querySelector('.btn-text');
  if (txtT) txtT.textContent = '模擬考試（40 題）';
  
  dom.btnSimulationArmy.disabled = false;
  const txtA = dom.btnSimulationArmy.querySelector('.btn-text');
  if (txtA) txtA.textContent = '模擬考試（40 題）';
  
  $$('.btn-practice-type').forEach((btn) => { btn.disabled = false; });
}

// ===== Init =====
async function init() {
  bindEvents();
  try {
    await loadQuestionBanks();
    enableHomeButtons();
  } catch (err) {
    const txtT = dom.btnSimulationTraffic.querySelector('.btn-text');
    if (txtT) txtT.textContent = '題庫載入失敗';
    const txtA = dom.btnSimulationArmy.querySelector('.btn-text');
    if (txtA) txtA.textContent = '題庫載入失敗';
    console.error('Failed to load question banks:', err);
  }
}

document.addEventListener('DOMContentLoaded', init);
