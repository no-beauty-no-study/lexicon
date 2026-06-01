/* The Princess Lexicon — VocabRuntime (V63 learning-head model)
   Data files (loaded as globals before this):
     VOCAB_READING_WORD_CARDS_SIMPLE   .cards[word]          → reading small card
     VOCAB_READING_TO_LEARNING_HEAD    .reading_to_learning_head[word].learning_head
     VOCAB_LEARNING_HEAD_CARDS_SIMPLE  .cards[head]          → big card (own + family + kin embedded)
     VOCAB_GROUP_CLEAN_SIMPLE          .groups[head]         → synonyms (no DNA)
     VOCAB_PROPER_SMALL_CARDS_FINAL    .small_cards[]        → proper / small-only

   Flow: reading click → small card (shows the learning HEAD as a tappable
   chip) → tap head → big card = that head's card (own → family → kin → group).
   Family/kin/group/head words that exist as reading or head cards are
   clickable and re-open the drawer on their OWN head (the "maze"). */
(function () {
  function norm(w) { return String(w || '').trim().toLowerCase(); }

  const RW     = (window.VOCAB_READING_WORD_CARDS_SIMPLE || {}).cards || {};
  const R2H    = (window.VOCAB_READING_TO_LEARNING_HEAD || {}).reading_to_learning_head || {};
  const HEAD   = (window.VOCAB_LEARNING_HEAD_CARDS_SIMPLE || {}).cards || {};
  const GROUP  = (window.VOCAB_GROUP_CLEAN_SIMPLE || {}).groups || {};
  const PROPER = (window.VOCAB_PROPER_SMALL_CARDS_FINAL || {}).small_cards || [];

  function lcMap(obj) {
    const m = new Map();
    if (obj) for (const k of Object.keys(obj)) m.set(norm(k), obj[k]);
    return m;
  }
  const readingMap = lcMap(RW);
  const headMap    = lcMap(HEAD);
  const r2hMap     = lcMap(R2H);
  const groupMap   = lcMap(GROUP);
  const properMap  = new Map();
  for (const c of (Array.isArray(PROPER) ? PROPER : [])) if (c && c.word) properMap.set(norm(c.word), c);

  const CJK = /[一-鿿]/;

  function normPhrases(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(p => {
      if (!p) return null;
      if (typeof p === 'object') return { phrase: p.phrase || p.en || '', phrase_zh: p.phrase_zh || p.zh || '' };
      return { phrase: String(p), phrase_zh: '' };
    }).filter(p => p && (p.phrase || p.phrase_zh));
  }
  function normExamples(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(x => {
      if (!x) return null;
      if (typeof x === 'object') return { example: x.example || x.en || '', example_zh: x.example_zh || x.zh || '' };
      const s = String(x);
      return CJK.test(s) ? { example: '', example_zh: s } : { example: s, example_zh: '' };
    }).filter(x => x && (x.example || x.example_zh));
  }
  // Best POS tag: an explicit `pos` that looks like a tag, else the leading
  // tag inside the zh gloss ("v. 放弃" → "v.").
  function posOf(c) {
    if (!c) return '';
    const p = c.pos;
    if (p && /\./.test(p) && norm(p) !== norm(c.word || '')) return String(p).trim();
    const m = String(c.zh || '').match(/^\s*([A-Za-z][A-Za-z.\/\- ]*\.)\s/);
    return m ? m[1].trim() : '';
  }
  // Some group glosses carry a leading POS tag inside zh ("n. 亚文化") — strip
  // it so the meaning column stays clean (POS is shown separately).
  function zhMeaning(zh) { return String(zh || '').replace(/^\s*[A-Za-z][A-Za-z.\/\- ]*\.\s*/, ''); }

  // Light inflection fallback so reading surface forms still resolve.
  function lemmaCandidates(w) {
    const out = [], add = x => { if (x && x !== w && out.indexOf(x) < 0) out.push(x); };
    if (/ies$/.test(w))  add(w.slice(0, -3) + 'y');
    if (/es$/.test(w))   { add(w.slice(0, -2)); add(w.slice(0, -1)); }
    if (/s$/.test(w) && !/ss$/.test(w)) add(w.slice(0, -1));
    if (/ied$/.test(w))  add(w.slice(0, -3) + 'y');
    if (/ed$/.test(w))   { add(w.slice(0, -2)); add(w.slice(0, -1)); }
    if (/ing$/.test(w))  { add(w.slice(0, -3)); add(w.slice(0, -3) + 'e'); }
    if (/ly$/.test(w))   add(w.slice(0, -2));
    return out;
  }
  function cleanTok(raw) { return norm(raw).replace(/^[^a-z]+|[^a-z]+$/g, '').replace(/'s$/, ''); }

  function lookup(map, w) {
    if (map.has(w)) return map.get(w);
    for (const c of lemmaCandidates(w)) if (map.has(c)) return map.get(c);
    return null;
  }
  function headOf(w) {
    const e = r2hMap.get(w) || (function () {
      for (const c of lemmaCandidates(w)) { const x = r2hMap.get(c); if (x) return x; }
      return null;
    })();
    return e && e.learning_head ? norm(e.learning_head) : null;
  }

  /* ---------- small card (reading click) ---------- */
  const smallCache = new Map();
  function getSmallCard(word) {
    const w = cleanTok(word);
    if (!w) return null;
    if (smallCache.has(w)) return smallCache.get(w);
    let res = null;
    // PROPER / place / small-only first — these answer the reading meaning but
    // never open a family/kin card, even if the surface form also exists as a
    // reading word (e.g. "bering").
    const pc = lookup(properMap, w);
    if (pc) {
      res = {
        type: 'proper', word: pc.word || w, pos: posOf(pc), zh: pc.zh || '',
        phrases: normPhrases(pc.phrases), examples: normExamples(pc.examples),
        head: null, clickableForBigCard: false, proper: true, resolvedWord: pc.word || w,
      };
    } else {
      const rc = lookup(readingMap, w);
      if (rc) {
        const h = headOf(w);
        const hcard = h ? headMap.get(h) : null;
        res = {
          type: 'word', word: rc.word || w, pos: posOf(rc), zh: rc.zh || '',
          phrases: normPhrases(rc.phrases), examples: normExamples(rc.examples),
          head: hcard ? { word: hcard.word || h, openable: true }
               : (h ? { word: h, openable: false } : null),
          clickableForBigCard: !!hcard,
          resolvedWord: rc.word || w,
        };
      }
    }
    smallCache.set(w, res);
    return res;
  }
  function isClickableWord(word) { return !!getSmallCard(word); }

  /* ---------- big card (the learning-head card) ---------- */
  function headCardFor(word) {
    const w = cleanTok(word);
    if (headMap.has(w)) return { key: w, card: headMap.get(w) };
    const h = headOf(w);
    if (h && headMap.has(h)) return { key: h, card: headMap.get(h) };
    return null;
  }
  // A member word is clickable if it exists somewhere as its own card.
  function memberClickable(word) {
    const w = norm(word);
    return readingMap.has(w) || headMap.has(w) || r2hMap.has(w);
  }
  function shapeMember(m) {
    if (typeof m === 'string')
      return { word: m, pos: '', zh: '', phrases: [], examples: [], clickable: memberClickable(m) };
    return {
      word: m.word || '', pos: posOf(m), zh: m.zh || '',
      phrases: normPhrases(m.phrases), examples: normExamples(m.examples),
      clickable: memberClickable(m.word),
    };
  }
  const bigCache = new Map();
  function getBigCard(word) {
    if (properMap.has(cleanTok(word))) return null;   // proper = small-only
    const hit = headCardFor(word);
    if (!hit) return null;
    if (bigCache.has(hit.key)) return bigCache.get(hit.key);
    const c = hit.card;

    const family = (c.family_members || []).map(shapeMember)
      .filter(m => m.word && norm(m.word) !== hit.key);

    // Kin: items carrying their own content first, then any bare internal
    // words not already represented.
    const kin = [];
    const seen = new Set();
    (c.kin_internal_word_items || []).concat(c.kin_external_words || []).forEach(m => {
      const s = shapeMember(m);
      if (s.word && !seen.has(norm(s.word))) { seen.add(norm(s.word)); kin.push(s); }
    });
    (c.kin_internal_words || []).forEach(w => {
      if (w && !seen.has(norm(w))) { seen.add(norm(w)); kin.push(shapeMember(w)); }
    });
    const kinMembers = kin.filter(m => m.word && norm(m.word) !== hit.key);

    const group = (groupMap.get(hit.key) || []).map(g => ({
      word: g.word || '', pos: g.pos || posOf(g), zh: zhMeaning(g.zh),
      phrases: g.phrase ? [{ phrase: g.phrase, phrase_zh: g.phrase_zh || '' }] : [],
      examples: [], clickable: memberClickable(g.word),
    })).filter(g => g.word);

    const out = {
      word: c.word || hit.key, family_head: hit.key, pos: posOf(c), zh: c.zh || '',
      phrases: normPhrases(c.phrases), examples: normExamples(c.examples),
      head: null, family_members: family, kin_members: kinMembers, group,
    };
    bigCache.set(hit.key, out);
    return out;
  }

  function getFamilyHead(word) { return headOf(cleanTok(word)) || cleanTok(word); }
  function getWordCard(word)   { return lookup(readingMap, cleanTok(word)) || null; }
  function resolveReadingWord(word) {
    const sc = getSmallCard(word);
    return {
      raw: word, resolvedWord: sc ? sc.resolvedWord : cleanTok(word),
      card: sc, matchType: sc ? (sc.proper ? 'proper' : 'word') : 'none',
    };
  }

  window.VocabRuntime = {
    getSmallCard, getBigCard, isClickableWord, getFamilyHead, getWordCard,
    resolveReadingWord, isSmallOnly: (c) => !!(c && c.proper),
  };
})();
