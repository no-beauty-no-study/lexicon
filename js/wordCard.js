/* ============================================================
   The Princess Lexicon — wordCard.js
   Drives the right-slide WordDrawer. The drawer's background is
   a painted page (frame-blank.jpg via .word-drawer-v2 CSS); we
   only inject text into the empty centre slot.
   Public API:
     WordCard.openDrawer(word)
     WordCard.closeDrawer()
   ============================================================ */
const WordCard = (function () {

  function renderInner(w) {
    if (!w) return `<div class="empty-state">No Word Selected</div>`;
    return `
      <h2 class="wd-title-v2">
        ${esc(w.word)}${w.pos ? ` <span class="wd-meta-v2">${esc(w.pos)}</span>` : ""}
      </h2>
      ${w.meaning ? `<p class="wd-meaning-v2">${esc(w.meaning)}</p>` : ""}

      ${renderSection("Her Family", w.family, renderFamilyItem)}
      ${renderSection("Her Friend", w.friend, renderFriendItem)}
      ${renderExampleBox(w)}
      ${renderSection("Her Kin", w.kin, renderKinItem)}

      <div class="wd-footer-v2">Signed · The Princess Lexicon</div>
    `;
  }

  function renderSection(title, items, itemRenderer) {
    if (!items || items.length === 0) return "";
    return `
      <section class="wd-section-v2">
        <h3 class="wd-section-title-v2">${title}</h3>
        <ul class="wd-list-v2">${items.map(itemRenderer).join("")}</ul>
      </section>
    `;
  }

  function renderFamilyItem(it) {
    return `<li><strong>${esc(it.word)}</strong> ${esc(it.text)}</li>`;
  }
  function renderFriendItem(s) {
    const m = String(s).match(/^(.*?)\s*([一-鿿].*)$/);
    if (m) return `<li><strong>${esc(m[1].trim())}</strong> ${esc(m[2].trim())}</li>`;
    return `<li>${esc(s)}</li>`;
  }
  function renderKinItem(it) {
    if (typeof it === "string") {
      const m = it.match(/^(.*?)\s*([一-鿿].*)$/);
      if (m) return `<li><strong>${esc(m[1].trim())}</strong> ${esc(m[2].trim())}</li>`;
      return `<li>${esc(it)}</li>`;
    }
    const phr = (it.phrases || [])
      .map(p => `<strong>${esc(p.en)}</strong> ${esc(p.zh)}`).join("； ");
    return `<li>
      <strong>${esc(it.word)}</strong>${it.zh ? " " + esc(it.zh) : ""}
      ${phr ? `<br>${phr}` : ""}
    </li>`;
  }
  function renderExampleBox(w) {
    if (!w.example) return "";
    return `
      <div class="wd-example-box-v2">
        <p class="wd-example-en-v2">${esc(w.example)}</p>
        ${w.exampleZh ? `<p class="wd-example-zh-v2">${esc(w.exampleZh)}</p>` : ""}
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
    scrimEl.className = "word-drawer-v2-backdrop";
    scrimEl.addEventListener("click", e => { e.stopPropagation(); closeDrawer(); });

    drawerEl = document.createElement("aside");
    drawerEl.className = "word-drawer-v2";
    drawerEl.setAttribute("aria-hidden", "true");
    drawerEl.innerHTML = `
      <button type="button" class="wd-close-v2" aria-label="Close">×</button>
      <div class="wd-content-v2"></div>
    `;
    drawerEl.addEventListener("click", e => e.stopPropagation());
    drawerEl.querySelector(".wd-close-v2").addEventListener("click", e => {
      e.stopPropagation(); closeDrawer();
    });

    page.appendChild(scrimEl);
    page.appendChild(drawerEl);
  }

  function openDrawer(word) {
    ensureDrawer();
    drawerEl.querySelector(".wd-content-v2").innerHTML = renderInner(word);
    drawerEl.querySelector(".wd-content-v2").scrollTop = 0;
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

  // renderFullBody is the same inner content as the drawer — exposed so
  // Notes / Word Garden detail panes can reuse it.
  return { openDrawer, closeDrawer, renderFullBody: renderInner };
})();
