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
  // Crop a thin 1% bleed ring on each side (= effective area
  // 1419×1064, aspect still ≈ 4:3). That's tight enough to leave
  // every painted frame line intact — the closest hand-drawn
  // frame sits ~1.1% from the page edge — but loud enough to
  // remove the obviously-blank parchment border that made the
  // page feel like a thumbnail. The cropped pixels overflow the
  // stage and overflow:hidden hides them; the body bg matches
  // the bleed colour (#e2d1bb) so the missing strip reads as
  // continuation, not as a separate gray bar.
  const BLEED_PCT = 0.01;                  // 1% per side
  const BLEED_X   = 1448 * BLEED_PCT;      // 14.48 px
  const BLEED_Y   = 1086 * BLEED_PCT;      // 10.86 px
  const EFF_W     = 1448 - 2 * BLEED_X;    // 1419.04
  // const EFF_H  = 1086 - 2 * BLEED_Y;    // 1064.28

  function fitStage() {
    const stage = document.querySelector(".stage");
    const page  = document.querySelector(".stage .page");
    if (!stage || !page) return;
    const sw = stage.clientWidth;
    if (!sw) return;
    // Scale so the EFFECTIVE area (page minus 1% bleed each side)
    // fills the stage width. The full page therefore overflows
    // by 1% on every side, which the stage's overflow:hidden hides.
    const scale = sw / EFF_W;
    const offX  = -BLEED_X * scale;
    const offY  = -BLEED_Y * scale;
    page.style.transformOrigin = "top left";
    page.style.transform =
      `translate(${offX.toFixed(3)}px, ${offY.toFixed(3)}px) scale(${scale.toFixed(6)})`;
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
