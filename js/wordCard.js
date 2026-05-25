/* ============================================================
   The Princess Lexicon — wordCard.js
   Reusable renderers for:
     1. Word Drawer (right slide-out panel, used on reading page)
     2. Full word card body (re-used inside Notes / Word Garden)
   ============================================================ */

const WordCard = (function () {

  function renderFullBody(w) {
    if (!w) return `<div class="empty-state">No Word Selected</div>`;
    return `
      <div class="word-card-full">
        <div class="wd-title">${esc(w.word)}</div>
        <div class="wd-meaning">${esc(w.meaning)}</div>

        <div class="wd-section-title">Her Family</div>
        <ul class="wd-list">
          ${w.family.map(f => `<li><b>${esc(f.word)}</b> — ${esc(f.text)}</li>`).join("")}
        </ul>

        <div class="wd-section-title">Her Friend</div>
        <ul class="wd-list">
          ${w.friend.map(f => `<li>${esc(f)}</li>`).join("")}
        </ul>

        <div class="wd-section-title">Her Kin</div>
        <ul class="wd-list">
          ${w.kin.map(k => `<li>${esc(k)}</li>`).join("")}
        </ul>

        <div class="wd-section-title">Example</div>
        <p class="wd-example">${esc(w.example)}</p>
        <p class="wd-example-zh">${esc(w.exampleZh)}</p>
      </div>
    `;
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ---- Drawer controller -------------------------------------- */
  let drawerEl = null;
  let scrimEl  = null;

  function ensureDrawer() {
    if (drawerEl) return;
    const page = document.querySelector(".page");
    scrimEl = document.createElement("div");
    scrimEl.className = "drawer-scrim";
    scrimEl.addEventListener("click", closeDrawer);

    drawerEl = document.createElement("aside");
    drawerEl.className = "word-drawer";
    drawerEl.innerHTML = `
      <div class="wd-frame"></div>
      <button type="button" class="wd-close" aria-label="Close">×</button>
      <div class="wd-scroll"></div>
    `;
    drawerEl.querySelector(".wd-close").addEventListener("click", closeDrawer);

    page.appendChild(scrimEl);
    page.appendChild(drawerEl);
  }

  function openDrawer(word) {
    ensureDrawer();
    drawerEl.querySelector(".wd-scroll").innerHTML = renderFullBody(word);
    requestAnimationFrame(() => {
      scrimEl.classList.add("is-open");
      drawerEl.classList.add("is-open");
    });
  }

  function closeDrawer() {
    if (!drawerEl) return;
    scrimEl.classList.remove("is-open");
    drawerEl.classList.remove("is-open");
  }

  return { renderFullBody, openDrawer, closeDrawer };
})();
