/* The Princess Lexicon — bgm.js
   Page-aware background music for the single-page app. One Audio element
   lives for the whole session and crossfades between tracks on view change.
   The assignment plan (data/readingBgmPlan.js → window.READING_BGM_PLAN) is
   the source of truth; this file only resolves "where am I → which track"
   and handles rotation. app.js calls BGM.applyForView(name, params) on every
   hash change. */
(function () {
  const BGM_DIR = "assets/bgm/";
  const BGM_VER = "20260607l";                 // cache-bust revised tracks
  const srcOf = (t) => BGM_DIR + t + "?v=" + BGM_VER;
  const DEFAULT_VOLUME = 0.55;
  function plan() { return (typeof window !== "undefined" && window.READING_BGM_PLAN) || null; }

  let audio        = null;
  let currentTrack = null;
  let manualTrack  = null;   // set by nextTrack(); cleared by autoMode()

  // When a reading section maps to a track ARRAY, we remember it so the
  // reader who lingers past one loop hears the next track in the set rather
  // than the same one forever. null ⇒ single track, plain loop.
  let activeArray  = null;
  let activeIdx    = 0;

  let userVolume = (() => {
    try {
      const v = parseFloat(localStorage.getItem("tpl.bgmVol"));
      if (!isFinite(v) || v < 0.02) return DEFAULT_VOLUME;
      return Math.min(1, v);
    } catch (_) { return DEFAULT_VOLUME; }
  })();

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = "auto";
    audio.volume = 0;
    // Advance through a section's track array on track-end (when looping is
    // off because an array is active); otherwise the element loops itself.
    audio.addEventListener("ended", () => {
      if (!activeArray || activeArray.length < 2) { if (audio.loop === false) { try { audio.currentTime = 0; audio.play(); } catch (_) {} } return; }
      let next = (activeIdx + 1) % activeArray.length;
      if (activeArray[next] === currentTrack && activeArray.length > 1) next = (next + 1) % activeArray.length;
      activeIdx = next;
      currentTrack = activeArray[next];
      audio.src = srcOf(currentTrack);
      try { audio.currentTime = 0; } catch (_) {}
      playNow();
    });
    return audio;
  }

  function clampVol(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  let fadeTok = 0;
  function fade(target, ms, onDone) {
    if (!audio) return;
    const mine = ++fadeTok;
    const start = audio.volume;
    const t0 = performance.now();
    (function step(now) {
      if (mine !== fadeTok) return;
      const p = Math.min(1, (now - t0) / ms);
      audio.volume = clampVol(start + (target - start) * p);
      if (p < 1) requestAnimationFrame(step);
      else if (onDone) onDone();
    })(t0);
  }

  // ---- plan resolution ----------------------------------------------------
  // major.minor → comparable number (1.10 sorts after 1.9).
  function secVal(s) {
    const m = String(s || "").match(/(\d+)(?:\.(\d+))?/);
    if (!m) return -1;
    return parseInt(m[1], 10) * 1000 + (m[2] ? parseInt(m[2], 10) : 0);
  }
  // Tracks for a section, from an ordered [{from, tracks}] list.
  function rangeTracks(ranges, section) {
    const sv = secVal(section);
    let pick = ranges[0];
    for (const r of ranges) { if (secVal(r.from) <= sv) pick = r; else break; }
    return (pick && pick.tracks) || [];
  }
  // Section's ordinal position within its chapter (for rotation). Falls back
  // to the minor number when ChapterNav can't answer.
  function sectionOrdinal(chapter, section) {
    try {
      if (typeof ChapterNav !== "undefined" && ChapterNav.sectionsOf) {
        const secs = ChapterNav.sectionsOf(chapter) || [];
        const at = secs.findIndex(s => String(s.number) === String(section));
        if (at >= 0) return at;
      }
    } catch (_) {}
    return secVal(section) % 1000;
  }
  function isPathChapter(ch) {
    if (typeof CHAPTER_CONTENT !== "undefined" && CHAPTER_CONTENT[ch]) return !!CHAPTER_CONTENT[ch]._path;
    const p = plan(); return !!(p && p.pathsByChar && p.pathsByChar[ch]);
  }

  // Returns { track, array } for a view. array != null ⇒ rotate + no loop.
  function resolve(name, params) {
    const p = plan();
    if (!p) return null;
    if (name === "vn") {
      // 文游 scene track. Prefer the hand-authored opening scene tag for this
      // chapter; else the chapter protagonist's DAILY loop. Later scene shifts
      // (tension / heart / wrong / correct) are cued by Views.vn.
      const sc = p.pathsScene, cat = p.pathsCat || {};
      const story = (params && params.story) || "mainline";
      const ch = String((params && params.ch) || "");
      let track = null;
      try {
        const tags = (typeof window !== "undefined") && window.PATHS_BGM_TAGS;
        const list = tags && tags[story] && tags[story][ch];
        if (list && list[0]) { const tg = list[0][1]; track = cat[tg] || (tg && tg.indexOf("/") >= 0 ? tg : null); }
      } catch (_) {}
      const who = (params && params.path) || "sealyra";
      if (!track) track = sc && sc.lead && sc.lead[who] && sc.lead[who].daily;
      if (!track) track = (sc && sc.common) || (p.byView && p.byView.paths);
      return track ? { track, array: null } : null;
    }
    if (name === "reading") {
      const ch = (params && params.chapter) || "";
      let arr = null;
      if (isPathChapter(ch)) arr = (p.pathsByChar && p.pathsByChar[ch]) || [p.byView && p.byView.paths].filter(Boolean);
      else if (p.reading && p.reading[ch]) arr = rangeTracks(p.reading[ch], params && params.section);
      if (!arr || !arr.length) return null;
      if (arr.length === 1) return { track: arr[0], array: null };
      const ord = sectionOrdinal(ch, params && params.section);
      let idx = ord % arr.length;
      if (arr[idx] === currentTrack && arr.length > 1) idx = (idx + 1) % arr.length;  // no back-to-back repeat
      return { track: arr[idx], array: arr, idx };
    }
    if (name === "quiz" || name === "quizstatus" || name === "comprehension") {
      const qs = p.quizByStage || {};
      const st = params && params.stage;
      const key = st === "golden" ? "golden"
                : (st === "seal" || st === "dictation") ? "dictation"
                : "default";
      return mk(qs[key] || qs.default || p.ui);
    }
    if (name === "review")
      return mk((p.quizByStage && p.quizByStage.review) || p.ui);
    return mk((p.byView && p.byView[name]) || p.ui);
  }
  function mk(track) { return track ? { track, array: null } : null; }

  function playNow() {
    if (!audio) return;
    const pr = audio.play();
    if (pr && pr.then) pr.then(() => fade(userVolume, 600)).catch(() => {});
  }

  function switchTo(res) {
    ensureAudio();
    activeArray = res.array || null;
    activeIdx   = res.idx || 0;
    audio.loop  = !res.array;                 // single track loops; arrays rotate on 'ended'
    if (res.track === currentTrack) { if (audio.paused) playNow(); return; }
    const set = () => {
      currentTrack = res.track;
      audio.src = srcOf(res.track);
      try { audio.currentTime = 0; } catch (_) {}
      playNow();
    };
    if (currentTrack) fade(0, 220, set); else set();
  }

  function applyForView(name, params) {
    const p = plan();
    // Hold views (Save / Load): keep the current song. If nothing is playing,
    // fall back to the UI track so the pop-up isn't dead silent.
    if (p && Array.isArray(p.holdViews) && p.holdViews.indexOf(name) >= 0) {
      if (audio && !audio.paused) return;
      if (currentTrack) { if (audio && audio.paused) playNow(); return; }
      if (p.ui) switchTo({ track: p.ui, array: null });
      return;
    }
    const res = manualTrack ? { track: manualTrack, array: null } : resolve(name, params);
    if (!res || !res.track) {        // nothing mapped → silence
      if (audio && !audio.paused) fade(0, 200, () => { try { audio.pause(); } catch (_) {} currentTrack = null; activeArray = null; });
      return;
    }
    switchTo(res);
  }

  function wakeUp() { if (audio && audio.paused && currentTrack) playNow(); }
  ["touchstart", "pointerdown", "click", "keydown"].forEach(ev =>
    document.addEventListener(ev, wakeUp, { passive: true }));

  // ---- public controls ----------------------------------------------------
  function setVolume(v) {
    const n = parseFloat(v);
    userVolume = isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
    try { localStorage.setItem("tpl.bgmVol", String(userVolume)); } catch (_) {}
    if (audio) { fadeTok++; audio.volume = userVolume; }
  }
  function getVolume() { return userVolume; }

  // Inventory for manual cycling: every distinct track named in the plan.
  function allTracks() {
    const p = plan(); if (!p) return [];
    const set = new Set();
    if (p.ui) set.add(p.ui);
    Object.values(p.byView || {}).forEach(t => t && set.add(t));
    Object.values(p.quizByStage || {}).forEach(t => t && set.add(t));
    Object.values(p.reading || {}).forEach(rs => (rs || []).forEach(r => (r.tracks || []).forEach(t => set.add(t))));
    Object.values(p.pathsByChar || {}).forEach(arr => (arr || []).forEach(t => set.add(t)));
    return [...set];
  }
  function nextTrack() {
    const list = allTracks();
    if (!list.length) return null;
    ensureAudio();
    const i = list.indexOf(currentTrack);
    const next = list[(i + 1 + list.length) % list.length];
    manualTrack = next; activeArray = null; audio.loop = true;
    fade(0, 180, () => { currentTrack = next; audio.src = srcOf(next); try { audio.currentTime = 0; } catch (_) {} playNow(); });
    return next;
  }
  function autoMode() { manualTrack = null; }

  // Switch to a named quiz stage mid-quiz (silver→golden→dictation) without a
  // route change. views.js calls this at stage transitions; a later
  // applyForView (leaving the quiz) takes over again.
  function cueStage(stage) {
    const p = plan(); if (!p || !p.quizByStage) return;
    const track = p.quizByStage[stage]; if (!track) return;
    manualTrack = null;
    switchTo({ track, array: null });
  }

  // Play a specific track now (e.g. the 文游 choice-prompt / right / wrong
  // stingers). Transient: a later applyForView restores the scene track.
  function cueTrack(track) {
    if (!track) return;
    manualTrack = null;
    switchTo({ track, array: null });
  }

  window.BGM = { applyForView, setVolume, getVolume, nextTrack, autoMode, cueStage, cueTrack };
})();
