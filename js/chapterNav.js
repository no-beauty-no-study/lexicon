/* ============================================================
   The Princess Lexicon — chapterNav.js
   Shared navigation helpers for the 2-page chapter model.
     Each book (e.g. "universe") contains many sections (1.1, 1.2, ...).
     Each section has TWO pages:
       page 1 = reading.html?chapter=<id>&section=<num>
       page 2 = quiz.html?chapter=<id>&section=<num>
     The flow is: reading → quiz → next section's reading → ...
   ============================================================ */
const ChapterNav = (function () {

  function sectionsOf(chapterId) {
    if (typeof CHAPTER_CONTENT === "undefined") return [];
    const c = CHAPTER_CONTENT[chapterId];
    return c ? c.sections : [];
  }

  function findSection(chapterId, sectionNum) {
    const list = sectionsOf(chapterId);
    return list.find(s => s.number === sectionNum) || list[0] || null;
  }

  /** Next URL after the reading page of (chapter, section). */
  function nextAfterReading(chapterId, sectionNum) {
    return `quiz.html?chapter=${enc(chapterId)}&section=${enc(sectionNum)}`;
  }

  /** Next URL after the quiz page of (chapter, section). */
  function nextAfterQuiz(chapterId, sectionNum) {
    const list = sectionsOf(chapterId);
    const i    = list.findIndex(s => s.number === sectionNum);
    if (i >= 0 && i + 1 < list.length) {
      return `reading.html?chapter=${enc(chapterId)}&section=${enc(list[i + 1].number)}`;
    }
    // End of book — go to next chapter in CHAPTERS order.
    if (typeof CHAPTERS !== "undefined") {
      const j = CHAPTERS.findIndex(c => c.id === chapterId);
      if (j >= 0 && j + 1 < CHAPTERS.length) {
        const nextBook = CHAPTERS[j + 1];
        const firstSec = sectionsOf(nextBook.id)[0];
        const sec = firstSec ? firstSec.number : "1.1";
        return `reading.html?chapter=${enc(nextBook.id)}&section=${enc(sec)}`;
      }
    }
    // End of the book of books — back to chapter index.
    return "chapters.html";
  }

  /** Previous URL before the reading page of (chapter, section). */
  function prevBeforeReading(chapterId, sectionNum) {
    const list = sectionsOf(chapterId);
    const i    = list.findIndex(s => s.number === sectionNum);
    if (i > 0) {
      return `quiz.html?chapter=${enc(chapterId)}&section=${enc(list[i - 1].number)}`;
    }
    return "chapters.html";
  }

  /** Previous URL before the quiz page of (chapter, section). */
  function prevBeforeQuiz(chapterId, sectionNum) {
    return `reading.html?chapter=${enc(chapterId)}&section=${enc(sectionNum)}`;
  }

  function enc(s) { return encodeURIComponent(s); }

  return {
    sectionsOf, findSection,
    nextAfterReading, nextAfterQuiz,
    prevBeforeReading, prevBeforeQuiz,
  };
})();
