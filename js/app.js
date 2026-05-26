/* ============================================================
   The Princess Lexicon — app.js
   Tiny shared utilities: page scaling, nav helpers, URL params.
   ============================================================ */

(function () {
  const STAGE_W = 1448;
  const STAGE_H = 1086;

  // Scale the .page stage to fit the viewport while keeping aspect ratio.
  function fitStage() {
    const stage = document.querySelector(".stage");
    const page  = document.querySelector(".stage .page");
    if (!stage || !page) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(vw / STAGE_W, vh / STAGE_H);
    page.style.setProperty("--page-scale", scale.toFixed(4));
    stage.setAttribute("data-scale", "1");
  }

  // Run after DOM is parsed, no need to wait for full load.
  document.addEventListener("DOMContentLoaded", fitStage);
  window.addEventListener("resize", fitStage);

  // ----- Debug UI toggle (?debug=1) — paints .ui-zone outlines so
  // we can verify every zone aligns with its painted slot before
  // pouring text into it. -----
  document.addEventListener("DOMContentLoaded", () => {
    const u = new URL(window.location.href);
    if (u.searchParams.get("debug") === "1") {
      document.body.classList.add("debug-ui");
    }
  });

  // ----- Navigation: page fade + BGM cross-fade -----
  // User wants the music to feel continuous across the menu →
  // select → save / load arc. We crossfade by fading the current
  // page's audio to zero in lockstep with the visual fade-out;
  // the next page's bgm.js will fade audio IN from 0 → target.
  function fadeOut(cb) {
    const s = document.querySelector(".stage");
    if (s) s.classList.add("is-leaving");
    if (window.BGM && typeof window.BGM.fadeOut === "function") {
      window.BGM.fadeOut(220);
    }
    setTimeout(cb || (() => {}), 230);
  }
  window.go = function (href) {
    if (!href) return;
    fadeOut(() => { window.location.href = href; });
  };
  // Make MENU consistent regardless of which page wires it: a button
  // whose label or data attribute says 'menu' always lands on
  // index.html, never on history.back(), never on a previous-page
  // (which would let the browser X / system back take over).
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("button,a").forEach(el => {
      const txt = (el.textContent || "").trim().toLowerCase();
      if (/^.{0,2}\bmenu\b.{0,2}$/.test(txt) && !el.dataset.menuFixed) {
        el.dataset.menuFixed = "1";
        el.addEventListener("click", (e) => {
          e.preventDefault(); e.stopPropagation();
          window.go("menu.html");
        });
      }
    });
  });

  // ----- URL param helper -----
  window.qparam = function (key, fallback) {
    const u = new URL(window.location.href);
    return u.searchParams.get(key) ?? fallback;
  };

  // ----- Press-flash effect on any clickable ornate-panel -----
  document.addEventListener("click", e => {
    const el = e.target.closest(".ornate-panel.is-clickable");
    if (!el) return;
    el.classList.remove("is-pressed");
    // restart animation
    void el.offsetWidth;
    el.classList.add("is-pressed");
    setTimeout(() => el.classList.remove("is-pressed"), 460);
  });

  // ----- Toast helper (requires <div class="toast"> in page) -----
  window.toast = function (msg) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      document.querySelector(".page").appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("is-show"), 1600);
  };
})();
