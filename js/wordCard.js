/* The Princess Lexicon — wordCard.js
   The right-slide DRAWER big word card from VocabRuntime.getBigCard(word).

   Layout on frame-blank.jpg (1024×1536):
     • title  — word (big) / pos / zh, centred in the cartouche
     • body   — scrolling. First the focus word's own phrases + examples
                (no heading), then FAMILY / GROUP / KIN, each introduced
                by a centred text divider. Inside a section the entry is
                STAGGERED: the headword line (word · pos ｜ zh) sits flush,
                its collocations indent below with a ✦ bullet. English and
                Chinese are split into two aligned columns (EN ｜ ZH).
     • action — FIXED bottom bar: "Signed ___" copy/dictation input with
                the Open Chapter plaque below it (both centred).
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

  // Split a Chinese gloss into a leading part-of-speech tag and meaning,
  // e.g. "v. 建立；确立" → {pos:"v.", meaning:"建立；确立"}.
  function splitPos(zh) {
    const m = String(zh || "").match(/^\s*([A-Za-z][A-Za-z.\/-]*\.)\s*(.*)$/);
    return m ? { pos: m[1], meaning: m[2] } : { pos: "", meaning: String(zh || "") };
  }

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
  // EN ｜ ZH row. enHTML is raw HTML (already escaped); zh is plain text.
  function row(enHTML, zh, phrase) {
    return `<div class="wc-row${phrase ? " wc-phrase" : ""}">`
         + `<span class="wc-en">${enHTML}</span>`
         + `<span class="wc-zh">${zh ? esc(zh) : ""}</span></div>`;
  }
  function wordRef(word, clickable) {
    return clickable
      ? `<span class="wc-jump" data-jump="${esc(word)}">${esc(word)}</span>`
      : esc(word);
  }
  function memberPhrases(m) {
    if (Array.isArray(m.phrases) && m.phrases.length) return m.phrases;
    const out = [];
    if (m.phrase)   out.push({ phrase: m.phrase,   phrase_zh: m.phrase_zh });
    if (m.phrase_1) out.push({ phrase: m.phrase_1, phrase_zh: m.phrase_1_zh });
    if (m.phrase_2) out.push({ phrase: m.phrase_2, phrase_zh: m.phrase_2_zh });
    return out;
  }
  function members(arr, focusWord) {
    if (!arr || !arr.length) return "";
    const fk = focusWord ? norm(focusWord) : null;
    return arr.filter(m => m && m.word && (!fk || norm(m.word) !== fk)).map(m => {
      const { pos, meaning } = splitPos(m.zh || "");
      const head = `<div class="wc-row wc-head">`
        + `<span class="wc-en"><span class="wc-w">${wordRef(m.word, !!m.clickable)}</span>`
        + (pos ? ` <i class="wc-pos">${esc(pos)}</i>` : "") + `</span>`
        + `<span class="wc-zh">${esc(meaning)}</span></div>`;
      const phs = memberPhrases(m).slice(0, 2)
        .map(p => row(esc(p.phrase || p.en || ""), p.phrase_zh || p.zh || "", true)).join("");
      return `<div class="wc-item">${head}${phs}</div>`;
    }).join("");
  }
  function divider(label, inner) {
    if (!inner) return "";
    return `<div class="wc-sep"><span class="wc-sep-line"></span>`
         + `<span class="wc-sep-label">${esc(label)}</span>`
         + `<span class="wc-sep-line"></span></div>`
         + `<div class="wc-block">${inner}</div>`;
  }

  function renderTitle(d) {
    const { pos, meaning } = splitPos(d.zh || "");
    return `<div class="wc-word">${esc(d.word)}</div>`
         + (pos ? `<div class="wc-title-pos">${esc(pos)}</div>` : "")
         + (meaning ? `<div class="wc-title-zh">${esc(meaning)}</div>` : "");
  }

  function renderBody(d) {
    const ownPh = (d.phrases || []).slice(0, 4)
      .filter(p => p.phrase || p.en)
      .map(p => row(esc(p.phrase || p.en), p.phrase_zh || p.zh || "", true)).join("");
    const ownEx = (d.examples || []).slice(0, 2).map(x => {
      const en = x.example || x.en || "", zh = x.example_zh || x.zh || "";
      if (!en) return "";
      return `<div class="wc-ex"><div class="wc-ex-en">${esc(en)}</div>`
           + (zh ? `<div class="wc-ex-zh">${esc(zh)}</div>` : "") + `</div>`;
    }).join("");
    const own = `<div class="wc-own">${ownPh}${ownEx}</div>`;

    const fam = members(d.family_members, d.word);
    const grp = members(d.group, d.word);
    let kin = "";
    (d.kin_clusters || []).forEach(c => {
      kin += members(c.internal_words) + members(c.external_words);
    });

    return own + divider("Family", fam) + divider("Group", grp) + divider("Kin", kin);
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

  /* ---------- drawer DOM ---------- */
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

    bodyZone.addEventListener("click", (e) => {
      const j = e.target.closest(".wc-jump");
      if (!j) return;
      e.stopPropagation();
      openBigCard(j.dataset.jump);
    });
    actionZone.addEventListener("click", (e) => {
      const o = e.target.closest("[data-go]");
      if (!o) return;
      e.stopPropagation();
      closeDrawer();
      if (typeof window.go === "function") window.go(o.dataset.go);
    });
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
    if (!data) return;
    const loc = (ctx && ctx.chapter) ? ctx : findWordLocation(data.word || word);

    titleZone.innerHTML  = renderTitle(data);
    bodyZone.innerHTML   = renderBody(data);
    actionZone.innerHTML = renderAction(data.word || word, loc);
    bodyZone.scrollTop   = 0;
    drawerEl.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => {
      scrimEl.classList.add("is-open");
      drawerEl.classList.add("is-open");
    });
  }

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
