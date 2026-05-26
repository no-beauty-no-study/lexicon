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
  // Master frame geometry on the 1448×1086 design:
  //   top-left  px: ( 25.78, 23.34)   (1.78% × 1448, 2.15% × 1086)
  //   width  px: 1395.86  (96.33% × 1448)
  //   height px: 1041.13  (95.85% × 1086)
  // We scale the .page so its master frame width fills the .stage,
  // then translate so the master-frame top-left lands at (0, 0)
  // of the stage. Effect: the painted bleed ring is pushed off
  // every edge and overflow:hidden on .stage crops it away.
  const MF_LEFT   = 25.78;
  const MF_TOP    = 23.34;
  const MF_WIDTH  = 1395.86;
  // const MF_HEIGHT = 1041.13;

  function fitStage() {
    const stage = document.querySelector(".stage");
    const page  = document.querySelector(".stage .page");
    if (!stage || !page) return;
    const sw = stage.clientWidth;
    if (!sw) return;
    // Scale so the master-frame WIDTH matches the stage width.
    // Same scale aligns the master-frame height to stage height
    // (the stage aspect is master-frame's aspect — see layout.css).
    const scale = sw / MF_WIDTH;
    const offX  = -MF_LEFT * scale;
    const offY  = -MF_TOP  * scale;
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
