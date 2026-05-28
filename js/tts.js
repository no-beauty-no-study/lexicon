/* The Princess Lexicon — tts.js
   User-tested behaviour: my prior speak() reliably hit Ava on the
   FIRST utterance and then silently fell back to Daniel on the next
   one. That's the well-known iOS Safari quirk where the engine
   keeps state across utterances and, once speechSynthesis.speaking
   goes false, the locale default (en-GB Daniel on this device)
   takes over no matter what u.voice we set on the next utterance.

   To make Ava stick across every call, we now do ALL of these on
   each speak() — none alone is sufficient on iOS:
     1. window.speechSynthesis.cancel() to fully reset state.
     2. defer the actual .speak() by a tick (setTimeout) so the cancel
        flushes BEFORE the new utterance is queued.
     3. re-resolve the voice from the LIVE getVoices() list, because
        iOS reorders the list across calls and a cached reference can
        go stale (the voice object still exists, but the engine no
        longer treats it as "active").
     4. set u.lang FIRST, then u.voice. set u.voice TWICE (yes, voodoo,
        but the second assignment makes the engine commit the voice
        when the first assignment alone gets clobbered).
     5. comma-substitute sentence punctuation so iOS doesn't switch
        voice mid-utterance.

   Voice override: localStorage.setItem("tpl.voice", "Ava") forces an
   exact-name (or substring) match. Useful when the engine picks the
   wrong default and the user wants to lock in. */
const TTS = (function () {

  let pickedVoice = null;
  let logged      = false;

  function pickVoice(refresh) {
    if (pickedVoice && !refresh) return pickedVoice;
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

    // Order: explicit-Ava-match BEFORE v.default, because on en-GB
    // iPads v.default is Daniel even when the user's system voice
    // (Settings → Accessibility → Spoken Content → Voices) is Ava.
    pickedVoice =
         voices.find(v => /^Ava\b/i.test(v.name))
      || voices.find(v => /ava/i.test(v.name))
      || voices.find(v => v.default && /^en/i.test(v.lang) && !/daniel/i.test(v.name))
      || voices.find(v => /samantha/i.test(v.name))
      || voices.find(v => /^en-us/i.test(v.lang) && !/daniel/i.test(v.name))
      || voices.find(v => /^en/i.test(v.lang)    && !/daniel/i.test(v.name))
      || voices.find(v => v.default)
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

  function buildUtterance(text, v) {
    const massaged = String(text)
      .replace(/([.!?])(?=\s|$)/g, ",")
      .replace(/,+\s*$/, "");
    const u = new SpeechSynthesisUtterance(massaged);
    u.lang  = (v && v.lang) || "en-US";
    u.rate  = 0.96;
    u.pitch = 1.0;
    u.volume = 1.0;
    if (v) {
      u.voice = v;
      // Second assignment is intentional — without it, iOS 17+ drops
      // u.voice silently on every utterance after the first and falls
      // back to the locale-default voice (Daniel on en-GB iPads).
      u.voice = v;
    }
    return u;
  }

  function speak(text) {
    if (!text) return;
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}

    // Defer the new utterance by a tick. iOS Safari clears
    // speechSynthesis state asynchronously after cancel(); calling
    // speak() synchronously after cancel() in the same task ends up
    // racing with that clear, which is exactly when the voice drops
    // to Daniel.
    setTimeout(() => {
      // Re-resolve from the live voices list on every call. iOS
      // reorders this list after each utterance and a cached
      // reference can stop being treated as "active" even though
      // the object still exists.
      const v = pickVoice(true);
      const u = buildUtterance(text, v);
      try { window.speechSynthesis.speak(u); } catch (_) {}
    }, 30);
  }

  return { speak, pickVoice };
})();
