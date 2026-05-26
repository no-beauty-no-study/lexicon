/* ============================================================
   The Princess Lexicon — quiz.js
   Quiz page = chapter page 2. Same paper / typography as reading.
   Each question is a reveal block; tapping a wrong/right option
   gives a classical (no green/red) feedback tint.
   ============================================================ */
(function () {
  document.addEventListener("DOMContentLoaded", init);

  // --- 4 muted classical labels to fan out 1-choice "A B C D" UI -----
  const LETTER = ["A", "B", "C", "D"];

  /** Make 3 distractor options for an answer by pulling words from the
      same section's reading + Q&A pool. Keeps everything on-topic. */
  function buildOptions(answer, sectionPool) {
    const norm = (s) => String(s || "").trim().toLowerCase();
    const distractors = [];
    for (const w of sectionPool) {
      if (distractors.length >= 3) break;
      const ww = String(w).trim();
      if (!ww) continue;
      if (norm(ww) === norm(answer)) continue;
      if (distractors.some(d => norm(d) === norm(ww))) continue;
      distractors.push(ww);
    }
    while (distractors.length < 3) distractors.push("—");
    const opts = [answer, ...distractors];
    // Shuffle (deterministic per question — based on length of answer)
    const seed = answer.length || 1;
    return shuffle(opts, seed);
  }

  function shuffle(arr, seed) {
    const a = arr.slice();
    let s = seed;
    for (let i = a.length - 1; i > 0; i--) {
      s = (s * 9301 + 49297) % 233280;
      const j = Math.floor((s / 233280) * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Build a small per-section vocabulary pool from text + answers. */
  function poolFor(section) {
    const tokens = new Set();
    const text = (section.blocks || []).join(" ");
    const m = text.match(/\b[A-Za-z][A-Za-z'-]{3,}\b/g) || [];
    for (const t of m) tokens.add(t.toLowerCase());
    for (const q of section.quiz || []) tokens.add(String(q.a).toLowerCase());
    // Remove very common stop words.
    const STOP = new Set(["that","this","with","from","into","were","have","been",
      "their","they","them","what","which","when","than","such","also","upon",
      "between","because","while","after","before","about","every","other","more",
      "only","some","most","each","over","under","still","never","always","could",
      "would","should","might","there","these","those","where"]);
    for (const w of STOP) tokens.delete(w);
    return Array.from(tokens);
  }

  function init() {
    const chapterId = qparam("chapter", "universe");
    const sectionNum = qparam("section", "1.1");
    const book = (typeof getChapterOrDefault === "function")
      ? getChapterOrDefault(chapterId) : { number: "01", title: chapterId };
    const section = ChapterNav.findSection(chapterId, sectionNum);

    document.querySelector("[data-chapter-number]").textContent = "Chapter " + book.number;
    document.querySelector("[data-chapter-title]").textContent  = book.title;
    document.querySelector("[data-chapter-section]").textContent =
      section ? (section.number + " · " + section.title) : sectionNum;

    const pool = section ? poolFor(section) : [];
    const items = (section && section.quiz) ? section.quiz : [];

    const body = document.querySelector(".quiz-body");
    body.innerHTML = items.length
      ? items.map((q, i) => renderItem(q, i, pool, section.audio_prefix)).join("")
      : `<div class="empty-state">No quiz available yet for this section.</div>`;

    // Option click handler
    body.addEventListener("click", e => {
      const opt = e.target.closest(".quiz-option");
      if (!opt || opt.classList.contains("is-locked")) return;
      const item = opt.closest(".quiz-item");
      const answer = item.dataset.answer.toLowerCase().trim();
      const chosen = (opt.dataset.value || "").toLowerCase().trim();
      const correct = chosen === answer;
      Array.from(item.querySelectorAll(".quiz-option")).forEach(o => {
        o.classList.add("is-locked");
        const v = (o.dataset.value || "").toLowerCase().trim();
        if (v === answer) o.classList.add("is-correct");
        else if (o === opt && !correct) o.classList.add("is-wrong");
      });
    });

    Reveal.init({
      container: ".reading-main",
      overlaySelector: ".tap-overlay",
    });

    // Bottom nav
    const next = document.querySelector("[data-next]");
    if (next) next.addEventListener("click", () =>
      window.go(ChapterNav.nextAfterQuiz(chapterId, sectionNum)));
    const back = document.querySelector("[data-back]");
    if (back) back.addEventListener("click", () =>
      window.go(ChapterNav.prevBeforeQuiz(chapterId, sectionNum)));
  }

  function renderItem(q, idx, pool, audioPrefix) {
    const opts = buildOptions(q.a, pool);
    return `
      <article class="quiz-item reveal-block" data-answer="${esc(q.a)}"
               data-audio="${esc(audioPrefix)}-q${idx + 1}.mp3">
        <div class="quiz-no">Question ${idx + 1}</div>
        <p class="quiz-question">${esc(q.q)}</p>
        <ul class="quiz-options">
          ${opts.map((o, i) => `
            <li class="quiz-option" data-value="${esc(o)}">
              <span class="quiz-option-letter">${LETTER[i]}.</span>
              <span class="quiz-option-text">${esc(o)}</span>
            </li>
          `).join("")}
        </ul>
      </article>
    `;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
