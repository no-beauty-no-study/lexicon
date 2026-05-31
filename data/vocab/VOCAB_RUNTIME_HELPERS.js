(function () {
  function norm(word) {
    return String(word || '').trim().toLowerCase();
  }

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

  const wordMaster = window.VOCAB_WORD_MASTER_FINAL || {};
  const kinMaster = window.VOCAB_KIN_CLUSTER_MASTER_FINAL || {};
  const familyMaster = window.VOCAB_FAMILY_CONTENT_MASTER_FINAL || {};
  const properMaster = window.VOCAB_PROPER_SMALL_CARDS_FINAL || {};

  const wordCards = wordMaster.cards || {};
  const wordCardMap = propsToMap(wordCards, 'word');
  const wordToFamilyHead = window.VOCAB_FAMILY_HEAD_MAP_FINAL || familyMaster.word_to_family_head || {};
  const familyByHead = propsToMap(familyMaster.families || [], 'family_head');
  const kinById = propsToMap(kinMaster.kin_clusters || [], 'cluster_id');
  const properSmallByWord = propsToMap(properMaster.small_cards || [], 'word');

  function getWordCard(word) {
    const key = norm(word);
    return wordCardMap.get(key) || wordCards[word] || null;
  }

  function getProperSmallCard(word) {
    return properSmallByWord.get(norm(word)) || null;
  }

  function getFamilyHead(word) {
    const key = norm(word);
    return norm(wordToFamilyHead[key] || wordToFamilyHead[word] || key);
  }

  function isClickableWord(word) {
    return !!getWordCard(word);
  }

  function getSmallCard(word) {
    const card = getWordCard(word);
    if (card) {
      return {
        type: 'word',
        word: card.word || word,
        zh: card.zh || '',
        phrases: card.phrases || [],
        examples: card.examples || [],
        clickableForBigCard: true
      };
    }
    const proper = getProperSmallCard(word);
    if (proper) {
      return {
        type: 'proper_or_special',
        word: proper.word || word,
        zh: proper.zh || '',
        phrases: proper.phrases || [],
        examples: proper.examples || [],
        clickableForBigCard: false
      };
    }
    return null;
  }

  function clickableKinWord(word) {
    const card = getWordCard(word);
    if (!card) return null;
    return {
      word: card.word || word,
      zh: card.zh || '',
      phrases: card.phrases || [],
      examples: card.examples || [],
      clickable: true
    };
  }

  function getBigCard(word) {
    const focus = getWordCard(word);
    if (!focus) return null;

    const familyHead = getFamilyHead(word);
    const family = familyByHead.get(familyHead) || null;

    let familyMembers = family ? (family.family_members || []) : (focus.family_members || []);
    if (!Array.isArray(familyMembers)) familyMembers = [];
    const focusKey = norm(word);
    familyMembers = [...familyMembers].sort((a, b) => {
      const aw = norm(a.word);
      const bw = norm(b.word);
      if (aw === focusKey) return -1;
      if (bw === focusKey) return 1;
      if (aw === familyHead) return -1;
      if (bw === familyHead) return 1;
      return aw.localeCompare(bw);
    }).map(member => ({
      ...member,
      clickable: isClickableWord(member.word)
    }));

    const kinIds = new Set(Array.isArray(focus.kin_cluster_ids) ? focus.kin_cluster_ids : []);
    if (family && Array.isArray(family.shared_kin_cluster_ids)) {
      for (const id of family.shared_kin_cluster_ids) kinIds.add(id);
    }
    const headCard = getWordCard(familyHead);
    if (headCard && Array.isArray(headCard.kin_cluster_ids)) {
      for (const id of headCard.kin_cluster_ids) kinIds.add(id);
    }

    const kinClusters = [...kinIds]
      .map(id => kinById.get(norm(id)) || kinById.get(id))
      .filter(Boolean)
      .map(cluster => {
        const internal = (Array.isArray(cluster.internal_words) ? cluster.internal_words : [])
          .filter(w => norm(w) !== focusKey)
          .map(w => clickableKinWord(w) || { word: w, clickable: false });
        const external = (Array.isArray(cluster.external_words) ? cluster.external_words : []).map(e => ({
          ...e,
          clickable: isClickableWord(e.word)
        }));
        return { ...cluster, internal_words: internal, external_words: external };
      });

    let group = focus.group || [];
    if (group && !Array.isArray(group)) group = [group];
    group = group.map(g => ({ ...g, clickable: isClickableWord(g.word) }));

    return {
      focus_word: focus.word || word,
      family_head: familyHead,
      word: focus.word || word,
      zh: focus.zh || '',
      phrases: focus.phrases || [],
      examples: focus.examples || [],
      family_members: familyMembers,
      group,
      kin_clusters: kinClusters
    };
  }

  window.VocabRuntime = {
    getWordCard,
    getSmallCard,
    getBigCard,
    getFamilyHead,
    isClickableWord,
    indexes: { wordCardMap, familyByHead, kinById, properSmallByWord }
  };
})();
