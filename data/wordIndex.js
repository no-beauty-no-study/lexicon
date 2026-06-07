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

/** Try a surface word against WORD_TO_HEADS with the full fallback
    chain spec'd by the pad UX doc:
      1. exact match
      2. simple inflection strip (s/es/ies/ing/ed/er/est/ly)
      3. common English prefix strip
         (in/un/non/dis/re/over/under/pre/sub/inter/im/ir/il)
      4. stem of strip-prefix
      5. longest 5-9 char substring of the word that is itself a key
    Returns the matched index key or null. This is what makes
    'compression' resolvable when only 'compress' is indexed,
    'unimaginable' resolvable when only 'imagine' is indexed,
    'inconceivable' resolvable when only 'conceive' is indexed, etc. */
const PREFIX_RE = /^(inter|under|over|non|pre|sub|dis|mis|re|un|in|im|ir|il)/;

function stem(w) {
  if (!w) return w;
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (w.endsWith("ied") && w.length > 4) return w.slice(0, -3) + "y";
  if (w.endsWith("ying")&& w.length > 5) return w.slice(0, -4) + "ie";
  if (w.endsWith("es")  && w.length > 3) return w.slice(0, -2);
  if (w.endsWith("s")   && w.length > 2) return w.slice(0, -1);
  if (w.endsWith("ing") && w.length > 4) return w.slice(0, -3);
  if (w.endsWith("ed")  && w.length > 3) return w.slice(0, -2);
  if (w.endsWith("er")  && w.length > 3) return w.slice(0, -2);
  if (w.endsWith("est") && w.length > 4) return w.slice(0, -3);
  if (w.endsWith("ly")  && w.length > 3) return w.slice(0, -2);
  if (w.endsWith("ion") && w.length > 4) return w.slice(0, -3);
  if (w.endsWith("ness")&& w.length > 5) return w.slice(0, -4);
  if (w.endsWith("ity") && w.length > 4) return w.slice(0, -3);
  if (w.endsWith("ous") && w.length > 4) return w.slice(0, -3);
  if (w.endsWith("able")&& w.length > 5) return w.slice(0, -4);
  if (w.endsWith("ible")&& w.length > 5) return w.slice(0, -4);
  if (w.endsWith("tive")&& w.length > 5) return w.slice(0, -4);
  if (w.endsWith("ative")&& w.length > 6) return w.slice(0, -5);
  return w;
}

function findIndexedSurface(surface) {
  if (!surface) return null;
  const k0 = String(surface).toLowerCase().trim().replace(/[^a-z'-]/g, "");
  if (!k0 || k0.length < 3) return null;

  // 1. exact
  if (WORD_TO_HEADS[k0]) return k0;

  // 2. stemmed
  const s = stem(k0);
  if (s !== k0 && WORD_TO_HEADS[s]) return s;

  // 3. strip common prefix
  const np = k0.replace(PREFIX_RE, "");
  if (np !== k0 && np.length >= 3 && WORD_TO_HEADS[np]) return np;

  // 4. stem of strip-prefix
  const nps = stem(np);
  if (nps !== np && nps.length >= 3 && WORD_TO_HEADS[nps]) return nps;

  // 5. longest 5-9 char substring of k0 that is itself a key
  if (k0.length >= 6) {
    for (let len = Math.min(k0.length - 1, 9); len >= 5; len--) {
      for (let i = 0; i + len <= k0.length; i++) {
        const sub = k0.slice(i, i + len);
        if (WORD_TO_HEADS[sub]) return sub;
      }
    }
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
