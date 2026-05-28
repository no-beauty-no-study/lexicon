/* The Princess Lexicon — wordCard.js
   Right-slide word drawer + inline body renderer.
   Public API:
     WordCard.openDrawer(wordObj)
     WordCard.closeDrawer()
     WordCard.renderFullBody(wordObj) */
const WordCard = (function () {

  function renderTitleZone(w) {
    if (!w) return "";
    return `
      <div class="word-card-word-row">
        <span class="word-card-word">${esc(w.word)}</span>
        ${w.pos ? `<span class="word-card-pos">${esc(w.pos)}</span>` : ""}
      </div>
      ${w.meaning ? `<p class="word-card-meaning">${esc(w.meaning)}</p>` : ""}
    `;
  }

  function renderBodyZone(w) {
    if (!w) return `<div class="empty-state">No Word Selected</div>`;
    return [
      renderSection("Her Family", w.family, renderFamilyItem),
      renderSection("Her Friend", w.friend, renderFriendItem),
      renderExampleBox(w),
      renderSection("Her Kin",    w.kin,    renderKinItem),
    ].join("");
  }
  function renderSection(title, items, item) {
    if (!items || !items.length) return "";
    return `<section class="word-section">
      <h3 class="word-section-title">${title}</h3>
      <ul class="word-entry-list">${items.map(item).join("")}</ul>
    </section>`;
  }
  function renderFamilyItem(it) {
    return `<li class="word-entry"><strong>${esc(it.word)}</strong> ${esc(it.text)}</li>`;
  }
  function renderFriendItem(s) {
    const m = String(s).match(/^(.*?)\s*([一-鿿].*)$/);
    if (m) return `<li class="word-entry"><strong>${esc(m[1].trim())}</strong> ${esc(m[2].trim())}</li>`;
    return `<li class="word-entry">${esc(s)}</li>`;
  }
  function renderKinItem(it) {
    if (typeof it === "string") {
      const m = it.match(/^(.*?)\s*([一-鿿].*)$/);
      if (m) return `<li class="word-entry"><strong>${esc(m[1].trim())}</strong> ${esc(m[2].trim())}</li>`;
      return `<li class="word-entry">${esc(it)}</li>`;
    }
    const phr = (it.phrases || [])
      .map(p => `<strong>${esc(p.en)}</strong> ${esc(p.zh)}`).join("； ");
    return `<li class="word-entry">
      <strong>${esc(it.word)}</strong>${it.zh ? " " + esc(it.zh) : ""}
      ${phr ? `<br>${phr}` : ""}
    </li>`;
  }
  function renderExampleBox(w) {
    if (!w.example) return "";
    return `<div class="example-box">
      <p class="example-en">${esc(w.example)}</p>
      ${w.exampleZh ? `<p class="example-zh">${esc(w.exampleZh)}</p>` : ""}
    </div>`;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function renderFullBody(w) { return renderTitleZone(w) + renderBodyZone(w); }

  // Drawer DOM is rebuilt against whichever .page is currently mounted,
  // since the SPA router swaps the stage on every view change.
  let drawerEl  = null;
  let scrimEl   = null;
  let titleZone = null;
  let bodyZone  = null;
  let hostPage  = null;

  function ensureDrawer() {
    const page = document.querySelector(".stage .page");
    if (drawerEl && hostPage === page) return;
    if (drawerEl && hostPage !== page) {
      try { drawerEl.remove(); scrimEl.remove(); } catch (_) {}
      drawerEl = scrimEl = null;
    }
    if (!page) return;
    hostPage = page;

    scrimEl = document.createElement("div");
    scrimEl.className = "word-drawer-backdrop";
    scrimEl.addEventListener("click", (e) => { e.stopPropagation(); closeDrawer(); });

    drawerEl = document.createElement("aside");
    drawerEl.className = "word-drawer";
    drawerEl.setAttribute("aria-hidden", "true");
    drawerEl.innerHTML = `
      <button type="button" class="word-drawer-close" aria-label="Close">×</button>
      <div class="word-card-title-zone"></div>
      <div class="word-card-body-zone"></div>
      <div class="word-drawer-footer">Signed · The Princess Lexicon</div>
    `;
    drawerEl.addEventListener("click", (e) => e.stopPropagation());
    drawerEl.querySelector(".word-drawer-close").addEventListener("click", (e) => {
      e.stopPropagation(); closeDrawer();
    });
    titleZone = drawerEl.querySelector(".word-card-title-zone");
    bodyZone  = drawerEl.querySelector(".word-card-body-zone");

    page.appendChild(scrimEl);
    page.appendChild(drawerEl);
  }

  function openDrawer(word) {
    ensureDrawer();
    if (!drawerEl) return;
    titleZone.innerHTML = renderTitleZone(word);
    bodyZone.innerHTML  = renderBodyZone(word);
    bodyZone.scrollTop  = 0;
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

  return { openDrawer, closeDrawer, renderFullBody };
})();
