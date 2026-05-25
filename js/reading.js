/* ============================================================
   The Princess Lexicon — reading.js
   Reading page: chapter rendering + clickable-word side pin.
   ============================================================ */

(function () {
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    const chapterId = qparam("chapter", "universe");
    const chapter = getChapterOrDefault(chapterId);

    document.querySelector("[data-chapter-number]").textContent =
      "Chapter " + chapter.number;
    document.querySelector("[data-chapter-title]").textContent  = chapter.title;
    document.querySelector("[data-chapter-section]").textContent =
      chapter.number + ".1 · The First Light";

    // Update illustration background (left column)
    const illus = document.querySelector(".reading-illus");
    if (illus && chapter.readingBg) {
      illus.style.backgroundImage =
        `linear-gradient(180deg, rgba(244,236,218,0) 0%, rgba(244,236,218,0.18) 100%), url("${chapter.readingBg}")`;
      illus.style.backgroundSize = "cover";
      illus.style.backgroundPosition = "left center";
      const ph = illus.querySelector(".illus-placeholder");
      if (ph) ph.style.display = "none";
    }

    // ----- clickable words -----
    document.querySelectorAll(".clickable-word").forEach(el => {
      el.addEventListener("click", () => {
        document.querySelectorAll(".clickable-word.is-active")
          .forEach(x => x.classList.remove("is-active"));
        el.classList.add("is-active");
        const word = getWord(el.dataset.word);
        renderSidePin(word);
      });
    });

    // ----- nav buttons -----
    const next = document.querySelector("[data-next]");
    if (next) next.addEventListener("click", () => {
      // Placeholder: real chapter sequencing TBD.
      toast("Next chapter — coming soon");
    });
    const quiz = document.querySelector("[data-quiz]");
    if (quiz) quiz.addEventListener("click", () => {
      window.go(`quiz.html?chapter=${chapter.id}`);
    });
  }

  function renderSidePin(word) {
    const host = document.querySelector(".side-pinned");
    if (!host) return;
    if (!word) {
      host.innerHTML = `<div class="pin-empty">Tap a word to pin</div>`;
      return;
    }
    const collocs = (word.collocations || [])
      .map(c => `<li>${escapeHtml(c)}</li>`).join("");
    const saved = Storage.isSaved(word.id);
    host.innerHTML = `
      <div class="pin-card">
        <div class="pin-label">Pinned Word</div>
        <div class="pin-word">${escapeHtml(word.word)}</div>
        <div class="pin-meaning">${escapeHtml(word.meaning)}</div>
        <ul class="pin-collocs">${collocs}</ul>
        <div class="pin-actions">
          <button type="button" class="btn btn-sm btn-ghost" data-act="view">View Full Card</button>
          <button type="button" class="btn btn-sm" data-act="save"
                  ${saved ? 'disabled aria-disabled="true"' : ''}>
            ${saved ? "Saved" : "Save to Notes"}
          </button>
        </div>
      </div>
    `;
    host.querySelector('[data-act="view"]').addEventListener("click",
      () => WordCard.openDrawer(word));
    const saveBtn = host.querySelector('[data-act="save"]');
    if (saveBtn && !saved) {
      saveBtn.addEventListener("click", () => {
        Storage.saveWord(word.id);
        saveBtn.textContent = "Saved";
        saveBtn.disabled = true;
        saveBtn.setAttribute("aria-disabled", "true");
        toast("Saved to Notes");
      });
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
