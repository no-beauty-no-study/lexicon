/* The Princess Lexicon — VocabRuntime (V100 normalized model)
   Content lives ONCE in the registry; relationship files store word ids.

     VOCAB_WORD_CONTENT_REGISTRY_LITE .cards[word]
     VOCAB_READING_WORDS_LITE         .words[] / .reading_to_learning_head[w]={learning_head,...}
     VOCAB_FAMILY_SHARED_CLUSTERS_LITE.family_clusters[] {family_id,head,words[]}
     VOCAB_KIN_CLEAN_LITE             .kin_clusters[]    {cluster_id,kin_type,words[]}
     VOCAB_KIN_HEAD_BRIDGE_LITE       .head_to_kin_clusters[w]=[ids] / .kin_cluster_to_words[id]=[words]
     VOCAB_HEAD_TO_FAMILY_KIN_NAV_LITE.head_to_family_kin[w]={family_words[],family_kin_routes[]}
     VOCAB_GROUP_CLEAN_LITE           .groups[w]=[ids]
     VOCAB_WORD_ENTRY_POLICY_LITE     .big_card_words[] / .learning_heads[] / ...
     VOCAB_PROPER_SMALL_CARDS_FINAL   .small_cards[]

   Model: family is a SHARED suffix/POS cluster (a member shows the rest);
   kin is the current word's prefix/root cluster (NOT shared — recomputed per
   word); family_kin routes preview "head → family word → that word's own kin"
   (state → static → ecstatic/eustatic/geostatic/antistatic). The learning
   head is the prefix/suffix-stripped core and is the real entry to the net. */
(function () {
  function norm(w) { return String(w || '').trim().toLowerCase(); }

  const REG    = (window.VOCAB_WORD_CONTENT_REGISTRY_LITE || {}).cards || {};
  const RW     = window.VOCAB_READING_WORDS_LITE || {};
  const FAMS   = (window.VOCAB_FAMILY_SHARED_CLUSTERS_LITE || {}).family_clusters || [];
  const KINS   = (window.VOCAB_KIN_CLEAN_LITE || {}).kin_clusters || [];
  const BRIDGE = window.VOCAB_KIN_HEAD_BRIDGE_LITE || {};
  const NAV    = (window.VOCAB_HEAD_TO_FAMILY_KIN_NAV_LITE || {}).head_to_family_kin || {};
  const GROUPS = (window.VOCAB_GROUP_CLEAN_LITE || {}).groups || {};
  const POLICY = window.VOCAB_WORD_ENTRY_POLICY_LITE || {};
  const PROPER = (window.VOCAB_PROPER_SMALL_CARDS_FINAL || {}).small_cards || [];

  const regMap = new Map();   for (const k of Object.keys(REG)) regMap.set(norm(k), REG[k]);
  const readingSet = new Set((RW.words || []).map(norm));
  const r2h = new Map();      const R2H = RW.reading_to_learning_head || {};
  for (const k of Object.keys(R2H)) r2h.set(norm(k), R2H[k]);
  const bigSet  = new Set((POLICY.big_card_words || []).map(norm));
  const headSet = new Set((POLICY.learning_heads || []).map(norm));
  const properMap = new Map();
  for (const c of (Array.isArray(PROPER) ? PROPER : [])) if (c && c.word) properMap.set(norm(c.word), c);

  const famByWord = new Map();
  for (const f of FAMS) for (const x of (f.words || [])) {
    const k = norm(x); if (!famByWord.has(k)) famByWord.set(k, []); famByWord.get(k).push(f);
  }
  const headToKin = new Map(); const H2K = BRIDGE.head_to_kin_clusters || {};
  for (const k of Object.keys(H2K)) headToKin.set(norm(k), H2K[k]);
  const clusterWords = new Map(); const C2W = BRIDGE.kin_cluster_to_words || {};
  for (const k of Object.keys(C2W)) clusterWords.set(norm(k), C2W[k]);
  // fallback: kin cluster words straight from the kin file
  for (const c of KINS) if (!clusterWords.has(norm(c.cluster_id))) clusterWords.set(norm(c.cluster_id), c.words || []);
  const navMap = new Map(); for (const k of Object.keys(NAV)) navMap.set(norm(k), NAV[k]);
  const groupMap = new Map(); for (const k of Object.keys(GROUPS)) groupMap.set(norm(k), GROUPS[k]);

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
  function regKey(w) {
    if (regMap.has(w)) return w;
    for (const c of lemmaCandidates(w)) if (regMap.has(c)) return c;
    return null;
  }
  function readingKey(w) {
    if (readingSet.has(w) || regMap.has(w)) return regKey(w) || (readingSet.has(w) ? w : null);
    for (const c of lemmaCandidates(w)) if (readingSet.has(c)) return regKey(c) || c;
    return null;
  }
  // learning head (族长): the reading→head map, else the family cluster head.
  function learningHead(w) {
    const e = r2h.get(w);
    if (e && e.learning_head) return norm(e.learning_head);
    const cs = famByWord.get(w);
    if (cs && cs.length) {
      let best = cs[0];
      for (const c of cs) if ((c.words || []).length > (best.words || []).length) best = c;
      if (best.head) return norm(best.head);
    }
    return w;
  }

  /* ---------- small card (reading click) ---------- */
  const smallCache = new Map();
  function getSmallCard(word) {
    const w = cleanTok(word);
    if (!w) return null;
    if (smallCache.has(w)) return smallCache.get(w);
    let res = null;
    const pc = properMap.get(w) || (function () { for (const c of lemmaCandidates(w)) if (properMap.has(c)) return properMap.get(c); return null; })();
    if (pc) {
      res = { type: 'proper', word: pc.word || w, pos: posOf(pc), zh: pc.zh || '',
        phrases: normPhrases(pc.phrases), examples: normExamples(pc.examples),
        head: null, clickableForBigCard: false, proper: true, resolvedWord: pc.word || w };
    } else {
      const rk = readingKey(w);
      const card = rk ? regMap.get(rk) : null;
      if (card) {
        const head = learningHead(rk);
        const headOpenable = bigSet.has(head) || regMap.has(head);
        res = { type: 'word', word: card.word || rk, pos: posOf(card), zh: card.zh || '',
          phrases: normPhrases(card.phrases), examples: normExamples(card.examples),
          head: { word: head, openable: headOpenable },
          clickableForBigCard: bigSet.has(rk) || headOpenable, resolvedWord: card.word || rk };
      }
    }
    smallCache.set(w, res);
    return res;
  }
  function isClickableWord(word) { return !!getSmallCard(word); }

  /* ---------- big card (current word; shared family + kin + family-kin + group) ---------- */
  function shapeMember(id, headKey) {
    const k = norm(id);
    const reg = regMap.get(k);
    const clickable = bigSet.has(k);
    if (reg) return { word: reg.word || id, pos: posOf(reg), zh: reg.zh || '',
      phrases: normPhrases(reg.phrases, 1), examples: [], clickable, isHead: k === headKey };
    return { word: id, pos: '', zh: '', phrases: [], examples: [], clickable, isHead: k === headKey };
  }
  const bigCache = new Map();
  function getBigCard(word) {
    const w0 = cleanTok(word);
    if (properMap.has(w0)) return null;
    const w = regKey(w0);
    if (!w) return null;
    if (bigCache.has(w)) return bigCache.get(w);
    const c = regMap.get(w);
    const head = learningHead(w);

    // FAMILY (shared) — the cluster containing the current word, minus itself.
    let cluster = null;
    for (const f of (famByWord.get(w) || [])) if (!cluster || (f.words || []).length > (cluster.words || []).length) cluster = f;
    const famWords = new Set((cluster ? cluster.words : []).map(norm)); famWords.delete(w);
    const clusterHead = cluster ? norm(cluster.head) : head;
    const family = [...famWords].map(id => shapeMember(id, clusterHead))
      .sort((a, b) => (b.isHead - a.isHead) || a.word.localeCompare(b.word));

    // KIN (current word's own clusters via the bridge) — not shared.
    const kinWords = new Set();
    (headToKin.get(w) || []).forEach(id => (clusterWords.get(norm(id)) || []).forEach(x => kinWords.add(norm(x))));
    kinWords.delete(w);
    const kin = [...kinWords].map(id => shapeMember(id, clusterHead)).sort((a, b) => a.word.localeCompare(b.word));

    // FAMILY-KIN routes — head → family word → that family word's own kin.
    const navEntry = navMap.get(w) || navMap.get(head);
    const familyKin = ((navEntry && navEntry.family_kin_routes) || []).map(r => ({
      via: r.through_family_word,
      words: (r.kin_words || []).filter(x => norm(x) !== norm(r.through_family_word)).map(id => shapeMember(id, clusterHead)),
    })).filter(r => r.words.length);

    // GROUP — synonyms, excluding anything already shown in family/kin.
    const shown = new Set([w, ...famWords, ...kinWords]);
    const grpWords = new Set();
    (groupMap.get(w) || []).concat(groupMap.get(head) || []).forEach(x => { if (!shown.has(norm(x))) grpWords.add(norm(x)); });
    const group = [...grpWords].map(id => shapeMember(id, clusterHead)).sort((a, b) => a.word.localeCompare(b.word));

    const out = { word: c.word || w, family_head: head, pos: posOf(c), zh: c.zh || '',
      phrases: normPhrases(c.phrases), examples: normExamples(c.examples), head: null,
      family_members: family, kin_members: kin, family_kin: familyKin, group };
    bigCache.set(w, out);
    return out;
  }

  function getFamilyHead(word) { return learningHead(regKey(cleanTok(word)) || cleanTok(word)); }
  function getWordCard(word)   { const k = regKey(cleanTok(word)); return k ? regMap.get(k) : null; }
  function resolveReadingWord(word) {
    const sc = getSmallCard(word);
    return { raw: word, resolvedWord: sc ? sc.resolvedWord : cleanTok(word), card: sc, matchType: sc ? (sc.proper ? 'proper' : 'word') : 'none' };
  }

  window.VocabRuntime = {
    getSmallCard, getBigCard, isClickableWord, getFamilyHead, getWordCard,
    resolveReadingWord, isSmallOnly: (c) => !!(c && c.proper),
  };
})();
