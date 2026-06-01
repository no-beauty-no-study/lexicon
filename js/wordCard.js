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

  // Preload the frame so the first open doesn't reflow (uncached image
  // → wrapper width 0 → the card visibly jumped left→centre→right).
  try { const _pre = new Image(); _pre.src = "assets/bg/ui/word-card-frame.jpg"; } catch (_) {}

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
      + (m.isHead ? ` <i class="wc-headtag">head</i>` : "")
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
    // Badge only when this card's word IS its learning head (族长/首脑词).
    const isHead = d.family_head && norm(d.word) === norm(d.family_head);
    // POS sits INLINE next to the word (small), not on its own line — keeps
    // the zh meaning from being clipped by the short title box.
    return (isHead ? `<div class="wc-head-badge">HEAD · 首脑词</div>` : "")
         + `<div class="wc-word">${esc(d.word)}`
         + (pos ? ` <span class="wc-pos-inline">${esc(pos)}</span>` : "") + `</div>`
         + (meaning ? `<div class="wc-title-zh">${esc(meaning)}</div>` : "");
  }

  // Example rows (EN over ZH) — up to n.
  function exHTML(arr, n) {
    return (arr || []).slice(0, n).map(x => {
      const en = x.example || x.en || "", zh = x.example_zh || x.zh || "";
      if (!en) return "";
      return `<div class="wc-ex"><div class="wc-ex-en">${esc(en)}</div>`
           + (zh ? `<div class="wc-ex-zh">${esc(zh)}</div>` : "") + `</div>`;
    }).join("");
  }
  // Family-Kin routes: head → family word → that family word's own kin
  // (state → static → ecstatic/eustatic/geostatic/antistatic).
  function familyKinHTML(routes) {
    return (routes || []).map(r =>
      `<div class="wc-route">→ ${wordRef(r.via, true)} 的同族 kin</div>`
      + (r.words || []).map(memberHTML).join("")
    ).join("");
  }
  function familyKinSpeak(routes) {
    const parts = [];
    (routes || []).forEach(r => (r.words || []).slice(0, 3).forEach(m => { if (m.word) parts.push(m.word); }));
    return parts.join(". ");
  }
  function renderBody(d) {
    // OWN section (no heading): the focus word's own collocations + example.
    const ownPh = (d.phrases || []).slice(0, 4)
      .filter(p => p.phrase || p.en)
      .map(p => phraseRow(p.phrase || p.en, p.phrase_zh || p.zh || "")).join("");
    const ownEx = exHTML(d.examples, 2);
    const ownSpeak = [d.word]
      .concat((d.phrases || []).slice(0, 4).map(p => p.phrase || p.en))
      .concat((d.examples || []).slice(0, 1).map(x => x.example || x.en))
      .filter(Boolean).join(". ");

    // own → family (shared) → family-kin route → kin (own prefix cluster) → group.
    const fkin = (d.family_kin && d.family_kin.length)
      ? section("wc-fkin", "Family Kin", familyKinHTML(d.family_kin), familyKinSpeak(d.family_kin)) : "";
    return section("wc-own", "", ownPh + ownEx, ownSpeak)
      + section("wc-fam", "Family", membersHTML(d.family_members, d.word), membersSpeak(d.family_members, d.word))
      + fkin
      + section("wc-kin", "Kin",    membersHTML(d.kin_members,    d.word), membersSpeak(d.kin_members,    d.word))
      + section("wc-grp", "Group",  membersHTML(d.group,          d.word), membersSpeak(d.group,          d.word));
  }

  // Open Chapter — its own box (just under the title, above content).
  // Opens in BROWSE mode (&browse=1): a free reader with Prev · Back · Next
  // that does NOT touch story progress — so jumping to a word's chapter can
  // never strand the reader deep in the graded story path ("回不去了").
  function renderOpen(word, loc) {
    if (!loc) return "";
    return `<button type="button" class="antique-button wc-open"
              data-go="#reading?chapter=${encodeURIComponent(loc.chapter)}&section=${encodeURIComponent(loc.section)}&word=${encodeURIComponent(word)}&browse=1">
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
  let cardSections = [], curSec = -1, curLine = -1, cardTimer = null;   // section-by-section playback
  let cardStack = [], lastCtx = null;                   // drawer back-history (maze)

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
          <button type="button" class="word-drawer-back" aria-label="Back" title="返回上一页">‹</button>
          <button type="button" class="word-drawer-close" aria-label="Close">×</button>
          <div class="word-card-title-zone"></div>
          <div class="word-card-open-zone"></div>
          <div class="word-card-body-zone"></div>
          <div class="word-card-sign-zone"></div>
        </div>
      </div>`;
    // ONE tap handler for the whole card (like reading's "tap anywhere"):
    //   • a clickable related word → open that word's card
    //   • a control (back/close/Open Chapter/sign input) → its own handler
    //   • anything else (blank, title, body) → reveal the NEXT 区 (section)
    drawerEl.addEventListener("click", (e) => {
      e.stopPropagation();
      const j = e.target.closest(".wc-jump");
      if (j) { openBigCard(j.dataset.jump); return; }
      if (e.target.closest("button, input, textarea, [data-go]")) return;
      advanceCardSection();
    });
    drawerEl.querySelector(".word-drawer-close").addEventListener("click", (e) => {
      e.stopPropagation(); closeDrawer();
    });
    drawerEl.querySelector(".word-drawer-back").addEventListener("click", (e) => {
      e.stopPropagation(); cardBack();
    });
    titleZone  = drawerEl.querySelector(".word-card-title-zone");
    openZone   = drawerEl.querySelector(".word-card-open-zone");
    bodyZone   = drawerEl.querySelector(".word-card-body-zone");
    signZone   = drawerEl.querySelector(".word-card-sign-zone");

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

  function openBigCard(word, ctx, opts) {
    ensureDrawer();
    if (!drawerEl) return;
    const rt = R();
    let data = null;
    try { data = rt && rt.getBigCard ? rt.getBigCard(word) : null; } catch (_) { data = null; }
    if (!data) return;
    const loc = (ctx && ctx.chapter) ? ctx : findWordLocation(data.word || word);

    // Drawer history so the ‹ back button can retrace the maze. A FRESH open
    // (drawer not yet on screen) starts a new trail; a jump while open pushes;
    // a back-navigation doesn't re-push (the handler already popped).
    if (ctx) lastCtx = ctx;
    if (!(opts && opts.back)) {
      if (!drawerEl.classList.contains("is-open")) cardStack = [];
      cardStack.push(data.word || word);
    }
    const back = drawerEl.querySelector(".word-drawer-back");
    if (back) back.style.visibility = cardStack.length > 1 ? "visible" : "hidden";

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
    // Section-by-section playback (user spec): each tap reveals ONE 区
    // (section) and auto-reads its lines one at a time, then STOPS at the
    // section boundary and waits for the next tap. The focus word is read
    // first as the lead of section 0.
    const titleWord = titleZone.querySelector(".wc-word");
    const secEls = Array.prototype.slice.call(bodyZone.querySelectorAll(".wc-sec"));
    cardSections = secEls.map((sec, i) => {
      const lines = Array.prototype.slice.call(sec.querySelectorAll(".wc-sep, .wc-route, .wc-head, .wc-row, .wc-ex"));
      if (i === 0 && titleWord) lines.unshift(titleWord);
      return { sec, lines };
    });
    if (!cardSections.length && titleWord) cardSections = [{ sec: null, lines: [titleWord] }];
    curSec = -1; curLine = -1;
    clearTimeout(cardTimer);
    playSection(0);
  }

  // What to SPEAK for a given line — short + precise (English only): the
  // focus word, a member headword, a collocation's EN, or an example's EN.
  // Dividers (.wc-sep) speak nothing — they just reveal and roll onward.
  function lineSpeakText(el) {
    if (!el) return "";
    if (el.classList.contains("wc-word")) return el.textContent.trim();
    if (el.classList.contains("wc-sep"))  return "";
    if (el.classList.contains("wc-head")) {
      const w = el.querySelector(".wc-w"); return w ? w.textContent.trim() : "";
    }
    if (el.classList.contains("wc-row")) {            // collocation
      const en = el.querySelector(".wc-en"); return en ? en.textContent.trim() : "";
    }
    if (el.classList.contains("wc-ex")) {             // example
      const en = el.querySelector(".wc-ex-en"); return en ? en.textContent.trim() : "";
    }
    return "";
  }

  // Scroll the BODY ZONE itself to bring a line into view. NEVER scrollIntoView
  // — that bubbles up and scrolls the CSS-scaled .page, which yanked the whole
  // reading view sideways ("reading 的文本往左边飞了").
  function scrollCardTo(el) {
    if (!el || !bodyZone || !bodyZone.contains(el)) return;
    const top = el.offsetTop - bodyZone.clientHeight * 0.5 + el.offsetHeight * 0.5;
    const y = Math.max(0, top);
    try { bodyZone.scrollTo({ top: y, behavior: "smooth" }); }
    catch (_) { bodyZone.scrollTop = y; }
  }

  function clearReadingMark() {
    if (bodyZone) bodyZone.querySelectorAll(".is-reading").forEach(x => x.classList.remove("is-reading"));
    if (titleZone) titleZone.querySelectorAll(".is-reading").forEach(x => x.classList.remove("is-reading"));
  }
  // Reveal section s (display it) and start reading its lines one at a time.
  function playSection(s) {
    if (s < 0 || s >= cardSections.length) return;
    clearTimeout(cardTimer);
    curSec = s;
    const sec = cardSections[s].sec;
    if (sec) sec.classList.add("is-shown");
    playLine(s, 0);
  }
  // Reveal + (if it has text) read line j of section s, lighting up only that
  // line, then auto-advance WITHIN the section. At the section's end it STOPS
  // — the next 区 only appears on the next tap.
  function playLine(s, j) {
    const sect = cardSections[s];
    if (!sect) return;
    const lines = sect.lines;
    if (j < 0 || j >= lines.length) return;   // section finished → wait for tap
    clearTimeout(cardTimer);
    curSec = s; curLine = j;
    const el = lines[j];
    el.classList.add("wc-revealed");
    clearReadingMark();

    const txt = lineSpeakText(el);
    if (!txt) {                       // a divider — reveal and roll straight on
      cardTimer = setTimeout(() => playLine(s, j + 1), 150);
      return;
    }
    el.classList.add("is-reading");
    scrollCardTo(el);

    let advanced = false;
    const onEnd = () => {
      if (advanced || curSec !== s || curLine !== j) return;
      advanced = true;
      cardTimer = setTimeout(() => playLine(s, j + 1), 240);
    };
    // Fallback in case the voice's onend never fires (no voices / muted).
    const words = (txt.match(/\S+/g) || []).length;
    cardTimer = setTimeout(onEnd, words * 320 + 1300);
    if (typeof TTS !== "undefined" && TTS.speak) { try { TTS.speak(txt, { onEnd }); } catch (_) {} }
  }
  // ‹ Back — retrace the maze: pop the current word and re-open the one
  // before it; if this was the entry card, just close back to reading.
  function cardBack() {
    if (typeof TTS !== "undefined" && TTS.cancel) { try { TTS.cancel(); } catch (_) {} }
    clearTimeout(cardTimer);
    cardStack.pop();                       // drop current
    const prev = cardStack[cardStack.length - 1];
    if (prev) openBigCard(prev, lastCtx, { back: true });
    else closeDrawer();
  }

  // Body tap → reveal + read the NEXT 区 (section). One tap = one section.
  function advanceCardSection() {
    if (typeof TTS !== "undefined" && TTS.cancel) { try { TTS.cancel(); } catch (_) {} }
    clearTimeout(cardTimer);
    if (curSec + 1 < cardSections.length) playSection(curSec + 1);
  }

  function openDrawer(arg, ctx) {
    const word = typeof arg === "string" ? arg : (arg && (arg.word || arg.id));
    if (word) openBigCard(word, ctx);
  }

  function closeDrawer() {
    if (!drawerEl) return;
    clearTimeout(cardTimer);
    cardStack = [];
    drawerEl.setAttribute("aria-hidden", "true");
    scrimEl.classList.remove("is-open");
    drawerEl.classList.remove("is-open");
    if (typeof TTS !== "undefined" && TTS.cancel) { try { TTS.cancel(); } catch (_) {} }
  }

  return { openBigCard, openDrawer, closeDrawer };
})();
