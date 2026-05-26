/* ============================================================
   The Princess Lexicon — wordCard.js
   Drives the wide right-slide WordDrawer. Strictly separate from
   the reading-side-note (.reading-side-note); never reuse markup.

   Public API:
     WordCard.openDrawer(word)
     WordCard.closeDrawer()
     WordCard.renderFullBody(word)  // returns HTML for the drawer
   ============================================================ */

const WordCard = (function () {

  function renderFullBody(w) {
    if (!w) {
      return `<div class="empty-state">No Word Selected</div>`;
    }
    return `
      <button type="button" class="word-drawer-close" aria-label="Close">×</button>
      <h2 class="word-drawer-title">
        ${esc(w.word)}
        ${w.pos ? `<span class="word-drawer-meta">${esc(w.pos)}</span>` : ""}
      </h2>
      ${w.meaning ? `<p class="word-drawer-meaning">${esc(w.meaning)}</p>` : ""}

      ${renderSection("Her Family", w.family, renderFamilyItem)}
      ${renderSection("Her Friend", w.friend, renderFriendItem)}
      ${renderExampleBox(w)}
      ${renderSection("Her Kin", w.kin, renderKinItem)}

      <div class="word-drawer-footer">Signed · The Princess Lexicon</div>
    `;
  }

  function renderSection(title, items, itemRenderer) {
    if (!items || items.length === 0) return "";
    return `
      <section class="word-section">
        <h3 class="word-section-title">${title}</h3>
        <ul class="word-entry-list">
          ${items.map(itemRenderer).join("")}
        </ul>
      </section>
    `;
  }

  // FAMILY entries: { word, text } — "text" already includes pos + meaning + collocations
  function renderFamilyItem(it) {
    return `<li class="word-entry"><strong>${esc(it.word)}</strong> ${esc(it.text)}</li>`;
  }
  // FRIEND entries: plain strings of "<collocation> <Chinese>"
  function renderFriendItem(s) {
    // Split into English + Chinese by first run of Chinese chars.
    const m = String(s).match(/^(.*?)\s*([一-鿿].*)$/);
    if (m) {
      return `<li class="word-entry"><strong>${esc(m[1].trim())}</strong> ${esc(m[2].trim())}</li>`;
    }
    return `<li class="word-entry">${esc(s)}</li>`;
  }
  // KIN entries can be either string (mock) OR object from word-library auto-gen.
  function renderKinItem(it) {
    if (typeof it === "string") {
      const m = it.match(/^(.*?)\s*([一-鿿].*)$/);
      if (m) {
        return `<li class="word-entry"><strong>${esc(m[1].trim())}</strong> ${esc(m[2].trim())}</li>`;
      }
      return `<li class="word-entry">${esc(it)}</li>`;
    }
    // object form: { word, zh, phrases: [{en, zh}, {en, zh}] }
    const phr = (it.phrases || [])
      .map(p => `<strong>${esc(p.en)}</strong> ${esc(p.zh)}`).join("； ");
    return `<li class="word-entry">
      <strong>${esc(it.word)}</strong>${it.zh ? " " + esc(it.zh) : ""}
      ${phr ? `<br>${phr}` : ""}
    </li>`;
  }

  function renderExampleBox(w) {
    if (!w.example) return "";
    return `
      <div class="example-box">
        <p class="example-en">${esc(w.example)}</p>
        ${w.exampleZh ? `<p class="example-zh">${esc(w.exampleZh)}</p>` : ""}
      </div>
    `;
  }

  function esc(s) {
    return String(s == null ? "" : s)
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
    scrimEl.className = "word-drawer-backdrop";
    scrimEl.addEventListener("click", closeDrawer);

    drawerEl = document.createElement("aside");
    drawerEl.className = "word-drawer";
    drawerEl.setAttribute("aria-hidden", "true");

    page.appendChild(scrimEl);
    page.appendChild(drawerEl);

    // Delegated close button (re-rendered with each open).
    drawerEl.addEventListener("click", e => {
      if (e.target.classList.contains("word-drawer-close")) closeDrawer();
    });
  }

  function openDrawer(word) {
    ensureDrawer();
    drawerEl.innerHTML = renderFullBody(word);
    drawerEl.scrollTop = 0;
    drawerEl.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => {
      scrimEl.classList.add("is-open");
      drawerEl.classList.add("is-open");
    });
  }

  function closeDrawer() {
    if (!drawerEl) return;
    drawerEl.setAttribute("aria-hidden", "true");
    scrimEl.classList.remove("is-open");
    drawerEl.classList.remove("is-open");
  }

  return { renderFullBody, openDrawer, closeDrawer };
})();
