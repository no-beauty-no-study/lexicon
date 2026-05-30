/* The Princess Lexicon — bgm.js
   Page-aware background music for the single-page app. The Audio
   element lives for the full session and crossfades between tracks
   on view change — no more sessionStorage gymnastics. Routing layer
   calls BGM.applyForView(name, params) whenever the hash changes. */
(function () {
  const BGM_DIR = "assets/bgm/";

  const UI_TRACK = "01_ui_cover_select_save_load.mp3";
  const BY_VIEW = {
    "splash":      UI_TRACK,
    "menu":        UI_TRACK,
    "select":      UI_TRACK,
    "save":        UI_TRACK,
    "load":        UI_TRACK,
    "notes":       "02_note.mp3",
    "word-garden": "03_words_garden.mp3",
    "chapters":    "04_story_lobby.mp3",
    "quiz":        "05_choice_quiz_all_fast_short.mp3",
  };
  const READING_BY_CHAPTER = {
    "universe":          "06_reading_universe_dark.mp3",
    "earth-history":     "08_reading_earth_sunlit.mp3",
    "africa":            "10_reading_africa_sunflower.mp3",
    "antarctica":        "12_reading_antarctica_ice.mp3",
    "australia-pacific": "14_reading_australia_garden.mp3",
    "south-america":     "16_reading_southamerica_clocktower.mp3",
    "asia":              "18_reading_asia_alice_key.mp3",
    "oceans":            "20_reading_ocean_cafe_swing.mp3",
    "europe":            "21_reading_europe_empress.mp3",
    "north-america":     "23_reading_northamerica_skip.mp3",
  };

  const DEFAULT_VOLUME = 0.32;

  // Full track inventory — used by nextTrack() for manual cycling
  // when the player wants something other than the per-view default.
  const ALL_TRACKS = [
    UI_TRACK,
    "02_note.mp3",
    "03_words_garden.mp3",
    "04_story_lobby.mp3",
    "05_choice_quiz_all_fast_short.mp3",
    "06_reading_universe_dark.mp3",
    "08_reading_earth_sunlit.mp3",
    "10_reading_africa_sunflower.mp3",
    "12_reading_antarctica_ice.mp3",
    "14_reading_australia_garden.mp3",
    "16_reading_southamerica_clocktower.mp3",
    "18_reading_asia_alice_key.mp3",
    "20_reading_ocean_cafe_swing.mp3",
    "21_reading_europe_empress.mp3",
    "23_reading_northamerica_skip.mp3",
  ];

  let audio        = null;
  let currentTrack = null;
  let unlocked     = false;
  // manualTrack: if non-null, applyForView ignores its per-view
  // default and keeps playing whatever the user picked. Reset by
  // BGM.autoMode() so view changes drive the music again.
  let manualTrack  = null;

  let userVolume = (() => {
    try {
      const v = parseFloat(localStorage.getItem("tpl.bgmVol"));
      return isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_VOLUME;
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
      const ch = (params && params.chapter) || "universe";
      return READING_BY_CHAPTER[ch] || READING_BY_CHAPTER.universe;
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
