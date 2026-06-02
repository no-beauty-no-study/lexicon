(function () {
  function applyPatch() {
    var navRoot = window.VOCAB_HEAD_TO_FAMILY_KIN_NAV_LITE;
    var kinRoot = window.VOCAB_KIN_CLEAN_LITE;
    if (!navRoot || !kinRoot || !navRoot.head_to_family_kin || !kinRoot.kin_clusters) {
      return false;
    }

    var clusters = {};
    kinRoot.kin_clusters.forEach(function (cluster) {
      if (cluster && cluster.cluster_id) clusters[cluster.cluster_id] = cluster;
    });

    var nav = navRoot.head_to_family_kin;
    var patchedWords = 0;
    var routeCount = 0;
    var expandedRouteCount = 0;

    Object.keys(nav).forEach(function (word) {
      var entry = nav[word];
      if (!entry || !Array.isArray(entry.family_kin_routes)) return;

      var familySet = {};
      (entry.family_words || []).forEach(function (w) {
        if (w) familySet[String(w).toLowerCase()] = true;
      });

      var kinUnion = {};
      var clusterIds = {};
      var byFamilyWord = {};

      entry.family_kin_routes.forEach(function (route) {
        routeCount++;
        if (!route || !route.kin_cluster_id) return;
        var cluster = clusters[route.kin_cluster_id];
        if (!cluster || !Array.isArray(cluster.words)) return;

        clusterIds[route.kin_cluster_id] = true;
        var routeKin = [];
        cluster.words.forEach(function (kw) {
          if (!kw) return;
          var key = String(kw).toLowerCase();
          if (familySet[key]) return;
          if (key === String(route.family_word || "").toLowerCase()) return;
          if (routeKin.indexOf(kw) < 0) routeKin.push(kw);
          kinUnion[key] = kw;
        });

        route.kin_words = routeKin;
        byFamilyWord[route.family_word || word] = routeKin;
        expandedRouteCount++;
      });

      entry.kin_cluster_ids = Object.keys(clusterIds);
      entry.kin_words_by_family_word = byFamilyWord;
      entry.kin_words = Object.keys(kinUnion)
        .map(function (k) { return kinUnion[k]; })
        .sort();

      if (entry.kin_words.length > 0) patchedWords++;
    });

    window.VOCAB_KIN_NAV_EXPANSION_PATCH_V149_AUDIT = {
      name: "VOCAB_KIN_NAV_EXPANSION_PATCH_V149",
      purpose: "Expand family_kin_routes into direct kin_words so the website does not show empty kin for words such as condense.",
      patched_words_with_kin: patchedWords,
      route_count: routeCount,
      expanded_route_count: expandedRouteCount,
      example_condense: nav.condense || null
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
