/* ============================================================
   The Princess Lexicon — reading.js
   Painted-UI reading page. The chapter illustration jpg is the
   full page UI; we only inject text overlays at the painted slots.
   ============================================================ */

(function () {
  document.addEventListener("DOMContentLoaded", init);

  function buildClickableSet() {
    const s = new Set();
    if (typeof WORD_LIBRARY !== "undefined") for (const w of WORD_LIBRARY) s.add(w.id.toLowerCase());
    if (typeof WORDS !== "undefined") for (const w of WORDS) s.add(w.id.toLowerCase());
    return s;
  }

  function lookupWord(id) {
    const lc = id.toLowerCase();
    if (typeof WORDS_BY_ID !== "undefined" && WORDS_BY_ID[lc]) return WORDS_BY_ID[lc];
    if (typeof WORD_LIBRARY_BY_ID !== "undefined" && WORD_LIBRARY_BY_ID[lc]) return WORD_LIBRARY_BY_ID[lc];
    return null;
  }

  function markClickable(sentence, clickable) {
    const used = new Set();
    return sentence.replace(/[A-Za-z][a-zA-Z'-]*/g, (m) => {
      const lc = m.toLowerCase();
      if (used.has(lc) || !clickable.has(lc)) return m;
      used.add(lc);
      return `<span class="clickable-word" data-word="${lc}">${m}</span>`;
    });
  }

  function init() {
    const chapterId = qparam("chapter", "universe");
    const sectionNum = qparam("section", "1.1");
    const illustrationId = qparam("page", null);  // optional sub-illustration
    const book = getChapterOrDefault(chapterId);
    const section = ChapterNav.findSection(chapterId, sectionNum);
    const page = document.querySelector(".page");

    // 1. Painted UI background — chapter illustration jpg.
    const bg = getChapterBackground(chapterId, illustrationId);
    if (bg) page.style.backgroundImage = `url("${bg}")`;

    // 2. Title overlays in the painted centre slot.
    document.querySelector("[data-chapter-number]").textContent =
      "Chapter " + book.number;
    document.querySelector("[data-chapter-title]").textContent  = book.title;
    document.querySelector("[data-chapter-section]").textContent =
      section ? (section.number + " · " + section.title) : sectionNum;

    // 3. Reveal blocks.
    const body = document.querySelector(".reading-body");
    if (section && section.blocks && section.blocks.length) {
      const clickable = buildClickableSet();
      body.innerHTML = section.blocks.map((sent, i) => {
        const audio = `${section.audio_prefix}-${i + 1}.mp3`;
        return `<p class="reveal-block" data-audio="${audio}">${markClickable(sent, clickable)}</p>`;
      }).join("");
    } else {
      body.innerHTML = `<p class="reveal-block">No content available yet for this section.</p>`;
    }

    // 4. Marginalia init.
    renderMarginalia(null);

    // Word click — pin to marginalia (DO NOT bubble to reveal trigger).
    body.addEventListener("click", e => {
      const el = e.target.closest(".clickable-word");
      if (!el) return;
      e.stopPropagation();
      document.querySelectorAll(".clickable-word.is-active")
        .forEach(x => x.classList.remove("is-active"));
      el.classList.add("is-active");
      renderMarginalia(lookupWord(el.dataset.word));
    });

    // Reveal engine — taps anywhere on the page reveal next block,
    // except on interactive children.
    Reveal.init({
      container: ".page",
      overlaySelector: ".tap-overlay",
    });

    // Bottom nav.
    const next = document.querySelector("[data-next]");
    if (next) next.addEventListener("click", e => {
      e.stopPropagation();
      window.go(ChapterNav.nextAfterReading(chapterId, sectionNum));
    });
    const quiz = document.querySelector("[data-quiz]");
    if (quiz) quiz.addEventListener("click", e => {
      e.stopPropagation();
      window.go(`quiz.html?chapter=${encodeURIComponent(chapterId)}&section=${encodeURIComponent(sectionNum)}`);
    });
    const back = document.querySelector("[data-back]");
    if (back) back.addEventListener("click", e => {
      e.stopPropagation();
      window.go(ChapterNav.prevBeforeReading(chapterId, sectionNum));
    });
  }

  /** Marginalia: word + up to 2 collocations + FULL CARD + SAVE.
      No frame, no Chinese, no family/friend/kin/example — ink only. */
  function renderMarginalia(word) {
    const host = document.querySelector(".side-pinned");
    if (!host) return;

    if (!word) {
      host.innerHTML = `<div class="marginalia-word" style="opacity:0.55; font-size:11px; letter-spacing:0.16em; text-transform:uppercase; font-family:var(--font-display); color:var(--paper-muted);">tap a word</div>`;
      return;
    }

    let collocs = (word.collocations || []).slice(0, 2);
    if (collocs.length < 2 && Array.isArray(word.kin)) {
      for (const k of word.kin) {
        if (k.phrases) for (const p of k.phrases) {
          if (collocs.length < 2 && p.en && !collocs.includes(p.en)) collocs.push(p.en);
        }
      }
    }

    const saved = Storage.isSaved(word.id);
    host.innerHTML = `
      <h3 class="marginalia-word">${esc(word.word || word.id)}</h3>
      <ul class="marginalia-list">
        ${collocs.map(c => `<li>${esc(c)}</li>`).join("")}
      </ul>
      <div class="marginalia-actions">
        <button type="button" data-act="full">Full Card</button>
        <button type="button" data-act="save" ${saved ? "disabled" : ""}>${saved ? "Saved" : "Save"}</button>
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
