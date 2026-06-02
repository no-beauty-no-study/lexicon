(function () {
  var PATCH_NAME = "VOCAB_PREFIX_KIN_STRONG_OVERRIDE_PATCH_V156";

  function uniq(list) {
    var seen = {};
    return (list || []).filter(function (w) {
      if (!w) return false;
      var k = String(w).toLowerCase();
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }

  function nav() {
    return window.VOCAB_HEAD_TO_FAMILY_KIN_NAV_LITE && window.VOCAB_HEAD_TO_FAMILY_KIN_NAV_LITE.head_to_family_kin;
  }

  function ensure(word) {
    var n = nav();
    if (!n) return null;
    if (!n[word]) n[word] = { family_id: "patch_" + word, family_words: [word], family_kin_routes: [] };
    if (!Array.isArray(n[word].family_words)) n[word].family_words = [word];
    return n[word];
  }

  function setRoute(word, head, source) {
    var rw = window.VOCAB_READING_WORDS_LITE;
    if (!rw || !rw.reading_to_learning_head) return;
    if (!rw.reading_to_learning_head[word]) rw.reading_to_learning_head[word] = { word: word };
    rw.reading_to_learning_head[word].learning_head = head;
    rw.reading_to_learning_head[word].source = source;
    rw.reading_to_learning_head[word].head_card_available = true;
  }

  function isPollutedKinWord(w) {
    w = String(w || "").toLowerCase();
    if (!w) return true;
    if (/-(based|related|level|system)$/.test(w)) return true;
    if (/(controlrod|remotecontrol|dopaminelevel|precinctlevel)$/.test(w)) return true;
    if (/(brushwood|dyewood|elkwood|poisonwood|zebrawood|horizonline|trenchline)$/.test(w)) return true;
    if (/(source|therapy|receptor|material|dataset|data)$/.test(w) && w.length > 8) return true;
    return false;
  }

  function cleanEntry(word) {
    var e = ensure(word);
    if (!e) return null;
    e.family_words = uniq(e.family_words || []).filter(function (w) { return !isPollutedKinWord(w); });
    e.kin_words = uniq(e.kin_words || []).filter(function (w) { return !isPollutedKinWord(w); });
    e.visible_kin_words = uniq(e.visible_kin_words || e.kin_words || []).filter(function (w) { return !isPollutedKinWord(w); });
    e.display_sections = { family: e.family_words || [], kin: e.visible_kin_words || [] };
    e.hide_family_kin_label = true;
    return e;
  }

  function setStrongKinGroup(words, rootNote) {
    words = uniq(words);
    words.forEach(function (word) {
      var e = cleanEntry(word);
      if (!e) return;
      var familySet = {};
      (e.family_words || []).forEach(function (fw) { familySet[String(fw).toLowerCase()] = true; });
      var own = String(word).toLowerCase();
      var kin = words.filter(function (w) {
        var k = String(w).toLowerCase();
        return k !== own && !familySet[k] && !isPollutedKinWord(k);
      });
      e.kin_words = kin;
      e.visible_kin_words = kin;
      e.display_sections = { family: e.family_words || [], kin: kin };
      e.hide_family_kin_label = true;
      e.kin_patch_note = PATCH_NAME + ": strong prefix-control kin, " + rootNote;
    });
  }

  function collectWords() {
    var set = {};
    var n = nav();
    var rw = window.VOCAB_READING_WORDS_LITE;
    if (n) {
      Object.keys(n).forEach(function (w) {
        set[String(w).toLowerCase()] = true;
        (n[w].family_words || []).forEach(function (fw) { set[String(fw).toLowerCase()] = true; });
      });
    }
    if (rw && rw.reading_to_learning_head) {
      Object.keys(rw.reading_to_learning_head).forEach(function (w) {
        set[String(w).toLowerCase()] = true;
        var h = rw.reading_to_learning_head[w] && rw.reading_to_learning_head[w].learning_head;
        if (h) set[String(h).toLowerCase()] = true;
      });
    }
    return set;
  }

  function prefixBase(word, prefixes) {
    var w = String(word).toLowerCase();
    for (var i = 0; i < prefixes.length; i++) {
      var p = prefixes[i];
      if (w.indexOf(p) === 0 && w.length >= p.length + 4) {
        var base = w.slice(p.length);
        if (/^[a-z]{4,}$/.test(base)) return { prefix: p, base: base };
      }
    }
    return null;
  }

  function patchAutoControlGroups() {
    var prefixes = [
      "counter", "contra", "circum", "trans", "inter", "under", "super", "intro", "intra", "extra",
      "ultra", "hyper", "hypo", "retro", "anti", "ante", "post", "para", "peri", "meta",
      "over", "fore", "con", "com", "col", "cor", "pro", "pre", "per", "sub", "sup", "sur",
      "ob", "op", "oc", "of", "en", "em", "ab", "ad", "ac", "af", "ag", "al", "an", "ap",
      "ar", "as", "at", "re", "de", "ex", "in", "im", "ir", "il", "e", "s"
    ];
    var badBases = {
      tion: true, sion: true, ness: true, ment: true, able: true, ible: true, ally: true,
      ical: true, less: true, ship: true, hood: true, ward: true, wise: true, like: true,
      ful: true, ance: true, ence: true, ing: true, ed: true, er: true, or: true,
      ist: true, ism: true, ity: true, al: true, ly: true, ic: true
    };
    var words = collectWords();
    var groups = {};
    Object.keys(words).forEach(function (w) {
      if (!/^[a-z]+$/.test(w) || isPollutedKinWord(w)) return;
      var pb = prefixBase(w, prefixes);
      if (!pb || badBases[pb.base]) return;
      if (!groups[pb.base]) groups[pb.base] = [];
      groups[pb.base].push(w);
    });
    var used = 0;
    Object.keys(groups).forEach(function (base) {
      var members = uniq(groups[base]).filter(function (w) { return w.length >= 4; });
      if (members.length < 3) return;
      used++;
      members.slice(0, 12).forEach(function (word) {
        var e = cleanEntry(word);
        if (!e) return;
        var family = {};
        (e.family_words || []).forEach(function (fw) { family[String(fw).toLowerCase()] = true; });
        var kin = members.filter(function (m) {
          var k = String(m).toLowerCase();
          return k !== String(word).toLowerCase() && !family[k] && !isPollutedKinWord(k);
        }).slice(0, 10);
        if (kin.length) {
          e.visible_kin_words = uniq([].concat(e.visible_kin_words || [], kin));
          e.kin_words = e.visible_kin_words;
          e.display_sections = { family: e.family_words || [], kin: e.visible_kin_words };
          e.hide_family_kin_label = true;
          e.kin_patch_note = PATCH_NAME + ": auto prefix-control base " + base;
        }
      });
    });
    return used;
  }

  function applyPatch() {
    if (!nav() || !window.VOCAB_READING_WORDS_LITE) return false;

    [
      ["remote", "remote"], ["remotely", "remote"], ["control", "control"],
      ["golden", "gold"], ["gold-plated", "gold"],
      ["brush", "brush"], ["dopamine", "dopamine"], ["dye", "dye"], ["elk", "elk"],
      ["horizon", "horizon"], ["poison", "poison"], ["precinct", "precinct"],
      ["trench", "trench"], ["zebra", "zebra"]
    ].forEach(function (r) { setRoute(r[0], r[1], PATCH_NAME); });

    var groups = {
      mote: ["remote", "promote", "demote", "emote", "locomote", "smote"],
      tain: ["obtain", "retain", "contain", "sustain", "detain", "pertain", "attain", "abstain"],
      ject: ["project", "reject", "inject", "object", "subject", "eject"],
      spect: ["inspect", "prospect", "respect", "suspect", "retrospect"],
      struct: ["construct", "instruct", "obstruct", "destruct", "restructure"],
      duct: ["conduct", "induct", "deduct", "subduct"],
      duce: ["produce", "reduce", "introduce", "seduce"],
      tract: ["attract", "contract", "distract", "extract", "retract"],
      clude: ["conclude", "include", "exclude", "preclude", "occlude"],
      ceive: ["receive", "deceive", "conceive", "perceive"],
      cept: ["accept", "except", "intercept", "concept"],
      pose: ["compose", "depose", "expose", "impose", "oppose", "propose", "suppose", "transpose"],
      press: ["compress", "depress", "express", "impress", "oppress", "suppress"],
      sist: ["consist", "desist", "exist", "insist", "persist", "resist", "subsist"],
      mit: ["commit", "emit", "omit", "permit", "submit", "transmit"],
      miss: ["commission", "emission", "omission", "permission", "submission", "transmission"],
      port: ["import", "export", "transport", "report", "support", "deport"],
      flect: ["reflect", "deflect", "inflect"],
      flex: ["reflective", "deflective", "inflective"],
      vert: ["convert", "divert", "invert", "revert", "subvert"],
      vers: ["conversion", "diversion", "inversion", "reversion", "subversion"],
      fer: ["confer", "infer", "prefer", "refer", "transfer"],
      cede: ["concede", "exceed", "precede", "proceed", "recede"],
      cess: ["access", "excess", "process", "recess", "success"],
      scribe: ["describe", "inscribe", "prescribe", "subscribe", "transcribe"],
      script: ["description", "inscription", "prescription", "subscription", "transcription"],
      rupt: ["corrupt", "disrupt", "erupt", "interrupt", "rupture"],
      voke: ["evoke", "invoke", "provoke", "revoke"],
      solve: ["absolve", "dissolve", "resolve", "solve"],
      ply: ["apply", "comply", "imply", "reply"],
      merge: ["emerge", "merge", "submerge"],
      form: ["conform", "deform", "inform", "perform", "reform", "transform"],
      pel: ["compel", "dispel", "expel", "impel", "propel", "repel"],
      pulse: ["compulsion", "expulsion", "impulse", "propulsion", "repulsion"],
      tend: ["attend", "contend", "extend", "intend", "pretend"],
      tense: ["attention", "contention", "extension", "intention", "pretension"],
      sist_adj: ["consistent", "existent", "insistent", "persistent", "resistant"],
      gular: ["singular", "regular", "irregular", "triangular"],
      gularity: ["singularity", "regularity", "irregularity"]
    };

    Object.keys(groups).forEach(function (root) {
      setStrongKinGroup(groups[root], "root/body " + root);
    });

    var autoGroups = patchAutoControlGroups();
    var cleaned = 0;
    Object.keys(nav()).forEach(function (word) {
      cleanEntry(word);
      cleaned++;
    });

    window.VOCAB_PREFIX_KIN_STRONG_OVERRIDE_PATCH_V156_AUDIT = {
      name: PATCH_NAME,
      purpose: "Load-last override: clean polluted kin and enforce high-value prefix-control kin groups.",
      explicit_groups: Object.keys(groups).length,
      auto_prefix_groups_used: autoGroups,
      cleaned_nav_entries: cleaned,
      ui_rule: "Show only family and kin. Do not show family_kin_routes as a user-facing section.",
      examples: {
        remote: nav().remote || null,
        control: nav().control || null,
        condense: nav().condense || null,
        obtain: nav().obtain || null
      }
    };
    return true;
  }

  if (!applyPatch()) {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (applyPatch() || tries > 50) clearInterval(timer);
    }, 100);
  }
})();
