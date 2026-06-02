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

  // `from` records the entry path (menu | story | index) so the quiz's
  // return button knows where to go back to.
  function quizHref(ch, sec, stage, from) {
    return "#quiz?chapter=" + encodeURIComponent(ch) + "&section=" + encodeURIComponent(sec)
         + "&stage=" + (stage || "silver") + (from ? "&from=" + from : "");
  }
  function statusHref(ch, sec) {
    return "#quizstatus?chapter=" + encodeURIComponent(ch) + "&section=" + encodeURIComponent(sec);
  }

  // Menu — first section whose CHOICE quiz (quiz1) isn't done, linear order.
  // Dictation (Golden) is independent and NOT part of the main line.
  function menuHref(from) {
    from = from || "menu";
    for (const { chapter, section } of order()) {
      const st = sectionState(chapter, section);
      if (st.quiz1.status !== "completed") return quizHref(chapter, section, "silver", from);
    }
    return "#word-garden";
  }
  // Reading / Index — straight into the section's choice quiz (word → group).
  function readingHref(ch, sec) { return quizHref(ch, sec, "silver", "story"); }
  function indexHref(ch, sec)   { return quizHref(ch, sec, "silver", "index"); }

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
    const e = s[k] || { w: 0, c: 0, corrected: 0, collected: false, spelled: false };
    if (ok) { e.c += 1; e.collected = true; } else { e.w += 1; }
    s[k] = e; saveStats(s);
  }
  function recordCorrected(word) {
    const k = String(word || "").toLowerCase(); if (!k) return;
    const s = loadStats();
    const e = s[k] || { w: 0, c: 0, corrected: 0, collected: false, spelled: false };
    e.corrected = (e.corrected || 0) + 1; e.collected = true;
    s[k] = e; saveStats(s);
  }
  // Dictation (Golden) is independent of the linear quiz. A clean spelling
  // marks the word SPELLED (the right column of the garden) and counts a
  // correct; it never affects the linear "collected" progression.
  function recordSpelled(word) {
    const k = String(word || "").toLowerCase(); if (!k) return;
    const s = loadStats();
    const e = s[k] || { w: 0, c: 0, corrected: 0, collected: false, spelled: false };
    e.c += 1; e.spelled = true;
    s[k] = e; saveStats(s);
  }
  function undoCorrect(word) {
    const k = String(word || "").toLowerCase(); if (!k) return;
    const s = loadStats(); const e = s[k]; if (!e) return;
    e.c = Math.max(0, (e.c || 0) - 1);
    s[k] = e; saveStats(s);
  }
  function score(e) { return (e.w || 0) - (e.c || 0); }
  function byScore(keys, s) {
    return keys.map(k => ({ k, sc: score(s[k]) }))
      .sort((a, b) => (b.sc - a.sc) || (Math.random() - 0.5))
      .map(x => x.k);
  }
  // Left column — words COLLECTED via the choice quiz, most-missed first.
  function collectedWords() { const s = loadStats(); return byScore(Object.keys(s).filter(k => s[k].collected), s); }
  // Right column — words SPELLED via dictation.
  function spelledWords() { const s = loadStats(); return byScore(Object.keys(s).filter(k => s[k].spelled), s); }
  // The dictation backlog — collected but not yet spelled (Seal More pool).
  function toSpellWords() { const s = loadStats(); return byScore(Object.keys(s).filter(k => s[k].collected && !s[k].spelled), s); }
  function reviewWords() { return collectedWords(); }
  function accumulatedWords() { return collectedWords(); }
  function unsealedWords() { const s = loadStats(); return byScore(Object.keys(s).filter(k => !s[k].collected), s); }
  function wordStat(word) { return loadStats()[String(word || "").toLowerCase()] || { w: 0, c: 0, collected: false, spelled: false }; }

  return {
    sectionState, setStageStatus, update, sectionCompleted,
    order, menuHref, readingHref, indexHref, quizHref, statusHref,
    recordWord, recordCorrected, recordSpelled, undoCorrect,
    reviewWords, accumulatedWords, collectedWords, spelledWords, toSpellWords, unsealedWords, wordStat,
  };
})();
window.Quiz = Quiz;
