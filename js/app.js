/* The Princess Lexicon — app.js
   SPA shell: hash router, viewport scaling, gesture locks, global
   nav helpers. The router clones <template id="view-X"> into #stage
   then calls Views.X.init(hostMain, params) for that view to wire
   up its own behaviour. */
(function () {

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
  let lastTap = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTap < 350) e.preventDefault();
    lastTap = now;
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
    const tDur    = "950ms";

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
    if (prev) {
      node.style.setProperty("--tx", enterTx);
      node.style.setProperty("--ty", enterTy);
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
      // OUTGOING — class marker for animation-play-state:paused on
      // children, plus inline transition + final --tx / --ty.
      prev.classList.add("page-leaving");
      prev.style.transition = `transform ${tDur} ${easing}, opacity 620ms ease-in`;
      prev.style.willChange = "transform, opacity";
      prev.style.setProperty("--tx", leaveTx);
      prev.style.setProperty("--ty", leaveTy);
      prev.style.opacity    = "0.6";
      prev.style.zIndex     = "1";
      prev.style.pointerEvents = "none";
      // Flush layout + paint of the now FULLY-BUILT incoming page while it
      // is still off-screen, so its layer is rasterised BEFORE the slide
      // begins (this is also the Safari read that stops the two style
      // mutations from batching and skipping the animation).
      void node.offsetHeight;
      requestAnimationFrame(() => {
        node.style.transition = `transform ${tDur} ${easing}, opacity 620ms ease-out`;
        node.style.setProperty("--tx", "0");
        node.style.setProperty("--ty", "0");
        node.style.opacity    = "1";
      });

      const dying = prev;
      setTimeout(() => { try { dying.remove(); } catch (_) {} }, 1000);
      // Release the compositor layer once the turn is done — otherwise every
      // reading page we land on keeps a will-change layer alive (each one
      // re-rasterising its blurred sentence spans), which piles up over a
      // long read and starves the NEXT turn. Clearing it lets the page fall
      // back to a normal layer until the next navigation re-promotes it.
      const settled = node;
      setTimeout(() => { try { settled.style.willChange = "auto"; } catch (_) {} }, 1050);
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
    if (location.hash === target) render();
    else                          location.hash = target;
  };

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
