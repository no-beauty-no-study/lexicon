/* ============================================================
   The Princess Lexicon — quiz.js
   Quiz page = chapter's page 2 (comprehension questions).
   Interaction model is "paper grading":
     - Clicking a WRONG option strikes it through (red-brown ×) and
       does NOT advance. The question stays open so the reader can
       try other options. The correct one is NOT auto-revealed.
     - Clicking the CORRECT option gilds it (✤ + faint gold ink)
       and locks that question.
     - When ALL questions on the page are correctly answered, a
       small antique toast "Chapter Complete / The next page opens."
       fades in, a 2-second golden arpeggio plays (Web Audio API,
       no asset needed), then we auto-navigate to the next chapter.
     - NEXT button only navigates if all questions are correctly
       answered; otherwise it surfaces the toast briefly with a
       different message and refuses to advance.
   ============================================================ */
(function () {
  document.addEventListener("DOMContentLoaded", init);

  const LETTER = ["A", "B", "C", "D"];

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

  function poolFor(section) {
    const tokens = new Set();
    const text = (section.blocks || []).join(" ");
    const m = text.match(/\b[A-Za-z][A-Za-z'-]{3,}\b/g) || [];
    for (const t of m) tokens.add(t.toLowerCase());
    for (const q of section.quiz || []) tokens.add(String(q.a).toLowerCase());
    const STOP = new Set(["that","this","with","from","into","were","have","been",
      "their","they","them","what","which","when","than","such","also","upon",
      "between","because","while","after","before","about","every","other","more",
      "only","some","most","each","over","under","still","never","always","could",
      "would","should","might","there","these","those","where"]);
    for (const w of STOP) tokens.delete(w);
    return Array.from(tokens);
  }

  /** Synthesise a ~2-second golden arpeggio (C5 E5 G5 C6) via Web Audio. */
  function playSuccessChord() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const notes = [523.25, 659.25, 783.99, 1046.50];
      const now = ctx.currentTime;
      notes.forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = freq;
        const t0 = now + i * 0.18;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.18, t0 + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0008, t0 + 1.05);
        o.connect(g).connect(ctx.destination);
        o.start(t0);
        o.stop(t0 + 1.15);
      });
      setTimeout(() => { try { ctx.close(); } catch (_) {} }, 2400);
    } catch (_) { /* silent fallback */ }
  }

  /** Show the antique toast with custom text; auto-hide after `ms`. */
  function showToast({ title, subtitle, ms = 1400 }) {
    const t = document.querySelector(".chapter-complete-toast");
    if (!t) return;
    t.querySelector(".chapter-complete-title").textContent    = title;
    t.querySelector(".chapter-complete-subtitle").textContent = subtitle;
    t.setAttribute("aria-hidden", "false");
    t.classList.add("is-visible");
    if (ms > 0) {
      setTimeout(() => {
        t.classList.remove("is-visible");
        t.setAttribute("aria-hidden", "true");
      }, ms);
    }
  }

  function init() {
    const chapterId  = qparam("chapter", "universe");
    const sectionNum = qparam("section", "1.1");
    const book       = (typeof getChapterOrDefault === "function")
                       ? getChapterOrDefault(chapterId) : { number: "01", title: chapterId };
    const section    = ChapterNav.findSection(chapterId, sectionNum);

    document.querySelector("[data-chapter-number]").textContent = "Chapter " + book.number;
    document.querySelector("[data-chapter-title]").textContent  = book.title;
    document.querySelector("[data-chapter-section]").textContent =
      section ? (section.number + " · " + section.title) : sectionNum;

    const pool  = section ? poolFor(section) : [];
    const items = (section && section.quiz) ? section.quiz : [];

    const body = document.querySelector(".quiz-body");
    body.innerHTML = items.length
      ? items.map((q, i) => renderItem(q, i, pool, section.audio_prefix)).join("")
      : `<div class="empty-state">No quiz available yet for this section.</div>`;

    // PROGRESSIVE REVEAL — only Q1 shows initially; subsequent
    // questions appear only after the previous one is answered
    // correctly. Wrong answer → speak the wrong word + bounce
    // back to the reading page (per user spec: '选错播放被点击的
    // 单词语音 然后直接返回前一章学习 下面的题目不显现').
    function showThrough(n) {
      const all = document.querySelectorAll(".quiz-item");
      all.forEach((it, i) => it.classList.toggle("is-shown", i <= n));
    }
    showThrough(0);

    let advancing = false;
    let backingOut = false;

    function allCorrect() {
      const itemEls = document.querySelectorAll(".quiz-item");
      if (!itemEls.length) return false;
      return Array.from(itemEls).every(it => it.dataset.solved === "1");
    }

    function maybeChapterComplete() {
      if (advancing) return;
      if (!allCorrect()) return;
      advancing = true;
      showToast({
        title: "Chapter Complete",
        subtitle: "The next page opens.",
        ms: 0,
      });
      playSuccessChord();
      const nextHref = ChapterNav.nextAfterQuiz(chapterId, sectionNum);
      setTimeout(() => window.go(nextHref), 1200);
    }

    // Option click — paper-grading feedback.
    body.addEventListener("click", (e) => {
      const opt = e.target.closest(".quiz-option");
      if (!opt || opt.classList.contains("is-locked")) return;
      e.stopPropagation();   // don't trigger Reveal next-block

      const item    = opt.closest(".quiz-item");
      if (item.dataset.solved === "1") return;

      const answer  = item.dataset.answer.toLowerCase().trim();
      const chosen  = (opt.dataset.value || "").toLowerCase().trim();
      const correct = chosen === answer;

      // Clear any pre-judge .is-selected on this question.
      item.querySelectorAll(".quiz-option.is-selected")
        .forEach(o => o.classList.remove("is-selected"));

      if (correct) {
        opt.classList.add("is-correct", "is-locked");
        item.dataset.solved = "1";
        item.querySelectorAll(".quiz-option").forEach(o => o.classList.add("is-locked"));
        // Reveal the NEXT question, or finish the quiz if this was
        // the last one.
        const all = Array.from(document.querySelectorAll(".quiz-item"));
        const idx = all.indexOf(item);
        if (idx + 1 < all.length) {
          showThrough(idx + 1);
        } else {
          maybeChapterComplete();
        }
      } else {
        if (backingOut) return;
        backingOut = true;
        opt.classList.add("is-wrong", "is-locked");
        // Speak the wrong word + bounce back to the reading page.
        try { Reveal.speak(opt.dataset.value || opt.textContent || "", { gender: "male" }); } catch (_) {}
        const backHref = ChapterNav.prevBeforeQuiz(chapterId, sectionNum);
        setTimeout(() => window.go(backHref), 1500);
      }
    });

    // No Reveal.init here — quiz progression is gated by correct
    // answers, not by taps anywhere on the page.

    // BACK — return to this chapter's reading page (sectionNum).
    const back = document.querySelector("[data-back]");
    if (back) back.addEventListener("click", (e) => {
      e.stopPropagation();
      window.go(ChapterNav.prevBeforeQuiz(chapterId, sectionNum));
    });

    // NEXT — only advances if all answers are correct.
    const next = document.querySelector("[data-next]");
    if (next) next.addEventListener("click", (e) => {
      e.stopPropagation();
      if (allCorrect()) {
        maybeChapterComplete();   // shows toast + nav
      } else {
        showToast({
          title: "Answer the Questions",
          subtitle: "Choose the correct option for each.",
          ms: 1400,
        });
      }
    });
  }

  function renderItem(q, idx, pool, audioPrefix) {
    const opts = buildOptions(q.a, pool);
    return `
      <article class="quiz-item reveal-block" data-answer="${esc(q.a)}"
               data-solved="0"
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
