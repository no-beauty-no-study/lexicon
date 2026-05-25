/* ============================================================
   The Princess Lexicon — notes.js
   Notes page: left list of saved words, right detail pane.
   ============================================================ */

(function () {
  document.addEventListener("DOMContentLoaded", init);

  let active = null;

  function init() {
    const ids = Storage.getNotes();
    const words = ids.map(getWord).filter(Boolean);

    const list = document.querySelector(".word-list");
    const detail = document.querySelector(".detail-pane");
    const countEl = document.querySelector("[data-notes-count]");
    if (countEl) countEl.textContent = words.length + " saved";

    if (words.length === 0) {
      list.innerHTML = `<li class="empty-state" style="margin:20px 0;">
        No saved words yet
      </li>`;
      detail.innerHTML = `<div class="empty-state">Empty Notes</div>`;
      return;
    }

    list.innerHTML = words.map(w => `
      <li class="word-list-item" data-id="${w.id}">
        <span class="wli-word">${esc(w.word)}</span>
        <span class="wli-meaning">${esc(w.meaning)}</span>
      </li>
    `).join("");

    list.addEventListener("click", e => {
      const li = e.target.closest(".word-list-item");
      if (!li) return;
      select(li.dataset.id);
    });

    select(words[0].id);
  }

  function select(id) {
    active = id;
    document.querySelectorAll(".word-list-item").forEach(li => {
      li.classList.toggle("is-active", li.dataset.id === id);
    });
    const w = getWord(id);
    document.querySelector(".detail-pane").innerHTML =
      WordCard.renderFullBody(w);
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
