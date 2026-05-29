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

    // Page-turn: keep the OUTGOING page beneath and let the new page
    // "unfurl" over it from the bottom-right corner (clip-path diagonal
    // reveal + a light-edge sweep) — like turning to the next leaf of a
    // book. New page is inserted FIRST in the DOM (so helpers that do
    // querySelector('.stage .page') resolve to it) but painted ON TOP
    // via z-index, with the old page at a lower z below it.
    if (prev) {
      prev.classList.add("page-beneath");
      prev.style.pointerEvents = "none";
      node.classList.add("page-turning-in");
      stage.insertBefore(node, prev);

      const edge = document.createElement("div");
      edge.className = "page-turn-edge";
      stage.appendChild(edge);

      const dying = prev;
      setTimeout(() => { try { dying.remove(); } catch (_) {} }, 660);
      setTimeout(() => { try { edge.remove();  } catch (_) {} }, 660);
    } else {
      stage.appendChild(node);
    }

    const view = Views[name];
    try {
      if (view && typeof view.init === "function") view.init(node, params);
    } catch (err) {
      try { console.error("[Views." + name + "] init failed:", err); } catch (_) {}
    }

    fitStage();
    requestAnimationFrame(fitStage);

    if (window.BGM && BGM.applyForView) BGM.applyForView(name, params);

    if (params.debug === "1") document.body.classList.add("debug-ui");
    else                      document.body.classList.remove("debug-ui");
  }

  window.addEventListener("hashchange", render);
  document.addEventListener("DOMContentLoaded", () => {
    // Setting the hash from "" to "#splash" fires hashchange, which
    // calls render() for us. If a hash is already present (e.g. the
    // user landed on #reading?chapter=X), call render directly.
    if (!location.hash) location.hash = "#splash";
    else                render();
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
