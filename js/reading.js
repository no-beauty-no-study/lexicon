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

    // Remember where the reader is — so the menu's START READING
    // button (and Select's Story arch) can resume to exactly this
    // page next session. localStorage so it survives a full close.
    // SKIP when ?browse=1 is in the URL (user came from menu's
    // ENTER CHAPTER → chapter index → this chapter, in 'browse /
    // explore mode'). That mode shouldn't overwrite the user's
    // main 'continue game' position.
    const isBrowse = qparam("browse", null) === "1";
    if (!isBrowse) {
      try {
        localStorage.setItem("tpl.lastRead", JSON.stringify({
          chapter: chapterId,
          section: sectionNum,
          page:    illustrationId,
          at:      Date.now(),
        }));
      } catch (_) {}
    }

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
      // User spec: '点击 reading 里的单词：播放右列单词 + 2 词组的语音 +
      // 文章中单词背景变黄'. The yellow highlight is .is-selected
      // above; the audio sequence is the surface word followed by the
      // (up to 2) collocations rendered into the side card.
      try {
        const entry = (resolved && (resolved.clickEntry || resolved.headEntry));
        const phrases = entry ? getPhrasePairs(entry).slice(0, 2) : [];
        const parts = [el.textContent, ...phrases.map(p => p.en)].filter(Boolean);
        Reveal.speak(parts.join(". "));
      } catch (_) {}
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

    // Reveal — tap anywhere on .page reveals next block. There is no
    // tap-overlay; on the very FIRST tap the chapter heading is
    // spoken first by prepending it to the first block's TTS text.
    const firstBlock = body.querySelector(".reveal-block");
    if (firstBlock) {
      const t1 = (document.querySelector("[data-chapter-title]")?.textContent || "").trim();
      const t2 = (document.querySelector("[data-chapter-section]")?.textContent || "").trim();
      const intro = [t1, t2].filter(Boolean).join(". ");
      firstBlock.dataset.speakText = intro
        ? `${intro}. ${firstBlock.textContent}`
        : firstBlock.textContent;
    }
    Reveal.init({
      container: ".page",
      onReveal: (block, i) => {
        // Per user spec: 'reading 的标题也需要先是若隐若现的 然后点击念出来'.
        // The first tap reveals BOTH the chapter title block AND
        // the first sentence; subsequent taps only reveal the
        // next reveal-block.
        if (i === 0) {
          document.querySelector(".zone-reading-title")?.classList.add("is-revealed");
        }
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

  /** Marginalia stack. Click a word → append a mini word-card here.
      Cards are NOT recycled — the container scrolls. Each card has
      6 rows per user spec:
        word
        translation
        phrase 1
        phrase 1 translation
        phrase 2
        phrase 2 translation
      The most-recently-added card is .is-current and is what FOLD
      bookmarks; it auto-scrolls into view. */

  /** Return ONLY the entry's own meaning. Auto-generated heads
      have empty meaning — we used to fall back to kin[0].zh, but
      kin[0] is a DIFFERENT word (e.g. clicking 'condense' showed
      '冷凝器' which is condenser's gloss). That confused the user.
      Empty is now empty; the phrases below the card still convey
      collocation context, and the parent drawer shows the full
      family if more detail is wanted. */
  function shortMeaning(entry) {
    return entry.meaning || "";
  }

  /** Up to two phrase pairs {en, zh}. Tries (in order):
        entry.phrases  — set by wordIndex.resolveClickedWord when the
                         clicked word was a kin sub-word.
        entry.kin[].phrases  — for head-word entries.
        entry.friend         — curated 'en … zh' strings.
        entry.collocations   — last resort, en-only. */
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

  function clearCurrent(stack) {
    stack.querySelectorAll(".word-card.is-current")
         .forEach(c => c.classList.remove("is-current"));
  }

  function renderMarginalia(resolved) {
    const stack = document.querySelector(".word-card-stack");
    if (!stack) return;
    // Use the SUB-WORD entry, not the head's. resolveClickedWord
    // synthesises this when the clicked word is a kin / family
    // derivative so the card shows the right translation + phrases.
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
    // Per user: side card now shows just 'word / zh / phrase1 /
    // phrase2' — 4 rows. No phrase translations, no internal
    // sub-section separators, no yellow highlight on individual
    // phrases. The WHOLE card is one clickable unit that opens
    // the parent's family drawer.
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
    // Capture the head entry IN THE CLOSURE so the side-card click
    // doesn't have to look it up in WORDS / WORD_LIBRARY (those
    // lookups silently returned undefined for entries that lived in
    // only one of the two arrays — the drawer never opened).
    const drawerEntry = resolved.headEntry || entry;
    fresh.addEventListener("click", (e) => {
      e.stopPropagation();
      clearCurrent(stack);
      fresh.classList.add("is-current");
      // User: '点击右列小词卡只是一个唤出抽屉的功能' — no audio here.
      if (typeof WordCard !== "undefined" && drawerEntry) {
        WordCard.openDrawer(drawerEntry);
      }
    });
    fresh.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
