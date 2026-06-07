/* Mock word library. Replace with real data later.
   Schema:
   {
     id, word, meaning,
     collocations: [string]            // short colocations for side-pin
     family:  [{word, text}],          // HER FAMILY (derivatives)
     friend:  [string],                // HER FRIEND (collocations)
     kin:     [string],                // HER KIN (cognates / roots)
     example, exampleZh
   }
*/
const WORDS = [
  {
    id: "approximate",
    word: "approximate",
    meaning: "近似；估算；接近",
    collocations: [
      "approximate the cost",
      "approximate real demand"
    ],
    family: [
      { word: "approximation",  text: "n. 近似值；rough approximation 粗略近似值" },
      { word: "approximately",  text: "adv. 大约；approximately equal 大约相等" },
      { word: "approximated",   text: "adj. 近似的；approximated figure 近似数字" }
    ],
    friend: [
      "approximate the cost 估算成本",
      "approximate real demand 粗略估算真实需求"
    ],
    kin: [
      "proximity n. 接近；geographical proximity 地理邻近",
      "proximity to schools 靠近学校"
    ],
    example: "Early figures may only approximate the cost of transport projects and stadiums.",
    exampleZh: "早期数据可能只能粗略估算交通项目和体育场的成本。"
  },
  {
    id: "singularity",
    word: "singularity",
    meaning: "奇点；独特性；无穷密度的点",
    collocations: [
      "approach a singularity",
      "a point of singularity"
    ],
    family: [
      { word: "singular",       text: "adj. 单一的；非凡的；singular focus 专注" },
      { word: "singularly",     text: "adv. 异常地；singularly important 异常重要" },
      { word: "single",         text: "adj. 单一的；single moment 单一时刻" }
    ],
    friend: [
      "approach a singularity 接近奇点",
      "gravitational singularity 引力奇点"
    ],
    kin: [
      "unique adj. 唯一的；unique property 独特性",
      "solitary adj. 单独的；solitary point 孤立点"
    ],
    example: "The entirety of the cosmos was condensed into a singularity smaller than an atom.",
    exampleZh: "整个宇宙曾被压缩进一个比原子还小的奇点。"
  }
];

// Lookup helpers
const WORDS_BY_ID = Object.fromEntries(WORDS.map(w => [w.id, w]));
function getWord(id) { return WORDS_BY_ID[id]; }
