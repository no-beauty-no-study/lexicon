/* The Princess Lexicon — bgm.js
   Page-aware background music for the single-page app. The Audio
   element lives for the full session and crossfades between tracks
   on view change — no more sessionStorage gymnastics. Routing layer
   calls BGM.applyForView(name, params) whenever the hash changes. */
(function () {
  const BGM_DIR = "assets/bgm/";

  // ── TRACKS CLEARED ──────────────────────────────────────────────
  // The old score was removed; a new batch is being prepared and will be
  // re-mapped per scene (一句话=一幕), not per chapter. Until those land,
  // every map is empty so the app plays nothing and never 404s. Re-add
  // filenames here (and a scene→track rule in trackForView) when ready.
  const UI_TRACK = null;
  const BY_VIEW = {};
  const READING_BY_CHAPTER = {};
  const ALL_TRACKS = [];

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

  function trackForView(name, params) {
    if (name === "reading") {
      const ch = (params && params.chapter) || "";
      return READING_BY_CHAPTER[ch] || null;
    }
    return BY_VIEW[name] || UI_TRACK;
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
  function nextTrack() {
    if (!ALL_TRACKS.length) return null;   // no score loaded
    ensureAudio();
    const i = ALL_TRACKS.indexOf(currentTrack);
    const next = ALL_TRACKS[(i + 1 + ALL_TRACKS.length) % ALL_TRACKS.length];
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
