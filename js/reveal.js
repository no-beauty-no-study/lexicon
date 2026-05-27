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
    const overlay   = opts.overlaySelector
                      ? document.querySelector(opts.overlaySelector)
                      : null;
    if (!container) return;
    onReveal = opts.onReveal || null;

    blocks = Array.from(container.querySelectorAll(".reveal-block"));
    if (blocks.length === 0) return;

    // Legacy overlay path (if a tap-overlay element exists) — dismiss
    // on first tap and reveal block 0.
    if (overlay) {
      const dismiss = () => {
        overlay.classList.add("is-gone");
        revealNext();
      };
      overlay.addEventListener("click", dismiss, { once: true });
    }

    // Any tap anywhere in the container reveals the next block
    // (provided the overlay is gone, or never existed). Interactive
    // children — buttons, links, clickable words — are NOT treated
    // as a reveal-tap so the user can interact with them normally.
    container.addEventListener("click", e => {
      if (overlay && !overlay.classList.contains("is-gone")) return;
      if (e.target.closest("button, a, .clickable-word, .side-note-button," +
                           " .marginalia-card, .word-card, input, select, textarea")) return;
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
    // Notify the page BEFORE we read — that's the caller's chance to
    // set data-speak-text on the block (e.g. prepend the chapter
    // title to the first sentence so the narrator opens with the
    // chapter heading instead of dropping the user into the middle
    // of paragraph one).
    if (onReveal) onReveal(b, index);
    const speakText = b.dataset.speakText || b.textContent;
    playAudio(b.dataset.audio, speakText);
  }

  function revealAll() {
    while (index + 1 < blocks.length) {
      index += 1;
      blocks[index].classList.add("is-revealed");
    }
  }

  function playAudio(src, fallbackText) {
    if (currentAudio) { try { currentAudio.pause(); } catch(_){} currentAudio = null; }
    // We have no real mp3 files yet. iOS Safari requires speech-
    // Synthesis.speak() to fire INSIDE the user-gesture call stack;
    // if we wait for an Audio promise to reject we lose that context
    // and TTS goes silent. So go to TTS directly. When real mp3
    // files land later, swap in the Audio code path above this
    // line and the speak() becomes a graceful fallback.
    speak(fallbackText);
  }

  /* TTS — Web Speech API. AVA ONLY.

     User testing on iPad Safari nailed it down: whatever male voice
     we try to set, iOS plays the FIRST utterance in Ava (the system
     default) anyway because of the cancel-then-speak voice-drop bug,
     then SUBSEQUENT utterances use Daniel Compact (mechanical). The
     pattern is unfixable from JS — iOS just refuses to use our
     requested male voice cleanly.

     Ava IS natural on this device (the user confirmed 'Ava仿人音'),
     so the simplest working fix is: stop fighting, use Ava.
     pickVoice prefers 'Ava (Enhanced)' > 'Ava (Premium)' > 'Ava' >
     any English voice. Daniel + the male fallback list are gone.

     Property order on the utterance still matters: u.lang FIRST,
     u.voice LAST (reversing it silently clears voice on iOS). */
  let pickedVoice = null;

  function pickVoice() {
    if (pickedVoice) return pickedVoice;
    try {
      const synth = window.speechSynthesis;
      if (!synth) return null;
      const voices = synth.getVoices();
      if (!voices.length) return null;
      pickedVoice =
            voices.find(v => v.name === "Ava (Enhanced)")
         || voices.find(v => v.name === "Ava (Premium)")
         || voices.find(v => v.name === "Ava")
         || voices.find(v => /^en[-_]/i.test(v.lang))
         || null;
      return pickedVoice;
    } catch (_) { return null; }
  }
  // Voices may be loaded asynchronously on iPad / Chrome. Re-pick
  // when the voiceschanged event fires.
  if (window.speechSynthesis && typeof window.speechSynthesis.onvoiceschanged !== "undefined") {
    window.speechSynthesis.onvoiceschanged = () => { pickedVoice = null; pickVoice(); };
  }

  function speak(text) {
    if (!text) return;
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const v = pickVoice();
      // ONE UTTERANCE PER SENTENCE, all queued same-tick. iOS Safari
      // switches voice across sentence boundaries inside ONE utterance
      // (Ava → Daniel after the first period). Splitting on sentence
      // punctuation and re-asserting voice=Ava on every chunk forces
      // iOS to honour Ava end-to-end. No onend chaining, no delay
      // gaps — those made earlier attempts sound choppy / ghost-like.
      const sentences = (String(text).match(/[^.!?。！？]+[.!?。！？]?\s*/g) || [text])
        .map(s => s.trim())
        .filter(Boolean);
      for (const s of sentences) {
        const u = new SpeechSynthesisUtterance(s);
        u.lang  = "en-US";
        u.rate  = 0.96;
        u.pitch = 1.0;
        if (v) u.voice = v;
        synth.speak(u);
      }
    } catch (_) { /* swallow */ }
  }

  return { init, revealNext, revealAll, speak };
})();
