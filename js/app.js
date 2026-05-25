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

  // ----- Tiny navigation helper -----
  window.go = function (href) { window.location.href = href; };

  // ----- URL param helper -----
  window.qparam = function (key, fallback) {
    const u = new URL(window.location.href);
    return u.searchParams.get(key) ?? fallback;
  };

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
