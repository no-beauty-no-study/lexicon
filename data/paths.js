/* ============================================================
   THE PATHS — a separate "e-book" reading channel, distinct from the
   10 study chapters. Read like a novel: tap a word for its card, double-tap
   a sentence for its 中文, fold a word to keep it in Notes. NO quiz, NO test.

   To fill a path:
     • set `title`
     • drop the protagonist art at `image` (replace page-blank.jpg)
     • push sections: { blocks: [ "sentence.", "sentence." ], zh: [ "中文。", "中文。" ] }
       (blocks = English sentences; zh = parallel translation, same length)
   Until then the path opens to a blank "coming soon" page — the channel works.
   ============================================================ */
const PATHS = [
  { id: "sealyra", title: "Sealyra", image: "assets/bg/ui/sealyra.png", sections: [] },
  { id: "shiro",   title: "Shiro",   image: "assets/bg/ui/shiro.png",   sections: [] },
  { id: "hosea",   title: "Hosea",   image: "assets/bg/ui/hosea.png",   sections: [] },
  { id: "jael",    title: "Jael",    image: "assets/bg/ui/jael.png",    sections: [] },
  { id: "kye",     title: "Kye",     image: "assets/bg/ui/kye.png",     sections: [] },
];

(function () {
  // Register each path as a "chapter" so the existing reading view, ChapterNav
  // and word-card all work for free — but they're NOT in the CHAPTERS index, so
  // they only appear under #paths.
  PATHS.forEach((p, i) => {
    const secs = (p.sections && p.sections.length) ? p.sections.slice()
               : [{ title: p.title, blocks: [], quiz: [] }];
    // Keep author-provided numbers (main line "1","2","3","4"; character branches
    // "1.1" 男主, "2.1" 男二 …); only auto-number if none was given.
    secs.forEach((s, j) => { if (!s.number) s.number = String(j + 1); if (!s.quiz) s.quiz = []; });
    p.firstSection = secs[0].number;
    try {
      if (typeof CHAPTER_CONTENT !== "undefined")
        CHAPTER_CONTENT[p.id] = { number: String(i + 1), title: p.title, id: p.id, sections: secs, _path: true };
      if (typeof CHAPTERS_BY_ID !== "undefined")
        CHAPTERS_BY_ID[p.id] = { id: p.id, number: String(i + 1), title: p.title, firstSection: "1", _path: true, image: p.image };
      if (typeof window !== "undefined") {
        window.READING_TRANSLATIONS = window.READING_TRANSLATIONS || {};
        secs.forEach(s => { if (s.zh && s.zh.length) window.READING_TRANSLATIONS[p.id + "|" + s.number] = s.zh; });
      }
    } catch (e) {}
    try { window.PATHS_BY_ID = window.PATHS_BY_ID || {}; window.PATHS_BY_ID[p.id] = p; } catch (e) {}
  });
  try { if (typeof window !== "undefined") window.PATHS = PATHS; } catch (e) {}
})();
