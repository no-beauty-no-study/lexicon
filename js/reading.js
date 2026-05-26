/* ============================================================
   The Princess Lexicon — reading.js
   Painted-UI reading page. The chapter illustration jpg is the
   full UI; we only inject text into the painted slots.
   Word system: surface words are matched via WORD_TO_HEADS reverse
   index (head + family[].word + kin[].word). Clicking a sub-word
   opens its parent head's card with a relation label.
   ============================================================ */
(function () {
  document.addEventListener("DOMContentLoaded", init);

  function relationLabel(type) {
    if (type === "family") return "family";
    if (type === "kin")    return "kin";
    return null;
  }

  // Build the body HTML, wrapping every surface form that is indexed
  // (head OR family OR kin) in a <span class="clickable-word">.
  function markClickable(sentence) {
    const used = new Set();
    return sentence.replace(/[A-Za-z][a-zA-Z'-]*/g, (m) => {
      const lc = m.toLowerCase();
      if (used.has(lc) || !hasClickableWord(lc)) return m;
      used.add(lc);
      return `<span class="clickable-word" data-word="${lc}">${m}</span>`;
    });
  }

  function init() {
    const chapterId      = qparam("chapter", "universe");
    const sectionNum     = qparam("section", "1.1");
    const illustrationId = qparam("page", null);
    const book           = getChapterOrDefault(chapterId);
    const section        = ChapterNav.findSection(chapterId, sectionNum);
    const page           = document.querySelector(".page");

    // Painted UI background per chapter.
    const bg = getChapterBackground(chapterId, illustrationId);
    if (bg) page.style.backgroundImage = `url("${bg}")`;

    // Title overlays.
    document.querySelector("[data-chapter-number]").textContent =
      "Chapter " + book.number;
    document.querySelector("[data-chapter-title]").textContent  = book.title;
    document.querySelector("[data-chapter-section]").textContent =
      section ? (section.number + " · " + section.title) : sectionNum;

    // Reveal blocks.
    const body = document.querySelector(".reading-body");
    if (section && section.blocks && section.blocks.length) {
      body.innerHTML = section.blocks.map((sent, i) => {
        const audio = `${section.audio_prefix}-${i + 1}.mp3`;
        return `<p class="reveal-block" data-audio="${audio}">${markClickable(sent)}</p>`;
      }).join("");
    } else {
      body.innerHTML = `<p class="reveal-block">No content available yet for this section.</p>`;
    }

    let currentEntry = null;            // last selected word's head entry
    renderMarginalia(null);
    wireMarginaliaButtons(chapterId, sectionNum);

    body.addEventListener("click", (e) => {
      const el = e.target.closest(".clickable-word");
      if (!el) return;
      e.stopPropagation();
      document.querySelectorAll(".clickable-word.is-selected")
        .forEach(x => x.classList.remove("is-selected"));
      el.classList.add("is-selected");
      const resolved = resolveClickedWord(el.dataset.word);
      currentEntry = (resolved && resolved.headEntry) || null;
      renderMarginalia(resolved);
      syncMarginaliaButtons(currentEntry);
    });

    function wireMarginaliaButtons(chapterId, sectionNum) {
      const fold = document.querySelector('.marginalia-btn[data-action="fold"]');
      const save = document.querySelector('.marginalia-btn[data-action="save"]');
      if (fold) fold.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!currentEntry) return;
        const id = currentEntry.id || currentEntry.word;
        if (Storage.isSaved(id)) return;
        Storage.saveWord(id);
        syncMarginaliaButtons(currentEntry);
        toast("Folded into Notes");
      });
      if (save) save.addEventListener("click", (e) => {
        e.stopPropagation();
        // Save chapter bookmark so the reader can return to this exact
        // section even if local state would otherwise be cleared.
        try { Storage.saveChapter(chapterId, sectionNum); } catch(_) {}
        save.classList.add("is-active");
        toast("Chapter saved");
        setTimeout(() => save.classList.remove("is-active"), 1200);
      });
    }

    // Sync the FOLD button's enabled/active state to the current word.
    function syncMarginaliaButtons(entry) {
      const fold = document.querySelector('.marginalia-btn[data-action="fold"]');
      if (!fold) return;
      if (!entry) {
        fold.disabled = true;
        fold.classList.remove("is-active");
        return;
      }
      const id = entry.id || entry.word;
      if (Storage.isSaved(id)) {
        fold.disabled = true;
        fold.classList.add("is-active");
      } else {
        fold.disabled = false;
        fold.classList.remove("is-active");
      }
    }

    // Reveal — tap on .page reveals next block; interactive children stop it.
    Reveal.init({
      container: ".page",
      overlaySelector: ".tap-overlay",
    });

    // Bottom nav — stop bubble so reveal doesn't fire.
    const next = document.querySelector("[data-next]");
    if (next) next.addEventListener("click", (e) => {
      e.stopPropagation();
      window.go(ChapterNav.nextAfterReading(chapterId, sectionNum));
    });
    const back = document.querySelector("[data-back]");
    if (back) back.addEventListener("click", (e) => {
      e.stopPropagation();
      window.go(ChapterNav.prevBeforeReading(chapterId, sectionNum));
    });
    const quiz = document.querySelector("[data-quiz]");
    if (quiz) quiz.addEventListener("click", (e) => {
      e.stopPropagation();
      window.go(`quiz.html?chapter=${encodeURIComponent(chapterId)}&section=${encodeURIComponent(sectionNum)}`);
    });
  }

  /** Marginalia body. Renders into .marginalia-card-body only —
      header + buttons are fixed pieces of the card (see reading.html)
      and never get rewritten. Card spec:
        - headword (clickable → drawer)
        - 1-2 short collocations
      Anything longer goes to the drawer (WordCard.openDrawer). */
  function renderMarginalia(resolved) {
    const body = document.querySelector(".marginalia-card-body");
    if (!body) return;

    if (!resolved || !resolved.headEntry) {
      body.innerHTML = `<div class="marginalia-card-empty">Tap a word</div>`;
      return;
    }
    const entry = resolved.headEntry;

    let collocs = (entry.collocations || []).slice(0, 2);
    if (collocs.length < 2 && Array.isArray(entry.kin)) {
      for (const k of entry.kin) {
        if (k && typeof k === "object" && Array.isArray(k.phrases)) {
          for (const p of k.phrases) {
            if (collocs.length >= 2) break;
            if (p && p.en && !collocs.includes(p.en)) collocs.push(p.en);
          }
        }
      }
    }

    body.innerHTML = `
      <h3 class="marginalia-headword">${esc(entry.word || entry.id)}</h3>
      <ul class="marginalia-collocations">
        ${collocs.map(c => `<li>${esc(c)}</li>`).join("")}
      </ul>
    `;
    const hw = body.querySelector(".marginalia-headword");
    if (hw) hw.addEventListener("click", (e) => {
      e.stopPropagation();
      try { WordCard.openDrawer(entry); } catch(_) {}
    });
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
