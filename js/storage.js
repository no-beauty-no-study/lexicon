/* ============================================================
   The Princess Lexicon — storage.js
   Tiny localStorage wrapper for: saved word ids + save slots.
   ============================================================ */

const Storage = (function () {
  const NOTES_KEY = "tpl.notes";        // array of word ids
  const SLOTS_KEY = "tpl.slots";        // array of save slot objects, length=6
  const BOOKMARKS_KEY = "tpl.bookmarks";// array of sentence bookmarks
  const SLOT_COUNT = 6;

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  /* ----- notes (saved word ids), SECTION-SCOPED ------------------
     User: words saved in section 1.1 should NOT appear when reading
     section 1.2; each section keeps its own collection. The Notes
     view shows a merged flat list across every section. Key format:
     `${chapterId}:${sectionNum}` so universe:1.1 and universe:1.2
     are distinct buckets.
     ----------------------------------------------------------- */
  const NOTES_V2_KEY = "tpl.notesByScope";          // { [scope]: [...ids] }
  function getNotesMap()    { return read(NOTES_V2_KEY, {}); }
  function setNotesMap(map) { write(NOTES_V2_KEY, map); }

  function scopeKey(chapter, section) {
    if (!chapter && !section) return "_global";
    return (chapter || "_") + ":" + (section || "_");
  }

  // 1-arg legacy: getNotes() returns ALL ids merged across scopes
  //                (used by the Notes view).
  // 2-arg new:    getNotes(chapter, section) returns just that
  //                scope's ids (used by reading.init).
  function getNotes(chapter, section) {
    const map = getNotesMap();
    if (chapter || section) return (map[scopeKey(chapter, section)] || []).slice();
    const out = new Set();
    Object.keys(map).forEach(k => (map[k] || []).forEach(id => out.add(id)));
    return Array.from(out);
  }
  // 1-arg legacy: isSaved(id) checks any scope.
  // 3-arg new:    isSaved(id, chapter, section) checks a single scope.
  function isSaved(id, chapter, section) {
    const map = getNotesMap();
    if (chapter || section) {
      return (map[scopeKey(chapter, section)] || []).indexOf(id) !== -1;
    }
    return Object.keys(map).some(k => (map[k] || []).indexOf(id) !== -1);
  }
  function saveWord(id, chapter, section) {
    const map = getNotesMap();
    const k = scopeKey(chapter, section);
    if (!map[k]) map[k] = [];
    if (map[k].indexOf(id) === -1) map[k].push(id);
    setNotesMap(map);
    return map[k].slice();
  }
  function unsaveWord(id, chapter, section) {
    const map = getNotesMap();
    if (chapter || section) {
      const k = scopeKey(chapter, section);
      if (map[k]) map[k] = map[k].filter(x => x !== id);
    } else {
      // unsave from EVERY scope (used by the global Notes view's
      // unsave action, if any).
      Object.keys(map).forEach(k => {
        map[k] = (map[k] || []).filter(x => x !== id);
      });
    }
    setNotesMap(map);
    return getNotes();
  }
  // Count of distinct folded word ids within a single CHAPTER
  // (merged across all of that chapter's sections). Drives the
  // reading-page locket so the running total restarts at 0 when the
  // reader moves to a different chapter, instead of the global tally
  // (user req: "fold 计数每章从 0 开始"). Scope keys are
  // `${chapter}:${section}`, so we match on the `${chapter}:` prefix.
  function getChapterNoteCount(chapter) {
    const map = getNotesMap();
    const prefix = (chapter || "_") + ":";
    const ids = new Set();
    Object.keys(map).forEach(k => {
      if (k.indexOf(prefix) === 0) (map[k] || []).forEach(id => ids.add(id));
    });
    return ids.size;
  }
  // Returns the scope (chapter, section) where this id was saved.
  // Used by the Notes view to jump back to where the user folded it.
  function findScopeOf(id) {
    const map = getNotesMap();
    for (const k of Object.keys(map)) {
      if ((map[k] || []).indexOf(id) !== -1) {
        const sep = k.indexOf(":");
        if (sep === -1) return { chapter: null, section: null };
        return { chapter: k.slice(0, sep), section: k.slice(sep + 1) };
      }
    }
    return null;
  }

  /* ----- save slots ----- */
  function getSlots() {
    const list = read(SLOTS_KEY, []);
    while (list.length < SLOT_COUNT) list.push(null);
    return list;
  }
  function setSlot(index, slot) {
    const list = getSlots();
    list[index] = slot;
    write(SLOTS_KEY, list);
  }
  function clearSlot(index) {
    const list = getSlots();
    list[index] = null;
    write(SLOTS_KEY, list);
  }

  /* ----- chapter bookmark (Marginalia SAVE button) -----
     Saves the reader's current chapter+section so it isn't lost.
     Drops into the first empty slot, or overwrites the most recent
     chapter-bookmark slot if every slot is full. */
  function saveChapter(chapterId, sectionNum) {
    const slots = getSlots();
    const stamp = new Date().toISOString();
    const slot  = {
      kind: "chapter-bookmark",
      chapter: chapterId,
      section: sectionNum,
      savedAt: stamp,
    };
    let idx = slots.indexOf(null);
    if (idx === -1) {
      idx = 0;
      for (let i = 1; i < slots.length; i++) {
        if (slots[i] && slots[i].kind === "chapter-bookmark") { idx = i; break; }
      }
    }
    setSlot(idx, slot);
    return idx;
  }

  return {
    SLOT_COUNT,
    getNotes, isSaved, saveWord, unsaveWord, findScopeOf, getChapterNoteCount,
    getSlots, setSlot, clearSlot,
    saveChapter,
    getBookmarks, addBookmark, removeBookmark, isBookmarked,
  };

  /* ----- sentence bookmarks (Reading "Save" → 书签) -----
     A bookmark keeps the exact reading spot AND the sentence text, so the
     Bookmarks deck can preview it and jump straight back to that line. */
  function bmKey(b) { return (b.chapter || "") + "|" + (b.section || "") + "|" + (b.line || 0); }
  function getBookmarks() { return read(BOOKMARKS_KEY, []); }
  function addBookmark(bm) {
    const list = getBookmarks();
    const k = bmKey(bm);
    if (list.some(b => bmKey(b) === k)) return list;     // already saved
    list.unshift({ chapter: bm.chapter, section: bm.section, line: bm.line || 0,
      text: bm.text || "", title: bm.title || "", time: Date.now() });
    write(BOOKMARKS_KEY, list);
    return list;
  }
  function removeBookmark(key) {
    const list = getBookmarks().filter(b => bmKey(b) !== key);
    write(BOOKMARKS_KEY, list);
    return list;
  }
  function isBookmarked(chapter, section, line) {
    return getBookmarks().some(b => bmKey(b) === bmKey({ chapter, section, line }));
  }
})();
