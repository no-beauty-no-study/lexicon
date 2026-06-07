/* ============================================================
   The Princess Lexicon — BGM assignment plan (source of truth).

   js/bgm.js reads this at navigation time and crossfades accordingly.
   Only the FORMAL tracks are used:
     · assets/bgm/00–31*.mp3        UI / reading / quiz / review
     · assets/bgm/paths/00–23*.mp3  文游 paths only
   (sample / reference / wav / midi / preview folders are never referenced.)

   Logic encoded:
     · byView      — one track per global page.
     · holdViews   — Save / Load ride the CURRENT track (no switch); if nothing
                     is playing they fall back to `ui`.
     · reading     — per chapter, an ORDERED list of {from, tracks[]} ranges. A
                     section uses the last range whose `from` ≤ it. Within a
                     range bgm.js rotates the track array (by section position
                     and on track-end) and never repeats a track back-to-back.
     · pathsByChar — the 文游 reading channel, per protagonist.
     · quizByStage — silver(default) / golden / dictation / review.
   ============================================================ */
(function () {
  // reading / UI track shorthand → filename (assets/bgm/<file>)
  const F = {
    "02": "02_note.mp3",
    "03": "03_words_garden.mp3",
    "04": "04_story_lobby.mp3",
    "06": "06_reading_universe_dark.mp3",
    "07": "07_reading_universe_bright.mp3",
    "08": "08_reading_earth_sunlit.mp3",
    "09": "09_reading_earth_ocean.mp3",
    "10": "10_reading_africa_sunflower.mp3",
    "11": "11_reading_africa_showa_neon.mp3",
    "12": "12_reading_antarctica_ice.mp3",
    "13": "13_reading_antarctica_dark_rose.mp3",
    "14": "14_reading_australia_garden.mp3",
    "15": "15_reading_pacific_schoolyard.mp3",
    "16": "16_reading_southamerica_clocktower.mp3",
    "17": "17_reading_southamerica_showa_cafe.mp3",
    "18": "18_reading_asia_alice_key.mp3",
    "19": "19_reading_asia_classroom.mp3",
    "20": "20_reading_ocean_cafe_swing.mp3",
    "21": "21_reading_europe_empress.mp3",
    "22": "22_reading_europe_french.mp3",
    "23": "23_reading_northamerica_skip.mp3",
    "24": "24_reading_northamerica_carousel.mp3",
    "26": "26_reading_japan_showa.mp3",
    "27": "27_reading_sunflower_gate_interlude.mp3",
    "28": "28_reading_deep_castle_gate.mp3",
  };
  const t = codes => codes.map(c => F[c]);
  const R = (from, ...codes) => ({ from, tracks: t(codes) });

  const reading = {
    "universe": [
      R("1.1", "07", "27"),
      R("1.2", "06", "02", "28"),
      R("1.4", "24", "07"),
      R("1.6", "28", "06", "02"),
    ],
    "earth-history": [
      R("2.1", "13", "12"),
      R("2.2", "08", "09", "27"),
      R("2.4", "13", "28"),
      R("2.5", "08", "12", "09"),
    ],
    "africa": [
      R("3.1", "10", "28"),
      R("3.3", "10", "27", "17"),
      R("3.7", "28", "17", "10"),
      R("3.9", "13", "28", "11"),
      R("3.12", "11", "27", "10"),
    ],
    "antarctica": [
      R("4.1", "12", "02"),
      R("4.4", "16", "12"),
      R("4.6", "28", "12"),
      R("4.9", "13", "16"),
    ],
    "australia-pacific": [
      R("5.1", "14", "15"),
      R("5.4", "27", "20"),
      R("5.6", "09", "28", "14"),
      R("5.9", "20", "09"),
    ],
    "south-america": [
      R("6.1", "17", "27"),
      R("6.3", "20", "16"),
      R("6.5", "28", "12"),
      R("6.7", "16", "28"),
      R("6.9", "13", "16"),
      R("6.11", "17", "27"),
    ],
    "asia": [
      R("7.1", "28", "12", "18"),
      R("7.4", "27", "19", "18"),
      R("7.7", "18", "28", "19"),
      R("7.11", "03", "18", "27"),
      R("7.16", "13", "18"),
      R("7.17", "26", "27"),
      R("7.18", "19", "11", "23"),
      R("7.22", "27", "28", "26"),
    ],
    "oceans": [
      R("8.1", "20", "17"),
      R("8.2", "14", "09"),
      R("8.3", "16", "20"),
      R("8.4", "09", "07"),
      R("8.6", "27", "20"),
    ],
    "europe": [
      R("9.1", "21", "28", "02"),
      R("9.8", "22", "03", "04"),
      R("9.16", "22", "27", "21"),
      R("9.25", "13", "21", "22"),
      R("9.33", "03", "22", "02"),
      R("9.41", "28", "03", "21"),
      R("9.48", "13", "02", "28"),
      R("9.51", "21", "27", "22"),
    ],
    "north-america": [
      R("10.1", "24", "15", "08"),
      R("10.8", "28", "13", "20"),
      R("10.13", "23", "24", "08"),
      R("10.19", "15", "23", "27"),
      R("10.24", "24", "27", "13"),
      R("10.31", "23", "15", "08"),
    ],
  };

  // 文游 paths — per protagonist (files live in assets/bgm/paths/).
  const P = f => "paths/" + f;
  const pathsByChar = {
    sealyra: [P("17_luv_poem_from_hum.mp3"), P("19_luv_poem_performance_loop.mp3"), P("20_heart9_opening_burst.mp3"), P("00_glass_bloom_main_theme_long.mp3")],
    shiro:   [P("03_shiro_daily_silver_glass.mp3"), P("04_shiro_heart_choose_me_once.mp3"), P("05_shiro_sad_three_safe_houses.mp3"), P("15_shiro_love_daily_soft_static.mp3"), P("16_shiro_heart2_from_hum.mp3")],
    hosea:   [P("06_hosea_daily_white_fox.mp3"), P("07_hosea_heart_hunter_hit.mp3"), P("08_hosea_sad_rues_shadow.mp3"), P("22_hosea_sweet_daily_after_school.mp3")],
    jael:    [P("09_jael_daily_gold_knife.mp3"), P("10_jael_heart_aubade_fever.mp3"), P("11_jael_sad_shedding_skin.mp3"), P("21_jael_daily_velvet_courtesy.mp3"), P("23_jael_sweet_daily_after_hours.mp3")],
    kye:     [P("12_kye_ward_deer_at_dawn.mp3"), P("18_kye_deer_at_dawn_bloom.mp3")],
  };

  window.READING_BGM_PLAN = {
    byView: {
      splash:        "29_ui_manu_sunlit_alice_kept.mp3",
      menu:          "29_ui_manu_sunlit_alice_kept.mp3",
      chapters:      "29_ui_manu_sunlit_alice_kept.mp3",   // index
      select:        "30_ui_select_sun_ribbon.mp3",
      notes:         "02_note.mp3",
      "word-garden": "03_words_garden.mp3",
      voices:        "29_ui_manu_sunlit_alice_kept.mp3",
      paths:         P("00_glass_bloom_main_theme_long.mp3"),  // Follow station → main theme
    },
    holdViews: ["save", "load"],   // ride the current track; fall back to `ui`
    reading,
    pathsByChar,
    quizByStage: {
      "default":   "00_choice_quiz_TRUE_SHORT_45s.mp3",   // stage 1 / silver
      "golden":    "25_review_spark.mp3",                 // stage 2 / golden
      "dictation": "31_quiz_dictation_long_loop.mp3",     // dictation / seal
      "review":    "25_review_spark.mp3",                 // Review page (slower)
    },
    // 文游 BGM by SCENE STATE (not by page). The reader is a director:
    //   common daily → tension(at a choice) → wrong / correct → male-lead
    //   daily / heart / sad / sweet → Sealyra specials. vnread drives these
    //   from the choice/branch structure; see Views.vn.
    pathsScene: {
      main:    P("00_glass_bloom_main_theme_long.mp3"),     // chapter entrance / destiny
      common:  P("01_daily_happy_sunlit_messages.mp3"),     // common non-romantic daily
      tension: P("02_daily_tension_before_reply.mp3"),      // a choice is open
      wrong:   P("13_choice_loss_sweet_knife.mp3"),         // wrong result / no affection
      correct: P("14_choice_continue_clean_angle.mp3"),     // correct result / forward
      lead: {
        shiro: { daily: P("03_shiro_daily_silver_glass.mp3"),   heart: P("04_shiro_heart_choose_me_once.mp3"), sad: P("05_shiro_sad_three_safe_houses.mp3"),  sweet: P("15_shiro_love_daily_soft_static.mp3") },
        hosea: { daily: P("06_hosea_daily_white_fox.mp3"),      heart: P("07_hosea_heart_hunter_hit.mp3"),     sad: P("08_hosea_sad_rues_shadow.mp3"),        sweet: P("22_hosea_sweet_daily_after_school.mp3") },
        jael:  { daily: P("21_jael_daily_velvet_courtesy.mp3"), heart: P("10_jael_heart_aubade_fever.mp3"),    sad: P("11_jael_sad_shedding_skin.mp3"),       sweet: P("23_jael_sweet_daily_after_hours.mp3"), danger: P("09_jael_daily_gold_knife.mp3") },
        kye:   { daily: P("12_kye_ward_deer_at_dawn.mp3"),      heart: P("18_kye_deer_at_dawn_bloom.mp3"),     sad: P("12_kye_ward_deer_at_dawn.mp3"),        sweet: P("18_kye_deer_at_dawn_bloom.mp3") },
      },
      sealyra: { mono: P("17_luv_poem_from_hum.mp3"), perform: P("19_luv_poem_performance_loop.mp3"), shine: P("20_heart9_opening_burst.mp3"), effort: P("16_shiro_heart2_from_hum.mp3") },
    },
    ui: "29_ui_manu_sunlit_alice_kept.mp3",
  };
})();
