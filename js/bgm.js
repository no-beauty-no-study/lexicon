/* The Princess Lexicon — bgm.js
   Page-aware background music for the single-page app. The Audio
   element lives for the full session and crossfades between tracks
   on view change — no more sessionStorage gymnastics. Routing layer
   calls BGM.applyForView(name, params) whenever the hash changes. */
(function () {
  const BGM_DIR = "assets/bgm/";

  // The assignment plan (data/readingBgmPlan.js) is the source of truth for
  // what plays where. We read it live so editing the plan needs no bgm.js
  // change. Fallbacks keep things sane if the plan file is missing.
  function plan() { return (typeof window !== "undefined" && window.READING_BGM_PLAN) || null; }
  const DEFAULT_VOLUME = 0.32;

  let audio        = null;
  let currentTrack = null;
  let unlocked     = false;
  // manualTrack: if non-null, applyForView ignores its per-view
  // default and keeps playing whatever the user picked. Reset by
  // BGM.autoMode() so view changes drive the music again.
  let manualTrack  = null;

  // Persisted volume; a tiny floor on the init path so a legacy "0"
  // (e.g. left over from when the user accidentally dragged the
  // slider all the way down during testing, before the slider was
  // visible enough to notice) doesn't permanently mute the app on
  // next launch. Within a session, setVolume(0) is still honoured.
  let userVolume = (() => {
    try {
      const v = parseFloat(localStorage.getItem("tpl.bgmVol"));
      if (!isFinite(v) || v < 0.02) return DEFAULT_VOLUME;
      return Math.min(1, v);
    } catch (_) { return DEFAULT_VOLUME; }
  })();

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    audio.addEventListener("playing", () => { unlocked = true; });
    return audio;
  }

  function clampVol(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  // Each call to fade() bumps fadeTok and the rAF loop bails out the
  // moment a newer fade (or an explicit setVolume) supersedes it.
  // Without this, dragging the volume slider while a fade is mid-flight
  // would have the slider's audio.volume = userVolume immediately
  // clobbered by the next frame of the in-flight fade — i.e. "I dragged
  // and nothing happened", which is exactly what the user reported.
  let fadeTok = 0;
  function fade(target, ms, onDone) {
    if (!audio) return;
    const mine = ++fadeTok;
    const start = audio.volume;
    const t0 = performance.now();
    (function step(now) {
      if (mine !== fadeTok) return;            // newer fade owns audio now
      const p = Math.min(1, (now - t0) / ms);
      audio.volume = clampVol(start + (target - start) * p);
      if (p < 1) requestAnimationFrame(step);
      else if (onDone) onDone();
    })(t0);
  }

  // Which section index are we on within a chapter, and how many total?
  // Used to split a 2-track chapter into first half / second half without
  // hard-coding section numbers. Falls back to the first track if unknown.
  function readingTrack(p, params) {
    const ch = (params && params.chapter) || "";
    let val = p.reading && p.reading[ch];
    // Paths visual-novel chapters (sealyra/shiro/…) score off `_paths`.
    if (!val && typeof CHAPTER_CONTENT !== "undefined" && CHAPTER_CONTENT[ch] && CHAPTER_CONTENT[ch]._path)
      val = p.reading && p.reading._paths;
    if (!val) return (p.reading && p.reading._paths) || p.ui || null;
    if (typeof val === "string") return val;
    if (!Array.isArray(val) || !val.length) return null;
    if (val.length === 1) return val[0];
    // 2+ tracks: choose by the section's position through the chapter.
    let idx = 0, total = 1;
    try {
      const secs = (typeof ChapterNav !== "undefined" && ChapterNav.sectionsOf)
        ? (ChapterNav.sectionsOf(ch) || []) : [];
      total = Math.max(1, secs.length);
      const here = String((params && params.section) || "");
      const at = secs.findIndex(s => String(s.number) === here);
      idx = at >= 0 ? at : 0;
    } catch (_) {}
    const slot = Math.min(val.length - 1, Math.floor(idx / total * val.length));
    return val[slot];
  }

  function trackForView(name, params) {
    const p = plan();
    if (!p) return null;
    if (name === "reading")  return readingTrack(p, params);
    if (name === "quiz" || name === "quizstatus" || name === "comprehension")
      return (p.quizByStage && (p.quizByStage.default)) || p.ui || null;
    if (name === "review")
      return (p.quizByStage && (p.quizByStage.review || p.quizByStage.default)) || p.ui || null;
    return (p.byView && p.byView[name]) || p.ui || null;
  }

  function playNow() {
    if (!audio) return;
    const p = audio.play();
    if (p && p.then) {
      p.then(() => fade(userVolume, 600))
       .catch(() => { /* iOS will retry on next gesture */ });
    }
  }

  function applyForView(name, params) {
    const p = plan();
    // Hold views (Save / Load pop-ups): never switch the song — they ride on
    // whatever was already playing (reading track, menu track, …).
    if (p && Array.isArray(p.holdViews) && p.holdViews.indexOf(name) >= 0) {
      if (audio && audio.paused) playNow();
      return;
    }
    const track = manualTrack || trackForView(name, params);
    // No score loaded yet → make sure nothing is playing and bail.
    if (!track) { if (audio && !audio.paused) fade(0, 200, () => { try { audio.pause(); } catch (_) {} currentTrack = null; }); return; }
    ensureAudio();
    if (track === currentTrack) {
      if (audio.paused) playNow();
      return;
    }
    if (currentTrack) {
      fade(0, 220, () => {
        currentTrack = track;
        audio.src = BGM_DIR + track;
        try { audio.currentTime = 0; } catch (_) {}
        playNow();
      });
    } else {
      currentTrack = track;
      audio.src = BGM_DIR + track;
      playNow();
    }
  }

  function wakeUp() { if (audio && audio.paused) playNow(); }
  ["touchstart","pointerdown","click","keydown"].forEach(ev =>
    document.addEventListener(ev, wakeUp, { passive: true }));

  // ---- Public controls bound by the global BGM widget ----
  function setVolume(v) {
    const n = parseFloat(v);
    userVolume = isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
    try { localStorage.setItem("tpl.bgmVol", String(userVolume)); } catch (_) {}
    if (audio) {
      fadeTok++;                     // cancel any in-progress fade
      audio.volume = userVolume;
    }
  }
  function getVolume() { return userVolume; }
  // Inventory for manual cycling: every distinct track named in the plan.
  function allTracks() {
    const p = plan(); if (!p) return [];
    const set = new Set();
    if (p.ui) set.add(p.ui);
    Object.values(p.byView || {}).forEach(t => t && set.add(t));
    Object.values(p.quizByStage || {}).forEach(t => t && set.add(t));
    Object.values(p.reading || {}).forEach(v => (Array.isArray(v) ? v : [v]).forEach(t => t && set.add(t)));
    return [...set];
  }
  function nextTrack() {
    const list = allTracks();
    if (!list.length) return null;   // no score loaded
    ensureAudio();
    const i = list.indexOf(currentTrack);
    const next = list[(i + 1 + list.length) % list.length];
    manualTrack = next;       // lock in: don't get blown away by view changes
    fade(0, 180, () => {
      currentTrack = next;
      audio.src = BGM_DIR + next;
      try { audio.currentTime = 0; } catch (_) {}
      playNow();
    });
    return next;
  }
  function autoMode() { manualTrack = null; }

  window.BGM = { applyForView, setVolume, getVolume, nextTrack, autoMode };
})();
