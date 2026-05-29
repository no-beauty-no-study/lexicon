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

    // iOS exposes SEVERAL voices that share a .name but differ in
    // .voiceURI quality tier:
    //   com.apple.voice.compact.en-US.Ava       robotic, tiny
    //   com.apple.voice.enhanced.en-US.Ava      good
    //   com.apple.voice.premium.en-US.Ava       best
    //   com.apple.ttsbundle.siri_<Name>_en-US   neural (iOS 16+)
    // Two bugs we have to dodge:
    //   1. getVoices() reorders between utterances — first-match is
    //      non-deterministic → mid-session "downgrade" to compact.
    //   2. The compact tier is the "mechanical female" voice the
    //      user is hearing; if a non-compact en voice exists we MUST
    //      pick that even if its name doesn't match Ava/Samantha.
    // Strategy: tier every voice, hard-reject compact in pass 1, and
    // only fall back to compact if no enhanced/premium/siri en voice
    // is installed on the device at all.
    function tier(v) {
      const s = ((v.voiceURI || "") + " " + (v.name || "")).toLowerCase();
      if (/siri/.test(s))     return 6;
      if (/neural/.test(s))   return 5;
      if (/premium/.test(s))  return 4;
      if (/enhanced/.test(s)) return 3;
      if (/compact/.test(s))  return 0;
      return 2;
    }
    function bestOf(list) {
      if (!list.length) return null;
      return list.slice().sort((a, b) => tier(b) - tier(a))[0];
    }
    const enVoices   = voices.filter(v => /^en/i.test(v.lang) && !/daniel/i.test(v.name));
    const nonCompact = enVoices.filter(v => tier(v) > 0);
    const pool       = nonCompact.length ? nonCompact : enVoices;

    pickedVoice =
         bestOf(pool.filter(v => /siri/i.test(v.voiceURI || "")))
      || bestOf(pool.filter(v => /ava/i.test(v.name)))
      || bestOf(pool.filter(v => /samantha/i.test(v.name)))
      || bestOf(pool.filter(v => /^(allison|susan|karen|victoria|moira|fiona|tessa|kate|serena|nora)$/i.test(v.name)))
      || bestOf(pool.filter(v => /^en-us/i.test(v.lang)))
      || bestOf(pool)
      || voices.find(v => v.default && /^en/i.test(v.lang))
      || voices.find(v => v.default)
      || null;
    logPicked(voices);
    return pickedVoice;
  }

  let lastLoggedUri = null;
  function logPicked(voices) {
    if (!pickedVoice) return;
    // Re-log on every voiceURI CHANGE so a silent downgrade to the
    // compact Ava is visible in the console.
    if (pickedVoice.voiceURI === lastLoggedUri) return;
    lastLoggedUri = pickedVoice.voiceURI;
    try {
      console.log("[TTS] picked:", pickedVoice.name, pickedVoice.lang,
                  "(uri=" + (pickedVoice.voiceURI || "?") + ")",
                  "| available:",
                  voices.map(v => `${v.name} [${v.voiceURI}]${v.default ? " *default" : ""}`).join(", "));
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
