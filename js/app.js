/* The Princess Lexicon — app.js
   SPA shell: hash router, viewport scaling, gesture locks, global
   nav helpers. The router clones <template id="view-X"> into #stage
   then calls Views.X.init(hostMain, params) for that view to wire
   up its own behaviour. */
(function () {

  // One-shot story reset: a word-card "Open Chapter" used to jump the GRADED
  // story path forward and strand the reader deep in a later chapter with no
  // way back ("story 卡在后面章节回不去了"). Open Chapter is now browse-mode,
  // but the already-polluted resume point still points deep in. Clear it once
  // so the story starts clean again; the flag stops it from wiping progress
  // on every load thereafter.
  try {
    if (!localStorage.getItem("tpl.storyResetV63")) {
      localStorage.removeItem("tpl.lastRead");
      localStorage.setItem("tpl.storyResetV63", "1");
    }
  } catch (_) {}

  /* ---------- viewport scaling (1448×1086 design fits the screen) ---------- */
  function fitStage() {
    const stage = document.getElementById("stage");
    if (!stage || !stage.querySelector(".page")) return;
    const sw = stage.clientWidth;
    if (!sw || sw < 200) { requestAnimationFrame(fitStage); return; }
    const scale = sw / 1448;
    // Scale via a CSS var on the STAGE (not an inline transform on one
    // page) so that during a page-turn BOTH the outgoing and incoming
    // .page children scale identically — see `.stage[data-scale] .page`.
    stage.dataset.scale = "1";
    stage.style.setProperty("--page-scale", scale.toFixed(6));
  }
  window.addEventListener("resize",            fitStage, { passive: true });
  window.addEventListener("orientationchange", fitStage, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", fitStage, { passive: true });
  }

  /* ---------- iOS gesture / double-tap zoom blocks ----------
     The viewport meta alone isn't enough on iPad Safari, so we kill
     pinch / spread + double-tap zoom from JS too. */
  ["gesturestart", "gesturechange", "gestureend"].forEach(ev =>
    document.addEventListener(ev, e => e.preventDefault()));
  document.addEventListener("touchmove", (e) => {
    if (e.scale && e.scale !== 1) e.preventDefault();
  }, { passive: false });
  // Block ONLY a real double-tap-to-zoom: two taps close in time AND at the
  // same spot. Two quick taps on DIFFERENT controls (e.g. auto-read question
  // → tap an option) must NOT be cancelled — preventDefault on touchend kills
  // the synthesized click, which made quiz options feel "not clickable".
  let lastTap = 0, lastX = 0, lastY = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    const t = (e.changedTouches && e.changedTouches[0]) || null;
    const x = t ? t.clientX : 0, y = t ? t.clientY : 0;
    const samePlace = Math.abs(x - lastX) < 30 && Math.abs(y - lastY) < 30;
    if (now - lastTap < 350 && samePlace) e.preventDefault();
    lastTap = now; lastX = x; lastY = y;
  }, { passive: false });


  /* ---------- hash router ----------
     Hash form: #view?key=val&key2=val2
     Examples:  #menu | #reading?chapter=universe&section=1.1 */
  function parseHash() {
    const h = (location.hash || "").replace(/^#/, "");
    if (!h) return { name: "splash", params: {} };
    const qi = h.indexOf("?");
    const name = (qi < 0 ? h : h.slice(0, qi)) || "splash";
    const params = {};
    if (qi >= 0) {
      const sp = new URLSearchParams(h.slice(qi + 1));
      for (const [k, v] of sp.entries()) params[k] = v;
    }
    return { name, params };
  }

  function render() {
    const { name, params } = parseHash();
    const tpl = document.getElementById("view-" + name);
    const stage = document.getElementById("stage");
    if (!tpl || !stage) return;
    // Stop any recorded narration when navigating (the reading view's <audio>
    // object outlives its page otherwise and keeps playing).
    try { if (window.__recAudio) { window.__recAudio.pause(); clearInterval(window.__recAudio._mon); } } catch (_) {}

    const node = tpl.content.firstElementChild.cloneNode(true);
    const prev = stage.querySelector(".page");

    // Cinematic page transition — vertical UP push for cover/menu
    // flows, horizontal LEFT push for reading↔quiz. The translate
    // is driven via CSS variables (--tx / --ty) that compose with
    // .stage[data-scale] .page's scale(var(--page-scale)) — so the
    // page keeps its scale-to-fit-viewport while it slides. Setting
    // `style.transform` directly would have clobbered the scale and
    // blown the page up past the viewport — that was the "右下角被
    // 裁没了" bug the user just reported.
    // Direction of the page-turn. A caller (Prev/Next/Back) can set
    // window.__navDir to force it; otherwise reading↔quiz turns forward
    // and everything else flows up.
    //   forward → new enters from RIGHT, old leaves LEFT  (turn onward)
    //   back    → new enters from LEFT,  old leaves RIGHT (turn back)
    //   up      → new enters from BOTTOM, old leaves TOP
    //   fade    → pure crossfade (e.g. Back to the index)
    const READING_FLOW = { reading: 1, quiz: 1 };
    const prevName = document.body.dataset.currentView || "";
    const hint = window.__navDir; window.__navDir = null;
    let dir;
    if (hint) dir = hint;
    else if (READING_FLOW[prevName] && READING_FLOW[name]) dir = "forward";
    else dir = "up";
    let enterTx = "0", enterTy = "0", leaveTx = "0", leaveTy = "0";
    if      (dir === "forward") { enterTx = "100%";  leaveTx = "-100%"; }
    else if (dir === "back")    { enterTx = "-100%"; leaveTx = "100%";  }
    else if (dir === "up")      { enterTy = "100%";  leaveTy = "-100%"; }
    /* dir === "fade": all offsets stay 0 → only opacity animates */
    const easing  = "cubic-bezier(0.22, 0.8, 0.22, 1)";

    // INCOMING — placed off-screen on the chosen axis (no transition yet),
    // appended, then its content is BUILT and the scale committed — all
    // while it is still off-screen and the old page is static. Only after
    // that heavy work + the first layout/paint are done do we kick off the
    // slide. Previously view.init (the ~180-span build) ran AFTER this block
    // and `void node.offsetHeight` flushed an EMPTY page, so the first
    // *animated* frame was where the browser first laid out, painted and
    // rasterised all the blurred content — a single monster frame that
    // stuttered the turn ("比别的多了几帧定格帧"). Building first turns the
    // slide into a clean compositor-only transform.
    // Live page scale, baked into every keyframe below: WAAPI overrides the
    // CSS transform while it plays, so if the scale weren't in each keyframe
    // the page would jump to scale(1) for the whole turn.
    const pageScale = parseFloat(getComputedStyle(stage).getPropertyValue("--page-scale"))
                      || (stage.clientWidth / 1448) || 1;
    const SC = `scale(${pageScale})`;

    if (prev) {
      // Park the incoming page off-screen BEFORE it is appended/painted, so
      // it never flashes at centre while its content builds.
      node.style.transform  = `${SC} translate(${enterTx}, ${enterTy})`;
      node.style.opacity    = "0.92";
      node.style.zIndex     = "2";
      node.style.willChange = "transform, opacity";
    }
    stage.appendChild(node);

    const view = Views[name];
    try {
      if (view && typeof view.init === "function") view.init(node, params);
    } catch (err) {
      try { console.error("[Views." + name + "] init failed:", err); } catch (_) {}
    }
    fitStage();

    if (prev) {
      // Suspend the sentence-block blur for the duration of the turn so the
      // slide is a clean compositor transform (it fades back via the
      // sentence-block's own 0.7s filter transition once we land).
      stage.classList.add("is-turning");
      prev.classList.add("page-leaving");      // pauses child animations
      prev.style.willChange = "transform, opacity";
      prev.style.zIndex = "1";
      prev.style.pointerEvents = "none";

      // Drive BOTH pages with the Web Animations API. This sidesteps every
      // var()-in-transform / CSS-specificity pitfall the inline-`--tx`
      // approach kept tripping over (the "next 飞到网页外面" turn): the full
      // transform — scale + translate — is written out per keyframe and runs
      // on the compositor, immune to main-thread jank and var() quirks.
      const dur = 900;
      const aIn = node.animate(
        [ { transform: `${SC} translate(${enterTx}, ${enterTy})`, opacity: 0.92 },
          { transform: `${SC} translate(0px, 0px)`,               opacity: 1    } ],
        { duration: dur, easing, fill: "both" });
      aIn.onfinish = () => {                   // hand the page back to the CSS rule
        node.style.transform = "";
        node.style.opacity = "";
        node.style.willChange = "auto";
        node.style.zIndex = "";
        try { aIn.cancel(); } catch (_) {}
      };

      const dying = prev;
      const aOut = prev.animate(
        [ { transform: `${SC} translate(0px, 0px)`,               opacity: 1   },
          { transform: `${SC} translate(${leaveTx}, ${leaveTy})`, opacity: 0.5 } ],
        { duration: dur, easing, fill: "both" });
      aOut.onfinish = () => { try { dying.remove(); } catch (_) {} };

      setTimeout(() => { try { stage.classList.remove("is-turning"); } catch (_) {} }, dur);
      setTimeout(() => { try { dying.remove(); } catch (_) {} }, dur + 300);   // safety net
    }

    requestAnimationFrame(fitStage);

    // Tag body with the current view so view-specific selectors
    // (e.g. .global-voice-link hide-on-splash) can target it.
    document.body.dataset.currentView = name;

    if (window.BGM && BGM.applyForView) BGM.applyForView(name, params);

    if (params.debug === "1") document.body.classList.add("debug-ui");
    else                      document.body.classList.remove("debug-ui");
  }

  window.addEventListener("hashchange", render);
  document.addEventListener("DOMContentLoaded", () => {
    // Always land on the splash on a fresh app launch, even if the URL
    // already had a hash from a previous session (PWA + Safari preserve
    // location.hash, so the user was getting kicked straight to #menu
    // and never saw the painted TAP TO BEGIN cover). Deep-links into
    // a specific chapter / quiz still respect the URL so a bookmarked
    // #reading?chapter=X resumes directly. Everything else → splash.
    const h = (location.hash || "").replace(/^#/, "").split("?")[0];
    const allowResume = (h === "reading" || h === "quiz");
    if (!allowResume) {
      if (location.hash === "#splash") render();
      else                             location.hash = "#splash";
    } else {
      render();
    }
  });


  /* ---------- nav helpers ---------- */

  // Accepts:
  //   "#menu"                       → set hash directly
  //   "menu.html"                   → "#menu"
  //   "reading.html?chapter=X&..."  → "#reading?chapter=X&..."
  // Legacy *.html callers (any third-party link, old localStorage state)
  // route through this so we never actually navigate the document.
  function toHash(href) {
    if (!href) return null;
    if (href.startsWith("#")) return href;
    if (/^https?:/i.test(href) || href.startsWith("/")) return null;
    const m = href.match(/^([a-zA-Z0-9_\-]+)\.html(\?.*)?$/);
    if (!m) return null;
    const name = m[1] === "index" ? "splash" : m[1];
    return "#" + name + (m[2] || "");
  }
  window.go = function (href) {
    const target = toHash(href);
    if (target == null) { location.href = href; return; }
    // Remember where we're leaving FROM so a view's Back can return there
    // automatically — "用户从哪来就回哪去", never a guess. One level is enough.
    const cur = location.hash || "#splash";
    if (cur !== target && cur.replace(/^#/, "").split("?")[0] !== "splash") window.__backHash = cur;
    if (location.hash === target) render();
    else                          location.hash = target;
  };
  // The hash to return to (set by the last navigation). Views' Back buttons use
  // this so the same screen (e.g. Notes) returns to whatever opened it.
  window.backHash = function (fallback) { return window.__backHash || fallback || "#menu"; };

  // Delegate clicks on any element with data-go="…" to window.go.
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-go]");
    if (!el) return;
    const target = el.dataset.go;
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    window.go(target);
  });

  /* ---------- UI tap sound ----------
     A soft classical "tick" on every button so taps feel responsive.
     Nav / bottom-bar buttons get a lower, paper-turn note; other buttons
     a brighter blip. One shared AudioContext, fixed low volume. */
  const UISound = (function () {
    let ctx = null;
    function ac() { try { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} return ctx; }
    function tick(kind) {
      const c = ac(); if (!c) return;
      try { if (c.state === "suspended") c.resume(); } catch (_) {}
      const now = c.currentTime;
      // A light, glassy little chime instead of the old laser-y blip: pure
      // sine partials (fundamental + soft octave + faint upper sparkle), no
      // pitch glide, rounded by a gentle low-pass so it stays soft and airy.
      const base = kind === "nav" ? 784 : 1175;        // nav G5 · button D6
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(5000, now);
      filter.Q.value = 0.4;
      filter.connect(c.destination);
      // [harmonic, peak gain, decay seconds] — higher partials fade quicker,
      // the way a real little bell rings.
      const partials = kind === "nav"
        ? [[1, 0.10, 0.26], [2, 0.045, 0.18], [3, 0.018, 0.10]]
        : [[1, 0.095, 0.24], [2, 0.05, 0.17], [3, 0.022, 0.11], [4, 0.012, 0.07]];
      partials.forEach(([mult, amp, dur]) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(base * mult, now);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(amp, now + 0.010);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        o.connect(g).connect(filter);
        o.start(now); o.stop(now + dur + 0.03);
      });
    }
    return { tick };
  })();
  window.UISound = UISound;
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button, .menu-btn");
    if (!btn) return;
    if (btn.disabled || btn.classList.contains("is-disabled")) return;
    if (e.target.closest("input, .rc-vol, .bgm-vol")) return;   // not the sliders
    const isNav = !!btn.closest(".ui-bottom-nav, .page-bottom-nav, .reading-controls");
    UISound.tick(isNav ? "nav" : "btn");
  }, true);


  /* ---------- URL param helper (legacy) ---------- */
  window.qparam = function (key, fallback) {
    const { params } = parseHash();
    return params[key] ?? fallback;
  };

  /* ---------- global BGM widget wiring ---------- */
  // The slider + skip button live outside #stage and persist across
  // every view (except splash, which hides them via CSS). Wire them
  // up once on DOMContentLoaded. Volume input fires `input` events
  // during drag; we forward each to BGM.setVolume immediately so
  // the music tracks the finger.
  document.addEventListener("DOMContentLoaded", () => {
    const slider = document.querySelector(".bgm-vol");
    const skip   = document.querySelector(".bgm-skip");
    if (slider && window.BGM && BGM.getVolume) {
      slider.value = Math.round(BGM.getVolume() * 100);
      slider.addEventListener("input", () => {
        BGM.setVolume((+slider.value) / 100);
      });
    }
    if (skip && window.BGM && BGM.nextTrack) {
      skip.addEventListener("click", () => {
        BGM.nextTrack();
      });
    }
  });


  /* ---------- ornate panel press flash ---------- */
  document.addEventListener("click", (e) => {
    const el = e.target.closest(".ornate-panel.is-clickable");
    if (!el) return;
    el.classList.remove("is-pressed");
    void el.offsetWidth;
    el.classList.add("is-pressed");
    setTimeout(() => el.classList.remove("is-pressed"), 460);
  });

  /* ---------- toast helper ---------- */
  window.toast = function (msg) {
    const page = document.querySelector(".stage .page");
    if (!page) return;
    let el = page.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      page.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("is-show"), 1600);
  };

})();
