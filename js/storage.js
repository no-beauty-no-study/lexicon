/* ============================================================
   The Princess Lexicon — storage.js
   Tiny localStorage wrapper for: saved word ids + save slots.
   ============================================================ */

const Storage = (function () {
  const NOTES_KEY = "tpl.notes";        // array of word ids
  const SLOTS_KEY = "tpl.slots";        // array of save slot objects, length=6
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

  /* ----- notes (saved word ids) ----- */
  function getNotes()  { return read(NOTES_KEY, []); }
  function isSaved(id) { return getNotes().indexOf(id) !== -1; }
  function saveWord(id) {
    const list = getNotes();
    if (list.indexOf(id) === -1) {
      list.push(id);
      write(NOTES_KEY, list);
    }
    return list;
  }
  function unsaveWord(id) {
    const list = getNotes().filter(x => x !== id);
    write(NOTES_KEY, list);
    return list;
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

  return {
    SLOT_COUNT,
    getNotes, isSaved, saveWord, unsaveWord,
    getSlots, setSlot, clearSlot,
  };
})();
