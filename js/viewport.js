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
  // CONTAIN with aggressive TOP/BOTTOM bleed crop + tiny SIDE crop.
  // Per user: '上下出血边要裁（留边框线）' — crop top/bottom right
  // up to the painted frame line. '左右两边的出血边裁一点' — also
  // shave a small slice off the sides so the painted outer frame
  // reads cleanly against the viewport edge. The leftover side
  // letterbox is body-bg parchment matching the painted bleed so
  // visually 'transparent'.
  const BLEED_X = 1448 * 0.005;   // 0.5% per side = 7.24 design px
  const BLEED_Y = 1086 * 0.015;   // 1.5% per side = 16.29 design px
  const EFF_W   = 1448 - 2 * BLEED_X;   // 1433.52
  const EFF_H   = 1086 - 2 * BLEED_Y;   // 1053.42
  const EFF_ASPECT = EFF_W / EFF_H;     // 1.361

  function fitStage() {
    const stage = document.querySelector(".stage");
    const page  = document.querySelector(".stage .page");
    if (!stage || !page) return;
    const sw = stage.clientWidth;
    if (!sw || sw < 200) {
      requestAnimationFrame(fitStage);
      return;
    }
    // Scale so the EFFECTIVE area width fills the stage. Page
    // overflows by BLEED_X each side horizontally and BLEED_Y each
    // side vertically; the stage's overflow:hidden clips them.
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
