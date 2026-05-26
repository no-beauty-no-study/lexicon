/* ============================================================
   The Princess Lexicon — reveal.js
   Invisible-ink reveal effect with optional per-block audio.

   Setup:
     Reveal.init({
       container: ".reading-body",       // wraps all .reveal-block children
       overlaySelector: ".tap-overlay",  // tap-to-begin overlay element
       onReveal: (block, index) => {},   // optional callback per reveal
     });

   Rules:
     - Browsers block autoplay until first user gesture, so a "Tap to
       begin" overlay collects the gesture, then we reveal the first
       block + start its audio.
     - Each block reveals on subsequent clicks anywhere in the container.
     - data-audio="path/to.mp3" attribute on a .reveal-block plays it.
     - Missing audio files are swallowed silently (per spec).
   ============================================================ */
const Reveal = (function () {

  let blocks = [];
  let index  = -1;          // index of last-revealed block
  let onReveal = null;
  let currentAudio = null;

  function init(opts) {
    const container = document.querySelector(opts.container);
    const overlay   = document.querySelector(opts.overlaySelector || ".tap-overlay");
    if (!container) return;
    onReveal = opts.onReveal || null;

    blocks = Array.from(container.querySelectorAll(".reveal-block"));
    if (blocks.length === 0) return;

    // Overlay dismisses on first tap; reveal block 0 + start audio.
    const dismiss = () => {
      if (overlay) overlay.classList.add("is-gone");
      revealNext();
    };
    if (overlay) overlay.addEventListener("click", dismiss, { once: true });

    // Subsequent clicks anywhere inside the container reveal next block,
    // unless the click was on a clickable element (button, link, word).
    container.addEventListener("click", e => {
      if (overlay && !overlay.classList.contains("is-gone")) return;
      // Don't intercept clicks on interactive children.
      if (e.target.closest("button, a, .clickable-word, .side-note-button")) return;
      revealNext();
    });
  }

  function revealNext() {
    if (index + 1 >= blocks.length) return;
    index += 1;
    const b = blocks[index];
    b.classList.add("is-revealed");
    // Ensure ripple element exists (purely decorative).
    if (!b.querySelector(".ink-ripple")) {
      const r = document.createElement("span");
      r.className = "ink-ripple";
      b.appendChild(r);
    }
    playAudio(b.dataset.audio);
    if (onReveal) onReveal(b, index);
  }

  function revealAll() {
    while (index + 1 < blocks.length) {
      index += 1;
      blocks[index].classList.add("is-revealed");
    }
  }

  function playAudio(src) {
    if (!src) return;
    try {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
      }
      const a = new Audio(src);
      a.addEventListener("error", () => { /* missing file — swallow */ });
      const p = a.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => { /* autoplay block or missing — swallow */ });
      }
      currentAudio = a;
    } catch (_) { /* swallow */ }
  }

  return { init, revealNext, revealAll };
})();
