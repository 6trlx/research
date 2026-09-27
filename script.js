/* ==========================================================
   المراجعة النهائية - منطق الموقع
   ========================================================== */

// ---------- سجل الملازم المتاحة (تُقرأ من ملفات data/) ----------
const LECTURES = [
  { id: "lecture1", icon: "📘", summary: () => lecture1Summary, questions: () => lecture1Questions },
  { id: "lecture2", icon: "📗", summary: () => lecture2Summary, questions: () => lecture2Questions },
];

const ABSTRACT_ITEM = { id: "abstract", icon: "📄", summary: () => abstractSummary, questions: () => abstractQuestions };

// ---------- حالة التطبيق ----------
let currentLectureId = null;
let currentQuiz = {
  questions: [],
  index: 0,
  correct: 0,
  wrong: 0,
  answered: false,
  sourceId: null,
};

// ==========================================================
// التنقل بين الشاشات
// ==========================================================
function showView(id){
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document.getElementById("backBtn").style.display = (id === "view-home") ? "none" : "flex";
  window.scrollTo({top:0, behavior:"smooth"});
}

function goHome(){
  currentLectureId = null;
  showView("view-home");
}

function getLectureMeta(id){
  if(id === "abstract") return ABSTRACT_ITEM;
  return LECTURES.find(l => l.id === id);
}

function openLecture(id){
  currentLectureId = id;
  const meta = getLectureMeta(id);
  const summary = meta.summary();
  document.getElementById("lectureTitle").textContent = summary.title;
  document.getElementById("lectureDesc").textContent = summary.subtitle;
  showView("view-lecture");
}

function backToLecture(){
  if(!currentLectureId){ goHome(); return; }
  openLecture(currentLectureId);
}

// ==========================================================
// بناء الصفحة الرئيسية (بطاقات الملازم)
// ==========================================================
function renderHome(){
  const grid = document.getElementById("lecturesGrid");
  grid.innerHTML = "";
  LECTURES.forEach(l => {
    const s = l.summary();
    const q = l.questions();
    const card = document.createElement("div");
    card.className = "lecture-card";
    card.onclick = () => openLecture(l.id);
    card.innerHTML = `
      <div class="card-icon">${l.icon}</div>
      <h3>${s.title}</h3>
      <p>${s.subtitle}</p>
      <span class="card-tag">${q.length > 0 ? q.length + " سؤال" : "قريباً"}</span>
    `;
    grid.appendChild(card);
  });

  const abstractGrid = document.getElementById("abstractGrid");
  abstractGrid.innerHTML = "";
  const s = ABSTRACT_ITEM.summary();
  const q = ABSTRACT_ITEM.questions();
  const card = document.createElement("div");
  card.className = "lecture-card";
  card.onclick = () => openLecture("abstract");
  card.innerHTML = `
    <div class="card-icon">${ABSTRACT_ITEM.icon}</div>
    <h3>${s.title}</h3>
    <p>${s.subtitle}</p>
    <span class="card-tag">${q.length > 0 ? q.length + " سؤال" : "قريباً"}</span>
  `;
  abstractGrid.appendChild(card);
}

// ==========================================================
// عرض الملخص
// ==========================================================
function openSummary(){
  const meta = getLectureMeta(currentLectureId);
  const s = meta.summary();
  document.getElementById("summaryTitle").textContent = s.title + " — الملخص";
  const container = document.getElementById("summaryContent");
  container.innerHTML = "";

  if(!s.blocks || s.blocks.length === 0){
    container.innerHTML = `<div class="concept-block"><p>سيتم إضافة محتوى الملخص في المرحلة القادمة.</p></div>`;
  } else {
    s.blocks.forEach(block => {
      const div = document.createElement("div");
      div.className = "concept-block";
      let html = `<h3>${block.icon || "💡"} ${block.title} ${block.eng ? `<span class="eng-term">(${block.eng})</span>` : ""}</h3>`;
      if(block.html){
        html += block.html;
      } else if(block.text){
        html += `<p>${block.text}</p>`;
      }
      if(block.list){
        html += "<ul>" + block.list.map(li => `<li>${li}</li>`).join("") + "</ul>";
      }
      if(block.note){
        html += `<div class="note-box">💡 ${block.note}</div>`;
      }
      div.innerHTML = html;
      container.appendChild(div);
    });
  }
  showView("view-summary");
}

// ==========================================================
// اختيار وضع الاختبار
// ==========================================================
const QUIZ_MODES = [
  { id: "quick", icon: "⚡", title: "اختبار سريع", desc: "عدد قليل من الأسئلة لمراجعة سريعة", count: 8 },
  { id: "full", icon: "📚", title: "اختبار شامل", desc: "يغطي أغلب أجزاء الملزمة", count: 20 },
  { id: "hard", icon: "🔥", title: "اختبار صعب", desc: "أسئلة تحتاج فهم وربط عميق", count: 10, difficultyOnly: ["صعب", "Very Hard"] },
];

function openQuizModes(){
  const grid = document.getElementById("quizModesGrid");
  grid.innerHTML = "";
  const meta = getLectureMeta(currentLectureId);
  const allQ = meta.questions();

  QUIZ_MODES.forEach(mode => {
    let pool = allQ;
    if(mode.difficultyOnly){
      pool = allQ.filter(q => mode.difficultyOnly.includes(q.difficulty));
    }
    const available = Math.min(mode.count, pool.length);
    const card = document.createElement("div");
    card.className = "mode-card";
    card.onclick = () => startQuiz(mode.id);
    card.innerHTML = `
      <div class="mode-icon">${mode.icon}</div>
      <h3>${mode.title}</h3>
      <p>${mode.desc}</p>
      <span class="mode-count">${available} سؤال متاح</span>
    `;
    grid.appendChild(card);
  });
  showView("view-quizmodes");
}

// ==========================================================
// محرك الاختبار
// ==========================================================
function shuffleArray(arr){
  const a = [...arr];
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuizOptions(question){
  // توزيع عشوائي لموضع الإجابة الصحيحة مع الحفاظ على نص الخيارات
  const opts = question.options.map((text, idx) => ({
    text,
    isCorrect: idx === question.correctIndex
  }));
  return shuffleArray(opts);
}

function startQuiz(modeId){
  const mode = QUIZ_MODES.find(m => m.id === modeId);
  const meta = getLectureMeta(currentLectureId);
  let pool = meta.questions();

  if(mode.difficultyOnly){
    pool = pool.filter(q => mode.difficultyOnly.includes(q.difficulty));
  }

  const shuffled = shuffleArray(pool);
  const selected = shuffled.slice(0, Math.min(mode.count, shuffled.length));

  currentQuiz = {
    questions: selected.map(q => ({ ...q, shuffledOptions: buildQuizOptions(q) })),
    index: 0,
    correct: 0,
    wrong: 0,
    answered: false,
    sourceId: currentLectureId,
  };

  if(currentQuiz.questions.length === 0){
    alert("لا توجد أسئلة متاحة بعد لهذا الوضع.");
    return;
  }

  showView("view-quiz");
  renderQuestion();
}

function renderQuestion(){
  const q = currentQuiz.questions[currentQuiz.index];
  currentQuiz.answered = false;

  // شريط التقدم
  const total = currentQuiz.questions.length;
  const current = currentQuiz.index + 1;
  document.getElementById("quizProgressFill").style.width = ((current-1)/total*100) + "%";
  document.getElementById("quizProgressText").textContent = `${current} / ${total}`;

  // شارة الصعوبة
  const badge = document.getElementById("quizDifficultyBadge");
  badge.textContent = q.difficulty || "متوسط";
  badge.className = "difficulty-badge " + diffClass(q.difficulty);

  document.getElementById("quizQuestion").textContent = q.question;

  const optionsWrap = document.getElementById("quizOptions");
  optionsWrap.innerHTML = "";
  const letters = ["A","B","C","D"];
  q.shuffledOptions.forEach((opt, idx) => {
    const div = document.createElement("div");
    div.className = "quiz-option";
    div.innerHTML = `<span class="opt-letter">${letters[idx]}</span><span>${opt.text}</span>`;
    div.onclick = () => selectAnswer(idx);
    optionsWrap.appendChild(div);
  });

  document.getElementById("quizExplanation").style.display = "none";
  document.getElementById("quizNextBtn").style.display = "none";
}

function diffClass(d){
  if(d === "سهل") return "diff-easy";
  if(d === "متوسط") return "diff-medium";
  if(d === "صعب") return "diff-hard";
  if(d === "Very Hard") return "diff-veryhard";
  return "diff-medium";
}

function selectAnswer(idx){
  if(currentQuiz.answered) return;
  currentQuiz.answered = true;

  const q = currentQuiz.questions[currentQuiz.index];
  const options = document.querySelectorAll(".quiz-option");

  q.shuffledOptions.forEach((opt, i) => {
    options[i].classList.add("disabled");
    if(opt.isCorrect) options[i].classList.add("correct");
  });

  if(q.shuffledOptions[idx].isCorrect){
    currentQuiz.correct++;
  } else {
    options[idx].classList.add("wrong");
    currentQuiz.wrong++;
  }

  const expl = document.getElementById("quizExplanation");
  expl.style.display = "block";
  expl.innerHTML = `<strong>💡 التوضيح:</strong> ${q.explanation || "لا يوجد توضيح إضافي."}`;

  document.getElementById("quizNextBtn").style.display = "block";
  document.getElementById("quizNextBtn").textContent =
    (currentQuiz.index === currentQuiz.questions.length - 1) ? "عرض النتيجة ←" : "السؤال التالي ←";
}

function nextQuestion(){
  currentQuiz.index++;
  if(currentQuiz.index >= currentQuiz.questions.length){
    showResult();
  } else {
    renderQuestion();
  }
}

function exitQuiz(){
  if(confirm("هل تريد إنهاء الاختبار والعودة؟")){
    backToLecture();
  }
}

function retryQuiz(){
  currentLectureId = currentQuiz.sourceId;
  openQuizModes();
}

// ==========================================================
// شاشة النتيجة
// ==========================================================
function showResult(){
  const total = currentQuiz.questions.length;
  const percent = Math.round((currentQuiz.correct / total) * 100);

  let level, emoji;
  if(percent >= 90){ level = "ممتاز 🌟"; emoji = "🏆"; }
  else if(percent >= 80){ level = "جيد جداً 👏"; emoji = "🎉"; }
  else if(percent >= 70){ level = "جيد 👍"; emoji = "🙂"; }
  else { level = "يحتاج مراجعة 📖"; emoji = "💪"; }

  document.getElementById("resultEmoji").textContent = emoji;
  document.getElementById("resultLevel").textContent = level;
  document.getElementById("resultPercent").textContent = percent + "%";
  document.getElementById("resultCorrect").textContent = currentQuiz.correct;
  document.getElementById("resultWrong").textContent = currentQuiz.wrong;
  document.getElementById("resultTotal").textContent = total;

  currentLectureId = currentQuiz.sourceId;
  showView("view-result");
}

// ==========================================================
// التهيئة الأولية
// ==========================================================
window.addEventListener("DOMContentLoaded", () => {
  renderHome();
  setTimeout(() => {
    document.getElementById("loader").classList.add("hidden");
  }, 300);
});
