/* The Princess Lexicon — chapterNav.js
   Shared navigation helpers for the 2-page chapter model.
     Each book (e.g. "universe") contains many sections (1.1, 1.2, …).
     Each section has TWO pages:
       page 1 = #reading?chapter=<id>&section=<num>
       page 2 = #quiz?chapter=<id>&section=<num>
     The flow is: reading → quiz → next section's reading → … */
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

  function nextAfterReading(chapterId, sectionNum) {
    return `#quiz?chapter=${enc(chapterId)}&section=${enc(sectionNum)}`;
  }

  function nextAfterQuiz(chapterId, sectionNum) {
    const list = sectionsOf(chapterId);
    const i    = list.findIndex(s => s.number === sectionNum);
    if (i >= 0 && i + 1 < list.length) {
      return `#reading?chapter=${enc(chapterId)}&section=${enc(list[i + 1].number)}`;
    }
    if (typeof CHAPTERS !== "undefined") {
      const j = CHAPTERS.findIndex(c => c.id === chapterId);
      if (j >= 0 && j + 1 < CHAPTERS.length) {
        const nextBook = CHAPTERS[j + 1];
        const firstSec = sectionsOf(nextBook.id)[0];
        const sec = firstSec ? firstSec.number : "1.1";
        return `#reading?chapter=${enc(nextBook.id)}&section=${enc(sec)}`;
      }
    }
    return "#chapters";
  }

  function prevBeforeReading(chapterId, sectionNum) {
    const list = sectionsOf(chapterId);
    const i    = list.findIndex(s => s.number === sectionNum);
    if (i > 0) {
      return `#quiz?chapter=${enc(chapterId)}&section=${enc(list[i - 1].number)}`;
    }
    return "#chapters";
  }

  function prevBeforeQuiz(chapterId, sectionNum) {
    return `#reading?chapter=${enc(chapterId)}&section=${enc(sectionNum)}`;
  }

  function enc(s) { return encodeURIComponent(s); }

  return {
    sectionsOf, findSection,
    nextAfterReading, nextAfterQuiz,
    prevBeforeReading, prevBeforeQuiz,
  };
})();
