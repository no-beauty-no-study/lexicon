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

  // Hand-curated WORDS take priority for the HEAD_LOOKUP (richer
  // data, full meaning/example). But we still index every kin /
  // family sub-word from WORD_LIBRARY so the article gets full
  // clickable coverage — that's what the user means by "我手机端
  // 基本上一整篇的单词都可以被覆盖到啊".
  if (typeof WORDS !== "undefined") {
    for (const w of WORDS) indexEntry(w);
  }
  if (typeof WORD_LIBRARY !== "undefined") {
    for (const w of WORD_LIBRARY) {
      if (!w || !w.word) continue;
      const key = w.word.toLowerCase();
      // Only set HEAD_LOOKUP if no curated entry exists.
      if (!HEAD_LOOKUP[key]) {
        HEAD_LOOKUP[key] = w;
        addIndex(w.word, w.word, "head", w.word);
      }
      // ALWAYS index this entry's kin / family sub-words so they
      // become clickable, even if the head is already curated.
      for (const f of (w.family || [])) {
        if (f && f.word) addIndex(f.word, w.word, "family", f.word);
      }
      for (const k of (w.kin || [])) {
        if (k && typeof k === "object" && k.word) {
          addIndex(k.word, w.word, "kin", k.word);
        } else if (typeof k === "string") {
          const tok = firstToken(k);
          if (tok) addIndex(tok, w.word, "kin", tok);
        }
      }
    }
  }
})();

/** Try a surface word and a few simple inflection-stripped variants
    against WORD_TO_HEADS. Returns the matched key string or null.
    This widens coverage so 'atoms' matches 'atom', 'cooling' matches
    'cool', 'dissipated' matches 'dissipate', etc. — without needing
    every inflected form curated in the data files. */
function findIndexedSurface(surface) {
  if (!surface) return null;
  const k = String(surface).toLowerCase().trim();
  if (!k) return null;
  if (WORD_TO_HEADS[k]) return k;
  // Try common English suffix strips.
  const tries = [];
  if (k.endsWith("ies") && k.length > 4)  tries.push(k.slice(0, -3) + "y");
  if (k.endsWith("es")  && k.length > 3)  tries.push(k.slice(0, -2));
  if (k.endsWith("s")   && k.length > 2)  tries.push(k.slice(0, -1));
  if (k.endsWith("ing") && k.length > 4)  tries.push(k.slice(0, -3),
                                                     k.slice(0, -3) + "e");
  if (k.endsWith("ed")  && k.length > 3)  tries.push(k.slice(0, -2),
                                                     k.slice(0, -1));
  if (k.endsWith("er")  && k.length > 3)  tries.push(k.slice(0, -2),
                                                     k.slice(0, -1));
  if (k.endsWith("est") && k.length > 4)  tries.push(k.slice(0, -3),
                                                     k.slice(0, -2));
  if (k.endsWith("ly")  && k.length > 3)  tries.push(k.slice(0, -2));
  for (const t of tries) {
    if (WORD_TO_HEADS[t]) return t;
  }
  return null;
}

/** Look up a clicked surface word and return the entry FOR THAT
    EXACT WORD — not the head's entry. The marginalia card should
    show the translation + phrases of the word the user clicked.
      - If the clicked word IS a head (or has its own entry in the
        library), return that entry directly.
      - If the clicked word is a kin sub-word, synthesise an entry
        from the kin record: word + zh + phrases live on that record.
      - If the clicked word is a family sub-word, the source data
        only carries .text (a definition string); use that as meaning.
    The result has the same shape as a normal word entry — id, word,
    meaning, phrases — so reading.js can render it without branching.
    Returns: { head, type, relationWord, clickEntry, headEntry } or null. */
function resolveClickedWord(surface) {
  if (!surface) return null;
  // Fall back to inflection-stripped surface so plural / -ed / -ing
  // forms resolve even when only the base form is curated.
  const key = findIndexedSurface(surface);
  const hits = key ? WORD_TO_HEADS[key] : null;
  if (!hits || !hits.length) return null;

  for (const hit of hits) {
    const headEntry = HEAD_LOOKUP[hit.head.toLowerCase()] || null;
    if (!headEntry) continue;

    // 1. Clicked word IS the head word: return head as-is.
    if (hit.type === "head" || hit.head.toLowerCase() === key) {
      return { ...hit, clickEntry: headEntry, headEntry };
    }

    // 2. Clicked word is a kin entry under this head. The kin record
    //    holds the data we want (zh + phrases).
    if (hit.type === "kin" && Array.isArray(headEntry.kin)) {
      for (const k of headEntry.kin) {
        if (k && typeof k === "object" && (k.word || "").toLowerCase() === key) {
          return {
            ...hit,
            clickEntry: {
              id: k.word,
              word: k.word,
              meaning: k.zh || "",
              kin: [],
              friend: [],
              collocations: [],
              phrases: Array.isArray(k.phrases) ? k.phrases.slice() : [],
            },
            headEntry,
          };
        }
      }
    }

    // 3. Clicked word is a family derivative.
    if (hit.type === "family" && Array.isArray(headEntry.family)) {
      for (const f of headEntry.family) {
        if (f && (f.word || "").toLowerCase() === key) {
          return {
            ...hit,
            clickEntry: {
              id: f.word,
              word: f.word,
              meaning: f.text || "",
              kin: [],
              friend: [],
              collocations: [],
              phrases: [],
            },
            headEntry,
          };
        }
      }
    }
  }

  // No matching sub-entry — fall back to the first hit's head entry
  // so we always show SOMETHING rather than nothing.
  const hit = hits[0];
  const headEntry = HEAD_LOOKUP[hit.head.toLowerCase()] || null;
  return { ...hit, clickEntry: headEntry, headEntry };
}

/** Does this surface word have any entry (head or sub-word)?
    Uses the same inflection fallback as resolveClickedWord. */
function hasClickableWord(surface) {
  if (!surface) return false;
  return Boolean(findIndexedSurface(surface));
}
