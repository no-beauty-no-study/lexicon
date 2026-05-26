/* ============================================================
   The Princess Lexicon — reading.js
   Reading page: real chapter content + invisible-ink reveal +
   per-block audio + auto-detected clickable words + side note.
   ============================================================ */

(function () {
  document.addEventListener("DOMContentLoaded", init);

  /** Build a Set of lowercase word ids that we'll mark as clickable
      in the text. Comes from WORD_LIBRARY plus any curated WORDS (mocks). */
  function buildClickableWords() {
    const set = new Set();
    if (typeof WORD_LIBRARY !== "undefined") {
      for (const w of WORD_LIBRARY) set.add(w.id.toLowerCase());
    }
    if (typeof WORDS !== "undefined") {
      for (const w of WORDS) set.add(w.id.toLowerCase());
    }
    return set;
  }

  /** Look up a word — mock takes precedence, then library.
      Returns null if unknown. */
  function lookupWord(id) {
    if (typeof WORDS_BY_ID !== "undefined" && WORDS_BY_ID[id]) return WORDS_BY_ID[id];
    if (typeof WORD_LIBRARY_BY_ID !== "undefined" && WORD_LIBRARY_BY_ID[id]) {
      return WORD_LIBRARY_BY_ID[id];
    }
    // Fallback: try lowercase match
    const lc = id.toLowerCase();
    if (typeof WORDS !== "undefined") {
      const m = WORDS.find(w => w.id.toLowerCase() === lc);
      if (m) return m;
    }
    if (typeof WORD_LIBRARY !== "undefined") {
      const m = WORD_LIBRARY.find(w => w.id.toLowerCase() === lc);
      if (m) return m;
    }
    return null;
  }

  /** Wrap clickable words in a sentence with <span> tags. Only the
      first occurrence of each matched id per sentence is wrapped, to
      keep the page readable. */
  function markClickable(sentence, clickableSet) {
    const used = new Set();
    return sentence.replace(/[A-Za-z][a-zA-Z'-]*/g, (m) => {
      const lc = m.toLowerCase();
      if (used.has(lc)) return m;
      if (!clickableSet.has(lc)) return m;
      used.add(lc);
      return `<span class="clickable-word" data-word="${lc}">${m}</span>`;
    });
  }

  function init() {
    const chapterId = qparam("chapter", "universe");
    const sectionNum = qparam("section", "1.1");
    const book = (typeof getChapterOrDefault === "function")
      ? getChapterOrDefault(chapterId) : { number: "01", title: chapterId, readingBg: "" };
    const section = ChapterNav.findSection(chapterId, sectionNum);

    // Header text
    document.querySelector("[data-chapter-number]").textContent =
      "Chapter " + book.number;
    document.querySelector("[data-chapter-title]").textContent  = book.title;
    document.querySelector("[data-chapter-section]").textContent =
      section ? (section.number + " · " + section.title) : sectionNum;

    // Left illustration background
    const illus = document.querySelector(".reading-illus");
    if (illus && book.readingBg) {
      illus.style.backgroundImage =
        `linear-gradient(180deg, rgba(244,236,218,0) 0%, rgba(244,236,218,0.18) 100%), url("${book.readingBg}")`;
      illus.style.backgroundSize = "cover";
      illus.style.backgroundPosition = "left center";
      const ph = illus.querySelector(".illus-placeholder");
      if (ph) ph.style.display = "none";
    }

    // Render reveal blocks
    const body = document.querySelector(".reading-body");
    if (section && section.blocks && section.blocks.length) {
      const clickable = buildClickableWords();
      body.innerHTML = section.blocks.map((sent, i) => {
        const audio = `${section.audio_prefix}-${i + 1}.mp3`;
        return `<p class="reveal-block" data-audio="${audio}">${markClickable(sent, clickable)}</p>`;
      }).join("");
    } else {
      body.innerHTML = `<p class="reveal-block">No content available yet for this section.</p>`;
    }

    // Side note init
    renderSideNote(null);

    // Word click handler (delegated)
    body.addEventListener("click", e => {
      const el = e.target.closest(".clickable-word");
      if (!el) return;
      e.stopPropagation();   // do not trigger reveal-next
      document.querySelectorAll(".clickable-word.is-active")
        .forEach(x => x.classList.remove("is-active"));
      el.classList.add("is-active");
      renderSideNote(lookupWord(el.dataset.word));
    });

    // Reveal engine
    Reveal.init({
      container: ".reading-main",
      overlaySelector: ".tap-overlay",
    });

    // Bottom nav buttons
    const next = document.querySelector("[data-next]");
    if (next) next.addEventListener("click", () =>
      window.go(ChapterNav.nextAfterReading(chapterId, sectionNum)));
    const quiz = document.querySelector("[data-quiz]");
    if (quiz) quiz.addEventListener("click", () =>
      window.go(`quiz.html?chapter=${encodeURIComponent(chapterId)}&section=${encodeURIComponent(sectionNum)}`));
    const back = document.querySelector("[data-back]");
    if (back) back.addEventListener("click", () =>
      window.go(ChapterNav.prevBeforeReading(chapterId, sectionNum)));
  }

  /** Render the right-column side-note. Strictly minimal: word + 2
      collocations + FULL CARD + SAVE. No Chinese, no family/friend. */
  function renderSideNote(word) {
    const host = document.querySelector(".side-pinned");
    if (!host) return;

    if (!word) {
      host.innerHTML =
        `<div class="reading-side-note is-empty">Tap a word to pin</div>`;
      return;
    }

    // Pick up to 2 collocations. mockWords has w.collocations; library
    // entries have kin[i].phrases — fall back to the first 2 phrases.
    let collocs = (word.collocations || []).slice(0, 2);
    if (collocs.length < 2 && Array.isArray(word.kin) && word.kin.length) {
      for (const k of word.kin) {
        if (k.phrases) for (const p of k.phrases) {
          if (collocs.length < 2 && p.en && !collocs.includes(p.en)) collocs.push(p.en);
        }
      }
    }

    const saved = Storage.isSaved(word.id);
    host.innerHTML = `
      <div class="reading-side-note">
        <h3 class="side-note-word">${esc(word.word || word.id)}</h3>
        <ul class="side-note-collocations">
          ${collocs.map(c => `<li>${esc(c)}</li>`).join("") || ""}
        </ul>
        <div class="side-note-actions">
          <button type="button" class="side-note-button" data-act="full">Full Card</button>
          <button type="button" class="side-note-button" data-act="save"
                  ${saved ? "disabled" : ""}>
            ${saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>
    `;
    host.querySelector('[data-act="full"]').addEventListener("click", e => {
      e.stopPropagation();
      WordCard.openDrawer(word);
    });
    const saveBtn = host.querySelector('[data-act="save"]');
    if (saveBtn && !saved) {
      saveBtn.addEventListener("click", e => {
        e.stopPropagation();
        Storage.saveWord(word.id);
        saveBtn.textContent = "Saved";
        saveBtn.disabled = true;
        toast("Saved to Notes");
      });
    }
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
