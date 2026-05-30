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

    // Push transition with direction inferred from prev→next view:
    //   reading ↔ quiz, quiz → next reading  → LEFT (turning a page
    //                                          in the book)
    //   everything else                       → UP (opening the book
    //                                          cover, lifting a panel)
    // body.dataset.currentView still holds the OUTGOING view name at
    // this point (it gets overwritten further down), so it doubles
    // as the "previous view" reference.
    const READING_FLOW = { reading: 1, quiz: 1 };
    const prevName = document.body.dataset.currentView || "";
    const dir = (READING_FLOW[prevName] && READING_FLOW[name]) ? "left" : "up";
    if (prev) {
      prev.classList.add("page-leaving", "leave-" + dir);
      prev.style.pointerEvents = "none";
      node.classList.add("page-entering", "enter-" + dir);
      stage.appendChild(node);

      // Two animation frames before adding .page-active so the
      // browser has actually painted the .page-entering initial
      // state — without this double-rAF, the transition can be
      // skipped (the element jumps straight to its end state).
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          node.classList.remove("page-entering");
          node.classList.add("page-active");
        });
      });

      const dying = prev;
      // Match the 950ms slide so the leaving page isn't yanked out
      // mid-animation. +50ms grace.
      setTimeout(() => { try { dying.remove(); } catch (_) {} }, 1000);
    } else {
      stage.appendChild(node);
      // First paint after splash: still soft-fade-in instead of
      // popping. Same two-rAF trick.
      node.classList.add("page-entering");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          node.classList.remove("page-entering");
          node.classList.add("page-active");
        });
      });
    }

    const view = Views[name];
    try {
      if (view && typeof view.init === "function") view.init(node, params);
    } catch (err) {
      try { console.error("[Views." + name + "] init failed:", err); } catch (_) {}
    }

    fitStage();
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
