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

    // The single source of truth for "which word is the FOLD button
    // pointing at" is the .word-card.is-current node in the stack.
    // We resolve back to an entry by looking up its data-id whenever
    // something needs the live selection.
    function currentEntryFromStack() {
      const cur = document.querySelector(".word-card.is-current");
      if (!cur) return null;
      const id = cur.dataset.id;
      return (typeof WORDS !== "undefined" && WORDS.find(w => (w.id || w.word) === id))
          || (typeof WORD_LIBRARY !== "undefined" && WORD_LIBRARY.find(w => (w.id || w.word) === id))
          || null;
    }
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
      renderMarginalia(resolved);
      syncMarginaliaButtons(currentEntryFromStack());
    });
    // Refresh the FOLD button whenever a stack card is highlighted.
    document.addEventListener("click", (e) => {
      if (e.target.closest(".word-card")) {
        setTimeout(() => syncMarginaliaButtons(currentEntryFromStack()), 0);
      }
    });

    function wireMarginaliaButtons(chapterId, sectionNum) {
      const fold = document.querySelector('.marginalia-btn[data-action="fold"]');
      const save = document.querySelector('.marginalia-btn[data-action="save"]');
      if (fold) fold.addEventListener("click", (e) => {
        e.stopPropagation();
        const entry = currentEntryFromStack();
        if (!entry) return;
        const id = entry.id || entry.word;
        if (Storage.isSaved(id)) return;
        Storage.saveWord(id);
        syncMarginaliaButtons(entry);
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
    // Speak the chapter title aloud on first tap (before the first block),
    // then each tap reveals + auto-speaks the next sentence.
    let titleSpoken = false;
    Reveal.init({
      container: ".page",
      overlaySelector: ".tap-overlay",
      onReveal: (block, i) => {
        if (titleSpoken || i !== 0) return;
        titleSpoken = true;
        const t1 = document.querySelector("[data-chapter-title]")?.textContent || "";
        const t2 = document.querySelector("[data-chapter-section]")?.textContent || "";
        // Speak title BEFORE the first sentence by queueing a short
        // utterance ahead of whatever the block's audio is playing.
        Reveal.speak((t1 + ". " + t2).trim());
      },
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

  /** Marginalia stack. Click a word → push a mini word-card here.
      When the stack already holds MAX_CARDS items, the oldest is
      overwritten in place (circular buffer). The most-recently-
      added card is .is-current and is what FOLD bookmarks. */
  const MAX_CARDS = 6;
  let stackSlot = 0;            // next index to overwrite once full

  function shortMeaning(entry) {
    if (entry.meaning) return entry.meaning;
    if (Array.isArray(entry.kin)) {
      for (const k of entry.kin) {
        if (k && typeof k === "object" && k.zh) return k.zh;
        if (typeof k === "string") return k;
      }
    }
    if (Array.isArray(entry.collocations) && entry.collocations[0]) {
      return entry.collocations[0];
    }
    return "";
  }

  function clearCurrent(stack) {
    stack.querySelectorAll(".word-card.is-current")
         .forEach(c => c.classList.remove("is-current"));
  }

  function renderMarginalia(resolved) {
    const stack = document.querySelector(".word-card-stack");
    if (!stack) return;
    if (!resolved || !resolved.headEntry) return;
    const entry = resolved.headEntry;
    const id = entry.id || entry.word;

    // Drop the empty hint the first time a card lands.
    const empty = stack.querySelector(".word-card-empty");
    if (empty) empty.remove();

    // If the same word is already in the stack, just highlight it.
    const existing = stack.querySelector(`.word-card[data-id="${cssEsc(id)}"]`);
    if (existing) {
      clearCurrent(stack);
      existing.classList.add("is-current");
      return;
    }

    const html = `
      <div class="word-card is-current" data-id="${esc(id)}">
        <div class="word-card-headword">${esc(entry.word || id)}</div>
        <div class="word-card-meaning">${esc(shortMeaning(entry))}</div>
      </div>`;
    clearCurrent(stack);
    const cards = stack.querySelectorAll(".word-card");
    if (cards.length < MAX_CARDS) {
      stack.insertAdjacentHTML("beforeend", html);
    } else {
      // Replace the oldest slot and advance the cursor.
      const tmp = document.createElement("template");
      tmp.innerHTML = html.trim();
      const fresh = tmp.content.firstElementChild;
      cards[stackSlot].replaceWith(fresh);
      stackSlot = (stackSlot + 1) % MAX_CARDS;
    }
    // Each card opens the drawer when clicked.
    stack.querySelectorAll(".word-card").forEach(card => {
      if (card.dataset.wired) return;
      card.dataset.wired = "1";
      card.addEventListener("click", (e) => {
        e.stopPropagation();
        clearCurrent(stack);
        card.classList.add("is-current");
        try {
          const cid = card.dataset.id;
          const ent = (typeof WORDS !== "undefined" && WORDS.find(w => (w.id || w.word) === cid))
                   || (typeof WORD_LIBRARY !== "undefined" && WORD_LIBRARY.find(w => (w.id || w.word) === cid));
          if (ent) WordCard.openDrawer(ent);
        } catch(_) {}
      });
    });
  }

  function cssEsc(s) {
    return String(s).replace(/["\\\n\r]/g, c =>
      c === '"' ? '\\"' : c === '\\' ? '\\\\' : '');
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
