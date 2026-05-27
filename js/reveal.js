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

  /* TTS — Web Speech API. Follow the user's OS system voice.

     v.default is the only flag the API gives us that mirrors the
     user's Spoken-Content choice in OS settings (Ava, Samantha, …);
     prefer it first. After that, match any voice whose name contains
     "Ava" (Apple ships variants like "Ava", "Ava (Enhanced)",
     "Ava (Premium)", "Ava Multilingual" — exact strings differ by OS
     version, so substring-match instead of equality). The remaining
     fallbacks explicitly exclude Daniel: the previous "first en-*
     voice" fallback landed on Daniel (en-GB) on iPad whenever the
     Ava match missed, which is exactly the bug we're fixing.

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
            voices.find(v => v.default && /^en/i.test(v.lang))
         || voices.find(v => /ava/i.test(v.name))
         || voices.find(v => v.default)
         || voices.find(v => /^en-us/i.test(v.lang) && !/daniel/i.test(v.name))
         || voices.find(v => /^en/i.test(v.lang)    && !/daniel/i.test(v.name))
         || null;
      return pickedVoice;
    } catch (_) { return null; }
  }
  // Voices may be loaded asynchronously on iPad / Chrome. Re-pick
  // when the voiceschanged event fires.
  if (window.speechSynthesis && typeof window.speechSynthesis.onvoiceschanged !== "undefined") {
    window.speechSynthesis.onvoiceschanged = () => { pickedVoice = null; pickVoice(); };
  }

  let speakToken = 0;

  function speak(text) {
    if (!text) return;
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      ++speakToken;

      // Why the punctuation rewrite:
      //   - 1128fb9 (single utterance, no chunking): first sentence
      //     Ava ✓, then iOS switched to Daniel at the period.
      //   - 7c2946f (chunked, queued same-tick): first sentence Ava ✓,
      //     rest fell back to default because iOS drops voice on
      //     queued utterances after the first.
      //   - ce8fa64 (chunked, chained via onend): EVEN the first
      //     sentence went male — setting u.onend before synth.speak
      //     seems to flip iOS into 'this is part of a series' mode,
      //     and voice on the first utterance is dropped too.
      // The only configuration that reliably plays in Ava is: ONE
      // utterance, no onend handler, voice set inline. So we keep
      // it single-utterance and prevent the mid-utterance voice
      // switch by demoting sentence punctuation to commas — iOS
      // doesn't see a sentence boundary and doesn't switch voices.
      // Intonation becomes mildly run-on but stays in Ava throughout.
      const massaged = String(text)
        .replace(/([.!?])(?=\s|$)/g, ",")
        .replace(/,+\s*$/, "");

      const u = new SpeechSynthesisUtterance(massaged);
      const v = pickVoice();
      // Set lang to follow the picked voice — forcing en-US while
      // the chosen voice is en-GB makes iOS substitute a different
      // (often mechanical) voice mid-utterance.
      u.lang  = (v && v.lang) || "en-US";
      u.rate  = 0.96;
      u.pitch = 1.0;
      if (v) u.voice = v;
      synth.speak(u);
    } catch (_) { /* swallow */ }
  }

  return { init, revealNext, revealAll, speak };
})();
