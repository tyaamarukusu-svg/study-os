/* ルーティング（ハッシュベース）とレンダリング */

const app = document.getElementById("app");
let ALL_QUESTIONS = [];

const routes = {
  "#/": renderHome,
  "#/quiz": renderQuiz,       // 一問一答・四択（同じエンジン、出題形式は同じ4択データを使う）
  "#/exam": renderExam,       // 模擬試験
  "#/settings": renderSettings,
  "#/stats": renderStats,
  "#/listening": renderListening
};

async function boot() {
  ALL_QUESTIONS = await StudyOS.loadQuestions();
  window.addEventListener("hashchange", route);
  route();
}

function route() {
  const hash = location.hash || "#/";
  const path = hash.split("?")[0];
  // 聞き流し画面から離れるときは読み上げを必ず止める
  if (path !== "#/listening" && "speechSynthesis" in window) {
    stopListening();
  }
  const handler = routes[path] || renderHome;
  handler();
}

function certLabel() {
  const settings = StudyOS.loadSettings();
  return settings.field === "すべて" ? "運行管理者（貨物）" : settings.field;
}

function setAppbar(title) {
  document.getElementById("appbarTitle").textContent = title;
  document.getElementById("appbarCert").textContent = certLabel();
}

/* ===== ホーム ===== */
function renderHome() {
  setAppbar("Study OS");
  const stats = StudyOS.getStats(ALL_QUESTIONS);
  app.innerHTML = `
    <div class="stats-bar">
      <div class="stat"><div class="num">${stats.accuracy}%</div><div class="label">正答率</div></div>
      <div class="stat"><div class="num">${stats.streak}</div><div class="label">連続正解</div></div>
      <div class="stat"><div class="num">${stats.answeredQuestions}/${stats.totalQuestions}</div><div class="label">学習済み</div></div>
    </div>
    <div class="menu-grid">
      <button class="menu-card" onclick="location.hash='#/quiz?mode=one'"><span class="icon">✏️</span><span class="label">一問一答</span></button>
      <button class="menu-card" onclick="location.hash='#/listening'"><span class="icon">🎧</span><span class="label">聞き流し</span></button>
      <button class="menu-card" onclick="location.hash='#/stats'"><span class="icon">📊</span><span class="label">学習記録</span></button>
      <button class="menu-card" onclick="location.hash='#/settings'"><span class="icon">⚙️</span><span class="label">設定</span></button>
    </div>
    <p class="text-center mt-lg">
      <a class="back-link" href="admin.html">🔧 管理者画面はこちら</a>
    </p>
  `;
}

/* ===== 出題セット作成（設定を反映） ===== */
function buildQuestionSet() {
  const settings = StudyOS.loadSettings();
  let pool = ALL_QUESTIONS.slice();
  if (settings.difficulty !== "すべて") {
    pool = pool.filter(q => q.難易度 === settings.difficulty);
  }
  if (settings.field !== "すべて") {
    pool = pool.filter(q => q.分野 === settings.field);
  }
  pool = StudyOS.filterByMode(pool, settings.mode);
  pool = StudyOS.shuffle(pool);
  return pool.slice(0, settings.questionCount || pool.length);
}

/* ===== 一問一答・四択（即時採点） ===== */
let quizState = { queue: [], index: 0 };

function renderQuiz() {
  const params = new URLSearchParams((location.hash.split("?")[1] || ""));
  const mode = params.get("mode") === "four" ? "四択問題" : "一問一答";
  setAppbar(mode);

  if (quizState.index === 0 || quizState.queue.length === 0) {
    quizState.queue = buildQuestionSet();
    quizState.index = 0;
  }
  renderQuestionCard();
}

function renderQuestionCard() {
  const q = quizState.queue[quizState.index];
  if (!q) {
    app.innerHTML = `<div class="empty-state">この条件の問題がありません。<br>設定を見直してください。</div>
      <a class="back-link" href="#/settings">⚙️ 設定へ</a>`;
    return;
  }

  const choices = availableChoices(q);
  app.innerHTML = `
    <a class="back-link" href="#/">← ホームへ戻る</a>
    <div class="q-card">
      <div class="q-meta"><span>${q.分野}</span><span>${q.難易度}</span><span>${quizState.index + 1} / ${quizState.queue.length}問</span></div>
      <div class="q-text">${escapeHtml(q.問題)}</div>
      <div id="choiceList">
        ${choices.map(c => `<button class="choice" data-choice="${c}">${q.形式 === "○×" ? escapeHtml(q["選択肢" + c]) : c + ". " + escapeHtml(q["選択肢" + c])}</button>`).join("")}
      </div>
      <div id="resultArea"></div>
    </div>
  `;

  document.querySelectorAll(".choice").forEach(btn => {
    btn.onclick = () => answerQuestion(q, btn.dataset.choice);
  });
}

function answerQuestion(q, choice) {
  const correct = choice === q.正解;
  StudyOS.recordAnswer(q.id, correct);

  document.querySelectorAll(".choice").forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.choice === q.正解) btn.classList.add("correct");
    else if (btn.dataset.choice === choice) btn.classList.add("wrong");
  });

  const box = document.getElementById("resultArea");
  box.innerHTML = `
    <div class="result-box ${correct ? "correct" : "wrong"}">
      <div class="title">${correct ? "⭕ 正解！" : "❌ 不正解"}</div>
      <div><strong>正解: ${q.形式 === "○×" ? escapeHtml(q["選択肢" + q.正解]) : q.正解}</strong></div>
      <div class="mt-sm">${escapeHtml(q.解説)}</div>
      ${!correct ? `<div class="pitfall-note">⚠ ${escapeHtml(q.間違えやすい理由 || "")}</div>` : ""}
    </div>
    <button class="next-btn" id="nextBtn">${quizState.index + 1 < quizState.queue.length ? "次の問題へ" : "結果を見る"}</button>
  `;
  document.getElementById("nextBtn").onclick = () => {
    quizState.index += 1;
    if (quizState.index >= quizState.queue.length) {
      location.hash = "#/stats";
      quizState.index = 0;
    } else {
      renderQuestionCard();
    }
  };
}

function availableChoices(q) {
  return ["A", "B", "C", "D"].filter(c => (q["選択肢" + c] || "").trim() !== "");
}

/* ===== 模擬試験（最後にまとめて採点） ===== */
let examState = { queue: [], answers: {} };

function renderExam() {
  setAppbar("模擬試験");
  if (examState.queue.length === 0) {
    examState.queue = buildQuestionSet();
    examState.answers = {};
  }
  renderExamCard(0);
}

function renderExamCard(idx) {
  const q = examState.queue[idx];
  if (!q) return renderExamResult();

  const choices = availableChoices(q);
  app.innerHTML = `
    <div class="q-card">
      <div class="q-meta"><span>模試</span><span>${idx + 1} / ${examState.queue.length}問</span></div>
      <div class="q-text">${escapeHtml(q.問題)}</div>
      <div>
        ${choices.map(c => `<button class="choice" data-choice="${c}">${q.形式 === "○×" ? escapeHtml(q["選択肢" + c]) : c + ". " + escapeHtml(q["選択肢" + c])}</button>`).join("")}
      </div>
    </div>
  `;
  document.querySelectorAll(".choice").forEach(btn => {
    btn.onclick = () => {
      examState.answers[q.id] = btn.dataset.choice;
      renderExamCard(idx + 1);
    };
  });
}

function renderExamResult() {
  let correctCount = 0;
  examState.queue.forEach(q => {
    const ans = examState.answers[q.id];
    const correct = ans === q.正解;
    if (correct) correctCount++;
    StudyOS.recordAnswer(q.id, correct);
  });
  const total = examState.queue.length;
  const rate = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  app.innerHTML = `
    <div class="q-card exam-result-card">
      <div class="exam-label">模擬試験 結果</div>
      <div class="exam-rate">${rate}%</div>
      <div>${correctCount} / ${total} 問正解</div>
      <button class="next-btn" onclick="examState.queue=[];location.hash='#/'">ホームへ戻る</button>
    </div>
  `;
}

/* ===== 学習記録 ===== */
function renderStats() {
  setAppbar("学習記録");
  const stats = StudyOS.getStats(ALL_QUESTIONS);
  app.innerHTML = `
    <a class="back-link" href="#/">← ホームへ戻る</a>
    <div class="stats-bar">
      <div class="stat"><div class="num">${stats.accuracy}%</div><div class="label">総合正答率</div></div>
      <div class="stat"><div class="num">${stats.streak}</div><div class="label">現在の連続正解</div></div>
      <div class="stat"><div class="num">${stats.bestStreak}</div><div class="label">自己ベスト</div></div>
    </div>
    <div class="q-card">
      <div class="q-text text-sm">学習済み ${stats.answeredQuestions} / ${stats.totalQuestions} 問</div>
    </div>
  `;
}

/* ===== 設定 ===== */
function renderSettings() {
  setAppbar("設定");
  const settings = StudyOS.loadSettings();
  const fields = ["すべて", ...new Set(ALL_QUESTIONS.map(q => q.分野))];

  app.innerHTML = `
    <a class="back-link" href="#/">← ホームへ戻る</a>
    <div class="q-card">
      <div class="field-group">
        <label>難易度</label>
        <div class="pill-group" data-key="difficulty">
          ${["すべて", "初級", "標準", "上級"].map(v => pillBtn(v, settings.difficulty)).join("")}
        </div>
      </div>
      <div class="field-group">
        <label>問題数</label>
        <div class="pill-group" data-key="questionCount">
          ${[10, 20, 30, 50].map(v => pillBtn(v, settings.questionCount)).join("")}
        </div>
      </div>
      <div class="field-group">
        <label>出題方法</label>
        <div class="pill-group" data-key="mode">
          ${["ランダム", "苦手のみ", "頻出のみ"].map(v => pillBtn(v, settings.mode)).join("")}
        </div>
      </div>
      <div class="field-group">
        <label>分野指定</label>
        <div class="pill-group" data-key="field">
          ${fields.map(v => pillBtn(v, settings.field)).join("")}
        </div>
      </div>
    </div>
  `;

  document.querySelectorAll(".pill-group").forEach(group => {
    const key = group.dataset.key;
    group.querySelectorAll("button").forEach(btn => {
      btn.onclick = () => {
        const settings = StudyOS.loadSettings();
        settings[key] = isNaN(btn.dataset.value) ? btn.dataset.value : Number(btn.dataset.value);
        StudyOS.saveSettings(settings);
        renderSettings();
      };
    });
  });
}

function pillBtn(value, current) {
  const active = String(value) === String(current) ? "active" : "";
  return `<button class="${active}" data-value="${value}">${value}</button>`;
}

/* ===== 聞き流し ===== */
let listeningState = { queue: [], index: 0, playing: false, token: 0 };

function renderListening() {
  setAppbar("聞き流し");
  if (!("speechSynthesis" in window)) {
    app.innerHTML = `
      <a class="back-link" href="#/">← ホームへ戻る</a>
      <div class="empty-state">🎧 このブラウザは読み上げ機能に対応していません。</div>
    `;
    return;
  }
  if (listeningState.queue.length === 0) {
    listeningState.queue = buildQuestionSet();
    listeningState.index = 0;
  }
  listeningState.playing = false;
  renderListeningCard();
}

function renderListeningCard() {
  const q = listeningState.queue[listeningState.index];
  if (!q) {
    app.innerHTML = `
      <a class="back-link" href="#/">← ホームへ戻る</a>
      <div class="empty-state">🎧 これで全問終わりです。お疲れさまでした。</div>
    `;
    return;
  }
  app.innerHTML = `
    <a class="back-link" href="#/">← ホームへ戻る</a>
    <div class="q-card">
      <div class="q-meta"><span>${q.分野}</span><span>${listeningState.index + 1} / ${listeningState.queue.length}問</span></div>
      <div class="q-text">${escapeHtml(q.問題)}</div>
      <div id="listeningStatus" class="listening-status">▶ 再生ボタンを押してください</div>
      <button class="next-btn" id="listeningToggle">▶ 再生する</button>
      <div class="listening-controls">
        <button class="choice" id="listeningPrev">⏮ 前の問題</button>
        <button class="choice" id="listeningSkip">次の問題へ ⏭</button>
      </div>
    </div>
  `;
  document.getElementById("listeningToggle").onclick = toggleListening;
  document.getElementById("listeningPrev").onclick = () => {
    stopListening();
    listeningState.index = Math.max(0, listeningState.index - 1);
    renderListeningCard();
  };
  document.getElementById("listeningSkip").onclick = () => {
    stopListening();
    listeningState.index += 1;
    renderListeningCard();
  };
}

function setListeningStatus(text) {
  const el = document.getElementById("listeningStatus");
  if (el) el.textContent = text;
}

function stopListening() {
  listeningState.playing = false;
  listeningState.token += 1; // 進行中の読み上げシーケンスを無効化
  window.speechSynthesis.cancel();
  const btn = document.getElementById("listeningToggle");
  if (btn) btn.textContent = "▶ 再生する";
}

function toggleListening() {
  if (listeningState.playing) {
    stopListening();
    setListeningStatus("⏸ 一時停止しました");
    return;
  }
  listeningState.playing = true;
  document.getElementById("listeningToggle").textContent = "⏸ 停止する";
  playCurrentQuestion();
}

function speak(text, token) {
  return new Promise(resolve => {
    if (listeningState.token !== token || !text) { resolve(); return; }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ja-JP";
    utter.rate = 1.0;
    utter.onend = resolve;
    utter.onerror = resolve;
    window.speechSynthesis.speak(utter);
  });
}

async function playCurrentQuestion() {
  const token = listeningState.token;
  const q = listeningState.queue[listeningState.index];
  if (!q) return;

  try {
    setListeningStatus("🔊 問題を読み上げ中…");
    await speak(q.問題, token);
    if (listeningState.token !== token) return;

    setListeningStatus("⏳ 考え中…（4秒）");
    await new Promise(r => setTimeout(r, 4000));
    if (listeningState.token !== token) return;

    const correctText = q.形式 === "○×" ? q["選択肢" + q.正解] : q.正解;
    setListeningStatus("🔊 正解を読み上げ中…");
    await speak(`正解は、${correctText}です。`, token);
    if (listeningState.token !== token) return;

    setListeningStatus("🔊 解説を読み上げ中…");
    await speak(q.解説, token);
    if (listeningState.token !== token) return;

    if (q.間違えやすい理由) {
      setListeningStatus("🔊 間違えやすいポイントを読み上げ中…");
      await speak(`間違えやすいポイントです。${q.間違えやすい理由}`, token);
      if (listeningState.token !== token) return;
    }

    setListeningStatus("⏳ 次の問題へ…");
    await new Promise(r => setTimeout(r, 1500));
    if (listeningState.token !== token) return;

    listeningState.index += 1;
    if (listeningState.index >= listeningState.queue.length) {
      listeningState.playing = false;
      renderListeningCard();
      return;
    }
    renderListeningCard();
    document.getElementById("listeningToggle").textContent = "⏸ 停止する";
    playCurrentQuestion();
  } catch (e) {
    // 停止された場合はここに来る（正常系）
  }
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

boot();
