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
  const VIS    = window.VOCAB_ENTRY_VISIBILITY_POLICY_LITE || {};
  const DOTTED = (window.VOCAB_DOTTED_LITE || {}).dotted || {};
  const PROPER = (window.VOCAB_PROPER_SMALL_CARDS_FINAL || {}).small_cards || [];

  const regMap = new Map();   for (const k of Object.keys(REG)) regMap.set(norm(k), REG[k]);
  const readingSet = new Set((RW.words || []).map(norm));
  // Words demoted out of the reading layer (simple bridge heads + removed
  // low-value exact entries like "be / come / dog / film / forty").
  const noReading = new Set();
  for (const w of (VIS.simple_bridge_heads_no_reading_entry || [])) noReading.add(norm(w));
  for (const e of (VIS.removed_reading_entries || [])) if (e && e.word) noReading.add(norm(e.word));
  const dottedMap = new Map(); for (const k of Object.keys(DOTTED)) dottedMap.set(norm(k), DOTTED[k]);
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
    // comparative / superlative (-er / -est), incl. -ier/-iest → -y
    if (/iest$/.test(w)) add(w.slice(0, -4) + 'y');
    if (/est$/.test(w))  { add(w.slice(0, -3)); add(w.slice(0, -2)); }
    if (/ier$/.test(w))  add(w.slice(0, -3) + 'y');
    if (/er$/.test(w))   { add(w.slice(0, -2)); add(w.slice(0, -1)); }
    // doubled-consonant inflections: bigger→big, hottest→hot, stopped→stop, running→run
    const dbl = w.match(/([bcdfghjklmnpqrstvwxz])\1(er|est|ed|ing)$/);
    if (dbl) add(w.slice(0, w.length - dbl[0].length + 1));
    return out;
  }
  function cleanTok(raw) { return norm(raw).replace(/^[^a-z]+|[^a-z]+$/g, '').replace(/'s$/, ''); }
  function regKey(w) {
    if (regMap.has(w)) return w;
    for (const c of lemmaCandidates(w)) if (regMap.has(c)) return c;
    return null;
  }
  // Reading 复数/-ing/-ed forms must open the BASE word's card, even when the
  // inflected surface also has its own entry: prefer a de-inflected lemma
  // that exists in the registry over the exact surface form.
  function lemmaPrefer(w) {
    if (regMap.has(w) && bigSet.has(w)) return w;
    for (const c of lemmaCandidates(w)) if (regMap.has(c)) return c;
    if (regMap.has(w)) return w;
    return null;
  }
  function readingKey(w) {
    if (noReading.has(w)) return null;            // demoted out of the reading layer
    if (readingSet.has(w) || regMap.has(w)) return lemmaPrefer(w) || (readingSet.has(w) ? w : null);
    for (const c of lemmaCandidates(w)) if (readingSet.has(c)) return lemmaPrefer(c) || c;
    return null;
  }
  // Syllable-dotted spelling (ex·cep·tion·al) for the Golden Seal reveal.
  function dottedOf(word) { return dottedMap.get(norm(word)) || String(word || ""); }
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
        const hasBig = !!getBigCard(rk);   // owl-only words have no big card
        res = { type: 'word', word: card.word || rk, pos: posOf(card), zh: card.zh || '',
          phrases: normPhrases(card.phrases), examples: normExamples(card.examples),
          head: hasBig ? { word: head, openable: true } : null,
          clickableForBigCard: hasBig, resolvedWord: card.word || rk };
      }
    }
    // LAST RESORT — the word isn't a proper/place card and the registry +
    // reading graph don't cover it, but the owl warehouse does. Build a small
    // card from the warehouse so the reading word is still a clickable entry
    // (e.g. customary). Its big card shows the warehouse meanings + cut.
    if (!res) {
      const m = owlMatch(w);
      if (m && m.entry.meanings && m.entry.meanings.length) {
        const owl = m.entry;
        const zh = owl.meanings.map(x => x.zh).filter(Boolean).join('；');
        const phrases = []; owl.meanings.forEach(x => (x.phrases || []).forEach(p => phrases.push(p)));
        const examples = []; owl.meanings.forEach(x => { if (x.example || x.example_zh) examples.push({ example: x.example, example_zh: x.example_zh }); });
        res = { type: 'owl', word: m.key, pos: owl.meanings[0].pos || '', zh,
          phrases: normPhrases(phrases), examples: normExamples(examples),
          head: null, clickableForBigCard: true, owl: true, resolvedWord: m.key };
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
    if (!w) return owlBigCard(w0);          // warehouse-only word (e.g. customary)
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
    const navE = navMap.get(w) || navMap.get(head);
    const kinWords = new Set();
    (headToKin.get(w) || []).forEach(id => (clusterWords.get(norm(id)) || []).forEach(x => kinWords.add(norm(x))));
    // V149/V153 patches fill nav entries with expanded kin_words for words
    // whose kin clusters weren't wired ("missing kin" like condense).
    if (navE && Array.isArray(navE.kin_words)) navE.kin_words.forEach(x => kinWords.add(norm(x)));
    // family-kin routes also count as kin (no separate "family-kin" region).
    if (navE && Array.isArray(navE.family_kin_routes))
      navE.family_kin_routes.forEach(r => (r.kin_words || []).forEach(x => kinWords.add(norm(x))));
    kinWords.delete(w);
    const kin = [...kinWords].map(id => shapeMember(id, clusterHead)).sort((a, b) => a.word.localeCompare(b.word));

    // GROUP — synonyms, excluding anything already shown in family/kin.
    const shown = new Set([w, ...famWords, ...kinWords]);
    const grpWords = new Set();
    (groupMap.get(w) || []).concat(groupMap.get(head) || []).forEach(x => { if (!shown.has(norm(x))) grpWords.add(norm(x)); });
    const group = [...grpWords].map(id => shapeMember(id, clusterHead)).sort((a, b) => a.word.localeCompare(b.word));

    // HEAD region (原型) — the prefix/suffix-stripped core, shown as its own
    // region when it differs from the clicked word and has its own card.
    let headObj = null;
    if (head && head !== w && regMap.has(head)) {
      const hc = regMap.get(head);
      headObj = { word: hc.word || head, pos: posOf(hc), zh: hc.zh || '',
        phrases: normPhrases(hc.phrases, 2), examples: normExamples(hc.examples).slice(0, 1), clickable: true };
    }

    // A bare word with no head / family / kin / group has no graph to expand —
    // but if the warehouse carries its meanings/cut, still open a big card on
    // those (so warehouse words open big cards, per the user's request). Only
    // when the warehouse is silent too is it small-card-only (null).
    if (!headObj && !family.length && !kin.length && !group.length) {
      const ob = owlBigCard(w); bigCache.set(w, ob); return ob;
    }

    const out = { word: c.word || w, family_head: head, pos: posOf(c), zh: c.zh || '',
      phrases: normPhrases(c.phrases), examples: normExamples(c.examples),
      head: headObj, family_members: family, kin_members: kin, group };
    bigCache.set(w, out);
    return out;
  }

  function getFamilyHead(word) { return learningHead(regKey(cleanTok(word)) || cleanTok(word)); }
  function getWordCard(word)   { const k = regKey(cleanTok(word)); return k ? regMap.get(k) : null; }
  function resolveReadingWord(word) {
    const sc = getSmallCard(word);
    return { raw: word, resolvedWord: sc ? sc.resolvedWord : cleanTok(word), card: sc, matchType: sc ? (sc.proper ? 'proper' : 'word') : 'none' };
  }

  /* ---------- word-owl supplement (cut + per-meaning synonyms) ---------- */
  // Resolve a surface word to its owl-warehouse entry, returning the matched
  // KEY too (so callers know the canonical lemma — e.g. customary, not
  // "customarily"). The warehouse is the broadest layer (≈14k words), so it
  // also serves as the LAST-RESORT entry: any reading word the registry /
  // reading-set / family graph doesn't cover still becomes a clickable card
  // if the warehouse knows it (user req: reading entries must stay connected
  // as material grows).
  function owlMatch(word) {
    const W = (typeof window !== 'undefined') && window.WORD_OWL;
    if (!W) return null;
    const w = cleanTok(word); if (!w) return null;
    if (W[w]) return { key: w, entry: W[w] };
    for (const c of lemmaCandidates(w)) if (W[c]) return { key: c, entry: W[c] };
    return null;
  }
  function getOwl(word) { const m = owlMatch(word); return m ? m.entry : null; }
  // Minimal big-card object built straight from a warehouse entry, for words
  // the family/kin/group graph doesn't reach. renderBody pulls the cut + per-
  // meaning blocks itself (via getOwl/getCut), so empty member regions are fine.
  function owlBigCard(word) {
    const m = owlMatch(word);
    if (!m || !m.entry.meanings || !m.entry.meanings.length) return null;
    const first = m.entry.meanings[0] || {};
    return { word: m.key, family_head: null, pos: first.pos || '', zh: first.zh || '',
      phrases: [], examples: [], head: null,
      family_members: [], kin_members: [], group: [], owl: true };
  }
  // The slash decomposition + its Chinese, for the dictation-miss hint and the
  // word card. Returns null when the word has no real cut.
  function getCut(word) { const o = getOwl(word); return (o && o.cut && o.cut.slash) ? o.cut : null; }

  window.VocabRuntime = {
    getSmallCard, getBigCard, isClickableWord, getFamilyHead, getWordCard,
    resolveReadingWord, dotted: dottedOf, isSmallOnly: (c) => !!(c && c.proper),
    getOwl, getCut,
  };
})();
