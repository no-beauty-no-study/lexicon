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
      <p class="qx-zh">继续主线试炼，或随机复习已累计的单词。</p>
      <div class="qx-actions">
        <button type="button" class="gs-btn qm-continue">Continue · 继续</button>
        <button type="button" class="gs-btn qm-review"${n ? "" : " disabled"}>Review ${n ? "(" + n + ")" : ""} · 复习</button>
      </div></div>`;
    scrim.querySelector(".qm-continue").onclick = (e) => { e.stopPropagation(); window.go(quizContinueHref()); };
    const rb = scrim.querySelector(".qm-review");
    if (n) rb.onclick = (e) => { e.stopPropagation(); window.go("#quiz?chapter=universe&section=1.1&stage=golden&review=1"); };
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
            if (a === "resume")    window.go("#select");
            else if (a === "quiz") showQuizMenuPopup(host);
            else                   window.go("#chapters?browse=1");
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


  /* ---------- chapters ---------- */
  const chapters = {
    init(host, params) {
      const browse = params.browse === "1";
      const browseFlag = browse ? "&browse=1" : "";
      if (typeof CHAPTERS === "undefined") return;
      CHAPTERS.forEach((c) => {
        const text = host.querySelector(".zone-toc-" + c.number);
        const btn  = host.querySelector(".zone-toc-btn-" + c.number);
        if (text) text.innerHTML = `
          <div class="toc-card-text">
            <p class="toc-card-tagline">${esc(c.tagline || "")}</p>
          </div>`;
        if (btn) btn.innerHTML = `
          <button type="button" class="antique-button toc-open-btn"
                  data-go="#reading?chapter=${encodeURIComponent(c.id)}&section=${encodeURIComponent(c.firstSection || "1.1")}${browseFlag}">
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
        // HEAD chip — opens the big learning card on the word's 首脑词 (the
        // all-suffix-stripped core). When the word is already its own head it
        // links to itself. Styled like the Auto / folded chips, not a pill.
        const openHead = sc.clickableForBigCard
          ? ((sc.head && sc.head.word) ? sc.head.word : (sc.word || id)) : null;
        const headChip = openHead ? `
            <button type="button" class="word-card-head-chip" data-open-head="${esc(openHead)}">
              <span class="wchc-label">head</span><span class="wchc-word">${esc(openHead)}</span><span class="wchc-arrow">›</span>
            </button>` : "";
        return `
          <div class="word-card is-current is-entering${savedAlready ? " is-saved" : ""}${sc.clickableForBigCard ? " is-openable" : ""}" data-id="${esc(id)}">
            <div class="word-card-headword">${esc(sc.word || id)}</div>
            <div class="word-card-meaning">${esc(sc.zh || "")}</div>
            ${phraseRows}
            ${exampleRow}
            ${headChip}
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
          clearTimeout(prev._clr);
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
            + '<button type="button" data-next>Next<span class="nav-glyph-after">›</span></button>';
          nav.style.setProperty("--nav-count", "3");
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
      const toIndexBtn = host.querySelector("[data-toindex]");
      if (toIndexBtn) toIndexBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.__navDir = "fade";
        window.go(isBrowse ? "#chapters?browse=1" : "#chapters");
      });

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
        const target = host.querySelector(
          `.clickable-word[data-word="${cssEsc(params.word)}"]`);
        if (target) {
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

      // ============ QUIZ 2 · GOLDEN SEAL (Spelling Practice) ============
      // Parchment "Listen and Spell" page. Correction layer + pass-judgment
      // per the design: seeing the answer never counts; only an independent,
      // un-prompted correct spelling on a fresh presentation SEALS the word.
      if ((params.stage || "") === "golden") { renderGoldenSeal(); return; }

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
          out.push({ word: ans, en: ex.example, zh: ex.example_zh || "",
                     hint: (sc.pos ? sc.pos + " " : "") + (sc.zh || "") });
          if (out.length >= 10) break;
        }
        return out;
      }
      function sectionTokens(sec) { return ((sec && sec.blocks) || []).join(" ").match(/\b[A-Za-z][A-Za-z'-]{2,}\b/g) || []; }
      function renderGoldenSeal() {
        const body = host.querySelector(".quiz-body");
        const isReview = (params.review === "1");
        if (isReview) {
          host.querySelector("[data-chapter-number]").textContent = "Review";
          host.querySelector("[data-chapter-title]").textContent  = "Accumulated Words";
          host.querySelector("[data-chapter-section]").textContent = "随机复习 · 错得最多的优先";
        }
        const set = buildGoldenSet(isReview && window.Quiz ? Quiz.reviewWords() : sectionTokens(section));
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
            <div class="gs-label gs-listen">✦ LISTEN AND SPELL ✦</div>
            <p class="gs-sentence-en"></p>
            <p class="gs-sentence-zh"></p>
            <p class="gs-hint"></p>
            <div class="gs-spell">
              <div class="gs-cells"></div>
              <input class="gs-input" type="text" lang="en" inputmode="text"
                     autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Spell the word">
            </div>
            <p class="gs-note">If answered incorrectly, the correct spelling appears briefly,<br>then you must type it again. · 看过答案不算通过</p>
            <div class="gs-correction" hidden></div>
            <div class="gs-actions">
              <button type="button" class="gs-btn gs-reveal">👁 REVEAL</button>
              <button type="button" class="gs-btn gs-check">✓ CHECK</button>
            </div>
          </div>`;

        const el = (s) => body.querySelector(s);
        const cellsEl = el(".gs-cells"), input = el(".gs-input");
        const enEl = el(".gs-sentence-en"), zhEl = el(".gs-sentence-zh"), hintEl = el(".gs-hint");
        const noEl = el(".gs-no"), dotsEl = el(".gs-dots"), corr = el(".gs-correction");

        const cur = () => set[queue[pos]];
        const sealedCount = () => set.filter(q => q.status === "sealed").length;
        function renderDots() {
          dotsEl.innerHTML = set.map(q =>
            `<span class="gs-dot ${q.status === "sealed" ? "is-sealed" : q.status === "corrected" ? "is-corrected" : ""}"></span>`).join("");
          noEl.textContent = String(Math.min(set.length, sealedCount() + 1)).padStart(2, "0");
        }
        function renderCells() {
          const q = cur(); const v = input.value.toLowerCase().slice(0, q.word.length);
          let h = "";
          for (let i = 0; i < q.word.length; i++) {
            const ch = v[i] || "";
            h += `<span class="gs-cell${i === v.length ? " is-caret" : ""}${ch ? " is-filled" : ""}">${esc(ch)}</span>`;
          }
          cellsEl.innerHTML = h;
        }
        function blankSentence(en, word) {
          return esc(en).replace(new RegExp("\\b" + rxq(word) + "\\b", "i"),
            `<span class="gs-blank">${"_".repeat(Math.max(6, word.length))}</span>`);
        }
        let recordedWrong = false;   // count one WRONG per spoiled presentation
        function present() {
          revealed = false; wrongThis = false; recordedWrong = false;
          corr.hidden = true; corr.innerHTML = "";
          input.value = "";
          const q = cur();
          enEl.innerHTML = blankSentence(q.en, q.word);
          zhEl.textContent = q.zh || "";
          hintEl.textContent = q.hint || "";
          cellsEl.classList.remove("is-shake");
          renderCells(); renderDots();
          setTimeout(() => { try { input.focus(); } catch (_) {} }, 60);
          speakWord(q.word);
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
            <div class="gs-c-tip">Tap the writing line to try again · 点击输入线重写</div>`;
          corr.hidden = false;
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
            <div class="gs-done-title">Golden Seal Complete</div>
            <p class="gs-done-sub">Sealed ${sealedCount()} / ${set.length} · 已封存</p>
            <button type="button" class="gs-btn gs-continue" style="margin-top:18px">CONTINUE</button></div>`;
          try { playSuccessChord(); } catch (_) {}
          const go = () => window.go((window.Quiz && Quiz.menuHref) ? Quiz.menuHref() : "#menu");
          const c = body.querySelector(".gs-continue"); if (c) c.addEventListener("click", go);
          setTimeout(go, 2600);
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
              <p class="qx-en"></p><p class="qx-zh"></p>
              <div class="qx-actions">
                <button type="button" class="gs-btn qx-stay"></button>
                <button type="button" class="gs-btn qx-leave"></button>
              </div></div>`;
            host.appendChild(scrim);
          }
          const n = remaining(), total = set.length;
          scrim.querySelector(".qx-en").innerHTML =
              `Only <b class="qx-num">${n}</b> word${n === 1 ? "" : "s"} left.<br>`
            + `Leave now, and this set will remain unsealed.<br>`
            + `Finish them, and all ${total} words will enter your accumulated list.`;
          scrim.querySelector(".qx-zh").innerHTML =
              `只剩 <b class="qx-num">${n}</b> 个词。<br>现在离开，这一组仍然不会封存。<br>`
            + `完成它们，${total} 个词才会全部进入已累计。`;
          scrim.querySelector(".qx-stay").textContent = "Seal the Set · 封存本组";
          scrim.querySelector(".qx-leave").textContent = "Give Up Progress · 放弃进度";
          scrim.querySelector(".qx-stay").onclick = (e) => { e.stopPropagation(); scrim.remove(); try { input.focus(); } catch (_) {} };
          scrim.querySelector(".qx-leave").onclick = (e) => { e.stopPropagation(); scrim.remove(); proceed(); };
          requestAnimationFrame(() => scrim.classList.add("is-open"));
        }
        // Capture-phase so we intercept BEFORE app.js's document-level data-go.
        host.addEventListener("click", (e) => {
          if (e.target.closest(".qx-scrim")) return;
          const btn = e.target.closest(".ui-bottom-nav [data-go], .ui-bottom-nav [data-back]");
          if (!btn) return;
          const isBack = btn.hasAttribute("data-back");
          const go = isBack ? () => { window.__navDir = "back"; window.go("#menu"); }
                            : () => window.go(btn.getAttribute("data-go"));
          if (remaining() > 0) { e.preventDefault(); e.stopPropagation(); showExit(go); }
          else if (isBack)     { e.preventDefault(); e.stopPropagation(); go(); }
        }, true);
        const gNext = host.querySelector("[data-next]");
        if (gNext) gNext.addEventListener("click", (e) => {
          e.stopPropagation();
          if (pos + 1 < queue.length) { pos += 1; present(); }
          else if (remaining() > 0) showExit(finish);
          else finish();
        });
        function onCheck() {
          const q = cur();
          const typed = input.value.trim().toLowerCase();
          if (!typed) { cellsEl.classList.remove("is-shake"); void cellsEl.offsetWidth; cellsEl.classList.add("is-shake"); return; }
          if (typed === q.word) {
            const clean = !revealed && !wrongThis;     // un-prompted, first try this presentation
            if (clean) { q.status = "sealed"; if (window.Quiz) Quiz.recordWord(q.word, true); playSuccessChord(); }
            else { if (q.status !== "sealed") q.status = "corrected"; queue.push(queue[pos]); } // re-queue for independent retry
            renderDots(); recordState();
            pos += 1;
            if (pos >= queue.length || sealedCount() >= set.length) return finish();
            present();
          } else {
            wrongThis = true;
            if (q.status !== "sealed") q.status = "corrected";
            if (!recordedWrong && window.Quiz) { Quiz.recordWord(q.word, false); recordedWrong = true; }
            cellsEl.classList.remove("is-shake"); void cellsEl.offsetWidth; cellsEl.classList.add("is-shake");
            showCorrection(typed); speakWord(q.word); renderDots();
          }
        }
        function onReveal() {
          const q = cur();
          revealed = true;
          if (q.status !== "sealed") q.status = "corrected";
          if (!recordedWrong && window.Quiz) { Quiz.recordWord(q.word, false); recordedWrong = true; }  // seeing = counts as wrong
          showCorrection(input.value.trim().toLowerCase()); speakWord(q.word); renderDots();
        }
        function retry() { if (!corr.hidden) { corr.hidden = true; corr.innerHTML = ""; input.value = ""; renderCells(); } }

        input.addEventListener("input", () => { input.value = input.value.replace(/[^A-Za-z]/g, ""); renderCells(); });
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); onCheck(); } });
        input.addEventListener("focus", retry);
        cellsEl.addEventListener("click", () => { retry(); try { input.focus(); } catch (_) {} });
        el(".gs-listen").addEventListener("click", () => speakWord(cur().word));   // tap label to replay
        el(".gs-check").addEventListener("click", onCheck);
        el(".gs-reveal").addEventListener("click", onReveal);
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
      function renderItem(q, idx, pool, audioPrefix) {
        const opts = buildOptions(q.a, pool);
        // No .reveal-block here on purpose — earlier the class made
        // the question text 10%-opacity warm-grey by default ("invisible
        // ink"), so a player who hadn't tapped the page first couldn't
        // see anything. Quiz prompts need to be readable on entry.
        return `
          <article class="quiz-item" data-answer="${esc(q.a)}"
                   data-solved="0"
                   data-audio="${esc(audioPrefix)}-q${idx + 1}.mp3">
            <div class="quiz-no">Question ${idx + 1}</div>
            <p class="quiz-question">${esc(q.q)}</p>
            <ul class="quiz-options">
              ${opts.map((o, i) => `
                <li class="quiz-option" data-value="${esc(o)}">
                  <span class="quiz-option-letter">${LETTER[i]}.</span>
                  <span class="quiz-option-text">${esc(o)}</span>
                </li>
              `).join("")}
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

      const pool  = section ? poolFor(section) : [];
      const items = (section && section.quiz) ? section.quiz : [];
      const body = host.querySelector(".quiz-body");
      body.innerHTML = items.length
        ? items.map((q, i) => renderItem(q, i, pool, section.audio_prefix)).join("")
        : `<div class="empty-state">No quiz available yet for this section.</div>`;

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
        const q = (item.querySelector(".quiz-question")?.textContent || "").trim();
        const opts = Array.from(item.querySelectorAll(".quiz-option-text"))
                       .map(el => el.textContent.trim()).filter(Boolean);
        const parts = [q];
        opts.forEach((o, i) => parts.push(`${LETTER[i]}. ${o}`));
        try { TTS.speak(parts.join(". ")); } catch (_) {}
      }
      // Tapping a revealed question (not an option) rereads it.
      body.addEventListener("click", (e) => {
        if (e.target.closest(".quiz-option")) return;
        const item = e.target.closest(".quiz-item");
        if (item && item.classList.contains("is-shown")) speakItem(item);
      });
      let lastSpokenIdx = -1;
      function showThrough(n) {
        const all = host.querySelectorAll(".quiz-item");
        all.forEach((it, i) => it.classList.toggle("is-shown", i <= n));
        // Auto-read the newly-revealed question (and its options) so the
        // player can start without tapping. Only re-speak if we've
        // actually advanced past the last one we read.
        if (n > lastSpokenIdx) {
          lastSpokenIdx = n;
          const item = all[n];
          // Tiny delay so the fade-in starts before the voice kicks in
          // — feels more like the page is reading itself to you.
          setTimeout(() => speakItem(item), 220);
        }
      }
      showThrough(0);

      let advancing = false;
      let backingOut = false;

      function allCorrect() {
        const itemEls = host.querySelectorAll(".quiz-item");
        if (!itemEls.length) return false;
        return Array.from(itemEls).every(it => it.dataset.solved === "1");
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
      function maybeChapterComplete() {
        if (advancing || !allCorrect()) return;
        advancing = true;
        // Silver Trial cleared → mark Quiz 1 done and move on to the same
        // section's Quiz 2 · Golden Seal (the spelling stage).
        if (window.Quiz && Quiz.setStageStatus) Quiz.setStageStatus(chapterId, sectionNum, "quiz1", "completed");
        spawnStarBurst(8);
        showToast({ title: "Silver Trial Cleared", subtitle: "Now the Golden Seal.", ms: 0 });
        playCorrectDing();
        setTimeout(() => {
          window.__navDir = "forward";
          window.go((window.Quiz && Quiz.quizHref)
            ? Quiz.quizHref(chapterId, sectionNum, "golden")
            : `#quiz?chapter=${encodeURIComponent(chapterId)}&section=${encodeURIComponent(sectionNum)}&stage=golden`);
        }, 1300);
      }

      // Right-column word card (reuses the reading marginalia look). Shown
      // when a wrong option is tapped; clicking it opens the full drawer.
      function quizSmallCardHTML(sc, id) {
        const phraseRows = (sc.phrases || []).slice(0, 2).map(p => `
          <div class="word-card-phrase"><span class="wcp-en">${esc(p.phrase || p.en || "")}</span>
          ${(p.phrase_zh || p.zh) ? `<span class="wcp-zh">${esc(p.phrase_zh || p.zh)}</span>` : ""}</div>`).join("");
        const ex = (sc.examples || [])[0]; const exEn = ex && (ex.example || ex.en) || ""; const exZh = ex && (ex.example_zh || ex.zh) || "";
        const head = sc.head && sc.head.word;
        const chip = (head && sc.clickableForBigCard)
          ? `<button type="button" class="word-card-head-chip" data-open-head="${esc(head)}"><span class="wchc-label">head</span><span class="wchc-word">${esc(head)}</span><span class="wchc-arrow">›</span></button>` : "";
        return `<div class="word-card is-current is-entering${sc.clickableForBigCard ? " is-openable" : ""}" data-id="${esc(id)}">
          <div class="word-card-headword">${esc(sc.word || id)}</div>
          <div class="word-card-meaning">${esc(sc.zh || "")}</div>
          ${phraseRows}
          ${exEn ? `<div class="word-card-example"><span class="wce-en">${esc(exEn)}</span>${exZh ? `<span class="wce-zh">${esc(exZh)}</span>` : ""}</div>` : ""}
          ${chip}</div>`;
      }
      function showQuizWord(word) {
        const stack = host.querySelector(".word-card-stack");
        if (!stack) return;
        const sc = (window.VocabRuntime && VocabRuntime.getSmallCard) ? VocabRuntime.getSmallCard(word) : null;
        if (!sc) return;
        stack.innerHTML = quizSmallCardHTML(sc, sc.word || word);
        const fresh = stack.firstElementChild;
        if (!fresh) return;
        setTimeout(() => fresh.classList.remove("is-entering"), 600);
        fresh.addEventListener("click", (e) => {
          e.stopPropagation();
          const chip = e.target.closest("[data-open-head]");
          if (typeof WordCard !== "undefined")
            WordCard.openBigCard(chip ? chip.dataset.openHead : (sc.head && sc.head.word) || sc.word || word,
                                 { chapter: chapterId, section: sectionNum });
        });
      }

      body.addEventListener("click", (e) => {
        const opt = e.target.closest(".quiz-option");
        if (!opt || opt.classList.contains("is-locked")) return;
        e.stopPropagation();
        const item = opt.closest(".quiz-item");
        if (item.dataset.solved === "1") return;
        focusItem(item);   // keep the answered question in view
        const answer = item.dataset.answer.toLowerCase().trim();
        const chosen = (opt.dataset.value || "").toLowerCase().trim();
        const correct = chosen === answer;
        item.querySelectorAll(".quiz-option.is-selected")
          .forEach(o => o.classList.remove("is-selected"));
        if (correct) {
          opt.classList.add("is-correct", "is-locked");
          item.dataset.solved = "1";
          item.querySelectorAll(".quiz-option").forEach(o => o.classList.add("is-locked"));
          // Happy feedback: a bright ding + a little gold sparkle on the
          // chosen option, then read the word the player got right.
          playCorrectDing();
          opt.classList.remove("is-pop"); void opt.offsetWidth; opt.classList.add("is-pop");
          try { TTS.speak(opt.dataset.value || opt.textContent || ""); } catch (_) {}
          const all = Array.from(host.querySelectorAll(".quiz-item"));
          const idx = all.indexOf(item);
          // Give the spoken word a beat before sliding the next question
          // in (which would otherwise cancel() the utterance mid-word).
          if (idx + 1 < all.length) setTimeout(() => showThrough(idx + 1), 900);
          else maybeChapterComplete();
        } else {
          // Wrong → study aid in the right column (like reading): the chosen
          // word's small card appears; tap it for the full card. No bounce.
          opt.classList.add("is-wrong");
          setTimeout(() => opt.classList.remove("is-wrong"), 1000);
          try { TTS.speak(opt.dataset.value || opt.textContent || ""); } catch (_) {}
          showQuizWord(chosen);
        }
      });

      const back = host.querySelector("[data-back]");
      if (back) back.addEventListener("click", (e) => {
        e.stopPropagation();
        window.__navDir = "back";
        window.go(ChapterNav.prevBeforeQuiz(chapterId, sectionNum));
      });
      const next = host.querySelector("[data-next]");
      if (next) next.addEventListener("click", (e) => {
        e.stopPropagation();
        if (allCorrect()) maybeChapterComplete();
        else showToast({
          title: "Answer the Questions",
          subtitle: "Choose the correct option for each.",
          ms: 1400,
        });
      });
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
  function quoteForNote(entry, scope) {
    const word = (entry && entry.word) || "";
    if (scope && scope.chapter && scope.section && typeof ChapterNav !== "undefined") {
      const sec = ChapterNav.findSection(scope.chapter, scope.section);
      if (sec && Array.isArray(sec.blocks) && word) {
        const re = new RegExp("\\b" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
        const hit = sec.blocks.find(b => re.test(b));
        if (hit) return hit;
      }
    }
    return (entry && (entry.example || entry.meaning)) || "";
  }
  function highlightWord(text, word) {
    const safe = esc(text);
    if (!word) return safe;
    const re = new RegExp("(" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
    return safe.replace(re, '<span class="quote-word">$1</span>');
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
      const ids = Storage.getNotes();
      const byId = {};
      const cards = [];

      ids.forEach((id, i) => {
        const entry = resolveWordEntry(id);
        const word  = (entry && entry.word) || id;
        byId[id] = entry || { word: id };

        const scope = Storage.findScopeOf ? Storage.findScopeOf(id) : null;
        const quote = quoteForNote(entry, scope);
        const src   = sourceLabel(scope);
        const idxStr = (i + 1 < 10 ? "0" : "") + (i + 1);

        const phrases = entry ? getPhrasePairs(entry).slice(0, 2) : [];
        const phraseRows = phrases.map(p => `
            <span class="word-phrase">${esc(p.en)}${p.zh ? `<span class="word-phrase-zh">— ${esc(p.zh)}</span>` : ""}</span>`).join("");
        const example = (entry && entry.example) || "";

        // Open Chapter → reading, located on the folded sentence with
        // the word spotlit. Only when we know which section it came from.
        const openBtn = (scope && scope.chapter) ? `
          <div class="note-open">
            <button type="button" class="antique-button"
                    data-go="#reading?chapter=${encodeURIComponent(scope.chapter)}&section=${encodeURIComponent(scope.section || "1.1")}&word=${encodeURIComponent(id)}">
              <span class="antique-button-label">Open Chapter</span>
            </button>
          </div>` : "";

        cards.push(`
          <li class="note-card" data-id="${esc(id)}">
            <div class="note-index">${esc(idxStr)}</div>
            <div class="note-quote">
              ${src ? `<div class="note-source">${esc(src)}</div>` : ""}
              <div class="note-quote-text">${highlightWord(quote, word)}</div>
            </div>
            ${openBtn}
            <div class="word-preview">
              <div class="word-title">${esc(word)}</div>
              ${entry && entry.meaning ? `<div class="word-zh">${esc(entry.meaning)}</div>` : ""}
              <div class="word-divider"></div>
              <div class="word-phrases">${phraseRows}</div>
              ${example ? `<div class="word-divider"></div><div class="word-example">${esc(example)}</div>` : ""}
            </div>
            <div class="bookmark-open" aria-label="Open word card">Tap to Open</div>
          </li>`);
      });

      listEl.innerHTML = cards.length
        ? cards.join("")
        : `<li class="notes-empty">No saved words yet — fold a word while reading to keep it here.</li>`;

      // Tapping the word preview or the blue bookmark opens the full
      // drawer card. (Open Chapter uses data-go and is handled globally.)
      listEl.addEventListener("click", (e) => {
        const hit = e.target.closest(".word-preview, .bookmark-open");
        if (!hit) return;
        const card = e.target.closest(".note-card");
        if (!card) return;
        e.stopPropagation();
        const entry = byId[card.dataset.id];
        const scope = Storage.findScopeOf ? Storage.findScopeOf(card.dataset.id) : null;
        if (entry && typeof WordCard !== "undefined") WordCard.openDrawer(entry, scope || undefined);
      });
    },
  };


  /* ---------- word-garden ---------- */
  const wordGarden = {
    init(host) {
      let query = "";
      function allWords() {
        // Primary source: the vocab word master (same table reading uses).
        if (window.VOCAB_WORD_MASTER_FINAL && VOCAB_WORD_MASTER_FINAL.cards) {
          const cards = VOCAB_WORD_MASTER_FINAL.cards;
          return Object.keys(cards).map(k => {
            const c = cards[k] || {};
            return { word: c.word || k, zh: c.zh || "" };
          }).sort((a, b) => a.word.localeCompare(b.word));
        }
        const seen = new Map();
        const push = (w) => {
          if (!w || !w.word) return;
          const id = (w.id || w.word).toLowerCase();
          if (!seen.has(id)) seen.set(id, w);
        };
        if (typeof WORDS !== "undefined") WORDS.forEach(push);
        if (typeof WORD_LIBRARY !== "undefined") WORD_LIBRARY.forEach(push);
        return Array.from(seen.values()).sort((a, b) => a.word.localeCompare(b.word));
      }
      function shortGloss(w) {
        if (w.zh) return w.zh;
        if (w.meaning) return w.meaning;
        if (Array.isArray(w.kin)) {
          for (const k of w.kin) {
            if (k && typeof k === "object" && k.zh) return k.zh;
            if (typeof k === "string") return k;
          }
        }
        return "";
      }
      function filtered() {
        const all = allWords();
        if (!query) return all;
        return all.filter(w =>
          w.word.toLowerCase().includes(query) ||
          shortGloss(w).toLowerCase().includes(query)
        );
      }
      function rowHTML(w) {
        return `<li class="wg-row" data-id="${esc(w.id || w.word)}">
          <span class="wg-row-en">${esc(w.word)}</span>
          <span class="wg-row-zh">${esc(shortGloss(w))}</span>
        </li>`;
      }
      function renderTable() {
        const left  = host.querySelector("#wg-col-left");
        const right = host.querySelector("#wg-col-right");
        if (!left || !right) return;
        const list = filtered();
        const half = Math.ceil(list.length / 2);
        left.innerHTML  = list.slice(0, half).map(rowHTML).join("");
        right.innerHTML = list.slice(half).map(rowHTML).join("");
        host.querySelectorAll(".wg-row").forEach(row => {
          row.addEventListener("click", () => {
            const id = row.dataset.id;
            if (typeof WordCard !== "undefined") WordCard.openBigCard(id);
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
        ? Quiz.quizHref(chapterId, sectionNum, stage)
        : `#quiz?chapter=${encodeURIComponent(chapterId)}&section=${encodeURIComponent(sectionNum)}&stage=${stage}`;
      if (st.quiz1.status !== "completed") { main = st.quiz1.status === "in_progress" ? "Continue Silver Trial" : "Begin Silver Trial"; href = q("silver"); }
      else if (st.quiz2.status !== "completed") { main = st.quiz2.status === "in_progress" ? "Continue Golden Seal" : "Begin Golden Seal"; href = q("golden"); }
      else { main = "Redo Trial"; href = q("silver"); }
      const actions = body.querySelector(".qs-actions");
      actions.innerHTML = `<button type="button" class="gs-btn qs-begin">${main}</button>`
        + (st.quiz1.status === "completed" && st.quiz2.status === "completed"
            ? `<button type="button" class="gs-btn qs-review" data-go="#word-garden">Review Words</button>` : "");
      const begin = actions.querySelector(".qs-begin");
      if (begin) begin.addEventListener("click", () => { window.__navDir = "forward"; window.go(href); });
    },
  };

  return {
    splash, menu, select, chapters,
    reading, quiz, quizstatus, notes,
    "word-garden": wordGarden,
    save, load, voices,
  };
})();
