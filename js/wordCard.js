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
  // Two-column phrase row (EN | ZH) — used ONLY for collocations.
  function phraseRow(en, zh) {
    return `<div class="wc-row wc-phrase">`
         + `<span class="wc-en">${esc(en)}</span>`
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
  function cleanMembers(arr, focusWord) {
    const fk = focusWord ? norm(focusWord) : null;
    return (arr || []).filter(m => m && m.word && (!fk || norm(m.word) !== fk));
  }
  // A word entry: word INLINE with its pos + zh; its collocations below
  // in the two-column layout.
  function memberHTML(m) {
    const sp = splitPos(m.zh || "");
    const pos = m.pos || sp.pos, meaning = sp.meaning;
    const head = `<div class="wc-head"><span class="wc-w">${wordRef(m.word, !!m.clickable)}</span>`
      + (pos ? ` <i class="wc-pos">${esc(pos)}</i>` : "")
      + (meaning ? ` <span class="wc-hzh">${esc(meaning)}</span>` : "")
      + `</div>`;
    const phs = memberPhrases(m).slice(0, 2)
      .map(p => phraseRow(p.phrase || p.en || "", p.phrase_zh || p.zh || "")).join("");
    return `<div class="wc-item">${head}${phs}</div>`;
  }
  function membersHTML(arr, focusWord) {
    return cleanMembers(arr, focusWord).map(memberHTML).join("");
  }
  // Per-section audio script: words + their collocations (English).
  function membersSpeak(arr, focusWord) {
    const parts = [];
    cleanMembers(arr, focusWord).forEach(m => {
      parts.push(m.word);
      memberPhrases(m).slice(0, 2).forEach(p => { if (p.phrase || p.en) parts.push(p.phrase || p.en); });
    });
    return parts.filter(Boolean).join(". ");
  }
  function sepLabel(label) {
    return `<div class="wc-sep"><span class="wc-sep-line"></span>`
         + `<span class="wc-sep-label">${esc(label)}</span>`
         + `<span class="wc-sep-line"></span></div>`;
  }
  function section(cls, label, inner, speak) {
    if (!inner) return "";
    return `<section class="wc-sec ${cls}" data-speak="${esc(speak || "")}">`
         + (label ? sepLabel(label) : "") + inner + `</section>`;
  }

  function renderTitle(d) {
    const sp = splitPos(d.zh || "");
    const pos = d.pos || sp.pos, meaning = sp.meaning;
    return `<div class="wc-word">${esc(d.word)}</div>`
         + (pos ? `<div class="wc-title-pos">${esc(pos)}</div>` : "")
         + (meaning ? `<div class="wc-title-zh">${esc(meaning)}</div>` : "");
  }

  function renderBody(d) {
    // OWN section (no heading): the focus word's own collocations + example.
    const ownPh = (d.phrases || []).slice(0, 4)
      .filter(p => p.phrase || p.en)
      .map(p => phraseRow(p.phrase || p.en, p.phrase_zh || p.zh || "")).join("");
    const ownEx = (d.examples || []).slice(0, 2).map(x => {
      const en = x.example || x.en || "", zh = x.example_zh || x.zh || "";
      if (!en) return "";
      return `<div class="wc-ex"><div class="wc-ex-en">${esc(en)}</div>`
           + (zh ? `<div class="wc-ex-zh">${esc(zh)}</div>` : "") + `</div>`;
    }).join("");
    const ownSpeak = [d.word]
      .concat((d.phrases || []).slice(0, 4).map(p => p.phrase || p.en))
      .concat((d.examples || []).slice(0, 1).map(x => x.example || x.en))
      .filter(Boolean).join(". ");

    const kinMembers = [];
    (d.kin_clusters || []).forEach(c => {
      (c.internal_words || []).forEach(m => kinMembers.push(m));
      (c.external_words || []).forEach(m => kinMembers.push(m));
    });

    return section("wc-own", "", ownPh + ownEx, ownSpeak)
      + section("wc-fam", "Family", membersHTML(d.family_members, d.word), membersSpeak(d.family_members, d.word))
      + section("wc-grp", "Group",  membersHTML(d.group, d.word),          membersSpeak(d.group, d.word))
      + section("wc-kin", "Kin",    membersHTML(kinMembers),               membersSpeak(kinMembers));
  }

  // Open Chapter — its own box (just under the title, above content).
  function renderOpen(word, loc) {
    if (!loc) return "";
    return `<button type="button" class="antique-button wc-open"
              data-go="#reading?chapter=${encodeURIComponent(loc.chapter)}&section=${encodeURIComponent(loc.section)}&word=${encodeURIComponent(word)}">
        <span class="antique-button-label">Open Chapter</span>
      </button>`;
  }
  // Signed — its own box at the very bottom; the copy/dictation input.
  function renderSign(word) {
    return `<span class="wc-signed-pre">Signed</span>
      <input class="wc-signed-input" type="text" autocomplete="off"
             autocapitalize="off" spellcheck="false"
             data-answer="${esc(word)}" aria-label="Write the word">`;
  }

  /* ---------- drawer DOM ---------- */
  let drawerEl = null, scrimEl = null, titleZone = null, openZone = null, bodyZone = null, signZone = null, hostPage = null;
  let cardSecs = [], cardSecIdx = -1;   // big-card section-by-section reveal

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
    // The card is a real <img> sized by HEIGHT with width:auto, so the
    // browser ALWAYS preserves the image's intrinsic ratio — the
    // container can never squash it. All text/buttons overlay the img
    // box 1:1 (.word-card-overlay is inset:0 of the wrapper, which
    // shrink-wraps the img).
    drawerEl.innerHTML = `
      <div class="word-card-wrapper">
        <img class="word-card-bg" src="assets/bg/ui/word-card-frame.jpg" alt="">
        <div class="word-card-overlay">
          <button type="button" class="word-drawer-close" aria-label="Close">×</button>
          <div class="word-card-title-zone"></div>
          <div class="word-card-open-zone"></div>
          <div class="word-card-body-zone"></div>
          <div class="word-card-sign-zone"></div>
        </div>
      </div>`;
    drawerEl.addEventListener("click", (e) => e.stopPropagation());
    drawerEl.querySelector(".word-drawer-close").addEventListener("click", (e) => {
      e.stopPropagation(); closeDrawer();
    });
    titleZone  = drawerEl.querySelector(".word-card-title-zone");
    openZone   = drawerEl.querySelector(".word-card-open-zone");
    bodyZone   = drawerEl.querySelector(".word-card-body-zone");
    signZone   = drawerEl.querySelector(".word-card-sign-zone");

    bodyZone.addEventListener("click", (e) => {
      const j = e.target.closest(".wc-jump");
      if (j) { e.stopPropagation(); openBigCard(j.dataset.jump); return; }
      // Otherwise: reveal + read the next block (Family → Group → Kin).
      e.stopPropagation();
      advanceCardSection();
    });
    openZone.addEventListener("click", (e) => {
      const o = e.target.closest("[data-go]");
      if (!o) return;
      e.stopPropagation();
      closeDrawer();
      if (typeof window.go === "function") window.go(o.dataset.go);
    });
    signZone.addEventListener("input", (e) => {
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

    titleZone.innerHTML = renderTitle(data);
    openZone.innerHTML  = renderOpen(data.word || word, loc);
    bodyZone.innerHTML  = renderBody(data);
    signZone.innerHTML  = renderSign(data.word || word);
    bodyZone.scrollTop   = 0;
    drawerEl.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => {
      scrimEl.classList.add("is-open");
      drawerEl.classList.add("is-open");
    });
    // Section-by-section: show + auto-read OWN now; each tap on the body
    // reveals + reads the next block (Family → Group → Kin).
    cardSecs = Array.prototype.slice.call(bodyZone.querySelectorAll(".wc-sec"));
    cardSecIdx = -1;
    showCardSection(0);
  }

  // Reveal block i (and everything before it) and read it aloud.
  function showCardSection(i) {
    if (i < 0 || i >= cardSecs.length) return;
    for (let k = 0; k <= i; k++) cardSecs[k].classList.add("is-shown");
    cardSecIdx = i;
    const sec = cardSecs[i];
    try { sec.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (_) {}
    const txt = sec.getAttribute("data-speak");
    if (txt && window.TTS && TTS.speak) { try { TTS.speak(txt); } catch (_) {} }
  }
  function advanceCardSection() {
    if (cardSecIdx + 1 < cardSecs.length) showCardSection(cardSecIdx + 1);
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
    if (window.TTS && TTS.cancel) { try { TTS.cancel(); } catch (_) {} }
  }

  return { openBigCard, openDrawer, closeDrawer };
})();
