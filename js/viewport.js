/* ============================================================
   The Princess Lexicon — viewport.js
   Fixed-app behaviour for tablets / phones:
     - Locks pinch-zoom and double-tap zoom (iPad Safari ignores
       maximum-scale unless we kill the gestures explicitly).
     - Computes the exact .page → .stage scale factor on every
       resize / orientation change so the 1448×1086 design fits
       the viewport without letterboxing distortion.
   The CSS in layout.css provides a usable fallback scale via
   calc(min(100vw, 100dvh * 4 / 3) / 1448); this script just
   tightens it to the actual stage box dimensions at runtime.
   ============================================================ */
(function () {
  // CONTAIN with TOP/BOTTOM-only bleed crop. Stage aspect 1448 /
  // 1068.62 (= 1.355) carries the page WIDTH intact and trims 0.8%
  // of bleed off the top and bottom (~8.69 px design each side).
  // The painted frame line at ~1.1% from each edge stays fully
  // visible. Side letterbox (when viewport > 1.355 aspect) is the
  // body's parchment colour and matches the painted bleed.
  const BLEED_TOP = 8.69;   // 0.8% × 1086, design px
  function fitStage() {
    const stage = document.querySelector(".stage");
    const page  = document.querySelector(".stage .page");
    if (!stage || !page) return;
    const sw = stage.clientWidth;
    if (!sw || sw < 200) {
      requestAnimationFrame(fitStage);
      return;
    }
    const scale = sw / 1448;
    // Translate the page UP by BLEED_TOP × scale so the cropped
    // strip is split equally top/bottom. Stage height is
    // 1068.62 × scale; page height is 1086 × scale, so the extra
    // 17.38 × scale overflows — 8.69 above the stage, 8.69 below.
    const offY = -BLEED_TOP * scale;
    page.style.transformOrigin = "top left";
    page.style.transform =
      `translate(0px, ${offY.toFixed(3)}px) scale(${scale.toFixed(6)})`;
    page.style.setProperty("--page-scale", scale.toFixed(6));
  }

  function init() {
    fitStage();
    window.addEventListener("resize", fitStage, { passive: true });
    window.addEventListener("orientationchange", fitStage, { passive: true });
    // visualViewport on iOS triggers when the URL bar shows / hides.
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", fitStage, { passive: true });
    }

    // Block iOS gesture zoom — viewport meta alone isn't enough on
    // iPad Safari. These four listeners cancel every pinch / spread
    // before Safari interprets it as a page-zoom.
    const block = (e) => e.preventDefault();
    document.addEventListener("gesturestart",  block);
    document.addEventListener("gesturechange", block);
    document.addEventListener("gestureend",    block);
    document.addEventListener("touchmove", (e) => {
      if (e.scale && e.scale !== 1) e.preventDefault();
    }, { passive: false });

    // Block double-tap zoom (Safari treats two taps inside 350ms as
    // a zoom request). Re-dispatch as a single click so buttons keep
    // working.
    let lastTap = 0;
    document.addEventListener("touchend", (e) => {
      const now = Date.now();
      if (now - lastTap < 350) e.preventDefault();
      lastTap = now;
    }, { passive: false });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
