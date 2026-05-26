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

  // ----- Navigation helper with a 220-380ms transition effect -----
  // Pages that land on the reading view get a brief book-page-flip
  // effect (rotateY) + a synthesised paper-flip whisper via Web Audio.
  // Every other navigation gets a quick fade so the jump never feels
  // like a hard browser reload.
  function playFlipSound() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const now = ctx.currentTime;
      // Brown-noise burst shaped by an exponential decay = paper rustle.
      const dur = 0.34;
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.018 * white) / 1.018;
        const env = Math.exp(-i / data.length * 6);
        data[i] = last * env * 1.6;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 0.42;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 800;
      src.connect(hp).connect(g).connect(ctx.destination);
      src.start(now);
      setTimeout(() => { try { ctx.close(); } catch(_){} }, 800);
    } catch (_) { /* swallow */ }
  }

  function fadeOut(cb) {
    const s = document.querySelector(".stage");
    if (!s) return cb();
    s.classList.add("is-leaving");
    setTimeout(cb, 220);
  }
  function pageFlip(cb) {
    const s = document.querySelector(".stage");
    if (!s) return cb();
    s.classList.add("is-flipping");
    playFlipSound();
    setTimeout(cb, 380);
  }
  window.go = function (href) {
    if (!href) return;
    const isReading = /^reading\.html/.test(href);
    const jump = () => { window.location.href = href; };
    if (isReading) pageFlip(jump);
    else           fadeOut(jump);
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
          // Only override if the existing handler navigates somewhere
          // we don't want; we always send Menu home.
          e.preventDefault(); e.stopPropagation();
          window.go("index.html");
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
