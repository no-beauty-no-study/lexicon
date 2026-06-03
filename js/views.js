/* The Princess Lexicon — views.js
   One init(host, params) per view. The router clones the matching
   <template id="view-X"> into #stage, then calls Views.X.init(). */
const Views = (function () {

  /* shared helpers */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function cssEsc(s) {
    return String(s).replace(/["\\\n\r]/g, c =>
      c === '"' ? '\\"' : c === '\\' ? '\\\\' : '');
  }
  // Strip a leading part-of-speech abbreviation chain ("n.", "v.", "n./v.",
  // "adj. & adv.") from a gloss — the quiz shows the meaning without them
  // (some are wrong in the data, e.g. intact marked n./v.).
  function stripPos(s) {
    const t = String(s == null ? "" : s);
    const out = t.replace(/^\s*(?:[A-Za-z]{1,6}\.\s*(?:[\/&]\s*)?)+/, "").trim();
    return out || t.trim();
  }
  // A "gloss" that is really just an inflection label OR one of codex's
  // placeholder descriptions ("词族关联项", "语义相关表达", "用于连接…") carries no
  // meaning — such cards must never appear as quiz answers or distractors.
  function isMetaGloss(zh) {
    return /plural|singular|\b3rd\b|past tense|present participle|past participle|comparative|superlative|单复数|第三人称|复数形式|过去式|过去分词|现在分词|比较级|最高级|词族关联|语义相关|用于连接|副词形式|近义词|关联项|相关表达/i.test(String(zh || ""));
  }
  // Exit-popup wording. Showing "only N left" when N is large reads as a CHORE
  // ("还剩30个" → 畏难). So: when ≤5 remain, frame it as the home stretch
  // ("only N left"); otherwise frame it as PROGRESS already made ("you've done
  // X of Y") — encouraging, not daunting. Returns { mark, en, zh }.
  const FEW_LEFT = 5;
  function coaxCopy(done, total, c) {
    const left = Math.max(0, total - done);
    if (left > 0 && left <= FEW_LEFT) {
      return { mark: c.fewMark, en: c.fewEn(left), zh: c.fewZh };
    }
    return { mark: c.startMark, en: c.startEn(Math.max(0, done), total), zh: c.startZh };
  }
  // For each vocab word, the FIRST section (linear book order) whose passage
  // contains it. A reading word is only ever QUIZZED in that first section —
  // codex's data repeats kindergarten words across chapters, so without this a
  // handful of trivial words would be tested over and over. Computed once.
  function quizFirstSectionMap() {
    if (window.__quizFirstSection) return window.__quizFirstSection;
    const map = {}, VR = window.VocabRuntime;
    const order = (window.Quiz && Quiz.order) ? Quiz.order() : [];
    for (const { chapter, section } of order) {
      const sec = (typeof ChapterNav !== "undefined") ? ChapterNav.findSection(chapter, section) : null;
      const key = chapter + "|" + section;
      const toks = ((sec && sec.blocks) || []).join(" ").match(/\b[A-Za-z][A-Za-z'-]{2,}\b/g) || [];
      const seen = new Set();
      for (const raw of toks) {
        const w = raw.toLowerCase(); if (seen.has(w)) continue; seen.add(w);
        const sc = VR && VR.getSmallCard ? VR.getSmallCard(w) : null;
        if (!sc || sc.proper) continue;
        const ans = String(sc.word || w).toLowerCase();
        if (!(ans in map)) map[ans] = key;   // first occurrence wins
      }
    }
    window.__quizFirstSection = map;
    return map;
  }
  // Story entry hash. Story is LINEAR: tapping Story drops the
  // reader straight into the reading view — never into the chapter
  // index (which is for previewing, see browse=1 below). If progress
  // exists in tpl.lastRead, resume from there; otherwise start at the
  // first section of the first chapter.
  function storyEntryHash() {
    let last = null;
    try { last = JSON.parse(localStorage.getItem("tpl.lastRead") || "null"); }
    catch (_) {}
    if (last && last.chapter) {
      return `#reading?chapter=${encodeURIComponent(last.chapter)}`
           + `&section=${encodeURIComponent(last.section || "1.1")}`;
    }
    const first = (typeof CHAPTERS !== "undefined" && CHAPTERS[0]) || null;
    const chId  = first ? first.id : "universe";
    const sec   = first ? (first.firstSection || "1.1") : "1.1";
    return `#reading?chapter=${encodeURIComponent(chId)}`
         + `&section=${encodeURIComponent(sec)}`;
  }


  /* ---------- splash ----------
     The cover used to call window.go("#menu") the instant the tap
     bubbled to the global [data-go] delegate — no feedback, no
     ceremony, PowerPoint cut to the menu. The cover is now hand-
     wired here so we can:
       1. drift a layer of randomised "stardust" up the page on a
          loop (the wallpaper-engine-style pseudo-animation the
          user asked for);
       2. emit a 3-ring + central-burst water-ripple from the
          actual tap point on press;
       3. fade the cover out under the ripple before navigating. */
  const splash = {
    init(host) {
      // ----- Idle layer: drifting stardust ---------------------------
      for (let i = 0; i < 14; i++) {
        const s = document.createElement("div");
        s.className = "splash-sparkle";
        s.style.setProperty("--x",     (Math.random() * 96 + 2) + "%");
        s.style.setProperty("--d",     (11 + Math.random() * 11) + "s");
        s.style.setProperty("--delay", (-Math.random() * 12) + "s");
        s.style.setProperty("--sz",    (3 + Math.random() * 5) + "px");
        s.style.setProperty("--drift", ((Math.random() - 0.5) * 50) + "px");
        host.appendChild(s);
      }

      // ----- Tap-to-begin water ripple --------------------------------
      const hit = host.querySelector(".splash-hit");
      if (!hit) return;
      let fired = false;
      hit.addEventListener("click", (e) => {
        if (fired) return;
        fired = true;
        e.preventDefault();
        e.stopPropagation();
        const rect = hit.getBoundingClientRect();
        const fx = ((e.clientX - rect.left) / rect.width)  * 100;
        const fy = ((e.clientY - rect.top)  / rect.height) * 100;
        function ring(cls, delay) {
          const r = document.createElement("div");
          r.className = cls;
          r.style.left = fx + "%";
          r.style.top  = fy + "%";
          r.style.animationDelay = delay + "ms";
          host.appendChild(r);
        }
        ring("splash-ripple-center", 0);
        ring("splash-ripple-ring",   60);
        ring("splash-ripple-ring",   220);
        ring("splash-ripple-ring",   380);
        setTimeout(() => host.classList.add("is-leaving"), 240);
        setTimeout(() => window.go("#menu"), 820);
      });
    },
  };


  /* ---------- menu ---------- */
  // Menu Quiz = "continue the main trial" — the earliest unfinished stage in
  // linear chapter→section order, skipping sections already cleared.
  function quizContinueHref() {
    if (window.Quiz && Quiz.menuHref) { try { return Quiz.menuHref(); } catch (_) {} }
    try {
      const last = JSON.parse(localStorage.getItem("tpl.lastRead") || "null");
      if (last && last.chapter && last.section)
        return `#quiz?chapter=${encodeURIComponent(last.chapter)}&section=${encodeURIComponent(last.section)}`;
    } catch (_) {}
    return "#chapters";
  }

  // Menu Quiz → a plaque popup: Continue the main trial, or Review the
  // accumulated words (random, most-missed first).
  function showQuizMenuPopup(host) {
    let scrim = host.querySelector(".qx-scrim");
    if (!scrim) { scrim = document.createElement("div"); scrim.className = "qx-scrim"; host.appendChild(scrim); }
    const n = (window.Quiz && Quiz.reviewWords) ? Quiz.reviewWords().length : 0;
    scrim.innerHTML = `<div class="qx-card"><div class="qx-mark">✦ THE TRIAL ✦</div>
      <p class="qx-en">Continue the main trial,<br>or review your accumulated words.</p>
      <div class="qx-actions">
        <button type="button" class="gs-btn qm-continue">Continue Trial</button>
        <button type="button" class="gs-btn qm-review"${n ? "" : " disabled"}>Review Words${n ? " (" + n + ")" : ""}</button>
      </div></div>`;
    scrim.querySelector(".qm-continue").onclick = (e) => { e.stopPropagation(); window.go(quizContinueHref()); };
    const rb = scrim.querySelector(".qm-review");
    if (n) rb.onclick = (e) => { e.stopPropagation(); window.__navDir = "forward"; window.go("#review?from=menu"); };
    scrim.onclick = (e) => { if (e.target === scrim) scrim.remove(); };
    requestAnimationFrame(() => scrim.classList.add("is-open"));
  }

  const menu = {
    init(host) {
      // === button click + 4-layer antique feedback ==================
      // Layer 1 (hover)      → CSS only, mouse-only (iPad has no hover)
      // Layer 2 (press sink) → CSS only, .menu-btn:active rule
      // Layer 3 (gold ripple)→ ::after on .menu-btn, pointerdown fires
      // Layer 4 (badge bless)→ .is-activated class; the bigger blessing
      //                        + expanding ring play for 820ms before
      //                        navigation hands off to the page-turn.
      // A short warm bell tone fires on click for auditory "opening".
      function playBookChime() {
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          const ctx = new Ctx();
          // Two-note rising: G5 → C6, soft triangle wave, sustained
          // partial overtone for a small bell colour. ~520ms total.
          const notes = [783.99, 1046.50];
          const now = ctx.currentTime;
          notes.forEach((f, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "triangle"; o.frequency.value = f;
            const t0 = now + i * 0.08;
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.5);
            o.connect(g).connect(ctx.destination);
            o.start(t0); o.stop(t0 + 0.55);
          });
          // Light overtone for the warm-bell colour.
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.type = "sine"; o2.frequency.value = 1567.98;
          g2.gain.setValueAtTime(0, now);
          g2.gain.linearRampToValueAtTime(0.06, now + 0.04);
          g2.gain.exponentialRampToValueAtTime(0.0006, now + 0.45);
          o2.connect(g2).connect(ctx.destination);
          o2.start(now); o2.stop(now + 0.5);
          setTimeout(() => { try { ctx.close(); } catch (_) {} }, 1100);
        } catch (_) {}
      }
      host.querySelectorAll(".menu-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const a = btn.dataset.action;
          btn.classList.remove("is-activated");
          void btn.offsetWidth;
          btn.classList.add("is-activated");
          playBookChime();
          // The cinematic fade-up + blur transition in app.js
          // render() does the heavy lifting — no on-screen white
          // circle needed. Hold so the badge blessing and bell
          // are heard/seen before the page lifts away.
          setTimeout(() => {
            if (a === "resume")      window.go("#select");
            else if (a === "quiz")   window.go(quizContinueHref());
            else if (a === "recall") window.go("#review?from=menu");
            else                     window.go("#chapters?browse=1");
          }, 540);
        });
        btn.addEventListener("pointerdown", () => {
          // Whole-button glow on press — no coord tracking needed,
          // the silhouette of the painted button IS the highlight.
          btn.classList.remove("is-clicking");
          void btn.offsetWidth;
          btn.classList.add("is-clicking");
        });
        btn.addEventListener("animationend", (e) => {
          if (e.animationName === "menu-btn-glow")       btn.classList.remove("is-clicking");
          if (e.animationName === "menu-badge-blessing") btn.classList.remove("is-activated");
        });
      });

      // === sparkles — explicit coords per the painting spec ==========
      // All point lists below are PIXEL coords on the 1536×1151
      // reference screenshot; converted to % inline (the painting
      // aspect ~1.334 matches the .page 1448×1086 ~1.333 closely
      // enough that the % mapping lands within 1px on the iPad).
      // Spread is now LEFT+RIGHT heavy per the user's complaint that
      // stars were "all crammed in the middle". 50 explicit coords
      // + 15 randomised dust particles in the night-sky region.
      const W = 1536, H = 1151;
      const px = (x) => (x / W * 100) + "%";
      const py = (y) => (y / H * 100) + "%";
      function spawnStar(x, y, opt) {
        const layer = host.querySelector(".cover-bg-layer");
        if (!layer) return;
        const s = document.createElement("div");
        s.className = "menu-star" + (opt.cross ? " is-cross" : "");
        s.style.setProperty("--x", px(x));
        s.style.setProperty("--y", py(y));
        s.style.setProperty("--sz", opt.size + "px");
        s.style.setProperty("--d", opt.dur + "s");
        s.style.setProperty("--delay", (-Math.random() * 5) + "s");
        if (opt.cross) s.textContent = "✦";
        layer.appendChild(s);
      }
      function rnd(lo, hi) { return lo + Math.random() * (hi - lo); }

      // --- LEFT half night sky (11 dots, 4 crosses) ---
      [
        [430, 214], [521, 207], [566, 229], [608, 245],
        [442, 286], [540, 343], [632, 334],
        [425, 394], [548, 458], [603, 482], [642, 520],
      ].forEach(([x, y]) =>
        spawnStar(x, y, { size: rnd(2, 4), dur: rnd(3.2, 5.5) }));
      [
        [472, 191], [490, 322], [594, 365], [479, 434],
      ].forEach(([x, y]) =>
        spawnStar(x, y, { cross: true, size: rnd(9, 13), dur: rnd(2.8, 5.5) }));

      // --- RIGHT half night sky (10 dots, 5 crosses) ---
      [
        [927, 214], [1027, 208], [1074, 233], [1116, 254],
        [915, 291], [1020, 346], [1110, 338],
        [907, 397], [1018, 462], [1104, 523],
      ].forEach(([x, y]) =>
        spawnStar(x, y, { size: rnd(2, 4), dur: rnd(3.2, 5.5) }));
      [
        [978, 192], [967, 322], [1072, 366], [958, 433], [1070, 490],
      ].forEach(([x, y]) =>
        spawnStar(x, y, { cross: true, size: rnd(9, 13), dur: rnd(2.8, 5.5) }));

      // --- MID-UPPER passage (sparse, all small dots) ---
      [
        [681, 214], [735, 198], [793, 202], [848, 219],
        [705, 274], [776, 254], [846, 279], [740, 326],
      ].forEach(([x, y]) =>
        spawnStar(x, y, { size: rnd(1.8, 3), dur: rnd(3.5, 5.8) }));

      // --- MOON halo (3 small dots, 1 cross flanking the moon) ---
      [
        [548, 251], [563, 308], [520, 295],
      ].forEach(([x, y]) =>
        spawnStar(x, y, { size: rnd(2, 3), dur: rnd(3.0, 5.0) }));
      spawnStar(586, 267, { cross: true, size: rnd(8, 11), dur: rnd(3.0, 5.0) });

      // --- WAND tip surround (5 dots, 3 crosses) ---
      [
        [639, 417], [678, 451], [635, 446], [699, 445], [652, 458],
      ].forEach(([x, y]) =>
        spawnStar(x, y, { size: rnd(2, 3.5), dur: rnd(2.5, 4.0) }));
      [
        [652, 405], [676, 412], [689, 430],
      ].forEach(([x, y]) =>
        spawnStar(x, y, { cross: true, size: rnd(8, 11), dur: rnd(2.5, 4.0) }));

      // --- DUST: 15 randomised sub-2px specks scattered through
      //     the night-sky region for the deep-field atmospheric
      //     density (no specific coords, just fills the gaps so the
      //     sky doesn't read as 50 isolated points). Distribution
      //     biased to the left+right halves like the explicit set.
      for (let i = 0; i < 15; i++) {
        const sideLeft = Math.random() < 0.5;
        const x = sideLeft ? rnd(410,  660) : rnd(880, 1140);
        const y = rnd(195, 545);
        spawnStar(x, y, { size: rnd(0.9, 1.8), dur: rnd(4.5, 7.5) });
      }

      // === SWAY OVERLAYS — per the user's painted spec ===============
      // 17 regions in total. Each entry: [x1, y1, x2, y2] (all % of
      // the 1448×1086 reference frame), pivot in % too, plus
      // animation name + period + optional negative delay for
      // desync. Hair, ribbons, tassels, vertical flowers, bottom
      // flowers. The two scroll banner tails flanking the title
      // are NO LONGER sliced into root/middle/tail — they're now
      // ONE continuous polygon overlay each (see RIBBONS below),
      // because the user pointed out the 3-slice approach was
      // visibly breaking the cloth's continuity.
      // PRINCESS-STATIC POLICY: every overlay that ever intersected
      // the princess silhouette (rough bbox x 430–965, y 226–1048)
      // has been removed. The user reported "后脑勺在动" — the prior
      // sway-hair-long / -tips / -ear / sway-bow-tails all clipped
      // into the back-of-head / blue-bow / shoulder area and made
      // the painted figure visibly distort. The blue-tail pair
      // (sway-blue-l/r) was also dropped because it overlapped the
      // scroll-ribbon polygon coverage area — duplicate work that
      // could only conflict. Princess + her hair + the bow are now
      // 100% static. Sway is restricted to corner tassels, vertical
      // frame flowers, and bottom flower clusters — all far from
      // the figure.
      const SWAY = [
        // --- TASSELS (cord-and-bobble pair at the corners) ---
        { bbox: [5.59,  13.26,  8.91, 26.33], pivot: [7.25, 13.26],  anim: "sway-tassel-l",  dur: 5.5, delay:  0   },
        { bbox: [91.02, 13.35, 94.41, 26.43], pivot: [92.75, 13.35], anim: "sway-tassel-r",  dur: 6.0, delay: -1.8 },
        // --- VERTICAL flower stalks flanking the circle frame ---
        { bbox: [14.37, 43.09, 23.48, 80.29], pivot: [16.23, 80.29], anim: "sway-vert-l",    dur: 9.5, delay:  0   },
        { bbox: [76.52, 43.28, 85.50, 80.11], pivot: [83.57, 80.11], anim: "sway-vert-r",    dur: 10.2,delay: -3   },
        // --- BOTTOM-edge flower clusters (the high ones) ---
        { bbox: [8.98,  63.72, 23.14, 92.82], pivot: [11.60, 92.82], anim: "sway-bot-l",     dur: 9.2, delay:  0   },
        { bbox: [71.55, 63.72, 86.00, 92.82], pivot: [83.43, 92.82], anim: "sway-bot-r",     dur: 10.0,delay: -2.5 },
      ];
      const bgLayer = host.querySelector(".cover-bg-layer");
      function clipFor(x1, y1, x2, y2) {
        return `inset(${y1}% ${100 - x2}% ${100 - y2}% ${x1}%)`;
      }
      SWAY.forEach(r => {
        const d = document.createElement("div");
        d.className = "menu-sway";
        d.style.clipPath = clipFor(r.bbox[0], r.bbox[1], r.bbox[2], r.bbox[3]);
        d.style.webkitClipPath = d.style.clipPath;
        d.style.transformOrigin = r.pivot[0] + "% " + r.pivot[1] + "%";
        d.style.animationName            = r.anim;
        d.style.animationDuration        = r.dur + "s";
        d.style.animationDelay           = (r.delay || 0) + "s";
        d.style.animationTimingFunction  = "ease-in-out";
        d.style.animationIterationCount  = "infinite";
        d.style.animationDirection       = "alternate";
        if (bgLayer) bgLayer.appendChild(d);
      });

      // === CONTINUOUS RIBBON OVERLAYS ===============================
      // Each scroll-banner tail flanking the title is ONE polygon
      // overlay — never sliced. User: the 13-point polygon I had
      // before was still breaking visually at the inner-curl-to-
      // tail junction (~ y 232–266 on the 1448×1086 ref), because
      // the contour wasn't dense enough to follow the painted
      // curl. Replaced with a 26-point clockwise contour traced
      // along the actual cloth shape (above and BACK across the
      // inner curl), so the polygon now properly hugs the inside
      // of the curl too. Junction region is no longer a notch.
      // ZERO SLICES. ONE shape per ribbon. Continuous deformation
      // achieved purely via rotation around a root-anchored
      // transform-origin → tail swings widely, root sits still. */
      const RIBBON_L_POLYGON = "polygon(" + [
        [21.20, 17.31], [19.75, 17.50], [18.51, 18.23],
        [17.82, 19.71], [17.61, 21.73], [17.61, 23.76],
        [16.85, 26.15], [15.75, 29.37], [15.06, 32.32],
        [15.06, 34.72], [16.85, 33.52], [19.41, 32.41],
        [22.10, 32.23], [23.76, 31.59], [24.59, 30.02],
        [25.00, 27.81], [26.66, 26.80], [28.25, 26.61],
        [28.73, 24.95], [28.59, 22.47], [27.69, 21.73],
        [25.83, 21.73], [24.86, 20.63], [24.59, 18.69],
        [23.48, 17.59], [22.24, 17.31],
      ].map(p => p[0] + "% " + p[1] + "%").join(", ") + ")";
      const RIBBON_R_POLYGON = "polygon(" + [
        [75.14, 17.31], [76.66, 17.40], [78.04, 18.23],
        [78.73, 19.71], [78.87, 21.73], [78.87, 23.76],
        [79.63, 26.15], [80.73, 29.37], [81.77, 32.23],
        [84.25, 34.62], [83.98, 32.14], [82.18, 31.12],
        [79.14, 30.57], [77.35, 29.74], [76.52, 27.99],
        [75.97, 26.80], [74.45, 26.61], [72.45, 26.61],
        [71.55, 24.95], [71.27, 22.47], [72.10, 21.73],
        [74.03, 21.73], [75.00, 20.63], [75.35, 18.69],
        [76.17, 17.59], [75.14, 17.31],
      ].map(p => p[0] + "% " + p[1] + "%").join(", ") + ")";
      function makeRibbon(polygon, pivot, anim, dur, delay) {
        const d = document.createElement("div");
        d.className = "menu-sway menu-ribbon";
        d.style.clipPath        = polygon;
        d.style.webkitClipPath  = polygon;
        d.style.transformOrigin = pivot;
        d.style.animationName            = anim;
        d.style.animationDuration        = dur + "s";
        d.style.animationDelay           = delay + "s";
        d.style.animationTimingFunction  = "ease-in-out";
        d.style.animationIterationCount  = "infinite";
        d.style.animationDirection       = "alternate";
        if (bgLayer) bgLayer.appendChild(d);
      }
      // Pivot anchored at the painted root attachment (top-centre of
      // the inner curl, just below the scroll). Rotating around
      // this point swings the TAIL across the painting while the
      // top edge — where the ribbon meets the title scroll —
      // barely shifts. Gives the "root weak, tail strong"
      // weighting in one continuous transform.
      makeRibbon(RIBBON_L_POLYGON, "23% 18%", "ribbon-wave-l", 7.5,  0);
      makeRibbon(RIBBON_R_POLYGON, "77% 18%", "ribbon-wave-r", 8.2, -2.5);

      // === Magic-dust motes — slow upward drift =====================
      // 20 small luminous specks slowly rise from below the page,
      // drift through the night sky, and fade above. The phases
      // are spread across the full period range (delay -16s ... 0s)
      // so at any moment some mote is mid-rise — gives a
      // continuous, never-empty layer rather than 8 motes that
      // briefly all disappear at once.
      const layer = host.querySelector(".cover-bg-layer");
      for (let i = 0; i < 20; i++) {
        const d = document.createElement("div");
        d.className = "menu-dust";
        // X biased to the wide outer bands the night-sky stars live
        // in — keeps motes away from her face/hands.
        const left  = Math.random() < 0.5;
        const xpct  = left ? rnd(8, 38) : rnd(62, 92);
        d.style.setProperty("--x",     xpct + "%");
        d.style.setProperty("--sz",    rnd(3, 6) + "px");
        d.style.setProperty("--drift", ((Math.random() - 0.5) * 90) + "px");
        d.style.setProperty("--d",     rnd(14, 22) + "s");
        d.style.setProperty("--delay", (-Math.random() * 16) + "s");
        if (layer) layer.appendChild(d);
      }
    },
  };


  /* ---------- select ---------- */
  const select = {
    init(host) {
      function playSelectChime() {
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          const ctx = new Ctx();
          const notes = [659.25, 880.00, 1318.51];
          const now = ctx.currentTime;
          notes.forEach((f, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "sine"; o.frequency.value = f;
            const t0 = now + i * 0.10;
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.16, t0 + 0.018);
            g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.65);
            o.connect(g).connect(ctx.destination);
            o.start(t0); o.stop(t0 + 0.7);
          });
          setTimeout(() => { try { ctx.close(); } catch (_) {} }, 1300);
        } catch (_) {}
      }
      const HOT_TO_TITLE = {
        "zone-select-story-hit":  ".zone-select-story-title",
        "zone-select-notes-hit":  ".zone-select-notes-title",
        "zone-select-garden-hit": ".zone-select-garden-title",
      };
      host.querySelectorAll(".select-hotspot").forEach(el => {
        el.addEventListener("click", (e) => {
          // Stop the global [data-go] delegate from also firing — we
          // want the 380 ms chime to play before nav, not be skipped.
          e.stopPropagation();
          const titleSel = Object.entries(HOT_TO_TITLE)
            .find(([cls]) => el.classList.contains(cls))?.[1];
          const titleEl = titleSel && host.querySelector(titleSel);
          if (titleEl) {
            titleEl.classList.remove("is-pressed");
            void titleEl.offsetWidth;
            titleEl.classList.add("is-pressed");
          }
          playSelectChime();
          const dest = el.dataset.action === "resume"
                     ? storyEntryHash()
                     : el.dataset.go;
          setTimeout(() => window.go(dest), 380);
        });
      });
    },
  };


  // The last section read in a chapter (story or browse), so "Open Chapter"
  // resumes where you left off instead of restarting at 1.1.
  function lastSectionOf(chapterId, fallback) {
    try {
      const ls = JSON.parse(localStorage.getItem("tpl.lastSection") || "{}");
      if (ls[chapterId]) return ls[chapterId];
    } catch (_) {}
    return fallback;
  }

  /* ---------- chapters ---------- */
  const chapters = {
    init(host, params) {
      const browse = params.browse === "1";
      const browseFlag = browse ? "&browse=1" : "";
      if (typeof CHAPTERS === "undefined") return;
      CHAPTERS.forEach((c) => {
        const text = host.querySelector(".zone-toc-" + c.number);
        const btn  = host.querySelector(".zone-toc-btn-" + c.number);
        const resumeSec = lastSectionOf(c.id, c.firstSection || "1.1");
        if (text) text.innerHTML = `
          <div class="toc-card-text">
            <p class="toc-card-tagline">${esc(c.tagline || "")}</p>
          </div>`;
        if (btn) btn.innerHTML = `
          <button type="button" class="antique-button toc-open-btn"
                  data-go="#reading?chapter=${encodeURIComponent(c.id)}&section=${encodeURIComponent(resumeSec)}${browseFlag}">
            <span class="antique-button-corner tl"></span>
            <span class="antique-button-corner tr"></span>
            <span class="antique-button-corner bl"></span>
            <span class="antique-button-corner br"></span>
            <span class="antique-button-label">Open Chapter</span>
          </button>`;
      });
    },
  };


  /* ---------- reading ---------- */
  function markClickable(sentence) {
    const used = new Set();
    return sentence.replace(/[A-Za-z][a-zA-Z'-]*/g, (m) => {
      const lc = m.toLowerCase();
      if (used.has(lc) || !hasClickableWord(lc)) return m;
      used.add(lc);
      return `<span class="clickable-word" data-word="${lc}">${m}</span>`;
    });
  }
  // Wrap EVERY word in a .w span so the current sentence can ink its
  // words in one-by-one (GPT-style streaming); clickable words also get
  // .clickable-word + data-word. Non-letter runs (spaces / punctuation)
  // pass through untouched. --wi carries each word's index so CSS can
  // stagger the brighten.
  // A reading word is clickable when VocabRuntime can answer it (word
  // master OR proper/place small card). Falls back to the legacy index
  // if the runtime isn't loaded.
  function vocabClickable(word) {
    if (window.VocabRuntime && VocabRuntime.getSmallCard) return !!VocabRuntime.getSmallCard(word);
    return (typeof hasClickableWord === "function") && hasClickableWord(word);
  }
  function renderSentenceHTML(sentence) {
    const used = new Set();
    let wi = 0;
    return String(sentence).replace(/[A-Za-z][A-Za-z'-]*|[^A-Za-z]+/g, (m) => {
      if (!/^[A-Za-z]/.test(m)) return esc(m);
      const lc = m.toLowerCase();
      const clickable = !used.has(lc) && vocabClickable(lc);
      if (clickable) used.add(lc);
      return `<span class="w${clickable ? " clickable-word" : ""}" style="--wi:${wi++}"`
           + `${clickable ? ` data-word="${lc}"` : ""}>${esc(m)}</span>`;
    });
  }
  function getPhrasePairs(entry) {
    const out = [];
    if (Array.isArray(entry.phrases)) {
      for (const p of entry.phrases) {
        if (out.length >= 2) break;
        if (p && p.en && p.zh) out.push({ en: p.en, zh: p.zh });
      }
    }
    if (out.length < 2 && Array.isArray(entry.kin)) {
      for (const k of entry.kin) {
        if (out.length >= 2) break;
        if (k && typeof k === "object" && Array.isArray(k.phrases)) {
          for (const p of k.phrases) {
            if (out.length >= 2) break;
            if (p && p.en && p.zh) out.push({ en: p.en, zh: p.zh });
          }
        }
      }
    }
    if (out.length < 2 && Array.isArray(entry.friend)) {
      for (const f of entry.friend) {
        if (out.length >= 2) break;
        if (typeof f === "string") {
          const m = f.match(/^(.+?)\s+([一-鿿].*)$/);
          if (m) out.push({ en: m[1].trim(), zh: m[2].trim() });
        }
      }
    }
    if (out.length < 2 && Array.isArray(entry.collocations)) {
      for (const c of entry.collocations) {
        if (out.length >= 2) break;
        if (typeof c === "string") out.push({ en: c, zh: "" });
      }
    }
    return out;
  }

  const reading = {
    init(host, params) {
      const chapterId  = params.chapter || "universe";
      const sectionNum = params.section || "1.1";
      let   illustrationId = params.page || null;
      const book    = (typeof getChapterOrDefault === "function")
                       ? getChapterOrDefault(chapterId) : { number: "01", title: chapterId };
      const section = ChapterNav.findSection(chapterId, sectionNum);
      const isBrowse = params.browse === "1";

      // Multi-illustration chapters (e.g. Europe's France / Empress /
      // Alice) split their sections into N even bands by chapter count
      // — first third → image 1, middle third → image 2, last third →
      // image 3. Not strict ("不用那么严格"), just an even division. Only
      // kicks in for chapters with 3+ images so single-/two-image
      // chapters keep their default background.
      if (!illustrationId) {
        const key   = book.illustrationKey || chapterId;
        const entry = (typeof CHAPTER_ILLUSTRATIONS !== "undefined")
                      ? CHAPTER_ILLUSTRATIONS[key] : null;
        const imgs  = (entry && entry.images) || [];
        if (imgs.length >= 3) {
          const list = ChapterNav.sectionsOf(chapterId);
          const idx  = Math.max(0, list.findIndex(s => s.number === sectionNum));
          const n    = list.length || 1;
          const which = Math.min(imgs.length - 1,
                                 Math.floor(idx / n * imgs.length));
          illustrationId = imgs[which].id;
        }
      }

      if (!isBrowse) {
        try {
          localStorage.setItem("tpl.lastRead", JSON.stringify({
            chapter: chapterId, section: sectionNum,
            page: illustrationId, at: Date.now(),
          }));
        } catch (_) {}
      }
      // Remember the last section read in EACH chapter (story OR browse) so the
      // index's "Open Chapter" resumes where you left off, not always 1.1.
      try {
        const ls = JSON.parse(localStorage.getItem("tpl.lastSection") || "{}");
        ls[chapterId] = sectionNum;
        localStorage.setItem("tpl.lastSection", JSON.stringify(ls));
      } catch (_) {}

      const bg = typeof getChapterBackground === "function"
                 ? getChapterBackground(chapterId, illustrationId) : null;
      if (bg) host.style.backgroundImage = `url("${bg}")`;

      host.querySelector("[data-chapter-number]").textContent = "Chapter " + book.number;
      host.querySelector("[data-chapter-title]").textContent  = book.title;
      host.querySelector("[data-chapter-section]").textContent =
        section ? (section.number + " · " + section.title) : sectionNum;

      const body = host.querySelector(".reading-body");
      if (section && section.blocks && section.blocks.length) {
        body.innerHTML = section.blocks.map((sent, i) => {
          const audio = `${section.audio_prefix}-${i + 1}.mp3`;
          return `<p class="sentence-block" data-i="${i}" data-audio="${audio}">${renderSentenceHTML(sent)}</p>`;
        }).join("");
      } else {
        body.innerHTML = `<p class="sentence-block" data-i="0">No content available yet for this section.</p>`;
      }

      function currentEntryFromStack() {
        const cur = host.querySelector(".word-card.is-current");
        if (!cur) return null;
        const id = cur.dataset.id;
        return (typeof WORDS !== "undefined" && WORDS.find(w => (w.id || w.word) === id))
            || (typeof WORD_LIBRARY !== "undefined" && WORD_LIBRARY.find(w => (w.id || w.word) === id))
            || null;
      }

      function clearCurrent(stack) {
        stack.querySelectorAll(".word-card.is-current")
             .forEach(c => c.classList.remove("is-current"));
      }
      function shortMeaning(entry) { return entry.meaning || ""; }

      // Right-column SMALL card from VocabRuntime.getSmallCard(word):
      //   word / zh / up to 2 phrases / one example.
      // Tapping the card opens the full DRAWER big card — unless it's a
      // proper/place word (clickableForBigCard === false), which has no
      // big card.
      function smallCardHTML(sc, id, savedAlready) {
        const phraseRows = (sc.phrases || []).slice(0, 2).map(p => `
          <div class="word-card-phrase">
            <span class="wcp-en">${esc(p.phrase || p.en || "")}</span>
            ${(p.phrase_zh || p.zh) ? `<span class="wcp-zh">${esc(p.phrase_zh || p.zh)}</span>` : ""}
          </div>`).join("");
        const ex = (sc.examples || [])[0];
        const exEn = ex && (ex.example || ex.en) || "";
        const exZh = ex && (ex.example_zh || ex.zh) || "";
        const exampleRow = exEn ? `
          <div class="word-card-example">
            <span class="wce-en">${esc(exEn)}</span>
            ${exZh ? `<span class="wce-zh">${esc(exZh)}</span>` : ""}
          </div>` : "";
        // (HEAD chip removed at the user's request — the head data was noisy,
        // e.g. hold → "holey". Tapping the card body still opens the big card.)
        return `
          <div class="word-card is-current is-entering${savedAlready ? " is-saved" : ""}${sc.clickableForBigCard ? " is-openable" : ""}" data-id="${esc(id)}">
            <div class="word-card-headword">${esc(sc.word || id)}</div>
            <div class="word-card-meaning">${esc(sc.zh || "")}</div>
            ${phraseRows}
            ${exampleRow}
          </div>`;
      }
      function renderMarginalia(sc) {
        const stack = host.querySelector(".word-card-stack");
        if (!stack || !sc) return;
        const id = sc.word;

        const empty = stack.querySelector(".word-card-empty");
        if (empty) empty.remove();

        const existing = stack.querySelector(`.word-card[data-id="${cssEsc(id)}"]`);
        if (existing) {
          clearCurrent(stack);
          existing.classList.add("is-current");
          existing.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return;
        }

        const savedAlready = Storage.isSaved(id, chapterId, sectionNum);
        clearCurrent(stack);
        stack.insertAdjacentHTML("beforeend", smallCardHTML(sc, id, savedAlready));

        const fresh = stack.lastElementChild;
        setTimeout(() => fresh.classList.remove("is-entering"), 620);
        fresh.addEventListener("click", (e) => {
          e.stopPropagation();
          clearCurrent(stack);
          fresh.classList.add("is-current");
          // Tapping the 原型 head chip opens that head's card; tapping the
          // card body opens the head the reading word resolves to (getBigCard
          // maps reading word → its learning head either way).
          const chip = e.target.closest("[data-open-head]");
          if ((chip || sc.clickableForBigCard) && typeof WordCard !== "undefined") {
            WordCard.openBigCard(chip ? chip.dataset.openHead : sc.word,
                                 { chapter: chapterId, section: sectionNum });
          }
          syncMarginaliaButtons();
        });
        fresh.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }

      // Drives the FOLD button's enabled/saved state straight from
      // the current-card's data-id. FOLD is now a TOGGLE — saved
      // cards can be unsaved by pressing FOLD again (user request).
      // .is-active class on the button reflects "this card is
      // currently saved", but the button is never disabled — it
      // always invites a press (either to fold OR unfold).
      function syncMarginaliaButtons() {
        const fold = host.querySelector('.marginalia-btn[data-action="fold"]');
        if (!fold) return;
        const card = host.querySelector(".word-card.is-current");
        const id   = card && card.dataset.id;
        if (!id) {
          fold.disabled = true; fold.classList.remove("is-active"); return;
        }
        fold.disabled = false;
        if (Storage.isSaved(id, chapterId, sectionNum)) fold.classList.add("is-active");
        else                                            fold.classList.remove("is-active");
      }

      renderMarginalia(null);

      // Persist FOLDED cards across reading-view re-entries — SECTION
      // SCOPED. Only this section's saved words are rendered, so
      // navigating to a different section doesn't pull in the prior
      // section's notes (user req: "1.1 的词不应该出现在 1.2").
      function loadFoldedCardsIntoStack() {
        const stack = host.querySelector(".word-card-stack");
        if (!stack) return;
        const ids = Storage.getNotes ? Storage.getNotes(chapterId, sectionNum) : [];
        if (!ids.length) return;
        const empty = stack.querySelector(".word-card-empty");
        if (empty) empty.remove();
        ids.forEach(id => {
          const sc = (window.VocabRuntime && VocabRuntime.getSmallCard)
                     ? VocabRuntime.getSmallCard(id) : null;
          // Even if the master no longer indexes this id, render a minimal
          // card so the saved state isn't silently lost.
          const card = sc || { word: id, zh: "", phrases: [], examples: [], clickableForBigCard: false };
          stack.insertAdjacentHTML("beforeend",
            smallCardHTML(card, id, true).replace("is-current is-entering", "is-saved"));
          const fresh = stack.lastElementChild;
          fresh.addEventListener("click", (e) => {
            e.stopPropagation();
            clearCurrent(stack);
            fresh.classList.add("is-current");
            if (card.clickableForBigCard && typeof WordCard !== "undefined") WordCard.openBigCard(card.word, { chapter: chapterId, section: sectionNum });
            syncMarginaliaButtons();
          });
        });
      }
      loadFoldedCardsIntoStack();

      // Locket — the running count of folded words IN THIS CHAPTER.
      // Counts only the current chapter's folds (merged across its
      // sections) so the tally restarts at 0 on entering a new
      // chapter rather than accumulating globally across chapters
      // (user req: "fold 计数每章从 0 开始"). The underlying save
      // logic is unchanged — only what the chip displays.
      function syncLocket(pop) {
        const el = host.querySelector("[data-saved-count]");
        if (!el) return;
        el.textContent = String(Storage.getChapterNoteCount(chapterId));
        if (pop) {
          const locket = el.closest(".marginalia-locket");
          if (locket) {
            locket.classList.remove("is-pop");
            void locket.offsetWidth;
            locket.classList.add("is-pop");
          }
        }
      }
      syncLocket(false);

      const fold = host.querySelector('.marginalia-btn[data-action="fold"]');
      if (fold) fold.addEventListener("click", (e) => {
        e.stopPropagation();
        // FOLD as a toggle — press once to save, press again to
        // unfold. The user explicitly asked for the un-save path
        // ("再按一下 fold 取消收藏的功能没做").
        const card = host.querySelector(".word-card.is-current");
        const id   = card && card.dataset.id;
        if (!id) return;
        if (Storage.isSaved(id, chapterId, sectionNum)) {
          Storage.unsaveWord(id, chapterId, sectionNum);
          if (card) card.classList.remove("is-saved");
          window.toast && window.toast("Unfolded");
        } else {
          Storage.saveWord(id, chapterId, sectionNum);
          if (card) {
            card.classList.add("is-saved", "just-folded");
            setTimeout(() => card.classList.remove("just-folded"), 540);
          }
          window.toast && window.toast("Folded into Notes");
        }
        syncMarginaliaButtons();
        syncLocket(true);
      });

      // Spawn a small burst of warm-gold particles at (clientX, clientY).
      // Coordinates are resolved into PERCENT of host's bounding rect so
      // they survive the .stage scale transform. Each sparkle is added
      // directly to host (the .page) and removed when its animation
      // completes — no global cleanup loop, no leak.
      function spawnWordSparkles(clientX, clientY) {
        const rect = host.getBoundingClientRect();
        if (!rect.width) return;
        const fx = ((clientX - rect.left) / rect.width)  * 100;
        const fy = ((clientY - rect.top)  / rect.height) * 100;
        for (let i = 0; i < 5; i++) {
          const s = document.createElement("div");
          s.className = "word-tap-sparkle";
          s.style.left = fx + "%";
          s.style.top  = fy + "%";
          s.style.setProperty("--ang",   (Math.random() * 360) + "deg");
          s.style.setProperty("--dist",  (24 + Math.random() * 38) + "px");
          s.style.animationDelay = (i * 24) + "ms";
          host.appendChild(s);
          setTimeout(() => { try { s.remove(); } catch (_) {} }, 880);
        }
      }

      const blocks = Array.from(body.querySelectorAll(".sentence-block"));
      const titleZone = host.querySelector(".zone-reading-title");
      let curIdx = -1;
      let revealFrontier = 0;   // how many sentences have been shown so far
      let autoOn = false;
      let autoTimer = null;

      // Speak ONE sentence. It becomes the "current" line — rises, gets a
      // soft left mark + warm underglow, and inks its words in one-by-one
      // — then, the moment the voice ends, that highlight is cleared and
      // the sentence simply stays fully visible ("read"). The title is
      // shown but NEVER spoken. opts.onEnd lets AUTO chain onward.
      function speakSentence(i, opts) {
        if (i < 0 || i >= blocks.length) { if (opts && opts.onEnd) opts.onEnd(); return; }
        const b = blocks[i];
        const prev = body.querySelector(".sentence-block.is-current");
        if (prev && prev !== b) {
          prev.classList.remove("is-current"); prev.classList.add("is-read");
          clearTimeout(prev._clr); clearZh(prev);
        }
        if (i + 1 > revealFrontier) revealFrontier = i + 1;
        b.classList.add("is-revealed"); b.classList.remove("is-read");
        // Reflow so the rise + word-ink animations replay each time.
        b.classList.remove("is-current"); void b.offsetWidth; b.classList.add("is-current");
        titleZone && titleZone.classList.add("is-revealed");
        try { b.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (_) {}
        curIdx = i;
        let ended = false;
        const done = () => {
          if (ended) return; ended = true;
          clearTimeout(b._clr);
          b.classList.remove("is-current"); b.classList.add("is-read");
          clearZh(b);                 // translation lives only while the voice plays
          if (opts && opts.onEnd) opts.onEnd();
        };
        // Fallback in case the voice's onend never fires (no voices / muted).
        const words = (b.textContent.match(/\S+/g) || []).length;
        b._clr = setTimeout(done, words * 360 + 2500);
        TTS.speak(b.textContent, { onEnd: done });
      }

      // LINEAR reveal: a tap on blank page / the title / not-yet-shown
      // text reads the NEXT sentence in 1·2·3·4 order.
      function advanceLinear(opts) {
        if (revealFrontier >= blocks.length) { stopAuto(); return; }
        speakSentence(revealFrontier, opts);
      }

      // ---- AUTO: continuous, hands-free read straight down the page ----
      const autoBtn = host.querySelector("[data-auto]");
      function syncAutoBtn() {
        if (!autoBtn) return;
        autoBtn.classList.toggle("is-active", autoOn);
        const label = autoBtn.querySelector(".auto-label");
        if (label) label.textContent = autoOn ? "Stop" : "Auto";
      }
      function autoChain() {
        if (autoOn) autoTimer = setTimeout(() => advanceLinear({ onEnd: autoChain }), 450);
      }
      function startAuto() {
        if (autoOn) return;
        autoOn = true; syncAutoBtn();
        if (revealFrontier >= blocks.length) revealFrontier = 0;  // loop from the top
        advanceLinear({ onEnd: autoChain });
      }
      function stopAuto() {
        if (!autoOn) return;
        autoOn = false; syncAutoBtn();
        clearTimeout(autoTimer); TTS.cancel();
      }
      if (autoBtn) autoBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (autoOn) stopAuto(); else startAuto();
      });
      // Leaving the reading view stops autoplay and silences the voice.
      window.addEventListener("hashchange", function onLeaveReading() {
        autoOn = false; clearTimeout(autoTimer); TTS.cancel();
      }, { once: true });

      // ONE handler for the whole page:
      //   • word in a SHOWN sentence   → open its word card + speak it
      //   • a SHOWN sentence (no word)  → reread that whole sentence
      //   • anything else (blank page, title, a not-yet-shown sentence)
      //                                  → reveal & read the next in order
      // Unrevealed text is therefore NOT individually clickable. Chrome
      // (nav, controls, the word column / drawer) is ignored. Any tap
      // pauses AUTO.
      host.addEventListener("click", (e) => {
        if (e.target.closest(".word-card")) { setTimeout(() => syncMarginaliaButtons(), 0); return; }
        if (e.target.closest("button, a, input, select, textarea, .ui-bottom-nav,"
                           + " .reading-controls, .zone-marginalia, .word-drawer,"
                           + " .word-drawer-backdrop")) return;

        const sent = e.target.closest(".sentence-block");
        const revealed = sent && sent.classList.contains("is-revealed");
        const word = e.target.closest(".clickable-word");

        // DOUBLE-TAP a revealed sentence (not a word) → toggle its translation
        // WITHOUT interrupting the voice or AUTO. Handle this before stopAuto so
        // playback continues while you read the Chinese.
        if (sent && revealed && !word) {
          const i = +sent.dataset.i;
          const nowT = Date.now();
          if (sent._tapT && (nowT - sent._tapT) < 380) {
            sent._tapT = 0; clearTimeout(sent._tapTimer);
            // Double-tap → flash the translation, bound to this line's audio.
            showSentenceZh(sent, i);
            const cur = body.querySelector(".sentence-block.is-current");
            // If it isn't the line currently being read, start it so the zh is
            // time-bound (and removed the moment that read ends). If it IS the
            // current line, leave the voice running — its done() clears the zh.
            if (cur !== sent) { if (autoOn) stopAuto(); speakSentence(i); }
          } else {
            sent._tapT = nowT;
            sent._tapTimer = setTimeout(() => { sent._tapT = 0; if (autoOn) stopAuto(); speakSentence(i); }, 240);
          }
          return;
        }

        if (autoOn) stopAuto();

        if (word && revealed) {
          spawnWordSparkles(e.clientX, e.clientY);
          host.querySelectorAll(".clickable-word.is-selected")
              .forEach(x => x.classList.remove("is-selected"));
          word.classList.add("is-selected");
          const sc = (window.VocabRuntime && VocabRuntime.getSmallCard)
                     ? VocabRuntime.getSmallCard(word.dataset.word) : null;
          if (sc) {
            renderMarginalia(sc);
            syncMarginaliaButtons();
            try {
              const parts = [sc.word]
                .concat((sc.phrases || []).slice(0, 2).map(p => p.phrase || p.en))
                .concat((sc.examples || []).slice(0, 1).map(x => x.example || x.en));
              TTS.speak(parts.filter(Boolean).join(". "));
            } catch (_) {}
          } else {
            try { TTS.speak(word.textContent); } catch (_) {}
          }
          return;
        }
        if (sent && revealed) { speakSentence(+sent.dataset.i); return; }
        advanceLinear();
      });

      // Show the translation line under a sentence (idempotent). It is
      // EPHEMERAL: bound to the audio — it appears only while the line is being
      // read and vanishes when the voice ends (clearZh, called from the
      // playback's done()). The next playback never auto-shows it again — you
      // must double-tap during a read to glimpse it ("制造时间压力 + 声音文本对照").
      function showSentenceZh(sent, i) {
        if (sent.querySelector(".sentence-zh")) return;
        const map = (window.READING_TRANSLATIONS || {})[chapterId + "|" + sectionNum];
        const zh = (map && map[i]) || "";
        const div = document.createElement("div");
        div.className = "sentence-zh";
        div.textContent = zh || "(translation coming)";
        if (!zh) div.classList.add("is-missing");
        sent.appendChild(div);
        try { div.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (_) {}
      }
      function clearZh(block) { const z = block && block.querySelector(".sentence-zh"); if (z) z.remove(); }

      // Two reading modes share this view but NOT the bottom bar:
      //   • STORY (linear, the default markup): Save·Load·Quiz·Next·Menu
      //     — the graded path to clearing the book.
      //   • BROWSE (entered from the chapter index, ?browse=1): just a
      //     reader. No Quiz / Save / Load (anti-cheat). Only Prev · Back
      //     (return to the index) · Next — rebuilt here as 3 cells.
      if (isBrowse) {
        const nav = host.querySelector(".ui-bottom-nav");
        if (nav) {
          nav.innerHTML =
              '<button type="button" data-prev><span class="nav-glyph">‹</span>Prev</button>'
            + '<button type="button" data-toindex><span class="nav-glyph">❖</span>Back</button>'
            + '<button type="button" data-idxquiz><span class="nav-glyph">✦</span>Quiz</button>'
            + '<button type="button" data-next>Next<span class="nav-glyph-after">›</span></button>';
          nav.style.setProperty("--nav-count", "4");
          const iq = nav.querySelector("[data-idxquiz]");
          if (iq) iq.addEventListener("click", (e) => {
            e.stopPropagation(); window.__navDir = "forward";
            window.go((window.Quiz && Quiz.indexHref) ? Quiz.indexHref(chapterId, sectionNum)
              : `#quizstatus?chapter=${encodeURIComponent(chapterId)}&section=${encodeURIComponent(sectionNum)}`);
          });
        }
      }

      // BGM volume slider in the top-right control group (mirrors the
      // global chip, which is hidden on reading).
      const vol = host.querySelector(".reading-bgm-vol");
      if (vol && window.BGM) {
        if (BGM.getVolume) vol.value = Math.round(BGM.getVolume() * 100);
        vol.addEventListener("input", () => {
          if (BGM.setVolume) BGM.setVolume((+vol.value) / 100);
        });
      }

      // Prev (上一章) — back to the previous section's reading page.
      // Turns the page BACKWARD (old page in from the left).
      const prevBtn = host.querySelector("[data-prev]");
      if (prevBtn) prevBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        let href = ChapterNav.prevReading(chapterId, sectionNum);
        if (isBrowse) {
          href += href.indexOf("?") >= 0 ? "&browse=1" : "?browse=1";
        }
        window.__navDir = "back";
        window.go(href);
      });
      // Back — return to the chapter index (soft crossfade, not a turn).
      // Browse "Back" returns to WHERE you came from: the Words Garden, the
      // Notes deck, or the chapter index — never the story path.
      const fromOrigin = params.from || "";
      const browseBackHref = fromOrigin === "garden" ? "#word-garden"
        : fromOrigin === "note" ? "#notes"
        : "#chapters?browse=1";
      const toIndexBtn = host.querySelector("[data-toindex]");
      if (toIndexBtn) {
        if (fromOrigin === "garden") toIndexBtn.innerHTML = '<span class="nav-glyph">❖</span>Garden';
        else if (fromOrigin === "note") toIndexBtn.innerHTML = '<span class="nav-glyph">❖</span>Notes';
        toIndexBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          window.__navDir = (fromOrigin === "garden" || fromOrigin === "note") ? "up" : "fade";
          window.go(isBrowse ? browseBackHref : "#chapters");
        });
      }

      const next = host.querySelector("[data-next]");
      if (next) next.addEventListener("click", (e) => {
        e.stopPropagation();
        window.__navDir = "forward";   // turn the page onward
        if (isBrowse) {
          // Browse-mode Next: walk SECTIONS first (1.1 → 1.2 → 1.3 …),
          // hop to the next chapter only when this chapter's sections
          // are exhausted, return to the index when the whole book is.
          // User reported: prior version jumped straight to the next
          // chapter instead of advancing within the current one.
          const list = (ChapterNav && ChapterNav.sectionsOf) ? ChapterNav.sectionsOf(chapterId) : [];
          const i = list.findIndex(s => s.number === sectionNum);
          if (i >= 0 && i + 1 < list.length) {
            const ns = list[i + 1];
            window.go(
              `#reading?chapter=${encodeURIComponent(chapterId)}`
              + `&section=${encodeURIComponent(ns.number)}`
              + `&browse=1`
            );
            return;
          }
          if (typeof CHAPTERS !== "undefined") {
            const j = CHAPTERS.findIndex(c => c.id === chapterId);
            if (j >= 0 && j + 1 < CHAPTERS.length) {
              const nb = CHAPTERS[j + 1];
              window.go(
                `#reading?chapter=${encodeURIComponent(nb.id)}`
                + `&section=${encodeURIComponent(nb.firstSection || "1.1")}`
                + `&browse=1`
              );
              return;
            }
          }
          window.go("#chapters?browse=1");
          return;
        }
        window.go(ChapterNav.nextAfterReading(chapterId, sectionNum));
      });
      const quizBtn = host.querySelector("[data-quiz]");
      if (quizBtn) quizBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        // Reading Quiz = the CURRENT section's trial, resuming its open stage.
        const href = (window.Quiz && Quiz.readingHref)
          ? Quiz.readingHref(chapterId, sectionNum)
          : `#quiz?chapter=${encodeURIComponent(chapterId)}&section=${encodeURIComponent(sectionNum)}`;
        window.go(href);
      });

      // Arrived from a Notes card "Open Chapter": show the whole section
      // (all sentences fully visible) and spotlight the saved word on its
      // sentence for ~2s.
      if (params.word) {
        blocks.forEach(b => b.classList.add("is-revealed", "is-read"));
        revealFrontier = blocks.length;     // whole section already shown
        host.querySelector(".zone-reading-title")?.classList.add("is-revealed");
        curIdx = blocks.length - 1;
        // Find the clicked word — exact surface match first, else the token
        // that RESOLVES to it (the passage may hold an inflected form).
        let target = host.querySelector(`.clickable-word[data-word="${cssEsc(params.word)}"]`);
        if (!target) {
          const lw = String(params.word).toLowerCase();
          target = Array.from(host.querySelectorAll(".clickable-word")).find(el => resolvesTo(el.dataset.word, lw)) || null;
        }
        if (target) {
          // Stays lit in the reading click colour (is-selected persists); the
          // spotlight pulse just draws the eye for a moment.
          target.classList.add("is-selected", "is-spotlight");
          setTimeout(() => {
            try { target.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) {}
          }, 80);
          setTimeout(() => target.classList.remove("is-spotlight"), 2300);
        }
      }
    },
  };


  /* ---------- quiz ---------- */
  const quiz = {
    init(host, params) {
      const LETTER = ["A", "B", "C", "D"];
      const chapterId  = params.chapter || "universe";
      const sectionNum = params.section || "1.1";
      const book    = (typeof getChapterOrDefault === "function")
                       ? getChapterOrDefault(chapterId) : { number: "01", title: chapterId };
      const section = ChapterNav.findSection(chapterId, sectionNum);

      const bg = typeof getChapterBackground === "function"
                 ? getChapterBackground(chapterId, params.page) : null;
      if (bg) host.style.backgroundImage = `url("${bg}")`;

      host.querySelector("[data-chapter-number]").textContent = "Chapter " + book.number;
      host.querySelector("[data-chapter-title]").textContent  = book.title;
      host.querySelector("[data-chapter-section]").textContent =
        section ? (section.number + " · " + section.title) : sectionNum;

      // Where the bottom return button goes: a quiz opened from STORY reading
      // goes back to that story page; from MENU or INDEX it goes back to the
      // index's browse reader (which never touches main-line reading progress).
      const fromCtx = params.from || "menu";
      const encQ = (s) => encodeURIComponent(s);
      const returnHref = (fromCtx === "garden") ? "#word-garden"
        : (fromCtx === "story")
        ? `#reading?chapter=${encQ(chapterId)}&section=${encQ(sectionNum)}`
        : `#reading?chapter=${encQ(chapterId)}&section=${encQ(sectionNum)}&browse=1`;
      const storyLabel = (fromCtx === "garden")
        ? '<span class="nav-glyph">❖</span>Garden'
        : (fromCtx === "story")
        ? '<span class="nav-glyph">‹</span>Back' : '<span class="nav-glyph">❖</span>Story';
      function wireStoryBtn(guarded) {
        const b = host.querySelector("[data-story]");
        if (!b) return;
        b.innerHTML = storyLabel;
        if (!guarded) b.addEventListener("click", (e) => { e.stopPropagation(); window.__navDir = "back"; window.go(returnHref); });
      }

      // ============ SEAL · dictation (Spelling Practice) ============
      // Parchment "Listen and Spell" page. Correction layer + pass-judgment
      // per the design: seeing the answer never counts; only an independent,
      // un-prompted correct spelling on a fresh presentation SEALS the word.
      // Dictation is the independent (optional) stage, reached from the Words
      // Garden "Seal More" backlog — never part of the linear choice line.
      if ((params.stage || "") === "seal") { renderGoldenSeal(); return; }
      // Two CHOICE pages: SILVER (word → Chinese meaning) then GOLDEN (pick the
      // synonym group that fits the example; the example is read aloud).
      const isGroup = (params.stage === "golden");


      function rxq(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
      function speakWord(w) { try { if (typeof TTS !== "undefined" && TTS.speak) TTS.speak(String(w)); } catch (_) {} }
      // Build a spelling set from a token stream: clickable vocab words with
      // an example sentence containing the word. Up to 10 (one Word Set).
      // `tokens` is the section text by default, or the review word list.
      function buildGoldenSet(tokens) {
        const out = [], seen = new Set();
        for (const raw of (tokens || [])) {
          const w = String(raw).toLowerCase();
          if (seen.has(w)) continue;
          const sc = (window.VocabRuntime && VocabRuntime.getSmallCard) ? VocabRuntime.getSmallCard(w) : null;
          if (!sc || sc.proper) continue;
          const ans = String(sc.word || w).toLowerCase();
          if (seen.has(ans) || !/^[a-z][a-z'-]{2,}$/.test(ans)) continue;
          const ex = (sc.examples || []).find(e => e.example && new RegExp("\\b" + rxq(ans) + "\\b", "i").test(e.example));
          if (!ex) continue;
          seen.add(w); seen.add(ans);
          if (!(window.VocabRuntime && VocabRuntime.getBigCard && VocabRuntime.getBigCard(ans))) continue;  // owl-only → skip
          out.push({ word: ans, en: ex.example, zh: ex.example_zh || "",
                     pos: sc.pos || "", meaning: sc.zh || "" });
          if (out.length >= 10) break;
        }
        return out;
      }
      function sectionTokens(sec) { return ((sec && sec.blocks) || []).join(" ").match(/\b[A-Za-z][A-Za-z'-]{2,}\b/g) || []; }
      function renderGoldenSeal() {
        const body = host.querySelector(".quiz-body");
        const isReview = (params.review === "1");
        const isSeal = (params.seal === "1");   // dictation backlog from Words Garden
        if (isReview || isSeal) {
          host.querySelector("[data-chapter-number]").textContent = isSeal ? "Seal" : "Review";
          host.querySelector("[data-chapter-title]").textContent  = isSeal ? "Spelling Practice" : "Accumulated Words";
          host.querySelector("[data-chapter-section]").textContent = "most-missed first";
        }
        const wordList = isSeal && window.Quiz ? Quiz.toSpellWords()
                       : isReview && window.Quiz ? Quiz.reviewWords() : sectionTokens(section);
        const set = buildGoldenSet(wordList).slice(0, (isSeal || isReview) ? 8 : 10);
        if (!set.length) {
          body.innerHTML = `<div class="empty-state">No spelling set available yet for this section.</div>`;
          return;
        }
        set.forEach(q => { q.status = "unseen"; });   // unseen | corrected | sealed
        let queue = set.map((_, i) => i);
        let pos = 0, revealed = false, wrongThis = false;

        body.innerHTML = `
          <div class="gs-progress">
            <span class="gs-no">01</span><span class="gs-slash"> / ${set.length}</span>
            <span class="gs-dots"></span>
          </div>
          <div class="gs-panel">
            <div class="gs-label gs-listen">✦ LISTEN &amp; SPELL ✦ <span class="gs-replay">↻</span></div>
            <p class="gs-sentence-en"></p>
            <div class="gs-spell">
              <div class="gs-cells"></div>
              <input class="gs-input" type="text" lang="en" inputmode="email"
                     autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Spell the word">
            </div>
            <div class="gs-correction" hidden></div>
            <p class="gs-sentence-zh"></p>
            <p class="gs-note">Type what you hear, then press Enter.</p>
          </div>`;

        const el = (s) => body.querySelector(s);
        const input = el(".gs-input"), shakeEl = el(".gs-spell"), cellsEl = el(".gs-cells");
        const enEl = el(".gs-sentence-en"), zhEl = el(".gs-sentence-zh");
        const sayLine = () => { try { if (typeof TTS !== "undefined" && TTS.speak) TTS.speak(cur().en || cur().word); } catch (_) {} };
        const noEl = el(".gs-no"), dotsEl = el(".gs-dots"), corr = el(".gs-correction");

        const cur = () => set[queue[pos]];
        const sealedCount = () => set.filter(q => q.status === "sealed").length;
        function renderDots() {
          dotsEl.innerHTML = set.map(q =>
            `<span class="gs-dot ${q.status === "sealed" ? "is-sealed" : q.status === "corrected" ? "is-corrected" : ""}"></span>`).join("");
          noEl.textContent = String(Math.min(set.length, sealedCount() + 1)).padStart(2, "0");
        }
        // No per-letter cells — the user writes into one open line (no boxes
        // hinting the word's length). Kept as a no-op so callers stay simple.
        // Per-letter boxes (one cell per letter of the answer). A single input
        // backs them, so typing always fills left→right from the first box no
        // matter which cell you tapped.
        function renderCells() {
          const q = cur(); const v = (input.value || "").toLowerCase().slice(0, q.word.length);
          let h = "";
          for (let i = 0; i < q.word.length; i++) {
            const ch = v[i] || "";
            h += `<span class="gs-cell${i === v.length ? " is-caret" : ""}${ch ? " is-filled" : ""}">${esc(ch)}</span>`;
          }
          if (cellsEl) cellsEl.innerHTML = h;
        }
        // The blank now carries the word's CHINESE meaning, so you know which
        // word to spell from its sense (not its letters).
        function blankSentence(en, word, zh) {
          const fill = zh ? `<span class="gs-blank gs-blank-zh">${esc(zh)}</span>`
                          : `<span class="gs-blank">${"_".repeat(Math.max(6, word.length))}</span>`;
          return esc(en).replace(new RegExp("\\b" + rxq(word) + "\\b", "i"), fill);
        }
        let recordedWrong = false;   // count one WRONG per spoiled presentation
        function present() {
          revealed = false; wrongThis = false; recordedWrong = false;
          corr.hidden = true; corr.innerHTML = "";
          input.value = "";
          const q = cur();
          enEl.innerHTML = blankSentence(q.en, q.word, q.meaning);   // blank shows the 中文 meaning
          zhEl.textContent = "";                  // Chinese only appears AFTER answering
          shakeEl.classList.remove("is-shake");
          renderCells(); renderDots();
          setTimeout(() => { try { input.focus(); } catch (_) {} }, 60);
          sayLine();                              // auto-read the whole example
        }
        function showCorrection(typed) {
          const q = cur();
          // Dotted spelling (ex·cep·tion·al); colour each LETTER by comparing
          // it to the typed input at the matching plain position; dots are
          // plain separators.
          const dotted = (window.VocabRuntime && VocabRuntime.dotted) ? VocabRuntime.dotted(q.word) : q.word;
          let spell = "", pi = 0;
          for (const ch of dotted) {
            if (ch === "·") { spell += `<span class="gs-c-dot">·</span>`; continue; }
            const ok = typed[pi] && typed[pi].toLowerCase() === ch.toLowerCase();
            spell += `<span class="${ok ? "gs-c-ok" : "gs-c-bad"}">${esc(ch)}</span>`;
            pi++;
          }
          corr.innerHTML = `
            <div class="gs-c-row"><span class="gs-c-key">Your answer</span><span class="gs-c-you">${esc(typed) || "—"}</span></div>
            <div class="gs-c-row"><span class="gs-c-key">Correct spelling</span><span class="gs-c-correct">${spell}</span></div>
            ${q.meaning ? `<div class="gs-c-row"><span class="gs-c-key">Meaning</span><span class="gs-c-mean">${esc(q.meaning)}</span></div>` : ""}
            <div class="gs-c-tip">Tap the writing line to try again.</div>`;
          corr.hidden = false;
          // Chinese only appears now that the word has been answered.
          zhEl.textContent = q.zh || "";
        }
        function recordState() {
          if (window.Quiz && Quiz.setStageStatus) {
            const done = sealedCount() >= set.length;
            Quiz.setStageStatus(chapterId, sectionNum, "quiz2", done ? "completed" : "in_progress", null);
            Quiz.update(chapterId, sectionNum, { sealedWords: sealedCount(), totalWords: set.length });
          }
        }
        function finish() {
          recordState();
          body.innerHTML = `<div class="gs-done"><div class="gs-done-mark">✦</div>
            <div class="gs-done-title">Spelling Sealed</div>
            <p class="gs-done-sub">Spelled ${sealedCount()} / ${set.length}</p>
            <button type="button" class="gs-btn gs-continue" style="margin-top:18px">DONE</button></div>`;
          try { playSuccessChord(); } catch (_) {}
          spawnCelebration(host, 9);
          const go = () => window.go("#word-garden");   // dictation returns to the garden
          const c = body.querySelector(".gs-continue"); if (c) c.addEventListener("click", go);
          setTimeout(go, 2400);
        }
        // "临门一脚" exit prompt — leaving with words still unsealed shows the
        // almost-there nudge (remaining count in red) before letting them go.
        function remaining() { return set.length - sealedCount(); }
        function showExit(proceed) {
          let scrim = host.querySelector(".qx-scrim");
          if (!scrim) {
            scrim = document.createElement("div");
            scrim.className = "qx-scrim";
            scrim.innerHTML = `<div class="qx-card"><div class="qx-mark">✦</div>
              <p class="qx-en"></p>
              <div class="qx-actions">
                <button type="button" class="gs-btn qx-stay"></button>
                <button type="button" class="gs-btn qx-leave"></button>
              </div></div>`;
            host.appendChild(scrim);
          }
          const c = coaxCopy(sealedCount(), set.length, {
            fewMark: "✦ ALMOST SEALED ✦",
            fewEn: (left) => `Only <b class="qx-num">${left}</b> left to seal, your Highness.`,
            fewZh: "Spell these last few and the whole set is etched into your book — don't stop on the doorstep.",
            startMark: "✦ A FINE START ✦",
            startEn: (done, total) => `You've already sealed <b class="qx-num">${done}</b> of ${total}, your Highness.`,
            startZh: "Each one you spell is one truly yours — stay a little and watch the set fill up.",
          });
          const mark = scrim.querySelector(".qx-mark"); if (mark) mark.textContent = c.mark;
          scrim.querySelector(".qx-en").innerHTML =
              c.en
            + `<span class="qx-zh" style="display:block;margin-top:12px">${c.zh}</span>`;
          scrim.querySelector(".qx-stay").textContent = "Seal the Set";
          scrim.querySelector(".qx-leave").textContent = "Give Up";
          scrim.querySelector(".qx-stay").onclick = (e) => { e.stopPropagation(); scrim.remove(); try { input.focus(); } catch (_) {} };
          scrim.querySelector(".qx-leave").onclick = (e) => { e.stopPropagation(); scrim.remove(); proceed(); };
          requestAnimationFrame(() => scrim.classList.add("is-open"));
        }
        wireStoryBtn(true);   // label only; the guard below handles the tap
        // Capture-phase so we intercept BEFORE app.js's document-level data-go.
        host.addEventListener("click", (e) => {
          if (e.target.closest(".qx-scrim")) return;
          const btn = e.target.closest(".ui-bottom-nav [data-go], .ui-bottom-nav [data-story]");
          if (!btn) return;
          const isStory = btn.hasAttribute("data-story");
          const go = isStory ? () => { window.__navDir = "back"; window.go(returnHref); }
                             : () => window.go(btn.getAttribute("data-go"));
          if (remaining() > 0) { e.preventDefault(); e.stopPropagation(); showExit(go); }
          else if (isStory)    { e.preventDefault(); e.stopPropagation(); go(); }
        }, true);
        function onCheck() {
          const q = cur();
          const typed = input.value.trim().toLowerCase();
          if (!typed) { shakeEl.classList.remove("is-shake"); void shakeEl.offsetWidth; shakeEl.classList.add("is-shake"); return; }
          if (typed === q.word) {
            const clean = !revealed && !wrongThis;     // un-prompted, first try this presentation
            if (clean) { q.status = "sealed"; if (window.Quiz) Quiz.recordSpelled(q.word); playSuccessChord(); }
            else { if (q.status !== "sealed") q.status = "corrected"; if (window.Quiz) Quiz.recordCorrected(q.word); queue.push(queue[pos]); }
            // Correct → the 中文 blank slides into the real English word, the
            // line is read aloud, and the translation appears below.
            corr.hidden = true; corr.innerHTML = "";
            const filled = esc(q.en).replace(new RegExp("\\b" + rxq(q.word) + "\\b", "i"), `<span class="gs-filled">${esc(q.word)}</span>`);
            enEl.classList.add("gs-swap");
            setTimeout(() => { enEl.innerHTML = filled; enEl.classList.remove("gs-swap"); }, 150);
            zhEl.textContent = q.zh || "";
            renderDots(); recordState();
            // Advance only AFTER the line finishes reading (don't cut it off).
            let advanced = false;
            const next = () => { if (advanced) return; advanced = true; pos += 1; if (pos >= queue.length || sealedCount() >= set.length) return finish(); present(); };
            try { TTS.speak(q.en || q.word, { onEnd: next }); } catch (_) { setTimeout(next, 1700); }
            setTimeout(next, Math.max(2200, (q.en || q.word).length * 90));   // safety net if onEnd never fires
          } else {
            wrongThis = true;
            if (q.status !== "sealed") q.status = "corrected";
            if (!recordedWrong && window.Quiz) { Quiz.recordWord(q.word, false); recordedWrong = true; }
            shakeEl.classList.remove("is-shake"); void shakeEl.offsetWidth; shakeEl.classList.add("is-shake");
            // Wrong → just say the WORD once (reinforce its sound), show correction.
            showCorrection(typed); zhEl.textContent = q.zh || ""; renderDots();
            try { TTS.speak(q.word); } catch (_) {}
          }
        }
        function retry() { if (!corr.hidden) { corr.hidden = true; corr.innerHTML = ""; input.value = ""; renderCells(); } }

        input.addEventListener("input", () => { input.value = input.value.replace(/[^A-Za-z]/g, ""); if (!corr.hidden) { corr.hidden = true; corr.innerHTML = ""; } renderCells(); });
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); onCheck(); } });
        input.addEventListener("focus", retry);
        // Re-tapping the boxes after a WRONG answer wipes it clean so you can
        // type the whole word fresh (the input keeps focus, so focus won't
        // re-fire — clear on the tap itself). retry() only acts when a wrong
        // correction is showing.
        input.addEventListener("click", retry);
        input.addEventListener("pointerdown", retry);
        // Tap any cell → focus the (single) input; it always fills from the first.
        if (cellsEl) cellsEl.addEventListener("click", () => { try { input.focus(); } catch (_) {} });
        el(".gs-listen").addEventListener("click", sayLine);          // tap label / ↻ to replay
        enEl.addEventListener("click", sayLine);                      // tap the sentence to replay
        present();
      }

      function shuffle(arr, seed) {
        const a = arr.slice(); let s = seed;
        for (let i = a.length - 1; i > 0; i--) {
          s = (s * 9301 + 49297) % 233280;
          const j = Math.floor((s / 233280) * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      }
      function poolFor(section) {
        const tokens = new Set();
        const text = (section.blocks || []).join(" ");
        const m = text.match(/\b[A-Za-z][A-Za-z'-]{3,}\b/g) || [];
        for (const t of m) tokens.add(t.toLowerCase());
        for (const q of section.quiz || []) tokens.add(String(q.a).toLowerCase());
        const STOP = new Set(["that","this","with","from","into","were","have","been",
          "their","they","them","what","which","when","than","such","also","upon",
          "between","because","while","after","before","about","every","other","more",
          "only","some","most","each","over","under","still","never","always","could",
          "would","should","might","there","these","those","where"]);
        for (const w of STOP) tokens.delete(w);
        return Array.from(tokens);
      }
      function buildOptions(answer, pool) {
        const norm = (s) => String(s || "").trim().toLowerCase();
        const distractors = [];
        for (const w of pool) {
          if (distractors.length >= 3) break;
          const ww = String(w).trim();
          if (!ww) continue;
          if (norm(ww) === norm(answer)) continue;
          if (distractors.some(d => norm(d) === norm(ww))) continue;
          distractors.push(ww);
        }
        while (distractors.length < 3) distractors.push("—");
        return shuffle([answer, ...distractors], answer.length || 1);
      }
      function sharedPre(a, b) { let s = 0; const n = Math.min(a.length, b.length); while (s < n && a[s] === b[s]) s++; return s; }
      // Generate reading-style choice questions from the section's vocab:
      // English word as the prompt, four CHINESE-meaning options (one correct
      // + look-alike distractors).
      const QUIZ_TARGET = 16;
      const hasCJK = (s) => /[一-鿿]/.test(String(s || ""));
      // A word qualifies for the quiz only if it has a CHINESE meaning, a big
      // card and a surviving example (no-example or English-only-gloss words —
      // e.g. ones whose only example/zh was purged filler — are out of the quiz
      // AND the accumulation queue).
      function qualifyQuizWord(w) {
        const sc = (window.VocabRuntime && VocabRuntime.getSmallCard) ? VocabRuntime.getSmallCard(w) : null;
        if (!sc || sc.proper) return null;
        const zh = stripPos(sc.zh || "");
        if (!hasCJK(zh) || isMetaGloss(zh)) return null;   // skip inflection-label "meanings"
        const ans = String(sc.word || w).toLowerCase();
        if (!(window.VocabRuntime && VocabRuntime.getBigCard && VocabRuntime.getBigCard(ans))) return null;
        if (!(sc.examples || []).some(e => e && (e.example || e.en))) return null;
        return { word: ans, zh };
      }
      // Distractor pool — ONLY real reading words (the legit vocabulary), never
      // codex's flimsy external family/kin cards. Grouped by first letter.
      function quizDistractorPool() {
        if (window.__quizDistractors) return window.__quizDistractors;
        const REG = (window.VOCAB_WORD_CONTENT_REGISTRY_LITE || {}).cards || {};
        const readingSet = new Set(((window.VOCAB_READING_WORDS_LITE || {}).words || []).map(w => String(w).toLowerCase()));
        const byFirst = {};
        for (const k in REG) {
          const c = REG[k];
          const word = String(c.word || k).toLowerCase();
          if (!/^[a-z][a-z'-]{1,}$/.test(word)) continue;
          if (readingSet.size && !readingSet.has(word) && !readingSet.has(k.toLowerCase())) continue;  // reading vocab only
          const zh = stripPos(c.zh || "");
          if (!hasCJK(zh) || isMetaGloss(zh)) continue;
          const f = word[0];
          (byFirst[f] = byFirst[f] || []).push({ word, zh });
        }
        window.__quizDistractors = byFirst;
        return byFirst;
      }
      function zhKey(s) { return String(s || "").replace(/[^一-鿿]/g, ""); }   // CJK only
      function sharePrefix(a, b) { let p = 0; const n = Math.min(a.length, b.length); while (p < n && a[p] === b[p]) p++; return p; }
      function sameRoot(a, b) { const p = sharePrefix(a, b); return p >= 4 || p >= Math.min(a.length, b.length) * 0.7; }
      // Letter-overlap score: shared leading letters, then total shared letters.
      function lookAlike(a, b) {
        let pre = 0; const n = Math.min(a.length, b.length);
        while (pre < n && a[pre] === b[pre]) pre++;
        const setB = {}; for (const ch of b) setB[ch] = (setB[ch] || 0) + 1;
        let common = 0; for (const ch of a) { if (setB[ch] > 0) { common++; setB[ch]--; } }
        return pre * 10 + common;
      }
      // Words RELATED to the target (same family / kin / synonym group, and
      // inflections) — these must NEVER be distractors, or all four options end
      // up meaning the same thing ("四个选项一个意思").
      function relatedSet(word) {
        const set = new Set([String(word).toLowerCase()]);
        const VR = window.VocabRuntime;
        const bc = VR && VR.getBigCard ? VR.getBigCard(word) : null;
        if (bc) {
          [].concat(bc.family_members || [], bc.kin_members || [], bc.group || [])
            .forEach(m => { if (m && m.word) set.add(String(m.word).toLowerCase()); });
        }
        const head = VR && VR.getFamilyHead ? VR.getFamilyHead(word) : null;
        if (head) set.add(String(head).toLowerCase());
        return set;
      }
      // 3 distractor meanings from OTHER, UNRELATED words that look like `word`.
      // Excludes family/kin/synonyms, same-root inflections (expand↔expansion),
      // and any near-duplicate Chinese (扩大扩张 vs 扩大 扩张).
      function pickDistractors(word, zh) {
        const byFirst = quizDistractorPool();
        const related = relatedSet(word);
        const myHead = (window.VocabRuntime && VocabRuntime.getFamilyHead) ? String(VocabRuntime.getFamilyHead(word) || "").toLowerCase() : "";
        const tKey = zhKey(zh);
        const usedKeys = new Set([tKey]), out = [];
        function take(list) {
          list.sort((a, b) => lookAlike(word, b.word) - lookAlike(word, a.word));
          for (const c of list) {
            if (out.length >= 3) break;
            if (c.word === word || related.has(c.word) || sameRoot(word, c.word)) continue;     // same word / family / root
            if (myHead && window.VocabRuntime && VocabRuntime.getFamilyHead &&
                String(VocabRuntime.getFamilyHead(c.word) || "").toLowerCase() === myHead) continue;
            const ck = zhKey(c.zh);
            if (!ck || usedKeys.has(ck)) continue;                                              // duplicate meaning
            if (tKey && (ck.indexOf(tKey) >= 0 || tKey.indexOf(ck) >= 0)) continue;             // near-same meaning
            usedKeys.add(ck); out.push({ zh: c.zh, word: c.word });
          }
        }
        take((byFirst[word[0]] || []).slice());          // same first letter first
        if (out.length < 3) take([].concat.apply([], Object.keys(byFirst).map(k => byFirst[k])));   // then anywhere
        while (out.length < 3) out.push({ zh: "—", word: "" });
        return out;
      }
      function buildChoiceItems(sec) {
        const seen = new Set(), poolW = [];
        const firstMap = quizFirstSectionMap();
        const here = chapterId + "|" + sectionNum;
        // 1) EVERY word that first appears in this section (has a card + example,
        //    not repeated from an earlier chapter) gets a question — no 16 cap.
        const toks = ((sec && sec.blocks) || []).join(" ").match(/\b[A-Za-z][A-Za-z'-]{2,}\b/g) || [];
        for (const raw of toks) {
          const w = raw.toLowerCase(); if (seen.has(w)) continue; seen.add(w);
          const q = qualifyQuizWord(w); if (!q) continue;
          if (seen.has(q.word)) continue; seen.add(q.word);
          if (firstMap[q.word] && firstMap[q.word] !== here) continue;   // owned by an earlier section
          poolW.push(q);
        }
        // 2) only if the section is THIN do we pad up to a 16-question minimum
        //    with the highest-need accumulated words (recency-tiebroken).
        if (poolW.length < QUIZ_TARGET && window.Quiz && Quiz.reviewWords) {
          for (const fw of Quiz.reviewWords()) {
            if (poolW.length >= QUIZ_TARGET) break;
            if (seen.has(fw)) continue;
            const q = qualifyQuizWord(fw); if (!q) continue;
            if (seen.has(q.word)) continue;
            seen.add(fw); seen.add(q.word);
            poolW.push(q);
          }
        }
        // Random order each time (no fixed sequence to memorise the answers by).
        const ordered = shuffle(poolW, Math.floor(Math.random() * 99991));
        return ordered.map(p => {
          const distract = pickDistractors(p.word, p.zh);
          const opts = shuffle([{ zh: p.zh, word: p.word, correct: true }]
            .concat(distract.map(d => ({ zh: d.zh, word: d.word, correct: false }))), p.word.length || 1);
          return { word: p.word, zh: p.zh, options: opts };
        });
      }
      // Group page: pick the synonym that fits the example (word underlined);
      // each target word must have an in-example occurrence + a carded group
      // synonym. Options are English synonyms.
      function buildGroupItems(sec) {
        const seen = new Set(), cand = [];
        const firstMap = quizFirstSectionMap();
        const here = chapterId + "|" + sectionNum;
        const toks = ((sec && sec.blocks) || []).join(" ").match(/\b[A-Za-z][A-Za-z'-]{2,}\b/g) || [];
        for (const raw of toks) {
          const w = raw.toLowerCase(); if (seen.has(w)) continue;
          const sc = (window.VocabRuntime && VocabRuntime.getSmallCard) ? VocabRuntime.getSmallCard(w) : null;
          if (!sc || sc.proper) continue;
          const ans = String(sc.word || w).toLowerCase(); if (seen.has(ans)) continue;
          seen.add(w); seen.add(ans);
          if (firstMap[ans] && firstMap[ans] !== here) continue;   // word only quizzed in its first section
          const bc = VocabRuntime.getBigCard ? VocabRuntime.getBigCard(ans) : null;
          const syns = ((bc && bc.group) || []).filter(g => g.clickable && g.word);
          const ex = (sc.examples || []).find(e => e.example && new RegExp("\\b" + rxq(ans) + "\\b", "i").test(e.example));
          if (syns.length && ex) cand.push({ word: ans, ex: ex.example, correctSyn: syns[0].word });
        }
        return shuffle(cand, Math.floor(Math.random() * 99991)).map(c => {
          const distract = pickGroupDistractors(c.word, c.correctSyn);
          const opts = shuffle([{ zh: c.correctSyn, word: c.correctSyn, correct: true }]
            .concat(distract.map(d => ({ zh: d, word: d, correct: false }))), c.word.length || 1);
          return { group: true, word: c.word, ex: c.ex, options: opts };
        });
      }
      // 3 ENGLISH distractor words for a synonym question — real reading words
      // that look like the correct synonym, never the target / its relations.
      function pickGroupDistractors(targetWord, correctSyn) {
        const byFirst = quizDistractorPool();
        const related = relatedSet(targetWord);
        related.add(String(correctSyn).toLowerCase());
        const syn = String(correctSyn).toLowerCase();
        const out = [], used = new Set([syn, String(targetWord).toLowerCase()]);
        function take(list) {
          list.sort((a, b) => lookAlike(syn, b.word) - lookAlike(syn, a.word));
          for (const c of list) {
            if (out.length >= 3) break;
            if (used.has(c.word) || related.has(c.word) || sameRoot(syn, c.word)) continue;
            used.add(c.word); out.push(c.word);
          }
        }
        take((byFirst[syn[0]] || []).slice());
        if (out.length < 3) take([].concat.apply([], Object.keys(byFirst).map(k => byFirst[k])));
        while (out.length < 3) out.push("—");
        return out;
      }
      function renderItem(q, idx, retry) {
        const qhtml = q.group
          ? esc(q.ex).replace(new RegExp("\\b" + rxq(q.word) + "\\b", "i"), `<u class="qz-target">${esc(q.word)}</u>`)
          : esc(q.word);
        function optMeaning(w) { const sc = (window.VocabRuntime && VocabRuntime.getSmallCard) ? VocabRuntime.getSmallCard(w) : null; return sc ? stripPos(sc.zh || "") : ""; }
        const label = retry ? "Retry" : `${q.group ? "Synonym" : "Word"} ${idx + 1}`;
        return `
          <article class="quiz-item" data-word="${esc(q.word)}" data-group="${q.group ? 1 : 0}" data-solved="0">
            <div class="quiz-no">${label}</div>
            <p class="quiz-question">${qhtml}</p>
            <ul class="quiz-options">
              ${q.options.map((o, i) => {
                const en = o.word || "";
                // SILVER shows the Chinese meaning; GOLDEN shows the English
                // synonym. Both store the other form for the tap-to-flip study.
                const zh = q.group ? optMeaning(en) : (o.zh || "");
                const shown = q.group ? en : zh;
                return `<li class="quiz-option" data-flip="${q.group ? "en" : "zh"}" data-word="${esc(en)}" data-en="${esc(en)}" data-zh="${esc(zh)}" data-correct="${o.correct ? 1 : 0}">
                  <span class="quiz-option-letter">${LETTER[i]}.</span>
                  <span class="quiz-option-text">${esc(shown)}</span>
                </li>`;
              }).join("")}
            </ul>
          </article>`;
      }
      function playSuccessChord() {
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          const ctx = new Ctx();
          const notes = [523.25, 659.25, 783.99, 1046.50];
          const now = ctx.currentTime;
          notes.forEach((f, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "sine"; o.frequency.value = f;
            const t0 = now + i * 0.18;
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.18, t0 + 0.025);
            g.gain.exponentialRampToValueAtTime(0.0008, t0 + 1.05);
            o.connect(g).connect(ctx.destination);
            o.start(t0); o.stop(t0 + 1.15);
          });
          setTimeout(() => { try { ctx.close(); } catch (_) {} }, 2400);
        } catch (_) {}
      }
      // Short, bright two-note "ding" played on EACH correct answer
      // (the 4-note chord is reserved for whole-chapter completion).
      function playCorrectDing() {
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          const ctx = new Ctx();
          const notes = [783.99, 1174.66]; // G5 → D6, a happy rising 5th
          const now = ctx.currentTime;
          notes.forEach((f, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "triangle"; o.frequency.value = f;
            const t0 = now + i * 0.10;
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.22, t0 + 0.015);
            g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.42);
            o.connect(g).connect(ctx.destination);
            o.start(t0); o.stop(t0 + 0.5);
          });
          setTimeout(() => { try { ctx.close(); } catch (_) {} }, 1000);
        } catch (_) {}
      }
      function showToast({ title, subtitle, ms = 1400 }) {
        const t = host.querySelector(".chapter-complete-toast");
        if (!t) return;
        t.querySelector(".chapter-complete-title").textContent    = title;
        t.querySelector(".chapter-complete-subtitle").textContent = subtitle;
        t.setAttribute("aria-hidden", "false");
        t.classList.add("is-visible");
        if (ms > 0) setTimeout(() => {
          t.classList.remove("is-visible");
          t.setAttribute("aria-hidden", "true");
        }, ms);
      }

      const items = isGroup ? buildGroupItems(section) : buildChoiceItems(section);
      const body = host.querySelector(".quiz-body");
      // No GOLDEN (group) questions for this section → both choice stages done.
      if (isGroup && !items.length) {
        if (window.Quiz) { Quiz.setStageStatus(chapterId, sectionNum, "quiz1", "completed"); Quiz.setStageStatus(chapterId, sectionNum, "quiz2", "completed"); }
        window.go((window.Quiz && Quiz.menuHref) ? Quiz.menuHref(fromCtx) : "#menu");
        return;
      }
      body.innerHTML = items.length
        ? items.map((q, i) => renderItem(q, i)).join("")
        : `<div class="empty-state">No quiz words for this section yet.</div>`;

      // ---- recycle bookkeeping ----
      // The stage is cleared only when EVERY distinct word has been answered
      // correctly. A wrong answer appends a fresh "Retry" copy of that
      // question to the end of the stack ("16 题错 2 题 → 变成 18 题"), so you
      // cannot leave until you get them all right.
      const qByWord = {};
      items.forEach(q => { qByWord[String(q.word).toLowerCase()] = q; });
      const originalWords = new Set(items.map(q => String(q.word).toLowerCase()));
      const solvedWords = new Set();
      function appendRetry(word) {
        const q = qByWord[String(word).toLowerCase()];
        if (!q) return;
        body.insertAdjacentHTML("beforeend", renderItem(q, 0, true));
      }

      // Scroll the question being read into view and mark it current so
      // the player can always SEE what's being spoken (same follow-along
      // as the reading page).
      function focusItem(item) {
        if (!item) return;
        host.querySelectorAll(".quiz-item.is-current").forEach(x => x.classList.remove("is-current"));
        item.classList.add("is-current");
        try { item.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) {}
      }
      function speakItem(item) {
        if (!item) return;
        focusItem(item);
        // SILVER (word page) auto-reads the English headword; GOLDEN (group
        // page) auto-reads the whole EXAMPLE sentence so the player hears the
        // word in context. Chinese options are never spoken.
        const w = (item.dataset.group === "1")
          ? (item.querySelector(".quiz-question")?.textContent || "").trim()
          : ((item.dataset.word) || (item.querySelector(".quiz-question")?.textContent || "").trim());
        try { TTS.speak(w); } catch (_) {}
      }
      // Tapping the QUESTION TEXT (only — not the whole block) rereads it; once
      // SOLVED, tapping it also reveals its small card on the right. The options
      // are NOT part of this hit area, so tapping an option never plays the
      // question audio (user: "这一大块绑定了题目的语音，点啥都播题目").
      body.addEventListener("click", (e) => {
        if (e.target.closest(".quiz-option")) return;     // options handled below
        const q = e.target.closest(".quiz-question, .quiz-no");
        if (!q) return;
        const item = q.closest(".quiz-item");
        if (item && item.classList.contains("is-shown")) {
          speakItem(item);
          if (item.dataset.solved === "1") showQuizWord(item.dataset.word);
        }
      });
      // Reveal the next still-hidden question (originals first, then any
      // appended Retry copies) and read it aloud. When none remain hidden the
      // stage is complete.
      let firstReveal = true;
      function revealNext() {
        const all = host.querySelectorAll(".quiz-item");
        let next = null;
        for (const it of all) { if (!it.classList.contains("is-shown")) { next = it; break; } }
        if (next) {
          next.classList.add("is-shown");
          // The VERY first question often falls before the speech voice list
          // has loaded (later questions speak fine because it's ready by then).
          // Give it a longer beat, and if voices still aren't ready, retry once
          // when they arrive — so question 1 always reads aloud.
          if (firstReveal) {
            firstReveal = false;
            let fired = false;
            const sayFirst = () => { if (fired) return; fired = true; speakItem(next); };
            const voicesReady = window.speechSynthesis && window.speechSynthesis.getVoices().length;
            if (voicesReady) {
              setTimeout(sayFirst, 420);
            } else if (window.speechSynthesis) {
              // wait for the voice list, then speak (with a safety fallback)
              try { window.speechSynthesis.addEventListener("voiceschanged", () => setTimeout(sayFirst, 80), { once: true }); } catch (_) {}
              setTimeout(sayFirst, 900);
            } else {
              setTimeout(sayFirst, 420);
            }
          } else {
            setTimeout(() => speakItem(next), 220);
          }
        }
        else maybeChapterComplete();
      }
      function showThrough() { revealNext(); }   // kept name for the first reveal
      revealNext();   // reveal the first question

      let advancing = false;
      let backingOut = false;

      // Stage clears only when every DISTINCT word has been answered correctly
      // (Retry copies of wrong ones are folded back into the same stack).
      function allCorrect() {
        return originalWords.size > 0 && solvedWords.size >= originalWords.size;
      }
      // Star-burst helper. n stars fly radially out from the
      // center; angle / distance / size / phase-delay all randomised
      // so the visual never reads as identical loops. Also drops a
      // pulsing halo ring. Pure-CSS keyframes + auto-cleanup.
      function spawnStarBurst(n) {
        for (let i = 0; i < n; i++) {
          const s = document.createElement("div");
          s.className = "chapter-star";
          s.style.setProperty("--ang",  (Math.random() * 360) + "deg");
          s.style.setProperty("--dist", (160 + Math.random() * 240) + "px");
          s.style.setProperty("--sz",   (8 + Math.random() * 10) + "px");
          s.style.animationDelay = (Math.random() * 220) + "ms";
          host.appendChild(s);
          setTimeout(() => { try { s.remove(); } catch (_) {} }, 1700);
        }
        const halo = document.createElement("div");
        halo.className = "chapter-halo";
        host.appendChild(halo);
        setTimeout(() => { try { halo.remove(); } catch (_) {} }, 1450);
      }
      function isLastSectionOfChapter() {
        const list = ChapterNav.sectionsOf(chapterId);
        if (!list.length) return true;
        const i = list.findIndex(s => s.number === sectionNum);
        return i === list.length - 1;
      }
      const hrefFor = (st) => (window.Quiz && Quiz.quizHref)
        ? Quiz.quizHref(chapterId, sectionNum, st, fromCtx)
        : `#quiz?chapter=${encodeURIComponent(chapterId)}&section=${encodeURIComponent(sectionNum)}&stage=${st}&from=${fromCtx}`;
      // Stage clear is an INLINE button row appended under the questions (no
      // blocking popup) so you can still tap the last question's options to
      // study them ("错误选项也值得学习") before moving on.
      // Both choice stages of this section done → its words enter the garden.
      function markSectionCollected() {
        if (!(window.Quiz && Quiz.markCollected)) return;
        const ws = new Set();
        try { buildChoiceItems(section).forEach(i => ws.add(i.word)); } catch (_) {}
        try { buildGroupItems(section).forEach(i => ws.add(i.word)); } catch (_) {}
        ws.forEach(w => Quiz.markCollected(w));
      }
      function maybeChapterComplete() {
        if (advancing || !allCorrect()) return;
        advancing = true;
        spawnStarBurst(8); playSuccessChord();
        const go = (href) => { window.__navDir = "forward"; window.go(href); };
        const menuNext = () => go((window.Quiz && Quiz.menuHref) ? Quiz.menuHref(fromCtx) : "#menu");
        let title, btns;
        if (!isGroup) {
          if (window.Quiz) Quiz.setStageStatus(chapterId, sectionNum, "quiz1", "completed");
          if (buildGroupItems(section).length > 0) {
            title = "Stage 1 cleared — study any option, then continue.";
            btns = [["Continue · Group ›", () => go(hrefFor("golden"))], ["Later", menuNext]];
          } else {
            if (window.Quiz) Quiz.setStageStatus(chapterId, sectionNum, "quiz2", "completed");
            markSectionCollected();
            title = "Section cleared — study any option, then choose.";
            btns = [["Keep Questing ›", menuNext], ["Dictation", () => go(hrefFor("seal"))]];
          }
        } else {
          if (window.Quiz) { Quiz.setStageStatus(chapterId, sectionNum, "quiz1", "completed"); Quiz.setStageStatus(chapterId, sectionNum, "quiz2", "completed"); }
          markSectionCollected();
          title = "Section cleared — study any option, then choose.";
          btns = [["Keep Questing ›", menuNext], ["Dictation", () => go(hrefFor("seal"))]];
        }
        const row = document.createElement("div");
        row.className = "quiz-done-row";
        row.innerHTML = `<p class="quiz-done-title">${esc(title)}</p>`
          + `<div class="quiz-done-actions">`
          + btns.map((b, i) => `<button type="button" class="antique-button qd-btn" data-qd="${i}"><span class="antique-button-label">${esc(b[0])}</span></button>`).join("")
          + `</div>`;
        body.appendChild(row);
        btns.forEach((b, i) => { const el = row.querySelector(`[data-qd="${i}"]`); if (el) el.onclick = (e) => { e.stopPropagation(); b[1](); }; });
        try { row.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) {}
      }

      // Right-column word card (reuses the reading marginalia look). Shown
      // when a wrong option is tapped; clicking it opens the full drawer.
      function quizSmallCardHTML(sc, id) {
        const phraseRows = (sc.phrases || []).slice(0, 2).map(p => `
          <div class="word-card-phrase"><span class="wcp-en">${esc(p.phrase || p.en || "")}</span>
          ${(p.phrase_zh || p.zh) ? `<span class="wcp-zh">${esc(p.phrase_zh || p.zh)}</span>` : ""}</div>`).join("");
        const ex = (sc.examples || [])[0]; const exEn = ex && (ex.example || ex.en) || ""; const exZh = ex && (ex.example_zh || ex.zh) || "";
        const saved = (typeof Storage !== "undefined") && Storage.isSaved(sc.word || id, chapterId, sectionNum);
        // No inline pill — folding is the shared marginalia FOLD button below.
        return `<div class="word-card is-current is-entering${saved ? " is-saved" : ""}${sc.clickableForBigCard ? " is-openable" : ""}" data-id="${esc(id)}">
          <div class="word-card-headword">${esc(sc.word || id)}</div>
          <div class="word-card-meaning">${esc(sc.zh || "")}</div>
          ${phraseRows}
          ${exEn ? `<div class="word-card-example"><span class="wce-en">${esc(exEn)}</span>${exZh ? `<span class="wce-zh">${esc(exZh)}</span>` : ""}</div>` : ""}
          </div>`;
      }
      // FOLD — the SAME marginalia button + locket as reading, folding the
      // currently-shown quiz card into Notes (so quiz folds appear in Notes
      // exactly like reading folds).
      function syncQuizFold() {
        const fold = host.querySelector('.marginalia-btn[data-action="fold"]');
        if (!fold) return;
        const card = host.querySelector(".word-card.is-current");
        const id = card && card.dataset.id;
        if (!id) { fold.disabled = true; fold.classList.remove("is-active"); return; }
        fold.disabled = false;
        fold.classList.toggle("is-active", Storage.isSaved(id, chapterId, sectionNum));
      }
      function syncQuizLocket(pop) {
        const el = host.querySelector("[data-saved-count]");
        if (!el) return;
        el.textContent = String(Storage.getChapterNoteCount(chapterId));
        if (pop) { const lk = el.closest(".marginalia-locket"); if (lk) { lk.classList.remove("is-pop"); void lk.offsetWidth; lk.classList.add("is-pop"); } }
      }
      (function wireQuizFold() {
        const fold = host.querySelector('.marginalia-btn[data-action="fold"]');
        if (!fold || typeof Storage === "undefined") return;
        fold.addEventListener("click", (e) => {
          e.stopPropagation();
          const card = host.querySelector(".word-card.is-current");
          const id = card && card.dataset.id;
          if (!id) return;
          if (Storage.isSaved(id, chapterId, sectionNum)) {
            Storage.unsaveWord(id, chapterId, sectionNum);
            card.classList.remove("is-saved");
            window.toast && window.toast("Unfolded");
          } else {
            Storage.saveWord(id, chapterId, sectionNum);
            card.classList.add("is-saved", "just-folded");
            setTimeout(() => card.classList.remove("just-folded"), 540);
            try { playCorrectDing(); } catch (_) {}
            window.toast && window.toast("Folded into Notes");
          }
          syncQuizFold(); syncQuizLocket(true);
        });
        syncQuizLocket(false);
      })();
      function showQuizWord(word) {
        const stack = host.querySelector(".word-card-stack");
        if (!stack) return;
        const sc = (window.VocabRuntime && VocabRuntime.getSmallCard) ? VocabRuntime.getSmallCard(word) : null;
        if (!sc) return;
        stack.innerHTML = quizSmallCardHTML(sc, sc.word || word);
        const fresh = stack.firstElementChild;
        if (!fresh) return;
        setTimeout(() => fresh.classList.remove("is-entering"), 600);
        // The shared marginalia FOLD button now reflects/saves this card.
        syncQuizFold();
        fresh.addEventListener("click", (e) => {
          e.stopPropagation();
          if (typeof WordCard !== "undefined")
            WordCard.openBigCard((sc.head && sc.head.word) || sc.word || word,
                                 { chapter: chapterId, section: sectionNum });
        });
      }

      body.addEventListener("click", (e) => {
        const opt = e.target.closest(".quiz-option");
        if (!opt) return;
        e.stopPropagation();
        const item = opt.closest(".quiz-item");
        // EXPLORE — once the question is answered, EVERY option is tappable to
        // study it: tapping FLIPS the option between its Chinese meaning and the
        // English word (slide), reads the word, and shows its small card on the
        // right (even the wrong options are worth learning).
        if (item.dataset.solved === "1") {
          const text = opt.querySelector(".quiz-option-text");
          const en = opt.dataset.en || "", zh = opt.dataset.zh || "";
          const toEn = (opt.dataset.flip || "zh") !== "en";
          opt.classList.add("opt-flip");
          setTimeout(() => {
            if (text) text.textContent = toEn ? (en || zh) : (zh || en);
            opt.classList.toggle("opt-en", toEn);
            opt.dataset.flip = toEn ? "en" : "zh";
            opt.classList.remove("opt-flip");
          }, 130);
          if (en) { try { TTS.speak(en); } catch (_) {} showQuizWord(en); }
          return;
        }
        focusItem(item);   // keep the answered question in view
        const word   = item.dataset.word;
        const optWord = opt.dataset.word || "";
        const correct = opt.dataset.correct === "1";
        item.querySelectorAll(".quiz-option.is-selected").forEach(o => o.classList.remove("is-selected"));
        // The answer is only revealed AFTER you pick — speak the chosen option's
        // English and reveal it beside the Chinese.
        opt.classList.add("is-revealed");
        try { if (optWord) TTS.speak(optWord); } catch (_) {}
        if (correct) {
          opt.classList.add("is-correct", "is-locked");
          item.dataset.solved = "1";
          item.querySelectorAll(".quiz-option").forEach(o => o.classList.add("is-locked"));
          playCorrectDing(); spawnOptSparkle(opt);
          opt.classList.remove("is-pop"); void opt.offsetWidth; opt.classList.add("is-pop");
          if (window.Quiz) Quiz.recordWord(word, true);
          solvedWords.add(String(word).toLowerCase());
          showQuizWord(word);   // card on the right so you can fold it
          if (allCorrect()) maybeChapterComplete();   // inline row (non-blocking)
          else setTimeout(revealNext, 900);
        } else {
          // Wrong → log one wrong, show the right answer + the word's card, lock
          // the question and append a fresh "Retry" copy to the end of the
          // stack. You must answer that copy correctly to clear the stage.
          opt.classList.add("is-wrong", "is-locked");
          item.dataset.solved = "1";   // this copy is spent (a Retry is queued)
          item.querySelectorAll(".quiz-option").forEach(o => {
            o.classList.add("is-locked");
            if (o.dataset.correct === "1") o.classList.add("is-correct");
          });
          if (window.Quiz) Quiz.recordWord(word, false);
          showQuizWord(word);
          appendRetry(word);
          setTimeout(revealNext, 1200);
        }
      });
      // A little gold sparkle burst at a correct option.
      function spawnOptSparkle(opt) {
        try {
          const r = opt.getBoundingClientRect(), hr = host.getBoundingClientRect();
          if (!hr.width) return;
          const fx = ((r.left + r.width * 0.5 - hr.left) / hr.width) * 100;
          const fy = ((r.top + r.height * 0.5 - hr.top) / hr.height) * 100;
          for (let i = 0; i < 6; i++) {
            const s = document.createElement("div");
            s.className = "word-tap-sparkle";
            s.style.left = fx + "%"; s.style.top = fy + "%";
            s.style.setProperty("--ang", (Math.random() * 360) + "deg");
            s.style.setProperty("--dist", (20 + Math.random() * 34) + "px");
            s.style.animationDelay = (i * 22) + "ms";
            host.appendChild(s);
            setTimeout(() => { try { s.remove(); } catch (_) {} }, 880);
          }
        } catch (_) {}
      }

      // Leaving a stage before it's cleared shows an exit nudge (finish first).
      function showQuizExit(proceed) {
        let scrim = host.querySelector(".qx-scrim");
        if (!scrim) { scrim = document.createElement("div"); scrim.className = "qx-scrim"; host.appendChild(scrim); }
        const c = coaxCopy(solvedWords.size, originalWords.size, {
          fewMark: "✦ WAIT, YOUR HIGHNESS ✦",
          fewEn: (left) => `Just <b class="qx-num">${left}</b> more and the stage is yours.`,
          fewZh: "Slip away now and the words you've gathered won't reach your garden — shall we finish them?",
          startMark: "✦ WELL BEGUN ✦",
          startEn: (done, total) => `You've already cleared <b class="qx-num">${done}</b> of ${total}.`,
          startZh: "They only reach your garden once the whole stage is done — you're well on your way, let's keep it.",
        });
        scrim.innerHTML = `<div class="qx-card"><div class="qx-mark">${c.mark}</div>
          <p class="qx-en">${c.en}</p>
          <p class="qx-zh">${c.zh}</p>
          <div class="qx-actions">
            <button type="button" class="gs-btn qx-stay">Keep Going</button>
            <button type="button" class="gs-btn qx-leave">Leave</button>
          </div></div>`;
        scrim.querySelector(".qx-stay").onclick = (e) => { e.stopPropagation(); scrim.remove(); };
        scrim.querySelector(".qx-leave").onclick = (e) => { e.stopPropagation(); scrim.remove(); proceed(); };
        requestAnimationFrame(() => scrim.classList.add("is-open"));
      }
      wireStoryBtn(true);   // label only; the guard below handles the tap
      host.addEventListener("click", (e) => {
        if (e.target.closest(".qx-scrim")) return;
        const btn = e.target.closest(".ui-bottom-nav [data-go], .ui-bottom-nav [data-story]");
        if (!btn) return;
        const isStory = btn.hasAttribute("data-story");
        const proceed = isStory ? () => { window.__navDir = "back"; window.go(returnHref); }
                                : () => window.go(btn.getAttribute("data-go"));
        if (!advancing && !allCorrect()) { e.preventDefault(); e.stopPropagation(); showQuizExit(proceed); }
        else if (isStory) { e.preventDefault(); e.stopPropagation(); proceed(); }
      }, true);
    },
  };


  /* ---------- notes ----------
     Each saved word renders as one horizontal note card (painted frame
     in CSS). A card carries four zones: an index number, the original
     reading quote it was folded from, an "Open Chapter" plaque that
     jumps back to that sentence, and a small word preview that opens
     the full drawer. */
  function resolveWordEntry(id) {
    if (window.VocabRuntime && VocabRuntime.getSmallCard) {
      const sc = VocabRuntime.getSmallCard(id);
      if (sc) {
        const ex = (sc.examples || [])[0] || {};
        return {
          word: sc.word, meaning: sc.zh,
          phrases: (sc.phrases || []).map(p => ({ en: p.phrase || p.en, zh: p.phrase_zh || p.zh })),
          example: ex.example || ex.en || "",
          exampleZh: ex.example_zh || ex.zh || "",
          clickableForBigCard: sc.clickableForBigCard,
        };
      }
    }
    return (typeof window.getWord === "function" && window.getWord(id))
        || (typeof WORD_LIBRARY !== "undefined" && WORD_LIBRARY.find(w => (w.id || w.word) === id))
        || (typeof WORDS        !== "undefined" && WORDS.find(w        => (w.id || w.word) === id))
        || null;
  }
  function rgx(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function resolvesTo(token, word) {
    const sc = (window.VocabRuntime && VocabRuntime.getSmallCard) ? VocabRuntime.getSmallCard(String(token).toLowerCase()) : null;
    return !!sc && String(sc.word || "").toLowerCase() === String(word).toLowerCase();
  }
  // The reading sentence a folded word came from. The word in the passage may
  // be an INFLECTED surface form (studies → study), so if the headword isn't a
  // literal match we look for a token that RESOLVES to it. Only falls back to
  // the example/meaning if the section truly doesn't contain the word.
  function quoteForNote(entry, scope) {
    const word = (entry && entry.word) || "";
    if (scope && scope.chapter && scope.section && typeof ChapterNav !== "undefined") {
      const sec = ChapterNav.findSection(scope.chapter, scope.section);
      if (sec && Array.isArray(sec.blocks) && word) {
        const re = new RegExp("\\b" + rgx(word) + "\\b", "i");
        let hit = sec.blocks.find(b => re.test(b));
        if (!hit) hit = sec.blocks.find(b => (b.match(/\b[A-Za-z][A-Za-z'-]+\b/g) || []).some(t => resolvesTo(t, word)));
        if (hit) return hit;
      }
    }
    return (entry && (entry.example || entry.meaning)) || "";
  }
  function highlightWord(text, word) {
    const safe = esc(text);
    if (!word) return safe;
    if (new RegExp("\\b" + rgx(word) + "\\b", "i").test(text)) {
      return safe.replace(new RegExp("\\b(" + rgx(word) + ")\\b", "ig"), '<span class="quote-word">$1</span>');
    }
    // inflected form — highlight whichever token resolves to the headword
    return safe.replace(/[A-Za-z][A-Za-z'-]+/g, (tok) =>
      resolvesTo(tok, word) ? '<span class="quote-word">' + tok + '</span>' : tok);
  }
  // The actual surface token of `word` as it appears in the sentence.
  function surfaceFormIn(sentence, word) {
    const lw = String(word).toLowerCase();
    const toks = String(sentence).match(/\b[A-Za-z][A-Za-z'-]+\b/g) || [];
    for (const t of toks) if (t.toLowerCase() === lw || resolvesTo(t, lw)) return t;
    return null;
  }
  // A fixed-length EXCERPT centred on the target word (≈ targetLen chars, snapped
  // to word boundaries), with a leading/trailing … when either side is cut. Keeps
  // the left reading block a stable, tidy quote instead of a whole long sentence.
  function excerptAround(sentence, word, targetLen) {
    sentence = String(sentence).replace(/\s+/g, " ").trim();
    targetLen = targetLen || 80;
    if (sentence.length <= targetLen + 12) return sentence;
    const surf = surfaceFormIn(sentence, word) || word;
    const idx = sentence.toLowerCase().indexOf(String(surf).toLowerCase());
    if (idx < 0) {
      let ex = sentence.slice(0, targetLen); const sp = ex.lastIndexOf(" ");
      if (sp > 40) ex = ex.slice(0, sp);
      return ex + " …";
    }
    const half = Math.max(12, Math.floor((targetLen - surf.length) / 2));
    let start = idx - half, end = idx + surf.length + half;
    if (start < 0) { end += -start; start = 0; }
    if (end > sentence.length) { start -= (end - sentence.length); end = sentence.length; if (start < 0) start = 0; }
    if (start > 0) { const sp = sentence.indexOf(" ", start); if (sp >= 0 && sp < idx) start = sp + 1; }
    if (end < sentence.length) { const sp = sentence.lastIndexOf(" ", end); if (sp > idx + surf.length) end = sp; }
    let ex = sentence.slice(start, end).trim();
    if (start > 0) ex = "… " + ex;
    if (end < sentence.length) ex = ex + " …";
    return ex;
  }
  function readingExcerpt(entry, scope) {
    return excerptAround(quoteForNote(entry, scope), (entry && entry.word) || "", 80);
  }
  function sourceLabel(scope) {
    if (!scope || !scope.chapter) return "";
    const ch  = (typeof getChapter === "function" && getChapter(scope.chapter)) || null;
    const sec = (typeof ChapterNav !== "undefined") ? ChapterNav.findSection(scope.chapter, scope.section) : null;
    const num = ch ? ch.number : "";
    const sn  = sec ? sec.number : (scope.section || "");
    const st  = sec ? sec.title : "";
    return `Chapter ${num} · ${sn}${st ? " " + st : ""}`.trim();
  }

  const notes = {
    init(host) {
      const listEl = host.querySelector(".note-cards");
      if (!listEl) return;
      const byId = {};
      let lastCard = null;

      // Display order is persisted so PINNED words (tap a note's number) jump to
      // the front and stay there — keeping the weakest words on top.
      function loadOrder() { try { return JSON.parse(localStorage.getItem("tpl.noteOrder") || "[]"); } catch (_) { return []; } }
      function saveOrder(o) { try { localStorage.setItem("tpl.noteOrder", JSON.stringify(o)); } catch (_) {} }
      function orderedIds() {
        const ids = Storage.getNotes();
        const ord = loadOrder().filter(id => ids.indexOf(id) >= 0);
        return ord.concat(ids.filter(id => ord.indexOf(id) < 0));
      }
      function pinToTop(id) {
        const ord = loadOrder().filter(x => x !== id); ord.unshift(id); saveOrder(ord); render();
      }

      function render() {
        const cards = [];
        orderedIds().forEach((id, i) => {
          const entry = resolveWordEntry(id);
          const word  = (entry && entry.word) || id;
          byId[id] = entry || { word: id };
          const scope = Storage.findScopeOf ? Storage.findScopeOf(id) : null;
          const src   = sourceLabel(scope);
          const idxStr = (i + 1 < 10 ? "0" : "") + (i + 1);
          const phrases = entry ? getPhrasePairs(entry).slice(0, 2) : [];
          const phraseRows = phrases.map(p => `
              <div class="word-phrase"><span class="wp-en">${esc(p.en)}</span>${p.zh ? `<span class="wp-zh">${esc(p.zh)}</span>` : ""}</div>`).join("");
          const example   = (entry && entry.example) || "";
          const exampleZh = (entry && (entry.exampleZh || entry.example_zh)) || "";
          const openBtn = (scope && scope.chapter) ? `
            <button type="button" class="note-open"
                    data-go="#reading?chapter=${encodeURIComponent(scope.chapter)}&section=${encodeURIComponent(scope.section || "1.1")}&word=${encodeURIComponent(id)}&browse=1&from=note">OPEN</button>` : "";
          cards.push(`
            <li class="note-card" data-id="${esc(id)}">
              <div class="note-quote" title="Tap to hear">
                <div class="note-quote-inner">
                  ${src ? `<div class="note-source">${esc(src)}</div>` : ""}
                  <div class="note-quote-text">${highlightWord(readingExcerpt(entry, scope), word)}</div>
                </div>
              </div>
              ${openBtn}
              <div class="note-word">
                <div class="word-title">${esc(word)}</div>
                ${entry && entry.meaning ? `<div class="word-zh">${esc(entry.meaning)}</div>` : ""}
                ${phraseRows ? `<div class="word-phrases">${phraseRows}</div>` : ""}
              </div>
              <div class="note-example" title="Tap to hear">
                ${example ? `<div class="word-example">${esc(example)}</div>` : ""}
                ${exampleZh ? `<div class="word-example-zh">${esc(exampleZh)}</div>` : ""}
              </div>
              <div class="note-index" title="Tap to pin to top">${esc(idxStr)}</div>
            </li>`);
        });
        listEl.innerHTML = cards.length ? cards.join("")
          : `<li class="notes-empty">No saved words yet — fold a word while reading to keep it here.</li>`;
        const allCards = Array.from(listEl.querySelectorAll(".note-card"));
        allCards.forEach((c, i) => { c.style.zIndex = i + 1; });
        // Bottom card is fully in view, so show it open (else it reads blank).
        lastCard = allCards[allCards.length - 1] || null;
        if (lastCard) lastCard.classList.add("is-open");
      }
      render();

      const speak = (t, cb) => { try { if (t && typeof TTS !== "undefined" && TTS.speak) TTS.speak(String(t).trim(), cb ? { onEnd: cb } : undefined); } catch (_) {} };
      // Folded by default: tap a card → it slides fully out (others fold back)
      // and reads its word, then its example. The bottom card always stays
      // open. On an OPEN card: quote / example read aloud, word → drawer.
      listEl.addEventListener("click", (e) => {
        if (e.target.closest(".note-open")) return;   // data-go handles it
        const card = e.target.closest(".note-card");
        if (!card) return;
        // Tap the index number → pin this word to the top (and leave it folded).
        if (e.target.closest(".note-index")) { e.stopPropagation(); pinToTop(card.dataset.id); return; }
        if (!card.classList.contains("is-open")) {
          e.stopPropagation();
          listEl.querySelectorAll(".note-card.is-open").forEach(c => c.classList.remove("is-open"));
          card.classList.add("is-open");
          if (lastCard) lastCard.classList.add("is-open");   // keep the bottom card open
          const entry = byId[card.dataset.id] || {};
          try { TTS && TTS.cancel && TTS.cancel(); } catch (_) {}
          speak(entry.word, () => speak(entry.example));   // word, then example
          setTimeout(() => { try { card.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (_) {} }, 120);
          return;
        }
        if (e.target.closest(".note-quote"))   { e.stopPropagation(); speak(card.querySelector(".note-quote-text")?.textContent); return; }
        if (e.target.closest(".note-example")) { e.stopPropagation(); speak(card.querySelector(".word-example")?.textContent); return; }
        if (e.target.closest(".note-word")) {
          e.stopPropagation();
          const entry = byId[card.dataset.id];
          const scope = Storage.findScopeOf ? Storage.findScopeOf(card.dataset.id) : null;
          if (entry && typeof WordCard !== "undefined") WordCard.openDrawer(entry, Object.assign({ from: "note" }, scope || {}));
        }
      });
    },
  };


  /* ---------- word-garden ----------
     LEFT = Sealed (accumulated) words, most-missed first; RIGHT = Unsealed
     (seen but not yet cleanly passed). Driven by the global Quiz word stats
     (reviewNeed = wrong − correct). */
  const wordGarden = {
    init(host) {
      let query = "";
      function glossOf(word) {
        if (window.VocabRuntime) {
          const sc = VocabRuntime.getSmallCard ? VocabRuntime.getSmallCard(word) : null;
          if (sc && sc.zh) return sc.zh;
          const c = VocabRuntime.getWordCard ? VocabRuntime.getWordCard(word) : null;
          if (c && c.zh) return c.zh;
        }
        return "";
      }
      const collectedList = () => (window.Quiz && Quiz.collectedWords) ? Quiz.collectedWords() : [];
      const spelledList   = () => (window.Quiz && Quiz.spelledWords) ? Quiz.spelledWords() : [];
      const toSpell       = () => (window.Quiz && Quiz.toSpellWords) ? Quiz.toSpellWords() : [];
      function applyQuery(list) {
        if (!query) return list;
        return list.filter(w => w.toLowerCase().includes(query) || glossOf(w).toLowerCase().includes(query));
      }
      // Flat index of EVERY carded word — so search isn't limited to words you've
      // already accumulated ("我想看这个单词还没法看那就尴尬了"). Built once.
      function libIndex() {
        if (window.__gardenLibIndex) return window.__gardenLibIndex;
        const REG = (window.VOCAB_WORD_CONTENT_REGISTRY_LITE || {}).cards || {};
        const out = [];
        for (const k in REG) {
          const c = REG[k]; const w = String(c.word || k).toLowerCase();
          if (!/^[a-z][a-z'-]+$/.test(w)) continue;
          out.push({ word: w, zh: stripPos(c.zh || "") });
        }
        window.__gardenLibIndex = out;
        return out;
      }
      // Full-lexicon matches for the current query that AREN'T already in your
      // collected / sealed columns (those are shown there).
      function libraryMatches() {
        if (!query) return [];
        const have = new Set(collectedList().concat(spelledList()).map(w => w.toLowerCase()));
        const out = [];
        for (const e of libIndex()) {
          if (out.length >= 60) break;
          if (have.has(e.word)) continue;
          if (e.word.includes(query) || e.zh.toLowerCase().includes(query)) out.push(e.word);
        }
        return out;
      }
      function rowHTML(word) {
        const st = (window.Quiz && Quiz.wordStat) ? Quiz.wordStat(word) : { w: 0, rc: 0 };
        const need = (st.w || 0) - (st.rc || 0);
        // No translation shown — tempt the reader to tap and recall it (一考自己).
        return `<li class="wg-row" data-id="${esc(word)}">
          <span class="wg-row-en">${esc(word)}</span>
          <span class="wg-row-need" title="needs review">${need > 0 ? need : ""}</span>
        </li>`;
      }
      function colHTML(title, total, rows) {
        return `<li class="wg-col-head">${title} · ${total}</li>`
          + (rows.length ? rows.map(rowHTML).join("") : `<li class="wg-empty">— none yet —</li>`);
      }
      function shortGloss(w) { return glossOf(typeof w === "string" ? w : (w && w.word) || ""); }
      function filtered() {   // union (for the A-Z nav)
        return applyQuery(collectedList().concat(spelledList())).map(w => ({ word: w }));
      }
      function renderTable() {
        const left  = host.querySelector("#wg-col-left");
        const right = host.querySelector("#wg-col-right");
        if (!left || !right) return;
        const collected = collectedList(), spelled = spelledList(), backlog = toSpell().length;
        // LEFT = Collected (choice quiz) with a "Seal More" dictation button.
        left.innerHTML = `<li class="wg-col-head wg-col-head-row"><span>Collected · ${collected.length}</span>`
          + `<button type="button" class="wg-sealmore"${backlog ? "" : " disabled"}>Seal More${backlog ? " (" + backlog + ")" : ""}</button></li>`
          + (applyQuery(collected).length ? applyQuery(collected).map(rowHTML).join("") : `<li class="wg-empty">— none yet —</li>`);
        // RIGHT = Sealed (dictation); while searching, the lower part becomes a
        // full-lexicon lookup so any word can be found and opened.
        const lib = libraryMatches();
        right.innerHTML = colHTML("Sealed", spelled.length, applyQuery(spelled))
          + (query ? `<li class="wg-col-head wg-lex-head">From the Lexicon · ${lib.length}</li>`
              + (lib.length ? lib.map(rowHTML).join("") : `<li class="wg-empty">— no match —</li>`) : "");
        // When searching, jump the right column to the lexicon results so the
        // sealed list above doesn't hide them.
        if (query) { const lh = right.querySelector(".wg-lex-head"); if (lh) try { lh.scrollIntoView({ block: "start", behavior: "smooth" }); } catch (_) {} }
        const sm = left.querySelector(".wg-sealmore");
        if (sm && backlog) sm.addEventListener("click", (e) => {
          e.stopPropagation(); window.__navDir = "forward";
          window.go("#quiz?chapter=universe&section=1.1&stage=seal&seal=1&from=garden");
        });
        host.querySelectorAll(".wg-row").forEach(row => {
          row.addEventListener("click", () => {
            const id = row.dataset.id;
            if (typeof WordCard !== "undefined") WordCard.openBigCard(id, { from: "garden" });
          });
        });
      }
      function renderAZ() {
        const az = host.querySelector("#wg-az");
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
            const node = host.querySelector(`.wg-row[data-id="${cssEsc(target.id || target.word)}"]`);
            if (node) node.scrollIntoView({ block: "center", behavior: "smooth" });
          });
        });
      }
      const search = host.querySelector("#wg-search");
      if (search) {
        search.addEventListener("input", (e) => {
          query = e.target.value.trim().toLowerCase();
          renderAZ(); renderTable();
        });
      }
      renderAZ(); renderTable();
    },
  };


  /* ---------- save / load ---------- */
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function nowStr() {
    const d = new Date();
    const p = n => (n < 10 ? "0" + n : "" + n);
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}  ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function slotHtml(slot, i, accent) {
    if (!slot) {
      return `<div class="slot ornate-panel is-strip is-clickable is-empty ${accent}" data-index="${i}">
        <div class="slot-no">Slot ${pad(i + 1)}</div>
        <div class="slot-empty">— Empty —</div>
        <div class="slot-meta">&nbsp;</div>
      </div>`;
    }
    const ch = (typeof getChapter === "function" && getChapter(slot.chapter))
             || { title: slot.chapter, number: "??" };
    const meta = slot.section
      ? `Section ${esc(slot.section)} · ${esc(slot.time || slot.savedAt || "")}`
      : `${esc(slot.position || "Page 1")} · ${esc(slot.time || slot.savedAt || "")}`;
    return `<div class="slot ornate-panel is-strip is-clickable ${accent}" data-index="${i}">
      <div class="slot-no">Slot ${pad(i + 1)} · Ch ${ch.number}</div>
      <div class="slot-chapter">${esc(ch.title)}</div>
      <div class="slot-meta">${meta}</div>
    </div>`;
  }
  function renderSlots(host, mode) {
    const grid = host.querySelector(".slot-grid");
    if (!grid) return;
    const slots = Storage.getSlots();
    const accent = mode === "save" ? "is-save" : "is-load";
    grid.innerHTML = slots.map((s, i) => slotHtml(s, i, accent)).join("");
    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".slot");
      if (!card) return;
      const i = +card.dataset.index;
      if (mode === "save") {
        let last = null;
        try { last = JSON.parse(localStorage.getItem("tpl.lastRead") || "null"); } catch (_) {}
        const chapterId = (last && last.chapter) || "universe";
        const sec       = (last && last.section) || "1.1";
        Storage.setSlot(i, {
          chapter: chapterId,
          section: sec,
          position: `Section ${sec}`,
          time: nowStr(),
        });
        window.toast && window.toast("Saved to Slot " + pad(i + 1));
        renderSlots(host, "save");
      } else {
        const slot = Storage.getSlots()[i];
        if (!slot) { window.toast && window.toast("Empty Slot"); return; }
        const sec = slot.section || "1.1";
        window.go(`#reading?chapter=${encodeURIComponent(slot.chapter)}&section=${encodeURIComponent(sec)}`);
      }
    });
  }
  const save = { init(host) { renderSlots(host, "save"); } };
  const load = { init(host) { renderSlots(host, "load"); } };


  /* ---------- voices ----------
     Lists every speechSynthesis voice the device has installed,
     surfaces the quality tier (Siri / Premium / Enhanced / Standard
     / Compact), and lets the user TEST + USE one. The chosen voice
     name is stored as `tpl.voice` and read back by TTS.pickVoice as
     a hard override. Necessary because iOS will silently fall back
     to the compact (robotic) tier of Ava/Samantha when no enhanced
     voice is downloaded, and the user has no other way to tell
     which voices are even present on their device. */
  function voiceTierLabel(v) {
    const s = ((v.voiceURI || "") + " " + (v.name || "")).toLowerCase();
    if (/siri/.test(s))     return "Siri";
    if (/neural/.test(s))   return "Neural";
    if (/premium/.test(s))  return "Premium";
    if (/enhanced/.test(s)) return "Enhanced";
    if (/compact/.test(s))  return "Compact";
    return "Standard";
  }
  const voices = {
    init(host) {
      const list = host.querySelector(".voices-list");

      function render() {
        // Page-turned away from the voices view — the chained
        // onvoiceschanged callback would otherwise paint into a
        // detached list. Bail silently.
        if (!list.isConnected) return;
        const vs = (window.speechSynthesis && window.speechSynthesis.getVoices()) || [];
        let current = "";
        try { current = localStorage.getItem("tpl.voice") || ""; } catch (_) {}
        const sorted = vs.slice().sort((a, b) => {
          const ae = /^en/i.test(a.lang), be = /^en/i.test(b.lang);
          if (ae !== be) return ae ? -1 : 1;
          return (a.name || "").localeCompare(b.name || "");
        });
        if (!sorted.length) {
          list.innerHTML = `<li class="voice-row"><span class="voice-name">No voices reported yet. Tap Rescan after a moment.</span></li>`;
          return;
        }
        list.innerHTML = sorted.map(v => {
          const isCurrent = current && (v.name === current || v.voiceURI === current);
          return `
            <li class="voice-row${isCurrent ? " is-current" : ""}"
                data-name="${esc(v.name || "")}"
                data-uri="${esc(v.voiceURI || "")}">
              <span class="voice-name">${esc(v.name || v.voiceURI || "?")}</span>
              <span class="voice-meta">${esc(v.lang || "")} · ${esc(voiceTierLabel(v))}</span>
              <button type="button" class="voice-test">Test</button>
              <button type="button" class="voice-use">${isCurrent ? "In Use" : "Use"}</button>
            </li>`;
        }).join("");
      }
      render();

      // If the engine hasn't filled getVoices() yet (common on iOS
      // first paint), retry once when it does. Chain rather than
      // replace, since tts.js also wires onvoiceschanged to bust its
      // pickVoice cache; overwriting it here would silently break
      // the auto-picker for the rest of the session.
      if (window.speechSynthesis && "onvoiceschanged" in window.speechSynthesis) {
        const prev = window.speechSynthesis.onvoiceschanged;
        window.speechSynthesis.onvoiceschanged = () => {
          try { if (typeof prev === "function") prev(); } catch (_) {}
          render();
        };
      }

      list.addEventListener("click", (e) => {
        const row = e.target.closest(".voice-row");
        if (!row) return;
        const name = row.dataset.name;
        const uri  = row.dataset.uri;
        const vs = (window.speechSynthesis && window.speechSynthesis.getVoices()) || [];
        const v  = vs.find(x => x.voiceURI === uri) || vs.find(x => x.name === name);
        if (e.target.closest(".voice-test")) {
          // SAME bug as the main TTS.speak: speak() must run inside
          // the click handler's user-gesture window or iOS drops
          // u.voice and substitutes the locale default. Sync.
          try { window.speechSynthesis.cancel(); } catch (_) {}
          const u = new SpeechSynthesisUtterance("Hello, this is a sample of my voice.");
          if (v) { u.lang = v.lang || "en-US"; u.voice = v; u.voice = v; }
          try { window.speechSynthesis.speak(u); } catch (_) {}
          return;
        }
        if (e.target.closest(".voice-use")) {
          // Store voiceURI, NOT name. iOS exposes multiple voices
          // sharing the same .name across quality tiers (compact /
          // enhanced / premium Ava all report name "Ava"); storing
          // the name lets the engine reorder to compact between
          // utterances. URI is unique per tier and stable.
          try { localStorage.setItem("tpl.voice", uri || name); } catch (_) {}
          if (TTS && TTS.pickVoice) TTS.pickVoice(true);
          render();
          window.toast && window.toast("Voice set: " + (name || uri));
        }
      });

      const clearBtn = host.querySelector('[data-action="clear-voice"]');
      if (clearBtn) clearBtn.addEventListener("click", () => {
        try { localStorage.removeItem("tpl.voice"); } catch (_) {}
        if (TTS && TTS.pickVoice) TTS.pickVoice(true);
        render();
        window.toast && window.toast("Voice reset to auto-pick");
      });
      const rescanBtn = host.querySelector('[data-action="rescan"]');
      if (rescanBtn) rescanBtn.addEventListener("click", () => render());
      const dbgBtn = host.querySelector('[data-action="toggle-debug"]');
      function syncDbgLabel() {
        if (!dbgBtn) return;
        let on = false;
        try { on = localStorage.getItem("tpl.voiceDebug") === "1"; } catch (_) {}
        dbgBtn.textContent = on ? "Debug ✓" : "Debug";
      }
      syncDbgLabel();
      if (dbgBtn) dbgBtn.addEventListener("click", () => {
        let on = false;
        try { on = localStorage.getItem("tpl.voiceDebug") === "1"; } catch (_) {}
        try { localStorage.setItem("tpl.voiceDebug", on ? "0" : "1"); } catch (_) {}
        syncDbgLabel();
        window.toast && window.toast(on ? "Debug toasts off" : "Debug toasts on");
      });
    },
  };


  /* ---------- quiz status (Story Index entry) ---------- */
  const quizstatus = {
    init(host, params) {
      const chapterId = params.chapter || "universe";
      const sectionNum = params.section || "1.1";
      const book = (typeof getChapterOrDefault === "function")
        ? getChapterOrDefault(chapterId) : { number: "01", title: chapterId };
      const section = (typeof ChapterNav !== "undefined") ? ChapterNav.findSection(chapterId, sectionNum) : null;
      const bg = (typeof getChapterBackground === "function") ? getChapterBackground(chapterId, params.page) : null;
      if (bg) host.style.backgroundImage = `url("${bg}")`;
      host.querySelector("[data-chapter-number]").textContent = "Chapter " + book.number;
      host.querySelector("[data-chapter-title]").textContent  = book.title;
      host.querySelector("[data-chapter-section]").textContent =
        section ? (section.number + " · " + section.title) : sectionNum;

      const st = (window.Quiz && Quiz.sectionState) ? Quiz.sectionState(chapterId, sectionNum)
        : { quiz1: { status: "unseen" }, quiz2: { status: "unseen" }, sealedWords: 0, totalWords: 0, correctedWords: [] };
      const label = (s) => s === "completed" ? "已完成 · Completed"
        : s === "in_progress" ? "进行中 · In progress" : "未开始 · Not started";
      const body = host.querySelector(".qs-body");
      body.innerHTML = `
        <div class="qs-panel">
          <div class="gs-label">✦ QUIZ STATUS ✦</div>
          <div class="qs-row"><span class="qs-name">Quiz 1 · Silver Trial</span>
            <span class="qs-state qs-${st.quiz1.status}">${label(st.quiz1.status)}</span></div>
          <div class="qs-row"><span class="qs-name">Quiz 2 · Golden Seal</span>
            <span class="qs-state qs-${st.quiz2.status}">${label(st.quiz2.status)}</span></div>
          <div class="qs-counts">Sealed ${st.sealedWords || 0} / ${st.totalWords || 0}
            &nbsp;·&nbsp; corrected ${(st.correctedWords || []).length}</div>
          <div class="qs-actions"></div>
        </div>`;

      let main, href;
      const q = (stage) => (window.Quiz && Quiz.quizHref)
        ? Quiz.quizHref(chapterId, sectionNum, stage, "index")
        : `#quiz?chapter=${encodeURIComponent(chapterId)}&section=${encodeURIComponent(sectionNum)}&stage=${stage}&from=index`;
      if (st.quiz1.status !== "completed") { main = st.quiz1.status === "in_progress" ? "Continue the Trial" : "Begin the Trial"; href = q("silver"); }
      else { main = "Seal Words"; href = q("seal"); }
      const actions = body.querySelector(".qs-actions");
      actions.innerHTML = `<button type="button" class="gs-btn qs-begin">${main}</button>`
        + (st.quiz1.status === "completed"
            ? `<button type="button" class="gs-btn qs-review" data-go="#word-garden">Words Garden</button>` : "");
      const begin = actions.querySelector(".qs-begin");
      if (begin) begin.addEventListener("click", () => { window.__navDir = "forward"; window.go(href); });
    },
  };

  /* ---------- review ----------
     One Review = up to 8 accumulated words (most-missed first), played on
     the 3F265 review background with three hand-measured zones:
        WORD box  29.9% / 14.8% / 40.3% / 17.0%
        QUESTION  21.3% / 40.4% / 57.5% / 42.7%
        BOTTOM UI 28.4% / 90.6% / 43.2% /  7.6%
     ROUND 1 (recognition): the WORD box shows the word and reads it once;
     tapping it reveals the example (read once) + a group/meaning choice in
     the QUESTION box. A right answer skips the word; a wrong one sends it to
     ROUND 2 (dictation), where the WORD box itself becomes ONE open writing
     line (no per-letter boxes hinting the length) and the example with a
     blank sits below. */
  const review = {
    init(host, params) {
      const BG = "assets/bg/ui/3F265BED-4DBB-4537-A6E8-97D8DED1CAE0.png";
      try { host.style.backgroundImage = `url("${BG}")`; } catch (_) {}
      const wordZone = host.querySelector(".rv-word");
      const qZone    = host.querySelector(".rv-question");
      const botZone  = host.querySelector(".rv-bottom");
      const VR = window.VocabRuntime;
      const fromCtx = params.from || "menu";
      const backHref = (fromCtx === "garden") ? "#word-garden" : "#menu";
      function rxq(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
      function say(t, cb) { try { if (typeof TTS !== "undefined" && TTS.speak) TTS.speak(String(t), cb ? { onEnd: cb } : undefined); } catch (_) {} }
      function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
      function chord() { try { playReviewChord(); } catch (_) {} }
      function phon(w) { const d = (VR && VR.dotted) ? VR.dotted(w) : w; return "/" + (d || w) + "/"; }

      // ---- build up to 8 review items (need a big card + an example) ----
      function buildSet() {
        const src = (window.Quiz && Quiz.reviewWords) ? Quiz.reviewWords() : [];
        const out = [], seen = new Set();
        for (const raw of src) {
          const w = String(raw).toLowerCase(); if (seen.has(w)) continue;
          const sc = VR && VR.getSmallCard ? VR.getSmallCard(w) : null;
          if (!sc || sc.proper) continue;
          const ans = String(sc.word || w).toLowerCase(); if (seen.has(ans)) continue;
          const bc = VR && VR.getBigCard ? VR.getBigCard(ans) : null;
          if (!bc) continue;   // owl-only — no big card, not in the pool
          const ex = (sc.examples || []).find(e => e.example && new RegExp("\\b" + rxq(ans) + "\\b", "i").test(e.example));
          if (!ex) continue;
          const syns = ((bc.group) || []).filter(g => g.clickable && g.word).map(g => g.word);
          seen.add(w); seen.add(ans);
          out.push({ word: ans, en: ex.example, zh: ex.example_zh || "", pos: sc.pos || "", meaning: stripPos(sc.zh || ""), syn: syns[0] || null });
          if (out.length >= 8) break;
        }
        return out;
      }
      const set = buildSet();
      if (!set.length) {
        wordZone.innerHTML = "";
        qZone.innerHTML = `<div class="rv-empty">No accumulated words to review yet.<br>Collect some words in the Trial first.</div>`;
        botZone.innerHTML = `<button type="button" class="rv-nav-btn" data-go="${backHref}"><span class="nav-glyph">✤</span>Menu</button>`;
        return;
      }
      set.forEach(q => { q.passed = false; q.sealed = false; });
      let choiceDone = false;   // true once the recall+group round is cleared

      // distractors drawn from the rest of the set itself
      function synOptions(q) {
        const pool = [];
        for (const o of set) if (o !== q && o.syn) pool.push(o.syn);
        for (const o of set) if (o !== q) pool.push(o.word);
        const out = [], used = new Set([(q.syn || "").toLowerCase(), q.word.toLowerCase()]);
        for (const d of shuffle(pool)) { if (out.length >= 3) break; const dl = String(d).toLowerCase(); if (used.has(dl)) continue; used.add(dl); out.push(d); }
        while (out.length < 3) out.push("—");
        return shuffle([{ t: q.syn, correct: true }].concat(out.map(d => ({ t: d, correct: false }))));
      }
      function meaningOptions(q) {
        const out = [], used = new Set([q.meaning]);
        for (const o of shuffle(set)) { if (out.length >= 3) break; if (o === q || !o.meaning || used.has(o.meaning)) continue; used.add(o.meaning); out.push({ t: o.meaning, en: o.word }); }
        while (out.length < 3) out.push({ t: "—", en: "" });
        return shuffle([{ t: q.meaning, en: q.word, correct: true }].concat(out.map(d => ({ t: d.t, en: d.en, correct: false }))));
      }

      const LETTER = ["A", "B", "C", "D"];
      function passedCount() { return set.filter(q => q.passed).length; }
      function sealedCount() { return set.filter(q => q.sealed).length; }
      // BOTTOM box: two nav buttons styled like the reading bottom bar — Menu
      // and Trial. (Progress lives in the word box's NN / NN; no title anywhere,
      // the painted background already carries the word "REVIEW".)
      function renderBottom() {
        botZone.innerHTML =
          `<button type="button" class="rv-nav-btn" data-go="#menu"><span class="nav-glyph">✤</span>Menu</button>`
          + `<button type="button" class="rv-nav-btn" data-trial>Trial<span class="nav-glyph-after">›</span></button>`;
        const t = botZone.querySelector("[data-trial]");
        if (t) t.onclick = (e) => { e.stopPropagation(); window.__navDir = "forward"; window.go((window.Quiz && Quiz.menuHref) ? Quiz.menuHref("menu") : "#menu"); };
      }

      // Word box: word + our dotted "phonetic" + pos + progress, all centred.
      function paintWord(q, progLabel, hint) {
        wordZone.className = "rv-word is-show";
        wordZone.innerHTML = `<button type="button" class="rv-wordface">
            <span class="rv-word-en">${esc(q.word)}</span>
            <span class="rv-word-meta">${esc(phon(q.word))}${q.pos ? " · " + esc(q.pos) : ""}</span>
            <span class="rv-word-prog">${esc(progLabel)}</span>
          </button>`;
      }

      // ============ STAGE A — Word Recall + Group Choice ============
      // Flow (mirrors the quiz): word shown → tap ANYWHERE to reveal the
      // sentence + options → pick an option → options stay for study (tap to
      // flip 中文↔英文) → tap ANYWHERE (not an option) to go to the next word.
      let queue = set.map((_, i) => i);
      let phase = "word", cur = null, useSyn = false;
      function optMeaningRv(w) { const sc = VR && VR.getSmallCard ? VR.getSmallCard(w) : null; return sc ? stripPos(sc.zh || "") : ""; }
      function optEl(o, n) {
        // SYN round: o.t is the English word. MEANING round: o.t is the Chinese
        // meaning and o.en is the word it belongs to (so the flip can show it).
        const en = useSyn ? (o.t || "") : (o.en || "");
        const zh = useSyn ? optMeaningRv(o.t) : (o.t || "");
        const shown = useSyn ? (en || zh) : zh;
        return `<li class="quiz-option" data-flip="${useSyn ? "en" : "zh"}" data-en="${esc(en)}" data-zh="${esc(zh)}" data-correct="${o.correct ? 1 : 0}">
          <span class="quiz-option-letter">${LETTER[n]}.</span><span class="quiz-option-text">${esc(shown)}</span></li>`;
      }
      function stageA() {
        while (queue.length && set[queue[0]].passed) queue.shift();
        if (!queue.length) { askSpelling(); return; }
        cur = set[queue[0]]; phase = "word";
        const prog = String(Math.min(set.length, passedCount() + 1)).padStart(2, "0") + " / " + String(set.length).padStart(2, "0");
        paintWord(cur, prog);
        qZone.innerHTML = `<div class="rv-q-hint">Tap anywhere to reveal the sentence.</div>`;
        renderBottom();
        say(cur.word);
      }
      function revealQ() {
        phase = "choosing";
        const q = cur; useSyn = !!q.syn;
        q._opts = useSyn ? synOptions(q) : meaningOptions(q);
        const sentence = esc(q.en).replace(new RegExp("\\b" + rxq(q.word) + "\\b", "i"), `<u class="rv-target">${esc(q.word)}</u>`);
        qZone.innerHTML = `<p class="rv-sentence">${sentence}</p>
          <div class="rv-q-label">${useSyn ? "Which word joins its group?" : "Which meaning fits?"}</div>
          <ul class="quiz-options rv-quiz-options">${q._opts.map(optEl).join("")}</ul>`;
        say(q.en);
      }
      function answerReview(li) {
        const q = cur; const ok = li.dataset.correct === "1";
        phase = "answered";
        if (ok) {
          li.classList.add("is-correct"); q.passed = true;
          if (window.Quiz) { Quiz.recordReviewCorrect(q.word); if (useSyn && q.syn && VR && VR.getSmallCard && VR.getSmallCard(q.syn)) Quiz.recordReviewCorrect(q.syn); }
          chord();
        } else {
          li.classList.add("is-wrong");
          if (window.Quiz) Quiz.recordWord(q.word, false);
          qZone.querySelectorAll(".quiz-option").forEach(o => { if (o.dataset.correct === "1") o.classList.add("is-correct"); });
          queue.push(queue.shift());   // requeue to the back
        }
        renderBottom();
        const fb = document.createElement("div"); fb.className = "rv-feedback";
        fb.innerHTML = `<div class="rv-fb-key">${esc(q.word)}${q.meaning ? " · " + esc(q.meaning) : ""}</div>`
          + (q.zh ? `<div class="rv-fb-zh">${esc(q.zh)}</div>` : "")
          + `<div class="rv-fb-tip">Tap an option to flip · tap anywhere to continue ›</div>`;
        qZone.appendChild(fb);
        say(q.en);
      }
      function studyFlip(opt) {
        const text = opt.querySelector(".quiz-option-text");
        const en = opt.dataset.en || "", zh = opt.dataset.zh || "";
        const toEn = (opt.dataset.flip || "zh") !== "en";
        opt.classList.add("opt-flip");
        setTimeout(() => { if (text) text.textContent = toEn ? (en || zh) : (zh || en); opt.classList.toggle("opt-en", toEn); opt.dataset.flip = toEn ? "en" : "zh"; opt.classList.remove("opt-flip"); }, 130);
        if (en) { try { TTS.speak(en); } catch (_) {} }
      }
      // One click handler drives the whole stage by phase. Nav / popups bail out.
      host.addEventListener("click", (e) => {
        if (e.target.closest(".rv-bottom") || e.target.closest(".qx-scrim")) return;
        if (phase === "word") { revealQ(); return; }
        const opt = e.target.closest(".quiz-option");
        if (phase === "choosing") { if (opt) answerReview(opt); return; }
        if (phase === "answered") { if (opt) studyFlip(opt); else stageA(); return; }
      });

      // ============ between stages — ask whether to spell ============
      function askSpelling() {
        choiceDone = true; phase = "spell";   // recall + group choices all passed → exit allowed
        renderBottom(set.length + " / " + set.length);
        wordZone.className = "rv-word is-show";
        wordZone.innerHTML = `<div class="rv-done-mark">✦</div>`;
        let scrim = host.querySelector(".qx-scrim");
        if (!scrim) { scrim = document.createElement("div"); scrim.className = "qx-scrim"; host.appendChild(scrim); }
        scrim.innerHTML = `<div class="qx-card"><div class="qx-mark">✦ REVIEW CHOICE COMPLETE ✦</div>
          <p class="qx-en">Do you want to enter spelling practice now?</p>
          <p class="qx-zh">语境选择已完成。现在要进入默写练习吗？</p>
          <div class="qx-actions">
            <button type="button" class="gs-btn qx-continue qx-spell">Enter Spelling</button>
            <button type="button" class="gs-btn qx-finish">Finish Review</button>
          </div></div>`;
        scrim.querySelector(".qx-spell").onclick = (e) => { e.stopPropagation(); scrim.remove(); startSpelling(); };
        scrim.querySelector(".qx-finish").onclick = (e) => { e.stopPropagation(); window.__navDir = "back"; window.go(backHref); };
        requestAnimationFrame(() => scrim.classList.add("is-open"));
      }

      // ============ STAGE B — Spelling (only after Enter Spelling) ============
      let si = 0;
      function startSpelling() { si = 0; spell(); }
      function spell() {
        if (si >= set.length) { finish(); return; }
        const q = set[si];
        let revealed = false, wrongThis = false, recordedWrong = false;
        const prog = String(si + 1).padStart(2, "0") + " / " + String(set.length).padStart(2, "0");
        wordZone.className = "rv-word is-spell";
        wordZone.innerHTML = `<div class="rv-spell">
            <input class="rv-input" type="text" lang="en" inputmode="email"
                   autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Spell the word">
          </div>
          <div class="rv-spell-label">✦ LISTEN &amp; SPELL ✦ <span class="rv-replay">↻</span> <span class="rv-spell-prog">${esc(prog)}</span></div>`;
        const blank = esc(q.en).replace(new RegExp("\\b" + rxq(q.word) + "\\b", "i"),
          `<span class="rv-fill">${"_".repeat(Math.max(6, q.word.length))}</span>`);
        qZone.innerHTML = `
          <p class="rv-meaning">${esc(q.meaning || "")}</p>
          <p class="rv-sentence">${blank}</p>
          <div class="rv-correction" hidden></div>
          <p class="rv-sentence-zh"></p>
          <p class="rv-q-hint">Type the missing word, then press Enter.</p>`;
        renderBottom(sealedCount() + " / " + set.length);
        const input = wordZone.querySelector(".rv-input");
        const corr  = qZone.querySelector(".rv-correction");
        const zhEl  = qZone.querySelector(".rv-sentence-zh");
        const spellWrap = wordZone.querySelector(".rv-spell");
        setTimeout(() => { try { input.focus(); } catch (_) {} }, 80);
        say(q.en);
        function showCorrection(typed) {
          const dotted = (VR && VR.dotted) ? VR.dotted(q.word) : q.word;
          let html = "", pi = 0;
          for (const ch of dotted) {
            if (ch === "·") { html += `<span class="rv-c-dot">·</span>`; continue; }
            const ok = typed[pi] && typed[pi].toLowerCase() === ch.toLowerCase();
            html += `<span class="${ok ? "rv-c-ok" : "rv-c-bad"}">${esc(ch)}</span>`;
            pi++;
          }
          corr.innerHTML = `<span class="rv-c-key">Correct spelling</span><span class="rv-c-word">${html}</span>`;
          corr.hidden = false;
          zhEl.textContent = q.zh || "";
        }
        function check() {
          const typed = input.value.trim().toLowerCase();
          if (!typed) { spellWrap.classList.remove("is-shake"); void spellWrap.offsetWidth; spellWrap.classList.add("is-shake"); return; }
          if (typed === q.word) {
            const clean = !revealed && !wrongThis;
            q.sealed = true;
            // Spelling in REVIEW: seal it, and a clean spelling also pulls it
            // down (it happened during review).
            if (window.Quiz) { Quiz.recordSpelled(q.word); if (clean) Quiz.recordReviewCorrect(q.word); }
            zhEl.textContent = q.zh || ""; say(q.en); chord(); renderBottom(sealedCount() + " / " + set.length);
            setTimeout(() => { si += 1; spell(); }, 1500);
          } else {
            wrongThis = true; revealed = true;
            if (!recordedWrong && window.Quiz) { Quiz.recordWord(q.word, false); recordedWrong = true; }
            spellWrap.classList.remove("is-shake"); void spellWrap.offsetWidth; spellWrap.classList.add("is-shake");
            showCorrection(typed); say(q.en);
          }
        }
        input.addEventListener("input", () => { input.value = input.value.replace(/[^A-Za-z]/g, ""); if (!corr.hidden) { corr.hidden = true; corr.innerHTML = ""; } });
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); check(); } });
        wordZone.querySelector(".rv-spell-label").addEventListener("click", () => say(q.en));
        qZone.querySelector(".rv-sentence").addEventListener("click", () => say(q.en));
      }

      function finish() {
        wordZone.className = "rv-word is-show";
        wordZone.innerHTML = `<div class="rv-done-mark">✦</div>`;
        qZone.innerHTML = `<div class="rv-done">
            <div class="rv-done-title">Review Complete</div>
            <p class="rv-done-sub">${sealedCount()} / ${set.length} spelled</p>
            <button type="button" class="rv-done-btn" data-go="${backHref}">Done</button>
          </div>`;
        renderBottom(sealedCount() + " / " + set.length);
        try { playSuccessChordGlobal(); } catch (_) {}
        spawnCelebration(host, 9);
      }

      // Leaving Review before the recall+group round is cleared shows the same
      // finish-first nudge as the other quizzes.
      function showReviewExit(proceed) {
        let scrim = host.querySelector(".qx-scrim");
        if (!scrim) { scrim = document.createElement("div"); scrim.className = "qx-scrim"; host.appendChild(scrim); }
        const c = coaxCopy(passedCount(), set.length, {
          fewMark: "✦ ONE MOMENT, YOUR HIGHNESS ✦",
          fewEn: (left) => `Only <b class="qx-num">${left}</b> left to revisit today.`,
          fewZh: "These are the words you forget most — walk these last few through and they'll finally settle.",
          startMark: "✦ ONE MOMENT, YOUR HIGHNESS ✦",
          startEn: (done, total) => `You've already revisited <b class="qx-num">${done}</b> of ${total} today.`,
          startZh: "These are the words you forget most — a few more passes and they'll finally settle.",
        });
        scrim.innerHTML = `<div class="qx-card"><div class="qx-mark">${c.mark}</div>
          <p class="qx-en">${c.en}</p>
          <p class="qx-zh">${c.zh}</p>
          <div class="qx-actions">
            <button type="button" class="gs-btn qx-stay">Keep Going</button>
            <button type="button" class="gs-btn qx-leave">Leave</button>
          </div></div>`;
        scrim.querySelector(".qx-stay").onclick = (e) => { e.stopPropagation(); scrim.remove(); };
        scrim.querySelector(".qx-leave").onclick = (e) => { e.stopPropagation(); scrim.remove(); proceed(); };
        requestAnimationFrame(() => scrim.classList.add("is-open"));
      }
      host.addEventListener("click", (e) => {
        if (e.target.closest(".qx-scrim")) return;
        const btn = e.target.closest(".rv-nav-btn");
        if (!btn || choiceDone) return;
        e.preventDefault(); e.stopPropagation();
        const trial = btn.hasAttribute("data-trial");
        showReviewExit(trial
          ? () => { window.__navDir = "forward"; window.go((window.Quiz && Quiz.menuHref) ? Quiz.menuHref("menu") : "#menu"); }
          : () => window.go(btn.getAttribute("data-go") || backHref));
      }, true);

      stageA();   // default entry = Word Recall + Group Choice, never spelling
    },
  };

  /* ---------- comprehension ----------
     The reading page's "next page": a short multiple-choice check on the
     SECTION's passage (questions from data/readingComprehension.js, keyed by
     section number). Passing advances to the next section / chapter via
     ChapterNav.nextAfterQuiz. This is the linear READING line and is wholly
     separate from the vocabulary Trial (the word quiz reached from the Menu). */
  const comprehension = {
    init(host, params) {
      const chapterId  = params.chapter || "universe";
      const sectionNum = params.section || "1.1";
      const book    = (typeof getChapterOrDefault === "function") ? getChapterOrDefault(chapterId) : { number: "01", title: chapterId };
      const section = (typeof ChapterNav !== "undefined") ? ChapterNav.findSection(chapterId, sectionNum) : null;
      const bg = (typeof getChapterBackground === "function") ? getChapterBackground(chapterId, params.page) : null;
      if (bg) host.style.backgroundImage = `url("${bg}")`;

      host.querySelector("[data-chapter-number]").textContent = "Chapter " + book.number;
      host.querySelector("[data-chapter-title]").textContent  = book.title;
      host.querySelector("[data-chapter-section]").textContent = section ? (section.number + " · " + section.title) : sectionNum;

      const body = host.querySelector(".comp-body");
      const items = (window.READING_COMPREHENSION && READING_COMPREHENSION[sectionNum]) || [];
      const returnHref = `#reading?chapter=${encodeURIComponent(chapterId)}&section=${encodeURIComponent(sectionNum)}`;
      const storyBtn = host.querySelector("[data-story]");
      if (storyBtn) storyBtn.addEventListener("click", (e) => { e.stopPropagation(); window.__navDir = "back"; window.go(returnHref); });

      function go(href) { window.__navDir = "forward"; window.go(href); }
      function nextHref() { return (typeof ChapterNav !== "undefined" && ChapterNav.nextAfterQuiz) ? ChapterNav.nextAfterQuiz(chapterId, sectionNum) : "#chapters"; }

      // No comprehension authored for this section → let the reader move on.
      if (!items.length) {
        body.innerHTML = `<div class="empty-state">No comprehension for this section yet.</div>
          <div style="text-align:center;margin-top:20px"><button type="button" class="gs-btn comp-skip">Continue ›</button></div>`;
        body.querySelector(".comp-skip").addEventListener("click", () => go(nextHref()));
        return;
      }

      const LETTER = ["A", "B", "C", "D"];
      body.innerHTML = items.map((q, i) => `
        <article class="quiz-item comp-item${i === 0 ? " is-shown" : ""}" data-solved="0">
          <div class="quiz-no">Question ${i + 1}</div>
          <p class="quiz-question">${esc(q.q)}</p>
          <ul class="quiz-options">
            ${(q.options || []).map((o, n) => `<li class="quiz-option" data-correct="${n === q.answer ? 1 : 0}">
                <span class="quiz-option-letter">${LETTER[n]}.</span>
                <span class="quiz-option-text">${esc(o)}</span></li>`).join("")}
          </ul>
        </article>`).join("");

      const all = Array.from(body.querySelectorAll(".quiz-item"));
      let lastSpoken = -1, advancing = false;
      function speakItem(it) { try { TTS.speak((it.querySelector(".quiz-question").textContent || "").trim()); } catch (_) {} }
      function focusItem(it) { all.forEach(x => x.classList.remove("is-current")); it.classList.add("is-current"); try { it.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) {} }
      function showThrough(n) {
        all.forEach((it, i) => it.classList.toggle("is-shown", i <= n));
        if (n > lastSpoken) { lastSpoken = n; const it = all[n]; focusItem(it); setTimeout(() => speakItem(it), 220); }
      }
      showThrough(0);

      function allCorrect() { return all.length && all.every(it => it.dataset.solved === "1"); }
      // Done = an INLINE row (no popup) so you can still double-tap the
      // questions to check their translations — especially the last one you
      // might have guessed — before leaving.
      function finish() {
        if (advancing) return; advancing = true;
        try { playSuccessChordGlobal(); } catch (_) {}
        spawnCelebration(host, 9);
        const row = document.createElement("div");
        row.className = "comp-done-row";
        row.innerHTML = `<p class="comp-done-title">Passage understood — double-tap any question for its translation.</p>
          <div class="comp-done-actions">
            <button type="button" class="antique-button cd-next"><span class="antique-button-label">Next ›</span></button>
            <button type="button" class="antique-button cd-notes"><span class="antique-button-label">Notes ✦</span></button>
          </div>`;
        body.appendChild(row);
        row.querySelector(".cd-next").onclick = (e) => { e.stopPropagation(); go(nextHref()); };
        row.querySelector(".cd-notes").onclick = (e) => { e.stopPropagation(); window.__navDir = "up"; window.go("#notes"); };
        try { row.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) {}
      }

      let failed = false;
      // A question has no stored translation, so we surface the translation of
      // the PASSAGE SENTENCE it's testing — the section's reading-translation
      // for whichever block best overlaps the question + its correct answer.
      function questionZh(idx) {
        const q = items[idx]; if (!q) return "";
        if (q.zh) return q.zh;
        if (/[一-鿿]/.test(q.q || "")) return "";   // ch5 questions are already Chinese
        const sec = (typeof ChapterNav !== "undefined") ? ChapterNav.findSection(chapterId, sectionNum) : null;
        const blocks = (sec && sec.blocks) || [];
        const trans = (window.READING_TRANSLATIONS || {})[chapterId + "|" + sectionNum] || [];
        if (!blocks.length || !trans.length) return "";
        const target = ((q.q || "") + " " + ((q.options || [])[q.answer] || "")).toLowerCase();
        const tw = new Set(target.match(/[a-z]{4,}/g) || []);
        let best = -1, bestI = -1;
        blocks.forEach((b, i) => {
          let ov = 0; for (const w of (b.toLowerCase().match(/[a-z]{4,}/g) || [])) if (tw.has(w)) ov++;
          if (ov > best) { best = ov; bestI = i; }
        });
        return (bestI >= 0 && trans[bestI]) || "";
      }
      // Double-tap a correctly-answered question to reveal its 中文.
      function toggleCompZh(item, idx) {
        const existing = item.querySelector(".comp-zh");
        if (existing) { existing.remove(); return; }
        const zh = questionZh(idx);
        const div = document.createElement("div");
        div.className = "comp-zh" + (zh ? "" : " is-missing");
        div.textContent = zh || "(translation coming)";
        item.querySelector(".quiz-question").after(div);
      }
      body.addEventListener("click", (e) => {
        const opt = e.target.closest(".quiz-option");
        const itm = e.target.closest(".quiz-item");
        if (!opt) {
          // Double-tap a SOLVED (correct) question → its translation.
          if (itm && itm.dataset.solved === "1") {
            const idx = all.indexOf(itm);
            const nowT = Date.now();
            if (itm._tapT && (nowT - itm._tapT) < 380) { itm._tapT = 0; toggleCompZh(itm, idx); }
            else { itm._tapT = nowT; setTimeout(() => { if (itm._tapT) { itm._tapT = 0; speakItem(itm); } }, 240); }
          } else if (itm && itm.classList.contains("is-shown")) { speakItem(itm); }
          return;
        }
        if (failed || opt.classList.contains("is-locked")) return;
        const item = opt.closest(".quiz-item");
        if (item.dataset.solved === "1") return;
        focusItem(item);
        // One shot only — lock every option the moment one is picked.
        item.querySelectorAll(".quiz-option").forEach(o => o.classList.add("is-locked"));
        if (opt.dataset.correct === "1") {
          opt.classList.add("is-correct");
          item.dataset.solved = "1";
          speakItem(item);   // read the question aloud on a correct pick
          try { playReviewChord(); } catch (_) {}
          const idx = all.indexOf(item);
          if (idx + 1 < all.length) setTimeout(() => showThrough(idx + 1), 800);
          else if (allCorrect()) setTimeout(finish, 600);
        } else {
          // Wrong = wrong: read the wrong option aloud, then bounce to story.
          opt.classList.add("is-wrong");
          failed = true;
          const optText = (opt.querySelector(".quiz-option-text") || {}).textContent || "";
          try { TTS.speak(optText); } catch (_) {}
          window.__navDir = "back";
          setTimeout(() => window.go(returnHref), 1400);
        }
      });

      // Leaving the comprehension before it's done shows the same finish-first
      // nudge as the quizzes (unified exit guard across all three paths).
      function showCompExit(proceed) {
        let scrim = host.querySelector(".qx-scrim");
        if (!scrim) { scrim = document.createElement("div"); scrim.className = "qx-scrim"; host.appendChild(scrim); }
        const solvedN = all.filter(it => it.dataset.solved === "1").length;
        const c = coaxCopy(solvedN, all.length, {
          fewMark: "✦ STAY A LINE LONGER ✦",
          fewEn: (left) => `Just <b class="qx-num">${left}</b> question${left === 1 ? "" : "s"} between you and the next page.`,
          fewZh: "You've read this far, your Highness — answer these and the next chapter opens for you.",
          startMark: "✦ STAY A LINE LONGER ✦",
          startEn: (done, total) => `You've already answered <b class="qx-num">${done}</b> of ${total}.`,
          startZh: "You've read this far, your Highness — see them through and the next chapter opens for you.",
        });
        scrim.innerHTML = `<div class="qx-card"><div class="qx-mark">${c.mark}</div>
          <p class="qx-en">${c.en}</p>
          <p class="qx-zh">${c.zh}</p>
          <div class="qx-actions">
            <button type="button" class="gs-btn qx-stay">Keep Reading</button>
            <button type="button" class="gs-btn qx-leave">Leave</button>
          </div></div>`;
        scrim.querySelector(".qx-stay").onclick = (e) => { e.stopPropagation(); scrim.remove(); };
        scrim.querySelector(".qx-leave").onclick = (e) => { e.stopPropagation(); scrim.remove(); proceed(); };
        requestAnimationFrame(() => scrim.classList.add("is-open"));
      }
      host.addEventListener("click", (e) => {
        if (e.target.closest(".qx-scrim") || e.target.closest(".comp-done-row")) return;
        const btn = e.target.closest(".ui-bottom-nav [data-go], .ui-bottom-nav [data-story]");
        if (!btn || advancing || failed || allCorrect()) return;
        e.preventDefault(); e.stopPropagation();
        const isStory = btn.hasAttribute("data-story");
        showCompExit(isStory ? () => { window.__navDir = "back"; window.go(returnHref); }
                             : () => window.go(btn.getAttribute("data-go")));
      }, true);
    },
  };

  // Shared completion celebration — the star-burst + halo the user loves, fired
  // on EVERY page/stage clear (comprehension, review, dictation, quiz).
  function spawnCelebration(host, n) {
    if (!host) return;
    n = n || 9;
    for (let i = 0; i < n; i++) {
      const s = document.createElement("div");
      s.className = "chapter-star";
      s.style.setProperty("--ang", (Math.random() * 360) + "deg");
      s.style.setProperty("--dist", (160 + Math.random() * 240) + "px");
      s.style.setProperty("--sz", (8 + Math.random() * 10) + "px");
      s.style.animationDelay = (Math.random() * 220) + "ms";
      host.appendChild(s);
      setTimeout(() => { try { s.remove(); } catch (_) {} }, 1700);
    }
    const halo = document.createElement("div");
    halo.className = "chapter-halo";
    host.appendChild(halo);
    setTimeout(() => { try { halo.remove(); } catch (_) {} }, 1450);
  }

  // bright two-note ding for a correct review answer (shared, audio-only).
  function playReviewChord() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
      const ctx = new Ctx(); const notes = [783.99, 1174.66]; const now = ctx.currentTime;
      notes.forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "triangle"; o.frequency.value = f; const t0 = now + i * 0.10;
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.22, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.42);
        o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + 0.5);
      });
      setTimeout(() => { try { ctx.close(); } catch (_) {} }, 1000);
    } catch (_) {}
  }
  function playSuccessChordGlobal() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
      const ctx = new Ctx(); const notes = [523.25, 659.25, 783.99, 1046.50]; const now = ctx.currentTime;
      notes.forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.value = f; const t0 = now + i * 0.18;
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.18, t0 + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0008, t0 + 1.05);
        o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + 1.15);
      });
      setTimeout(() => { try { ctx.close(); } catch (_) {} }, 2400);
    } catch (_) {}
  }

  return {
    splash, menu, select, chapters,
    reading, quiz, quizstatus, notes, review, comprehension,
    "word-garden": wordGarden,
    save, load, voices,
  };
})();
