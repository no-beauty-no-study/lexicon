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

  // Tier hoisted to module scope so the override branch can also
  // tier-sort. iOS exposes multiple voices with identical .name (eg.
  // "Ava") that differ only by voiceURI suffix:
  //   com.apple.voice.compact.en-US.Ava     robotic — the "demon" voice
  //   com.apple.voice.enhanced.en-US.Ava    good
  //   com.apple.voice.premium.en-US.Ava     best
  //   com.apple.ttsbundle.siri_*_en-US      neural (iOS 16+)
  // getVoices() reorders between utterances, so .find(name === "Ava")
  // returned a different tier each call → first sentence enhanced,
  // second sentence compact-robot. tier-sort fixes it.
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
      // 1) Exact voiceURI match — unique, tier-locked. The voices
      //    picker writes URI on "Use", so a fresh selection always
      //    hits this branch and is stable across utterances.
      let chosen = voices.find(v => v.voiceURI === override);
      // 2) Exact name match (legacy: user typed "Ava" into the
      //    localStorage override before the URI was stored, or
      //    "tpl.voice" was set via console). Tier-sort the matches
      //    so we always grab enhanced/premium-Ava over compact-Ava
      //    no matter how getVoices() is ordered this call.
      if (!chosen) {
        const exact = voices.filter(v => v.name === override);
        if (exact.length) chosen = bestOf(exact);
      }
      // 3) Substring match — same tier-sort caveat as 2.
      if (!chosen) {
        const lc = override.toLowerCase();
        const fuzzy = voices.filter(v =>
          v.name && v.name.toLowerCase().includes(lc)
        );
        if (fuzzy.length) chosen = bestOf(fuzzy);
      }
      if (chosen) { pickedVoice = chosen; logPicked(voices); return pickedVoice; }
    }

    // No override (or no match). Reject compact-tier voices in the
    // first pass; only fall back to them if NO non-compact English
    // voice exists on the device at all.
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

    // EVERYTHING below must run synchronously inside whatever click /
    // touch handler called speak(). iOS 17+ silently drops u.voice
    // on any utterance not initiated within the user-gesture window,
    // and falls back to the locale default voice (en-GB Daniel on
    // most iPads — the "mechanical old man" the user is hearing on
    // every-other paragraph). The previous setTimeout(30) wrapper
    // pushed speak() into a fresh task, OUTSIDE the gesture, which
    // is exactly what triggered the regression.
    const v = pickVoice(true);
    try { window.speechSynthesis.cancel(); } catch (_) {}
    const u = buildUtterance(text, v);

    // Optional debug aid: when localStorage.tpl.voiceDebug === "1",
    // toast the picked voice's name + tier on every utterance, so
    // the user can see whether pickVoice() chose the wrong voice or
    // iOS substituted one after the fact. Toggle from #voices view.
    let dbg = false;
    try { dbg = localStorage.getItem("tpl.voiceDebug") === "1"; } catch (_) {}
    if (dbg && window.toast) {
      const tag = v
        ? (v.name || "?") + " · " + (((v.voiceURI || "")
            .match(/(siri|premium|enhanced|compact|neural)/i) || ["std"])[0])
        : "no voice";
      try { window.toast(tag); } catch (_) {}
    }

    try { window.speechSynthesis.speak(u); } catch (_) {}
  }

  return { speak, pickVoice };
})();
