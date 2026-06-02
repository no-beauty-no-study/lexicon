/* The Princess Lexicon — quiz.js
   Quiz state model + entry routing. Content (Silver Trial choices, Golden
   Seal dictation) is built on top of this later; this is just the backbone:

     • sectionQuizState — per (chapter, section): quiz1 / quiz2 status + counts.
       status ∈ unseen | in_progress | completed
     • currentQuizPointer is implicit: the FIRST unfinished stage in linear
       chapter→section→Quiz1→Quiz2 order, skipping sections already completed
       (e.g. cleared from Reading / Story Index). "懒人做法" — always resume the
       earliest unfinished trial.

   Three entries route differently:
     • Menu  → menuHref()    : the global next-unfinished trial.
     • Reading → readingHref(): the CURRENT section's trial (resume its stage).
     • Index → indexHref()    : that section's Quiz Status page (built later).
*/
const Quiz = (function () {
  const KEY = "tpl.quizState";

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (_) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {} }
  function k(ch, sec) { return ch + "|" + sec; }
  function blank() { return { quiz1: { status: "unseen", currentQuestionIndex: null },
                              quiz2: { status: "unseen", currentQuestionIndex: null },
                              sealedWords: 0, totalWords: 0, correctedWords: [], highMistakeWords: [] }; }

  function sectionState(ch, sec) { return load()[k(ch, sec)] || blank(); }
  function update(ch, sec, patch) {
    const s = load(); const key = k(ch, sec);
    s[key] = Object.assign(blank(), s[key], patch);
    save(s); return s[key];
  }
  function setStageStatus(ch, sec, stage, status, qIndex) {
    const cur = sectionState(ch, sec);
    cur[stage] = { status, currentQuestionIndex: (qIndex == null ? null : qIndex) };
    return update(ch, sec, cur);
  }
  function sectionCompleted(ch, sec) {
    const st = sectionState(ch, sec);
    return st.quiz1.status === "completed" && st.quiz2.status === "completed";
  }

  // Linear (chapter → section) order of every section in the book.
  function order() {
    const out = [];
    const chapters = (typeof CHAPTERS !== "undefined" && CHAPTERS) || [];
    for (const c of chapters) {
      const secs = (typeof ChapterNav !== "undefined" && ChapterNav.sectionsOf) ? (ChapterNav.sectionsOf(c.id) || []) : [];
      for (const s of secs) out.push({ chapter: c.id, section: s.number });
    }
    return out;
  }

  function quizHref(ch, sec, stage) {
    return "#quiz?chapter=" + encodeURIComponent(ch) + "&section=" + encodeURIComponent(sec)
         + "&stage=" + (stage || "silver");
  }
  function statusHref(ch, sec) {
    return "#quizstatus?chapter=" + encodeURIComponent(ch) + "&section=" + encodeURIComponent(sec);
  }

  // Menu — first unfinished stage in linear order; skip completed sections.
  function menuHref() {
    for (const { chapter, section } of order()) {
      const st = sectionState(chapter, section);
      if (st.quiz1.status !== "completed") return quizHref(chapter, section, "silver");
      if (st.quiz2.status !== "completed") return quizHref(chapter, section, "golden");
    }
    // Everything cleared → the accumulation hub.
    return "#word-garden";
  }
  // Reading — the current section's trial, resuming its open stage.
  function readingHref(ch, sec) {
    const st = sectionState(ch, sec);
    if (st.quiz1.status !== "completed") return quizHref(ch, sec, "silver");
    if (st.quiz2.status !== "completed") return quizHref(ch, sec, "golden");
    return statusHref(ch, sec);   // both done → status page
  }
  // Story Index — open that section's Quiz Status page (pick / redo).
  function indexHref(ch, sec) { return statusHref(ch, sec); }

  /* ---------- per-word mistake stats (review ordering) ----------
     Each word keeps wrong / correct counts. A "clean" un-prompted pass
     (sealed) is the ONLY correct; a wrong answer or one written after
     seeing the answer counts as WRONG ("错了之后再写对，这还算错"). The
     review priority + Words Garden order is by score = wrong − correct
     (descending) — the more a word is missed relative to nailed, the
     higher it sits; as correct overtakes wrong it sinks. */
  const SKEY = "tpl.quizWordStats";
  function loadStats() { try { return JSON.parse(localStorage.getItem(SKEY) || "{}"); } catch (_) { return {}; } }
  function saveStats(s) { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (_) {} }
  function recordWord(word, ok) {
    const k = String(word || "").toLowerCase(); if (!k) return;
    const s = loadStats();
    const e = s[k] || { w: 0, c: 0, corrected: 0, sealed: false };
    if (ok) { e.c += 1; e.sealed = true; } else { e.w += 1; }
    s[k] = e; saveStats(s);
  }
  // Seen the answer then got it right → counts as a CORRECTION, never a
  // clean correct (does not lower reviewNeed). "错了之后再写对仍算错。"
  function recordCorrected(word) {
    const k = String(word || "").toLowerCase(); if (!k) return;
    const s = loadStats();
    const e = s[k] || { w: 0, c: 0, corrected: 0, sealed: false };
    e.corrected = (e.corrected || 0) + 1; e.sealed = true;
    s[k] = e; saveStats(s);
  }
  function score(e) { return (e.w || 0) - (e.c || 0); }
  function byScore(keys, s) {
    return keys.map(k => ({ k, sc: score(s[k]) }))
      .sort((a, b) => (b.sc - a.sc) || (Math.random() - 0.5))
      .map(x => x.k);
  }
  // Accumulated (sealed) words, most-missed first, random within a tie.
  function reviewWords() { const s = loadStats(); return byScore(Object.keys(s).filter(k => s[k].sealed), s); }
  function accumulatedWords() { return reviewWords(); }
  function unsealedWords() { const s = loadStats(); return byScore(Object.keys(s).filter(k => !s[k].sealed), s); }
  function wordStat(word) { return loadStats()[String(word || "").toLowerCase()] || { w: 0, c: 0, sealed: false }; }

  return {
    sectionState, setStageStatus, update, sectionCompleted,
    order, menuHref, readingHref, indexHref, quizHref, statusHref,
    recordWord, recordCorrected, reviewWords, accumulatedWords, unsealedWords, wordStat,
  };
})();
window.Quiz = Quiz;
