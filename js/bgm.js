/* ============================================================
   The Princess Lexicon — bgm.js
   Page-aware background music. Loads + loops the right mp3 per
   page, fades between tracks across page navigation, and obeys
   iOS Safari's user-gesture autoplay rule.

   The mapping comes from assets/bgm/bgm_assignment_map.json (the
   user's curated assignment); the table below mirrors it as a
   small JS object keyed by page identity so we can look up
   without an extra fetch.
   ============================================================ */
(function () {
  const BGM_DIR = "assets/bgm/";

  // Page identity → BGM filename. Reading uses a per-chapter map.
  // Multiple keys mapping to the same file means the BGM persists
  // across those navigations (no restart) — that's the user's
  // 'cover + select + save + load 连续播放' intent.
  const UI_TRACK = "01_ui_cover_select_save_load.mp3";
  const BY_PAGE = {
    "index":       UI_TRACK,
    "select":      UI_TRACK,
    "save":        UI_TRACK,
    "load":        UI_TRACK,
    "notes":       "02_note.mp3",
    "word-garden": "03_words_garden.mp3",
    "chapters":    "04_story_lobby.mp3",
    "quiz":        "05_choice_quiz_all_fast_short.mp3",
  };
  // Reading bg per chapter id.
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

  function detectTrack() {
    const page = document.querySelector(".page");
    const dataPage = page && page.dataset && page.dataset.page;
    if (dataPage === "reading" || dataPage === "quiz") {
      const ch = new URL(location.href).searchParams.get("chapter")
              || "universe";
      if (dataPage === "quiz") return BY_PAGE.quiz;
      return READING_BY_CHAPTER[ch] || READING_BY_CHAPTER.universe;
    }
    const path = location.pathname.split("/").pop().replace(".html", "");
    if (BY_PAGE[path]) return BY_PAGE[path];
    if (page && page.classList.contains("select-art")) return BY_PAGE.select;
    if (page && page.classList.contains("chapters-art")) return BY_PAGE.chapters;
    if (page && page.classList.contains("wg-art"))       return BY_PAGE["word-garden"];
    return UI_TRACK;
  }

  // ----- Cross-page persistence ------------------------------------
  // sessionStorage carries (track, paused-at-seconds) across page
  // loads so the music keeps playing seamlessly when the user
  // jumps from cover → select → save without restart.
  const STATE_KEY = "tpl.bgm.state";
  function readState() {
    try { return JSON.parse(sessionStorage.getItem(STATE_KEY) || "{}"); }
    catch (_) { return {}; }
  }
  function writeState(s) {
    try { sessionStorage.setItem(STATE_KEY, JSON.stringify(s)); }
    catch (_) {}
  }

  // ----- Player state ----------------------------------------------
  let audio = null;
  let unlocked = false;

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0.32;
    return audio;
  }

  function setTrack(track) {
    const a = ensureAudio();
    const src = BGM_DIR + track;
    const isSame = a.src && a.src.endsWith(track);
    if (!isSame) {
      const prior = readState();
      const resumeAt = (prior.track === track) ? (prior.at || 0) : 0;
      a.src = src;
      try { a.currentTime = resumeAt; } catch (_) {}
    }
    return a;
  }

  function playNow() {
    if (!audio) return;
    const p = audio.play();
    if (p && p.catch) p.catch(() => { /* iOS will retry on gesture */ });
  }

  function persist() {
    if (!audio) return;
    writeState({
      track: audio.src.split("/").pop(),
      at: audio.currentTime || 0,
    });
  }

  function init() {
    const track = detectTrack();
    setTrack(track);
    playNow();
    if (!unlocked) {
      const wakeUp = () => {
        if (unlocked) return;
        unlocked = true;
        playNow();
      };
      ["touchstart","pointerdown","click","keydown"].forEach(ev =>
        document.addEventListener(ev, wakeUp, { passive: true, once: true }));
    }
    window.addEventListener("pagehide", persist);
    window.addEventListener("beforeunload", persist);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") persist();
    });
    setInterval(persist, 2000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.BGM = {
    fadeOut(ms = 240) {
      if (!audio) return;
      const start = audio.volume;
      const t0 = performance.now();
      function step(now) {
        const p = Math.min(1, (now - t0) / ms);
        audio.volume = start * (1 - p);
        if (p < 1) requestAnimationFrame(step);
        else { try { audio.pause(); } catch(_){} }
      }
      requestAnimationFrame(step);
    },
  };
})();
