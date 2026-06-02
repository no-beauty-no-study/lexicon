/* Reading-passage Chinese translations, keyed by "<chapterId>|<section>".
   Each value is an array of zh strings, PARALLEL to that section's `blocks`
   (index i ↔ block i). Double-tapping a sentence on the reading page shows
   its translation here without interrupting the audio.

   Fill these in as translations are provided; any sentence without an entry
   shows a gentle "译文整理中" placeholder. */
const READING_TRANSLATIONS = {
  // "universe|1.1": [
  //   "第一句的中文…",
  //   "第二句的中文…",
  // ],
};
try { if (typeof window !== "undefined") window.READING_TRANSLATIONS = READING_TRANSLATIONS; } catch (e) {}
