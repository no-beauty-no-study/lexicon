/* The Princess Lexicon — Claude data supplement (V158)
   Codex ran out of token, so a few newly-promoted heads landed with no card.
   This fills their content + family, and wires their kin to the existing
   remote/promote -mot cluster. Loaded BEFORE VOCAB_RUNTIME_HELPERS so the
   helper indexes them on build. */
(function () {
  var REG  = window.VOCAB_WORD_CONTENT_REGISTRY_LITE && window.VOCAB_WORD_CONTENT_REGISTRY_LITE.cards;
  var FAMS = window.VOCAB_FAMILY_SHARED_CLUSTERS_LITE && window.VOCAB_FAMILY_SHARED_CLUSTERS_LITE.family_clusters;
  var KINS = window.VOCAB_KIN_CLEAN_LITE && window.VOCAB_KIN_CLEAN_LITE.kin_clusters;
  if (!REG || !FAMS || !KINS) return;

  function ph(p, z) { return { phrase: p, phrase_zh: z }; }
  function ex(e, z) { return { example: e, example_zh: z }; }
  function card(w, pos, zh, phrases, examples) {
    if (!REG[w]) REG[w] = { word: w, pos: pos, zh: zh, phrases: phrases || [], examples: examples || [] };
  }
  card("demote", "v.", "降级；降职；使降职",
    [ph("demote an officer", "将一名军官降级"), ph("demote to a lower rank", "降到更低职级")],
    [ex("A manager may demote an employee who repeatedly misses deadlines.", "经理可能会把屡次错过截止期限的员工降职。")]);
  card("demotion", "n.", "降级；降职",
    [ph("face demotion", "面临降职"), ph("accept a demotion", "接受降职")],
    [ex("The demotion came as a shock to the whole team.", "这次降职让整个团队都很震惊。")]);
  card("smite", "v.", "猛击；重创；突然袭击",
    [ph("smite down", "击倒"), ph("smite the foe", "重创敌人")],
    [ex("Legends say the storm could smite a ship in seconds.", "传说那场风暴能在几秒内摧毁一艘船。")]);
  card("smote", "v.", "（smite 的过去式）猛击；重创",
    [ph("smote the enemy", "重创了敌人")],
    [ex("In the old tale, the hero smote the dragon with a single blow.", "在古老的传说里，英雄一击重创了巨龙。")]);

  function addFam(id, head, words) {
    for (var i = 0; i < FAMS.length; i++) if (FAMS[i].family_id === id) return;
    FAMS.push({ family_id: id, head: head, words: words });
  }
  addFam("fam_demote", "demote", ["demote", "demotion"]);
  addFam("fam_smote", "smote", ["smote", "smite"]);

  // Kin: the helper reads kin from the NAV (head_to_family_kin[w].kin_words),
  // so give the new heads the remote/promote -mot family there, and add them
  // back into the existing heads so the link is two-way.
  var NAV = window.VOCAB_HEAD_TO_FAMILY_KIN_NAV_LITE && window.VOCAB_HEAD_TO_FAMILY_KIN_NAV_LITE.head_to_family_kin;
  if (NAV) {
    NAV["demote"] = { family_words: ["demote", "demotion"], family_kin_routes: [], kin_words: ["remote", "promote", "remove", "smote"] };
    NAV["smote"]  = { family_words: ["smote", "smite"], family_kin_routes: [], kin_words: ["remote", "promote", "remove", "demote"] };
    ["remote", "promote", "remove"].forEach(function (h) {
      var e = NAV[h]; if (!e) return;
      e.kin_words = e.kin_words || [];
      ["demote", "smote"].forEach(function (w) { if (e.kin_words.indexOf(w) < 0) e.kin_words.push(w); });
    });
  }
})();
