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

    renderMarginalia(null);

    // Word click → select + show marginalia for the resolved head.
    // stopPropagation so the click doesn't trigger Reveal next-block.
    body.addEventListener("click", (e) => {
      const el = e.target.closest(".clickable-word");
      if (!el) return;
      e.stopPropagation();

      document.querySelectorAll(".clickable-word.is-selected")
        .forEach(x => x.classList.remove("is-selected"));
      el.classList.add("is-selected");

      const resolved = resolveClickedWord(el.dataset.word);
      renderMarginalia(resolved);
    });

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
  }

  /** Marginalia panel. `resolved` is the output of resolveClickedWord
      ({head, type, relationWord, headEntry}) or null. */
  function renderMarginalia(resolved) {
    const host = document.querySelector(".side-pinned");
    if (!host) return;

    if (!resolved || !resolved.headEntry) {
      host.innerHTML = `<div class="marginalia-hint">Tap a word</div>`;
      return;
    }
    const entry = resolved.headEntry;
    const rel   = relationLabel(resolved.type);
    const showRelation = rel && resolved.relationWord.toLowerCase() !== (entry.word || "").toLowerCase();

    // Collocations: prefer entry.collocations, else first 2 phrases from kin.
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

    const saved = Storage.isSaved(entry.id || entry.word);
    host.innerHTML = `
      <h3 class="marginalia-word">${esc(entry.word || entry.id)}</h3>
      ${showRelation
        ? `<div class="marginalia-relation">via <strong>${esc(resolved.relationWord)}</strong> · ${rel}</div>`
        : ""}
      <ul class="marginalia-collocations">
        ${collocs.map(c => `<li>${esc(c)}</li>`).join("")}
      </ul>
      <div class="marginalia-actions">
        <button type="button" class="antique-mini-button" data-act="full">Full</button>
        <button type="button" class="antique-mini-button" data-act="save" ${saved ? "disabled" : ""}>${saved ? "Saved" : "Save"}</button>
      </div>
    `;
    host.querySelector('[data-act="full"]').addEventListener("click", (e) => {
      e.stopPropagation();
      WordCard.openDrawer(entry);
    });
    const saveBtn = host.querySelector('[data-act="save"]');
    if (saveBtn && !saved) {
      saveBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        Storage.saveWord(entry.id || entry.word);
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
