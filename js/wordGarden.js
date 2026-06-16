/* ============================================================
   The Princess Lexicon — wordGarden.js
   Two-column A–Z word table. Source: WORDS (curated) merged with
   WORD_LIBRARY (auto-generated), de-duped by id/word, sorted A–Z.
   Each row = English word + Chinese gloss; rows split into two
   columns of equal length so the page reads as a real dictionary.
   ============================================================ */
(function () {
  document.addEventListener("DOMContentLoaded", init);

  let query = "";

  function init() {
    const search = document.getElementById("wg-search");
    if (search) {
      search.addEventListener("input", (e) => {
        query = e.target.value.trim().toLowerCase();
        renderAZ();
        renderTable();
      });
    }
    renderAZ();
    renderTable();
  }

  /* ----- data ----- */
  function allWords() {
    const seen = new Map();
    const push = (w) => {
      if (!w || !w.word) return;
      const id = (w.id || w.word).toLowerCase();
      if (!seen.has(id)) seen.set(id, w);
    };
    if (typeof WORDS !== "undefined") WORDS.forEach(push);
    if (typeof WORD_LIBRARY !== "undefined") WORD_LIBRARY.forEach(push);
    return Array.from(seen.values())
      .sort((a, b) => a.word.localeCompare(b.word));
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

  /* ----- A–Z directory ----- */
  function renderAZ() {
    const az = document.getElementById("wg-az");
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
        const node = document.querySelector(`.wg-row[data-id="${cssEsc(target.id || target.word)}"]`);
        if (node) node.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    });
  }

  /* ----- table ----- */
  function renderTable() {
    const left  = document.getElementById("wg-col-left");
    const right = document.getElementById("wg-col-right");
    if (!left || !right) return;
    const list = filtered();
    const half = Math.ceil(list.length / 2);
    const a = list.slice(0, half);
    const b = list.slice(half);
    left.innerHTML  = a.map(rowHTML).join("");
    right.innerHTML = b.map(rowHTML).join("");
    // Click a row → open the word drawer.
    document.querySelectorAll(".wg-row").forEach(row => {
      row.addEventListener("click", () => {
        const id = row.dataset.id;
        const entry = list.find(w => (w.id || w.word) === id);
        if (entry && typeof WordCard !== "undefined" && WordCard.openDrawer) {
          WordCard.openDrawer(entry);
        }
      });
    });
  }

  function rowHTML(w) {
    return `
      <li class="wg-row" data-id="${esc(w.id || w.word)}">
        <span class="wg-row-en">${esc(w.word)}</span>
        <span class="wg-row-zh">${esc(shortGloss(w))}</span>
      </li>`;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function cssEsc(s) {
    return String(s).replace(/["\\\n\r]/g, c =>
      c === '"' ? '\\"' : c === '\\' ? '\\\\' : '');
  }
})();
