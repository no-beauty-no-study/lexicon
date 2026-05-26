/* ============================================================
   The Princess Lexicon — wordIndex.js
   Reverse index: surface word (lowercased) -> [{ head, type, relationWord }]
   Surface forms include:
     - head word itself              (type: 'head')
     - family[].word                 (type: 'family')
     - kin[].word  (or first token   (type: 'kin')
                    of string-form kin)
   Loaded AFTER mockWords.js and wordLibrary.js so it can see both.
   ============================================================ */
const WORD_TO_HEADS = {};
const HEAD_LOOKUP   = {};   // head_lower -> source entry

(function buildIndex() {
  function addIndex(surfaceWord, head, type, relationWord) {
    if (!surfaceWord) return;
    const key = String(surfaceWord).toLowerCase().trim();
    if (!key) return;
    if (!WORD_TO_HEADS[key]) WORD_TO_HEADS[key] = [];
    // De-dupe: same (head,type) pair shouldn't repeat for one surface.
    if (WORD_TO_HEADS[key].some(x => x.head === head && x.type === type)) return;
    WORD_TO_HEADS[key].push({ head, type, relationWord: relationWord || surfaceWord });
  }

  function firstToken(s) {
    const m = String(s || "").match(/[A-Za-z][a-zA-Z'-]*/);
    return m ? m[0] : null;
  }

  function indexEntry(entry) {
    if (!entry || !entry.word) return;
    const head = entry.word;
    const headKey = head.toLowerCase();
    HEAD_LOOKUP[headKey] = entry;
    addIndex(head, head, "head", head);

    for (const f of (entry.family || [])) {
      if (f && f.word) addIndex(f.word, head, "family", f.word);
    }
    for (const k of (entry.kin || [])) {
      if (k && typeof k === "object" && k.word) {
        addIndex(k.word, head, "kin", k.word);
      } else if (typeof k === "string") {
        const w = firstToken(k);
        if (w) addIndex(w, head, "kin", w);
      }
    }
  }

  // Hand-curated WORDS take priority (richer data, full meaning/example).
  if (typeof WORDS !== "undefined") {
    for (const w of WORDS) indexEntry(w);
  }
  if (typeof WORD_LIBRARY !== "undefined") {
    for (const w of WORD_LIBRARY) {
      // Don't override curated entry; but still index its sub-words
      // pointing at it as head if not already known.
      const key = (w.word || "").toLowerCase();
      if (key && !HEAD_LOOKUP[key]) indexEntry(w);
      else {
        // Already have a curated head — but still add kin sub-words
        // that point at THIS auto-generated head only if no curated
        // entry exists for the same head.
      }
    }
  }
})();

/** Look up a clicked surface word. Returns:
    { head, type, relationWord, headEntry } or null if not in index. */
function resolveClickedWord(surface) {
  if (!surface) return null;
  const key = String(surface).toLowerCase().trim();
  const hits = WORD_TO_HEADS[key];
  if (!hits || !hits.length) return null;
  const hit = hits[0];                               // first match
  const headEntry = HEAD_LOOKUP[hit.head.toLowerCase()] || null;
  return { ...hit, headEntry };
}

/** Does this surface word have any entry (head or sub-word)? */
function hasClickableWord(surface) {
  if (!surface) return false;
  return Boolean(WORD_TO_HEADS[String(surface).toLowerCase().trim()]);
}
