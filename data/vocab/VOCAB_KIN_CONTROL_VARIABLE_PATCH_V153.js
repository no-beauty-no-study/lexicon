(function () {
  var PATCH_NAME = "VOCAB_KIN_CONTROL_VARIABLE_PATCH_V153";

  function unique(list) {
    var seen = {};
    return (list || []).filter(function (w) {
      if (!w) return false;
      var key = String(w).toLowerCase();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function removeWords(list, badWords) {
    var bad = {};
    (badWords || []).forEach(function (w) { bad[String(w).toLowerCase()] = true; });
    return (list || []).filter(function (w) {
      return !bad[String(w).toLowerCase()];
    });
  }

  function getNav() {
    return window.VOCAB_HEAD_TO_FAMILY_KIN_NAV_LITE && window.VOCAB_HEAD_TO_FAMILY_KIN_NAV_LITE.head_to_family_kin;
  }

  function setRoute(word, head, source) {
    var rw = window.VOCAB_READING_WORDS_LITE;
    if (!rw || !rw.reading_to_learning_head) return false;
    if (!rw.reading_to_learning_head[word]) rw.reading_to_learning_head[word] = { word: word };
    rw.reading_to_learning_head[word].learning_head = head;
    rw.reading_to_learning_head[word].source = source;
    rw.reading_to_learning_head[word].head_card_available = true;
    return true;
  }

  function ensureNavWord(word) {
    var nav = getNav();
    if (!nav) return null;
    if (!nav[word]) nav[word] = { family_id: "patch_" + word, family_words: [word], family_kin_routes: [] };
    if (!Array.isArray(nav[word].family_words)) nav[word].family_words = [word];
    return nav[word];
  }

  function mergeKin(word, kinWords, note) {
    var entry = ensureNavWord(word);
    if (!entry) return false;
    var familySet = {};
    (entry.family_words || []).forEach(function (w) { familySet[String(w).toLowerCase()] = true; });
    var own = String(word).toLowerCase();
    var merged = unique([].concat(entry.kin_words || [], entry.visible_kin_words || [], kinWords || []))
      .filter(function (w) {
        var k = String(w).toLowerCase();
        return k !== own && !familySet[k];
      });
    entry.kin_words = merged;
    entry.visible_kin_words = merged;
    entry.display_sections = {
      family: entry.family_words || [],
      kin: entry.visible_kin_words || []
    };
    entry.hide_family_kin_label = true;
    if (note) entry.kin_patch_note = note;
    return merged.length > 0;
  }

  function expandExistingKinRoutes() {
    var nav = getNav();
    var kinRoot = window.VOCAB_KIN_CLEAN_LITE;
    if (!nav || !kinRoot || !Array.isArray(kinRoot.kin_clusters)) return { patched: 0, routes: 0 };

    var clusters = {};
    kinRoot.kin_clusters.forEach(function (cluster) {
      if (cluster && cluster.cluster_id) clusters[cluster.cluster_id] = cluster;
    });

    var patched = 0;
    var routes = 0;
    Object.keys(nav).forEach(function (word) {
      var entry = nav[word];
      if (!entry || !Array.isArray(entry.family_kin_routes)) return;
      var familySet = {};
      (entry.family_words || []).forEach(function (w) { familySet[String(w).toLowerCase()] = true; });
      var union = [];
      var byFamilyWord = entry.kin_words_by_family_word || {};
      var clusterIds = entry.kin_cluster_ids || [];

      entry.family_kin_routes.forEach(function (route) {
        routes++;
        if (!route || !route.kin_cluster_id) return;
        var cluster = clusters[route.kin_cluster_id];
        if (!cluster || !Array.isArray(cluster.words)) return;

        if (clusterIds.indexOf(route.kin_cluster_id) < 0) clusterIds.push(route.kin_cluster_id);
        var routeKin = [];
        cluster.words.forEach(function (kw) {
          if (!kw) return;
          var key = String(kw).toLowerCase();
          if (familySet[key]) return;
          if (key === String(route.family_word || word).toLowerCase()) return;
          routeKin.push(kw);
          union.push(kw);
        });
        route.kin_words = unique(routeKin);
        byFamilyWord[route.family_word || word] = route.kin_words;
      });

      entry.kin_cluster_ids = unique(clusterIds);
      entry.kin_words_by_family_word = byFamilyWord;
      if (mergeKin(word, union, "V153: expanded existing family_kin_routes into visible kin.")) patched++;
    });

    return { patched: patched, routes: routes };
  }

  function patchKnownBadRoutes() {
    var nav = getNav();
    if (!nav || !window.VOCAB_READING_WORDS_LITE) return 0;
    var count = 0;

    [
      ["remote", "remote"],
      ["remotely", "remote"],
      ["control", "control"],
      ["golden", "gold"],
      ["gold-plated", "gold"],
      ["brush", "brush"],
      ["dopamine", "dopamine"],
      ["dye", "dye"],
      ["elk", "elk"],
      ["horizon", "horizon"],
      ["poison", "poison"],
      ["precinct", "precinct"],
      ["trench", "trench"],
      ["zebra", "zebra"]
    ].forEach(function (pair) {
      if (setRoute(pair[0], pair[1], "v153_fix_bad_compound_or_tool_head")) count++;
    });

    if (nav.remote) {
      nav.remote.family_words = removeWords(nav.remote.family_words, ["remotecontrol"]);
      mergeKin("remote", ["promote", "remove"], "V153: remote uses mov/mot/move direction kin; remotecontrol removed from family.");
    }
    if (nav.control) {
      nav.control.family_words = removeWords(nav.control.family_words, ["controlrod", "control-system"]);
      mergeKin("control", ["countercontrol"], "V153: control no longer routes to controlrod.");
    }
    [
      ["brush", ["brushwood"]],
      ["dopamine", ["dopaminelevel"]],
      ["dye", ["dyewood"]],
      ["elk", ["elkwood"]],
      ["horizon", ["horizonline"]],
      ["poison", ["poisonwood"]],
      ["precinct", ["precinctlevel"]],
      ["trench", ["trenchline"]],
      ["zebra", ["zebrawood"]]
    ].forEach(function (pair) {
      var entry = nav[pair[0]];
      if (!entry) return;
      entry.family_words = removeWords(entry.family_words, pair[1]);
      entry.display_sections = { family: entry.family_words || [pair[0]], kin: entry.visible_kin_words || entry.kin_words || [] };
      entry.hide_family_kin_label = true;
      entry.ui_note = "V153: base word should not route to a compound/tool head.";
    });

    return count;
  }

  function collectWordSet() {
    var set = {};
    var nav = getNav();
    var rw = window.VOCAB_READING_WORDS_LITE;
    if (nav) {
      Object.keys(nav).forEach(function (w) {
        set[String(w).toLowerCase()] = true;
        (nav[w].family_words || []).forEach(function (fw) { set[String(fw).toLowerCase()] = true; });
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
        if (/^[a-z]+$/.test(base)) return { prefix: p, base: base };
      }
    }
    return null;
  }

  function patchPrefixControlKin() {
    var nav = getNav();
    if (!nav) return { groups: 0, patchedWords: 0 };

    var prefixes = [
      "counter", "inter", "intro", "under", "super", "trans", "retro",
      "anti", "over", "down", "con", "com", "col", "cor", "dis",
      "sub", "pro", "pre", "out", "mis", "de", "ex", "in", "im",
      "ir", "il", "re", "co", "up"
    ];
    var badBases = {
      able: true, ible: true, tion: true, sion: true, ness: true, ment: true,
      ity: true, tive: true, sive: true, cal: true, ally: true, ly: true
    };

    var wordSet = collectWordSet();
    var groups = {};
    Object.keys(wordSet).forEach(function (w) {
      if (!/^[a-z]+$/.test(w)) return;
      var pb = prefixBase(w, prefixes);
      if (!pb || pb.base.length < 4 || badBases[pb.base]) return;
      if (!groups[pb.base]) groups[pb.base] = [];
      groups[pb.base].push(w);
    });

    var groupCount = 0;
    var patchedWords = 0;
    Object.keys(groups).forEach(function (base) {
      var members = unique(groups[base]);
      if (wordSet[base]) members.unshift(base);
      members = unique(members).filter(function (w) { return w.length >= 4; });
      if (members.length < 2) return;

      groupCount++;
      members.forEach(function (word) {
        var entry = ensureNavWord(word);
        if (!entry) return;
        var familySet = {};
        (entry.family_words || []).forEach(function (fw) { familySet[String(fw).toLowerCase()] = true; });
        var kin = members.filter(function (m) {
          var key = String(m).toLowerCase();
          return key !== String(word).toLowerCase() && !familySet[key];
        }).slice(0, 10);
        if (kin.length && mergeKin(word, kin, "V153: visible kin inferred by prefix control-variable group: " + base)) {
          patchedWords++;
        }
      });
    });

    return { groups: groupCount, patchedWords: patchedWords };
  }

  function patchExplicitUsefulShapeKin() {
    var count = 0;
    if (mergeKin("singular", ["regular", "irregular", "triangular"], "V153: -gular visible shape kin kept for learning value.")) count++;
    if (mergeKin("singularity", ["regularity", "irregularity"], "V153: -gularity visible shape kin kept for learning value.")) count++;
    return count;
  }

  function normalizeDisplaySections() {
    var nav = getNav();
    if (!nav) return 0;
    var count = 0;
    Object.keys(nav).forEach(function (word) {
      var entry = nav[word];
      if (!entry) return;
      entry.visible_kin_words = unique(entry.visible_kin_words || entry.kin_words || []);
      entry.display_sections = {
        family: entry.family_words || [],
        kin: entry.visible_kin_words
      };
      entry.hide_family_kin_label = true;
      count++;
    });
    return count;
  }

  function applyPatch() {
    if (!getNav() || !window.VOCAB_READING_WORDS_LITE) return false;
    var expanded = expandExistingKinRoutes();
    var routeFixes = patchKnownBadRoutes();
    var prefix = patchPrefixControlKin();
    var explicit = patchExplicitUsefulShapeKin();
    var normalized = normalizeDisplaySections();

    window.VOCAB_KIN_CONTROL_VARIABLE_PATCH_V153_AUDIT = {
      name: PATCH_NAME,
      purpose: "One consolidated patch: expand route-based kin, repair known bad heads, and add visible prefix control-variable kin.",
      expanded_route_words: expanded.patched,
      expanded_routes: expanded.routes,
      fixed_bad_routes: routeFixes,
      prefix_groups_used: prefix.groups,
      prefix_patched_words: prefix.patchedWords,
      explicit_shape_kin_patched_words: explicit,
      normalized_nav_entries: normalized,
      ui_rule: "Frontend should display only Family and Kin. family_kin_routes is internal navigation data.",
      examples: {
        condense: getNav().condense || null,
        singular: getNav().singular || null,
        remote: getNav().remote || null
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
