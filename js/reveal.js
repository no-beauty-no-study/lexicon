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
       reading page  → female voice (prefer Ava / Samantha)
       quiz page     → male voice  (prefer Daniel / Alex)

     ROOT CAUSE OF THE OLD 'first sentence Ava, second sentence robot'
     BUG, finally pinned: iOS Safari has TWO interacting issues —

       (1) speechSynthesis.cancel() followed by speak() in the same
           JS tick silently drops the voice setting on the new
           utterance (it plays in system default).
       (2) Queueing multiple utterances back-to-back ALSO drops the
           voice on every utterance after the first — even when the
           voice is explicitly set on each one.

     The previous fix tried to dodge (1) by removing cancel() and
     chunking by sentence; that triggered (2) on every reading-block
     and ALSO on every word click ('word + 2 phrases'). The clean fix
     is: NO chunking, ONE utterance per speak() call, AND a 60 ms
     setTimeout after cancel() so iOS settles before the new
     utterance is constructed. Long paragraphs are fine in a single
     utterance — iOS does its own sentence break internally. */
  const FEMALE_RE = /(Ava|Samantha|Karen|Victoria|Allison|Susan|Catherine|Serena|Moira|Tessa|Fiona|Zoe)/i;
  const MALE_RE   = /(Daniel|Alex|Tom|Aaron|Fred|Oliver|Reed|Rocko|Eddy|Grandpa|David|Mark|Lee|James|George|Ryan)/i;
  /* Voices to AVOID — iOS bundles some 'novelty' / compact voices
     that sound robotic. If the regex above lands on one of these,
     we'd rather fall back to any other en-US voice. */
  const BAD_RE    = /(Eloquence|Compact|Trinoids|Bahh|Hysterical|Whisper|Cellos|Boing|Bubbles|Deranged|Bells|Bad News|Good News|Pipe Organ|Albert|Junior|Kathy|Princess|Ralph|Vicki|Zarvox)/i;

  function pickVoice(prefer) {
    const key = (prefer === "male") ? "male" : "female";
    try {
      const synth = window.speechSynthesis;
      if (!synth) return null;
      const voices = synth.getVoices();
      if (!voices.length) return null;
      const re = (key === "male") ? MALE_RE : FEMALE_RE;
      const isEn   = v => /^en[-_]/i.test(v.lang);
      const isGood = v => !BAD_RE.test(v.name);
      return voices.find(v => isEn(v) && re.test(v.name) && isGood(v))
          || voices.find(v =>          re.test(v.name) && isGood(v))
          || voices.find(v => isEn(v) && isGood(v))
          || voices.find(isEn)
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

  /* The complete iOS TTS workaround needs three things at once —
       (A) Each utterance must be ONE sentence — iOS drops to the
           system default voice mid-utterance once the text crosses a
           sentence boundary ('first sentence Ava, then robot').
       (B) The NEXT utterance must be queued ONLY after the previous
           one's 'end' event AND only when the synth is actually idle.
           Queueing multiple utterances up-front, or queuing while the
           synth is still draining, ALSO drops the voice.
       (C) cancel() leaves iOS Safari in a stuck 'paused' state; we
           must call resume() after every cancel or the next speak
           is silently dropped.
     So we chunk the text into sentences, walk through them via
     onend + an idle-poll, and resume() before/after each step. */
  let speakToken = 0;     // bumped on every new speak() call so a
                          // stale onend chain can be aborted.

  function speak(text, opts) {
    if (!text) return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    const gender = (opts && opts.gender) || defaultGender;
    const myToken = ++speakToken;

    try { synth.cancel(); } catch (_) {}
    try { synth.resume(); } catch (_) {}   // (C) wake from paused

    const chunks = (String(text).match(/[^.!?。！？]+[.!?。！？]?\s*/g) || [text])
                   .map(s => s.trim())
                   .filter(Boolean);
    if (!chunks.length) return;

    let i = 0;
    function speakOne() {
      if (myToken !== speakToken) return;             // superseded
      if (i >= chunks.length) return;
      // (B) Wait until synth is actually idle — onend can fire while
      //     the audio backend is still draining the previous chunk.
      if (synth.speaking || synth.pending) {
        setTimeout(speakOne, 80);
        return;
      }
      const chunk = chunks[i++];
      // Watchdog: onend doesn't always fire on iOS Safari (esp. for
      // enhanced voices). If it hasn't fired by the time the chunk
      // 'should' be done speaking, force-advance — but guard with a
      // flag so onend + watchdog can't double-advance.
      let advanced = false;
      const advance = () => {
        if (advanced || myToken !== speakToken) return;
        advanced = true;
        setTimeout(speakOne, 220);
      };
      try {
        const u = new SpeechSynthesisUtterance(chunk);
        u.lang   = "en-US";
        u.rate   = 0.96;
        u.pitch  = 1.0;
        u.volume = 1.0;
        // Re-pick the voice for EVERY chunk — even if iOS forgot
        // between utterances, we re-assert. Set both .voice and
        // .voiceURI (iOS honours one or the other unpredictably).
        const v = pickVoice(gender);
        if (v) {
          u.voice = v;
          if (v.voiceURI) u.voiceURI = v.voiceURI;
        }
        u.onend   = advance;
        u.onerror = advance;
        try { synth.resume(); } catch (_) {}
        synth.speak(u);
        // ~350ms/word at rate 0.96, plus 1s safety + 1s tail.
        const wordCount = chunk.split(/\s+/).length || 1;
        setTimeout(advance, Math.min(15000, 1000 + wordCount * 360) + 1000);
      } catch (_) {
        advance();
      }
    }

    // 200 ms initial delay so the cancel above has fully settled
    // before the first new utterance is queued.
    setTimeout(speakOne, 200);
  }

  /* Unlock + warm-up on the first user gesture. iOS Safari needs a
     real gesture to allow any TTS; piggy-back on that to also burn
     the voice-loading race by speaking a silent utterance WITH the
     intended voice. Without this, the first real speak() can race
     against voice loading and end up using the system default. */
  (function unlockTTSOnce() {
    function unlock() {
      document.removeEventListener("touchstart",  unlock);
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("click",       unlock);
      try {
        const synth = window.speechSynthesis;
        if (!synth) return;
        const v = pickVoice(defaultGender);
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        u.rate = 1;
        if (v) {
          u.voice = v;
          if (v.voiceURI) u.voiceURI = v.voiceURI;
        }
        synth.speak(u);
      } catch (_) {}
    }
    document.addEventListener("touchstart",  unlock, { once: true });
    document.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("click",       unlock, { once: true });
  })();

  return { init, revealNext, revealAll, speak };
})();
