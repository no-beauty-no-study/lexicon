window.READING_BGM_PLAN = {
  ui: {
    default: "01_ui_cover_select_save_load.mp3",
    notes: "02_note.mp3",
    wordGarden: "03_words_garden.mp3",
    quizChoice1: "00_choice_quiz_TRUE_SHORT_45s.mp3",
    quizChoice2: "25_review_spark.mp3",
    quizDictation: "31_quiz_dictation_long_loop.mp3",
    review: "05_choice_quiz_all_fast_short.mp3",
  },
  chapters: {
    "universe": {
      pool: ["06_reading_universe_dark.mp3", "07_reading_universe_bright.mp3", "24_reading_northamerica_carousel.mp3", "28_reading_deep_castle_gate.mp3", "02_note.mp3"],
      segments: [
        { range: "1.1", tracks: ["07_reading_universe_bright.mp3", "27_reading_sunflower_gate_interlude.mp3"] },
        { range: "1.2-1.3", tracks: ["06_reading_universe_dark.mp3", "02_note.mp3", "28_reading_deep_castle_gate.mp3"] },
        { range: "1.4-1.5", tracks: ["24_reading_northamerica_carousel.mp3", "07_reading_universe_bright.mp3"] },
        { range: "1.6-1.7", tracks: ["28_reading_deep_castle_gate.mp3", "06_reading_universe_dark.mp3", "02_note.mp3"] },
      ],
    },
    "earth-history": {
      pool: ["08_reading_earth_sunlit.mp3", "09_reading_earth_ocean.mp3", "12_reading_antarctica_ice.mp3", "13_reading_antarctica_dark_rose.mp3", "27_reading_sunflower_gate_interlude.mp3"],
      segments: [
        { range: "2.1", tracks: ["13_reading_antarctica_dark_rose.mp3", "12_reading_antarctica_ice.mp3"] },
        { range: "2.2-2.3", tracks: ["08_reading_earth_sunlit.mp3", "09_reading_earth_ocean.mp3", "27_reading_sunflower_gate_interlude.mp3"] },
        { range: "2.4", tracks: ["13_reading_antarctica_dark_rose.mp3", "28_reading_deep_castle_gate.mp3"] },
        { range: "2.5-2.7", tracks: ["08_reading_earth_sunlit.mp3", "12_reading_antarctica_ice.mp3", "09_reading_earth_ocean.mp3"] },
      ],
    },
    "africa": {
      pool: ["10_reading_africa_sunflower.mp3", "11_reading_africa_showa_neon.mp3", "17_reading_southamerica_showa_cafe.mp3", "27_reading_sunflower_gate_interlude.mp3", "28_reading_deep_castle_gate.mp3", "13_reading_antarctica_dark_rose.mp3"],
      segments: [
        { range: "3.1-3.2", tracks: ["10_reading_africa_sunflower.mp3", "28_reading_deep_castle_gate.mp3"] },
        { range: "3.3-3.6", tracks: ["10_reading_africa_sunflower.mp3", "27_reading_sunflower_gate_interlude.mp3", "17_reading_southamerica_showa_cafe.mp3"] },
        { range: "3.7-3.8", tracks: ["28_reading_deep_castle_gate.mp3", "17_reading_southamerica_showa_cafe.mp3", "10_reading_africa_sunflower.mp3"] },
        { range: "3.9-3.11", tracks: ["13_reading_antarctica_dark_rose.mp3", "28_reading_deep_castle_gate.mp3", "11_reading_africa_showa_neon.mp3"] },
        { range: "3.12-3.14", tracks: ["11_reading_africa_showa_neon.mp3", "27_reading_sunflower_gate_interlude.mp3", "10_reading_africa_sunflower.mp3"] },
      ],
    },
    "antarctica": {
      pool: ["12_reading_antarctica_ice.mp3", "13_reading_antarctica_dark_rose.mp3", "16_reading_southamerica_clocktower.mp3", "28_reading_deep_castle_gate.mp3", "02_note.mp3"],
      segments: [
        { range: "4.1-4.3", tracks: ["12_reading_antarctica_ice.mp3", "02_note.mp3"] },
        { range: "4.4-4.5", tracks: ["16_reading_southamerica_clocktower.mp3", "12_reading_antarctica_ice.mp3"] },
        { range: "4.6-4.8", tracks: ["28_reading_deep_castle_gate.mp3", "12_reading_antarctica_ice.mp3"] },
        { range: "4.9-4.11", tracks: ["13_reading_antarctica_dark_rose.mp3", "16_reading_southamerica_clocktower.mp3"] },
      ],
    },
    "australia-pacific": {
      pool: ["14_reading_australia_garden.mp3", "15_reading_pacific_schoolyard.mp3", "20_reading_ocean_cafe_swing.mp3", "27_reading_sunflower_gate_interlude.mp3", "09_reading_earth_ocean.mp3"],
      segments: [
        { range: "5.1-5.3", tracks: ["14_reading_australia_garden.mp3", "15_reading_pacific_schoolyard.mp3"] },
        { range: "5.4-5.5", tracks: ["27_reading_sunflower_gate_interlude.mp3", "20_reading_ocean_cafe_swing.mp3"] },
        { range: "5.6-5.8", tracks: ["09_reading_earth_ocean.mp3", "28_reading_deep_castle_gate.mp3", "14_reading_australia_garden.mp3"] },
        { range: "5.9", tracks: ["20_reading_ocean_cafe_swing.mp3", "09_reading_earth_ocean.mp3"] },
      ],
    },
    "south-america": {
      pool: ["16_reading_southamerica_clocktower.mp3", "17_reading_southamerica_showa_cafe.mp3", "20_reading_ocean_cafe_swing.mp3", "28_reading_deep_castle_gate.mp3", "27_reading_sunflower_gate_interlude.mp3", "13_reading_antarctica_dark_rose.mp3"],
      segments: [
        { range: "6.1-6.2", tracks: ["17_reading_southamerica_showa_cafe.mp3", "27_reading_sunflower_gate_interlude.mp3"] },
        { range: "6.3-6.4", tracks: ["20_reading_ocean_cafe_swing.mp3", "16_reading_southamerica_clocktower.mp3"] },
        { range: "6.5-6.6", tracks: ["28_reading_deep_castle_gate.mp3", "12_reading_antarctica_ice.mp3"] },
        { range: "6.7-6.8", tracks: ["16_reading_southamerica_clocktower.mp3", "28_reading_deep_castle_gate.mp3"] },
        { range: "6.9-6.10", tracks: ["13_reading_antarctica_dark_rose.mp3", "16_reading_southamerica_clocktower.mp3"] },
        { range: "6.11-6.12", tracks: ["17_reading_southamerica_showa_cafe.mp3", "27_reading_sunflower_gate_interlude.mp3"] },
      ],
    },
    "asia": {
      pool: ["18_reading_asia_alice_key.mp3", "19_reading_asia_classroom.mp3", "26_reading_japan_showa.mp3", "27_reading_sunflower_gate_interlude.mp3", "28_reading_deep_castle_gate.mp3", "03_words_garden.mp3", "13_reading_antarctica_dark_rose.mp3"],
      segments: [
        { range: "7.1-7.3", tracks: ["28_reading_deep_castle_gate.mp3", "12_reading_antarctica_ice.mp3", "18_reading_asia_alice_key.mp3"] },
        { range: "7.4-7.6", tracks: ["27_reading_sunflower_gate_interlude.mp3", "19_reading_asia_classroom.mp3", "18_reading_asia_alice_key.mp3"] },
        { range: "7.7-7.10", tracks: ["18_reading_asia_alice_key.mp3", "28_reading_deep_castle_gate.mp3", "19_reading_asia_classroom.mp3"] },
        { range: "7.11-7.15", tracks: ["03_words_garden.mp3", "18_reading_asia_alice_key.mp3", "27_reading_sunflower_gate_interlude.mp3"] },
        { range: "7.16", tracks: ["13_reading_antarctica_dark_rose.mp3", "18_reading_asia_alice_key.mp3"] },
        { range: "7.17", tracks: ["26_reading_japan_showa.mp3", "27_reading_sunflower_gate_interlude.mp3"] },
        { range: "7.18-7.21", tracks: ["19_reading_asia_classroom.mp3", "11_reading_africa_showa_neon.mp3", "23_reading_northamerica_skip.mp3"] },
        { range: "7.22-7.23", tracks: ["27_reading_sunflower_gate_interlude.mp3", "28_reading_deep_castle_gate.mp3", "26_reading_japan_showa.mp3"] },
      ],
    },
    "oceans": {
      pool: ["20_reading_ocean_cafe_swing.mp3", "09_reading_earth_ocean.mp3", "14_reading_australia_garden.mp3", "07_reading_universe_bright.mp3", "27_reading_sunflower_gate_interlude.mp3", "16_reading_southamerica_clocktower.mp3"],
      segments: [
        { range: "8.1", tracks: ["20_reading_ocean_cafe_swing.mp3", "17_reading_southamerica_showa_cafe.mp3"] },
        { range: "8.2", tracks: ["14_reading_australia_garden.mp3", "09_reading_earth_ocean.mp3"] },
        { range: "8.3", tracks: ["16_reading_southamerica_clocktower.mp3", "20_reading_ocean_cafe_swing.mp3"] },
        { range: "8.4-8.5", tracks: ["09_reading_earth_ocean.mp3", "07_reading_universe_bright.mp3"] },
        { range: "8.6", tracks: ["27_reading_sunflower_gate_interlude.mp3", "20_reading_ocean_cafe_swing.mp3"] },
      ],
    },
    "europe": {
      pool: ["21_reading_europe_empress.mp3", "22_reading_europe_french.mp3", "28_reading_deep_castle_gate.mp3", "03_words_garden.mp3", "04_story_lobby.mp3", "27_reading_sunflower_gate_interlude.mp3", "02_note.mp3", "13_reading_antarctica_dark_rose.mp3"],
      segments: [
        { range: "9.1-9.7", tracks: ["21_reading_europe_empress.mp3", "28_reading_deep_castle_gate.mp3", "02_note.mp3"] },
        { range: "9.8-9.15", tracks: ["22_reading_europe_french.mp3", "03_words_garden.mp3", "04_story_lobby.mp3"] },
        { range: "9.16-9.24", tracks: ["22_reading_europe_french.mp3", "27_reading_sunflower_gate_interlude.mp3", "21_reading_europe_empress.mp3"] },
        { range: "9.25-9.32", tracks: ["13_reading_antarctica_dark_rose.mp3", "21_reading_europe_empress.mp3", "22_reading_europe_french.mp3"] },
        { range: "9.33-9.40", tracks: ["03_words_garden.mp3", "22_reading_europe_french.mp3", "02_note.mp3"] },
        { range: "9.41-9.47", tracks: ["28_reading_deep_castle_gate.mp3", "03_words_garden.mp3", "21_reading_europe_empress.mp3"] },
        { range: "9.48-9.50", tracks: ["13_reading_antarctica_dark_rose.mp3", "02_note.mp3", "28_reading_deep_castle_gate.mp3"] },
        { range: "9.51-9.55", tracks: ["21_reading_europe_empress.mp3", "27_reading_sunflower_gate_interlude.mp3", "22_reading_europe_french.mp3"] },
      ],
    },
    "north-america": {
      pool: ["23_reading_northamerica_skip.mp3", "24_reading_northamerica_carousel.mp3", "15_reading_pacific_schoolyard.mp3", "27_reading_sunflower_gate_interlude.mp3", "08_reading_earth_sunlit.mp3", "20_reading_ocean_cafe_swing.mp3", "13_reading_antarctica_dark_rose.mp3"],
      segments: [
        { range: "10.1-10.7", tracks: ["24_reading_northamerica_carousel.mp3", "15_reading_pacific_schoolyard.mp3", "08_reading_earth_sunlit.mp3"] },
        { range: "10.8-10.12", tracks: ["28_reading_deep_castle_gate.mp3", "13_reading_antarctica_dark_rose.mp3", "20_reading_ocean_cafe_swing.mp3"] },
        { range: "10.13-10.18", tracks: ["23_reading_northamerica_skip.mp3", "24_reading_northamerica_carousel.mp3", "08_reading_earth_sunlit.mp3"] },
        { range: "10.19-10.23", tracks: ["15_reading_pacific_schoolyard.mp3", "23_reading_northamerica_skip.mp3", "27_reading_sunflower_gate_interlude.mp3"] },
        { range: "10.24-10.30", tracks: ["24_reading_northamerica_carousel.mp3", "27_reading_sunflower_gate_interlude.mp3", "13_reading_antarctica_dark_rose.mp3"] },
        { range: "10.31-10.37", tracks: ["23_reading_northamerica_skip.mp3", "15_reading_pacific_schoolyard.mp3", "08_reading_earth_sunlit.mp3"] },
      ],
    },
  },
};
