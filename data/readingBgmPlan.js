/* ============================================================
   The Princess Lexicon — BGM assignment plan.

   The single source of truth for "what plays where". js/bgm.js reads this
   at navigation time and crossfades accordingly. Edit here, not in bgm.js.

   Rules encoded:
     · byView          — one track per top-level page.
     · holdViews       — pages that must NOT switch the song. Save / Load are
                         pop-ups over whatever you were doing (reading, menu);
                         they keep the current track instead of cutting to UI
                         music. (per "save/load 弹窗不要单独切歌")
     · reading         — per chapter. A 2-track value splits the chapter:
                         first half plays [0], second half plays [1] (the
                         boundary is computed from the section's position, so
                         no section numbers are hard-coded). A 1-track value
                         plays throughout. `_paths` scores the visual-novel
                         reading channel.
     · quizByStage     — quiz/review pages by stage; `default` is the fallback.

   To repoint to a new batch: keep these filenames (drop the new mp3s in
   assets/bgm/ under the same names) OR rename here to match new files.
   ============================================================ */
const READING_BGM_PLAN = {
  byView: {
    splash:        "01_ui_cover_select_save_load.mp3",
    menu:          "01_ui_cover_select_save_load.mp3",
    select:        "01_ui_cover_select_save_load.mp3",
    chapters:      "04_story_lobby.mp3",
    notes:         "02_note.mp3",
    "word-garden": "03_words_garden.mp3",
    voices:        "01_ui_cover_select_save_load.mp3",
    paths:         "04_story_lobby.mp3",
  },

  // Pop-ups that ride on the current track — bgm.js leaves the song alone.
  holdViews: ["save", "load"],

  reading: {
    "universe":          ["06_reading_universe_dark.mp3",        "07_reading_universe_bright.mp3"],
    "earth-history":     ["08_reading_earth_sunlit.mp3",         "09_reading_earth_ocean.mp3"],
    "africa":            ["10_reading_africa_sunflower.mp3",     "11_reading_africa_showa_neon.mp3"],
    "antarctica":        ["12_reading_antarctica_ice.mp3",       "13_reading_antarctica_dark_rose.mp3"],
    "australia-pacific": ["14_reading_australia_garden.mp3",     "15_reading_pacific_schoolyard.mp3"],
    "south-america":     ["16_reading_southamerica_clocktower.mp3", "17_reading_southamerica_showa_cafe.mp3"],
    "asia":              ["18_reading_asia_alice_key.mp3",       "19_reading_asia_classroom.mp3"],
    "oceans":            ["20_reading_ocean_cafe_swing.mp3"],
    "europe":            ["21_reading_europe_empress.mp3",       "22_reading_europe_french.mp3"],
    "north-america":     ["23_reading_northamerica_skip.mp3",    "24_reading_northamerica_carousel.mp3"],
    // The Paths visual-novel channel (sealyra/shiro/hosea/jael/kye).
    "_paths":            "04_story_lobby.mp3",
  },

  quizByStage: {
    "default": "05_choice_quiz_all_fast_short.mp3",
    "short":   "00_choice_quiz_TRUE_SHORT_45s.mp3",
    "review":  "05_choice_quiz_all_fast_short.mp3",
  },

  ui: "01_ui_cover_select_save_load.mp3",
};
if (typeof window !== "undefined") window.READING_BGM_PLAN = READING_BGM_PLAN;
