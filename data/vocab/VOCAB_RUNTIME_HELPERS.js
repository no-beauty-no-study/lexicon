(function () {
  function norm(word) { return String(word || '').trim().toLowerCase(); }

  function propsToMap(obj, keyField) {
    const map = new Map();
    if (!obj) return map;
    if (Array.isArray(obj)) {
      for (const item of obj) if (item && item[keyField]) map.set(norm(item[keyField]), item);
    } else {
      for (const [k, v] of Object.entries(obj)) map.set(norm(k), v);
    }
    return map;
  }

  const wordMaster   = window.VOCAB_WORD_MASTER_FINAL || {};
  const kinMaster    = window.VOCAB_KIN_CLUSTER_MASTER_FINAL || {};
  const familyMaster = window.VOCAB_FAMILY_CONTENT_MASTER_FINAL || {};
  const properMaster = window.VOCAB_PROPER_SMALL_CARDS_FINAL || {};

  const wordCards = wordMaster.cards || {};
  const wordCardMap = propsToMap(wordCards, 'word');
  const wordToFamilyHead = window.VOCAB_FAMILY_HEAD_MAP_FINAL || familyMaster.word_to_family_head || {};
  const familyByHead = propsToMap(familyMaster.families || [], 'family_head');
  const kinById = propsToMap(kinMaster.kin_clusters || [], 'cluster_id');
  const properSmallByWord = propsToMap(properMaster.small_cards || [], 'word');

  const CJK = /[一-鿿]/;

  // Some reading-surface cards store phrases as a FLAT array
  // ["en","zh","en2","zh2"]; normal cards use [{phrase,phrase_zh}].
  // Normalise both to [{phrase, phrase_zh}].
  function normPhrases(arr) {
    if (!Array.isArray(arr) || !arr.length) return [];
    if (typeof arr[0] === 'object') return arr.filter(Boolean);
    const out = [];
    for (let i = 0; i < arr.length; i += 2) {
      const en = arr[i], zh = arr[i + 1] || '';
      if (en) out.push({ phrase: en, phrase_zh: zh });
    }
    return out;
  }
  // Examples: [{example,example_zh}] OR flat strings (en or zh).
  function normExamples(arr) {
    if (!Array.isArray(arr) || !arr.length) return [];
    return arr.map(x => {
      if (x && typeof x === 'object') return x;
      const s = String(x || '');
      return CJK.test(s) ? { example: '', example_zh: s } : { example: s, example_zh: '' };
    }).filter(x => x.example || x.example_zh);
  }

  function getWordCard(word) {
    const key = norm(word);
    return wordCardMap.get(key) || wordCards[word] || null;
  }
  // Best part-of-speech for a card: the `pos` field if it looks like a
  // real POS tag (contains a dot and isn't just the word echoed back),
  // else the leading pos tag inside the zh gloss ("v. 建立" → "v.").
  function posOf(card) {
    if (!card) return '';
    const p = card.pos;
    if (p && norm(p) !== norm(card.word || '') && /\./.test(p)) return String(p).trim();
    const m = String(card.zh || '').match(/^\s*([A-Za-z][A-Za-z.\/\- ]*\.)\s/);
    return m ? m[1].trim() : '';
  }
  function getProperSmallCard(word) { return properSmallByWord.get(norm(word)) || null; }
  function getFamilyHead(word) {
    const key = norm(word);
    return norm(wordToFamilyHead[key] || wordToFamilyHead[word] || key);
  }
  // small_only / no_big_card → no drawer (proper/place/symbol/low-value).
  function isSmallOnly(card) {
    return !!(card && (card.no_big_card === true || card.card_scope === 'small_only'));
  }
  function isClickableWord(word) {
    const c = getWordCard(word);
    return !!c && !isSmallOnly(c);
  }

  // Inflected reading surface → base lemma candidates (regex fallback).
  function lemmaCandidates(w) {
    const out = [], add = (x) => { if (x && x !== w && out.indexOf(x) === -1) out.push(x); };
    if (/ies$/.test(w))  add(w.slice(0, -3) + 'y');
    if (/es$/.test(w))   { add(w.slice(0, -2)); add(w.slice(0, -1)); }
    if (/s$/.test(w) && !/ss$/.test(w)) add(w.slice(0, -1));
    if (/ied$/.test(w))  add(w.slice(0, -3) + 'y');
    if (/ed$/.test(w))   { add(w.slice(0, -2)); add(w.slice(0, -1)); }  // erupted→erupt, consumed→consume
    if (/ing$/.test(w))  { add(w.slice(0, -3)); add(w.slice(0, -3) + 'e'); } // consuming→consume
    if (/ically$/.test(w)) add(w.slice(0, -6) + 'ic');
    if (/ally$/.test(w)) add(w.slice(0, -4) + 'al');
    if (/ly$/.test(w))   add(w.slice(0, -2));
    if (/est$/.test(w))  { add(w.slice(0, -3)); add(w.slice(0, -2)); }
    if (/er$/.test(w))   { add(w.slice(0, -2)); add(w.slice(0, -1)); }
    return out;
  }

  // Memo cache keyed by the CLEANED lowercase token. A reading section is
  // ~180 words, most of them non-vocab ("the", "was", "of") that otherwise
  // run the WHOLE fallback chain (10 regex tests + several map lookups) to
  // a null result on EVERY build. Building a fresh section was therefore
  // ~180 cold full-miss chains run synchronously — the jank felt on the
  // forward page-turn (a *new* section), while turning back to an
  // already-resolved section felt smooth. Caching collapses both to O(1).
  const resolveCache = new Map();

  // raw reading token → the card to show. Tries: inflection→base-lemma
  // collapse (defies→defy) → exact card → regex lemma → family-head map →
  // proper small card.
  function resolveReadingWord(rawToken) {
    const raw = String(rawToken || '');
    const w = norm(raw).replace(/^[^a-z]+|[^a-z]+$/g, '').replace(/'s$/, '');
    if (!w) return { raw, resolvedWord: w, card: null, matchType: 'none' };

    const cached = resolveCache.get(w);
    if (cached) return { ...cached, raw };

    const result = resolveCore(w);
    resolveCache.set(w, result);
    return { ...result, raw };
  }

  function resolveCore(w) {
    // INFLECTION → BASE LEMMA. A plural/tense surface form (defies, studies,
    // erupted) should pop the BASE word's card (defy, study, erupt) — even
    // when the surface form has its own master entry. We only collapse when
    // the family head is *also* a regex-lemma of the surface word, so true
    // DERIVATIONS (defiance, defiant → keep their own distinct card) are
    // left alone — their head is not among the inflection candidates.
    const head = getFamilyHead(w);
    if (head && head !== w) {
      const headCard = getWordCard(head);
      if (headCard && lemmaCandidates(w).indexOf(head) !== -1) {
        return { resolvedWord: head, card: headCard, matchType: 'lemma_head' };
      }
    }

    let c = getWordCard(w);
    if (c) return { resolvedWord: w, card: c, matchType: 'exact' };

    for (const cand of lemmaCandidates(w)) {
      c = getWordCard(cand);
      if (c) return { resolvedWord: cand, card: c, matchType: 'lemma' };
    }
    if (head && head !== w) {
      c = getWordCard(head);
      if (c) return { resolvedWord: head, card: c, matchType: 'family_head' };
    }
    const p = getProperSmallCard(w);
    if (p) return { resolvedWord: w, card: p, matchType: 'proper', proper: true };

    return { resolvedWord: w, card: null, matchType: 'none' };
  }

  function getSmallCard(word) {
    const r = resolveReadingWord(word);
    if (!r.card) return null;
    const card = r.card;
    return {
      type: r.proper ? 'proper_or_special' : 'word',
      word: card.word || r.resolvedWord,
      pos: posOf(card),
      zh: card.zh || '',
      phrases: normPhrases(card.phrases),
      examples: normExamples(card.examples),
      clickableForBigCard: !r.proper && !isSmallOnly(card),
      resolvedWord: r.resolvedWord,
      matchType: r.matchType
    };
  }

  // Internal kin words have no phrases of their own in the kin file —
  // pull ONE collocation from the word's master card to show alongside.
  function clickableKinWord(word) {
    const card = getWordCard(word);
    if (!card || isSmallOnly(card)) return null;
    return {
      word: card.word || word, pos: posOf(card), zh: card.zh || '',
      phrases: normPhrases(card.phrases).slice(0, 1), examples: [],
      clickable: true
    };
  }

  function getBigCard(word) {
    const r = resolveReadingWord(word);
    const focus = r.card;
    if (!focus || r.proper || isSmallOnly(focus)) return null;   // no big card

    const focusWord = focus.word || r.resolvedWord;
    const familyHead = getFamilyHead(focusWord);
    const family = familyByHead.get(familyHead) || null;

    let familyMembers = family ? (family.family_members || []) : (focus.family_members || []);
    if (!Array.isArray(familyMembers)) familyMembers = [];
    const focusKey = norm(focusWord);
    familyMembers = [...familyMembers].sort((a, b) => {
      const aw = norm(a.word), bw = norm(b.word);
      if (aw === focusKey) return -1; if (bw === focusKey) return 1;
      if (aw === familyHead) return -1; if (bw === familyHead) return 1;
      return aw.localeCompare(bw);
    }).map(m => ({ ...m, pos: posOf(m), phrases: normPhrases(m.phrases), examples: normExamples(m.examples), clickable: isClickableWord(m.word) }));

    const kinIds = new Set(Array.isArray(focus.kin_cluster_ids) ? focus.kin_cluster_ids : []);
    if (family && Array.isArray(family.shared_kin_cluster_ids)) for (const id of family.shared_kin_cluster_ids) kinIds.add(id);
    const headCard = getWordCard(familyHead);
    if (headCard && Array.isArray(headCard.kin_cluster_ids)) for (const id of headCard.kin_cluster_ids) kinIds.add(id);

    const kinClusters = [...kinIds]
      .map(id => kinById.get(norm(id)) || kinById.get(id)).filter(Boolean)
      .map(cluster => {
        const internal = (Array.isArray(cluster.internal_words) ? cluster.internal_words : [])
          .filter(w => norm(w) !== focusKey)
          .map(w => clickableKinWord(w) || { word: w, clickable: false });
        const external = (Array.isArray(cluster.external_words) ? cluster.external_words : [])
          .map(e => ({ ...e, pos: posOf(e), clickable: isClickableWord(e.word) }));
        return { ...cluster, internal_words: internal, external_words: external };
      });

    let group = focus.group || [];
    if (group && !Array.isArray(group)) group = [group];
    group = group.map(g => ({ ...g, pos: posOf(g), phrases: normPhrases(g.phrases), clickable: isClickableWord(g.word) }));

    return {
      focus_word: focusWord, family_head: familyHead, word: focusWord,
      pos: posOf(focus),
      zh: focus.zh || '', phrases: normPhrases(focus.phrases), examples: normExamples(focus.examples),
      family_members: familyMembers, group, kin_clusters: kinClusters
    };
  }

  window.VocabRuntime = {
    getWordCard, getProperSmallCard, getFamilyHead,
    resolveReadingWord, getSmallCard, getBigCard, isClickableWord, isSmallOnly,
    indexes: { wordCardMap, familyByHead, kinById, properSmallByWord }
  };
})();
