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

  // Menu — walk sections in order; within each, STAGE 1 (silver, choose the
  // meaning) then STAGE 2 (golden, choose the group). Return the first stage
  // that isn't completed. Each stage's completion is saved on its own, so a
  // section you cleared from Reading/Index is skipped here and never repeats.
  // Dictation (seal) is an OPTIONAL extra stage and never gates this line.
  function menuHref(from) {
    from = from || "menu";
    for (const { chapter, section } of order()) {
      const st = sectionState(chapter, section);
      if (st.quiz1.status !== "completed") return quizHref(chapter, section, "silver", from);
      if (st.quiz2.status !== "completed") return quizHref(chapter, section, "golden", from);
    }
    return "#word-garden";
  }
  // Reading / Index — straight into the section's choice quiz (word → group).
  function readingHref(ch, sec) { return quizHref(ch, sec, "silver", "story"); }
  function indexHref(ch, sec)   { return quizHref(ch, sec, "silver", "index"); }

  /* ---------- per-word mistake stats (review ordering) ----------
     The order/priority is by ERROR COUNT and never falls because of an
     ordinary correct answer. The rule (user's): the running need =
       total WRONG answers (from anywhere — silver / golden / seal / review)
       MINUS the number of REVIEW-correct answers.
     Only a REVIEW pass can pull a word down; a plain quiz correct just marks
     the word COLLECTED (it enters the garden the moment it is quizzed, right
     OR wrong) and a clean dictation marks it SPELLED. Neither subtracts. */
  const SKEY = "tpl.quizWordStats";
  function loadStats() { try { return JSON.parse(localStorage.getItem(SKEY) || "{}"); } catch (_) { return {}; } }
  function saveStats(s) { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (_) {} }
  function blankStat() { return { w: 0, rc: 0, collected: false, spelled: false, t: 0 }; }
  // Stamp the FIRST time a word is collected, so recency can break weight ties
  // (earlier-accumulated words get reviewed / pulled in to pad a quiz first).
  function stampCollected(e) { e.collected = true; if (!e.t) e.t = Date.now(); }
  // A CHOICE answer (silver / golden / review group). The word is collected on
  // first sight; only a WRONG answer moves the score. A correct answer NEVER
  // subtracts (that is reserved for review).
  function recordWord(word, ok) {
    const k = String(word || "").toLowerCase(); if (!k) return;
    const s = loadStats();
    const e = Object.assign(blankStat(), s[k]);
    stampCollected(e);
    if (!ok) e.w = (e.w || 0) + 1;
    s[k] = e; saveStats(s);
  }
  // Legacy hook — kept so old call-sites stay valid; just ensures collected.
  function recordCorrected(word) {
    const k = String(word || "").toLowerCase(); if (!k) return;
    const s = loadStats();
    const e = Object.assign(blankStat(), s[k]);
    stampCollected(e);
    s[k] = e; saveStats(s);
  }
  // A clean dictation seals the word (right column). Dictation is NOT "new
  // accumulation" and never changes the score — it only flags SPELLED.
  function recordSpelled(word) {
    const k = String(word || "").toLowerCase(); if (!k) return;
    const s = loadStats();
    const e = Object.assign(blankStat(), s[k]);
    e.spelled = true;
    s[k] = e; saveStats(s);
  }
  // The ONLY thing that pulls a word DOWN: a correct answer during Review.
  function recordReviewCorrect(word) {
    const k = String(word || "").toLowerCase(); if (!k) return;
    const s = loadStats();
    const e = Object.assign(blankStat(), s[k]);
    stampCollected(e); e.rc = (e.rc || 0) + 1;
    s[k] = e; saveStats(s);
  }
  function undoCorrect() { /* no-op: a normal correct never touched the score */ }
  function score(e) { return (e.w || 0) - (e.rc || 0); }
  function byScore(keys, s) {
    return keys.map(k => ({ k, sc: score(s[k]), t: s[k].t || 0 }))
      .sort((a, b) => (b.sc - a.sc) || (a.t - b.t) || (a.k < b.k ? -1 : 1))   // weight desc, then earliest-collected
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
  function wordStat(word) { return Object.assign(blankStat(), loadStats()[String(word || "").toLowerCase()]); }

  return {
    sectionState, setStageStatus, update, sectionCompleted,
    order, menuHref, readingHref, indexHref, quizHref, statusHref,
    recordWord, recordCorrected, recordSpelled, recordReviewCorrect, undoCorrect,
    reviewWords, accumulatedWords, collectedWords, spelledWords, toSpellWords, unsealedWords, wordStat,
  };
})();
window.Quiz = Quiz;
