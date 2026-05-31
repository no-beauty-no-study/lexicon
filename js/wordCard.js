/* The Princess Lexicon — wordCard.js
   The right-slide DRAWER big word card. Content now comes from
   VocabRuntime.getBigCard(word): the clicked word stays the focus, while
   Family / Group / Kin inherit from its family head. Any Family/Group/Kin
   word that itself exists in the word master is rendered as a clickable
   link that re-opens the drawer on that new word.

   Public API:
     WordCard.openBigCard(word)   — open/replace the drawer on a word
     WordCard.openDrawer(arg)     — legacy alias (string or {word})
     WordCard.closeDrawer()
*/
const WordCard = (function () {

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function norm(s) { return String(s == null ? "" : s).trim().toLowerCase(); }
  function R() { return window.VocabRuntime || null; }

  /* ---------- render helpers ---------- */
  function phraseList(arr) {
    if (!arr || !arr.length) return "";
    return `<div class="wc-phrases">` + arr.map(p => {
      const en = p.phrase || p.en || "";
      const zh = p.phrase_zh || p.zh || "";
      if (!en && !zh) return "";
      return `<div class="wc-phrase"><span class="wc-ph-en">${esc(en)}</span>`
           + (zh ? `<span class="wc-ph-zh">${esc(zh)}</span>` : "") + `</div>`;
    }).join("") + `</div>`;
  }
  function exampleList(arr) {
    if (!arr || !arr.length) return "";
    return arr.map(x => {
      const en = x.example || x.en || "";
      const zh = x.example_zh || x.zh || "";
      if (!en) return "";
      return `<div class="wc-example"><span class="wc-ex-en">${esc(en)}</span>`
           + (zh ? `<span class="wc-ex-zh">${esc(zh)}</span>` : "") + `</div>`;
    }).join("");
  }
  function wordRef(word, clickable) {
    return clickable
      ? `<span class="wc-jump" data-jump="${esc(word)}">${esc(word)}</span>`
      : `<span class="wc-plain">${esc(word)}</span>`;
  }
  function memberPhrases(m) {
    if (Array.isArray(m.phrases) && m.phrases.length) return m.phrases;
    const out = [];
    if (m.phrase)   out.push({ phrase: m.phrase,   phrase_zh: m.phrase_zh });
    if (m.phrase_1) out.push({ phrase: m.phrase_1, phrase_zh: m.phrase_1_zh });
    if (m.phrase_2) out.push({ phrase: m.phrase_2, phrase_zh: m.phrase_2_zh });
    return out;
  }
  function renderMember(m) {
    return `<div class="wc-member">
        <div class="wc-member-head">${wordRef(m.word, !!m.clickable)}`
      + (m.zh ? `<span class="wc-member-zh">${esc(m.zh)}</span>` : "")
      + `</div>${phraseList(memberPhrases(m))}</div>`;
  }
  function section(title, inner) {
    return inner ? `<section class="wc-section"><h3 class="wc-section-title">${esc(title)}</h3>${inner}</section>` : "";
  }

  function renderTitle(d) {
    return `<div class="wc-word">${esc(d.word)}</div>`
         + (d.zh ? `<div class="wc-zh">${esc(d.zh)}</div>` : "");
  }
  function renderBody(d) {
    const own = phraseList(d.phrases) + exampleList(d.examples);
    const ownBlock = own ? `<div class="wc-own">${own}</div>` : "";

    const focusKey = norm(d.word);
    const fam = (d.family_members || [])
      .filter(m => norm(m.word) !== focusKey)
      .map(renderMember).join("");

    const grp = (d.group || []).map(renderMember).join("");

    let kinInner = "";
    (d.kin_clusters || []).forEach(c => {
      kinInner += (c.internal_words || []).map(renderMember).join("");
      kinInner += (c.external_words || []).map(renderMember).join("");
    });

    return ownBlock
      + section("Family", fam)
      + section("Group", grp)
      + section("Kin", kinInner);
  }

  /* ---------- drawer DOM (rebuilt per mounted page) ---------- */
  let drawerEl = null, scrimEl = null, titleZone = null, bodyZone = null, hostPage = null;

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
      <div class="word-card-body-zone"></div>`;
    drawerEl.addEventListener("click", (e) => e.stopPropagation());
    drawerEl.querySelector(".word-drawer-close").addEventListener("click", (e) => {
      e.stopPropagation(); closeDrawer();
    });
    titleZone = drawerEl.querySelector(".word-card-title-zone");
    bodyZone  = drawerEl.querySelector(".word-card-body-zone");

    // Clicking a clickable Family / Group / Kin word re-opens the drawer
    // on that word (internal jump). Proper/place words have no big card,
    // so they are never rendered clickable.
    bodyZone.addEventListener("click", (e) => {
      const j = e.target.closest(".wc-jump");
      if (!j) return;
      e.stopPropagation();
      openBigCard(j.dataset.jump);
    });

    page.appendChild(scrimEl);
    page.appendChild(drawerEl);
  }

  function openBigCard(word) {
    ensureDrawer();
    if (!drawerEl) return;
    const rt = R();
    let data = null;
    try { data = rt && rt.getBigCard ? rt.getBigCard(word) : null; } catch (_) { data = null; }
    if (!data) return;   // no big card (e.g. proper noun) → do nothing
    titleZone.innerHTML = renderTitle(data);
    bodyZone.innerHTML  = renderBody(data);
    bodyZone.scrollTop  = 0;
    drawerEl.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => {
      scrimEl.classList.add("is-open");
      drawerEl.classList.add("is-open");
    });
  }

  // Legacy alias — accepts a word string or a {word}/{id} object.
  function openDrawer(arg) {
    const word = typeof arg === "string" ? arg : (arg && (arg.word || arg.id));
    if (word) openBigCard(word);
  }

  function closeDrawer() {
    if (!drawerEl) return;
    drawerEl.setAttribute("aria-hidden", "true");
    scrimEl.classList.remove("is-open");
    drawerEl.classList.remove("is-open");
  }

  return { openBigCard, openDrawer, closeDrawer };
})();
