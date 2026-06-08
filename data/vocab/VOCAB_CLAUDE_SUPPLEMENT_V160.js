/* The Princess Lexicon — Claude data supplement (V160)
   Backfills COMMON everyday words the warehouse was missing entirely (the owl
   warehouse skews academic, so basic reading words like room / door / read /
   smile / quiet had no card at all — "一堆词没词卡看不懂啦"). These are added
   as registry cards so they become clickable small cards that show a meaning.

   Only BASE forms are listed; regular plural / -s / -ing / -ed inflections
   resolve to these via the runtime lemmatizer. A handful of irregular surface
   forms that actually appear (meant, heard, held, brought, stood, wrote,
   built, laid, lost, feet) are listed explicitly.

   Loaded BEFORE VOCAB_RUNTIME_HELPERS so the helper indexes them. ADD-only —
   never overwrites an existing card. */
(function () {
  var ROOT = window.VOCAB_WORD_CONTENT_REGISTRY_LITE;
  if (!ROOT) return;
  var REG = ROOT.cards || (ROOT.cards = {});

  // [word, pos, zh] — concise, learner-facing glosses.
  var ADD = [
    // places / objects in the story
    ["room", "n.", "房间"], ["door", "n.", "门"], ["hall", "n.", "大厅；走廊"],
    ["floor", "n.", "地板；楼层"], ["seat", "n.", "座位"], ["chair", "n.", "椅子"],
    ["desk", "n.", "书桌"], ["deck", "n.", "甲板"], ["yacht", "n.", "游艇"],
    ["piano", "n.", "钢琴"], ["clock", "n.", "时钟"], ["card", "n.", "卡片；纸牌"],
    ["wing", "n.", "翅膀；侧厅"], ["saloon", "n.", "（船上的）大厅；沙龙"],
    ["gangway", "n.", "（上下船的）跳板；通道"], ["ceiling", "n.", "天花板"],
    ["wardrobe", "n.", "衣柜；全部衣物"], ["coat", "n.", "外套"],
    ["lectern", "n.", "讲台；读经台"], ["forum", "n.", "论坛；讨论会"],
    ["apple", "n.", "苹果"], ["dinner", "n.", "晚餐"], ["party", "n.", "聚会；派对"],
    ["lecture", "n.", "讲座；演讲"], ["saloon", "n.", "大厅；沙龙"],
    // body / people
    ["head", "n.", "头；头部"], ["hair", "n.", "头发"], ["eye", "n.", "眼睛"],
    ["wrist", "n.", "手腕"], ["spine", "n.", "脊柱；书脊"], ["foot", "n.", "脚"],
    ["feet", "n.", "脚（foot 的复数）"], ["girl", "n.", "女孩"], ["boy", "n.", "男孩"],
    ["woman", "n.", "女人"], ["friend", "n.", "朋友"], ["people", "n.", "人们"],
    ["dean", "n.", "（大学的）院长；系主任"], ["thing", "n.", "东西；事情"],
    // time
    ["morning", "n.", "早晨；上午"], ["afternoon", "n.", "下午"],
    ["tonight", "adv.", "今晚"], ["afterward", "adv.", "之后；后来"],
    ["hour", "n.", "小时"], ["week", "n.", "星期；周"], ["month", "n.", "月份"],
    ["year", "n.", "年"], ["day", "n.", "天；白天"], ["autumn", "n.", "秋天"],
    ["twice", "adv.", "两次"], ["anyway", "adv.", "无论如何；反正"],
    // common verbs (base)
    ["read", "v.", "读；阅读"], ["smile", "v./n.", "微笑"], ["stay", "v.", "停留；留下"],
    ["hear", "v.", "听见"], ["cough", "v./n.", "咳嗽"], ["sit", "v.", "坐"],
    ["bring", "v.", "带来"], ["catch", "v.", "抓住；赶上"], ["learn", "v.", "学习"],
    ["thank", "v.", "感谢"], ["laugh", "v./n.", "笑"], ["sleep", "v./n.", "睡觉"],
    ["gaze", "v./n.", "凝视"], ["glance", "v./n.", "一瞥；扫视"], ["hurt", "v.", "使受伤；疼痛"],
    ["clean", "v./adj.", "打扫；干净的"], ["row", "v./n.", "划（船）；一排"],
    ["have", "v.", "有；持有"], ["know", "v.", "知道；认识"], ["step", "v./n.", "踏步；台阶"],
    ["stand", "v.", "站立"], ["build", "v.", "建造"], ["write", "v.", "写"],
    ["hold", "v.", "握住；举行"], ["lay", "v.", "放置；铺"], ["lose", "v.", "丢失；输"],
    ["mean", "v.", "意思是；意味着"], ["needs", "v.", "需要"],
    // irregular surface forms that appear in the text
    ["meant", "v.", "意味着（mean 的过去式）"], ["heard", "v.", "听见（hear 的过去式）"],
    ["held", "v.", "握住；举行（hold 的过去式）"], ["brought", "v.", "带来（bring 的过去式）"],
    ["stood", "v.", "站立（stand 的过去式）"], ["wrote", "v.", "写（write 的过去式）"],
    ["built", "v.", "建造（build 的过去式）"], ["laid", "v.", "放置（lay 的过去式）"],
    ["lost", "v./adj.", "丢失的；迷失的（lose 的过去式）"],
    // common adjectives / others
    ["quiet", "adj.", "安静的"], ["empty", "adj.", "空的"], ["alone", "adj./adv.", "独自的；单独地"],
    ["full", "adj.", "满的；充满的"], ["good", "adj.", "好的"], ["wrong", "adj.", "错误的"],
    ["white", "adj./n.", "白色的；白色"], ["fast", "adj./adv.", "快的；快速地"],
    ["easy", "adj.", "容易的"], ["worse", "adj.", "更差的；更糟的"], ["little", "adj.", "小的；少的"],
    ["much", "adj./adv.", "许多；很"], ["half", "n./adj.", "一半"], ["further", "adj./adv.", "更远的；进一步"],
    ["together", "adv.", "一起"], ["badly", "adv.", "糟糕地；严重地"], ["either", "adv./adj.", "任一；也（不）"],
    ["back", "n./adv.", "背部；后面；回"], ["word", "n.", "单词；话语"], ["sorry", "adj.", "抱歉的；遗憾的"],
    ["nomination", "n.", "提名；任命"], ["fieldwork", "n.", "实地考察；田野工作"],
    ["english", "n./adj.", "英语；英国的"], ["one", "n./pron.", "一；一个"],
    // numbers
    ["three", "num.", "三"], ["four", "num.", "四"], ["seven", "num.", "七"],
    ["hundred", "num.", "百"], ["forty", "num.", "四十"], ["third", "num./adj.", "第三"],
    ["next", "adj./adv.", "下一个；接下来"],
  ];

  ADD.forEach(function (e) {
    var w = e[0];
    if (REG[w]) return;                      // never overwrite an existing card
    REG[w] = { word: w, pos: e[1], zh: e[2], phrases: [], examples: [], source: "v160" };
  });
})();
