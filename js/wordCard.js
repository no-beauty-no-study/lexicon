/* The Princess Lexicon — wordCard.js
   The right-slide DRAWER big word card, rendered from
   VocabRuntime.getBigCard(word). Layout (on frame-blank.jpg / 67CAC3D4,
   native 1024×1536):
     • title zone  — word + pos + zh core meaning (compact)
     • body  zone  — scrolling: Own (phrases + example) · Family · Group ·
                     Kin, each a titled block split by a thin-thick-thin rule
     • action zone — FIXED bottom bar: "Signed ___" copy/dictation input
                     with the Open Chapter plaque below it (both centred)
   Family/Group/Kin words that exist in the master are clickable links
   that re-open the drawer on that word.

   Public API:
     WordCard.openBigCard(word, ctx?)   ctx = {chapter, section}
     WordCard.openDrawer(arg, ctx?)     legacy alias (string or {word})
     WordCard.closeDrawer()
*/
const WordCard = (function () {

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function norm(s) { return String(s == null ? "" : s).trim().toLowerCase(); }
  function rx(s)   { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function R() { return window.VocabRuntime || null; }

  // Where does this word first appear in the reading content? Used by
  // Open Chapter when no explicit reading context was passed (garden /
  // jumped words). Returns {chapter, section} or null.
  function findWordLocation(word) {
    if (typeof CHAPTER_CONTENT === "undefined") return null;
    const re = new RegExp("\\b" + rx(word) + "\\b", "i");
    for (const chId of Object.keys(CHAPTER_CONTENT)) {
      const sections = (CHAPTER_CONTENT[chId] && CHAPTER_CONTENT[chId].sections) || [];
      for (const s of sections) {
        if ((s.blocks || []).some(b => re.test(b))) return { chapter: chId, section: s.number };
      }
    }
    return null;
  }

  /* ---------- render helpers ---------- */
  function phraseRows(arr, limit) {
    const list = (arr || []).slice(0, limit || 99).filter(p => (p.phrase || p.en));
    if (!list.length) return "";
    return list.map(p => {
      const en = p.phrase || p.en || "";
      const zh = p.phrase_zh || p.zh || "";
      return `<div class="wc-row"><span class="wc-en">${esc(en)}</span>`
           + (zh ? `<span class="wc-zh">${esc(zh)}</span>` : "") + `</div>`;
    }).join("");
  }
  function memberPhrases(m) {
    if (Array.isArray(m.phrases) && m.phrases.length) return m.phrases;
    const out = [];
    if (m.phrase)   out.push({ phrase: m.phrase,   phrase_zh: m.phrase_zh });
    if (m.phrase_1) out.push({ phrase: m.phrase_1, phrase_zh: m.phrase_1_zh });
    if (m.phrase_2) out.push({ phrase: m.phrase_2, phrase_zh: m.phrase_2_zh });
    return out;
  }
  function wordRef(word, clickable) {
    return clickable
      ? `<span class="wc-jump" data-jump="${esc(word)}">${esc(word)}</span>`
      : `<span class="wc-plain">${esc(word)}</span>`;
  }
  // A compact entry: word + zh on one line, then ONE collocation (short).
  function memberHTML(m) {
    const ph = memberPhrases(m).slice(0, 1);
    return `<div class="wc-item">
        <div class="wc-item-head">${wordRef(m.word, !!m.clickable)}`
      + (m.zh ? `<span class="wc-item-zh">${esc(m.zh)}</span>` : "")
      + `</div>${phraseRows(ph, 1)}</div>`;
  }
  function block(title, inner) {
    return inner
      ? `<div class="wc-divider" aria-hidden="true"></div>
         <section class="wc-block"><h3 class="wc-block-title">${esc(title)}</h3>${inner}</section>`
      : "";
  }

  function renderTitle(d, raw) {
    const pos = raw && raw.pos && norm(raw.pos) !== norm(d.word) ? raw.pos : "";
    return `<div class="wc-word">${esc(d.word)}</div>`
         + (pos ? `<div class="wc-pos">${esc(pos)}</div>` : "")
         + (d.zh ? `<div class="wc-title-zh">${esc(d.zh)}</div>` : "");
  }

  function renderBody(d) {
    // Own: up to 4 phrases + example.
    const own = phraseRows(d.phrases, 4)
      + (d.examples || []).slice(0, 1).map(x => {
          const en = x.example || x.en || "", zh = x.example_zh || x.zh || "";
          if (!en) return "";
          return `<div class="wc-example"><span class="wc-ex-en">${esc(en)}</span>`
               + (zh ? `<span class="wc-ex-zh">${esc(zh)}</span>` : "") + `</div>`;
        }).join("");
    const ownBlock = own ? `<section class="wc-block wc-own">${own}</section>` : "";

    const focusKey = norm(d.word);
    const fam = (d.family_members || []).filter(m => norm(m.word) !== focusKey).map(memberHTML).join("");
    const grp = (d.group || []).map(memberHTML).join("");
    let kin = "";
    (d.kin_clusters || []).forEach(c => {
      kin += (c.internal_words || []).map(memberHTML).join("");
      kin += (c.external_words || []).map(memberHTML).join("");
    });

    return ownBlock + block("Family", fam) + block("Group", grp) + block("Kin", kin);
  }

  function renderAction(word, loc) {
    const openBtn = loc ? `
      <button type="button" class="antique-button wc-open"
              data-go="#reading?chapter=${encodeURIComponent(loc.chapter)}&section=${encodeURIComponent(loc.section)}&word=${encodeURIComponent(word)}">
        <span class="antique-button-label">Open Chapter</span>
      </button>` : "";
    return `
      <div class="wc-signed">
        <span class="wc-signed-pre">Signed</span>
        <input class="wc-signed-input" type="text" autocomplete="off"
               autocapitalize="off" spellcheck="false"
               data-answer="${esc(word)}" aria-label="Write the word">
      </div>
      ${openBtn}`;
  }

  /* ---------- drawer DOM (rebuilt per mounted page) ---------- */
  let drawerEl = null, scrimEl = null, titleZone = null, bodyZone = null, actionZone = null, hostPage = null;

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
      <div class="word-card-action-zone"></div>`;
    drawerEl.addEventListener("click", (e) => e.stopPropagation());
    drawerEl.querySelector(".word-drawer-close").addEventListener("click", (e) => {
      e.stopPropagation(); closeDrawer();
    });
    titleZone  = drawerEl.querySelector(".word-card-title-zone");
    bodyZone   = drawerEl.querySelector(".word-card-body-zone");
    actionZone = drawerEl.querySelector(".word-card-action-zone");

    // Clickable Family/Group/Kin word → re-open the drawer on that word.
    bodyZone.addEventListener("click", (e) => {
      const j = e.target.closest(".wc-jump");
      if (!j) return;
      e.stopPropagation();
      openBigCard(j.dataset.jump);
    });
    // Open Chapter (in the fixed action bar) → jump to the reading
    // location with the word spotlit, and close the drawer.
    actionZone.addEventListener("click", (e) => {
      const o = e.target.closest("[data-go]");
      if (!o) return;
      e.stopPropagation();
      closeDrawer();
      if (typeof window.go === "function") window.go(o.dataset.go);
    });
    // Live tick when the player has correctly written the word.
    actionZone.addEventListener("input", (e) => {
      const inp = e.target.closest(".wc-signed-input");
      if (!inp) return;
      const ok = norm(inp.value) === norm(inp.dataset.answer) && inp.value.trim() !== "";
      inp.classList.toggle("is-correct", ok);
    });

    page.appendChild(scrimEl);
    page.appendChild(drawerEl);
  }

  function openBigCard(word, ctx) {
    ensureDrawer();
    if (!drawerEl) return;
    const rt = R();
    let data = null;
    try { data = rt && rt.getBigCard ? rt.getBigCard(word) : null; } catch (_) { data = null; }
    if (!data) return;   // no big card (e.g. proper noun) → do nothing
    const raw = rt && rt.getWordCard ? rt.getWordCard(word) : null;
    const loc = (ctx && ctx.chapter) ? ctx : findWordLocation(data.word || word);

    titleZone.innerHTML  = renderTitle(data, raw);
    bodyZone.innerHTML   = renderBody(data);
    actionZone.innerHTML = renderAction(data.word || word, loc);
    bodyZone.scrollTop   = 0;
    drawerEl.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => {
      scrimEl.classList.add("is-open");
      drawerEl.classList.add("is-open");
    });
  }

  // Legacy alias — accepts a word string or a {word}/{id} object.
  function openDrawer(arg, ctx) {
    const word = typeof arg === "string" ? arg : (arg && (arg.word || arg.id));
    if (word) openBigCard(word, ctx);
  }

  function closeDrawer() {
    if (!drawerEl) return;
    drawerEl.setAttribute("aria-hidden", "true");
    scrimEl.classList.remove("is-open");
    drawerEl.classList.remove("is-open");
  }

  return { openBigCard, openDrawer, closeDrawer };
})();
