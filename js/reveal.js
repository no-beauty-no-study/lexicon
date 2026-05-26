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
    if (!b.querySelector(".ink-ripple")) {
      const r = document.createElement("span");
      r.className = "ink-ripple";
      b.appendChild(r);
    }
    playAudio(b.dataset.audio, b.textContent);
    if (onReveal) onReveal(b, index);
  }

  function revealAll() {
    while (index + 1 < blocks.length) {
      index += 1;
      blocks[index].classList.add("is-revealed");
    }
  }

  function playAudio(src, fallbackText) {
    if (currentAudio) { try { currentAudio.pause(); } catch(_){} currentAudio = null; }
    if (src) {
      try {
        const a = new Audio(src);
        a.addEventListener("error", () => speak(fallbackText));
        const p = a.play();
        if (p && typeof p.catch === "function") {
          p.catch(() => speak(fallbackText));
        }
        currentAudio = a;
        return;
      } catch (_) { /* fall through to TTS */ }
    }
    speak(fallbackText);
  }

  /* TTS fallback / proactive narration. Uses Web Speech API with an
     English voice if one is available; silent if the API is missing.
     Cancels any in-flight utterance so successive taps don't pile up. */
  function speak(text) {
    if (!text) return;
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      u.rate = 0.96;
      u.pitch = 1.0;
      const voices = synth.getVoices();
      const en = voices.find(v => /^en[-_]/i.test(v.lang) && /Google|Samantha|Karen|Daniel|Microsoft/i.test(v.name))
              || voices.find(v => /^en[-_]/i.test(v.lang));
      if (en) u.voice = en;
      synth.speak(u);
    } catch (_) { /* swallow */ }
  }

  return { init, revealNext, revealAll, speak };
})();
