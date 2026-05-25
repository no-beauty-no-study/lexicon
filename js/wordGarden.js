/* ============================================================
   The Princess Lexicon — wordGarden.js
   Word Garden: search-filterable 2-column list + detail pane.
   ============================================================ */

(function () {
  document.addEventListener("DOMContentLoaded", init);

  let activeId = null;
  let query = "";

  function init() {
    const search = document.querySelector(".search-input");
    if (search) {
      search.addEventListener("input", e => {
        query = e.target.value.trim().toLowerCase();
        render();
      });
    }
    render();
  }

  function visibleWords() {
    if (!query) return WORDS;
    return WORDS.filter(w =>
      w.word.toLowerCase().includes(query) ||
      (w.meaning && w.meaning.toLowerCase().includes(query))
    );
  }

  function render() {
    const list = document.querySelector(".wg-list-grid");
    const words = visibleWords();
    const countEl = document.querySelector("[data-wg-count]");
    if (countEl) countEl.textContent =
      words.length + " / " + WORDS.length + " words";

    if (words.length === 0) {
      list.innerHTML = `<li class="empty-state" style="grid-column:1/-1;margin:20px 0;">
        No words match "${esc(query)}"
      </li>`;
    } else {
      list.innerHTML = words.map(w => `
        <li class="word-list-item${w.id === activeId ? ' is-active' : ''}"
            data-id="${w.id}">
          <span class="wli-word">${esc(w.word)}</span>
          <span class="wli-meaning">${esc(w.meaning)}</span>
        </li>
      `).join("");
    }
    if (!activeId && words[0]) select(words[0].id, false);
    else renderDetail();
  }

  function select(id, rerender = true) {
    activeId = id;
    if (rerender) render();
    else renderDetail();
  }

  function renderDetail() {
    document.querySelector(".detail-pane").innerHTML =
      WordCard.renderFullBody(getWord(activeId));
    document.querySelectorAll(".word-list-item").forEach(li => {
      li.classList.toggle("is-active", li.dataset.id === activeId);
    });
  }

  document.addEventListener("click", e => {
    const li = e.target.closest(".wg-list-grid .word-list-item");
    if (li) select(li.dataset.id);
  });

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
