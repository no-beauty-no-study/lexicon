/* The Princess Lexicon — views.js
   One init(host, params) per view. The router clones the matching
   <template id="view-X"> into #stage, then calls Views.X.init(). */
const Views = (function () {

  /* shared helpers */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function cssEsc(s) {
    return String(s).replace(/["\\\n\r]/g, c =>
      c === '"' ? '\\"' : c === '\\' ? '\\\\' : '');
  }
  function resumeHash() {
    let last = null;
    try { last = JSON.parse(localStorage.getItem("tpl.lastRead") || "null"); }
    catch (_) {}
    if (last && last.chapter) {
      return `#reading?chapter=${encodeURIComponent(last.chapter)}`
           + `&section=${encodeURIComponent(last.section || "1.1")}`;
    }
    return "#chapters";
  }


  /* ---------- splash ----------
     The .splash-hit element has data-go="#menu" so the global delegate
     in app.js handles the tap; no view-local wiring required. */
  const splash = { init() {} };


  /* ---------- menu ---------- */
  const menu = {
    init(host) {
      host.querySelectorAll(".menu-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const a = btn.dataset.action;
          // Resume → Select (the three-arch screen) so the user can
          // still pick Story / Notes / Word Garden. The actual
          // "continue from last read" hop lives on the Story arch.
          if (a === "resume") window.go("#select");
          else                window.go("#chapters?browse=1");
        });
      });
    },
  };


  /* ---------- select ---------- */
  const select = {
    init(host) {
      function playSelectChime() {
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          const ctx = new Ctx();
          const notes = [659.25, 880.00, 1318.51];
          const now = ctx.currentTime;
          notes.forEach((f, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "sine"; o.frequency.value = f;
            const t0 = now + i * 0.10;
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.16, t0 + 0.018);
            g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.65);
            o.connect(g).connect(ctx.destination);
            o.start(t0); o.stop(t0 + 0.7);
          });
          setTimeout(() => { try { ctx.close(); } catch (_) {} }, 1300);
        } catch (_) {}
      }
      const HOT_TO_TITLE = {
        "zone-select-story-hit":  ".zone-select-story-title",
        "zone-select-notes-hit":  ".zone-select-notes-title",
        "zone-select-garden-hit": ".zone-select-garden-title",
      };
      host.querySelectorAll(".select-hotspot").forEach(el => {
        el.addEventListener("click", (e) => {
          // Stop the global [data-go] delegate from also firing — we
          // want the 380 ms chime to play before nav, not be skipped.
          e.stopPropagation();
          const titleSel = Object.entries(HOT_TO_TITLE)
            .find(([cls]) => el.classList.contains(cls))?.[1];
          const titleEl = titleSel && host.querySelector(titleSel);
          if (titleEl) {
            titleEl.classList.remove("is-pressed");
            void titleEl.offsetWidth;
            titleEl.classList.add("is-pressed");
          }
          playSelectChime();
          const dest = el.dataset.action === "resume"
                     ? resumeHash()
                     : el.dataset.go;
          setTimeout(() => window.go(dest), 380);
        });
      });
    },
  };


  /* ---------- chapters ---------- */
  const chapters = {
    init(host, params) {
      const browse = params.browse === "1";
      const browseFlag = browse ? "&browse=1" : "";
      if (typeof CHAPTERS === "undefined") return;
      CHAPTERS.forEach((c) => {
        const text = host.querySelector(".zone-toc-" + c.number);
        const btn  = host.querySelector(".zone-toc-btn-" + c.number);
        if (text) text.innerHTML = `
          <div class="toc-card-text">
            <p class="toc-card-tagline">${esc(c.tagline || "")}</p>
          </div>`;
        if (btn) btn.innerHTML = `
          <button type="button" class="antique-button toc-open-btn"
                  data-go="#reading?chapter=${encodeURIComponent(c.id)}&section=${encodeURIComponent(c.firstSection || "1.1")}${browseFlag}">
            <span class="antique-button-corner tl"></span>
            <span class="antique-button-corner tr"></span>
            <span class="antique-button-corner bl"></span>
            <span class="antique-button-corner br"></span>
            <span class="antique-button-label">Open Chapter</span>
          </button>`;
      });
    },
  };


  /* ---------- reading ---------- */
  function markClickable(sentence) {
    const used = new Set();
    return sentence.replace(/[A-Za-z][a-zA-Z'-]*/g, (m) => {
      const lc = m.toLowerCase();
      if (used.has(lc) || !hasClickableWord(lc)) return m;
      used.add(lc);
      return `<span class="clickable-word" data-word="${lc}">${m}</span>`;
    });
  }
  function getPhrasePairs(entry) {
    const out = [];
    if (Array.isArray(entry.phrases)) {
      for (const p of entry.phrases) {
        if (out.length >= 2) break;
        if (p && p.en && p.zh) out.push({ en: p.en, zh: p.zh });
      }
    }
    if (out.length < 2 && Array.isArray(entry.kin)) {
      for (const k of entry.kin) {
        if (out.length >= 2) break;
        if (k && typeof k === "object" && Array.isArray(k.phrases)) {
          for (const p of k.phrases) {
            if (out.length >= 2) break;
            if (p && p.en && p.zh) out.push({ en: p.en, zh: p.zh });
          }
        }
      }
    }
    if (out.length < 2 && Array.isArray(entry.friend)) {
      for (const f of entry.friend) {
        if (out.length >= 2) break;
        if (typeof f === "string") {
          const m = f.match(/^(.+?)\s+([一-鿿].*)$/);
          if (m) out.push({ en: m[1].trim(), zh: m[2].trim() });
        }
      }
    }
    if (out.length < 2 && Array.isArray(entry.collocations)) {
      for (const c of entry.collocations) {
        if (out.length >= 2) break;
        if (typeof c === "string") out.push({ en: c, zh: "" });
      }
    }
    return out;
  }

  const reading = {
    init(host, params) {
      const chapterId  = params.chapter || "universe";
      const sectionNum = params.section || "1.1";
      const illustrationId = params.page || null;
      const book    = (typeof getChapterOrDefault === "function")
                       ? getChapterOrDefault(chapterId) : { number: "01", title: chapterId };
      const section = ChapterNav.findSection(chapterId, sectionNum);
      const isBrowse = params.browse === "1";

      if (!isBrowse) {
        try {
          localStorage.setItem("tpl.lastRead", JSON.stringify({
            chapter: chapterId, section: sectionNum,
            page: illustrationId, at: Date.now(),
          }));
        } catch (_) {}
      }

      const bg = typeof getChapterBackground === "function"
                 ? getChapterBackground(chapterId, illustrationId) : null;
      if (bg) host.style.backgroundImage = `url("${bg}")`;

      host.querySelector("[data-chapter-number]").textContent = "Chapter " + book.number;
      host.querySelector("[data-chapter-title]").textContent  = book.title;
      host.querySelector("[data-chapter-section]").textContent =
        section ? (section.number + " · " + section.title) : sectionNum;

      const body = host.querySelector(".reading-body");
      if (section && section.blocks && section.blocks.length) {
        body.innerHTML = section.blocks.map((sent, i) => {
          const audio = `${section.audio_prefix}-${i + 1}.mp3`;
          return `<p class="reveal-block" data-audio="${audio}">${markClickable(sent)}</p>`;
        }).join("");
      } else {
        body.innerHTML = `<p class="reveal-block">No content available yet for this section.</p>`;
      }

      function currentEntryFromStack() {
        const cur = host.querySelector(".word-card.is-current");
        if (!cur) return null;
        const id = cur.dataset.id;
        return (typeof WORDS !== "undefined" && WORDS.find(w => (w.id || w.word) === id))
            || (typeof WORD_LIBRARY !== "undefined" && WORD_LIBRARY.find(w => (w.id || w.word) === id))
            || null;
      }

      function clearCurrent(stack) {
        stack.querySelectorAll(".word-card.is-current")
             .forEach(c => c.classList.remove("is-current"));
      }
      function shortMeaning(entry) { return entry.meaning || ""; }

      function renderMarginalia(resolved) {
        const stack = host.querySelector(".word-card-stack");
        if (!stack) return;
        const entry = (resolved && (resolved.clickEntry || resolved.headEntry));
        if (!entry) return;
        const id = entry.id || entry.word;

        const empty = stack.querySelector(".word-card-empty");
        if (empty) empty.remove();

        const existing = stack.querySelector(`.word-card[data-id="${cssEsc(id)}"]`);
        if (existing) {
          clearCurrent(stack);
          existing.classList.add("is-current");
          existing.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return;
        }

        const phrases = getPhrasePairs(entry);
        const phraseRows = phrases.slice(0, 2).map(p => `
          <div class="word-card-phrase">${esc(p.en)}</div>
        `).join("");

        const html = `
          <div class="word-card is-current" data-id="${esc(id)}">
            <div class="word-card-headword">${esc(entry.word || id)}</div>
            <div class="word-card-meaning">${esc(shortMeaning(entry))}</div>
            ${phraseRows}
          </div>`;
        clearCurrent(stack);
        stack.insertAdjacentHTML("beforeend", html);

        const fresh = stack.lastElementChild;
        const drawerEntry = resolved.headEntry || entry;
        fresh.addEventListener("click", (e) => {
          e.stopPropagation();
          clearCurrent(stack);
          fresh.classList.add("is-current");
          if (typeof WordCard !== "undefined" && drawerEntry) {
            WordCard.openDrawer(drawerEntry);
          }
        });
        fresh.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }

      function syncMarginaliaButtons(entry) {
        const fold = host.querySelector('.marginalia-btn[data-action="fold"]');
        if (!fold) return;
        if (!entry) {
          fold.disabled = true; fold.classList.remove("is-active"); return;
        }
        const id = entry.id || entry.word;
        if (Storage.isSaved(id)) { fold.disabled = true;  fold.classList.add("is-active"); }
        else                     { fold.disabled = false; fold.classList.remove("is-active"); }
      }

      renderMarginalia(null);

      const fold = host.querySelector('.marginalia-btn[data-action="fold"]');
      if (fold) fold.addEventListener("click", (e) => {
        e.stopPropagation();
        const entry = currentEntryFromStack();
        if (!entry) return;
        const id = entry.id || entry.word;
        if (Storage.isSaved(id)) return;
        Storage.saveWord(id);
        syncMarginaliaButtons(entry);
        window.toast && window.toast("Folded into Notes");
      });

      body.addEventListener("click", (e) => {
        const el = e.target.closest(".clickable-word");
        if (!el) return;
        e.stopPropagation();
        host.querySelectorAll(".clickable-word.is-selected")
            .forEach(x => x.classList.remove("is-selected"));
        el.classList.add("is-selected");
        const resolved = (typeof resolveClickedWord === "function")
                         ? resolveClickedWord(el.dataset.word) : null;
        renderMarginalia(resolved);
        syncMarginaliaButtons(currentEntryFromStack());
        // First tap on a word also slides the full word-card drawer in.
        // Earlier the drawer only opened on a second tap of the small
        // marginalia card; the user wants the drawer to be the primary
        // surface for the word definition, not an extra-step popup.
        try {
          const drawerEntry = resolved && (resolved.headEntry || resolved.clickEntry);
          if (drawerEntry && typeof WordCard !== "undefined") {
            WordCard.openDrawer(drawerEntry);
          }
        } catch (_) {}
        try {
          const entry = (resolved && (resolved.clickEntry || resolved.headEntry));
          const phrases = entry ? getPhrasePairs(entry).slice(0, 2) : [];
          const parts = [el.textContent, ...phrases.map(p => p.en)].filter(Boolean);
          TTS.speak(parts.join(". "));
        } catch (_) {}
      });

      host.addEventListener("click", (e) => {
        if (e.target.closest(".word-card")) {
          setTimeout(() => syncMarginaliaButtons(currentEntryFromStack()), 0);
        }
      });

      // Reveal blocks — tap anywhere on .page reveals next block; first
      // tap also reveals the chapter title block and reads the title +
      // section heading before the first paragraph.
      const blocks = Array.from(body.querySelectorAll(".reveal-block"));
      let nextIdx = 0;
      const firstBlock = blocks[0];
      if (firstBlock) {
        const t1 = (host.querySelector("[data-chapter-title]")?.textContent || "").trim();
        const t2 = (host.querySelector("[data-chapter-section]")?.textContent || "").trim();
        const intro = [t1, t2].filter(Boolean).join(". ");
        firstBlock.dataset.speakText = intro
          ? `${intro}. ${firstBlock.textContent}`
          : firstBlock.textContent;
      }
      function revealNext() {
        if (nextIdx >= blocks.length) return;
        const b = blocks[nextIdx++];
        b.classList.add("is-revealed");
        if (!b.querySelector(".ink-ripple")) {
          const r = document.createElement("span");
          r.className = "ink-ripple"; b.appendChild(r);
        }
        if (nextIdx === 1) {
          host.querySelector(".zone-reading-title")?.classList.add("is-revealed");
        }
        TTS.speak(b.dataset.speakText || b.textContent);
      }
      host.addEventListener("click", (e) => {
        if (e.target.closest("button, a, .clickable-word, .side-note-button,"
                           + " .marginalia-card, .word-card, input, select, textarea")) return;
        revealNext();
      });

      const next = host.querySelector("[data-next]");
      if (next) next.addEventListener("click", (e) => {
        e.stopPropagation();
        window.go(ChapterNav.nextAfterReading(chapterId, sectionNum));
      });
      const quizBtn = host.querySelector("[data-quiz]");
      if (quizBtn) quizBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.go(`#quiz?chapter=${encodeURIComponent(chapterId)}&section=${encodeURIComponent(sectionNum)}`);
      });
    },
  };


  /* ---------- quiz ---------- */
  const quiz = {
    init(host, params) {
      const LETTER = ["A", "B", "C", "D"];
      const chapterId  = params.chapter || "universe";
      const sectionNum = params.section || "1.1";
      const book    = (typeof getChapterOrDefault === "function")
                       ? getChapterOrDefault(chapterId) : { number: "01", title: chapterId };
      const section = ChapterNav.findSection(chapterId, sectionNum);

      const bg = typeof getChapterBackground === "function"
                 ? getChapterBackground(chapterId, params.page) : null;
      if (bg) host.style.backgroundImage = `url("${bg}")`;

      host.querySelector("[data-chapter-number]").textContent = "Chapter " + book.number;
      host.querySelector("[data-chapter-title]").textContent  = book.title;
      host.querySelector("[data-chapter-section]").textContent =
        section ? (section.number + " · " + section.title) : sectionNum;

      function shuffle(arr, seed) {
        const a = arr.slice(); let s = seed;
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
      function buildOptions(answer, pool) {
        const norm = (s) => String(s || "").trim().toLowerCase();
        const distractors = [];
        for (const w of pool) {
          if (distractors.length >= 3) break;
          const ww = String(w).trim();
          if (!ww) continue;
          if (norm(ww) === norm(answer)) continue;
          if (distractors.some(d => norm(d) === norm(ww))) continue;
          distractors.push(ww);
        }
        while (distractors.length < 3) distractors.push("—");
        return shuffle([answer, ...distractors], answer.length || 1);
      }
      function renderItem(q, idx, pool, audioPrefix) {
        const opts = buildOptions(q.a, pool);
        // No .reveal-block here on purpose — earlier the class made
        // the question text 10%-opacity warm-grey by default ("invisible
        // ink"), so a player who hadn't tapped the page first couldn't
        // see anything. Quiz prompts need to be readable on entry.
        return `
          <article class="quiz-item" data-answer="${esc(q.a)}"
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
          </article>`;
      }
      function playSuccessChord() {
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          const ctx = new Ctx();
          const notes = [523.25, 659.25, 783.99, 1046.50];
          const now = ctx.currentTime;
          notes.forEach((f, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "sine"; o.frequency.value = f;
            const t0 = now + i * 0.18;
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.18, t0 + 0.025);
            g.gain.exponentialRampToValueAtTime(0.0008, t0 + 1.05);
            o.connect(g).connect(ctx.destination);
            o.start(t0); o.stop(t0 + 1.15);
          });
          setTimeout(() => { try { ctx.close(); } catch (_) {} }, 2400);
        } catch (_) {}
      }
      function showToast({ title, subtitle, ms = 1400 }) {
        const t = host.querySelector(".chapter-complete-toast");
        if (!t) return;
        t.querySelector(".chapter-complete-title").textContent    = title;
        t.querySelector(".chapter-complete-subtitle").textContent = subtitle;
        t.setAttribute("aria-hidden", "false");
        t.classList.add("is-visible");
        if (ms > 0) setTimeout(() => {
          t.classList.remove("is-visible");
          t.setAttribute("aria-hidden", "true");
        }, ms);
      }

      const pool  = section ? poolFor(section) : [];
      const items = (section && section.quiz) ? section.quiz : [];
      const body = host.querySelector(".quiz-body");
      body.innerHTML = items.length
        ? items.map((q, i) => renderItem(q, i, pool, section.audio_prefix)).join("")
        : `<div class="empty-state">No quiz available yet for this section.</div>`;

      function speakItem(item) {
        if (!item) return;
        const q = (item.querySelector(".quiz-question")?.textContent || "").trim();
        const opts = Array.from(item.querySelectorAll(".quiz-option-text"))
                       .map(el => el.textContent.trim()).filter(Boolean);
        const parts = [q];
        opts.forEach((o, i) => parts.push(`${LETTER[i]}. ${o}`));
        try { TTS.speak(parts.join(". ")); } catch (_) {}
      }
      let lastSpokenIdx = -1;
      function showThrough(n) {
        const all = host.querySelectorAll(".quiz-item");
        all.forEach((it, i) => it.classList.toggle("is-shown", i <= n));
        // Auto-read the newly-revealed question (and its options) so the
        // player can start without tapping. Only re-speak if we've
        // actually advanced past the last one we read.
        if (n > lastSpokenIdx) {
          lastSpokenIdx = n;
          const item = all[n];
          // Tiny delay so the fade-in starts before the voice kicks in
          // — feels more like the page is reading itself to you.
          setTimeout(() => speakItem(item), 220);
        }
      }
      showThrough(0);

      let advancing = false;
      let backingOut = false;

      function allCorrect() {
        const itemEls = host.querySelectorAll(".quiz-item");
        if (!itemEls.length) return false;
        return Array.from(itemEls).every(it => it.dataset.solved === "1");
      }
      function maybeChapterComplete() {
        if (advancing || !allCorrect()) return;
        advancing = true;
        showToast({ title: "Chapter Complete", subtitle: "The next page opens.", ms: 0 });
        playSuccessChord();
        const nextHref = ChapterNav.nextAfterQuiz(chapterId, sectionNum);
        setTimeout(() => window.go(nextHref), 1200);
      }

      body.addEventListener("click", (e) => {
        const opt = e.target.closest(".quiz-option");
        if (!opt || opt.classList.contains("is-locked")) return;
        e.stopPropagation();
        const item = opt.closest(".quiz-item");
        if (item.dataset.solved === "1") return;
        const answer = item.dataset.answer.toLowerCase().trim();
        const chosen = (opt.dataset.value || "").toLowerCase().trim();
        const correct = chosen === answer;
        item.querySelectorAll(".quiz-option.is-selected")
          .forEach(o => o.classList.remove("is-selected"));
        if (correct) {
          opt.classList.add("is-correct", "is-locked");
          item.dataset.solved = "1";
          item.querySelectorAll(".quiz-option").forEach(o => o.classList.add("is-locked"));
          const all = Array.from(host.querySelectorAll(".quiz-item"));
          const idx = all.indexOf(item);
          if (idx + 1 < all.length) showThrough(idx + 1);
          else maybeChapterComplete();
        } else {
          if (backingOut) return;
          backingOut = true;
          opt.classList.add("is-wrong", "is-locked");
          try { TTS.speak(opt.dataset.value || opt.textContent || ""); } catch (_) {}
          const backHref = ChapterNav.prevBeforeQuiz(chapterId, sectionNum);
          setTimeout(() => window.go(backHref), 1500);
        }
      });

      const back = host.querySelector("[data-back]");
      if (back) back.addEventListener("click", (e) => {
        e.stopPropagation();
        window.go(ChapterNav.prevBeforeQuiz(chapterId, sectionNum));
      });
      const next = host.querySelector("[data-next]");
      if (next) next.addEventListener("click", (e) => {
        e.stopPropagation();
        if (allCorrect()) maybeChapterComplete();
        else showToast({
          title: "Answer the Questions",
          subtitle: "Choose the correct option for each.",
          ms: 1400,
        });
      });
    },
  };


  /* ---------- notes ---------- */
  const notes = {
    init(host) {
      const ids = Storage.getNotes();
      const getWord = (id) => (typeof window.getWord === "function" ? window.getWord(id) : null);
      const words = ids.map(getWord).filter(Boolean);

      const list = host.querySelector(".word-list");
      const detail = host.querySelector(".detail-pane");
      const countEl = host.querySelector("[data-notes-count]");
      if (countEl) countEl.textContent = words.length + " saved";

      if (!words.length) {
        list.innerHTML = `<li class="empty-state" style="margin:20px 0;">No saved words yet</li>`;
        detail.innerHTML = `<div class="empty-state">Empty Notes</div>`;
        return;
      }

      list.innerHTML = words.map(w => `
        <li class="word-list-item" data-id="${esc(w.id || w.word)}">
          <span class="wli-word">${esc(w.word)}</span>
          <span class="wli-meaning">${esc(w.meaning)}</span>
        </li>`).join("");

      function select(id) {
        host.querySelectorAll(".word-list-item").forEach(li => {
          li.classList.toggle("is-active", li.dataset.id === id);
        });
        const w = getWord(id);
        if (w) detail.innerHTML = WordCard.renderFullBody(w);
      }
      list.addEventListener("click", e => {
        const li = e.target.closest(".word-list-item");
        if (li) select(li.dataset.id);
      });
      select(words[0].id || words[0].word);
    },
  };


  /* ---------- word-garden ---------- */
  const wordGarden = {
    init(host) {
      let query = "";
      function allWords() {
        const seen = new Map();
        const push = (w) => {
          if (!w || !w.word) return;
          const id = (w.id || w.word).toLowerCase();
          if (!seen.has(id)) seen.set(id, w);
        };
        if (typeof WORDS !== "undefined") WORDS.forEach(push);
        if (typeof WORD_LIBRARY !== "undefined") WORD_LIBRARY.forEach(push);
        return Array.from(seen.values()).sort((a, b) => a.word.localeCompare(b.word));
      }
      function shortGloss(w) {
        if (w.meaning) return w.meaning;
        if (Array.isArray(w.kin)) {
          for (const k of w.kin) {
            if (k && typeof k === "object" && k.zh) return k.zh;
            if (typeof k === "string") return k;
          }
        }
        return "";
      }
      function filtered() {
        const all = allWords();
        if (!query) return all;
        return all.filter(w =>
          w.word.toLowerCase().includes(query) ||
          shortGloss(w).toLowerCase().includes(query)
        );
      }
      function rowHTML(w) {
        return `<li class="wg-row" data-id="${esc(w.id || w.word)}">
          <span class="wg-row-en">${esc(w.word)}</span>
          <span class="wg-row-zh">${esc(shortGloss(w))}</span>
        </li>`;
      }
      function renderTable() {
        const left  = host.querySelector("#wg-col-left");
        const right = host.querySelector("#wg-col-right");
        if (!left || !right) return;
        const list = filtered();
        const half = Math.ceil(list.length / 2);
        left.innerHTML  = list.slice(0, half).map(rowHTML).join("");
        right.innerHTML = list.slice(half).map(rowHTML).join("");
        host.querySelectorAll(".wg-row").forEach(row => {
          row.addEventListener("click", () => {
            const id = row.dataset.id;
            const entry = list.find(w => (w.id || w.word) === id);
            if (entry && typeof WordCard !== "undefined") WordCard.openDrawer(entry);
          });
        });
      }
      function renderAZ() {
        const az = host.querySelector("#wg-az");
        if (!az) return;
        const list = filtered();
        const has = new Set();
        list.forEach(w => has.add(w.word[0].toUpperCase()));
        const first = list[0] && list[0].word[0].toUpperCase();
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
        az.innerHTML = letters.map(L => {
          const cls = ["wg-az-letter"];
          if (!has.has(L)) cls.push("is-disabled");
          if (L === first) cls.push("is-current");
          return `<button type="button" class="${cls.join(" ")}" data-letter="${L}">${L}</button>`;
        }).join("");
        az.querySelectorAll(".wg-az-letter").forEach(btn => {
          btn.addEventListener("click", () => {
            if (btn.classList.contains("is-disabled")) return;
            az.querySelectorAll(".is-current").forEach(b => b.classList.remove("is-current"));
            btn.classList.add("is-current");
            const L = btn.dataset.letter;
            const target = list.find(w => w.word[0].toUpperCase() === L);
            if (!target) return;
            const node = host.querySelector(`.wg-row[data-id="${cssEsc(target.id || target.word)}"]`);
            if (node) node.scrollIntoView({ block: "center", behavior: "smooth" });
          });
        });
      }
      const search = host.querySelector("#wg-search");
      if (search) {
        search.addEventListener("input", (e) => {
          query = e.target.value.trim().toLowerCase();
          renderAZ(); renderTable();
        });
      }
      renderAZ(); renderTable();
    },
  };


  /* ---------- save / load ---------- */
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function nowStr() {
    const d = new Date();
    const p = n => (n < 10 ? "0" + n : "" + n);
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}  ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function slotHtml(slot, i, accent) {
    if (!slot) {
      return `<div class="slot ornate-panel is-strip is-clickable is-empty ${accent}" data-index="${i}">
        <div class="slot-no">Slot ${pad(i + 1)}</div>
        <div class="slot-empty">— Empty —</div>
        <div class="slot-meta">&nbsp;</div>
      </div>`;
    }
    const ch = (typeof getChapter === "function" && getChapter(slot.chapter))
             || { title: slot.chapter, number: "??" };
    const meta = slot.section
      ? `Section ${esc(slot.section)} · ${esc(slot.time || slot.savedAt || "")}`
      : `${esc(slot.position || "Page 1")} · ${esc(slot.time || slot.savedAt || "")}`;
    return `<div class="slot ornate-panel is-strip is-clickable ${accent}" data-index="${i}">
      <div class="slot-no">Slot ${pad(i + 1)} · Ch ${ch.number}</div>
      <div class="slot-chapter">${esc(ch.title)}</div>
      <div class="slot-meta">${meta}</div>
    </div>`;
  }
  function renderSlots(host, mode) {
    const grid = host.querySelector(".slot-grid");
    if (!grid) return;
    const slots = Storage.getSlots();
    const accent = mode === "save" ? "is-save" : "is-load";
    grid.innerHTML = slots.map((s, i) => slotHtml(s, i, accent)).join("");
    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".slot");
      if (!card) return;
      const i = +card.dataset.index;
      if (mode === "save") {
        let last = null;
        try { last = JSON.parse(localStorage.getItem("tpl.lastRead") || "null"); } catch (_) {}
        const chapterId = (last && last.chapter) || "universe";
        const sec       = (last && last.section) || "1.1";
        Storage.setSlot(i, {
          chapter: chapterId,
          section: sec,
          position: `Section ${sec}`,
          time: nowStr(),
        });
        window.toast && window.toast("Saved to Slot " + pad(i + 1));
        renderSlots(host, "save");
      } else {
        const slot = Storage.getSlots()[i];
        if (!slot) { window.toast && window.toast("Empty Slot"); return; }
        const sec = slot.section || "1.1";
        window.go(`#reading?chapter=${encodeURIComponent(slot.chapter)}&section=${encodeURIComponent(sec)}`);
      }
    });
  }
  const save = { init(host) { renderSlots(host, "save"); } };
  const load = { init(host) { renderSlots(host, "load"); } };


  return {
    splash, menu, select, chapters,
    reading, quiz, notes,
    "word-garden": wordGarden,
    save, load,
  };
})();
