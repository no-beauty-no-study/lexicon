/* The Princess Lexicon — Claude data supplement (V159)
   Fixes a few user-flagged data faults from codex: wrong part-of-speech tags
   (e.g. intact / astronomy marked "n./v.") and high-value words left with no
   example/phrase. Loaded BEFORE VOCAB_RUNTIME_HELPERS so the helper indexes
   the corrected cards. Mutates EXISTING cards (unlike V158, which only adds). */
(function () {
  var REG = window.VOCAB_WORD_CONTENT_REGISTRY_LITE && window.VOCAB_WORD_CONTENT_REGISTRY_LITE.cards;
  if (!REG) return;
  function ex(e, z) { return { example: e, example_zh: z, source: "v159" }; }
  function ph(p, z) { return { phrase: p, phrase_zh: z, source: "v159" }; }
  function fix(w, patch) {
    var c = REG[w]; if (!c) return;
    if (patch.pos) c.pos = patch.pos;
    if (patch.zh)  c.zh = patch.zh;
    if (patch.phrases) { c.phrases = c.phrases || []; patch.phrases.forEach(function (p) { if (!c.phrases.some(function (x) { return x.phrase === p.phrase; })) c.phrases.push(p); }); }
    if (patch.examples) { c.examples = c.examples || []; patch.examples.forEach(function (e) { if (!c.examples.some(function (x) { return x.example === e.example; })) c.examples.push(e); }); }
  }

  fix("intact", { pos: "adj.", zh: "完整无缺的；未受损的",
    phrases: [ph("remain intact", "保持完好"), ph("survive intact", "完好地保存下来")],
    examples: [ex("The ancient manuscript survived the fire completely intact.", "那份古老的手稿在大火中完好无损地保存了下来。")] });

  fix("astronomy", { pos: "n.",
    phrases: [ph("modern astronomy", "现代天文学"), ph("study astronomy", "研究天文学")],
    examples: [ex("She fell in love with astronomy the first night she looked through a telescope.", "她第一晚透过望远镜观察后，就爱上了天文学。")] });

  fix("astronomer", { pos: "n.",
    phrases: [ph("a professional astronomer", "一位专业天文学家"), ph("ancient astronomers", "古代天文学家")],
    examples: [ex("The astronomer spent decades mapping distant galaxies.", "这位天文学家花了数十年绘制遥远星系的图谱。")] });
})();
