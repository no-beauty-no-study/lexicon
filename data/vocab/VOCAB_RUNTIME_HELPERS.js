/* The Princess Lexicon — VocabRuntime (V73 normalized-lite model)
   Content lives ONCE in VOCAB_WORD_CONTENT_REGISTRY_LITE.cards[word];
   relationship files store only word ids.

     VOCAB_WORD_CONTENT_REGISTRY_LITE .cards[word]  → {word,pos,zh,phrases,examples}
     VOCAB_READING_WORDS_LITE         .words[]      → reading-clickable ids
     VOCAB_EXTERNAL_WORDS_LITE        .words[]      → openable ids
     VOCAB_FAMILY_SHARED_CLUSTERS_LITE.family_clusters[] → {family_id, head, words[]}
     VOCAB_KIN_CLEAN_LITE             .kin_clusters[]     → {cluster_id, kin_type, words[]}
     VOCAB_KIN_HEAD_BRIDGE_LITE       .head_to_kin_clusters[head] → [cluster_id]
     VOCAB_GROUP_CLEAN_LITE           .groups[word] → [ids]
     VOCAB_PROPER_SMALL_CARDS_FINAL   .small_cards[] → proper / small-only

   Family is a SHARED cluster: a member's family = the cluster minus itself,
   and the cluster's `head` is the 族长 (prefix/suffix-stripped core). Kin =
   head's own prefix cluster (head_kin) plus the word's suffix-layer cluster
   (family_kin). Supporting words show 1 representative phrase from their own
   registry card and open their FULL card when tapped. */
(function () {
  function norm(w) { return String(w || '').trim().toLowerCase(); }

  const REG    = (window.VOCAB_WORD_CONTENT_REGISTRY_LITE || {}).cards || {};
  const READING= (window.VOCAB_READING_WORDS_LITE || {}).words || [];
  const FAMS   = (window.VOCAB_FAMILY_SHARED_CLUSTERS_LITE || {}).family_clusters || [];
  const KINS   = (window.VOCAB_KIN_CLEAN_LITE || {}).kin_clusters || [];
  const BRIDGE = (window.VOCAB_KIN_HEAD_BRIDGE_LITE || {}).head_to_kin_clusters || {};
  const GROUPS = (window.VOCAB_GROUP_CLEAN_LITE || {}).groups || {};
  const PROPER = (window.VOCAB_PROPER_SMALL_CARDS_FINAL || {}).small_cards || [];

  // registry, lowercased
  const regMap = new Map();
  for (const k of Object.keys(REG)) regMap.set(norm(k), REG[k]);
  const readingSet = new Set(READING.map(norm));
  const properMap = new Map();
  for (const c of (Array.isArray(PROPER) ? PROPER : [])) if (c && c.word) properMap.set(norm(c.word), c);

  // family: word → clusters (a word can sit in several); head index
  const famByWord = new Map();
  for (const f of FAMS) for (const x of (f.words || [])) {
    const k = norm(x); if (!famByWord.has(k)) famByWord.set(k, []); famByWord.get(k).push(f);
  }
  // kin: cluster-by-id + word → clusters (membership)
  const kinById = new Map();
  const kinByWord = new Map();
  for (const c of KINS) {
    kinById.set(norm(c.cluster_id), c);
    for (const x of (c.words || [])) {
      const k = norm(x); if (!kinByWord.has(k)) kinByWord.set(k, []); kinByWord.get(k).push(c);
    }
  }
  const bridgeMap = new Map();
  for (const k of Object.keys(BRIDGE)) bridgeMap.set(norm(k), BRIDGE[k]);
  const groupMap = new Map();
  for (const k of Object.keys(GROUPS)) groupMap.set(norm(k), GROUPS[k]);

  const CJK = /[一-鿿]/;
  function normPhrases(arr, limit) {
    if (!Array.isArray(arr)) return [];
    const out = arr.map(p => {
      if (!p) return null;
      if (typeof p === 'object') return { phrase: p.phrase || p.en || '', phrase_zh: p.phrase_zh || p.zh || '' };
      return { phrase: String(p), phrase_zh: '' };
    }).filter(p => p && (p.phrase || p.phrase_zh));
    return limit ? out.slice(0, limit) : out;
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
  function posOf(c) {
    if (!c) return '';
    const p = c.pos;
    if (p && /\./.test(p) && norm(p) !== norm(c.word || '')) return String(p).trim();
    const m = String(c.zh || '').match(/^\s*([A-Za-z][A-Za-z.\/\- ]*\.)\s/);
    return m ? m[1].trim() : '';
  }
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
  // Resolve a token to a registry key (exact, then light inflection).
  function regKey(w) {
    if (regMap.has(w)) return w;
    for (const c of lemmaCandidates(w)) if (regMap.has(c)) return c;
    return null;
  }
  function readingKey(w) {
    if (readingSet.has(w)) return regKey(w) || w;
    for (const c of lemmaCandidates(w)) if (readingSet.has(c)) return regKey(c) || c;
    return null;
  }
  // A word's family head (族长) = its family cluster's head.
  function familyHead(w) {
    const cs = famByWord.get(w);
    if (cs && cs.length && cs[0].head) return norm(cs[0].head);
    return w;
  }

  /* ---------- small card (reading click) ---------- */
  const smallCache = new Map();
  function getSmallCard(word) {
    const w = cleanTok(word);
    if (!w) return null;
    if (smallCache.has(w)) return smallCache.get(w);
    let res = null;
    const pc = properMap.get(w) || (function () {
      for (const c of lemmaCandidates(w)) if (properMap.has(c)) return properMap.get(c);
      return null;
    })();
    if (pc) {
      res = {
        type: 'proper', word: pc.word || w, pos: posOf(pc), zh: pc.zh || '',
        phrases: normPhrases(pc.phrases), examples: normExamples(pc.examples),
        head: null, clickableForBigCard: false, proper: true, resolvedWord: pc.word || w,
      };
    } else {
      const rk = readingKey(w);
      const card = rk ? regMap.get(rk) : null;
      if (card) {
        const head = familyHead(rk);
        res = {
          type: 'word', word: card.word || rk, pos: posOf(card), zh: card.zh || '',
          phrases: normPhrases(card.phrases), examples: normExamples(card.examples),
          head: { word: head, openable: regMap.has(head) },
          clickableForBigCard: true, resolvedWord: card.word || rk,
        };
      }
    }
    smallCache.set(w, res);
    return res;
  }
  function isClickableWord(word) { return !!getSmallCard(word); }

  /* ---------- big card (any registry word; shared family + kin + group) ---------- */
  function shapeMember(id, headKey) {
    const k = norm(id);
    const reg = regMap.get(k);
    if (reg) return {
      word: reg.word || id, pos: posOf(reg), zh: reg.zh || '',
      phrases: normPhrases(reg.phrases, 1), examples: [],
      clickable: true, isHead: k === headKey,
    };
    return { word: id, pos: '', zh: '', phrases: [], examples: [], clickable: false, isHead: k === headKey };
  }
  const bigCache = new Map();
  function getBigCard(word) {
    const w0 = cleanTok(word);
    if (properMap.has(w0)) return null;
    const w = regKey(w0);
    if (!w) return null;
    if (bigCache.has(w)) return bigCache.get(w);
    const c = regMap.get(w);
    const head = familyHead(w);

    // FAMILY — union of every family cluster the word sits in, minus itself.
    const famWords = new Set();
    (famByWord.get(w) || []).forEach(f => (f.words || []).forEach(x => famWords.add(norm(x))));
    famWords.delete(w);
    const family = [...famWords].map(id => shapeMember(id, head))
      .sort((a, b) => (b.isHead - a.isHead) || a.word.localeCompare(b.word));

    // KIN — head's prefix cluster (head_kin) + the word's suffix-layer cluster
    // (family_kin): bridge from word & head, plus direct membership of both.
    const clusterIds = new Set();
    (bridgeMap.get(w) || []).forEach(id => clusterIds.add(norm(id)));
    (bridgeMap.get(head) || []).forEach(id => clusterIds.add(norm(id)));
    (kinByWord.get(w) || []).forEach(cl => clusterIds.add(norm(cl.cluster_id)));
    (kinByWord.get(head) || []).forEach(cl => clusterIds.add(norm(cl.cluster_id)));
    const kinWords = new Set();
    clusterIds.forEach(id => { const cl = kinById.get(id); if (cl) (cl.words || []).forEach(x => kinWords.add(norm(x))); });
    kinWords.delete(w);
    const kin = [...kinWords].map(id => shapeMember(id, head))
      .sort((a, b) => a.word.localeCompare(b.word));

    // GROUP — synonyms (no DNA). Keyed by the word and/or its head.
    const grpWords = new Set();
    (groupMap.get(w) || []).forEach(x => grpWords.add(norm(x)));
    (groupMap.get(head) || []).forEach(x => grpWords.add(norm(x)));
    grpWords.delete(w);
    const group = [...grpWords].map(id => shapeMember(id, head))
      .sort((a, b) => a.word.localeCompare(b.word));

    const out = {
      word: c.word || w, family_head: head, pos: posOf(c), zh: c.zh || '',
      phrases: normPhrases(c.phrases), examples: normExamples(c.examples),
      head: null, family_members: family, kin_members: kin, group,
    };
    bigCache.set(w, out);
    return out;
  }

  function getFamilyHead(word) { const w = regKey(cleanTok(word)) || cleanTok(word); return familyHead(w); }
  function getWordCard(word)   { const k = regKey(cleanTok(word)); return k ? regMap.get(k) : null; }
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
