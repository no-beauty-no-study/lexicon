/* ============================================================
   文游 scene → BGM tags (hand-authored by reading the story).

   Each entry is [blockIndex, category]: from that block onward the scene plays
   that category's track (see READING_BGM_PLAN.pathsCat) until the next cue.
   Choice moments (tension / wrong / correct / male-lead heart) are cued
   automatically by Views.vn, so they are NOT tagged here.

   PRINCIPLE: when several people are present / the scene is social·class·status
   (even if a lead is in the room but the camera has NOT narrowed onto him),
   use an unsigned social.* track — NOT his solo cue. Lead cues (shiro/hosea/
   jael/kye .daily|heart|sad|sweet) are only for scenes that narrow to him
   (private / 2-person / romantic). Sealyra cues for her inner / highlight beats.
   ============================================================ */
window.PATHS_BGM_TAGS = {
  mainline: {
    // 1 · The Glass Elevator — office banter, Shiro's PUBLIC elevator reveal (watched by all → social)
    "1":  [[0, "social.workday"], [13, "social.public"], [16, "social.workday"]],
    // 2 · The Price of a Seat — café; the Tenure-Hill girls' social knife-work
    "2":  [[0, "social.workday"], [2, "social.pressure"], [19, "social.workday"]],
    // 3 · The Weight of a Scar — brother's ward (private), Jael's polite-threat (2-person), the memory
    "3":  [[0, "kye.daily"], [3, "jael.daily"], [12, "sealyra.monologue"], [20, "sealyra.effort"]],
    // 4 · The Forum — auditorium stage (public), Shiro's cold authority, Vivienne's car strategy
    "4":  [[0, "social.public"], [5, "social.power"], [11, "social.strategy"]],
    // 5 · The Signature — Margolis's judging review, Shiro's corridor, the signature won
    "5":  [[0, "social.pressure"], [15, "social.workday"], [17, "sealyra.effort"], [22, "sealyra.monologue"]],
    // 6 · The Direction Reverses — exam pressure, getting in, the sister call, dorm, Thea's chill
    "6":  [[0, "social.pressure"], [5, "sealyra.highlight"], [7, "social.idle"], [18, "social.workday"], [24, "social.pressure"], [29, "social.workday"]],
    // 7 · The One Everyone Watches — orientation (campus), Hosea on stage (public), his gaze finds HER (narrows → heart)
    "7":  [[0, "social.workday"], [4, "social.campus"], [6, "social.public"], [11, "hosea.heart"], [14, "social.pressure"], [16, "social.workday"]],
    // 8 · The Society Fair — the fair (campus group), Hosea working the table (public)
    "8":  [[0, "social.campus"], [5, "social.public"], [13, "social.campus"]],
    // 9 · The Naturalist Society — academic meeting (strategy), Hosea presents (public), he narrows to her
    "9":  [[0, "social.strategy"], [2, "social.public"], [8, "hosea.heart"], [10, "social.workday"]],
    // 10 · The Interview — the panel (judged), Shiro's hostile authority (public), Hosea defends (narrows → heart)
    "10": [[0, "social.pressure"], [4, "social.power"], [10, "hosea.heart"], [14, "social.workday"]],
    // 11 · Field Notes — the field trip, the PRIVATE 2-person reed-bed survey with Hosea, Wren's spying
    "11": [[0, "social.progression"], [1, "hosea.daily"], [14, "hosea.heart"], [19, "social.pressure"], [22, "social.workday"]],
    // 12 · The Seminar — academic group (strategy), Thea's pressure, Hosea's real question (narrows → heart)
    "12": [[0, "social.strategy"], [3, "social.pressure"], [8, "hosea.heart"], [12, "social.pressure"], [18, "social.workday"]],
  },
};
