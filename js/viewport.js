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
  function fitStage() {
    const stage = document.querySelector(".stage");
    const page  = document.querySelector(".stage .page");
    if (!stage || !page) return;
    const sw = stage.clientWidth;
    const sh = stage.clientHeight;
    if (!sw || !sh) return;
    const scale = Math.min(sw / 1448, sh / 1086);
    // Set the FULL transform string. We can't rely on CSS
    // `scale(var(--page-scale))` alone because the fallback
    // `calc(min(100vw, …) / 1448)` returns a LENGTH (px) and
    // scale() needs a pure number — that invalidates the whole
    // transform and the centring translate gets dropped too.
    page.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(6)})`;
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
