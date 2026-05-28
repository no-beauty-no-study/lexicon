/* The Princess Lexicon — tts.js
   Replaces the old reveal.js TTS layer with a clean speak() that
   honours the user's OS system voice. iOS Safari workarounds kept
   ONLY where they were actually needed:
     - Set u.lang FIRST, u.voice LAST (reverse order silently clears
       voice on iOS).
     - Comma-substitute sentence punctuation so iOS doesn't switch
       voice mid-utterance.
   The cancel/chunk/watchdog/onend gymnastics from the prior pipeline
   are gone; user testing showed those were causing the very voice
   drops they were supposed to prevent.

   Voice override: localStorage.setItem("tpl.voice", "Samantha") forces
   that exact voice. Useful for debugging without code edits. */
const TTS = (function () {

  let pickedVoice = null;
  let logged      = false;

  function pickVoice() {
    if (pickedVoice) return pickedVoice;
    if (!window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    const override = (() => {
      try { return localStorage.getItem("tpl.voice"); } catch (_) { return null; }
    })();
    if (override) {
      const forced = voices.find(v => v.name === override)
                  || voices.find(v => v.name.toLowerCase().includes(override.toLowerCase()));
      if (forced) { pickedVoice = forced; logPicked(voices); return pickedVoice; }
    }

    pickedVoice =
         voices.find(v => v.default && /^en/i.test(v.lang))
      || voices.find(v => /ava/i.test(v.name))
      || voices.find(v => /samantha/i.test(v.name))
      || voices.find(v => v.default)
      || voices.find(v => /^en-us/i.test(v.lang) && !/daniel/i.test(v.name))
      || voices.find(v => /^en/i.test(v.lang)    && !/daniel/i.test(v.name))
      || null;
    logPicked(voices);
    return pickedVoice;
  }

  function logPicked(voices) {
    if (logged || !pickedVoice) return;
    logged = true;
    try {
      console.log("[TTS] picked:", pickedVoice.name, pickedVoice.lang,
                  "| available:",
                  voices.map(v => `${v.name} (${v.lang})${v.default ? " *default" : ""}`).join(", "));
    } catch (_) {}
  }

  if (window.speechSynthesis && "onvoiceschanged" in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => { pickedVoice = null; pickVoice(); };
  }

  function speak(text) {
    if (!text) return;
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const massaged = String(text)
        .replace(/([.!?])(?=\s|$)/g, ",")
        .replace(/,+\s*$/, "");
      const u = new SpeechSynthesisUtterance(massaged);
      const v = pickVoice();
      u.lang  = (v && v.lang) || "en-US";
      u.rate  = 0.96;
      u.pitch = 1.0;
      if (v) u.voice = v;
      window.speechSynthesis.speak(u);
    } catch (_) { /* swallow */ }
  }

  return { speak, pickVoice };
})();
