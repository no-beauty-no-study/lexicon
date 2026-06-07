/* ============================================================
   文游 scene → BGM tags (hand-authored by reading the story).

   Each entry is [blockIndex, category]: from that block onward the scene
   plays that category's track (see READING_BGM_PLAN.pathsCat) until the next
   cue. Choice moments (tension / wrong / correct / male-lead heart) are driven
   automatically by the choice structure in Views.vn, so they are NOT tagged
   here — these tags set the *ambient scene* mood only.

   Categories used: main.theme / common.daily / common.tension / common.dark /
   sealyra.monologue|effort|highlight / shiro|hosea|jael|kye .daily|heart|sad…
   ============================================================ */
window.PATHS_BGM_TAGS = {
  mainline: {
    // 1 · The Glass Elevator — office banter, Shiro's cold glass-elevator entrance
    "1":  [[0, "main.theme"], [4, "common.daily"], [13, "shiro.daily"], [16, "common.daily"]],
    // 2 · The Price of a Seat — café, Tenure-Hill social knives (Hosea only spoken of)
    "2":  [[0, "common.daily"], [6, "common.tension"], [19, "common.daily"]],
    // 3 · The Weight of a Scar — brother's ward (Kye), Jael's polished sales-threat, the memory
    "3":  [[0, "kye.daily"], [3, "jael.daily"], [12, "sealyra.monologue"], [20, "sealyra.effort"]],
    // 4 · The Forum — auditorium; Hosea speaks, then Shiro
    "4":  [[0, "common.daily"], [2, "hosea.daily"], [5, "shiro.daily"], [11, "common.daily"]],
    // 5 · The Signature — Margolis's review pressure, Shiro's suite, the signature won
    "5":  [[0, "common.daily"], [1, "common.tension"], [15, "shiro.daily"], [17, "sealyra.effort"], [22, "sealyra.monologue"]],
    // 6 · The Direction Reverses — exam, getting in, the sister call, the new dorm, Thea's chill
    "6":  [[0, "common.tension"], [5, "sealyra.highlight"], [7, "common.daily"], [24, "common.tension"], [29, "common.daily"]],
    // 7 · The One Everyone Watches — orientation; Hosea's gaze finds her; Thea's warning
    "7":  [[0, "common.daily"], [6, "hosea.daily"], [11, "hosea.heart"], [14, "common.tension"], [16, "common.daily"]],
    // 8 · The Society Fair — the fair, Hosea at the Naturalist table
    "8":  [[0, "common.daily"], [5, "hosea.daily"], [13, "common.daily"]],
    // 9 · The Naturalist Society — meeting; she fixes Rhys; Hosea notices
    "9":  [[0, "common.daily"], [2, "hosea.daily"], [8, "hosea.heart"], [10, "common.daily"]],
    // 10 · The Interview — the panel; Shiro the hostile patron; Hosea defends her
    "10": [[0, "common.tension"], [4, "shiro.daily"], [10, "hosea.heart"], [14, "common.daily"]],
    // 11 · Field Notes — the wetland, the long intimate survey with Hosea, Wren's spying
    "11": [[0, "common.daily"], [1, "hosea.daily"], [14, "hosea.heart"], [19, "common.tension"], [22, "common.daily"]],
    // 12 · The Seminar — the group; she rebuilds Thea's study; Hosea's real question
    "12": [[0, "common.daily"], [3, "common.tension"], [8, "hosea.heart"], [12, "common.tension"], [18, "common.daily"]],
  },
};
