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
  // ASYMMETRIC bleed crop per user spec: top/bottom can crop right
  // up to the painted frame line, but sides must stay safe (some
  // reading pages have a princess intentionally stepping past the
  // frame on the side). Programmatic frame-line scan minimum:
  //   chapters top/bottom: 0.83% — so safe TB crop is ~0.7%.
  //   chapters right    : 0.69% — so safe LR crop is ~0.2%.
  const BLEED_X_PCT = 0.002;               // 0.2% per side
  const BLEED_Y_PCT = 0.008;               // 0.8% per side
  const BLEED_X = 1448 * BLEED_X_PCT;      //  2.90 px
  const BLEED_Y = 1086 * BLEED_Y_PCT;      //  8.69 px
  const EFF_W   = 1448 - 2 * BLEED_X;      // 1442.20
  // const EFF_H = 1086 - 2 * BLEED_Y;     // 1068.62

  function fitStage() {
    const stage = document.querySelector(".stage");
    const page  = document.querySelector(".stage .page");
    if (!stage || !page) return;
    const sw = stage.clientWidth;
    // Defensive: when the browser navigates between pages, the
    // stage's layout box can briefly read as 0 (or a tiny intrinsic
    // size) before CSS settles. If that happens we'd scale the
    // 1448 px page by some bogus factor — usually scaling it WAY
    // too big — which is the 'select page suddenly looks huge' bug.
    // Defer and retry on the next frame until the stage measures
    // sensibly.
    if (!sw || sw < 200) {
      requestAnimationFrame(fitStage);
      return;
    }
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
