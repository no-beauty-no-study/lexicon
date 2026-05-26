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

  /* TTS — Web Speech API. PER USER SPEC:
       reading page  → female voice 'Ava' (iOS Voices > English)
       quiz page     → male voice 'Daniel' (kept around for quiz)
     We expose Reveal.speak(text, opts) so callers can override the
     voice family explicitly, but auto-detection uses the data-page
     attribute on .page to pick a sensible default. */
  const FEMALE_RE = /(Ava|Samantha|Karen|Victoria|Allison|Susan|Catherine|Serena|Moira|Tessa|Fiona)/i;
  const MALE_RE   = /(Daniel|Alex|Tom|Aaron|Fred|Oliver|Reed|Rocko|Eddy|Grandpa|David|Mark|Lee|James|George|Ryan)/i;

  /* Re-pick on every call — NO cache. The user reported 'first
     sentence = Ava, subsequent = robotic'; root cause is the known
     iOS Safari bug where speechSynthesis.cancel() followed
     IMMEDIATELY by speak() drops the requested voice and the next
     utterance plays in the system default voice. Workaround:
       (a) re-pick the voice each call so even if iOS forgets, we
           re-assert.
       (b) wait one tick after cancel() before calling speak() —
           gives iOS time to settle.
       (c) set both voice and voiceURI (iOS sometimes only honours
           one of them). */
  function pickVoice(prefer) {
    const key = (prefer === "male") ? "male" : "female";
    try {
      const synth = window.speechSynthesis;
      if (!synth) return null;
      const voices = synth.getVoices();
      if (!voices.length) return null;
      const re = (key === "male") ? MALE_RE : FEMALE_RE;
      return voices.find(x => /^en[-_]/i.test(x.lang) && re.test(x.name))
          || voices.find(x => re.test(x.name))
          || voices.find(x => /^en[-_]/i.test(x.lang))
          || voices[0];
    } catch (_) { return null; }
  }

  let defaultGender = "female";
  function detectDefaultGender() {
    const dp = document.querySelector(".page")?.dataset?.page;
    defaultGender = (dp === "quiz") ? "male" : "female";
  }
  detectDefaultGender();

  // Prime the voices list early (iOS loads voices async).
  if (window.speechSynthesis && typeof window.speechSynthesis.onvoiceschanged !== "undefined") {
    window.speechSynthesis.onvoiceschanged = () => { pickVoice(defaultGender); };
  }

  function speak(text, opts) {
    if (!text) return;
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      // STRATEGY: chunk text into sentences and queue ONE utterance
      // per sentence, each with the voice EXPLICITLY set. iOS Safari
      // sometimes loses the voice setting after the first utterance
      // in a long single-utterance call — chunking sidesteps that
      // by re-asserting the voice for every sentence. Don't call
      // synth.cancel() (it also drops the voice setting).
      if (synth.paused) synth.resume();
      const gender = (opts && opts.gender) || defaultGender;
      const v = pickVoice(gender);
      // Split on sentence boundaries; keep punctuation with the
      // chunk for natural cadence. Fallback to whole string if
      // splitting yielded nothing.
      const chunks = (text.match(/[^.!?。！？]+[.!?。！？]?\s*/g) || [text])
                     .map(s => s.trim())
                     .filter(Boolean);
      for (const chunk of chunks) {
        const u = new SpeechSynthesisUtterance(chunk);
        u.lang  = "en-US";
        u.rate  = 0.96;
        u.pitch = 1.0;
        if (v) {
          u.voice = v;
          if (v.voiceURI) u.voiceURI = v.voiceURI;
        }
        synth.speak(u);
      }
    } catch (_) { /* swallow */ }
  }

  /* Pre-warm the voice with a silent utterance once voices load.
     On iOS Safari the first real utterance triggers voice loading;
     during that load the second utterance can fall back to system
     default. Burning the load on a 0-volume utterance eliminates
     the race. */
  function warmUpVoice() {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      const v = pickVoice(defaultGender);
      if (!v) return;
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      u.rate = 1;
      u.voice = v;
      if (v.voiceURI) u.voiceURI = v.voiceURI;
      synth.speak(u);
    } catch (_) {}
  }
  // Run on the first user gesture (iOS needs that).
  ["touchstart","pointerdown","click"].forEach(ev =>
    document.addEventListener(ev, warmUpVoice, { passive: true, once: true }));

  /* Unlock speechSynthesis on first user gesture (iPad Safari needs
     a sacrificial utterance before any TTS will play in a session). */
  (function unlockTTSOnce() {
    function unlock() {
      document.removeEventListener("touchstart",  unlock);
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("click",       unlock);
      try {
        const synth = window.speechSynthesis;
        if (!synth) return;
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        synth.speak(u);
      } catch (_) {}
    }
    document.addEventListener("touchstart",  unlock, { once: true });
    document.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("click",       unlock, { once: true });
  })();

  return { init, revealNext, revealAll, speak };
})();
