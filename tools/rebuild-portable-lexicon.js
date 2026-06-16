const fs = require("fs");
const path = require("path");
const vm = require("vm");

const MAIN = path.resolve(__dirname, "..");
const OUT = process.env.LEXICON_EXPORT_OUT
  ? path.resolve(process.env.LEXICON_EXPORT_OUT)
  : path.join(MAIN, "data", "lexicon-portable");

const OWL_MD = path.join(MAIN, "audits", "word_owl_toefl_old_merged.md");
const FAMILY_JS = path.join(MAIN, "data", "vocab", "VOCAB_FAMILY_SHARED_CLUSTERS_LITE.js");
const KIN_MD = path.join(MAIN, "audits", "kin_repository_total.md");
const LEGACY_KIN_WORD_MD = path.join(MAIN, "audits", "kin_word_repository.md");
const REGISTRY_JS = path.join(MAIN, "data", "vocab", "VOCAB_WORD_CONTENT_REGISTRY_LITE.js");

function clean(value) {
  return String(value || "").trim();
}

function splitZhGloss(text) {
  const raw = clean(text);
  if (!raw) return { zh: "", gloss: "" };
  const parts = raw.split(/\s+/);
  const cutAt = parts.findIndex((part) => /^[A-Za-z][A-Za-z,\- ]*$/.test(part));
  if (cutAt < 0) return { zh: raw, gloss: "" };
  return {
    zh: parts.slice(0, cutAt).join(" "),
    gloss: parts.slice(cutAt).join(" ")
  };
}

function parseOwl() {
  const text = fs.readFileSync(OWL_MD, "utf8").replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  const cards = [];
  let card = null;
  let mode = "";
  let sense = null;

  function pushSense() {
    if (card && sense) {
      card.senses.push(sense);
      sense = null;
    }
  }

  function pushCard() {
    pushSense();
    if (card && card.head && card.senses.length) cards.push(card);
    card = null;
    mode = "";
  }

  const headerRe = /^([a-z][a-z'’-]*(?:-[a-z][a-z'’-]*)*)\s+\[([^\]]*)\]\s*$/i;
  const numberedRe = /^(\d+)\.\s+([a-z.\/]+)\s+(.+)$/i;
  const plainSenseRe = /^([a-z.\/]+)\s+(.+)$/i;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const header = headerRe.exec(line);
    if (header && !["example", "example_zh", "phrase"].some((p) => line.startsWith(`${p}:`))) {
      pushCard();
      card = {
        head: header[1].toLowerCase(),
        phonetic: header[2],
        cut: "",
        cutMeaning: "",
        senses: []
      };
      mode = "";
      continue;
    }
    if (!card || !line || line.startsWith("#")) continue;

    if (line === "cut:") {
      mode = "cut";
      continue;
    }
    const looksLikeSense = numberedRe.test(line) || plainSenseRe.test(line);
    numberedRe.lastIndex = 0;
    plainSenseRe.lastIndex = 0;

    if (mode === "cut" && !card.cut && !looksLikeSense) {
      card.cut = line;
      continue;
    }
    if (mode === "cut" && card.cut && !card.cutMeaning && !looksLikeSense) {
      card.cutMeaning = line;
      mode = "";
      continue;
    }
    if (mode === "cut" && looksLikeSense) {
      mode = "";
    }

    let m = numberedRe.exec(line);
    if (m) {
      pushSense();
      const parsed = splitZhGloss(m[3]);
      sense = {
        index: Number(m[1]),
        pos: m[2],
        zh: parsed.zh,
        gloss: parsed.gloss,
        examples: [],
        phrases: []
      };
      continue;
    }

    m = plainSenseRe.exec(line);
    if (!sense && m && !line.includes(":")) {
      const parsed = splitZhGloss(m[2]);
      sense = {
        index: "",
        pos: m[1],
        zh: parsed.zh,
        gloss: parsed.gloss,
        examples: [],
        phrases: []
      };
      continue;
    }

    if (!sense) continue;
    if (line.startsWith("example:")) {
      sense.examples.push({ en: clean(line.slice("example:".length)), zh: "" });
      continue;
    }
    if (line.startsWith("example_zh:")) {
      const last = sense.examples[sense.examples.length - 1];
      if (last) last.zh = clean(line.slice("example_zh:".length));
      continue;
    }
    if (line.startsWith("phrase:")) {
      const payload = clean(line.slice("phrase:".length));
      const parts = payload.split(/\s+-\s+/);
      sense.phrases.push({ en: clean(parts[0]), zh: clean(parts.slice(1).join(" - ")) });
    }
  }

  pushCard();
  return cards.sort((a, b) => a.head.localeCompare(b.head));
}

function parseFamilies() {
  const sandbox = { window: {} };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(FAMILY_JS, "utf8"), sandbox, { filename: FAMILY_JS });
  const source = sandbox.window.VOCAB_FAMILY_SHARED_CLUSTERS_LITE || {};
  const families = {};
  for (const cluster of source.family_clusters || []) {
    const head = clean(cluster.head).toLowerCase();
    const words = [...new Set((cluster.words || []).map((w) => clean(w).toLowerCase()).filter(Boolean))];
    if (head && words.length) families[head] = words;
  }

  // High-confidence repair already made on the UI branch; keep the portable game export in sync.
  families.commute = ["commute", "commuter", "commutable", "commutation"];
  families.consequence = ["consequence", "consequential", "consequently"];
  families.calibrate = ["calibrate", "calibration", "recalibrate"];
  families.serene = ["serene", "serenity"];
  families.gorge = ["gorge", "disgorge"];
  families.nominate = ["nominate", "nomination", "nominee"];
  families.field = [...new Set([...(families.field || ["field"]), "fieldwork"])];
  families.hurry = ["hurry", "hurried", "unhurried"];
  families.wardrobe = ["wardrobe"];
  families.wetland = ["wetland"];
  families.competent = ["competent", "competence", "competently", "incompetent", "incompetence"];
  families.cruel = ["cruel", "cruelty", "cruelly"];
  families.jealous = ["jealous", "jealousy", "jealously"];
  families.intake = ["intake"];
  families.lectern = ["lectern"];
  families.riverbed = ["riverbed"];
  families.suspect = ["suspect", "suspicion", "suspicious", "suspiciously"];
  families.tender = ["tender", "tenderness", "tenderly"];
  families.aftermath = ["aftermath"];
  families.aftertaste = ["aftertaste"];
  families.arctic = ["arctic"];
  families.yacht = ["yacht"];
  families.rumour = ["rumour", "rumourless"];
  families.lecture = ["lecture", "lecturer"];
  families.warm = ["warm", "warmth", "warmly"];
  families.saloon = ["saloon"];
  families.gangway = ["gangway"];
  families.medic = ["medic", "medical", "medically"];
  families.wrist = ["wrist"];
  families.afterward = ["afterward", "afterwards"];
  families.amber = ["amber"];
  families.flat = ["flat", "flatness", "flatten"];
  families.flinch = ["flinch"];
  families.supplement = ["supplement", "supplemental", "supplementary"];
  families.contempt = ["contempt", "contemptuous"];
  families.defer = ["defer", "deference", "deferential"];
  families.despise = ["despise", "despicable"];
  families.doily = ["doily"];
  families.grateful = ["grateful", "gratitude", "gratefully", "ungrateful"];
  families.hardship = ["hardship"];
  families.overboard = ["overboard"];
  families.porthole = ["porthole"];
  families.satisfy = ["satisfy", "satisfaction", "satisfactory", "unsatisfactory"];
  families.stopwatch = ["stopwatch"];
  families.throat = ["throat"];
  families.bother = ["bother", "bothered", "unbothered"];
  families.workday = ["workday"];
  families.afterthought = ["afterthought"];
  families.approach = ["approach", "approachable"];
  families.boredom = ["boredom", "bored"];
  families.brutal = ["brutal", "brutality", "brutally"];
  families.cliffhanger = ["cliffhanger"];
  families.capsize = ["capsize", "capsized"];
  families.clipboard = ["clipboard"];
  families.roommate = ["roommate"];
  families.colour = ["colour", "colourful", "colourless"];
  families.correct = ["correct", "correctly", "correction", "incorrect"];
  families.courtesy = ["courtesy", "courteous"];
  families.crouch = ["crouch"];
  families.curdle = ["curdle", "curdled"];
  families.curtain = ["curtain"];
  families.delusion = ["delusion", "delusional"];
  families.destiny = ["destiny"];
  families.endorse = ["endorse", "endorsement"];
  families.eyebrow = ["eyebrow"];
  families.fail = ["fail", "failure"];
  families.fever = ["fever", "feverish"];
  families.flood = ["flood"];
  families.forgive = ["forgive", "forgiven", "forgiveness"];
  families.friend = ["friend", "freshman", "freshmen", "friendship"];
  families.goodwill = ["goodwill"];
  families.handshake = ["handshake"];
  families.helpless = ["helpless", "helplessness"];
  families.effective = ["effective", "ineffective"];
  families.invigilate = ["invigilate", "invigilator"];
  families.invoice = ["invoice"];
  families.relevant = ["relevant", "irrelevant"];
  families.keynote = ["keynote"];
  families.microphone = ["microphone"];
  families.myocarditis = ["myocarditis"];
  families.nightfall = ["nightfall"];
  families.occur = ["occur", "occasion", "occasional"];
  families.run = [...new Set([...(families.run || ["run"]), "outrun", "overrun"])];
  families.hear = ["hear", "heard", "hearing", "overheard"];
  families.overplay = ["overplay", "overplayed"];
  families.password = ["password"];
  families.portal = ["portal"];
  families.protect = ["protect", "protective", "protectiveness"];
  families.punctual = ["punctual", "punctuality"];
  families.purpose = ["purpose", "purposeful"];
  families.radiator = ["radiator"];
  families.remedy = ["remedy"];
  families.rude = ["rude", "rudeness"];
  families.salvage = ["salvage", "salvaged"];
  families.splint = ["splint"];
  families.stifle = ["stifle", "stifled"];
  families.textbook = ["textbook"];
  families.threat = ["threat", "threaten", "threatening"];
  families.approve = ["approve", "approval", "disapprove"];
  families.academic = ["academic", "academically"];
  families.emotion = ["emotion", "emotional", "emotionally"];
  families.excellent = ["excellent", "excellence"];
  families.fright = ["fright", "frighten", "frightened", "frightening"];
  families.full = ["full", "fully", "fullness"];
  families.halfway = ["halfway"];
  families.inbox = ["inbox"];
  families.narrow = ["narrow", "narrowly"];
  families.offend = ["offend", "offended", "offense", "offensive"];
  families.paperwork = ["paperwork"];
  families.paragraph = ["paragraph"];
  families.suppress = ["suppress", "suppression", "suppressive"];
  families.survive = [...new Set([...(families.survive || ["survive"]), "survivable", "survival"])];
  families.tremble = ["tremble", "trembling"];
  families.trophy = ["trophy", "trophies"];
  families.vendor = ["vendor", "vend"];
  families.aisle = ["aisle"];
  families.armour = ["armour", "armoured"];
  families.archway = ["archway"];
  families.arrears = ["arrears"];
  families.back = ["back", "backward"];
  families.betray = ["betray", "betrayed", "betrayal"];
  families.citrus = ["citrus"];
  families.comfort = ["comfort", "comfortable", "uncomfortable"];
  families.discreet = ["discreet", "discretion"];
  families.employ = ["employ", "employee", "employment"];
  families.convenient = ["convenient", "inconvenience", "inconvenient"];
  families.junior = ["junior"];
  families.ledger = ["ledger"];
  families.profile = ["profile"];
  families.assign = ["assign", "reassign", "reassigned", "assignment"];
  families.recover = ["recover", "recovery", "recoverable"];
  families.reverse = ["reverse", "reversible", "reversibility", "irreversible"];
  families.sincere = [...new Set([...(families.sincere || ["sincere"]), "sincerity"])];
  families.usher = ["usher"];
  families.admire = ["admire", "admirable", "admiration"];
  families.holistic = ["holistic"];
  families.patient = [...new Set([...(families.patient || ["patient"]), "impatience", "impatient"])];
  families.onboard = ["onboard", "onboarding"];
  families.optimism = ["optimism", "optimistic"];
  families.overactive = ["overactive", "overactivity"];
  families.explain = ["explain", "overexplain", "overexplains", "explanation"];
  families.pastry = ["pastry"];
  families.pay = ["pay", "payment"];
  families.petty = ["petty"];
  families.practice = ["practice", "practise", "practised"];
  families.punctuate = [...new Set([...(families.punctuate || ["punctuate"]), "punctuation"])];
  families.reception = ["reception", "receptionist"];
  families.rehearse = ["rehearse", "rehearsal"];
  families.relate = ["relate", "relationship", "related"];
  families.repeat = ["repeat", "repeatability", "repeatable"];
  families.second = ["second", "secondary"];
  families.strategy = ["strategy", "strategic", "strategically"];
  families.supervise = ["supervise", "supervision", "supervisor"];
  families.dress = ["dress", "underdressed"];
  families.finish = ["finish", "finished", "unfinished"];
  families.endorse = [...new Set([...(families.endorse || ["endorse"]), "endorsement"])];
  families.fail = [...new Set([...(families.fail || ["fail"]), "failed", "failing", "failure"])];
  families.administrate = ["administrate", "administrative", "administratively", "administration"];
  families.annoy = ["annoy", "annoying", "annoyingly", "annoyance"];
  families.aspire = ["aspire", "aspiration", "aspirational"];
  families.bold = ["bold", "boldness", "boldly"];
  families.cancel = ["cancel", "cancellation"];
  families.cold = ["cold", "coldness"];
  families.cost = ["cost", "costly"];
  families.cruel = [...new Set([...(families.cruel || ["cruel"]), "crueler"])];
  families.definite = ["definite", "definitely", "definition"];
  families.agree = [...new Set([...(families.agree || ["agree"]), "agreeable", "disagreeable"])];
  families.comfort = [...new Set([...(families.comfort || ["comfort"]), "comfortable", "discomfort", "uncomfortable"])];
  families.distribute = [...new Set([...(families.distribute || ["distribute"]), "distributive", "distribution"])];
  families.entitle = ["entitle", "entitlement"];
  families.formal = [...new Set([...(families.formal || ["formal"]), "formality"])];
  families.grace = ["grace", "graceful", "gracefully"];
  families.honest = ["honest", "honestly", "honesty"];
  families.competent = [...new Set([...(families.competent || ["competent"]), "incompetence"])];
  families.convenient = [...new Set([...(families.convenient || ["convenient"]), "inconveniently"])];
  families.insure = ["insure", "insurer", "insurance"];
  families.kind = [...new Set([...(families.kind || ["kind"]), "kindly"])];
  families.mature = ["mature", "maturely", "maturity"];
  families.understand = ["understand", "misunderstand"];
  families.cautious = ["cautious", "overcautious", "caution"];
  families.perform = ["perform", "overperform", "performance"];
  families.profession = ["profession", "professional", "professionally"];
  families.allocate = ["allocate", "allocation", "reallocation", "reallocating"];
  families.restrain = ["restrain", "restraint"];
  families.discipline = ["discipline", "disciplinarian", "disciplinary"];
  families.structure = ["structure", "structural", "structuralism", "structuralist", "structurally"];
  families.require = ["require", "requirement"];
  families.access = ["access", "accessibility", "accessible", "inaccessible"];
  families.demonstrate = ["demonstrate", "demonstration", "demonstrative"];
  families.consist = ["consist", "consistency", "consistent", "consistently", "inconsistency", "inconsistent", "inconsistently"];
  families.institute = ["institute", "institution", "institutional", "institutionally"];
  families.assess = ["assess", "assessment", "assessor"];
  families.precise = ["precise", "precision", "precisely", "imprecise"];
  families.accurate = ["accurate", "accuracy", "accurately", "inaccurate", "inaccuracy"];
  families.select = ["select", "selection", "selective", "selectively"];
  families.neutral = ["neutral", "neutrality", "neutrally", "neutralize"];
  families.precarious = ["precarious", "precariously", "precariousness"];
  families.theory = ["theory", "theoretical", "theoretically", "theorize"];
  families.circumstance = ["circumstance", "circumstantial"];
  families.ambiguous = ["ambiguous", "ambiguity", "ambiguously", "unambiguous", "unambiguously"];
  families.consent = ["consent", "consensual", "consensus"];
  families.conceal = ["conceal", "concealment"];
  families.preserve = ["preserve", "preservation", "preservative"];
  families.expose = ["expose", "exposure"];
  families.evidence = ["evidence", "evident", "evidence-based"];
  families.protocol = ["protocol"];
  families.invent = ["invent", "invention", "inventive", "inventor", "inventory", "inventorial"];
  families.cooperate = ["cooperate", "cooperation", "cooperative", "cooperator"];
  families.jurisdiction = ["jurisdiction", "jurisdictional"];
  families.deteriorate = ["deteriorate", "deterioration"];
  families.material = ["material", "materially", "materiality", "immaterial", "immaterially", "materialism", "materialistic"];
  families.aeon = ["aeon", "aeonian", "eon"];
  families.primordial = ["primordial", "primordiality", "primordium"];
  families.dissipate = ["dissipate", "dissipation", "dissipated", "dissipative"];
  families.conceive = ["conceive", "concept", "conception", "conceivable", "inconceivable"];
  families.beam = ["beam", "beamy", "beamless"];
  families.entangle = ["entangle", "entanglement", "disentangle", "disentanglement", "tangled"];
  families.dense = ["dense", "densely", "density", "condense", "condensed", "condensation"];
  families.propagate = ["propagate", "propagation", "propagator", "propagated"];
  families.nascent = ["nascent", "nascency"];
  families.void = ["void", "voidness", "avoid", "avoidance"];
  families.comprehend = ["comprehend", "comprehension", "comprehensive", "comprehensible", "incomprehensible"];
  families.compress = ["compress", "compressed", "compression", "compressible"];
  families.erupt = ["erupt", "eruption", "eruptive"];
  families.undergo = ["undergo", "underwent", "undergone"];
  families.exponent = ["exponent", "exponential", "exponentially"];
  families.inflate = ["inflate", "inflated", "inflation", "inflationary"];
  families.velocity = ["velocity", "velocimeter"];
  families.defy = ["defy", "defiance", "defiant", "defiantly"];
  families.epoch = ["epoch", "epochal"];
  families.remote = ["remote", "remotely", "remoteness"];
  families.encompass = ["encompass", "encompassing"];
  families.single = ["single", "singular", "singularity", "singularly"];
  families.radiate = ["radiate", "radiant", "radiance", "radiation"];
  families.attenuate = ["attenuate", "attenuated", "attenuation", "attenuator"];
  families.relent = ["relent", "relentless", "relentlessly", "relentlessness"];
  families.permeate = ["permeate", "permeation", "permeable", "impermeable"];
  families.faint = ["faint", "faintly", "faintness", "faint-hearted"];
  families.fraction = ["fraction", "fractional", "fracture", "fragment", "fragile"];
  families.static = [...new Set([...(families.static || ["static"]), "statically"])];
  families.hiss = ["hiss", "hissing"];
  families.audible = ["audible", "inaudible", "audibly", "audibility"];
  families.linger = ["linger", "lingering", "lingeringly"];
  families.dawn = ["dawn", "dawning"];
  families.scholar = ["scholar", "scholarly", "scholarship"];
  families.command = ["command", "commander", "commanding", "commandment"];
  families.crack = ["crack", "cracked", "cracking", "cracker"];
  families.restore = ["restore", "restoration", "restorative", "restored"];
  families.capacity = ["capacity", "capable", "capability", "incapable"];
  families.erect = ["erect", "erection"];
  families.corrupt = ["corrupt", "corruption", "corruptible", "incorruptible"];
  delete families.recovery;
  delete families.jury;
  delete families.deter;
  families.region = ["region", "regional"];
  families.respect = ["respect", "respectable", "respectful"];
  families.senior = ["senior", "seniority"];
  families.sponsor = ["sponsor", "sponsorship"];
  families.tutor = ["tutor", "tutorial"];
  families.usual = ["usual", "usually", "unusual", "unusually"];
  families.well = ["well", "unwell"];
  families.willing = ["willing", "unwilling"];
  families.wrap = ["wrap", "wrapper"];
  families.quantify = ["quantify", "quantified", "quantification"];
  families.submit = ["submit", "submitted", "submission"];
  families.admit = ["admit", "admitted", "admitting", "admission"];
  families.apply = ["apply", "applied", "application"];
  families.classify = ["classify", "classified", "classification"];
  families.cancel = [...new Set([...(families.cancel || ["cancel"]), "cancelling"])];
  families.carry = [...new Set([...(families.carry || ["carry"]), "carried"])];
  families.clip = [...new Set([...(families.clip || ["clip"]), "clipped"])];
  families.log = [...new Set([...(families.log || ["log"]), "logged"])];
  families.blur = ["blur", "blurred"];
  families.chip = ["chip", "chipped"];
  families.find = ["find", "finder"];
  for (const [head, words] of Object.entries(EXTRA_FAMILY_PATCHES)) {
    families[head] = [...new Set([...(families[head] || []), ...words])];
  }
  for (const [head, words] of Object.entries(EXTRA_FAMILY_PATCHES_MORE)) {
    families[head] = [...new Set([...(families[head] || []), ...words])];
  }
  for (const [head, words] of Object.entries(EXTRA_FAMILY_EXPANSIONS)) {
    families[head] = [...new Set([...(families[head] || []), ...words])];
  }
  return families;
}

function loadWindowObject(file, key) {
  const sandbox = { window: {} };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox.window[key] || {};
}

function mergeRegistryPatchCards(cards) {
  const registry = loadWindowObject(REGISTRY_JS, "VOCAB_WORD_CONTENT_REGISTRY_LITE").cards || {};
  const byHead = new Map(cards.map((card) => [card.head, card]));

  function isPolluted(text) {
    return /Learners can use|Academic readers often meet|Researchers often use|word network|appears in reading contexts|In academic writing|常用于讨论|学术阅读中遇到|学习者可以通过/i.test(text || "");
  }

  function addUnique(list, item, key) {
    if (!item[key] || isPolluted(item[key])) return;
    if (!list.some((old) => old[key] === item[key])) list.push(item);
  }

  for (const [word, source] of Object.entries(registry)) {
    const key = clean(word).toLowerCase();
    const phrases = (source.phrases || []).map((item) => ({
      en: clean(item.phrase),
      zh: clean(item.phrase_zh)
    })).filter((item) => (item.en || item.zh) && !isPolluted(item.en) && !isPolluted(item.zh));
    const examples = (source.examples || []).map((item) => ({
      en: clean(item.example),
      zh: clean(item.example_zh)
    })).filter((item) => (item.en || item.zh) && !isPolluted(item.en) && !isPolluted(item.zh));
    if (!key) continue;

    const existing = byHead.get(key);
    if (existing) {
      const first = existing.senses && existing.senses[0];
      if (first) {
        for (const phrase of phrases) addUnique(first.phrases, phrase, "en");
        for (const example of examples) addUnique(first.examples, example, "en");
      }
      continue;
    }

    if (!Array.isArray(source.sources) || !source.sources.includes("codex_entry_patch")) continue;
    if (!source.zh || (!phrases.length && !examples.length)) continue;
    const parsed = splitZhGloss(source.zh);
    const card = {
      head: key,
      phonetic: "",
      cut: "",
      cutMeaning: "",
      senses: [{
        index: "",
        pos: clean(source.pos),
        zh: parsed.zh,
        gloss: parsed.gloss,
        examples,
        phrases
      }]
    };
    byHead.set(key, card);
    cards.push(card);
  }
  return cards.sort((a, b) => a.head.localeCompare(b.head));
}

function fixKnownBadCardContent(cards) {
  const replaceCard = (head, patch) => {
    const card = cards.find((item) => item.head === head);
    if (!card) return;
    Object.assign(card, patch);
  };
  const microfiber = cards.find((card) => card.head === "microfiber");
  if (microfiber?.senses?.[0]?.gloss === "microfiber") {
    microfiber.senses[0].gloss = "fine fiber";
  }
  const deliberate = cards.find((card) => card.head === "deliberate");
  if (deliberate) {
    deliberate.cut = "deliber/ate";
    deliberate.cutMeaning = "权衡；慎重考虑/动词；形容词";
    deliberate.senses = [
      {
        index: "1",
        pos: "adj.",
        zh: "审慎的；深思熟虑的",
        gloss: "careful, considered",
        examples: [
          {
            en: "A deliberate choice should be judged by both intention and consequence.",
            zh: "深思熟虑的选择应同时根据意图和后果来判断。"
          }
        ],
        phrases: [
          { en: "deliberate choice", zh: "深思熟虑的选择" },
          { en: "a deliberate decision", zh: "深思熟虑的决定" }
        ]
      },
      {
        index: "2",
        pos: "adj.",
        zh: "故意的；蓄意的",
        gloss: "intentional, purposeful",
        examples: [
          {
            en: "The false label was a deliberate attempt to hide the material's origin.",
            zh: "这个虚假标签是故意隐藏材料来源的尝试。"
          }
        ],
        phrases: [
          { en: "deliberate attempt", zh: "故意尝试" },
          { en: "deliberate deception", zh: "蓄意欺骗" }
        ]
      },
      {
        index: "3",
        pos: "v.",
        zh: "仔细讨论；慎重考虑",
        gloss: "consider carefully, discuss",
        examples: [
          {
            en: "The committee will deliberate on the policy before publishing its recommendation.",
            zh: "委员会会在发布建议前仔细讨论这项政策。"
          }
        ],
        phrases: [
          { en: "deliberate on policy", zh: "仔细讨论政策" }
        ]
      }
    ];
  }
  const deliberately = cards.find((card) => card.head === "deliberately");
  if (deliberately) {
    deliberately.cut = "deliber/ate/ly";
    deliberately.cutMeaning = "权衡；慎重考虑/形容词/副词";
    deliberately.senses = [
      {
        index: "1",
        pos: "adv.",
        zh: "故意地；蓄意地",
        gloss: "intentionally, on purpose",
        examples: [
          {
            en: "The witness deliberately left out the name of the driver.",
            zh: "证人故意省略了司机的名字。"
          }
        ],
        phrases: [
          { en: "deliberately mislead the public", zh: "故意误导公众" },
          { en: "deliberately hide evidence", zh: "蓄意隐藏证据" }
        ]
      },
      {
        index: "2",
        pos: "adv.",
        zh: "慎重地；从容地",
        gloss: "carefully, unhurriedly",
        examples: [
          {
            en: "She spoke deliberately so the translator could follow every sentence.",
            zh: "她说得很慎重从容，以便译员能跟上每句话。"
          }
        ],
        phrases: [
          { en: "speak deliberately", zh: "慎重从容地说" },
          { en: "move deliberately", zh: "从容地移动" }
        ]
      }
    ];
  }
  const deliberation = cards.find((card) => card.head === "deliberation");
  if (deliberation) {
    deliberation.cut = "deliber/ation";
    deliberation.cutMeaning = "权衡；慎重考虑/名词";
  }
  const pressure = cards.find((card) => card.head === "pressure");
  if (pressure) {
    pressure.cut = "press/ure";
    pressure.cutMeaning = "压；挤/名词";
    pressure.senses = [
      {
        index: "1",
        pos: "n.",
        zh: "压力；心理压力；社会压力",
        gloss: "stress, demand",
        examples: [
          {
            en: "Social pressure can change behaviour without changing belief.",
            zh: "社会压力可以改变行为，而不改变信念。"
          }
        ],
        phrases: [
          { en: "social pressure", zh: "社会压力" },
          { en: "economic pressure", zh: "经济压力" },
          { en: "under pressure", zh: "处于压力之下" }
        ]
      },
      {
        index: "2",
        pos: "n.",
        zh: "压强；物理压力",
        gloss: "force per area",
        examples: [
          {
            en: "Air pressure drops as elevation increases.",
            zh: "海拔升高时，气压会下降。"
          }
        ],
        phrases: [
          { en: "air pressure", zh: "气压" },
          { en: "blood pressure", zh: "血压" },
          { en: "water pressure", zh: "水压" }
        ]
      },
      {
        index: "3",
        pos: "v.",
        zh: "施压；迫使",
        gloss: "urge, force",
        examples: [
          {
            en: "Campaigners pressured officials to release the data.",
            zh: "活动人士向官员施压，要求公布数据。"
          }
        ],
        phrases: [
          { en: "pressure someone to act", zh: "施压某人行动" },
          { en: "pressure the committee", zh: "向委员会施压" }
        ]
      }
    ];
  }
  const intentional = cards.find((card) => card.head === "intentional");
  if (intentional) {
    intentional.cut = "in/tent/ion/al";
    intentional.cutMeaning = "向内；朝向/伸展；趋向/名词/形容词";
    intentional.senses = [
      {
        index: "1",
        pos: "adj.",
        zh: "故意的；有意的",
        gloss: "deliberate, purposeful",
        examples: [
          {
            en: "The repeated delay looked intentional because the same document was ready weeks earlier.",
            zh: "这次反复拖延看起来是有意的，因为同一份文件几周前就已经准备好了。"
          }
        ],
        phrases: [
          { en: "intentional action", zh: "故意行为" },
          { en: "intentional choice", zh: "有意选择" },
          { en: "intentional design", zh: "有意设计" }
        ]
      }
    ];
  }
  replaceCard("aids", {
    cut: "AIDS",
    cutMeaning: "获得性免疫缺陷综合征",
    senses: [{
      index: "1",
      pos: "n.",
      zh: "艾滋病；获得性免疫缺陷综合征",
      gloss: "acquired immune deficiency syndrome",
      examples: [
        {
          en: "Public health campaigns reduced AIDS-related stigma by explaining how the disease is transmitted.",
          zh: "公共卫生宣传通过解释疾病传播方式，减少了与艾滋病相关的污名。"
        }
      ],
      phrases: [
        { en: "AIDS epidemic", zh: "艾滋病疫情" },
        { en: "AIDS prevention", zh: "艾滋病预防" }
      ]
    }]
  });
  replaceCard("airbubble", {
    cut: "air/bubble",
    cutMeaning: "空气/气泡",
    senses: [{
      index: "1",
      pos: "n.",
      zh: "气泡",
      gloss: "air pocket",
      examples: [
        {
          en: "An air bubble trapped in the glass changed the way light passed through it.",
          zh: "困在玻璃里的气泡改变了光线穿过它的方式。"
        }
      ],
      phrases: [
        { en: "air bubble formation", zh: "气泡形成" },
        { en: "tiny air bubble", zh: "微小气泡" }
      ]
    }]
  });
  replaceCard("balancesheet", {
    cut: "balance/sheet",
    cutMeaning: "平衡；结余/表格",
    senses: [{
      index: "1",
      pos: "n.",
      zh: "资产负债表",
      gloss: "financial statement",
      examples: [
        {
          en: "The balance sheet showed that the company had more debt than cash.",
          zh: "资产负债表显示公司债务多于现金。"
        }
      ],
      phrases: [
        { en: "balance sheet risk", zh: "资产负债表风险" },
        { en: "balance sheet expansion", zh: "资产负债表扩张" }
      ]
    }]
  });
  replaceCard("casestudy", {
    cut: "case/study",
    cutMeaning: "案例/研究",
    senses: [{
      index: "1",
      pos: "n.",
      zh: "案例研究",
      gloss: "detailed example study",
      examples: [
        {
          en: "The case study followed one town before and after the flood-control project.",
          zh: "这项案例研究追踪了一个城镇在防洪项目实施前后的变化。"
        }
      ],
      phrases: [
        { en: "case study methodology", zh: "案例研究方法" },
        { en: "case study of urban renewal", zh: "城市更新案例研究" }
      ]
    }]
  });
  replaceCard("controlrod", {
    cut: "control/rod",
    cutMeaning: "控制/棒；杆",
    senses: [{
      index: "1",
      pos: "n.",
      zh: "控制棒",
      gloss: "reactor control bar",
      examples: [
        {
          en: "The control rod slows the reaction by absorbing extra neutrons.",
          zh: "控制棒通过吸收多余中子来减缓反应。"
        }
      ],
      phrases: [
        { en: "nuclear control rod", zh: "核控制棒" },
        { en: "control rod insertion", zh: "控制棒插入" }
      ]
    }]
  });
  replaceCard("academician", {
    cut: "academ/ic/ian",
    cutMeaning: "学院；学术/形容词/人",
    senses: [{
      index: "1",
      pos: "n.",
      zh: "院士；学者",
      gloss: "scholar, academy member",
      examples: [
        {
          en: "The academician advised the museum on how to protect fragile manuscripts.",
          zh: "这位院士就如何保护脆弱手稿向博物馆提供建议。"
        }
      ],
      phrases: [
        { en: "senior academician", zh: "资深院士" },
        { en: "academician appointment system", zh: "院士任命制度" }
      ]
    }]
  });
  replaceCard("act", {
    cut: "act",
    cutMeaning: "行动；做",
    senses: [
      {
        index: "1",
        pos: "v.",
        zh: "行动；起作用",
        gloss: "do, operate",
        examples: [
          {
            en: "Institutions act slowly when evidence is fragmented across agencies.",
            zh: "当证据分散在各机构之间时，制度行动往往较慢。"
          }
        ],
        phrases: [
          { en: "act decisively", zh: "果断行动" },
          { en: "act as evidence", zh: "起证据作用" }
        ]
      },
      {
        index: "2",
        pos: "n.",
        zh: "行为；法案",
        gloss: "deed, law",
        examples: [
          {
            en: "A single act of kindness changed the mood of the whole room.",
            zh: "一个善意行为改变了整个房间的气氛。"
          }
        ],
        phrases: [
          { en: "public act", zh: "公开行为" },
          { en: "an act of parliament", zh: "议会法案" }
        ]
      }
    ]
  });
  replaceCard("affirmatively", {
    cut: "af/firm/ative/ly",
    cutMeaning: "向；加强/稳固；确认/形容词/副词",
    senses: [{
      index: "1",
      pos: "adv.",
      zh: "肯定地；积极地",
      gloss: "positively, approvingly",
      examples: [
        {
          en: "The committee responded affirmatively after reviewing the safety evidence.",
          zh: "委员会审查安全证据后作出了肯定回应。"
        }
      ],
      phrases: [
        { en: "respond affirmatively", zh: "肯定地回应" },
        { en: "affirmatively address discrimination", zh: "积极处理歧视" }
      ]
    }]
  });
  replaceCard("acclamation", {
    cut: "ac/clam/ation",
    cutMeaning: "向；加强/呼喊/名词",
    senses: [{
      index: "1",
      pos: "n.",
      zh: "欢呼；喝彩；鼓掌通过",
      gloss: "cheering, approval",
      examples: [
        {
          en: "The proposal passed by acclamation because no one demanded a formal vote.",
          zh: "由于没有人要求正式投票，该提案以鼓掌方式通过。"
        }
      ],
      phrases: [
        { en: "public acclamation", zh: "公众欢呼" },
        { en: "election by acclamation", zh: "鼓掌通过的选举" }
      ]
    }]
  });
  replaceCard("admonition", {
    cut: "ad/mon/ition",
    cutMeaning: "向；加强/提醒；警告/名词",
    senses: [{
      index: "1",
      pos: "n.",
      zh: "告诫；警告",
      gloss: "warning, caution",
      examples: [
        {
          en: "The teacher's admonition was calm, but every student understood the risk.",
          zh: "老师的告诫很平静，但每个学生都明白其中的风险。"
        }
      ],
      phrases: [
        { en: "formal admonition", zh: "正式告诫" },
        { en: "moral admonition", zh: "道德警示" }
      ]
    }]
  });
  replaceCard("discipline", {
    cut: "disciplin/e",
    cutMeaning: "学习；训练；纪律/词尾",
    senses: [
      {
        index: "1",
        pos: "n.",
        zh: "纪律；自律",
        gloss: "self-control, order",
        examples: [
          {
            en: "Self-discipline matters, but schools should not confuse discipline with blind obedience.",
            zh: "自律很重要，但学校不应把纪律和盲从混为一谈。"
          }
        ],
        phrases: [
          { en: "self-discipline", zh: "自律" },
          { en: "disciplined routine", zh: "自律日程" }
        ]
      },
      {
        index: "2",
        pos: "n.",
        zh: "学科；专业领域",
        gloss: "academic field, subject",
        examples: [
          {
            en: "History became a separate academic discipline when scholars developed shared methods.",
            zh: "当学者们发展出共同方法后，历史成为一门独立学科。"
          }
        ],
        phrases: [
          { en: "academic discipline", zh: "学科" },
          { en: "scientific discipline", zh: "科学学科" }
        ]
      },
      {
        index: "3",
        pos: "v.",
        zh: "训练；规训；惩戒",
        gloss: "train, control",
        examples: [
          {
            en: "Platforms can discipline behaviour through rewards rather than explicit punishment.",
            zh: "平台可以通过奖励而不是明确惩罚来规训行为。"
          }
        ],
        phrases: [
          { en: "discipline behaviour", zh: "规训行为" },
          { en: "discipline a team", zh: "训练团队" }
        ]
      }
    ]
  });
  replaceCard("geology", {
    cut: "geo/logy",
    cutMeaning: "地/学科",
    senses: [{
      index: "1",
      pos: "n.",
      zh: "地质学",
      gloss: "earth science",
      examples: [
        {
          en: "Geology explains how mountains, minerals, and fossils form.",
          zh: "地质学解释山脉、矿物和化石如何形成。"
        }
      ],
      phrases: [
        { en: "marine geology", zh: "海洋地质学" },
        { en: "geology fieldwork", zh: "地质学野外考察" }
      ]
    }]
  });
  replaceCard("accounting", {
    cut: "account/ing",
    cutMeaning: "账户；说明/名词",
    senses: [{
      index: "1",
      pos: "n.",
      zh: "会计；会计学",
      gloss: "financial recording",
      examples: [
        {
          en: "Careful accounting revealed that the project had overspent.",
          zh: "细致的会计核算显示该项目已经超支。"
        }
      ],
      phrases: [
        { en: "cost accounting", zh: "成本会计" },
        { en: "accounting records", zh: "会计记录" }
      ]
    }]
  });
  replaceCard("engineering", {
    cut: "engin/eer/ing",
    cutMeaning: "机器；装置/人；从业者/名词",
    senses: [{
      index: "1",
      pos: "n.",
      zh: "工程；工程学",
      gloss: "applied design science",
      examples: [
        {
          en: "Engineering turns scientific ideas into bridges, machines, and tools.",
          zh: "工程学把科学思想转化为桥梁、机器和工具。"
        }
      ],
      phrases: [
        { en: "civil engineering", zh: "土木工程" },
        { en: "engineering design", zh: "工程设计" }
      ]
    }]
  });
  const relationCompounds = [
    ["belljar", "bell/jar", "铃；钟形物/罐；罩", "n.", "钟形罩", "glass laboratory cover", "bell jar experiment", "钟形罩实验"],
    ["coordinatesystem", "coordinate/system", "坐标/系统", "n.", "坐标系", "coordinate framework", "geographic coordinate system", "地理坐标系"],
    ["crossplatform", "cross/platform", "跨越/平台", "adj.", "跨平台的", "usable across platforms", "cross platform compatibility", "跨平台兼容性"],
    ["devonianfossil", "devonian/fossil", "泥盆纪的/化石", "n.", "泥盆纪化石", "Devonian-period fossil", "Devonian fossil evidence", "泥盆纪化石证据"],
    ["executivemba", "executive/MBA", "管理的；高级的/工商管理硕士", "n.", "高级工商管理硕士项目", "executive business degree", "executive MBA cohort", "高级工商管理硕士班级"],
    ["fishingrod", "fishing/rod", "捕鱼；钓鱼/杆", "n.", "钓竿", "fishing pole", "fishing rod design", "钓竿设计"],
    ["grazingpaddock", "grazing/paddock", "放牧/围场", "n.", "放牧小区", "grazing field", "grazing paddock rotation", "放牧小区轮换"],
    ["horatiansatire", "horatian/satire", "贺拉斯式的/讽刺", "n.", "温和讽刺", "gentle satire", "Horatian satire style", "温和讽刺风格"],
    ["horsepaddock", "horse/paddock", "马/围场", "n.", "马场；马匹围场", "horse field", "horse paddock fencing", "马场围栏"],
    ["hydrothermalvent", "hydro/thermal/vent", "水/热/喷口", "n.", "热液喷口", "hot-water seabed vent", "hydrothermal vent community", "热液喷口群落"],
    ["juvenaliansatire", "juvenalian/satire", "尤维纳利斯式的/讽刺", "n.", "严厉讽刺", "harsh satire", "Juvenalian satire tradition", "严厉讽刺传统"],
    ["linguafranca", "lingua/franca", "语言/自由；通用", "n.", "通用语", "shared language", "regional lingua franca", "区域通用语"],
    ["lowstatus", "low/status", "低/地位", "adj.", "低地位的", "low-ranking", "low status occupation", "低地位职业"],
    ["neoshamanism", "neo/shaman/ism", "新/萨满/主义", "n.", "新萨满主义", "modern shamanism", "neo shamanism movement", "新萨满主义运动"],
    ["norsesaga", "norse/saga", "北欧的/萨迦", "n.", "北欧萨迦", "Norse heroic story", "Norse saga manuscript", "北欧萨迦手稿"],
    ["polopony", "polo/pony", "马球/小马", "n.", "马球马", "polo horse", "polo pony training", "马球马训练"],
    ["taxavoidance", "tax/avoidance", "税/避开", "n.", "避税", "legal tax reduction", "tax avoidance scheme", "避税方案"]
  ];
  for (const [head, cut, cutMeaning, pos, zh, gloss, phraseEn, phraseZh] of relationCompounds) {
    replaceCard(head, {
      cut,
      cutMeaning,
      senses: [{
        index: "1",
        pos,
        zh,
        gloss,
        examples: [],
        phrases: [
          { en: phraseEn, zh: phraseZh }
        ]
      }]
    });
  }
  replaceCard("interrelate", {
    cut: "inter/rel/ate",
    cutMeaning: "相互；在...之间/带回；关联/动词",
    senses: [{
      index: "1",
      pos: "v.",
      zh: "相互关联；使相互联系",
      gloss: "connect mutually",
      examples: [
        {
          en: "The report shows how transport, housing, and health interrelate in dense cities.",
          zh: "报告显示交通、住房和健康在密集城市中如何相互关联。"
        }
      ],
      phrases: [
        { en: "interrelate social and ecological factors", zh: "关联社会与生态因素" }
      ]
    }]
  });
  replaceCard("dna", {
    cut: "DNA",
    cutMeaning: "脱氧核糖核酸",
    senses: [{
      index: "1",
      pos: "n.",
      zh: "脱氧核糖核酸；遗传物质",
      gloss: "genetic material",
      examples: [
        {
          en: "DNA evidence can identify a person when other records are incomplete.",
          zh: "当其他记录不完整时，DNA证据可以识别一个人。"
        }
      ],
      phrases: [
        { en: "DNA sequence", zh: "DNA序列" },
        { en: "DNA evidence", zh: "DNA证据" }
      ]
    }]
  });
  replaceCard("hiv", {
    cut: "HIV",
    cutMeaning: "人类免疫缺陷病毒",
    senses: [{
      index: "1",
      pos: "n.",
      zh: "人类免疫缺陷病毒",
      gloss: "human immunodeficiency virus",
      examples: [
        {
          en: "Early testing helps reduce HIV transmission in vulnerable communities.",
          zh: "早期检测有助于减少弱势社区中的HIV传播。"
        }
      ],
      phrases: [
        { en: "HIV infection", zh: "HIV感染" },
        { en: "HIV transmission", zh: "HIV传播" }
      ]
    }]
  });
  replaceCard("mba", {
    cut: "MBA",
    cutMeaning: "工商管理硕士",
    senses: [{
      index: "1",
      pos: "n.",
      zh: "工商管理硕士；工商管理硕士课程",
      gloss: "business administration degree",
      examples: [
        {
          en: "The MBA programme focused on finance, leadership, and strategy.",
          zh: "这个MBA项目侧重金融、领导力和战略。"
        }
      ],
      phrases: [
        { en: "MBA programme", zh: "MBA项目" },
        { en: "MBA degree", zh: "MBA学位" }
      ]
    }]
  });
  replaceCard("discrepancies", {
    cut: "dis/crep/anc/ies",
    cutMeaning: "分离；相反/发声；裂开/名词/复数",
    senses: [{
      index: "1",
      pos: "n.pl.",
      zh: "差异；不一致之处",
      gloss: "differences, inconsistencies",
      examples: [
        {
          en: "The audit found discrepancies between the invoice and the delivery record.",
          zh: "审计发现发票和交付记录之间存在不一致。"
        }
      ],
      phrases: [
        { en: "data discrepancies", zh: "数据差异" },
        { en: "minor discrepancies", zh: "细小差异" }
      ]
    }]
  });
  replaceCard("passively", {
    cut: "pass/ive/ly",
    cutMeaning: "忍受；承受/形容词/副词",
    senses: [{
      index: "1",
      pos: "adv.",
      zh: "被动地；消极地",
      gloss: "without active response",
      examples: [
        {
          en: "Residents did not passively accept the plan; they asked for safer routes.",
          zh: "居民没有被动接受该计划，而是要求更安全的路线。"
        }
      ],
      phrases: [
        { en: "passively accept", zh: "被动接受" },
        { en: "respond passively", zh: "消极回应" }
      ]
    }]
  });
  replaceCard("progressively", {
    cut: "pro/gress/ive/ly",
    cutMeaning: "向前/行走；前进/形容词/副词",
    senses: [{
      index: "1",
      pos: "adv.",
      zh: "逐渐地；日益",
      gloss: "gradually, increasingly",
      examples: [
        {
          en: "The river became progressively cleaner after factories improved their filters.",
          zh: "工厂改进过滤器后，这条河逐渐变得更干净。"
        }
      ],
      phrases: [
        { en: "progressively cleaner", zh: "逐渐更干净" },
        { en: "progressively more difficult", zh: "越来越困难" }
      ]
    }]
  });
  replaceCard("thoroughly", {
    cut: "thorough/ly",
    cutMeaning: "彻底的/副词",
    senses: [{
      index: "1",
      pos: "adv.",
      zh: "彻底地；完全地",
      gloss: "completely, carefully",
      examples: [
        {
          en: "Researchers checked the samples thoroughly before publishing the results.",
          zh: "研究人员在公布结果前彻底检查了样本。"
        }
      ],
      phrases: [
        { en: "check thoroughly", zh: "彻底检查" },
        { en: "thoroughly tested", zh: "经过彻底测试的" }
      ]
    }]
  });
  replaceCard("craftsmancraftwork", {
    cut: "craftsman/craftwork",
    cutMeaning: "工匠/手工艺品",
    senses: [{
      index: "1",
      pos: "n.",
      zh: "工匠手艺；手工艺品",
      gloss: "artisan craftwork",
      examples: [],
      phrases: [
        { en: "traditional craftwork", zh: "传统手工艺品" },
        { en: "craftsman craftwork", zh: "工匠手艺" }
      ]
    }]
  });
  const rootGlossOverrides = {
    cinct: ["root: bind or gird", "束；绑"],
    haust: ["root: draw or suck", "抽；吸"],
    hydro: ["root: water", "水"],
    mono: ["root: single", "单一"],
    nano: ["prefix: extremely small", "纳米；极小"],
    pend: ["root: hang or be pending", "悬挂；悬而未决"],
    photo: ["root: light", "光"],
    phyto: ["prefix: plant-related", "植物相关"],
    ponic: ["root: cultivation or labour", "劳作；栽培"],
    trig: ["root: trigger or triangle-related", "触发；三角相关"],
    zoo: ["prefix: animal-related", "动物相关"]
  };
  for (const [head, [gloss, zh]] of Object.entries(rootGlossOverrides)) {
    const card = cards.find((item) => item.head === head);
    if (card?.senses?.[0]) {
      card.senses[0].zh = card.senses[0].zh || zh;
      card.senses[0].gloss = gloss;
    }
  }
  const conciseMeaningFixes = {
    abandoner: ["n.", "遗弃者；放弃者", "deserter, quitter", "abandoner of contractual duties", "合同义务放弃者"],
    absentee: ["n.", "缺席者", "absent person", "absentee voter", "缺席投票者"],
    abuser: ["n.", "施虐者；滥用者", "mistreating person, misuse offender", "power abuser", "权力滥用者"],
    abusive: ["adj.", "虐待的；辱骂的", "cruel, insulting", "abusive behaviour", "虐待行为"],
    academia: ["n.", "学术界", "academic world", "academia and industry partnership", "学界与产业合作"],
    accomplisher: ["n.", "完成者", "person who completes", "project accomplisher", "项目完成者"],
    accuser: ["n.", "指控者", "person who accuses", "public accuser", "公开指控者"],
    adaptor: ["n.", "适配器；适应者", "connector, adapter", "network adaptor", "网络适配器"],
    adder: ["n.", "加法器；蝰蛇", "adding device, viper", "binary adder", "二进制加法器"],
    addict: ["v./n.", "使成瘾；成瘾者", "make dependent, dependent user", "treat an addict", "治疗成瘾者"],
    adsorbent: ["adj./n.", "吸附的；吸附剂", "surface-trapping, adsorbing material", "adsorbent carbon filter", "吸附性碳过滤器"],
    agential: ["adj.", "行动者的；具有能动性的", "agent-related, active", "agential capacity", "行动能力"],
    agger: ["n.", "土堤；堆土", "embankment, mound", "Roman agger", "罗马土堤"],
    aggress: ["v.", "攻击；侵略；挑起冲突", "attack, invade", "aggress against civilians", "攻击平民"],
    agonist: ["n.", "激动剂；主张者", "activating agent", "dopamine agonist", "多巴胺激动剂"],
    agrochemical: ["n./adj.", "农用化学品；农化的", "farm chemical", "agrochemical exposure risk", "农用化学品暴露风险"],
    agronomic: ["adj.", "农学的；农艺的", "crop-science related", "agronomic practice", "农学实践"],
    airway: ["n.", "气道；航线", "breathing passage, air route", "airway inflammation", "气道炎症"],
    alienist: ["n.", "精神病学家；旧称", "psychiatrist", "alienist testimony", "精神病学家证词"],
    aligner: ["n.", "校准器；矫正器", "alignment device", "dental aligner", "牙齿矫正器"],
    amateurism: ["n.", "业余精神；业余主义", "nonprofessional spirit", "sports amateurism", "体育业余精神"],
    amplifier: ["n.", "放大器；放大因素", "signal booster, intensifier", "audio amplifier", "音频放大器"],
    annoying: ["adj.", "烦人的；恼人的", "irritating", "annoying sound", "令人烦恼的声音"],
    anthropogenic: ["adj.", "人为的；人类活动造成的", "human-caused", "anthropogenic change", "人为变化"],
    anthropomorphic: ["adj.", "拟人化的", "human-shaped, human-like", "anthropomorphic design", "拟人化设计"],
    aphasiology: ["n.", "失语症学", "aphasia study", "aphasiology research", "失语症学研究"],
    applicant: ["n.", "申请者", "person who applies", "a strong applicant", "强有力的申请人"],
    artifactual: ["adj.", "人工制品的；由人为因素造成的", "artifact-related, artificial", "artifactual evidence", "文物证据"],
    artifice: ["n.", "巧计；人为手段", "trick, device", "political artifice", "政治手段"],
    artificially: ["adv.", "人工地；人为地", "by artificial means", "artificially increase", "人为提高"],
    astronautics: ["n.", "航天学", "spaceflight science", "astronautics research", "航天学研究"],
    attachable: ["adj.", "可附加的；可连接的", "able to be attached", "attachable sensor module", "可附加传感器模块"],
    baseline: ["n.", "基线；基础数据", "starting reference line", "baseline data", "基线数据"],
    believer: ["n.", "信徒；相信者", "person who believes", "firm believer", "坚定相信者"],
    benefactor: ["n.", "捐助者；恩人", "supporter, donor", "university benefactor", "大学捐助者"],
    beneficiary: ["n.", "受益人", "person who benefits", "policy beneficiary", "政策受益人"],
    bibliophile: ["n.", "爱书者", "book lover", "bibliophile collection", "爱书者藏书"],
    biographer: ["n.", "传记作者", "life-story writer", "literary biographer", "文学传记作者"],
    biological: ["adj.", "生物的；生物学的", "life-related", "biological evidence", "生物学证据"],
    bipolar: ["adj.", "两极的；双相的", "two-pole, manic-depressive", "bipolar disorder", "双相障碍"],
    boltcutter: ["n.", "断线钳；断 bolt 工具", "cutting tool", "bolt cutter access tool", "断线钳进入工具"],
    buffer: ["n./v.", "缓冲；缓冲物", "cushion, absorb impact", "financial buffer", "财务缓冲"],
    bursary: ["n.", "助学金", "student grant", "student bursary", "学生助学金"],
    cactus: ["n.", "仙人掌", "desert plant", "cactus stem", "仙人掌茎"],
    carrier: ["n.", "载体；携带者；承运人", "bearer, transporter", "disease carrier", "疾病携带者"],
    casualty: ["n.", "伤亡者；意外事故", "injured person, loss", "civilian casualty", "平民伤亡者"],
    cathodic: ["adj.", "阴极的", "cathode-related", "cathodic protection", "阴极保护"],
    caution: ["n./v.", "谨慎；警告", "care, warning", "extreme caution", "极度谨慎"],
    census: ["n.", "人口普查", "population count", "national census", "全国人口普查"],
    chaology: ["n.", "混沌学", "chaos study", "chaology model", "混沌学模型"],
    chemotherapy: ["n.", "化学疗法；化疗", "chemical cancer treatment", "chemotherapy regimen", "化疗方案"],
    clash: ["v./n.", "冲突；碰撞", "conflict, collide", "clash over resources", "因资源发生冲突"],
    collision: ["n.", "碰撞；冲突", "crash, conflict", "head-on collision", "迎面碰撞"],
    compiler: ["n.", "编译器；汇编者", "code translator, collector", "code compiler", "代码编译器"],
    compulsion: ["n.", "强迫；冲动", "force, irresistible urge", "legal compulsion", "法律强制"],
    connote: ["v.", "暗示；含有附加意义", "imply, suggest", "connote social status", "暗示社会地位"],
    cordless: ["adj.", "无线的", "without a cord", "cordless communication device", "无线通信设备"],
    corporation: ["n.", "公司；法人团体", "company, legal body", "multinational corporation", "跨国公司"],
    cosmetology: ["n.", "美容学", "beauty-care study", "cosmetology training", "美容学培训"],
    cosmology: ["n.", "宇宙学；宇宙观", "universe study, worldview", "modern cosmology", "现代宇宙学"]
  };
  for (const [head, [pos, zh, gloss, phraseEn, phraseZh]] of Object.entries(conciseMeaningFixes)) {
    const card = cards.find((item) => item.head === head);
    if (!card?.senses?.[0]) continue;
    card.senses[0].pos = pos;
    card.senses[0].zh = zh;
    card.senses[0].gloss = gloss;
    if (!card.senses[0].phrases?.some((phrase) => phrase.en === phraseEn)) {
      card.senses[0].phrases = [{ en: phraseEn, zh: phraseZh }, ...(card.senses[0].phrases || []).slice(0, 2)];
    }
  }
  const concrete = cards.find((item) => item.head === "concrete");
  if (concrete?.senses?.[1]) concrete.senses[1].gloss = "specific, real";
  const attendance = cards.find((item) => item.head === "attendance");
  if (attendance?.senses?.[1]) attendance.senses[1].gloss = "number present";
  const conciseMeaningFixesMore = {
    alien: ["n.", "外星人；外来者", "foreign being, outsider", "alien species", "外来物种"],
    apprenticeship: ["n.", "学徒工作；学徒期", "training period, apprenticeship", "carpentry apprenticeship", "木工学徒期"],
    causeway: ["n.", "堤道；堤路", "raised road", "stone causeway", "石堤道"],
    clashcourse: ["n.", "冲突路线", "collision path", "clash course with policy", "与政策冲突的路线"],
    clashpoint: ["n.", "冲突点", "point of conflict", "political clashpoint", "政治冲突点"],
    classmate: ["n.", "同学", "fellow student", "former classmate", "以前的同学"],
    client: ["n.", "委托人；客户；当事人", "customer, represented person", "legal client", "法律委托人"],
    clippage: ["n.", "剪下物；剪辑材料", "cut material", "newspaper clippage", "剪报材料"],
    commuter: ["n.", "通勤者", "regular traveler", "daily commuter", "日常通勤者"],
    cosmological: ["adj.", "宇宙学的；宇宙观的", "universe-related", "cosmological model", "宇宙学模型"],
    cryptography: ["n.", "密码学", "code-making study", "modern cryptography", "现代密码学"],
    crystallographic: ["adj.", "晶体学的", "crystal-structure related", "crystallographic data", "晶体学数据"],
    cultureclash: ["n.", "文化冲突", "cultural conflict", "culture clash at school", "学校中的文化冲突"],
    curbline: ["n.", "路缘线", "edge of a street", "curbline survey", "路缘线测量"],
    curve: ["n./v.", "曲线；弯曲", "curved line, bend", "learning curve", "学习曲线"],
    debunker: ["n.", "揭穿者", "myth critic", "public debunker", "公开揭穿者"],
    decent: ["adj.", "令人满意的；体面的", "acceptable, respectable", "decent living conditions", "体面的生活条件"],
    decomposer: ["n.", "分解者；分解生物", "organism that breaks down matter", "soil decomposer", "土壤分解者"],
    defector: ["n.", "叛逃者；脱离者", "person who defects", "political defector", "政治叛逃者"],
    demagogue: ["n.", "煽动者；蛊惑民心的政客", "rabble-rouser", "dangerous demagogue", "危险的煽动者"],
    demolisher: ["n.", "拆除者；破坏者", "destroyer, demolition worker", "building demolisher", "建筑拆除者"],
    demos: ["n.", "民众；人民", "the people", "ancient demos", "古代民众"],
    diagonal: ["n./adj.", "斜线；对角线的", "slanting line", "diagonal line", "对角线"],
    diplomatist: ["n.", "外交家；外交研究者", "diplomat, diplomacy scholar", "skilled diplomatist", "老练的外交家"],
    discord: ["n.", "不和；冲突", "disagreement, conflict", "family discord", "家庭不和"],
    dissecter: ["n.", "解剖者；剖析者", "one who dissects", "careful dissecter", "细致剖析者"],
    dissector: ["n.", "解剖者；剖析者", "one who dissects", "laboratory dissector", "实验室解剖者"],
    diviner: ["n.", "占卜者；预测者", "fortune teller", "ancient diviner", "古代占卜者"],
    drafter: ["n.", "起草者；绘图员", "writer of drafts", "legal drafter", "法律起草者"],
    dragster: ["n.", "直线加速赛车", "drag-racing car", "electric dragster", "电动直线加速赛车"],
    drone: ["n.", "无人机；嗡嗡声；雄蜂", "unmanned aircraft, buzzing sound", "surveillance drone", "监控无人机"],
    droopline: ["n.", "下垂曲线", "sagging line", "droopline measurement", "下垂曲线测量"],
    drowsy: ["adj.", "昏昏欲睡的", "sleepy", "drowsy driver", "昏昏欲睡的司机"],
    drummer: ["n.", "鼓手；推销者", "drum player, promoter", "jazz drummer", "爵士鼓手"],
    earlybird: ["n.", "早到者；早鸟", "early arriver", "early bird registration", "早鸟报名"],
    egregious: ["adj.", "极坏的；惊人的", "shockingly bad", "egregious error", "严重错误"],
    electrify: ["v.", "使电气化；使激动", "charge, excite", "electrify a railway", "使铁路电气化"],
    enabler: ["n.", "促成者；使能因素", "facilitator", "technology enabler", "技术促成因素"],
    encumbrancer: ["n.", "权利负担人；抵押权人", "claim holder", "property encumbrancer", "财产权利负担人"],
    endower: ["n.", "捐赠者；赋予者", "donor, giver", "scholarship endower", "奖学金捐赠者"],
    enthusiast: ["n.", "热心者；爱好者", "eager supporter", "science enthusiast", "科学爱好者"],
    estimator: ["n.", "估计量；估计者", "calculator, estimating person", "cost estimator", "成本估算者"],
    ethics: ["n.", "伦理学；道德规范", "moral principles, moral philosophy", "research ethics", "研究伦理"],
    etymology: ["n.", "词源学", "word-origin study", "English etymology", "英语词源学"],
    eugenic: ["adj.", "优生学的", "eugenics-related", "eugenic policy", "优生政策"],
    eugenical: ["adj.", "优生学的", "eugenics-related", "eugenical theory", "优生学理论"],
    exaggerator: ["n.", "夸大者", "one who overstates", "habitual exaggerator", "习惯夸大者"],
    exchanger: ["n.", "交换者；交换器", "device or person that exchanges", "heat exchanger", "换热器"],
    extra: ["n./adj.", "附加物；额外的", "additional thing", "extra cost", "额外成本"],
    extrovert: ["n.", "外向者", "outgoing person", "confident extrovert", "自信的外向者"],
    faultline: ["n.", "断层线；分歧线", "fracture line", "social faultline", "社会分歧线"],
    faunist: ["n.", "动物区系学者", "fauna specialist", "regional faunist", "区域动物区系学者"],
    filar: ["adj.", "丝的；线状的", "thread-like", "filar structure", "线状结构"],
    fireline: ["n.", "火线；防火线", "fire control line", "forest fireline", "森林防火线"],
    forewarn: ["v.", "预先警告", "warn in advance", "forewarn residents", "预先警告居民"],
    geniusloci: ["n.", "地方精神", "spirit of place", "genius loci of a city", "城市的地方精神"],
    geography: ["n.", "地理学；地理特征", "earth-surface study", "physical geography", "自然地理学"],
    gorgeous: ["adj.", "华丽的；极美的", "beautiful, splendid", "gorgeous scenery", "壮丽景色"],
    homicide: ["n.", "杀人；杀人案", "killing of a person", "homicide investigation", "杀人案调查"],
    horizonal: ["adj.", "地平线的；层位的", "horizon-related", "horizonal layer", "层位层"],
    horizonline: ["n.", "地平线", "line of horizon", "clear horizon line", "清晰地平线"],
    horticulture: ["n.", "园艺学", "garden-crop science", "urban horticulture", "城市园艺学"],
    ichthyology: ["n.", "鱼类学", "fish study", "marine ichthyology", "海洋鱼类学"],
    impeder: ["n.", "阻碍者；阻碍因素", "obstacle, blocker", "policy impeder", "政策阻碍因素"],
    impersonator: ["n.", "冒充者；模仿者", "imitator, pretender", "online impersonator", "网络冒充者"],
    impress: ["v.", "给人深刻印象；使铭记", "make a strong effect", "impress the audience", "给观众留下深刻印象"],
    individual: ["n.", "个人；个体", "single person or organism", "individual responsibility", "个人责任"],
    infrared: ["adj./n.", "红外线的；红外线", "below-red radiation", "infrared camera", "红外摄像机"],
    ingredient: ["n.", "成分；原料", "component, material", "active ingredient", "有效成分"],
    inhuman: ["adj.", "不人道的；非人的", "cruel, not human", "inhuman treatment", "不人道待遇"],
    inline: ["adj.", "内联的；排成一线的", "in a line, embedded", "inline comment", "内联注释"],
    interdisciplinary: ["adj.", "跨学科的", "across fields", "interdisciplinary research", "跨学科研究"]
  };
  for (const [head, [pos, zh, gloss, phraseEn, phraseZh]] of Object.entries(conciseMeaningFixesMore)) {
    const card = cards.find((item) => item.head === head);
    if (!card?.senses?.[0]) continue;
    card.senses[0].pos = pos;
    card.senses[0].zh = zh;
    card.senses[0].gloss = gloss;
    if (!card.senses[0].phrases?.some((phrase) => phrase.en === phraseEn)) {
      card.senses[0].phrases = [{ en: phraseEn, zh: phraseZh }, ...(card.senses[0].phrases || []).slice(0, 2)];
    }
  }
  const conciseMeaningFixesThird = {
    ethics: ["n.", "伦理学；道德规范", "moral principles, moral philosophy", "research ethics", "研究伦理"],
    historiography: ["n.", "史学；史学写作", "history writing", "modern historiography", "现代史学"],
    "human-computer": ["adj.", "人机的", "human-machine related", "human-computer interaction", "人机交互"],
    individual: ["n.", "个人；个体", "single person or organism", "individual responsibility", "个人责任"],
    ingredient: ["n.", "成分；原料", "component, material", "active ingredient", "有效成分"],
    investor: ["n.", "投资者", "person who invests", "foreign investor", "外国投资者"],
    journalist: ["n.", "新闻记者", "news reporter", "investigative journalist", "调查记者"],
    jurisprudence: ["n.", "法理学；法律哲学", "legal philosophy", "comparative jurisprudence", "比较法理学"],
    labourer: ["n.", "劳动者；劳工", "manual worker", "migrant labourer", "外来劳工"],
    legislator: ["n.", "立法者", "law maker", "local legislator", "地方立法者"],
    linear: ["adj.", "线性的；直线的", "straight-line, sequential", "linear relationship", "线性关系"],
    linearity: ["n.", "线性；直线性", "linear quality", "linearity assumption", "线性假设"],
    literary: ["adj.", "文学的", "literature-related", "literary tradition", "文学传统"],
    lobbyist: ["n.", "游说者", "political persuader", "industry lobbyist", "行业游说者"],
    longitudinal: ["adj.", "纵向的；经线的", "lengthwise, long-term", "longitudinal study", "纵向研究"],
    maltreat: ["v.", "虐待；粗暴对待", "mistreat", "maltreat animals", "虐待动物"],
    mechanics: ["n.", "力学；机械学；运作方式", "motion science, workings", "quantum mechanics", "量子力学"],
    mediator: ["n.", "调解者；中介", "go-between, negotiator", "neutral mediator", "中立调解者"],
    merchant: ["n.", "商人", "trader", "local merchant", "本地商人"],
    metallurgy: ["n.", "冶金学", "metal science", "powder metallurgy", "粉末冶金"],
    metaphysics: ["n.", "形而上学", "study of reality", "classical metaphysics", "古典形而上学"],
    meteorologist: ["n.", "气象学者", "weather scientist", "climate meteorologist", "气候气象学者"],
    midwifery: ["n.", "助产学；助产业", "childbirth assistance", "community midwifery", "社区助产服务"],
    moderator: ["n.", "主持人；调解者", "discussion leader", "debate moderator", "辩论主持人"],
    monopolist: ["n.", "垄断者", "market controller", "railway monopolist", "铁路垄断者"],
    morphology: ["n.", "形态学；形态", "form study", "word morphology", "词形学"],
    mythology: ["n.", "神话学；神话体系", "myth study, myth system", "Greek mythology", "希腊神话"],
    narratology: ["n.", "叙事学", "narrative study", "modern narratology", "现代叙事学"],
    negotiator: ["n.", "谈判者", "bargaining representative", "chief negotiator", "首席谈判者"],
    nominee: ["n.", "被提名者；候选人", "named candidate", "award nominee", "奖项提名者"],
    notary: ["n.", "公证人", "legal witness", "public notary", "公证人"],
    observer: ["n.", "观察者", "watcher, monitor", "independent observer", "独立观察员"],
    ornithology: ["n.", "鸟类学", "bird study", "field ornithology", "野外鸟类学"],
    outsider: ["n.", "局外人；外来者", "person outside a group", "political outsider", "政治局外人"],
    owner: ["n.", "所有者；主人", "possessor", "property owner", "财产所有者"],
    participant: ["n.", "参与者", "person taking part", "study participant", "研究参与者"],
    patriot: ["n.", "爱国者", "country supporter", "local patriot", "本地爱国者"],
    patronizing: ["adj.", "居高临下的；要人领情的", "condescending", "patronizing tone", "居高临下的语气"],
    pedagogical: ["adj.", "教学法的；教育学的", "teaching-related", "pedagogical method", "教学法"],
    personify: ["v.", "人格化；体现", "represent as a person", "personify courage", "体现勇气"],
    petrology: ["n.", "岩石学", "rock study", "igneous petrology", "火成岩岩石学"],
    philosopher: ["n.", "哲学家；思想者", "thinker", "moral philosopher", "道德哲学家"],
    philosophical: ["adj.", "哲学的；达观的", "philosophy-related", "philosophical question", "哲学问题"],
    philosophy: ["n.", "哲学；人生观", "wisdom study, worldview", "political philosophy", "政治哲学"],
    phonology: ["n.", "音系学", "sound-system study", "English phonology", "英语音系学"],
    physiology: ["n.", "生理学", "body-function study", "human physiology", "人体生理学"],
    poet: ["n.", "诗人", "poem writer", "Romantic poet", "浪漫主义诗人"],
    populace: ["n.", "民众；大众", "ordinary people", "urban populace", "城市民众"],
    population: ["n.", "人口；总体", "people group, statistical group", "ageing population", "老龄人口"],
    populous: ["adj.", "人口众多的", "densely inhabited", "populous city", "人口众多的城市"],
    presenter: ["n.", "主持人；报告者；参展者", "speaker, host", "conference presenter", "会议报告者"],
    preventer: ["n.", "阻止者；防止装置", "thing that prevents", "accident preventer", "事故防止装置"],
    printer: ["n.", "打印机；印刷者", "printing device, printing worker", "laser printer", "激光打印机"],
    private: ["adj./n.", "私人的；私营的；士兵", "personal, nonpublic", "private school", "私立学校"],
    protector: ["n.", "保护者；保护装置", "guardian, shield", "legal protector", "法律保护者"],
    psychiatry: ["n.", "精神病学", "mental-health medicine", "clinical psychiatry", "临床精神病学"],
    psychoanalysis: ["n.", "精神分析", "analytic therapy", "Freudian psychoanalysis", "弗洛伊德精神分析"]
  };
  for (const [head, [pos, zh, gloss, phraseEn, phraseZh]] of Object.entries(conciseMeaningFixesThird)) {
    const card = cards.find((item) => item.head === head);
    if (!card?.senses?.[0]) continue;
    card.senses[0].pos = pos;
    card.senses[0].zh = zh;
    card.senses[0].gloss = gloss;
    if (!card.senses[0].phrases?.some((phrase) => phrase.en === phraseEn)) {
      card.senses[0].phrases = [{ en: phraseEn, zh: phraseZh }, ...(card.senses[0].phrases || []).slice(0, 2)];
    }
  }
  const conciseMeaningFixesFourth = {
    researcher: ["n.", "研究者", "investigator, scholar", "medical researcher", "医学研究者"],
    recruiter: ["n.", "招聘者；征募者", "person who recruits", "military recruiter", "军队征募者"],
    reformer: ["n.", "改革者", "person who reforms", "education reformer", "教育改革者"],
    reformist: ["n./adj.", "改革派；改革主义的", "reform supporter", "reformist movement", "改革运动"],
    rawmaterial: ["n.", "原材料", "unprocessed input", "raw material cost", "原材料成本"],
    radio: ["n.", "无线电；收音机", "wireless broadcast", "radio signal", "无线电信号"],
    roadmap: ["n.", "路线图；行动计划", "plan, route map", "policy roadmap", "政策路线图"],
    ridgeline: ["n.", "山脊线", "ridge crest", "mountain ridgeline", "山脊线"],
    rectilinear: ["adj.", "直线的；由直线构成的", "straight-lined", "rectilinear design", "直线式设计"],
    referee: ["n.", "裁判；审稿人", "judge, reviewer", "journal referee", "期刊审稿人"],
    replicator: ["n.", "复制者；复制器", "copying agent or device", "DNA replicator", "DNA复制器"],
    restorer: ["n.", "修复者", "person who restores", "art restorer", "艺术品修复者"],
    prospector: ["n.", "探矿者；寻找机会者", "resource seeker", "gold prospector", "淘金探矿者"],
    proposer: ["n.", "提议者", "person who proposes", "proposal proposer", "提案提出者"],
    prompter: ["n.", "提示者；提词器", "cue giver", "stage prompter", "舞台提词员"],
    purchaser: ["n.", "购买者", "buyer", "home purchaser", "购房者"],
    preventer: ["n.", "阻止者；防止装置", "thing that prevents", "accident preventer", "事故防止装置"],
    presenter: ["n.", "主持人；报告者；参展者", "speaker, host", "conference presenter", "会议报告者"],
    owner: ["n.", "所有者；主人", "possessor", "property owner", "财产所有者"],
    observer: ["n.", "观察者", "watcher, monitor", "independent observer", "独立观察员"],
    invader: ["n.", "入侵者", "attacker, intruder", "foreign invader", "外来入侵者"],
    irresistible: ["adj.", "诱人的；无法抗拒的", "impossible to resist", "irresistible offer", "无法抗拒的提议"],
    lamentable: ["adj.", "令人惋惜的；可悲的", "regrettable, sad", "lamentable failure", "令人惋惜的失败"],
    launcher: ["n.", "发射器；发起者", "launching device or person", "rocket launcher", "火箭发射器"],
    lavage: ["n./v.", "灌洗；冲洗", "medical washing", "gastric lavage", "洗胃"],
    lineament: ["n.", "轮廓；地貌线", "outline, feature line", "facial lineament", "面部轮廓"],
    mind: ["n.", "精神；心智", "mental faculty", "human mind", "人类心智"],
    misuse: ["n./v.", "误用；滥用", "wrong use", "data misuse", "数据滥用"],
    mythos: ["n.", "神话体系；精神内核", "mythic system", "national mythos", "民族神话体系"],
    navigate: ["v.", "导航；确定路线", "find a route", "navigate a route", "导航路线"],
    parallel: ["n./adj.", "平行线；平行的", "side-by-side line", "parallel lines", "平行线"],
    pavement: ["n.", "铺装；人行道", "paved surface", "pavement repair", "路面修复"],
    psyche: ["n.", "心灵；精神", "mind, soul", "human psyche", "人类心灵"],
    ray: ["n.", "射线；光线", "beam of light", "light ray", "光线"]
  };
  for (const [head, [pos, zh, gloss, phraseEn, phraseZh]] of Object.entries(conciseMeaningFixesFourth)) {
    const card = cards.find((item) => item.head === head);
    if (!card?.senses?.[0]) continue;
    card.senses[0].pos = pos;
    card.senses[0].zh = zh;
    card.senses[0].gloss = gloss;
    if (!card.senses[0].phrases?.some((phrase) => phrase.en === phraseEn)) {
      card.senses[0].phrases = [{ en: phraseEn, zh: phraseZh }, ...(card.senses[0].phrases || []).slice(0, 2)];
    }
  }
  const conciseMeaningFixesFifth = {
    caregiver: ["n.", "照护者；护理者", "care provider", "family caregiver", "家庭照护者"],
    claimant: ["n.", "索赔者；主张权利者", "person making a claim", "benefit claimant", "福利申请者"],
    captor: ["n.", "俘获者；劫持者", "one who captures", "armed captor", "武装劫持者"],
    challenger: ["n.", "挑战者", "opponent, rival", "political challenger", "政治挑战者"],
    confessor: ["n.", "忏悔者；听告解神父", "one who confesses or hears confession", "religious confessor", "宗教忏悔者"],
    counterfeiter: ["n.", "造假者；伪造者", "forger, fake maker", "online counterfeiter", "网络造假者"],
    creator: ["n.", "创作者；创造者", "maker, originator", "content creator", "内容创作者"],
    crusher: ["n.", "压碎机；压制者", "crushing device or force", "mining crusher", "采矿破碎机"],
    exterminator: ["n.", "灭虫者；消灭者", "pest remover", "pest exterminator", "害虫消灭者"],
    fermenter: ["n.", "发酵罐；发酵者", "fermentation vessel", "industrial fermenter", "工业发酵罐"],
    foreigner: ["n.", "外国人；外来者", "person from another country", "foreigner registration", "外国人登记"],
    forerunner: ["n.", "先驱；前兆", "precursor, pioneer", "forerunner of reform", "改革先驱"],
    forger: ["n.", "伪造者；锻工", "fake maker, smith", "document forger", "文件伪造者"],
    founder: ["n.", "创始人；建立者", "originator, establisher", "company founder", "公司创始人"],
    gardener: ["n.", "园丁；园艺者", "garden worker", "community gardener", "社区园丁"],
    glider: ["n.", "滑翔机；滑翔者", "aircraft without engine", "hang glider", "悬挂式滑翔机"],
    grantee: ["n.", "受让人；受资助者", "grant recipient", "research grantee", "研究资助获得者"],
    grantor: ["n.", "授予者；让与人", "person who grants", "property grantor", "财产让与人"],
    guarantor: ["n.", "担保人", "person who guarantees", "loan guarantor", "贷款担保人"],
    harasser: ["n.", "骚扰者", "person who harasses", "workplace harasser", "职场骚扰者"],
    harpooner: ["n.", "鱼叉手；捕鲸者", "harpoon hunter", "Arctic harpooner", "北极鱼叉手"],
    hipster: ["n.", "潮人；赶时髦的人", "fashionable urban person", "hipster culture", "潮人文化"],
    insulter: ["n.", "侮辱者", "person who insults", "online insulter", "网络侮辱者"],
    insurgent: ["n./adj.", "叛乱者；起义的", "rebel, rebellious", "insurgent group", "叛乱组织"],
    introvert: ["n.", "内向者", "inward-focused person", "social introvert", "社交内向者"],
    invader: ["n.", "入侵者", "attacker, intruder", "foreign invader", "外来入侵者"],
    mastermind: ["n./v.", "策划者；策划", "planner, organize secretly", "criminal mastermind", "犯罪策划者"],
    misleader: ["n.", "误导者", "person who misleads", "online misleader", "网络误导者"],
    narcissist: ["n.", "自恋者", "self-absorbed person", "grandiose narcissist", "自大型自恋者"],
    obligor: ["n.", "债务人；义务人", "person legally obliged", "debt obligor", "债务人"],
    outcast: ["n.", "被排斥者", "excluded person", "social outcast", "社会边缘人"],
    philomath: ["n.", "爱学习者", "lover of learning", "lifelong philomath", "终身爱学者"],
    procurator: ["n.", "代理人；检察官", "legal agent, prosecutor", "Roman procurator", "罗马代理官"],
    promisee: ["n.", "受诺人", "person receiving a promise", "promisee rights", "受诺人权利"],
    promisor: ["n.", "承诺人", "person making a promise", "promisor obligation", "承诺人义务"],
    pusher: ["n.", "推动者；推销者", "promoter, seller", "policy pusher", "政策推动者"],
    rafter: ["n.", "椽子；漂流者", "roof beam, river floater", "roof rafter", "屋顶椽子"],
    raiser: ["n.", "筹集者；抬高者", "one who raises", "fund raiser", "筹款人"],
    redeemer: ["n.", "救赎者；赎回者", "rescuer, buyer back", "religious redeemer", "宗教救赎者"],
    relayer: ["n.", "转发器；接力者", "relay device or person", "signal relayer", "信号转发器"],
    reliever: ["n.", "救济者；缓解物", "helper, easing agent", "pain reliever", "止痛药"],
    retaliator: ["n.", "报复者；反击者", "one who retaliates", "trade retaliator", "贸易报复方"],
    runner: ["n.", "跑者；滑轨；运行者", "one who runs", "long-distance runner", "长跑者"],
    scheduler: ["n.", "调度器；排程者", "scheduling tool or worker", "court scheduler", "法院排程人员"],
    schemer: ["n.", "策划者；阴谋者", "plotter", "financial schemer", "金融阴谋者"],
    supervisor: ["n.", "监督者；导师", "overseer, adviser", "research supervisor", "研究导师"],
    taxpayer: ["n.", "纳税人", "person who pays tax", "taxpayer burden", "纳税人负担"],
    trainee: ["n.", "受训者", "person in training", "trainee doctor", "实习医生"],
    trainer: ["n.", "训练者；训练器", "teacher, training device", "athletic trainer", "运动训练师"],
    unemployed: ["adj./n.", "失业的；失业者", "without paid work", "unemployed worker", "失业工人"],
    vegetarian: ["n./adj.", "素食者；素食的", "plant-based eater", "vegetarian diet", "素食饮食"],
    victim: ["n.", "受害者；牺牲者", "harmed person", "crime victim", "犯罪受害者"],
    victor: ["n.", "胜利者", "winner", "military victor", "军事胜利者"],
    viewer: ["n.", "观看者；查看器", "watcher, display tool", "media viewer", "媒体观看者"],
    violator: ["n.", "违反者", "rule breaker", "traffic violator", "交通违规者"],
    volunteerism: ["n.", "志愿服务精神", "voluntary service spirit", "community volunteerism", "社区志愿服务"],
    warning: ["n.", "警告；预警", "advance notice of danger", "early warning", "早期预警"],
    warner: ["n.", "警告者；报警装置", "warning person or device", "automatic warner", "自动报警装置"],
    warnable: ["adj.", "可警告的；可预警的", "able to be warned", "warnable hazard", "可预警隐患"],
    university: ["n.", "大学", "higher-education institution", "research university", "研究型大学"],
    science: ["n.", "科学", "systematic knowledge", "natural science", "自然科学"],
    scientific: ["adj.", "科学的", "science-based", "scientific evidence", "科学证据"],
    scientifically: ["adv.", "科学地", "by scientific method", "scientifically valid", "科学有效的"],
    scholarship: ["n.", "奖学金；学问", "grant, academic study", "full scholarship", "全额奖学金"],
    school: ["n./v.", "学校；学派；训练", "educational institution, train", "public school", "公立学校"],
    syllabus: ["n.", "教学大纲", "course outline", "exam syllabus", "考试大纲"],
    theology: ["n.", "神学", "study of religion", "Christian theology", "基督教神学"],
    theological: ["adj.", "神学的", "religion-study related", "theological debate", "神学争论"],
    topology: ["n.", "拓扑学", "shape-structure mathematics", "network topology", "网络拓扑"],
    zoology: ["n.", "动物学", "animal study", "zoology research", "动物学研究"],
    zoological: ["adj.", "动物学的", "animal-study related", "zoological survey", "动物学调查"]
  };
  for (const [head, [pos, zh, gloss, phraseEn, phraseZh]] of Object.entries(conciseMeaningFixesFifth)) {
    const card = cards.find((item) => item.head === head);
    if (!card?.senses?.[0]) continue;
    card.senses[0].pos = pos;
    card.senses[0].zh = zh;
    card.senses[0].gloss = gloss;
    if (!card.senses[0].phrases?.some((phrase) => phrase.en === phraseEn)) {
      card.senses[0].phrases = [{ en: phraseEn, zh: phraseZh }, ...(card.senses[0].phrases || []).slice(0, 2)];
    }
  }
  const secondaryGlossFixes = [
    ["ethics", 1, "moral philosophy"],
    ["mechanics", 1, "physics of forces"],
    ["individual", 2, "single person"],
    ["ingredient", 1, "cooking material"],
    ["linear", 1, "line-shaped, sequential"],
    ["nominee", 1, "appointed person"],
    ["philosopher", 1, "wise thinker"],
    ["psychoanalysis", 1, "analytic therapy"],
    ["gorgeous", 1, "delightful, splendid"],
    ["decent", 2, "satisfactory"]
  ];
  for (const [head, senseIndex, gloss] of secondaryGlossFixes) {
    const card = cards.find((item) => item.head === head);
    if (card?.senses?.[senseIndex]) card.senses[senseIndex].gloss = gloss;
  }
  const entryPriorityCards = {
    president: {
      cut: "pre/sid/ent",
      cutMeaning: "在前；预先/坐；主持/人；形容词",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "总统；主席",
          gloss: "head of state, chair",
          examples: [
            {
              en: "The president announced an emergency plan after the flood damaged major roads.",
              zh: "洪水破坏主要道路后，总统宣布了一项紧急计划。"
            }
          ],
          phrases: [
            { en: "elected president", zh: "当选总统" },
            { en: "student president", zh: "学生会主席" }
          ]
        },
        {
          index: "2",
          pos: "n.",
          zh: "大学校长；公司总裁",
          gloss: "university or company head",
          examples: [
            {
              en: "The university president approved a new scholarship for medical students.",
              zh: "大学校长批准了一项面向医学生的新奖学金。"
            }
          ],
          phrases: [
            { en: "university president", zh: "大学校长" },
            { en: "company president", zh: "公司总裁" }
          ]
        }
      ]
    },
    application: {
      cut: "ap/plic/ation",
      cutMeaning: "向；加强/折叠；放上/名词",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "申请；申请书",
          gloss: "request, form",
          examples: [
            {
              en: "Her application for the scholarship included a recommendation from her supervisor.",
              zh: "她的奖学金申请包括导师的一封推荐信。"
            }
          ],
          phrases: [
            { en: "job application", zh: "求职申请" },
            { en: "application form", zh: "申请表" }
          ]
        },
        {
          index: "2",
          pos: "n.",
          zh: "应用；运用",
          gloss: "use, practical use",
          examples: [
            {
              en: "The practical application of the theory changed how doctors treated pain.",
              zh: "这一理论的实际应用改变了医生治疗疼痛的方式。"
            }
          ],
          phrases: [
            { en: "practical application", zh: "实际应用" },
            { en: "medical application", zh: "医学应用" }
          ]
        },
        {
          index: "3",
          pos: "n.",
          zh: "施用；涂抹",
          gloss: "putting on, applying",
          examples: [
            {
              en: "The application of oil keeps the wooden surface from drying out.",
              zh: "涂油可以防止木质表面变干。"
            }
          ],
          phrases: [
            { en: "application of medicine", zh: "药物施用" }
          ]
        }
      ]
    },
    transfer: {
      cut: "trans/fer",
      cutMeaning: "转移/带来",
      senses: [
        {
          index: "1",
          pos: "v.",
          zh: "转移；转让；调动",
          gloss: "move, shift",
          examples: [
            {
              en: "Technology transfer works only when local capacity can absorb it.",
              zh: "技术转让只有在地方能力能吸收它时才有效。"
            }
          ],
          phrases: [
            { en: "transfer data", zh: "传输数据" },
            { en: "transfer ownership", zh: "转让所有权" }
          ]
        },
        {
          index: "2",
          pos: "v.",
          zh: "转学；转账；换乘",
          gloss: "change school, send money, change transport",
          examples: [
            {
              en: "Mobile banking allows farmers to transfer money without visiting a physical bank.",
              zh: "移动银行让农民无需去实体银行就能转账。"
            }
          ],
          phrases: [
            { en: "transfer money", zh: "转账" },
            { en: "transfer to another school", zh: "转到另一所学校" }
          ]
        },
        {
          index: "3",
          pos: "n.",
          zh: "转移；转让",
          gloss: "movement, handover",
          examples: [
            {
              en: "The transfer of patients began after the old hospital closed.",
              zh: "旧医院关闭后，病人转移开始了。"
            }
          ],
          phrases: [
            { en: "data transfer", zh: "数据传输" },
            { en: "property transfer", zh: "财产转让" }
          ]
        }
      ]
    },
    funding: {
      cut: "fund/ing",
      cutMeaning: "资金；基础/名词",
      senses: [{
        index: "1",
        pos: "n.",
        zh: "资金；资助",
        gloss: "financial support",
        examples: [
          {
            en: "Disaster funding was cancelled after the authority found incomplete records.",
            zh: "主管机构发现记录不完整后，灾害资金被取消。"
          }
        ],
        phrases: [
          { en: "public funding", zh: "公共资金" },
          { en: "research funding", zh: "研究经费" }
        ]
      }]
    },
    contradiction: {
      cut: "contra/dict/ion",
      cutMeaning: "反/说话；断言/名词",
      senses: [{
        index: "1",
        pos: "n.",
        zh: "矛盾；反驳",
        gloss: "conflict, inconsistency",
        examples: [
          {
            en: "There is a contradiction when a policy promises safety but removes the warning system.",
            zh: "如果一项政策承诺安全却移除预警系统，就存在矛盾。"
          }
        ],
        phrases: [
          { en: "contradiction in evidence", zh: "证据中的矛盾" },
          { en: "clear contradiction", zh: "明显矛盾" }
        ]
      }]
    },
    temporary: {
      cut: "tempor/ary",
      cutMeaning: "时间/形容词",
      senses: [{
        index: "1",
        pos: "adj.",
        zh: "临时的；暂时的",
        gloss: "short-term, not permanent",
        examples: [
          {
            en: "Temporary solutions cannot solve housing shortages if cities ignore long-term planning.",
            zh: "如果城市忽视长期规划，临时方案无法解决住房短缺。"
          }
        ],
        phrases: [
          { en: "temporary solution", zh: "临时方案" },
          { en: "temporary access", zh: "临时通行权" }
        ]
      }]
    },
    neurology: {
      cut: "neuro/log/y",
      cutMeaning: "神经/学科；研究/名词",
      senses: [{
        index: "1",
        pos: "n.",
        zh: "神经学",
        gloss: "study of nerves",
        examples: [
          {
            en: "Neurology helped doctors understand why the patient lost balance after the injury.",
            zh: "神经学帮助医生理解病人受伤后为什么失去平衡。"
          }
        ],
        phrases: [
          { en: "clinical neurology", zh: "临床神经学" },
          { en: "neurology research", zh: "神经学研究" }
        ]
      }]
    },
    relief: {
      cut: "re/lief",
      cutMeaning: "回；再/减轻；升起",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "缓解；宽慰",
          gloss: "ease, comfort",
          examples: [
            {
              en: "Rain brought relief to villages suffering from drought.",
              zh: "降雨给遭受干旱的村庄带来缓解。"
            }
          ],
          phrases: [
            { en: "pain relief", zh: "疼痛缓解" },
            { en: "feel relief", zh: "感到宽慰" }
          ]
        },
        {
          index: "2",
          pos: "n.",
          zh: "救济；救助",
          gloss: "aid, assistance",
          examples: [
            {
              en: "Relief workers delivered medicine after the emergency roads reopened.",
              zh: "紧急道路重新开放后，救援人员送来了药品。"
            }
          ],
          phrases: [
            { en: "disaster relief", zh: "灾害救助" },
            { en: "relief supplies", zh: "救济物资" }
          ]
        },
        {
          index: "3",
          pos: "n.",
          zh: "浮雕",
          gloss: "raised sculpture",
          examples: [
            {
              en: "The temple wall showed a relief of farmers harvesting grain.",
              zh: "寺庙墙上有农民收割谷物的浮雕。"
            }
          ],
          phrases: [
            { en: "stone relief", zh: "石浮雕" }
          ]
        }
      ]
    },
    cabinet: {
      cut: "cabinet",
      cutMeaning: "内阁；柜子",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "内阁",
          gloss: "government ministers",
          examples: [
            {
              en: "The cabinet met to discuss the food shortage.",
              zh: "内阁开会讨论食物短缺。"
            }
          ],
          phrases: [
            { en: "cabinet meeting", zh: "内阁会议" }
          ]
        },
        {
          index: "2",
          pos: "n.",
          zh: "贮藏柜；陈列柜",
          gloss: "cupboard, display case",
          examples: [
            {
              en: "Medicine was locked in a cabinet above the sink.",
              zh: "药品锁在水槽上方的柜子里。"
            }
          ],
          phrases: [
            { en: "medicine cabinet", zh: "药柜" },
            { en: "glass cabinet", zh: "玻璃陈列柜" }
          ]
        }
      ]
    },
    cancel: {
      cut: "cancel",
      cutMeaning: "取消；划掉",
      senses: [
        {
          index: "1",
          pos: "v.",
          zh: "取消；作废",
          gloss: "call off, annul",
          examples: [
            {
              en: "The school cancelled classes because of the storm.",
              zh: "学校因风暴取消课程。"
            }
          ],
          phrases: [
            { en: "cancel a meeting", zh: "取消会议" }
          ]
        },
        {
          index: "2",
          pos: "v.",
          zh: "删去；划掉",
          gloss: "cross out, delete",
          examples: [
            {
              en: "The editor cancelled several repeated sentences.",
              zh: "编辑删去了几句重复句子。"
            }
          ],
          phrases: [
            { en: "cancel repeated lines", zh: "删去重复行" }
          ]
        },
        {
          index: "3",
          pos: "v.",
          zh: "抵消",
          gloss: "offset, neutralize",
          examples: [
            {
              en: "The two payments cancelled each other out.",
              zh: "两笔付款相互抵消。"
            }
          ],
          phrases: [
            { en: "cancel each other out", zh: "相互抵消" }
          ]
        }
      ]
    },
    embarrassment: {
      cut: "embarrass/ment",
      cutMeaning: "尴尬；使窘迫/名词",
      senses: [{
        index: "1",
        pos: "n.",
        zh: "尴尬；难堪",
        gloss: "awkward shame",
        examples: [
          {
            en: "The public cancellation caused embarrassment for the senior organisers.",
            zh: "公开取消让高级组织者感到尴尬。"
          }
        ],
        phrases: [
          { en: "public embarrassment", zh: "公开难堪" },
          { en: "avoid embarrassment", zh: "避免尴尬" }
        ]
      }]
    },
    safety: {
      cut: "safe/ty",
      cutMeaning: "安全/名词",
      senses: [{
        index: "1",
        pos: "n.",
        zh: "安全；安全性",
        gloss: "protection from danger",
        examples: [
          {
            en: "Public safety depends on prevention, not only punishment after harm.",
            zh: "公共安全依赖预防，而不只是伤害发生后的惩罚。"
          }
        ],
        phrases: [
          { en: "public safety", zh: "公共安全" },
          { en: "safety standard", zh: "安全标准" }
        ]
      }]
    }
  };
  for (const [head, patch] of Object.entries(entryPriorityCards)) replaceCard(head, patch);
  return cards;
}

const EXTRA_FAMILY_PATCHES = {
  irritate: ["irritate", "irritation", "irritating"],
  read: ["read", "readable", "readiness", "reader", "reread", "rereads"],
  reluctant: ["reluctant", "reluctance"],
  crisis: ["crisis", "post-crisis"],
  ambulance: ["ambulance"],
  beauty: ["beauty", "beautiful", "beautifully"],
  hope: ["hope", "hopeful", "hopeless"],
  mystery: ["mystery", "mysterious"],
  workstation: ["workstation"],
  arrogant: ["arrogant", "arrogance"],
  cheerful: ["cheerful", "cheerfulness"],
  clerk: ["clerk", "clerical"],
  collateral: ["collateral"],
  contempt: ["contempt", "contemptuous"],
  contract: ["contract", "contractual"],
  effort: ["effort", "effortless"],
  excellent: ["excellent", "excellence"],
  exclaim: ["exclaim", "exclamation"],
  flirt: ["flirt", "flirtatious"],
  flower: ["flower", "floral"],
  necessary: ["necessary", "necessity", "unnecessary"],
  periphery: ["periphery", "peripheral"],
  polite: ["polite", "politeness", "impolite"],
  saint: ["saint", "sainthood"],
  solemn: ["solemn", "solemnity"],
  still: ["still", "stillness"],
  stubborn: ["stubborn", "stubbornness"],
  thought: ["thought", "thoughtful", "thoughtless"],
  useless: ["useless", "uselessness"],
  visible: ["visible", "visibility", "invisible"],
  vulgar: ["vulgar", "vulgarity"],
  support: ["support", "supported", "unsupported"],
  infect: ["infect", "disinfect", "disinfectant"],
  qualify: ["qualify", "disqualify", "disqualifies"],
  distress: ["distress", "distressing", "distressingly"],
  immaculate: ["immaculate"],
  inquire: ["inquire", "inquiry"],
  sane: ["sane", "insane"],
  suffer: ["suffer", "insufferable", "insufferably"],
  timid: ["timid", "intimidate", "intimidation"],
  head: ["head", "overhead"],
  regret: ["regret", "regretful"],
  respite: ["respite"],
  pay: ["pay", "paid", "underpaid", "unpaid"],
  fold: ["fold", "unfold", "unfolds"],
  lock: ["lock", "unlock"],
  pleasant: ["pleasant", "unpleasant"],
  tidy: ["tidy", "untidy"]
};

const EXTRA_FAMILY_PATCHES_MORE = {
  donor: ["donor", "donate", "donation"],
  difficult: ["difficult", "difficulty"],
  apron: ["apron"],
  brave: ["brave", "bravery", "bravely"],
  napkin: ["napkin"],
  pregnant: ["pregnant", "pregnancy"],
  tablet: ["tablet"],
  badge: ["badge"],
  cardigan: ["cardigan"],
  dumpling: ["dumpling", "dumplings"],
  furniture: ["furniture"],
  blazer: ["blazer"],
  booklet: ["booklet"],
  dislike: ["dislike", "dislikes"],
  charming: ["charm", "charming"],
  doorway: ["doorway"],
  espresso: ["espresso"],
  velvet: ["velvet"],
  compass: ["compass", "compasses"],
  dataset: ["dataset"],
  metronome: ["metronome"],
  obedient: ["obedient", "obedience"],
  restroom: ["restroom"],
  scooter: ["scooter"],
  raincoat: ["raincoat", "raincoats"],
  visible: ["visible", "visibly", "visibility", "invisible"],
  waiter: ["waiter", "waitress"],
  worry: ["worry", "worried"],
  advise: ["advise", "advice", "adviser"],
  compress: ["compress", "compresses", "compression"],
  contingent: ["contingent", "contingency"],
  criticise: ["criticise", "criticism", "critic"],
  denominate: ["denominate", "denominated", "denomination"],
  derange: ["derange", "deranged"],
  please: ["please", "pleased", "displeased"],
  institution: ["institution", "institutional", "institutionalised"],
  disturb: ["disturb", "disturbance"],
  oblige: ["oblige", "obliged", "obligation"],
  rehearse: ["rehearse", "rehearsal"],
  nervous: ["nerve", "nervous", "nervously"],
  lecture: ["lecture", "lecturer"],
  tighten: ["tight", "tighten"],
  murmur: ["murmur"],
  glance: ["glance", "glances"],
  soften: ["soft", "soften", "softens"],
  mistaken: ["mistake", "mistaken"]
};

const EXTRA_FAMILY_EXPANSIONS = {
  component: ["component", "components", "componential"],
  conscience: ["conscience", "conscientious", "conscientiously", "conscientiousness"],
  consent: ["consent", "consensual", "consensus"],
  contingent: ["contingent", "contingency", "contingently"],
  convenient: ["convenience", "convenient", "inconvenience", "inconvenient", "inconveniently"],
  desperate: ["desperate", "desperation", "desperately"],
  detergent: ["detergent", "detergency"],
  implant: ["implant", "implantation", "implanted"],
  capable: ["capable", "incapable", "capability"],
  innocent: ["innocent", "innocence", "innocently"],
  invite: ["invite", "invitation", "inviting"],
  inward: ["inward", "inwardly", "inwards"],
  periphery: ["periphery", "peripheral", "peripherally"],
  permit: ["permit", "permission", "permissive"],
  pregnant: ["pregnant", "pregnancy"],
  protect: ["protect", "protection", "protective", "protectiveness"],
  realistic: ["realistic", "realism", "realist", "realistically"],
  reckless: ["reckless", "recklessness", "recklessly"],
  repeat: ["repeat", "repetitive", "repetition", "repeated"],
  reputation: ["reputation", "reputable", "disreputable"],
  bear: ["bear", "bearable", "unbearable"],
  forgive: ["forgive", "forgivable", "unforgivable", "forgiveness"],
  ability: ["ability", "able", "unable"],
  admit: ["admit", "admission", "admitted", "admitting"],
  annual: ["annual", "annually"],
  apologise: ["apologise", "apology", "apologetic"],
  appeal: ["appeal", "appealing", "unappealing"],
  apply: ["apply", "applicant", "application", "applied"],
  assist: ["assist", "assistance", "assistant"],
  auction: ["auction", "auctioneer"],
  audience: ["audience", "auditorium", "auditory"],
  balance: ["balance", "balanced", "imbalance"],
  brutal: ["brutal", "brutality", "brutally"],
  candidate: ["candidate", "candidacy"],
  correct: ["correct", "correction", "corrective", "incorrect"],
  entertain: ["entertain", "entertainment", "entertaining"],
  equip: ["equip", "equipment", "equipped"],
  explain: ["explain", "explanation", "explanatory"],
  experience: ["experience", "experienced", "inexperienced"],
  know: ["know", "unknown", "known", "knowledge"],
  tolerate: ["tolerate", "tolerable", "tolerance", "intolerable"],
  sentence: ["sentence", "sentential"],
  society: ["society", "social", "socially", "societal"],
  delay: ["delay", "delayed", "delaying"],
  deadline: ["deadline", "deadlines"],
  voice: ["voice", "vocal", "vocally"],
  remedy: ["remedy", "remedial", "remediate"],
  save: ["save", "saving", "savings"],
  study: ["study", "student", "studious"],
  stack: ["stack", "stacked"],
  calm: ["calm", "calmly", "calmness"],
  give: ["give", "given"],
  language: ["language", "linguistic", "linguistics"],
  enter: ["enter", "entrance", "entry"],
  number: ["number", "numeral", "numerical", "numerous"],
  light: ["light", "lighting", "lighten"],
  message: ["message", "messenger", "messaging"],
  restaurant: ["restaurant", "restaurateur"],
  analyse: ["analyse", "analysis", "analyst"],
  faculty: ["faculty", "faculties"],
  read: ["read", "reader", "reading", "readable"],
  wet: ["wet", "wetness"],
  hospital: ["hospital", "hospitality", "hospitalise"],
  pale: ["pale", "pallor"],
  lower: ["lower", "lowering"],
  opportunity: ["opportunity", "opportunist"],
  require: ["require", "requirement"],
  loud: ["loud", "loudly", "loudness"],
  tragedy: ["tragedy", "tragic"],
  receive: ["receive", "receipt"],
  quality: ["quality", "qualify", "qualitative"],
  summary: ["summary", "summarise"],
  upward: ["upward", "upwards"],
  familiar: ["familiar", "familiarity", "unfamiliar"],
  lecture: ["lecture", "lecturer"],
  brave: ["brave", "bravery", "bravely"],
  narrow: ["narrow", "narrowly"],
  vendor: ["vendor", "vend"],
  charm: ["charm", "charming"],
  dislike: ["dislike", "dislikes"],
  mercy: ["mercy", "merciful", "merciless"],
  estimate: ["estimate", "estimation", "estimator", "overestimate", "overestimation", "underestimate", "underestimation"],
  interest: ["interest", "interested", "interesting"],
  geology: ["geology", "geologic", "geological", "geologist"],
  archaeology: ["archaeology", "archaeological", "archaeologist"],
  biology: ["biology", "biological", "biologically", "biologist"],
  barometer: ["barometer", "barometric"],
  immune: ["immune", "immunity", "immunize", "immunization", "immunodeficiency", "immunology"],
  organize: ["organize", "organisation", "organization", "organizational", "organise", "organiser"],
  construct: ["construct", "construction", "constructive", "constructivism", "constructivist", "constructionism", "constructionist"],
  depend: ["depend", "dependable", "dependability", "dependably", "dependency", "independent", "interdependence"],
  digit: ["digit", "digital", "digitalize", "digitalization", "digitization", "digitize"],
  invent: ["invent", "invention", "inventive", "inventiveness", "inventor"],
  produce: ["produce", "producer", "product", "production", "productive", "productively", "productiveness", "productivity"],
  care: ["care", "careful", "carefully", "carefulness", "careless", "carelessness"],
  connect: ["connect", "connection", "connectivity", "connectedness"],
  interpret: ["interpret", "interpretation", "interpreter", "interpretive", "interpretable"],
  script: ["script", "scriptorium", "scripture", "scriptural"],
  treat: ["treat", "treatable", "treatment", "treatise", "treaty"],
  use: ["use", "usable", "usability", "useful", "usefulness"],
  abnormal: ["abnormal", "abnormality"],
  awkward: ["awkward", "awkwardly", "awkwardness"],
  bright: ["bright", "brightly", "brightness"],
  deny: ["deny", "denial"],
  dictate: ["dictate", "dictatorial"],
  expand: ["expand", "expandable"],
  incite: ["incite", "incitement"],
  incorporate: ["incorporate", "incorporation"],
  reflect: ["reflect", "reflection", "reflective"],
  revise: ["revise", "revision", "reviser"],
  consult: ["consult", "consultant", "consultation", "consultative"],
  describe: ["describe", "description", "descriptive", "describable"],
  identify: ["identify", "identification", "identifiable", "identity"],
  inspire: ["inspire", "inspiration", "inspired", "inspiring"],
  merge: ["merge", "merger", "mergeable"],
  nutrition: ["nutrition", "nutritional", "malnutrition"],
  support: ["support", "supportive", "supported", "supporter", "unsupported"],
  reason: ["reason", "reasonable", "reasonableness", "reasoner"],
  understand: ["understand", "understandable", "understandability", "understandably", "misunderstand"],
  announce: ["announce", "announcement", "announcer"],
  conflict: ["conflict", "conflicting", "conflictingly"],
  international: ["international", "internationally", "internationalise"],
  predict: ["predict", "predictable", "predictably", "prediction", "predictive", "predictor", "unpredictable"],
  believe: ["believe", "believable", "believability", "believably", "believer", "unbelievable"],
  clear: ["clear", "clarity", "clearance", "clearly", "clearness", "unclear"],
  harm: ["harm", "harmful", "harmfully", "harmfulness", "harmless", "harmreduction"],
  account: ["account", "accountability", "accountable", "accountably", "accountant"],
  final: ["final", "finality", "finalization", "finalize", "finally"],
  local: ["local", "locality", "localisation"],
  specify: ["specific", "specifically", "specificity", "specification", "specify"],
  quantify: ["quantification", "quantifiable", "quantifier", "quantify"],
  suggest: ["suggest", "suggestion", "suggestive", "suggester"],
  thorough: ["thorough", "thoroughly", "thoroughness"],
  judge: ["judge", "judgement", "judgment"],
  practical: ["practical", "practicality", "practically"],
  circular: ["circular", "circularity"],
  periodic: ["periodic", "periodical"],
  relocate: ["relocate", "relocation"],
  strenuous: ["strenuous", "strenuously"],
  gain: ["gain", "gainfulness"],
  native: ["native", "nativeness", "nativity"],
  finance: ["finance", "financial", "financially", "financier"],
  remain: ["remain", "remaining", "remainder"],
  pretend: ["pretend", "pretence", "pretension", "pretentious", "unpretentious"],
  polite: ["polite", "politely", "politeness", "impolite"],
  anonymous: ["anonymous", "anonymity", "anonymously"],
  advise: ["advise", "advice", "adviser", "advisory"],
  direct: ["direct", "direction", "directional", "misdirection"],
  qualify: ["qualify", "qualified", "qualification", "overqualified", "unqualified"],
  interest: ["interest", "interested", "interesting", "uninterested"],
  romantic: ["romantic", "romanticise", "romanticism"],
  priority: ["priority", "prioritise", "prioritisation"],
  stationer: ["stationery", "stationer"],
  coward: ["coward", "cowardice", "cowardly"],
  fortune: ["fortune", "fortunate", "fortunately", "unfortunate", "unfortunately"],
  important: ["important", "importance", "importantly", "unimportant"],
  pleasant: ["pleasant", "pleasantly", "unpleasant"],
  sacrifice: ["sacrifice", "sacrificial"],
  inhale: ["inhale", "inhalation"],
  suffer: ["suffer", "suffering", "insufferable"],
  stabilise: ["stabilise", "stabilised", "stabilisation"],
  withhold: ["withhold", "withholding"],
  laminate: ["laminate", "laminated", "lamination"],
  mutter: ["mutter", "muttering"],
  transfer: ["transfer", "transferable", "transference", "transferred"],
  welcome: ["welcome", "welcoming", "unwelcome"],
  bless: ["bless", "blessing"],
  fallback: ["fallback"],
  handover: ["handover"],
  mismatch: ["mismatch", "mismatched"],
  assign: ["assign", "assignment", "unassigned"],
  liaison: ["liaison"],
  unchanged: ["change", "changed", "unchanged"],
  manage: ["manage", "management", "manageable", "unmanaged"],
  file: ["file", "misfile", "misfiled"],
  hedge: ["hedge", "unhedged"],
  irritate: ["irritate", "irritating", "irritation"],
  tailor: ["tailor", "tailoring"],
  allow: ["allow", "allowance", "allowable"],
  prefix: ["prefix", "prefixed"],
  suffix: ["suffix", "suffixed"],
  east: ["east", "eastern", "eastward"],
  west: ["west", "western", "westward"],
  enslave: ["enslave", "enslaved", "enslavement"],
  codify: ["codify", "codified", "codification"],
  related: ["relate", "related", "unrelated"],
  emit: ["emit", "emission", "emitting"],
  mission: ["mission", "missionary"],
  pipeline: ["pipeline"],
  possess: ["possess", "possession", "possessive"],
  vertebra: ["vertebra", "vertebrae", "vertebral"],
  bankrupt: ["bankrupt", "bankruptcy"],
  centralise: ["centralise", "centralised", "centralisation"],
  diversify: ["diversify", "diversified", "diversification"],
  artillery: ["artillery"],
  aboard: ["aboard"],
  peasant: ["peasant", "peasantry"],
  protestant: ["protestant", "protestantism"],
  union: ["union", "unionise", "unionised"],
  ethic: ["ethic", "ethical", "ethically"],
  slavery: ["slave", "slavery"],
  app: ["app"],
  api: ["api"],
  appetite: ["appetite", "appetiser", "appetising"],
  inherit: ["inherit", "inheritable", "inheritance", "inherited", "hereditary", "heritage"],
  inhere: ["inhere", "inherence", "inherent", "inherently"],
  acclaim: ["acclaim", "acclamation"],
  advocate: ["advocate", "advocacy"],
  allegory: ["allegory", "allegorist", "allegorize"],
  alchemy: ["alchemy", "alchemist"],
  anomaly: ["anomaly", "anomalism", "anomaloid"],
  antagonist: ["antagonist", "antagonism", "antagonize"],
  anesthesia: ["anesthesia", "anaesthesia", "anesthetic", "anaesthetist"],
  altruism: ["altruism", "altruist", "altruistic"],
  direct: ["direct", "director", "direction", "misdirection"],
  discipline: ["discipline", "disciplinary"],
  document: ["document", "documentation", "documentary"],
  electric: ["electric", "electrical", "electricity"],
  economy: ["economy", "economic", "economically", "economical"],
  effect: ["effect", "effective", "effectively"],
  elevate: ["elevate", "elevation"],
  endow: ["endow", "endowment"],
  fossil: ["fossil", "fossilise", "fossilize", "fossilisation", "fossilization"],
  human: ["human", "humanity", "humanitarian"],
  identify: ["identify", "identification", "identifiable", "identity"],
  illustrate: ["illustrate", "illustration", "illustrative"],
  imply: ["imply", "implication", "implicit"],
  impose: ["impose", "imposition"],
  impress: ["impress", "impression", "impressive"],
  adequate: ["adequate", "inadequate", "adequacy", "inadequacy"],
  instruct: ["instruct", "instruction", "instructor"],
  insulate: ["insulate", "insulation", "insulator"],
  insure: ["insure", "insurance"],
  land: ["land", "landmass", "landscape"],
  legislate: ["legislate", "legislation", "legislative", "legislature"],
  line: ["line", "linear", "linearity"],
  manage: ["manage", "management", "manager", "unmanaged"],
  mechanic: ["mechanic", "mechanical", "mechanism"],
  migrate: ["migrate", "migration", "migrant"],
  monument: ["monument", "monumental"],
  motivate: ["motivate", "motivation", "motivational"],
  option: ["option", "optional"],
  prefer: ["prefer", "preference"],
  press: ["press", "pressure"],
  provide: ["provide", "provision", "provisional"],
  respond: ["respond", "response", "responsive"],
  revive: ["revive", "revival"],
  ritual: ["ritual", "ritualistic"]
};

const EXTRA_CARD_PATCHES = [
  { head: "database", cut: "data/base", cutMeaning: "数据/基础；库", pos: "n.", zh: "数据库", gloss: "data collection", phrase: ["research database", "研究数据库"], example: ["The database stored climate records from more than fifty stations.", "这个数据库储存了来自五十多个站点的气候记录。"] },
  { head: "software", cut: "soft/ware", cutMeaning: "软；非硬件/物品；设备", pos: "n.", zh: "软件", gloss: "computer programs", phrase: ["analysis software", "分析软件"], example: ["The software detected errors before the data were published.", "软件在数据发布前检测出了错误。"] },
  { head: "fossil-fuel", cut: "fossil/fuel", cutMeaning: "化石/燃料", pos: "n.", zh: "化石燃料", gloss: "coal, oil, or gas", phrase: ["fossil-fuel consumption", "化石燃料消耗"], example: ["Fossil-fuel use declined after the city invested in wind power.", "城市投资风能后，化石燃料使用下降了。"] },
  { head: "uranium", cut: "uran/ium", cutMeaning: "铀；天空/元素", pos: "n.", zh: "铀", gloss: "radioactive element", phrase: ["uranium mining", "铀矿开采"], example: ["Uranium can produce energy, but its waste requires careful storage.", "铀可以产生能源，但其废料需要谨慎储存。"] },
  { head: "dwelling", cut: "dwell/ing", cutMeaning: "居住/名词", pos: "n.", zh: "住处；住宅", gloss: "home, residence", phrase: ["rural dwelling", "乡村住宅"], example: ["Each dwelling had thick walls to reduce heat during the day.", "每座住宅都有厚墙，以减少白天的热量。"] },
  { head: "logistics", cut: "logist/ics", cutMeaning: "计算；组织/学科；体系", pos: "n.", zh: "物流；后勤", gloss: "transport organization", phrase: ["transport logistics", "运输物流"], example: ["Poor logistics delayed food delivery after the storm.", "糟糕的物流延误了风暴后的食物配送。"] },
  { head: "coral-reef", cut: "coral/reef", cutMeaning: "珊瑚/礁", pos: "n.", zh: "珊瑚礁", gloss: "coral structure", phrase: ["coral-reef ecosystem", "珊瑚礁生态系统"], example: ["The coral-reef ecosystem weakened as ocean temperature rose.", "海温上升后，珊瑚礁生态系统变弱了。"] },
  { head: "demographics", cut: "demo/graph/ics", cutMeaning: "人民；人口/记录；写/学科；数据", pos: "n.", zh: "人口统计特征", gloss: "population data", phrase: ["regional demographics", "地区人口统计"], example: ["Changing demographics forced planners to build more schools.", "人口结构变化迫使规划者建设更多学校。"] },
  { head: "cloning", cut: "clon/ing", cutMeaning: "复制/名词", pos: "n.", zh: "克隆；复制", gloss: "genetic copying", phrase: ["animal cloning", "动物克隆"], example: ["Cloning raises ethical questions when the copied organism can suffer.", "当被复制的生物会受苦时，克隆会引发伦理问题。"] },
  { head: "cloud-computing", cut: "cloud/comput/ing", cutMeaning: "云/计算/名词", pos: "n.", zh: "云计算", gloss: "internet-based computing", phrase: ["cloud-computing service", "云计算服务"], example: ["Cloud-computing services let small firms store data without owning servers.", "云计算服务让小公司无需拥有服务器也能存储数据。"] },
  { head: "semantics", cut: "semant/ics", cutMeaning: "意义/学科", pos: "n.", zh: "语义学；意义", gloss: "meaning study", phrase: ["lexical semantics", "词汇语义学"], example: ["Semantics explains why two similar words may not fit the same sentence.", "语义学解释为什么两个相似词可能不能放进同一句子。"] },
  { head: "phonetics", cut: "phon/et/ics", cutMeaning: "声音/相关/学科", pos: "n.", zh: "语音学", gloss: "speech-sound study", phrase: ["phonetics class", "语音学课程"], example: ["Phonetics helped the students hear the difference between two vowels.", "语音学帮助学生听出两个元音之间的差别。"] },
  { head: "raw-material", cut: "raw/material", cutMeaning: "原始；未加工/材料", pos: "n.", zh: "原材料", gloss: "unprocessed input", phrase: ["raw-material cost", "原材料成本"], example: ["A rise in raw-material prices made manufacturing more expensive.", "原材料价格上涨使制造成本更高。"] },
  { head: "peer-pressure", cut: "peer/pressure", cutMeaning: "同伴/压力", pos: "n.", zh: "同伴压力", gloss: "social pressure", phrase: ["peer-pressure effect", "同伴压力效应"], example: ["Peer-pressure can make teenagers follow a risky trend.", "同伴压力可能使青少年追随危险潮流。"] },
  { head: "status-quo", cut: "status/quo", cutMeaning: "状态/现有状态", pos: "n.", zh: "现状", gloss: "existing condition", phrase: ["protect the status-quo", "保护现状"], example: ["Powerful groups often defend the status-quo when reform threatens their benefits.", "当改革威胁其利益时，强势群体常常维护现状。"] },
  { head: "scenario", cut: "scenario", cutMeaning: "情景；方案", pos: "n.", zh: "情景；设想；方案", gloss: "possible situation", phrase: ["worst-case scenario", "最坏情景"], example: ["The worst-case scenario assumed that rainfall would fail for two years.", "最坏情景假设降雨会连续两年失败。"] },
  { head: "zenith", cut: "zenith", cutMeaning: "顶点；天顶", pos: "n.", zh: "顶点；鼎盛时期", gloss: "highest point", phrase: ["reach its zenith", "达到顶点"], example: ["The empire reached its zenith before trade routes shifted east.", "贸易路线东移前，这个帝国达到鼎盛。"] },
  { head: "zoning", cut: "zon/ing", cutMeaning: "区域/名词", pos: "n.", zh: "分区制；区划", gloss: "land-use regulation", phrase: ["urban zoning", "城市分区"], example: ["Zoning rules kept factories away from residential streets.", "分区规则让工厂远离住宅街道。"] },
  { head: "amenities", cut: "amen/it/ies", cutMeaning: "便利；愉快/名词/复数", pos: "n.", zh: "便利设施", gloss: "useful facilities", phrase: ["public amenities", "公共便利设施"], example: ["New amenities made the district more attractive to families.", "新的便利设施使这个地区对家庭更有吸引力。"] },
  { head: "outsourcing", cut: "out/sourc/ing", cutMeaning: "向外/来源；资源/名词", pos: "n.", zh: "外包", gloss: "external contracting", phrase: ["outsourcing jobs", "外包工作"], example: ["Outsourcing reduced costs but weakened local employment.", "外包降低了成本，但削弱了本地就业。"] },
  { head: "cell-membrane", cut: "cell/membrane", cutMeaning: "细胞/膜", pos: "n.", zh: "细胞膜", gloss: "cell boundary", phrase: ["cell-membrane structure", "细胞膜结构"], example: ["The cell-membrane controls which substances enter the cell.", "细胞膜控制哪些物质进入细胞。"] },
  { head: "nucleus", cut: "nucle/us", cutMeaning: "核心；核/名词", pos: "n.", zh: "细胞核；核心", gloss: "core, cell center", phrase: ["cell nucleus", "细胞核"], example: ["The nucleus stores genetic information inside many cells.", "细胞核在许多细胞内储存遗传信息。"] },
  { head: "gene-expression", cut: "gene/expression", cutMeaning: "基因/表达", pos: "n.", zh: "基因表达", gloss: "gene activity", phrase: ["gene-expression pattern", "基因表达模式"], example: ["Gene-expression patterns can change when cells face stress.", "细胞面临压力时，基因表达模式可能改变。"] },
  { head: "standard-deviation", cut: "standard/deviation", cutMeaning: "标准/偏差", pos: "n.", zh: "标准差", gloss: "statistical spread", phrase: ["standard-deviation value", "标准差数值"], example: ["A large standard-deviation means the results vary widely.", "较大的标准差意味着结果差异很大。"] },
  { head: "vector", cut: "vect/or", cutMeaning: "携带；方向/名词", pos: "n.", zh: "向量；载体", gloss: "directed quantity, carrier", phrase: ["disease vector", "疾病媒介"], example: ["A vector has both size and direction in geometry.", "在几何中，向量同时具有大小和方向。"] },
  { head: "benchmarking", cut: "bench/mark/ing", cutMeaning: "长凳；基准/标记/名词", pos: "n.", zh: "基准测试；对标", gloss: "performance comparison", phrase: ["benchmarking process", "对标过程"], example: ["Benchmarking showed that the new software was faster but less stable.", "基准测试显示新软件更快但不够稳定。"] },
  { head: "robotics", cut: "robot/ics", cutMeaning: "机器人/学科", pos: "n.", zh: "机器人学", gloss: "robot technology", phrase: ["robotics laboratory", "机器人实验室"], example: ["Robotics combines software, sensors, and mechanical design.", "机器人学结合软件、传感器和机械设计。"] },
  { head: "memory-encoding", cut: "memory/encoding", cutMeaning: "记忆/编码", pos: "n.", zh: "记忆编码", gloss: "memory formation", phrase: ["memory-encoding process", "记忆编码过程"], example: ["Sleep can influence memory-encoding after difficult learning.", "睡眠会影响高难度学习后的记忆编码。"] },
  { head: "executive-function", cut: "executive/function", cutMeaning: "执行的；管理的/功能", pos: "n.", zh: "执行功能", gloss: "mental control", phrase: ["executive-function test", "执行功能测试"], example: ["Executive-function skills help people plan and resist distractions.", "执行功能帮助人们计划并抵抗干扰。"] },
  { head: "stimulus-response", cut: "stimulus/response", cutMeaning: "刺激/反应", pos: "n.", zh: "刺激-反应", gloss: "reaction pattern", phrase: ["stimulus-response pattern", "刺激-反应模式"], example: ["The experiment measured a simple stimulus-response pattern.", "这个实验测量了一种简单的刺激-反应模式。"] },
  { head: "sensory-processing", cut: "sensory/processing", cutMeaning: "感觉的/处理", pos: "n.", zh: "感觉处理", gloss: "sense processing", phrase: ["sensory-processing difficulty", "感觉处理困难"], example: ["Sensory-processing differences can affect how children react to sound.", "感觉处理差异会影响儿童对声音的反应。"] },
  { head: "cognitive-load", cut: "cognitive/load", cutMeaning: "认知的/负荷", pos: "n.", zh: "认知负荷", gloss: "mental burden", phrase: ["reduce cognitive-load", "降低认知负荷"], example: ["Clear diagrams reduce cognitive-load when students learn complex systems.", "清晰图表能在学生学习复杂系统时降低认知负荷。"] },
  { head: "working-memory", cut: "working/memory", cutMeaning: "工作的；运行中的/记忆", pos: "n.", zh: "工作记忆", gloss: "short-term mental storage", phrase: ["working-memory capacity", "工作记忆容量"], example: ["Working-memory limits make long instructions hard to follow.", "工作记忆限制会使长指令难以遵循。"] },
  { head: "long-term-memory", cut: "long/term/memory", cutMeaning: "长/期限/记忆", pos: "n.", zh: "长期记忆", gloss: "lasting memory", phrase: ["long-term-memory storage", "长期记忆储存"], example: ["Repeated practice helps move knowledge into long-term-memory.", "反复练习有助于把知识转入长期记忆。"] },
  { head: "short-term-memory", cut: "short/term/memory", cutMeaning: "短/期限/记忆", pos: "n.", zh: "短期记忆", gloss: "brief memory", phrase: ["short-term-memory task", "短期记忆任务"], example: ["Short-term-memory can hold only a limited amount of information.", "短期记忆只能容纳有限信息。"] },
  { head: "neural-pathway", cut: "neural/pathway", cutMeaning: "神经的/路径", pos: "n.", zh: "神经通路", gloss: "nerve route", phrase: ["neural-pathway development", "神经通路发展"], example: ["A repeated skill can strengthen a neural-pathway over time.", "反复练习的技能会随着时间强化神经通路。"] },
  { head: "brain-imaging", cut: "brain/imaging", cutMeaning: "大脑/成像", pos: "n.", zh: "脑成像", gloss: "brain scanning", phrase: ["brain-imaging study", "脑成像研究"], example: ["Brain-imaging revealed which areas were active during reading.", "脑成像显示阅读时哪些区域处于活跃状态。"] },
  { head: "neural-network", cut: "neural/network", cutMeaning: "神经的/网络", pos: "n.", zh: "神经网络", gloss: "connected nerve or AI system", phrase: ["neural-network model", "神经网络模型"], example: ["A neural-network model can identify patterns in large datasets.", "神经网络模型可以识别大型数据集中的模式。"] },
  { head: "decision-making", cut: "decision/making", cutMeaning: "决定/形成；制作", pos: "n.", zh: "决策", gloss: "choosing process", phrase: ["decision-making process", "决策过程"], example: ["Stress can change decision-making when evidence is uncertain.", "证据不确定时，压力会改变决策。"] },
  { head: "cognitive-flexibility", cut: "cognitive/flexibility", cutMeaning: "认知的/灵活性", pos: "n.", zh: "认知灵活性", gloss: "mental adaptability", phrase: ["cognitive-flexibility training", "认知灵活性训练"], example: ["Cognitive-flexibility helps learners switch between different rules.", "认知灵活性帮助学习者在不同规则之间切换。"] },
  { head: "crop-yield", cut: "crop/yield", cutMeaning: "作物/产量", pos: "n.", zh: "作物产量", gloss: "harvest amount", phrase: ["crop-yield data", "作物产量数据"], example: ["Crop-yield improved after farmers changed irrigation methods.", "农民改变灌溉方法后，作物产量提高了。"] },
  { head: "soil-fertility", cut: "soil/fertility", cutMeaning: "土壤/肥力；生育力", pos: "n.", zh: "土壤肥力", gloss: "soil productivity", phrase: ["soil-fertility decline", "土壤肥力下降"], example: ["Soil-fertility declined after years of overuse.", "多年过度使用后，土壤肥力下降了。"] },
  { head: "food-security", cut: "food/security", cutMeaning: "食物/安全；保障", pos: "n.", zh: "粮食安全", gloss: "reliable food access", phrase: ["food-security policy", "粮食安全政策"], example: ["Food-security depends on storage, transport, and stable harvests.", "粮食安全取决于储存、运输和稳定收成。"] },
  { head: "organic-farming", cut: "organic/farming", cutMeaning: "有机的/农业；耕作", pos: "n.", zh: "有机农业", gloss: "chemical-light farming", phrase: ["organic-farming methods", "有机农业方法"], example: ["Organic-farming methods can protect soil but may require more labour.", "有机农业方法可以保护土壤，但可能需要更多劳动力。"] },
  { head: "crop-rotation", cut: "crop/rotation", cutMeaning: "作物/轮作；旋转", pos: "n.", zh: "轮作", gloss: "changing crops by season", phrase: ["crop-rotation system", "轮作制度"], example: ["Crop-rotation reduced pests without heavy pesticide use.", "轮作在不大量使用农药的情况下减少了害虫。"] },
  { head: "soil-erosion", cut: "soil/erosion", cutMeaning: "土壤/侵蚀", pos: "n.", zh: "土壤侵蚀", gloss: "soil loss", phrase: ["soil-erosion control", "土壤侵蚀控制"], example: ["Trees along the slope helped prevent soil-erosion.", "坡地上的树木有助于防止土壤侵蚀。"] },
  { head: "urban-planning", cut: "urban/planning", cutMeaning: "城市的/规划", pos: "n.", zh: "城市规划", gloss: "city planning", phrase: ["urban-planning policy", "城市规划政策"], example: ["Urban-planning decisions affect transport, housing, and green space.", "城市规划决策影响交通、住房和绿地。"] },
  { head: "land-use", cut: "land/use", cutMeaning: "土地/使用", pos: "n.", zh: "土地利用", gloss: "use of land", phrase: ["land-use pattern", "土地利用模式"], example: ["Land-use maps showed where farms had become housing.", "土地利用图显示了农田变成住房的区域。"] },
  { head: "public-transit", cut: "public/transit", cutMeaning: "公共的/运输；中转", pos: "n.", zh: "公共交通", gloss: "public transport", phrase: ["public-transit access", "公共交通可达性"], example: ["Better public-transit reduced congestion in the city centre.", "更好的公共交通减少了市中心拥堵。"] },
  { head: "green-space", cut: "green/space", cutMeaning: "绿色；环保/空间", pos: "n.", zh: "绿地", gloss: "urban nature area", phrase: ["urban green-space", "城市绿地"], example: ["Green-space can lower heat and improve mental health.", "绿地可以降低热量并改善心理健康。"] },
  { head: "interpreting", cut: "interpret/ing", cutMeaning: "口译；解释/名词", pos: "n.", zh: "口译；解释", gloss: "oral translation", phrase: ["conference interpreting", "会议口译"], example: ["Accurate interpreting helped the witnesses understand each legal question.", "准确口译帮助证人理解每个法律问题。"] },
  { head: "refining", cut: "refin/ing", cutMeaning: "精炼；提纯/名词", pos: "n.", zh: "精炼；提纯", gloss: "purification", phrase: ["oil refining", "石油炼制"], example: ["Refining removes impurities before the material enters production.", "提纯会在材料进入生产前去除杂质。"] },
  { head: "automated", cut: "automat/ed", cutMeaning: "自动/形容词", pos: "adj.", zh: "自动化的", gloss: "machine-controlled", phrase: ["automated system", "自动化系统"], example: ["Automated gates reduced delays at the transport terminal.", "自动闸门减少了运输站的延误。"] },
  { head: "optimized", cut: "optimiz/ed", cutMeaning: "优化/形容词", pos: "adj.", zh: "优化的", gloss: "improved for best performance", phrase: ["optimized design", "优化设计"], example: ["The optimized route saved fuel without increasing delivery time.", "优化路线节省了燃料，同时没有增加配送时间。"] },
  { head: "hydroponics", cut: "hydro/pon/ics", cutMeaning: "水/放置；栽培/学科", pos: "n.", zh: "水培法", gloss: "soil-free cultivation", phrase: ["hydroponics farm", "水培农场"], example: ["Hydroponics allows vegetables to grow where soil is poor.", "水培法让蔬菜能在土壤贫瘠的地方生长。"] },
  { head: "overgrazing", cut: "over/graz/ing", cutMeaning: "过度/吃草；放牧/名词", pos: "n.", zh: "过度放牧", gloss: "excessive grazing", phrase: ["overgrazing damage", "过度放牧损害"], example: ["Overgrazing left the hillside bare and increased soil erosion.", "过度放牧使山坡裸露，并加剧了土壤侵蚀。"] },
  { head: "yearning", cut: "yearn/ing", cutMeaning: "渴望/名词", pos: "n.", zh: "渴望；向往", gloss: "strong longing", phrase: ["yearning for freedom", "对自由的渴望"], example: ["The poem expresses a yearning for home after years of migration.", "这首诗表达了多年迁徙后对家园的渴望。"] },
  { head: "zeal", cut: "zeal", cutMeaning: "热情；热忱", pos: "n.", zh: "热情；热忱", gloss: "enthusiasm", phrase: ["reform zeal", "改革热情"], example: ["Reform zeal faded when the policy produced unexpected costs.", "当政策产生意外成本时，改革热情减弱了。"] },
  { head: "kinetics", cut: "kinet/ics", cutMeaning: "运动/学科", pos: "n.", zh: "动力学", gloss: "study of motion", phrase: ["chemical kinetics", "化学动力学"], example: ["Kinetics explains how quickly a reaction moves toward completion.", "动力学解释反应以多快速度走向完成。"] },
  { head: "yielding", cut: "yield/ing", cutMeaning: "产出；让步/形容词；名词", pos: "adj./n.", zh: "产出的；让步的", gloss: "producing or giving way", phrase: ["high-yielding crop", "高产作物"], example: ["High-yielding varieties improved food security in the region.", "高产品种改善了该地区的粮食安全。"] },
  { head: "grandiose", cut: "grandiose", cutMeaning: "宏大的；浮夸的", pos: "adj.", zh: "宏大的；浮夸的", gloss: "impressive but excessive", phrase: ["grandiose plan", "宏大计划"], example: ["The grandiose project impressed officials but ignored local needs.", "这个宏大的项目打动了官员，却忽视了地方需求。"] },
  { head: "kindred", cut: "kindr/ed", cutMeaning: "亲属；同类/形容词", pos: "adj./n.", zh: "同类的；亲属", gloss: "related, similar", phrase: ["kindred traditions", "相近传统"], example: ["The two communities shared kindred rituals despite speaking different languages.", "尽管语言不同，这两个社群共享相近的仪式。"] },
  { head: "ubiquitous", cut: "ubiqu/it/ous", cutMeaning: "到处；无处不在/名词/形容词", pos: "adj.", zh: "无处不在的", gloss: "present everywhere", phrase: ["ubiquitous technology", "无处不在的技术"], example: ["Smartphones became ubiquitous before schools agreed how to use them.", "智能手机已经无处不在，而学校还未就如何使用它们达成一致。"] },
  { head: "soar", cut: "soar", cutMeaning: "猛增；高飞", pos: "v.", zh: "猛增；高飞", gloss: "rise sharply", phrase: ["prices soar", "价格猛涨"], example: ["Food prices can soar when harvests fail in several regions.", "多个地区歉收时，食品价格可能猛涨。"] },
  { head: "renowned", cut: "re/nown/ed", cutMeaning: "加强/名声/形容词", pos: "adj.", zh: "著名的", gloss: "famous", phrase: ["renowned scholar", "著名学者"], example: ["A renowned architect redesigned the old cathedral after the fire.", "火灾后，一位著名建筑师重新设计了这座旧大教堂。"] },
  { head: "relinquish", cut: "re/linqu/ish", cutMeaning: "回；放开/离开；留下/动词", pos: "v.", zh: "放弃；让出", gloss: "give up", phrase: ["relinquish control", "放弃控制"], example: ["The ruler refused to relinquish power after the election.", "选举后，这位统治者拒绝放弃权力。"] },
  { head: "digitized", cut: "digit/iz/ed", cutMeaning: "数字/动词/形容词", pos: "adj.", zh: "数字化的", gloss: "converted to digital form", phrase: ["digitized records", "数字化记录"], example: ["Digitized manuscripts allowed students to study rare texts online.", "数字化手稿让学生能够在线研究珍贵文本。"] },
  { head: "excavation-site", cut: "excavation/site", cutMeaning: "挖掘；发掘/地点", pos: "n.", zh: "发掘现场", gloss: "dig site", phrase: ["archaeological excavation-site", "考古发掘现场"], example: ["The excavation-site revealed pottery from an earlier settlement.", "这个发掘现场发现了早期定居点的陶器。"] },
  { head: "excavation-layer", cut: "excavation/layer", cutMeaning: "挖掘；发掘/层", pos: "n.", zh: "发掘层", gloss: "digging layer", phrase: ["lower excavation-layer", "较低发掘层"], example: ["A deeper excavation-layer contained older animal bones.", "更深的发掘层包含更古老的动物骨骼。"] },
  { head: "taboo", cut: "taboo", cutMeaning: "禁忌", pos: "n./adj.", zh: "禁忌；忌讳的", gloss: "social prohibition", phrase: ["social taboo", "社会禁忌"], example: ["A taboo can shape behaviour even when no written law exists.", "即使没有成文法，禁忌也能塑造行为。"] },
  { head: "value-system", cut: "value/system", cutMeaning: "价值/体系", pos: "n.", zh: "价值体系", gloss: "system of values", phrase: ["shared value-system", "共同价值体系"], example: ["A shared value-system helped the group settle disputes peacefully.", "共同价值体系帮助这个群体和平解决争端。"] },
  { head: "social-cohesion", cut: "social/cohesion", cutMeaning: "社会的/凝聚", pos: "n.", zh: "社会凝聚力", gloss: "social unity", phrase: ["social-cohesion policy", "社会凝聚政策"], example: ["Public festivals can strengthen social-cohesion in diverse cities.", "公共节日可以增强多元城市的社会凝聚力。"] },
  { head: "urban-sprawl", cut: "urban/sprawl", cutMeaning: "城市的/蔓延", pos: "n.", zh: "城市蔓延", gloss: "spread of city areas", phrase: ["urban-sprawl problem", "城市蔓延问题"], example: ["Urban-sprawl increased car dependence and reduced farmland.", "城市蔓延增加了汽车依赖，并减少了农田。"] },
  { head: "assimilationist", cut: "assimilation/ist", cutMeaning: "同化/人；主义者", pos: "n./adj.", zh: "同化主义者；同化主义的", gloss: "supporter of assimilation", phrase: ["assimilationist policy", "同化主义政策"], example: ["An assimilationist policy may weaken minority languages.", "同化主义政策可能削弱少数族群语言。"] },
  { head: "demographic-shift", cut: "demographic/shift", cutMeaning: "人口统计的/转变", pos: "n.", zh: "人口结构变化", gloss: "population change", phrase: ["major demographic-shift", "重大人口结构变化"], example: ["A demographic-shift forced the city to expand elderly care.", "人口结构变化迫使城市扩大养老服务。"] },
  { head: "social-mobility", cut: "social/mobility", cutMeaning: "社会的/流动性", pos: "n.", zh: "社会流动性", gloss: "movement between social classes", phrase: ["low social-mobility", "低社会流动性"], example: ["Education can improve social-mobility when poor students receive support.", "当贫困学生获得支持时，教育可以改善社会流动性。"] },
  { head: "inequality-gap", cut: "inequality/gap", cutMeaning: "不平等/差距", pos: "n.", zh: "不平等差距", gloss: "inequality difference", phrase: ["widening inequality-gap", "扩大的不平等差距"], example: ["The inequality-gap widened as housing costs rose faster than wages.", "随着房价上涨快于工资，不平等差距扩大了。"] },
  { head: "social-construct", cut: "social/construct", cutMeaning: "社会的/建构", pos: "n.", zh: "社会建构", gloss: "socially created idea", phrase: ["gender as a social-construct", "作为社会建构的性别"], example: ["A social-construct can feel natural because people repeat it daily.", "社会建构会因为人们每天重复它而显得自然。"] },
  { head: "branding", cut: "brand/ing", cutMeaning: "品牌；标记/名词", pos: "n.", zh: "品牌塑造", gloss: "brand creation", phrase: ["city branding", "城市品牌塑造"], example: ["Branding can turn a local festival into a tourist attraction.", "品牌塑造可以把地方节日变成旅游吸引物。"] },
  { head: "innovation-driven", cut: "innovation/driven", cutMeaning: "创新/驱动的", pos: "adj.", zh: "创新驱动的", gloss: "driven by innovation", phrase: ["innovation-driven economy", "创新驱动经济"], example: ["An innovation-driven economy depends on research and skilled workers.", "创新驱动经济依赖研究和熟练工人。"] },
  { head: "cost-effective", cut: "cost/effective", cutMeaning: "成本/有效的", pos: "adj.", zh: "成本效益高的", gloss: "efficient for the cost", phrase: ["cost-effective solution", "高性价比方案"], example: ["Solar lamps were a cost-effective solution for remote villages.", "太阳能灯是偏远村庄的高性价比方案。"] },
  { head: "revenue-stream", cut: "revenue/stream", cutMeaning: "收入/流", pos: "n.", zh: "收入来源", gloss: "source of income", phrase: ["stable revenue-stream", "稳定收入来源"], example: ["The museum created a new revenue-stream by offering online tours.", "博物馆通过提供线上导览创造了新的收入来源。"] },
  { head: "market-share", cut: "market/share", cutMeaning: "市场/份额", pos: "n.", zh: "市场份额", gloss: "share of a market", phrase: ["gain market-share", "获得市场份额"], example: ["The company gained market-share after lowering delivery costs.", "降低配送成本后，这家公司获得了市场份额。"] },
  { head: "business-model", cut: "business/model", cutMeaning: "商业；业务/模型", pos: "n.", zh: "商业模式", gloss: "profit model", phrase: ["digital business-model", "数字商业模式"], example: ["The business-model failed because customers would not pay monthly fees.", "这种商业模式失败了，因为顾客不愿支付月费。"] },
  { head: "competitive-edge", cut: "competitive/edge", cutMeaning: "竞争的/优势；边缘", pos: "n.", zh: "竞争优势", gloss: "advantage over rivals", phrase: ["maintain a competitive-edge", "保持竞争优势"], example: ["Fast logistics gave the firm a competitive-edge.", "快速物流给了这家公司竞争优势。"] },
  { head: "value-chain", cut: "value/chain", cutMeaning: "价值/链条", pos: "n.", zh: "价值链", gloss: "production chain", phrase: ["global value-chain", "全球价值链"], example: ["Each factory added one step to the global value-chain.", "每家工厂都为全球价值链增加一个环节。"] },
  { head: "return-on-investment", cut: "return/on/investment", cutMeaning: "回报/关于/投资", pos: "n.", zh: "投资回报率", gloss: "investment return", phrase: ["high return-on-investment", "高投资回报率"], example: ["The project had a low return-on-investment despite public praise.", "尽管受到公众称赞，这个项目的投资回报率很低。"] },
  { head: "machining", cut: "machin/ing", cutMeaning: "机器加工/名词", pos: "n.", zh: "机械加工", gloss: "machine shaping", phrase: ["precision machining", "精密机械加工"], example: ["Precision machining produced parts that fit the prototype exactly.", "精密机械加工生产出与原型完全匹配的零件。"] },
  { head: "automation-system", cut: "automation/system", cutMeaning: "自动化/系统", pos: "n.", zh: "自动化系统", gloss: "automated system", phrase: ["factory automation-system", "工厂自动化系统"], example: ["The automation-system stopped the line when a sensor detected damage.", "传感器检测到损坏时，自动化系统停止了生产线。"] },
  { head: "control-system", cut: "control/system", cutMeaning: "控制/系统", pos: "n.", zh: "控制系统", gloss: "system of control", phrase: ["engine control-system", "发动机控制系统"], example: ["A faulty control-system caused the turbine to shut down.", "有故障的控制系统导致涡轮机关闭。"] },
  { head: "pragmatics", cut: "pragmat/ics", cutMeaning: "实际使用；语用/学科", pos: "n.", zh: "语用学", gloss: "language use in context", phrase: ["pragmatics research", "语用学研究"], example: ["Pragmatics studies how speakers mean more than their words say.", "语用学研究说话者如何表达超出字面的话。"] },
  { head: "civic", cut: "civ/ic", cutMeaning: "公民；城市/形容词", pos: "adj.", zh: "市民的；公民的", gloss: "public, citizen-related", phrase: ["civic duty", "公民义务"], example: ["Civic groups helped organise shelters after the flood.", "洪水后，市民团体帮助组织避难所。"] },
  { head: "route", cut: "route", cutMeaning: "路线", pos: "n./v.", zh: "路线；线路；安排路线", gloss: "path, course", phrase: ["delivery route", "配送路线"], example: ["The safest route avoided the damaged bridge.", "最安全的路线避开了受损的桥。"] },
  { head: "economics", cut: "econom/ic/s", cutMeaning: "经济；管理/形容词/学科", pos: "n.", zh: "经济学；经济情况", gloss: "economic study", phrase: ["study economics", "学习经济学"], example: ["Economics explains how prices can change when resources become scarce.", "经济学解释资源变稀缺时价格如何变化。"] },
  { head: "crisis", cut: "cris/is", cutMeaning: "判断；转折/名词", pos: "n.", zh: "危机；危急关头", gloss: "emergency, turning point", phrase: ["financial crisis", "金融危机"], example: ["The crisis forced the council to open emergency shelters.", "这场危机迫使委员会开放紧急避难所。"] },
  { head: "risk", cut: "risk", cutMeaning: "风险", pos: "n./v.", zh: "风险；冒险", gloss: "danger, chance of loss", phrase: ["reduce risk", "降低风险"], example: ["The trial measured the risk of side effects in older patients.", "这项试验测量老年患者出现副作用的风险。"] },
  { head: "terms", cut: "term/s", cutMeaning: "条款；术语/复数", pos: "n.", zh: "条款；条件；术语", gloss: "conditions, wording", phrase: ["contract terms", "合同条款"], example: ["The patient read the terms before joining the clinical trial.", "病人在参加临床试验前阅读了条款。"] },
  { head: "access-route", cut: "access/route", cutMeaning: "进入；通道/路线", pos: "n.", zh: "通行路线；进入路径", gloss: "entry path", phrase: ["emergency access-route", "紧急通行路线"], example: ["The access-route to the auditorium was closed during repairs.", "维修期间，通往礼堂的路线被关闭。"] },
  { head: "withdrawal-term", cut: "withdrawal/term", cutMeaning: "退出；撤回/条款", pos: "n.", zh: "退出条款；撤回条件", gloss: "exit condition", phrase: ["withdrawal-term in a contract", "合同中的退出条款"], example: ["The withdrawal-term allowed patients to leave the study at any time.", "退出条款允许病人随时离开研究。"] },
  { head: "hedge", cut: "hedge", cutMeaning: "树篱；防护", pos: "n./v.", zh: "树篱；防范；对冲", gloss: "protective barrier, reduce risk", phrase: ["hedge currency risk", "对冲货币风险"], example: ["The company used a tariff clause to hedge against sudden currency changes.", "公司利用关税条款防范突然的货币变化。"] },
  { head: "evidence-chain", cut: "evidence/chain", cutMeaning: "证据/链条", pos: "n.", zh: "证据链", gloss: "linked proof", phrase: ["clear evidence-chain", "清晰证据链"], example: ["A broken evidence-chain made the accusation difficult to verify.", "断裂的证据链使这项指控难以核实。"] },
  { head: "future", cut: "fut/ure", cutMeaning: "将来；前方/名词", pos: "n./adj.", zh: "未来；将来的", gloss: "time ahead", phrase: ["future pressure", "未来压力"], example: ["Future funding depends on whether the project reduces disaster losses.", "未来资金取决于这个项目是否减少灾害损失。"] },
  { head: "inherited", cut: "in/herit/ed", cutMeaning: "进入；取得/继承；遗产/形容词", pos: "adj.", zh: "继承来的；遗传的", gloss: "received by inheritance", phrase: ["inherited wealth", "继承财富"], example: ["Inherited wealth can shape opportunity before a child enters school.", "继承来的财富会在孩子入学前就塑造机会。"] },
  { head: "app", cut: "app", cutMeaning: "application 的缩写；应用程序", pos: "n.", zh: "应用程序；手机软件", gloss: "application", phrase: ["open the app", "打开应用程序"], example: ["The app stores each entry before sending it to the server.", "这个应用程序会先保存每条记录，再把它发送到服务器。"] },
  { head: "api", cut: "api", cutMeaning: "application programming interface 的缩写；程序接口", pos: "n.", zh: "应用程序接口；接口", gloss: "programming interface", phrase: ["API request", "接口请求"], example: ["The API lets one program request data from another program.", "API 让一个程序可以向另一个程序请求数据。"] },
  { head: "appetiser", cut: "ap/pet/iser", cutMeaning: "向；加强/追求；寻找/名词", pos: "n.", zh: "开胃菜；前菜", gloss: "starter", phrase: ["order an appetiser", "点一道前菜"], example: ["The conversation became tense before the appetiser reached the table.", "前菜还没上桌，谈话就变得紧张起来。"] },
  { head: "appetising", cut: "ap/pet/is/ing", cutMeaning: "向；加强/追求；寻找/动词/形容词", pos: "adj.", zh: "开胃的；诱人的", gloss: "tasty, inviting", phrase: ["an appetising smell", "诱人的气味"], example: ["The soup looked appetising, but nobody at the table felt relaxed.", "这碗汤看起来很开胃，但桌边没人感到放松。"] },
  { head: "prefix", cut: "pre/fix", cutMeaning: "在前；预先/固定；附加", pos: "n./v.", zh: "前缀；加前缀", gloss: "beginning affix", phrase: ["negative prefix", "否定前缀"], example: ["A prefix can change the meaning of a word before the root begins.", "前缀可以在词根开始前改变一个词的意思。"] },
  { head: "prefixed", cut: "pre/fix/ed", cutMeaning: "在前；预先/固定；附加/形容词", pos: "adj.", zh: "加前缀的；预先固定的", gloss: "with a prefix", phrase: ["a prefixed form", "加前缀的形式"], example: ["The prefixed form has a different meaning from the simple root.", "加前缀的形式与简单词根含义不同。"] },
  { head: "suffix", cut: "suf/fix", cutMeaning: "在下；随后/固定；附加", pos: "n./v.", zh: "后缀；加后缀", gloss: "ending affix", phrase: ["noun suffix", "名词后缀"], example: ["A suffix often shows whether a word is a noun, adjective, or verb.", "后缀常常显示一个词是名词、形容词还是动词。"] },
  { head: "suffixed", cut: "suf/fix/ed", cutMeaning: "在下；随后/固定；附加/形容词", pos: "adj.", zh: "加后缀的", gloss: "with a suffix", phrase: ["a suffixed adjective", "加后缀的形容词"], example: ["The suffixed word kept the same root but changed its grammar.", "这个加后缀的词保留了同一词根，但改变了语法功能。"] },
  { head: "eastern", cut: "east/ern", cutMeaning: "东方/形容词", pos: "adj.", zh: "东方的；东部的", gloss: "in the east", phrase: ["eastern coast", "东部海岸"], example: ["The eastern coast received more storms than the inland plain.", "东部海岸比内陆平原遭遇更多风暴。"] },
  { head: "eastward", cut: "east/ward", cutMeaning: "东方/方向", pos: "adv./adj.", zh: "向东；向东的", gloss: "toward the east", phrase: ["move eastward", "向东移动"], example: ["The trade route turned eastward after crossing the mountains.", "贸易路线越过山脉后转向东方。"] },
  { head: "western", cut: "west/ern", cutMeaning: "西方/形容词", pos: "adj.", zh: "西方的；西部的", gloss: "in the west", phrase: ["western border", "西部边界"], example: ["The western border followed the river for several kilometres.", "西部边界沿河延伸了数公里。"] },
  { head: "westward", cut: "west/ward", cutMeaning: "西方/方向", pos: "adv./adj.", zh: "向西；向西的", gloss: "toward the west", phrase: ["travel westward", "向西旅行"], example: ["Settlers moved westward when farmland became scarce near the coast.", "海岸附近农田变少时，定居者向西迁移。"] },
  { head: "enslave", cut: "en/slav/e", cutMeaning: "使；进入/奴隶/动词", pos: "v.", zh: "奴役；使成为奴隶", gloss: "make a slave", phrase: ["enslave prisoners", "奴役俘虏"], example: ["The empire used debt to enslave people who could not pay taxes.", "这个帝国利用债务奴役无法缴税的人。"] },
  { head: "enslaved", cut: "en/slav/ed", cutMeaning: "使；进入/奴隶/形容词", pos: "adj.", zh: "被奴役的；奴隶身份的", gloss: "held as a slave", phrase: ["enslaved workers", "被奴役的工人"], example: ["Enslaved workers built roads that later supported colonial trade.", "被奴役的工人修建了后来支撑殖民贸易的道路。"] },
  { head: "enslavement", cut: "en/slav/e/ment", cutMeaning: "使；进入/奴隶/动词/名词", pos: "n.", zh: "奴役；奴隶制度", gloss: "being enslaved", phrase: ["forced enslavement", "强迫奴役"], example: ["The records describe enslavement as an economic system, not a series of accidents.", "这些记录把奴役描述为一种经济制度，而不是一系列偶发事件。"] },
  { head: "codify", cut: "cod/ify", cutMeaning: "法典；规则/动词", pos: "v.", zh: "编纂；把……编成法典", gloss: "organize into rules", phrase: ["codify customs", "编纂习俗"], example: ["The council tried to codify local customs into written law.", "委员会试图把地方习俗编成成文法。"] },
  { head: "codified", cut: "cod/ifi/ed", cutMeaning: "法典；规则/动词/形容词", pos: "adj.", zh: "成文的；编纂成法的", gloss: "written as rules", phrase: ["codified law", "成文法"], example: ["Codified rules made punishment more predictable.", "成文规则使惩罚更可预测。"] },
  { head: "codification", cut: "cod/ifi/cation", cutMeaning: "法典；规则/动词/名词", pos: "n.", zh: "编纂；法典化", gloss: "rule-making", phrase: ["legal codification", "法律编纂"], example: ["Codification reduced local variation in court decisions.", "法典化减少了法院判决中的地方差异。"] },
  { head: "unrelated", cut: "un/re/lat/ed", cutMeaning: "不；相反/回；再次/携带；关系/形容词", pos: "adj.", zh: "无关的；无亲属关系的", gloss: "not connected", phrase: ["unrelated events", "无关事件"], example: ["Two fires on the same day were unrelated, according to investigators.", "调查人员称，同一天发生的两场火灾并无关联。"] },
  { head: "emitting", cut: "e/mit/ting", cutMeaning: "向外/送出/名词；形容词", pos: "adj./n.", zh: "排放的；发出的", gloss: "sending out", phrase: ["emitting light", "发光"], example: ["The device was emitting a weak signal from under the floor.", "这个设备从地板下发出微弱信号。"] },
  { head: "missionary", cut: "miss/ion/ary", cutMeaning: "送出；派遣/名词/人", pos: "n./adj.", zh: "传教士；传教的", gloss: "religious messenger", phrase: ["missionary work", "传教工作"], example: ["A missionary school introduced new books but also challenged local traditions.", "传教学校引入了新书，也挑战了当地传统。"] },
  { head: "pipeline", cut: "pipe/line", cutMeaning: "管道/线；路线", pos: "n.", zh: "管道；输送线；规划中的项目", gloss: "pipe route, planned flow", phrase: ["oil pipeline", "石油管道"], example: ["The pipeline carried water across dry land to the new farms.", "这条管道把水输送过干旱土地到新农场。"] },
  { head: "possess", cut: "pos/sess", cutMeaning: "放置；拥有/坐；占有", pos: "v.", zh: "拥有；具备", gloss: "own, have", phrase: ["possess evidence", "拥有证据"], example: ["A witness may possess information that changes the whole case.", "证人可能掌握能改变整个案件的信息。"] },
  { head: "possessive", cut: "pos/sess/ive", cutMeaning: "放置；拥有/坐；占有/形容词", pos: "adj./n.", zh: "占有的；所有格的", gloss: "owning, controlling", phrase: ["possessive behaviour", "占有欲行为"], example: ["Possessive language can make a friendship feel like control.", "占有性的语言会让友谊感觉像控制。"] },
  { head: "vertebra", cut: "vert/ebra", cutMeaning: "转/名词", pos: "n.", zh: "椎骨", gloss: "spinal bone", phrase: ["a neck vertebra", "颈椎骨"], example: ["The fossil included one vertebra from a large marine animal.", "这块化石包含一块大型海洋动物的椎骨。"] },
  { head: "vertebrae", cut: "vert/ebrae", cutMeaning: "转/复数", pos: "n.", zh: "椎骨；脊椎骨复数", gloss: "spinal bones", phrase: ["damaged vertebrae", "受损椎骨"], example: ["Several vertebrae showed that the animal had a flexible spine.", "几块椎骨显示这种动物有灵活的脊柱。"] },
  { head: "vertebral", cut: "vert/ebr/al", cutMeaning: "转/名词/形容词", pos: "adj.", zh: "椎骨的；脊椎的", gloss: "spinal", phrase: ["vertebral column", "脊柱"], example: ["The vertebral column protects the spinal cord.", "脊柱保护脊髓。"] },
  { head: "bankrupt", cut: "bank/rupt", cutMeaning: "银行；财务/破裂", pos: "adj./v.", zh: "破产的；使破产", gloss: "financially ruined", phrase: ["go bankrupt", "破产"], example: ["The firm went bankrupt after the contract was cancelled.", "合同取消后，这家公司破产了。"] },
  { head: "bankruptcy", cut: "bank/rupt/cy", cutMeaning: "银行；财务/破裂/名词", pos: "n.", zh: "破产；倒闭", gloss: "financial failure", phrase: ["declare bankruptcy", "宣布破产"], example: ["Bankruptcy forced the factory to sell its machines.", "破产迫使工厂出售机器。"] },
  { head: "centralise", cut: "centr/al/ise", cutMeaning: "中心/形容词/动词", pos: "v.", zh: "集中；使中央集权", gloss: "bring to the centre", phrase: ["centralise authority", "集中权力"], example: ["The new law tried to centralise control of local schools.", "新法律试图集中对地方学校的控制。"] },
  { head: "centralised", cut: "centr/al/is/ed", cutMeaning: "中心/形容词/动词/形容词", pos: "adj.", zh: "集中的；中央集权的", gloss: "centre-controlled", phrase: ["centralised power", "集中的权力"], example: ["A centralised system made decisions faster but ignored local needs.", "集中式系统让决策更快，但忽视了地方需求。"] },
  { head: "centralisation", cut: "centr/al/is/ation", cutMeaning: "中心/形容词/动词/名词", pos: "n.", zh: "集中化；中央集权", gloss: "concentration of control", phrase: ["political centralisation", "政治集中化"], example: ["Centralisation reduced disagreement but made the system less flexible.", "集中化减少了分歧，但使系统不够灵活。"] },
  { head: "diversify", cut: "di/vers/ify", cutMeaning: "离开；分开/转/动词", pos: "v.", zh: "使多样化；多元化", gloss: "make varied", phrase: ["diversify income", "收入多元化"], example: ["Farmers diversified their crops to reduce the risk of disease.", "农民使作物多样化，以降低疾病风险。"] },
  { head: "diversified", cut: "di/vers/ifi/ed", cutMeaning: "离开；分开/转/动词/形容词", pos: "adj.", zh: "多样化的；多元化的", gloss: "varied", phrase: ["a diversified economy", "多元化经济"], example: ["A diversified economy survived the shock better than a single-industry town.", "多元化经济比单一产业城镇更能承受冲击。"] },
  { head: "diversification", cut: "di/vers/ifi/cation", cutMeaning: "离开；分开/转/动词/名词", pos: "n.", zh: "多样化；多元化", gloss: "making varied", phrase: ["economic diversification", "经济多元化"], example: ["Diversification gave the region more than one source of income.", "多元化给这个地区带来了不止一种收入来源。"] },
  { head: "artillery", cut: "art/illery", cutMeaning: "技艺；武器/集合", pos: "n.", zh: "火炮；炮兵", gloss: "large guns", phrase: ["heavy artillery", "重炮"], example: ["Artillery changed the design of city walls in early modern Europe.", "火炮改变了近代早期欧洲城市墙体的设计。"] },
  { head: "aboard", cut: "a/board", cutMeaning: "在；向/船板；甲板", pos: "adv./prep.", zh: "在船上；上车；登上", gloss: "on board", phrase: ["go aboard", "登船"], example: ["The passengers went aboard before the storm reached the harbour.", "风暴到达港口前，乘客登上了船。"] },
  { head: "peasant", cut: "peas/ant", cutMeaning: "乡民；农人/人", pos: "n.", zh: "农民；佃农", gloss: "farm worker", phrase: ["peasant farmers", "农民"], example: ["Peasant families paid rent with grain instead of money.", "农民家庭用粮食而不是金钱支付租金。"] },
  { head: "peasantry", cut: "peas/an/try", cutMeaning: "乡民；农人/名词/群体", pos: "n.", zh: "农民阶层；农民群体", gloss: "peasant class", phrase: ["the rural peasantry", "农村农民阶层"], example: ["The peasantry carried most of the tax burden before the reform.", "改革前，农民阶层承担了大部分税负。"] },
  { head: "protestant", cut: "pro/test/ant", cutMeaning: "向前；公开/作证；抗议/人；形容词", pos: "n./adj.", zh: "新教徒；新教的", gloss: "Protestant Christian", phrase: ["Protestant reformers", "新教改革者"], example: ["Protestant communities built schools to teach reading through scripture.", "新教社群建立学校，通过经文教阅读。"] },
  { head: "protestantism", cut: "pro/test/ant/ism", cutMeaning: "向前；公开/作证；抗议/人；形容词/主义", pos: "n.", zh: "新教；新教教义", gloss: "Protestant faith", phrase: ["the spread of Protestantism", "新教的传播"], example: ["Protestantism changed religious education in many northern cities.", "新教改变了许多北方城市的宗教教育。"] },
  { head: "union", cut: "uni/on", cutMeaning: "一；统一/名词", pos: "n.", zh: "联盟；工会；结合", gloss: "joining, association", phrase: ["trade union", "工会"], example: ["The union negotiated safer hours for factory workers.", "工会为工厂工人争取更安全的工作时间。"] },
  { head: "unionise", cut: "uni/on/ise", cutMeaning: "一；统一/名词/动词", pos: "v.", zh: "组织工会；加入工会", gloss: "form a union", phrase: ["unionise workers", "组织工人成立工会"], example: ["Workers tried to unionise after wages fell for the third year.", "工资连续第三年下降后，工人试图组织工会。"] },
  { head: "ethical", cut: "eth/ic/al", cutMeaning: "习俗；道德/形容词/形容词", pos: "adj.", zh: "伦理的；合乎道德的", gloss: "moral", phrase: ["ethical concerns", "伦理担忧"], example: ["The experiment raised ethical concerns because children could not refuse.", "这项实验引发伦理担忧，因为儿童无法拒绝。"] },
  { head: "ethically", cut: "eth/ic/al/ly", cutMeaning: "习俗；道德/形容词/形容词/副词", pos: "adv.", zh: "合乎伦理地；道德上", gloss: "morally", phrase: ["act ethically", "合乎伦理地行事"], example: ["Researchers must act ethically even when results are valuable.", "即使结果很有价值，研究人员也必须合乎伦理地行事。"] },
  { head: "slave", cut: "slav/e", cutMeaning: "奴隶/词尾", pos: "n.", zh: "奴隶；被迫劳动者", gloss: "enslaved person", phrase: ["slave labour", "奴隶劳动"], example: ["Slave labour supported plantations that exported sugar and cotton.", "奴隶劳动支撑了出口糖和棉花的种植园。"] },
  { head: "slavery", cut: "slav/ery", cutMeaning: "奴隶/制度；状态", pos: "n.", zh: "奴隶制；奴役状态", gloss: "enslavement", phrase: ["abolish slavery", "废除奴隶制"], example: ["The abolition of slavery did not immediately end economic inequality.", "奴隶制的废除并没有立即结束经济不平等。"] },
  { head: "remain", cut: "re/main", cutMeaning: "回；保持/停留", pos: "v.", zh: "保持；留下；仍然是", gloss: "stay, continue", phrase: ["remain silent", "保持沉默"], example: ["The evidence may remain hidden until another witness speaks.", "证据可能会一直隐藏，直到另一名证人开口。"] },
  { head: "remaining", cut: "re/main/ing", cutMeaning: "回；保持/停留/形容词", pos: "adj.", zh: "剩余的；留下的", gloss: "left, still present", phrase: ["the remaining time", "剩余时间"], example: ["The remaining guests waited in the hall after the announcement.", "公告之后，剩下的客人在大厅里等待。"] },
  { head: "remainder", cut: "re/main/der", cutMeaning: "回；保持/停留/名词", pos: "n.", zh: "剩余部分；余数", gloss: "what is left", phrase: ["the remainder of the day", "这一天剩下的时间"], example: ["The remainder of the report explains why the first plan failed.", "报告的其余部分解释了第一个计划为什么失败。"] },
  { head: "pretend", cut: "pre/tend", cutMeaning: "在前；预先/伸展；趋向", pos: "v.", zh: "假装；佯称", gloss: "act falsely", phrase: ["pretend not to know", "假装不知道"], example: ["He tried to pretend that the mistake did not matter.", "他试图假装这个错误无关紧要。"] },
  { head: "pretence", cut: "pre/tence", cutMeaning: "在前；预先/伸展；趋向", pos: "n.", zh: "假装；借口", gloss: "false appearance", phrase: ["under the pretence of work", "以工作为借口"], example: ["The visit was made under the pretence of checking the equipment.", "这次来访是假借检查设备之名进行的。"] },
  { head: "pretension", cut: "pre/tens/ion", cutMeaning: "在前；预先/伸展；趋向/名词", pos: "n.", zh: "自命不凡；声称", gloss: "claim, vanity", phrase: ["intellectual pretension", "知识上的自命不凡"], example: ["Her quiet style had no pretension, so people trusted her advice.", "她的风格安静而不自命不凡，所以人们信任她的建议。"] },
  { head: "pretentious", cut: "pre/tens/ious", cutMeaning: "在前；预先/伸展；趋向/形容词", pos: "adj.", zh: "自命不凡的；炫耀的", gloss: "showy, affected", phrase: ["pretentious language", "装腔作势的语言"], example: ["The speech sounded pretentious because it used grand words for a simple idea.", "这场演讲听起来装腔作势，因为它用宏大的词讲一个简单想法。"] },
  { head: "unpretentious", cut: "un/pre/tens/ious", cutMeaning: "不；相反/在前；预先/伸展；趋向/形容词", pos: "adj.", zh: "谦逊的；不炫耀的", gloss: "modest, simple", phrase: ["an unpretentious style", "朴素的风格"], example: ["The cafe felt unpretentious, with plain tables and honest food.", "这家咖啡馆感觉朴素，没有花哨桌椅，食物也实在。"] },
  { head: "polite", cut: "polit/e", cutMeaning: "城市；礼貌；治理/词尾", pos: "adj.", zh: "礼貌的；客气的", gloss: "civil, courteous", phrase: ["a polite refusal", "礼貌拒绝"], example: ["A polite refusal can protect a boundary without starting an argument.", "礼貌的拒绝可以保护边界，而不引发争吵。"] },
  { head: "politely", cut: "polit/e/ly", cutMeaning: "城市；礼貌；治理/词尾/副词", pos: "adv.", zh: "礼貌地；客气地", gloss: "courteously", phrase: ["answer politely", "礼貌回答"], example: ["She politely asked the reporter to repeat the question.", "她礼貌地请记者重复问题。"] },
  { head: "politeness", cut: "polit/e/ness", cutMeaning: "城市；礼貌；治理/词尾/名词", pos: "n.", zh: "礼貌；客气", gloss: "courtesy", phrase: ["formal politeness", "正式礼貌"], example: ["Politeness kept the meeting calm even when the disagreement was serious.", "即使分歧严重，礼貌也让会议保持平静。"] },
  { head: "impolite", cut: "im/polit/e", cutMeaning: "不；无/城市；礼貌；治理/词尾", pos: "adj.", zh: "不礼貌的；粗鲁的", gloss: "rude", phrase: ["an impolite remark", "粗鲁的话"], example: ["The question sounded impolite because it ignored her earlier answer.", "这个问题听起来不礼貌，因为它无视了她先前的回答。"] },
  { head: "anonymous", cut: "an/onym/ous", cutMeaning: "无；不/名字/形容词", pos: "adj.", zh: "匿名的；无名的", gloss: "unnamed", phrase: ["an anonymous message", "匿名消息"], example: ["An anonymous donor paid for the students' travel costs.", "一位匿名捐赠者支付了学生的旅行费用。"] },
  { head: "anonymity", cut: "an/onym/ity", cutMeaning: "无；不/名字/名词", pos: "n.", zh: "匿名；无名状态", gloss: "namelessness", phrase: ["protect anonymity", "保护匿名性"], example: ["The survey protected anonymity so workers could answer honestly.", "这项调查保护匿名性，使工人能够诚实回答。"] },
  { head: "anonymously", cut: "an/onym/ous/ly", cutMeaning: "无；不/名字/形容词/副词", pos: "adv.", zh: "匿名地", gloss: "without a name", phrase: ["report anonymously", "匿名举报"], example: ["Employees could report safety problems anonymously.", "员工可以匿名报告安全问题。"] },
  { head: "advisory", cut: "ad/vis/ory", cutMeaning: "向；加强/看/形容词", pos: "adj./n.", zh: "咨询的；顾问委员会", gloss: "consultative", phrase: ["an advisory board", "顾问委员会"], example: ["The advisory group warned that the schedule was unrealistic.", "顾问小组警告说这个时间表不现实。"] },
  { head: "misdirection", cut: "mis/direct/ion", cutMeaning: "错误；坏/引导；方向/名词", pos: "n.", zh: "误导；错误指示", gloss: "false direction", phrase: ["deliberate misdirection", "故意误导"], example: ["The magician used misdirection to make the card disappear.", "魔术师用误导让纸牌消失。"] },
  { head: "overqualified", cut: "over/qual/ified", cutMeaning: "过度；超过/资格；性质/形容词", pos: "adj.", zh: "资历过高的；条件过好的", gloss: "too qualified", phrase: ["overqualified for the job", "对这份工作资历过高"], example: ["She seemed overqualified for the assistant position but still wanted the work.", "她对助理职位来说似乎资历过高，但仍想要这份工作。"] },
  { head: "uninterested", cut: "un/inter/est/ed", cutMeaning: "不；相反/在中间/存在；兴趣/形容词", pos: "adj.", zh: "不感兴趣的；冷淡的", gloss: "not interested", phrase: ["look uninterested", "看起来不感兴趣"], example: ["The audience grew uninterested when the speaker repeated the same point.", "演讲者重复同一点时，听众变得不感兴趣。"] },
  { head: "romanticise", cut: "romantic/ise", cutMeaning: "浪漫/动词", pos: "v.", zh: "浪漫化；美化", gloss: "idealise", phrase: ["romanticise poverty", "美化贫困"], example: ["The film romanticises hardship instead of showing its real cost.", "这部电影美化了艰难生活，而没有展示其真实代价。"] },
  { head: "romanticism", cut: "romantic/ism", cutMeaning: "浪漫/主义；状态", pos: "n.", zh: "浪漫主义；浪漫情怀", gloss: "idealism", phrase: ["political romanticism", "政治浪漫主义"], example: ["Romanticism made the old ruins seem noble rather than dangerous.", "浪漫情怀让旧废墟显得高贵，而不是危险。"] },
  { head: "prioritise", cut: "prior/it/ise", cutMeaning: "在前；优先/名词/动词", pos: "v.", zh: "优先处理；确定优先次序", gloss: "rank first", phrase: ["prioritise safety", "优先考虑安全"], example: ["The team had to prioritise safety over speed after the accident.", "事故后，团队必须把安全置于速度之上。"] },
  { head: "prioritisation", cut: "prior/it/is/ation", cutMeaning: "在前；优先/名词/动词/名词", pos: "n.", zh: "优先排序；优先处理", gloss: "ranking by importance", phrase: ["resource prioritisation", "资源优先排序"], example: ["Clear prioritisation helped the nurses decide which patients needed help first.", "明确的优先排序帮助护士决定哪些病人最先需要帮助。"] },
  { head: "stationery", cut: "station/ery", cutMeaning: "站立；固定/物品；集合", pos: "n.", zh: "文具；信纸", gloss: "writing materials", phrase: ["office stationery", "办公文具"], example: ["The desk held only stationery, a lamp, and a sealed envelope.", "桌上只有文具、一盏灯和一个密封信封。"] },
  { head: "stationer", cut: "station/er", cutMeaning: "站立；固定/人", pos: "n.", zh: "文具商；文具店", gloss: "stationery seller", phrase: ["a local stationer", "当地文具商"], example: ["The stationer supplied notebooks to the whole school.", "这家文具店给整所学校供应笔记本。"] },
  { head: "cowardice", cut: "coward/ice", cutMeaning: "胆怯者/名词", pos: "n.", zh: "胆怯；懦弱", gloss: "lack of courage", phrase: ["accuse him of cowardice", "指责他懦弱"], example: ["Leaving the injured worker behind was treated as cowardice, not caution.", "把受伤工人丢下被视为懦弱，而不是谨慎。"] },
  { head: "cowardly", cut: "coward/ly", cutMeaning: "胆怯者/形容词；副词", pos: "adj.", zh: "懦弱的；胆小的", gloss: "fearful, not brave", phrase: ["a cowardly decision", "懦弱的决定"], example: ["The cowardly attack happened after the guards had left.", "这次怯懦的袭击发生在警卫离开之后。"] },
  { head: "fortunate", cut: "fort/unate", cutMeaning: "强；命运/形容词", pos: "adj.", zh: "幸运的；侥幸的", gloss: "lucky", phrase: ["a fortunate accident", "幸运的意外"], example: ["It was fortunate that the warning arrived before the bridge collapsed.", "幸运的是，警告在桥梁倒塌前到达了。"] },
  { head: "fortunately", cut: "fort/unate/ly", cutMeaning: "强；命运/形容词/副词", pos: "adv.", zh: "幸运地；幸好", gloss: "luckily", phrase: ["fortunately for everyone", "对所有人来说幸好"], example: ["Fortunately, the archive had copied the records before the fire.", "幸好，档案馆在火灾前复制了这些记录。"] },
  { head: "unfortunate", cut: "un/fort/unate", cutMeaning: "不；相反/强；命运/形容词", pos: "adj.", zh: "不幸的；遗憾的", gloss: "unlucky, regrettable", phrase: ["an unfortunate delay", "遗憾的延误"], example: ["An unfortunate delay left the travellers without shelter after dark.", "一次不幸的延误让旅行者天黑后没有住所。"] },
  { head: "important", cut: "im/port/ant", cutMeaning: "进入；加强/携带；价值/形容词", pos: "adj.", zh: "重要的；有影响的", gloss: "significant", phrase: ["an important detail", "重要细节"], example: ["One important detail changed the meaning of the whole letter.", "一个重要细节改变了整封信的含义。"] },
  { head: "importance", cut: "im/port/ance", cutMeaning: "进入；加强/携带；价值/名词", pos: "n.", zh: "重要性；意义", gloss: "significance", phrase: ["historical importance", "历史重要性"], example: ["The importance of clean water becomes clear during a drought.", "干旱期间，清洁水的重要性会变得清楚。"] },
  { head: "pleasant", cut: "pleas/ant", cutMeaning: "使高兴/形容词", pos: "adj.", zh: "令人愉快的；友好的", gloss: "enjoyable, agreeable", phrase: ["a pleasant surprise", "令人愉快的惊喜"], example: ["A pleasant conversation made the long wait easier.", "一次愉快的谈话让漫长等待变得容易些。"] },
  { head: "unpleasant", cut: "un/pleas/ant", cutMeaning: "不；相反/使高兴/形容词", pos: "adj.", zh: "不愉快的；讨厌的", gloss: "disagreeable", phrase: ["an unpleasant smell", "难闻气味"], example: ["The unpleasant smell warned workers that gas might be leaking.", "难闻气味警告工人可能有气体泄漏。"] },
  { head: "sacrifice", cut: "sacr/ifice", cutMeaning: "神圣/做；行为", pos: "n./v.", zh: "牺牲；献祭", gloss: "give up, offering", phrase: ["make a sacrifice", "作出牺牲"], example: ["The family made a sacrifice so the youngest child could continue school.", "这个家庭作出牺牲，让最小的孩子能够继续上学。"] },
  { head: "sacrificial", cut: "sacr/ific/ial", cutMeaning: "神圣/做；行为/形容词", pos: "adj.", zh: "牺牲的；献祭的", gloss: "offering-related", phrase: ["a sacrificial animal", "献祭动物"], example: ["The archaeologists found sacrificial objects near the temple entrance.", "考古学家在寺庙入口附近发现了献祭物品。"] },
  { head: "inhale", cut: "in/hal/e", cutMeaning: "进入；向内/呼吸/动词", pos: "v.", zh: "吸入；吸气", gloss: "breathe in", phrase: ["inhale smoke", "吸入烟雾"], example: ["Workers wore masks so they would not inhale toxic dust.", "工人戴着口罩，以免吸入有毒粉尘。"] },
  { head: "inhalation", cut: "in/hal/ation", cutMeaning: "进入；向内/呼吸/名词", pos: "n.", zh: "吸入；吸气", gloss: "breathing in", phrase: ["smoke inhalation", "吸入烟雾"], example: ["Smoke inhalation can damage the lungs even without burns.", "即使没有烧伤，吸入烟雾也会损伤肺部。"] },
  { head: "insufferable", cut: "in/suffer/able", cutMeaning: "不；无/忍受；遭受/形容词", pos: "adj.", zh: "难以忍受的；令人厌烦的", gloss: "unbearable", phrase: ["insufferable arrogance", "令人难以忍受的傲慢"], example: ["His insufferable confidence made the committee less willing to trust him.", "他令人难以忍受的自信使委员会更不愿信任他。"] },
  { head: "stabilise", cut: "sta/bil/ise", cutMeaning: "站立；稳定/强；能够/动词", pos: "v.", zh: "使稳定；稳定下来", gloss: "make stable", phrase: ["stabilise prices", "稳定价格"], example: ["Emergency loans helped stabilise the small banks after the crisis.", "紧急贷款帮助小银行在危机后稳定下来。"] },
  { head: "stabilised", cut: "sta/bil/is/ed", cutMeaning: "站立；稳定/强；能够/动词/形容词", pos: "adj.", zh: "稳定的；已稳定的", gloss: "made stable", phrase: ["a stabilised patient", "病情稳定的病人"], example: ["The patient was stabilised before being moved to another hospital.", "病人在转到另一家医院前已稳定下来。"] },
  { head: "stabilisation", cut: "sta/bil/is/ation", cutMeaning: "站立；稳定/强；能够/动词/名词", pos: "n.", zh: "稳定；稳定化", gloss: "making stable", phrase: ["economic stabilisation", "经济稳定化"], example: ["Currency stabilisation reduced panic in the market.", "货币稳定化减少了市场恐慌。"] },
  { head: "withhold", cut: "with/hold", cutMeaning: "向后；离开/握住；保留", pos: "v.", zh: "拒绝给予；扣留；隐瞒", gloss: "keep back", phrase: ["withhold information", "隐瞒信息"], example: ["The witness chose to withhold one detail until a lawyer arrived.", "证人选择隐瞒一个细节，直到律师到场。"] },
  { head: "withholding", cut: "with/hold/ing", cutMeaning: "向后；离开/握住；保留/名词", pos: "n./adj.", zh: "扣留；隐瞒的", gloss: "keeping back", phrase: ["withholding evidence", "隐瞒证据"], example: ["Withholding evidence made the investigation slower and less fair.", "隐瞒证据使调查更慢，也更不公正。"] },
  { head: "laminate", cut: "lamin/ate", cutMeaning: "薄片；层/动词", pos: "v./n.", zh: "覆膜；层压；层压材料", gloss: "cover with layers", phrase: ["laminate a card", "给卡片覆膜"], example: ["The school laminated the maps so students could use them outdoors.", "学校给地图覆膜，以便学生在户外使用。"] },
  { head: "laminated", cut: "lamin/at/ed", cutMeaning: "薄片；层/动词/形容词", pos: "adj.", zh: "覆膜的；层压的", gloss: "covered in layers", phrase: ["a laminated notice", "覆膜告示"], example: ["A laminated notice stayed readable after the rain.", "一张覆膜告示在雨后仍然可读。"] },
  { head: "lamination", cut: "lamin/ation", cutMeaning: "薄片；层/名词", pos: "n.", zh: "覆膜；层压", gloss: "layering process", phrase: ["plastic lamination", "塑料覆膜"], example: ["Lamination protected the old certificate from moisture.", "覆膜保护旧证书免受潮气影响。"] },
  { head: "mutter", cut: "mutt/er", cutMeaning: "低声；含糊/动词", pos: "v.", zh: "低声抱怨；咕哝", gloss: "speak quietly", phrase: ["mutter under his breath", "小声咕哝"], example: ["He began to mutter when the rules changed again.", "规则再次改变时，他开始小声抱怨。"] },
  { head: "muttering", cut: "mutt/er/ing", cutMeaning: "低声；含糊/动词/名词", pos: "n./adj.", zh: "咕哝；低声抱怨", gloss: "quiet complaint", phrase: ["angry muttering", "愤怒的咕哝"], example: ["The muttering stopped when the director entered the room.", "主任走进房间时，咕哝声停止了。"] },
  { head: "transferable", cut: "trans/fer/able", cutMeaning: "穿过；转移/携带；带来/形容词", pos: "adj.", zh: "可转移的；可转让的", gloss: "able to be moved", phrase: ["transferable skills", "可迁移技能"], example: ["Writing clear reports is a transferable skill in many jobs.", "写清楚报告是许多工作中可迁移的技能。"] },
  { head: "transference", cut: "trans/fer/ence", cutMeaning: "穿过；转移/携带；带来/名词", pos: "n.", zh: "转移；转让；移情", gloss: "transfer, displacement", phrase: ["emotional transference", "情感移情"], example: ["The therapist noticed transference when the patient reacted as if he were her father.", "当病人的反应仿佛治疗师是她父亲时，治疗师注意到了移情。"] },
  { head: "transferred", cut: "trans/fer/red", cutMeaning: "穿过；转移/携带；带来/形容词", pos: "adj.", zh: "转移的；调任的", gloss: "moved", phrase: ["transferred records", "转移的记录"], example: ["The transferred files arrived without the original labels.", "转移过来的文件没有原始标签。"] },
  { head: "welcoming", cut: "welcom/ing", cutMeaning: "欢迎/形容词", pos: "adj.", zh: "热情的；欢迎的", gloss: "friendly, inviting", phrase: ["a welcoming smile", "热情的微笑"], example: ["A welcoming entrance made the clinic less frightening to new patients.", "热情的入口让新病人觉得诊所没那么可怕。"] },
  { head: "unwelcome", cut: "un/welcome", cutMeaning: "不；相反/欢迎", pos: "adj.", zh: "不受欢迎的；讨厌的", gloss: "not wanted", phrase: ["unwelcome attention", "不受欢迎的关注"], example: ["The report brought unwelcome attention to the school's finances.", "这份报告让学校财务受到不受欢迎的关注。"] },
  { head: "blessing", cut: "bless/ing", cutMeaning: "祝福/名词", pos: "n.", zh: "祝福；幸事；许可", gloss: "approval, benefit", phrase: ["a mixed blessing", "喜忧参半的事"], example: ["The new road was a blessing for trade but a problem for quiet villages.", "新道路对贸易是幸事，但对安静村庄是个问题。"] },
  { head: "fallback", cut: "fall/back", cutMeaning: "落下；退回/后方", pos: "n./adj.", zh: "备用方案；后备的", gloss: "backup option", phrase: ["a fallback plan", "备用计划"], example: ["The team kept a fallback plan in case the main server failed.", "团队保留了备用方案，以防主服务器故障。"] },
  { head: "handover", cut: "hand/over", cutMeaning: "手；交给/越过；转交", pos: "n.", zh: "移交；交接", gloss: "transfer of control", phrase: ["a smooth handover", "顺利交接"], example: ["A careful handover prevented the night staff from missing important details.", "仔细交接防止夜班人员漏掉重要细节。"] },
  { head: "mismatch", cut: "mis/match", cutMeaning: "错误；坏/匹配", pos: "n./v.", zh: "不匹配；错配", gloss: "poor fit", phrase: ["a mismatch between skills and tasks", "技能与任务不匹配"], example: ["The mismatch between the map and the road signs confused visitors.", "地图和路牌之间的不匹配让游客困惑。"] },
  { head: "mismatched", cut: "mis/match/ed", cutMeaning: "错误；坏/匹配/形容词", pos: "adj.", zh: "不匹配的；错配的", gloss: "poorly matched", phrase: ["mismatched data", "不匹配的数据"], example: ["Mismatched records made the audit take longer than expected.", "不匹配的记录使审计耗时超过预期。"] },
  { head: "unassigned", cut: "un/as/sign/ed", cutMeaning: "不；相反/向；加强/标记；签署/形容词", pos: "adj.", zh: "未分配的；未指派的", gloss: "not allocated", phrase: ["unassigned seats", "未分配座位"], example: ["Several unassigned tasks remained after the meeting ended.", "会议结束后仍有几项未分配任务。"] },
  { head: "liaison", cut: "liaison", cutMeaning: "联络；连接", pos: "n.", zh: "联络；联络人；合作关系", gloss: "contact, coordination", phrase: ["serve as a liaison", "担任联络人"], example: ["She acted as a liaison between the clinic and the school.", "她在诊所和学校之间担任联络人。"] },
  { head: "unchanged", cut: "un/chang/ed", cutMeaning: "不；相反/改变/形容词", pos: "adj.", zh: "未改变的；照旧的", gloss: "not changed", phrase: ["remain unchanged", "保持不变"], example: ["The rule remained unchanged even after several complaints.", "即使有几次投诉，这条规则仍未改变。"] },
  { head: "unmanaged", cut: "un/man/ag/ed", cutMeaning: "不；相反/手；处理/做；驱动/形容词", pos: "adj.", zh: "无人管理的；未受控制的", gloss: "not managed", phrase: ["unmanaged growth", "失控增长"], example: ["Unmanaged growth damaged the wetland around the town.", "无人管理的增长破坏了城镇周围的湿地。"] },
  { head: "misfile", cut: "mis/file", cutMeaning: "错误；坏/归档；文件", pos: "v.", zh: "错放档案；误归档", gloss: "file wrongly", phrase: ["misfile a document", "错放文件"], example: ["A clerk can misfile a document and hide important evidence for years.", "职员可能错放文件，使重要证据隐藏多年。"] },
  { head: "misfiled", cut: "mis/file/d", cutMeaning: "错误；坏/归档；文件/形容词", pos: "adj.", zh: "误归档的；错放的", gloss: "filed wrongly", phrase: ["a misfiled record", "误归档记录"], example: ["The misfiled record explained why no one had answered the complaint.", "这份误归档记录解释了为什么没人回应投诉。"] },
  { head: "unhedged", cut: "un/hedg/ed", cutMeaning: "不；相反/围住；限制；对冲/形容词", pos: "adj.", zh: "未对冲的；毫不含糊的", gloss: "unprotected, direct", phrase: ["an unhedged statement", "毫不含糊的声明"], example: ["The investor left the currency risk unhedged and lost money when rates changed.", "投资者没有对冲汇率风险，汇率变化时亏了钱。"] },
  { head: "irritate", cut: "ir/rit/ate", cutMeaning: "进入；加强/摩擦；刺激/动词", pos: "v.", zh: "刺激；惹恼", gloss: "annoy, inflame", phrase: ["irritate the skin", "刺激皮肤"], example: ["Dust from the old carpet can irritate the eyes.", "旧地毯上的灰尘会刺激眼睛。"] },
  { head: "irritating", cut: "ir/rit/at/ing", cutMeaning: "进入；加强/摩擦；刺激/动词/形容词", pos: "adj.", zh: "令人恼火的；刺激性的", gloss: "annoying", phrase: ["an irritating sound", "令人恼火的声音"], example: ["The repeating alarm became irritating after only a few minutes.", "重复响起的警报只过了几分钟就变得令人恼火。"] },
  { head: "irritation", cut: "ir/rit/ation", cutMeaning: "进入；加强/摩擦；刺激/名词", pos: "n.", zh: "刺激；恼怒", gloss: "annoyance, inflammation", phrase: ["skin irritation", "皮肤刺激"], example: ["The chemical caused irritation but no permanent damage.", "这种化学物质造成刺激，但没有永久损伤。"] },
  { head: "tailor", cut: "tail/or", cutMeaning: "剪裁；制作/人", pos: "n./v.", zh: "裁缝；定制；调整", gloss: "customize, clothes maker", phrase: ["tailor advice", "调整建议"], example: ["Good teachers tailor examples to the students' level.", "好老师会根据学生水平调整例子。"] },
  { head: "tailoring", cut: "tail/or/ing", cutMeaning: "剪裁；制作/人/名词", pos: "n.", zh: "裁剪；定制调整", gloss: "customization", phrase: ["careful tailoring", "细致剪裁"], example: ["Careful tailoring made the uniform look formal without being stiff.", "细致剪裁让制服显得正式而不僵硬。"] },
  { head: "allow", cut: "al/low", cutMeaning: "向；加强/放置；许可", pos: "v.", zh: "允许；使可能", gloss: "permit, enable", phrase: ["allow access", "允许进入"], example: ["The pass allowed students to enter the archive after class.", "这张通行证允许学生课后进入档案室。"] },
  { head: "allowance", cut: "al/low/ance", cutMeaning: "向；加强/放置；许可/名词", pos: "n.", zh: "津贴；限额；允许量", gloss: "permitted amount", phrase: ["a travel allowance", "旅行津贴"], example: ["The travel allowance covered trains but not hotels.", "旅行津贴覆盖火车费用，但不包括酒店。"] },
  { head: "allowable", cut: "al/low/able", cutMeaning: "向；加强/放置；许可/形容词", pos: "adj.", zh: "可允许的；准许的", gloss: "permitted", phrase: ["allowable expenses", "可报销费用"], example: ["Only allowable expenses were paid from the project budget.", "只有可允许的费用从项目预算中支付。"] },
  { head: "components", cut: "com/pon/ent/s", cutMeaning: "共同；一起/放置/形容词；名词/复数", pos: "n.", zh: "组成部分；部件", gloss: "parts", phrase: ["key components", "关键组成部分"] },
  { head: "componential", cut: "com/pon/ent/ial", cutMeaning: "共同；一起/放置/形容词；名词/形容词", pos: "adj.", zh: "成分的；组成的", gloss: "component-based", phrase: ["componential analysis", "成分分析"] },
  { head: "conscientious", cut: "con/sci/ent/ious", cutMeaning: "共同；完全/知道/形容词；名词/形容词", pos: "adj.", zh: "认真的；尽责的", gloss: "careful, responsible", phrase: ["a conscientious worker", "认真负责的员工"] },
  { head: "conscientiously", cut: "con/sci/ent/ious/ly", cutMeaning: "共同；完全/知道/形容词；名词/形容词/副词", pos: "adv.", zh: "认真地；尽责地", gloss: "carefully, responsibly", phrase: ["work conscientiously", "认真工作"] },
  { head: "conscientiousness", cut: "con/sci/ent/ious/ness", cutMeaning: "共同；完全/知道/形容词；名词/形容词/名词", pos: "n.", zh: "认真；责任心", gloss: "carefulness", phrase: ["measure conscientiousness", "测量责任心"] },
  { head: "consensual", cut: "con/sens/ual", cutMeaning: "共同；完全/感觉；同意/形容词", pos: "adj.", zh: "双方同意的；共识的", gloss: "agreed", phrase: ["a consensual decision", "一致同意的决定"] },
  { head: "consensus", cut: "con/sens/us", cutMeaning: "共同；完全/感觉；同意/名词", pos: "n.", zh: "共识；一致意见", gloss: "agreement", phrase: ["reach consensus", "达成共识"] },
  { head: "contingency", cut: "con/ting/ency", cutMeaning: "共同；完全/接触；发生/名词", pos: "n.", zh: "偶发事件；应急情况", gloss: "possibility, emergency", phrase: ["a contingency plan", "应急计划"] },
  { head: "contingently", cut: "con/ting/ent/ly", cutMeaning: "共同；完全/接触；发生/形容词；名词/副词", pos: "adv.", zh: "视情况而定地", gloss: "conditionally", phrase: ["depend contingently on context", "根据语境有条件地取决于"] },
  { head: "convenience", cut: "con/ven/ience", cutMeaning: "共同；完全/来/名词", pos: "n.", zh: "便利；方便", gloss: "ease, usefulness", phrase: ["for convenience", "为了方便"] },
  { head: "inconvenience", cut: "in/con/ven/ience", cutMeaning: "不；无/共同；完全/来/名词", pos: "n./v.", zh: "不便；使不便", gloss: "trouble, bother", phrase: ["cause inconvenience", "造成不便"] },
  { head: "inconvenient", cut: "in/con/ven/ient", cutMeaning: "不；无/共同；完全/来/形容词", pos: "adj.", zh: "不方便的", gloss: "troublesome", phrase: ["an inconvenient time", "不方便的时间"] },
  { head: "inconveniently", cut: "in/con/ven/ient/ly", cutMeaning: "不；无/共同；完全/来/形容词/副词", pos: "adv.", zh: "不方便地", gloss: "awkwardly", phrase: ["inconveniently located", "位置不方便"] },
  { head: "desperation", cut: "de/sper/ation", cutMeaning: "离开；向下/希望/名词", pos: "n.", zh: "绝望；不顾一切", gloss: "hopelessness", phrase: ["act out of desperation", "出于绝望而行动"] },
  { head: "desperately", cut: "de/sper/ate/ly", cutMeaning: "离开；向下/希望/形容词/副词", pos: "adv.", zh: "绝望地；非常", gloss: "urgently, hopelessly", phrase: ["desperately need help", "急需帮助"] },
  { head: "detergency", cut: "de/terg/ency", cutMeaning: "离开；去除/擦；清洁/名词", pos: "n.", zh: "去污力；清洁性", gloss: "cleaning power", phrase: ["test detergency", "测试去污力"] },
  { head: "implantation", cut: "im/plant/ation", cutMeaning: "进入；使/种植；植入/名词", pos: "n.", zh: "植入；移植", gloss: "insertion", phrase: ["medical implantation", "医学植入"] },
  { head: "implanted", cut: "im/plant/ed", cutMeaning: "进入；使/种植；植入/形容词", pos: "adj.", zh: "植入的；深植的", gloss: "inserted", phrase: ["an implanted device", "植入设备"] },
  { head: "capability", cut: "cap/ability", cutMeaning: "抓住；取得/能力", pos: "n.", zh: "能力；性能", gloss: "ability, capacity", phrase: ["technical capability", "技术能力"] },
  { head: "innocently", cut: "in/noc/ent/ly", cutMeaning: "不；无/伤害/形容词；名词/副词", pos: "adv.", zh: "无辜地；天真地", gloss: "harmlessly, naively", phrase: ["smile innocently", "天真地微笑"] },
  { head: "invite", cut: "in/vit/e", cutMeaning: "进入；向内/召唤；邀请/动词", pos: "v.", zh: "邀请；招致", gloss: "ask, attract", phrase: ["invite criticism", "招致批评"] },
  { head: "inviting", cut: "in/vit/ing", cutMeaning: "进入；向内/召唤；邀请/形容词", pos: "adj.", zh: "吸引人的；诱人的", gloss: "attractive", phrase: ["an inviting room", "令人想进去的房间"] },
  { head: "inwardly", cut: "in/ward/ly", cutMeaning: "向内/方向/副词", pos: "adv.", zh: "内心里；向内地", gloss: "privately, inside", phrase: ["smile inwardly", "暗自微笑"] },
  { head: "inwards", cut: "in/ward/s", cutMeaning: "向内/方向/副词", pos: "adv.", zh: "向内", gloss: "toward the inside", phrase: ["turn inwards", "向内转"] },
  { head: "peripherally", cut: "peri/pher/al/ly", cutMeaning: "周围/携带；边缘/形容词/副词", pos: "adv.", zh: "外围地；次要地", gloss: "marginally", phrase: ["only peripherally involved", "只是外围参与"] },
  { head: "permit", cut: "per/mit", cutMeaning: "通过；完全/送；放出", pos: "v./n.", zh: "允许；许可证", gloss: "allow, license", phrase: ["permit access", "允许进入"] },
  { head: "permissive", cut: "per/miss/ive", cutMeaning: "通过；完全/送；放出/形容词", pos: "adj.", zh: "宽容的；放任的", gloss: "tolerant, lax", phrase: ["a permissive rule", "宽松的规则"] },
  { head: "pregnancy", cut: "pre/gn/ancy", cutMeaning: "在前；预先/产生；出生/名词", pos: "n.", zh: "怀孕；孕期", gloss: "gestation", phrase: ["during pregnancy", "怀孕期间"] },
  { head: "protection", cut: "pro/tect/ion", cutMeaning: "向前；为了/遮盖；保护/名词", pos: "n.", zh: "保护；防护", gloss: "defence, safety", phrase: ["legal protection", "法律保护"] },
  { head: "realism", cut: "real/ism", cutMeaning: "真实/主义；状态", pos: "n.", zh: "现实主义；务实态度", gloss: "practicality", phrase: ["political realism", "政治现实主义"] },
  { head: "realist", cut: "real/ist", cutMeaning: "真实/人", pos: "n.", zh: "现实主义者；务实的人", gloss: "practical person", phrase: ["a cautious realist", "谨慎的现实主义者"] },
  { head: "realistically", cut: "real/istic/al/ly", cutMeaning: "真实/形容词/形容词/副词", pos: "adv.", zh: "现实地；实际地", gloss: "practically", phrase: ["think realistically", "现实地思考"] },
  { head: "recklessness", cut: "reck/less/ness", cutMeaning: "顾虑；注意/无/名词", pos: "n.", zh: "鲁莽；不顾后果", gloss: "carelessness", phrase: ["dangerous recklessness", "危险的鲁莽"] },
  { head: "recklessly", cut: "reck/less/ly", cutMeaning: "顾虑；注意/无/副词", pos: "adv.", zh: "鲁莽地", gloss: "carelessly", phrase: ["drive recklessly", "鲁莽驾驶"] },
  { head: "repetitive", cut: "re/pet/itive", cutMeaning: "反复/追求；寻找/形容词", pos: "adj.", zh: "重复的；反复的", gloss: "repeated", phrase: ["repetitive work", "重复性工作"] },
  { head: "repetition", cut: "re/pet/ition", cutMeaning: "反复/追求；寻找/名词", pos: "n.", zh: "重复；反复", gloss: "repeat", phrase: ["avoid repetition", "避免重复"] },
  { head: "reputable", cut: "re/put/able", cutMeaning: "反复；回/认为；评价/形容词", pos: "adj.", zh: "声誉好的；可靠的", gloss: "respected", phrase: ["a reputable source", "可靠来源"] },
  { head: "disreputable", cut: "dis/re/put/able", cutMeaning: "不；相反/反复；回/认为；评价/形容词", pos: "adj.", zh: "声名狼藉的", gloss: "dishonest, shameful", phrase: ["a disreputable company", "声誉很差的公司"] },
  { head: "bearable", cut: "bear/able", cutMeaning: "承受/形容词", pos: "adj.", zh: "可忍受的", gloss: "tolerable", phrase: ["make pain bearable", "让疼痛可忍受"] },
  { head: "bear", cut: "bear", cutMeaning: "承受；携带", pos: "v.", zh: "忍受；承担；承载", gloss: "endure, carry", phrase: ["bear responsibility", "承担责任"] },
  { head: "forgivable", cut: "for/giv/able", cutMeaning: "完全；离开/给予/形容词", pos: "adj.", zh: "可原谅的", gloss: "excusable", phrase: ["a forgivable mistake", "可原谅的错误"] },
  { head: "able", cut: "able", cutMeaning: "有能力", pos: "adj.", zh: "有能力的；能够的", gloss: "capable", phrase: ["be able to respond", "能够回应"] },
  { head: "unable", cut: "un/able", cutMeaning: "不；相反/有能力", pos: "adj.", zh: "不能的；无能力的", gloss: "not capable", phrase: ["unable to continue", "无法继续"] },
  { head: "annually", cut: "ann/ual/ly", cutMeaning: "年/形容词/副词", pos: "adv.", zh: "每年；一年一次地", gloss: "yearly", phrase: ["review annually", "每年审查"] },
  { head: "apologetic", cut: "apo/log/etic", cutMeaning: "离开/说；言语/形容词", pos: "adj.", zh: "道歉的；愧疚的", gloss: "sorry", phrase: ["an apologetic tone", "歉疚的语气"] },
  { head: "appealing", cut: "ap/peal/ing", cutMeaning: "向；加强/呼吁；吸引/形容词", pos: "adj.", zh: "有吸引力的", gloss: "attractive", phrase: ["an appealing idea", "有吸引力的想法"] },
  { head: "unappealing", cut: "un/ap/peal/ing", cutMeaning: "不；相反/向；加强/呼吁；吸引/形容词", pos: "adj.", zh: "无吸引力的", gloss: "unattractive", phrase: ["an unappealing choice", "没有吸引力的选择"] },
  { head: "applicant", cut: "ap/plic/ant", cutMeaning: "向；加强/折叠；请求/人", pos: "n.", zh: "申请人", gloss: "candidate", phrase: ["a strong applicant", "强有力的申请人"] },
  { head: "assistant", cut: "as/sist/ant", cutMeaning: "向；加强/站立；帮助/人", pos: "n./adj.", zh: "助手；助理的", gloss: "helper", phrase: ["research assistant", "研究助理"] },
  { head: "auctioneer", cut: "auction/eer", cutMeaning: "拍卖/人", pos: "n.", zh: "拍卖师", gloss: "seller", phrase: ["a professional auctioneer", "专业拍卖师"] },
  { head: "auditorium", cut: "audi/tor/ium", cutMeaning: "听/人；工具/场所", pos: "n.", zh: "礼堂；观众席", gloss: "hall", phrase: ["a crowded auditorium", "拥挤的礼堂"] },
  { head: "auditory", cut: "audi/tory", cutMeaning: "听/形容词", pos: "adj.", zh: "听觉的", gloss: "hearing-related", phrase: ["auditory signals", "听觉信号"] },
  { head: "balanced", cut: "balanc/ed", cutMeaning: "平衡/形容词", pos: "adj.", zh: "平衡的；均衡的", gloss: "even, fair", phrase: ["a balanced diet", "均衡饮食"] },
  { head: "imbalance", cut: "im/balance", cutMeaning: "不；无/平衡", pos: "n.", zh: "不平衡；失衡", gloss: "lack of balance", phrase: ["a power imbalance", "权力失衡"] },
  { head: "brutality", cut: "brut/al/ity", cutMeaning: "沉重；野蛮/形容词/名词", pos: "n.", zh: "残暴；野蛮行为", gloss: "cruelty", phrase: ["police brutality", "警察暴力"] },
  { head: "brutally", cut: "brut/al/ly", cutMeaning: "沉重；野蛮/形容词/副词", pos: "adv.", zh: "残酷地；野蛮地", gloss: "cruelly", phrase: ["brutally honest", "直白得近乎残酷"] },
  { head: "candidacy", cut: "candid/acy", cutMeaning: "洁白；坦白；候选/名词", pos: "n.", zh: "候选资格；候选身份", gloss: "candidate status", phrase: ["announce her candidacy", "宣布她的候选身份"] },
  { head: "corrective", cut: "cor/rect/ive", cutMeaning: "共同；完全/直；正/形容词", pos: "adj./n.", zh: "纠正的；矫正物", gloss: "remedial", phrase: ["corrective action", "纠正措施"] },
  { head: "incorrect", cut: "in/cor/rect", cutMeaning: "不；无/共同；完全/直；正", pos: "adj.", zh: "错误的；不正确的", gloss: "wrong", phrase: ["an incorrect answer", "错误答案"] },
  { head: "entertaining", cut: "enter/tain/ing", cutMeaning: "进入/保持；握住/形容词", pos: "adj.", zh: "有趣的；娱乐性的", gloss: "amusing", phrase: ["an entertaining story", "有趣的故事"] },
  { head: "equip", cut: "e/quip", cutMeaning: "向外/准备；装备", pos: "v.", zh: "装备；配备；使有能力", gloss: "provide, prepare", phrase: ["equip students with skills", "让学生具备技能"] },
  { head: "equipped", cut: "e/quip/ped", cutMeaning: "向外/准备；装备/形容词", pos: "adj.", zh: "配备好的；有能力的", gloss: "prepared", phrase: ["well equipped", "装备良好"] },
  { head: "explanatory", cut: "ex/plan/atory", cutMeaning: "向外/清楚；平面/形容词", pos: "adj.", zh: "解释性的；说明性的", gloss: "clarifying", phrase: ["an explanatory note", "说明性注释"] },
  { head: "experienced", cut: "ex/peri/ence/d", cutMeaning: "向外/尝试；经历/名词/形容词", pos: "adj.", zh: "有经验的", gloss: "skilled", phrase: ["an experienced teacher", "有经验的老师"] },
  { head: "inexperienced", cut: "in/ex/peri/ence/d", cutMeaning: "不；无/向外/尝试；经历/名词/形容词", pos: "adj.", zh: "缺乏经验的", gloss: "unskilled", phrase: ["an inexperienced driver", "缺乏经验的司机"] },
  { head: "known", cut: "know/n", cutMeaning: "知道/形容词", pos: "adj.", zh: "已知的；知名的", gloss: "recognized", phrase: ["a known risk", "已知风险"] },
  { head: "tolerance", cut: "toler/ance", cutMeaning: "忍受/名词", pos: "n.", zh: "容忍；耐受性", gloss: "acceptance, endurance", phrase: ["low tolerance for noise", "对噪音耐受度低"] },
  { head: "intolerable", cut: "in/toler/able", cutMeaning: "不；无/忍受/形容词", pos: "adj.", zh: "无法忍受的", gloss: "unbearable", phrase: ["intolerable pressure", "无法忍受的压力"] },
  { head: "sentential", cut: "sent/ent/ial", cutMeaning: "感觉；判断/形容词；名词/形容词", pos: "adj.", zh: "句子的；句子层面的", gloss: "sentence-level", phrase: ["sentential meaning", "句子层面的意义"] },
  { head: "societal", cut: "soc/iet/al", cutMeaning: "同伴；社会/名词/形容词", pos: "adj.", zh: "社会的", gloss: "social", phrase: ["societal pressure", "社会压力"] },
  { head: "delayed", cut: "de/lay/ed", cutMeaning: "离开；向下/放置；延迟/形容词", pos: "adj.", zh: "延迟的；推迟的", gloss: "late, postponed", phrase: ["a delayed response", "延迟的回应"] },
  { head: "delaying", cut: "de/lay/ing", cutMeaning: "离开；向下/放置；延迟/名词；形容词", pos: "n./adj.", zh: "延迟；拖延的", gloss: "postponing", phrase: ["delaying tactics", "拖延策略"] },
  { head: "deadlines", cut: "dead/line/s", cutMeaning: "死；固定/线；期限/复数", pos: "n.", zh: "截止日期", gloss: "due dates", phrase: ["strict deadlines", "严格的截止日期"] },
  { head: "vocally", cut: "voc/al/ly", cutMeaning: "声音；呼唤/形容词/副词", pos: "adv.", zh: "用声音地；公开表达地", gloss: "openly, aloud", phrase: ["object vocally", "公开表达反对"] },
  { head: "remedial", cut: "remed/ial", cutMeaning: "治疗；补救/形容词", pos: "adj.", zh: "补救的；矫正的", gloss: "corrective", phrase: ["remedial action", "补救措施"] },
  { head: "remediate", cut: "remed/iate", cutMeaning: "治疗；补救/动词", pos: "v.", zh: "补救；修复", gloss: "correct, repair", phrase: ["remediate damage", "修复损害"] },
  { head: "savings", cut: "sav/ing/s", cutMeaning: "保存；节省/名词/复数", pos: "n.", zh: "储蓄；节省额", gloss: "money saved", phrase: ["personal savings", "个人储蓄"] },
  { head: "stacked", cut: "stack/ed", cutMeaning: "堆叠/形容词", pos: "adj.", zh: "堆叠的；排满的", gloss: "piled", phrase: ["stacked boxes", "堆叠的箱子"] },
  { head: "calmness", cut: "calm/ness", cutMeaning: "平静/名词", pos: "n.", zh: "平静；镇定", gloss: "peace, composure", phrase: ["recover calmness", "恢复镇定"] },
  { head: "give", cut: "give", cutMeaning: "给予", pos: "v.", zh: "给；给予；产生", gloss: "provide, offer", phrase: ["give permission", "给予许可"] },
  { head: "enter", cut: "enter", cutMeaning: "进入", pos: "v.", zh: "进入；加入；登记", gloss: "go in, join", phrase: ["enter a room", "进入房间"] },
  { head: "restaurateur", cut: "restaurant/eur", cutMeaning: "餐馆/人", pos: "n.", zh: "餐馆老板；餐饮业者", gloss: "restaurant owner", phrase: ["a local restaurateur", "当地餐馆老板"] },
  { head: "analyse", cut: "ana/lys/e", cutMeaning: "分开；向上/松开；分解/动词", pos: "v.", zh: "分析；解析", gloss: "examine", phrase: ["analyse evidence", "分析证据"] },
  { head: "faculties", cut: "fac/ulty/ies", cutMeaning: "做；能力/名词/复数", pos: "n.", zh: "能力；院系", gloss: "abilities, departments", phrase: ["mental faculties", "心智能力"] },
  { head: "reader", cut: "read/er", cutMeaning: "阅读/人", pos: "n.", zh: "读者；阅读器", gloss: "person who reads", phrase: ["an attentive reader", "专注的读者"] },
  { head: "wetness", cut: "wet/ness", cutMeaning: "潮湿/名词", pos: "n.", zh: "潮湿；湿润", gloss: "moisture", phrase: ["surface wetness", "表面潮湿"] },
  { head: "hospitalise", cut: "hospital/ise", cutMeaning: "医院/动词", pos: "v.", zh: "使住院", gloss: "admit to hospital", phrase: ["hospitalise a patient", "让病人住院"] },
  { head: "pallor", cut: "pall/or", cutMeaning: "苍白/名词", pos: "n.", zh: "苍白；无血色", gloss: "paleness", phrase: ["notice her pallor", "注意到她脸色苍白"] },
  { head: "lowering", cut: "low/er/ing", cutMeaning: "低/动词/名词；形容词", pos: "n./adj.", zh: "降低；下降的", gloss: "reduction, descending", phrase: ["lowering costs", "降低成本"] },
  { head: "opportunist", cut: "op/port/un/ist", cutMeaning: "向；朝/携带；机会/名词/人", pos: "n.", zh: "机会主义者", gloss: "self-seeker", phrase: ["a political opportunist", "政治机会主义者"] },
  { head: "requirement", cut: "re/quir/e/ment", cutMeaning: "反复；回/寻求；询问/动词/名词", pos: "n.", zh: "要求；必要条件", gloss: "need, condition", phrase: ["legal requirement", "法律要求"] },
  { head: "loudness", cut: "loud/ness", cutMeaning: "响亮/名词", pos: "n.", zh: "响度；声音大小", gloss: "volume", phrase: ["measure loudness", "测量响度"] },
  { head: "summarise", cut: "sum/mar/ise", cutMeaning: "总和；概括/边界；标记/动词", pos: "v.", zh: "总结；概括", gloss: "sum up", phrase: ["summarise the evidence", "概括证据"] },
  { head: "upwards", cut: "up/ward/s", cutMeaning: "向上/方向/副词", pos: "adv.", zh: "向上；往上", gloss: "upward", phrase: ["look upwards", "向上看"] },
  { head: "read", cut: "read", cutMeaning: "阅读", pos: "v.", zh: "阅读；读懂", gloss: "understand written words", phrase: ["read a paragraph", "阅读一段文字"] },
  { head: "know", cut: "know", cutMeaning: "知道", pos: "v.", zh: "知道；了解", gloss: "understand, be aware", phrase: ["know the answer", "知道答案"] },
  { head: "fail", cut: "fail", cutMeaning: "失败；不足", pos: "v.", zh: "失败；未能做到", gloss: "not succeed", phrase: ["fail an exam", "考试不及格"] },
  { head: "friend", cut: "friend", cutMeaning: "朋友", pos: "n.", zh: "朋友；友人", gloss: "companion", phrase: ["a close friend", "亲密朋友"] },
  { head: "hear", cut: "hear", cutMeaning: "听见", pos: "v.", zh: "听见；听说", gloss: "listen, perceive sound", phrase: ["hear a voice", "听见声音"] },
  { head: "offend", cut: "of/fend", cutMeaning: "反对；离开/打击；防卫", pos: "v.", zh: "冒犯；违反", gloss: "upset, violate", phrase: ["offend a guest", "冒犯客人"] },
  { head: "annoy", cut: "an/noy", cutMeaning: "向；加强/伤害；烦扰", pos: "v.", zh: "使恼怒；打扰", gloss: "irritate", phrase: ["annoy the neighbours", "打扰邻居"] },
  { head: "usual", cut: "use/ual", cutMeaning: "使用；习惯/形容词", pos: "adj.", zh: "通常的；平常的", gloss: "normal, regular", phrase: ["the usual route", "通常路线"] },
  { head: "cruel", cut: "cruel", cutMeaning: "残酷", pos: "adj.", zh: "残酷的；残忍的", gloss: "brutal, harsh", phrase: ["a cruel remark", "残酷的话"] },
  { head: "medic", cut: "med/ic", cutMeaning: "治疗；医学/人", pos: "n.", zh: "医护人员；军医", gloss: "medical worker", phrase: ["a trained medic", "训练有素的医护人员"] },
  { head: "teach", cut: "teach", cutMeaning: "教；教授", pos: "v.", zh: "教；教授", gloss: "instruct", phrase: ["teach a lesson", "上一课"] },
  { head: "finish", cut: "fin/ish", cutMeaning: "结束；界限/动词", pos: "v./n.", zh: "完成；结束", gloss: "complete, end", phrase: ["finish the task", "完成任务"] },
  { head: "lighting", cut: "light/ing", cutMeaning: "光；点亮/名词", pos: "n.", zh: "照明；灯光", gloss: "illumination", phrase: ["soft lighting", "柔和灯光"] },
  { head: "lighten", cut: "light/en", cutMeaning: "轻；亮/动词", pos: "v.", zh: "减轻；变亮", gloss: "reduce, brighten", phrase: ["lighten the burden", "减轻负担"] },
  { head: "messaging", cut: "messag/ing", cutMeaning: "信息；消息/名词", pos: "n.", zh: "消息传递；信息表达", gloss: "communication", phrase: ["secure messaging", "安全消息传递"] },
  { head: "lecturer", cut: "lect/ur/er", cutMeaning: "读；讲/名词/人", pos: "n.", zh: "讲师；演讲者", gloss: "teacher, speaker", phrase: ["a university lecturer", "大学讲师"] },
  { head: "bravery", cut: "brave/ry", cutMeaning: "勇敢/名词", pos: "n.", zh: "勇敢；勇气", gloss: "courage", phrase: ["show bravery", "表现出勇气"] },
  { head: "bravely", cut: "brave/ly", cutMeaning: "勇敢/副词", pos: "adv.", zh: "勇敢地", gloss: "courageously", phrase: ["speak bravely", "勇敢发言"] },
  { head: "familiarity", cut: "famil/iar/ity", cutMeaning: "家庭；熟悉/形容词/名词", pos: "n.", zh: "熟悉；通晓", gloss: "acquaintance", phrase: ["gain familiarity", "获得熟悉感"] },
  { head: "unfamiliar", cut: "un/famil/iar", cutMeaning: "不；相反/家庭；熟悉/形容词", pos: "adj.", zh: "不熟悉的；陌生的", gloss: "unknown, strange", phrase: ["an unfamiliar voice", "陌生的声音"] },
  { head: "narrowly", cut: "narrow/ly", cutMeaning: "狭窄/副词", pos: "adv.", zh: "勉强地；狭隘地", gloss: "barely, strictly", phrase: ["narrowly escape", "勉强逃脱"] },
  { head: "vend", cut: "vend", cutMeaning: "出售", pos: "v.", zh: "贩卖；出售", gloss: "sell", phrase: ["vend drinks", "售卖饮料"] },
  { head: "charm", cut: "charm", cutMeaning: "魅力；魔力", pos: "n./v.", zh: "魅力；吸引；使着迷", gloss: "appeal, attract", phrase: ["personal charm", "个人魅力"] },
  { head: "dislikes", cut: "dis/like/s", cutMeaning: "不；相反/喜欢/动词", pos: "v./n.", zh: "不喜欢；厌恶", gloss: "does not like", phrase: ["strong dislikes", "强烈反感"] },
  { head: "merciful", cut: "mercy/ful", cutMeaning: "仁慈；怜悯/充满", pos: "adj.", zh: "仁慈的；宽大的", gloss: "compassionate", phrase: ["a merciful judge", "仁慈的法官"] },
  { head: "merciless", cut: "mercy/less", cutMeaning: "仁慈；怜悯/无", pos: "adj.", zh: "无情的；残忍的", gloss: "cruel, ruthless", phrase: ["merciless criticism", "无情批评"] },
  {
    head: "fieldwork",
    cut: "field/work",
    cutMeaning: "领域；现场/工作",
    pos: "n.",
    zh: "实地调查；野外工作",
    gloss: "research work",
    phrase: ["conduct fieldwork", "进行实地调查"]
  },
  {
    head: "unhurried",
    cut: "un/hurri/ed",
    cutMeaning: "不；相反/匆忙/形容词",
    pos: "adj.",
    zh: "从容的；不慌不忙的",
    gloss: "calm, not rushed",
    phrase: ["an unhurried conversation", "一次从容的谈话"]
  },
  {
    head: "wardrobe",
    cut: "ward/robe",
    cutMeaning: "守护；存放/衣袍",
    pos: "n.",
    zh: "衣柜；衣橱；全部衣物",
    gloss: "closet, clothes",
    phrase: ["open the wardrobe", "打开衣柜"]
  },
  {
    head: "wetland",
    cut: "wet/land",
    cutMeaning: "潮湿/土地",
    pos: "n.",
    zh: "湿地",
    gloss: "marsh, swamp",
    phrase: ["protect urban wetlands", "保护城市湿地"]
  },
  {
    head: "competent",
    cut: "com/pet/ent",
    cutMeaning: "共同；完全/追求；寻求/形容词",
    pos: "adj.",
    zh: "有能力的；能胜任的",
    gloss: "capable, qualified",
    phrase: ["a competent witness", "称职的证人"]
  },
  {
    head: "competence",
    cut: "com/pet/ence",
    cutMeaning: "共同；完全/追求；寻求/名词",
    pos: "n.",
    zh: "能力；胜任",
    gloss: "ability, qualification",
    phrase: ["professional competence", "专业能力"]
  },
  {
    head: "incompetent",
    cut: "in/com/pet/ent",
    cutMeaning: "不；无/共同；完全/追求；寻求/形容词",
    pos: "adj.",
    zh: "无能力的；不胜任的",
    gloss: "unable, unqualified",
    phrase: ["incompetent management", "无能的管理"]
  },
  {
    head: "cruelty",
    cut: "cruel/ty",
    cutMeaning: "残酷/名词",
    pos: "n.",
    zh: "残忍；残酷行为",
    gloss: "brutality, harshness",
    phrase: ["acts of cruelty", "残忍行为"]
  },
  {
    head: "jealousy",
    cut: "jealous/y",
    cutMeaning: "嫉妒/名词",
    pos: "n.",
    zh: "嫉妒；猜忌",
    gloss: "envy, suspicion",
    phrase: ["hide his jealousy", "掩饰他的嫉妒"]
  },
  {
    head: "intake",
    cut: "in/take",
    cutMeaning: "向内；进入/拿取",
    pos: "n.",
    zh: "摄入量；吸入口；接收人数",
    gloss: "amount taken in",
    phrase: ["reduce sugar intake", "减少糖分摄入"]
  },
  {
    head: "lectern",
    cut: "lect/ern",
    cutMeaning: "读；讲/名词",
    pos: "n.",
    zh: "讲台；诵经台",
    gloss: "reading desk",
    phrase: ["stand behind the lectern", "站在讲台后"]
  },
  {
    head: "riverbed",
    cut: "river/bed",
    cutMeaning: "河流/床；底部",
    pos: "n.",
    zh: "河床",
    gloss: "channel bottom",
    phrase: ["a dry riverbed", "干涸的河床"]
  },
  {
    head: "suspicion",
    cut: "sus/pic/ion",
    cutMeaning: "在下；暗中/看；观察/名词",
    pos: "n.",
    zh: "怀疑；嫌疑",
    gloss: "doubt, mistrust",
    phrase: ["raise suspicion", "引起怀疑"]
  },
  {
    head: "suspicious",
    cut: "sus/pic/ious",
    cutMeaning: "在下；暗中/看；观察/形容词",
    pos: "adj.",
    zh: "可疑的；怀疑的",
    gloss: "doubtful, mistrustful",
    phrase: ["a suspicious silence", "可疑的沉默"]
  },
  {
    head: "tenderness",
    cut: "tender/ness",
    cutMeaning: "温柔；柔软/名词",
    pos: "n.",
    zh: "温柔；柔软；压痛",
    gloss: "gentleness, soreness",
    phrase: ["unexpected tenderness", "意想不到的温柔"]
  },
  {
    head: "aftermath",
    cut: "after/math",
    cutMeaning: "之后/收割；结果",
    pos: "n.",
    zh: "后果；余波",
    gloss: "consequence, result",
    phrase: ["the aftermath of the scandal", "丑闻的余波"]
  },
  {
    head: "aftertaste",
    cut: "after/taste",
    cutMeaning: "之后/味道",
    pos: "n.",
    zh: "回味；余味",
    gloss: "lingering taste",
    phrase: ["a bitter aftertaste", "苦涩的余味"]
  },
  {
    head: "arctic",
    cut: "arct/ic",
    cutMeaning: "熊；北极/形容词",
    pos: "adj./n.",
    zh: "北极的；严寒的；北极",
    gloss: "polar, freezing",
    phrase: ["arctic air", "北极冷空气"]
  },
  {
    head: "yacht",
    cut: "yacht",
    cutMeaning: "游艇",
    pos: "n.",
    zh: "游艇；帆船",
    gloss: "pleasure boat",
    phrase: ["a private yacht", "私人游艇"]
  },
  {
    head: "rumour",
    cut: "rum/our",
    cutMeaning: "喧嚷；传闻/名词",
    pos: "n./v.",
    zh: "谣言；传闻；传播谣言",
    gloss: "gossip, report",
    phrase: ["spread a rumour", "散布谣言"]
  },
  {
    head: "lecture",
    cut: "lect/ure",
    cutMeaning: "读；讲/名词",
    pos: "n./v.",
    zh: "讲座；训斥；讲授",
    gloss: "talk, teach",
    phrase: ["attend a lecture", "听讲座"]
  },
  {
    head: "warmth",
    cut: "warm/th",
    cutMeaning: "温暖/名词",
    pos: "n.",
    zh: "温暖；热情",
    gloss: "heat, kindness",
    phrase: ["human warmth", "人情温暖"]
  },
  {
    head: "saloon",
    cut: "saloon",
    cutMeaning: "大厅；酒吧",
    pos: "n.",
    zh: "酒馆；大厅；轿车",
    gloss: "bar, lounge",
    phrase: ["the hotel saloon", "酒店酒廊"]
  },
  {
    head: "gangway",
    cut: "gang/way",
    cutMeaning: "行走；通道/道路",
    pos: "n.",
    zh: "跳板；舷梯；通道",
    gloss: "passage, walkway",
    phrase: ["cross the gangway", "走过舷梯"]
  },
  {
    head: "medical",
    cut: "medic/al",
    cutMeaning: "治疗/形容词",
    pos: "adj.",
    zh: "医学的；医疗的",
    gloss: "clinical, health-related",
    phrase: ["medical records", "医疗记录"]
  },
  {
    head: "wrist",
    cut: "wrist",
    cutMeaning: "手腕",
    pos: "n.",
    zh: "手腕；腕关节",
    gloss: "joint of the hand",
    phrase: ["hold her wrist", "握住她的手腕"]
  },
  {
    head: "afterward",
    cut: "after/ward",
    cutMeaning: "之后/方向",
    pos: "adv.",
    zh: "后来；之后",
    gloss: "later",
    phrase: ["speak afterward", "之后再说"]
  },
  {
    head: "amber",
    cut: "amber",
    cutMeaning: "琥珀；琥珀色",
    pos: "n./adj.",
    zh: "琥珀；琥珀色的",
    gloss: "yellow-brown resin",
    phrase: ["amber light", "琥珀色灯光"]
  },
  {
    head: "flatness",
    cut: "flat/ness",
    cutMeaning: "平坦；平淡/名词",
    pos: "n.",
    zh: "平坦；单调；乏味",
    gloss: "levelness, dullness",
    phrase: ["emotional flatness", "情感平淡"]
  },
  {
    head: "flinch",
    cut: "flinch",
    cutMeaning: "退缩；畏缩",
    pos: "v./n.",
    zh: "退缩；畏缩；躲闪",
    gloss: "shrink back",
    phrase: ["flinch from the truth", "逃避真相"]
  },
  {
    head: "supplemental",
    cut: "supple/ment/al",
    cutMeaning: "补足/名词/形容词",
    pos: "adj.",
    zh: "补充的；附加的",
    gloss: "additional, extra",
    phrase: ["supplemental evidence", "补充证据"]
  },
  {
    head: "contempt",
    cut: "con/tempt",
    cutMeaning: "共同；加强/轻视",
    pos: "n.",
    zh: "轻蔑；蔑视；藐视法庭",
    gloss: "scorn, disrespect",
    phrase: ["show contempt", "表现出轻蔑"]
  },
  {
    head: "deference",
    cut: "de/fer/ence",
    cutMeaning: "向下；离开/带来；服从/名词",
    pos: "n.",
    zh: "尊重；遵从",
    gloss: "respect, submission",
    phrase: ["speak with deference", "恭敬地说话"]
  },
  {
    head: "despise",
    cut: "de/spis/e",
    cutMeaning: "向下；离开/看/词尾",
    pos: "v.",
    zh: "鄙视；看不起",
    gloss: "look down on",
    phrase: ["despise cruelty", "鄙视残忍"]
  },
  {
    head: "doily",
    cut: "doily",
    cutMeaning: "装饰小垫",
    pos: "n.",
    zh: "装饰小垫；花边纸垫",
    gloss: "decorative mat",
    phrase: ["a lace doily", "蕾丝小垫"]
  },
  {
    head: "grateful",
    cut: "grat/e/ful",
    cutMeaning: "感激；喜悦/词尾/充满",
    pos: "adj.",
    zh: "感激的；感谢的",
    gloss: "thankful",
    phrase: ["feel grateful", "感到感激"]
  },
  {
    head: "hardship",
    cut: "hard/ship",
    cutMeaning: "困难；艰苦/状态",
    pos: "n.",
    zh: "艰难；困苦",
    gloss: "difficulty, suffering",
    phrase: ["endure hardship", "忍受艰难"]
  },
  {
    head: "overboard",
    cut: "over/board",
    cutMeaning: "越过；过度/船板",
    pos: "adv.",
    zh: "从船上落下；过度地",
    gloss: "off a boat, excessively",
    phrase: ["fall overboard", "落水"]
  },
  {
    head: "porthole",
    cut: "port/hole",
    cutMeaning: "港口；船/洞",
    pos: "n.",
    zh: "舷窗",
    gloss: "ship window",
    phrase: ["look through the porthole", "透过舷窗看"]
  },
  {
    head: "satisfaction",
    cut: "satis/fact/ion",
    cutMeaning: "足够/做；使/名词",
    pos: "n.",
    zh: "满意；满足",
    gloss: "contentment, fulfillment",
    phrase: ["deep satisfaction", "深深的满足感"]
  },
  {
    head: "stopwatch",
    cut: "stop/watch",
    cutMeaning: "停止/看；计时",
    pos: "n.",
    zh: "秒表",
    gloss: "timer",
    phrase: ["start the stopwatch", "启动秒表"]
  },
  {
    head: "throat",
    cut: "throat",
    cutMeaning: "喉咙",
    pos: "n.",
    zh: "喉咙；咽喉",
    gloss: "neck passage",
    phrase: ["clear his throat", "清清嗓子"]
  },
  {
    head: "unbothered",
    cut: "un/bother/ed",
    cutMeaning: "不；相反/烦扰/形容词",
    pos: "adj.",
    zh: "不受打扰的；不在意的",
    gloss: "calm, unconcerned",
    phrase: ["remain unbothered", "保持不受影响"]
  },
  {
    head: "workday",
    cut: "work/day",
    cutMeaning: "工作/日子",
    pos: "n.",
    zh: "工作日；一天的工作时间",
    gloss: "working day",
    phrase: ["a long workday", "漫长的工作日"]
  },
  {
    head: "afterthought",
    cut: "after/thought",
    cutMeaning: "之后/想法",
    pos: "n.",
    zh: "事后想法；追加的东西",
    gloss: "later idea",
    phrase: ["add it as an afterthought", "把它作为事后补充"]
  },
  {
    head: "approachable",
    cut: "ap/proach/able",
    cutMeaning: "朝向；加强/接近/能够；可",
    pos: "adj.",
    zh: "可接近的；亲切的",
    gloss: "friendly, accessible",
    phrase: ["an approachable teacher", "一位亲切的老师"]
  },
  {
    head: "boredom",
    cut: "bore/dom",
    cutMeaning: "厌烦/状态",
    pos: "n.",
    zh: "无聊；厌倦",
    gloss: "tedium",
    phrase: ["escape boredom", "摆脱无聊"]
  },
  {
    head: "brutal",
    cut: "brut/al",
    cutMeaning: "粗野；残暴/形容词",
    pos: "adj.",
    zh: "残酷的；野蛮的",
    gloss: "cruel, savage",
    phrase: ["brutal honesty", "残酷的坦白"]
  },
  {
    head: "cliffhanger",
    cut: "cliff/hang/er",
    cutMeaning: "悬崖/悬挂/物",
    pos: "n.",
    zh: "悬念结尾；惊险场面",
    gloss: "suspenseful ending",
    phrase: ["end on a cliffhanger", "以悬念结尾"]
  },
  {
    head: "capsize",
    cut: "cap/size",
    cutMeaning: "头；顶部/大小；翻转",
    pos: "v.",
    zh: "使倾覆；翻船",
    gloss: "overturn",
    phrase: ["capsize the boat", "使船倾覆"]
  },
  {
    head: "clipboard",
    cut: "clip/board",
    cutMeaning: "夹住/板",
    pos: "n.",
    zh: "写字夹板；剪贴板",
    gloss: "writing board",
    phrase: ["hold a clipboard", "拿着写字夹板"]
  },
  {
    head: "roommate",
    cut: "room/mate",
    cutMeaning: "房间/伙伴",
    pos: "n.",
    zh: "室友",
    gloss: "person sharing a room",
    phrase: ["a college roommate", "大学室友"]
  },
  {
    head: "colour",
    cut: "colour",
    cutMeaning: "颜色",
    pos: "n./v.",
    zh: "颜色；给……着色",
    gloss: "color, tint",
    phrase: ["change colour", "变色"]
  },
  {
    head: "correct",
    cut: "cor/rect",
    cutMeaning: "共同；完全/直；正",
    pos: "adj./v.",
    zh: "正确的；纠正",
    gloss: "right, fix",
    phrase: ["correct a mistake", "纠正错误"]
  },
  {
    head: "courtesy",
    cut: "court/esy",
    cutMeaning: "宫廷；礼貌/名词",
    pos: "n.",
    zh: "礼貌；客气；好意",
    gloss: "politeness",
    phrase: ["show courtesy", "表现出礼貌"]
  },
  {
    head: "crouch",
    cut: "crouch",
    cutMeaning: "蹲伏",
    pos: "v./n.",
    zh: "蹲伏；蜷缩",
    gloss: "bend low",
    phrase: ["crouch behind the door", "蹲在门后"]
  },
  {
    head: "curdle",
    cut: "curd/le",
    cutMeaning: "凝块/动词",
    pos: "v.",
    zh: "凝结；使变坏",
    gloss: "clot, spoil",
    phrase: ["curdled milk", "凝结的牛奶"]
  },
  {
    head: "curtain",
    cut: "curt/ain",
    cutMeaning: "遮盖；帘/名词",
    pos: "n.",
    zh: "窗帘；幕布",
    gloss: "drape, screen",
    phrase: ["draw the curtain", "拉上窗帘"]
  },
  {
    head: "delusion",
    cut: "de/lus/ion",
    cutMeaning: "离开；错开/玩；欺骗/名词",
    pos: "n.",
    zh: "错觉；妄想",
    gloss: "false belief",
    phrase: ["a dangerous delusion", "危险的妄想"]
  },
  {
    head: "destiny",
    cut: "destin/y",
    cutMeaning: "决定；命定/名词",
    pos: "n.",
    zh: "命运；天命",
    gloss: "fate",
    phrase: ["accept her destiny", "接受她的命运"]
  },
  {
    head: "endorse",
    cut: "en/dors/e",
    cutMeaning: "使进入/背；支持/词尾",
    pos: "v.",
    zh: "支持；认可；背书",
    gloss: "support, approve",
    phrase: ["endorse a proposal", "支持一项提议"]
  },
  {
    head: "eyebrow",
    cut: "eye/brow",
    cutMeaning: "眼睛/眉毛",
    pos: "n.",
    zh: "眉毛",
    gloss: "hair above the eye",
    phrase: ["raise an eyebrow", "挑眉"]
  },
  {
    head: "failure",
    cut: "fail/ure",
    cutMeaning: "失败/名词",
    pos: "n.",
    zh: "失败；故障",
    gloss: "lack of success",
    phrase: ["fear of failure", "对失败的恐惧"]
  },
  {
    head: "fever",
    cut: "fever",
    cutMeaning: "发热；狂热",
    pos: "n.",
    zh: "发烧；狂热",
    gloss: "high temperature",
    phrase: ["run a fever", "发烧"]
  },
  {
    head: "flood",
    cut: "flood",
    cutMeaning: "洪水；大量涌入",
    pos: "n./v.",
    zh: "洪水；淹没；大量涌入",
    gloss: "overflow",
    phrase: ["flood the room with light", "让光充满房间"]
  },
  {
    head: "forgive",
    cut: "for/give",
    cutMeaning: "完全；离开/给予",
    pos: "v.",
    zh: "原谅；宽恕",
    gloss: "pardon",
    phrase: ["forgive a mistake", "原谅一个错误"]
  },
  {
    head: "freshman",
    cut: "fresh/man",
    cutMeaning: "新/人",
    pos: "n.",
    zh: "新生；大学一年级学生",
    gloss: "first-year student",
    phrase: ["freshman orientation", "新生入学教育"]
  },
  {
    head: "friendship",
    cut: "friend/ship",
    cutMeaning: "朋友/关系；状态",
    pos: "n.",
    zh: "友谊",
    gloss: "friendly relationship",
    phrase: ["protect their friendship", "保护他们的友谊"]
  },
  {
    head: "goodwill",
    cut: "good/will",
    cutMeaning: "好的/意愿",
    pos: "n.",
    zh: "善意；商誉",
    gloss: "kind intention",
    phrase: ["a gesture of goodwill", "善意的表示"]
  },
  {
    head: "handshake",
    cut: "hand/shake",
    cutMeaning: "手/摇动",
    pos: "n.",
    zh: "握手",
    gloss: "greeting by hand",
    phrase: ["offer a handshake", "主动握手"]
  },
  {
    head: "helplessness",
    cut: "help/less/ness",
    cutMeaning: "帮助/无；缺少/名词",
    pos: "n.",
    zh: "无助；无能为力",
    gloss: "powerlessness",
    phrase: ["a sense of helplessness", "一种无助感"]
  },
  {
    head: "ineffective",
    cut: "in/effect/ive",
    cutMeaning: "不；无/效果/形容词",
    pos: "adj.",
    zh: "无效的；不起作用的",
    gloss: "not effective",
    phrase: ["an ineffective policy", "无效政策"]
  },
  {
    head: "invigilator",
    cut: "in/vigil/ator",
    cutMeaning: "在内；进入/警觉；看守/人",
    pos: "n.",
    zh: "监考人",
    gloss: "exam supervisor",
    phrase: ["ask the invigilator", "询问监考人"]
  },
  {
    head: "invoice",
    cut: "in/voice",
    cutMeaning: "进入/声音；叫价",
    pos: "n./v.",
    zh: "发票；给……开发票",
    gloss: "bill",
    phrase: ["send an invoice", "发送发票"]
  },
  {
    head: "irrelevant",
    cut: "ir/relev/ant",
    cutMeaning: "不；相反/举起；关联/形容词",
    pos: "adj.",
    zh: "不相关的",
    gloss: "not related",
    phrase: ["irrelevant details", "无关细节"]
  },
  {
    head: "keynote",
    cut: "key/note",
    cutMeaning: "关键/说明；音符",
    pos: "n.",
    zh: "主题演讲；基调",
    gloss: "main speech",
    phrase: ["deliver a keynote", "发表主题演讲"]
  },
  {
    head: "microphone",
    cut: "micro/phon/e",
    cutMeaning: "微小/声音/词尾",
    pos: "n.",
    zh: "麦克风",
    gloss: "sound device",
    phrase: ["adjust the microphone", "调整麦克风"]
  },
  {
    head: "myocarditis",
    cut: "myo/card/itis",
    cutMeaning: "肌肉/心脏/炎症",
    pos: "n.",
    zh: "心肌炎",
    gloss: "heart muscle inflammation",
    phrase: ["diagnose myocarditis", "诊断心肌炎"]
  },
  {
    head: "nightfall",
    cut: "night/fall",
    cutMeaning: "夜晚/落下",
    pos: "n.",
    zh: "黄昏；傍晚",
    gloss: "dusk",
    phrase: ["before nightfall", "黄昏前"]
  },
  {
    head: "occasion",
    cut: "oc/cas/ion",
    cutMeaning: "朝向；加强/落下；发生/名词",
    pos: "n.",
    zh: "场合；时机",
    gloss: "event, opportunity",
    phrase: ["on this occasion", "在这个场合"]
  },
  {
    head: "outrun",
    cut: "out/run",
    cutMeaning: "向外；超过/跑",
    pos: "v.",
    zh: "跑得比……快；超过",
    gloss: "run faster than",
    phrase: ["outrun the danger", "逃过危险"]
  },
  {
    head: "overheard",
    cut: "over/hear/ed",
    cutMeaning: "偶然；在上方/听见/过去分词",
    pos: "v.",
    zh: "无意中听到",
    gloss: "hear by chance",
    phrase: ["overheard a conversation", "无意中听到一段谈话"]
  },
  {
    head: "overrun",
    cut: "over/run",
    cutMeaning: "越过；过度/跑",
    pos: "v.",
    zh: "泛滥；超出；占领",
    gloss: "spread beyond limits",
    phrase: ["overrun the schedule", "超出日程"]
  },
  {
    head: "password",
    cut: "pass/word",
    cutMeaning: "通过/词语",
    pos: "n.",
    zh: "密码；口令",
    gloss: "secret word",
    phrase: ["reset the password", "重置密码"]
  },
  {
    head: "portal",
    cut: "port/al",
    cutMeaning: "门；入口/名词",
    pos: "n.",
    zh: "门户；入口；网站入口",
    gloss: "gateway",
    phrase: ["open the portal", "打开入口"]
  },
  {
    head: "protectiveness",
    cut: "protect/ive/ness",
    cutMeaning: "保护/形容词/名词",
    pos: "n.",
    zh: "保护欲；保护性",
    gloss: "desire to protect",
    phrase: ["quiet protectiveness", "安静的保护欲"]
  },
  {
    head: "punctuality",
    cut: "punct/ual/ity",
    cutMeaning: "点；准时/形容词/名词",
    pos: "n.",
    zh: "准时；守时",
    gloss: "being on time",
    phrase: ["value punctuality", "重视守时"]
  },
  {
    head: "purpose",
    cut: "pur/pose",
    cutMeaning: "向前/放置",
    pos: "n.",
    zh: "目的；意图",
    gloss: "aim, intention",
    phrase: ["with clear purpose", "带着明确目的"]
  },
  {
    head: "radiator",
    cut: "radi/ator",
    cutMeaning: "辐射；发散/物",
    pos: "n.",
    zh: "散热器；暖气片",
    gloss: "heat device",
    phrase: ["beside the radiator", "在暖气片旁"]
  },
  {
    head: "remedy",
    cut: "re/medi/y",
    cutMeaning: "再次；重新/治疗；修复/名词",
    pos: "n./v.",
    zh: "补救办法；治疗；纠正",
    gloss: "cure, solution",
    phrase: ["seek a remedy", "寻找补救办法"]
  },
  {
    head: "rudeness",
    cut: "rude/ness",
    cutMeaning: "粗鲁/名词",
    pos: "n.",
    zh: "粗鲁；无礼",
    gloss: "impoliteness",
    phrase: ["excuse his rudeness", "原谅他的无礼"]
  },
  {
    head: "salvage",
    cut: "salv/age",
    cutMeaning: "拯救/名词；动词",
    pos: "v./n.",
    zh: "抢救；打捞；残值",
    gloss: "rescue, recover",
    phrase: ["salvage the plan", "挽救计划"]
  },
  {
    head: "splint",
    cut: "splint",
    cutMeaning: "夹板；固定",
    pos: "n./v.",
    zh: "夹板；用夹板固定",
    gloss: "support for an injury",
    phrase: ["wear a splint", "戴夹板"]
  },
  {
    head: "stifle",
    cut: "stif/le",
    cutMeaning: "压制；窒息/动词",
    pos: "v.",
    zh: "压制；使窒息",
    gloss: "suppress, smother",
    phrase: ["stifle a laugh", "忍住笑"]
  },
  {
    head: "textbook",
    cut: "text/book",
    cutMeaning: "文本/书",
    pos: "n./adj.",
    zh: "教科书；典型的",
    gloss: "course book, classic",
    phrase: ["a textbook example", "一个典型例子"]
  },
  {
    head: "threat",
    cut: "threat",
    cutMeaning: "威胁",
    pos: "n.",
    zh: "威胁；危险迹象",
    gloss: "danger, menace",
    phrase: ["face a threat", "面对威胁"]
  },
  {
    head: "approval",
    cut: "ap/prov/al",
    cutMeaning: "向；加强/证明；认可/名词",
    pos: "n.",
    zh: "赞成；批准；认可",
    gloss: "agreement, permission",
    phrase: ["seek approval", "寻求批准"]
  },
  {
    head: "academically",
    cut: "academ/ic/al/ly",
    cutMeaning: "学院；学术/形容词/形容词/副词",
    pos: "adv.",
    zh: "学业上；学术上",
    gloss: "in study or scholarship",
    phrase: ["perform academically", "学业表现"]
  },
  {
    head: "emotionally",
    cut: "emotion/al/ly",
    cutMeaning: "情感/形容词/副词",
    pos: "adv.",
    zh: "情感上；情绪上",
    gloss: "in feeling",
    phrase: ["emotionally exhausted", "情绪上疲惫"]
  },
  {
    head: "excellent",
    cut: "ex/cell/ent",
    cutMeaning: "出；超过/升高；突出/形容词",
    pos: "adj.",
    zh: "优秀的；极好的",
    gloss: "very good",
    phrase: ["excellent timing", "极好的时机"]
  },
  {
    head: "frightened",
    cut: "fright/en/ed",
    cutMeaning: "恐惧/使成为/形容词",
    pos: "adj.",
    zh: "害怕的；受惊的",
    gloss: "afraid",
    phrase: ["look frightened", "看起来害怕"]
  },
  {
    head: "fully",
    cut: "full/y",
    cutMeaning: "完全；满/副词",
    pos: "adv.",
    zh: "完全地；充分地",
    gloss: "completely",
    phrase: ["fully understand", "完全理解"]
  },
  {
    head: "halfway",
    cut: "half/way",
    cutMeaning: "一半/路",
    pos: "adv./adj.",
    zh: "在中途；半途的",
    gloss: "in the middle",
    phrase: ["halfway through", "进行到一半"]
  },
  {
    head: "inbox",
    cut: "in/box",
    cutMeaning: "进入；里面/盒子",
    pos: "n.",
    zh: "收件箱",
    gloss: "message folder",
    phrase: ["check the inbox", "查看收件箱"]
  },
  {
    head: "narrow",
    cut: "narrow",
    cutMeaning: "狭窄；缩小",
    pos: "adj./v.",
    zh: "狭窄的；缩小",
    gloss: "thin, reduce",
    phrase: ["narrow the gap", "缩小差距"]
  },
  {
    head: "offended",
    cut: "of/fend/ed",
    cutMeaning: "朝向；反对/击打；冒犯/形容词",
    pos: "adj.",
    zh: "被冒犯的；生气的",
    gloss: "hurt, insulted",
    phrase: ["feel offended", "感到被冒犯"]
  },
  {
    head: "paperwork",
    cut: "paper/work",
    cutMeaning: "文件；纸/工作",
    pos: "n.",
    zh: "文书工作；文件",
    gloss: "documents",
    phrase: ["finish the paperwork", "完成文书工作"]
  },
  {
    head: "paragraph",
    cut: "para/graph",
    cutMeaning: "旁边；段落/写；记录",
    pos: "n.",
    zh: "段落",
    gloss: "section of writing",
    phrase: ["the opening paragraph", "开头段落"]
  },
  {
    head: "suppression",
    cut: "sup/press/ion",
    cutMeaning: "在下；压下/压/名词",
    pos: "n.",
    zh: "压制；抑制",
    gloss: "control, restraint",
    phrase: ["emotional suppression", "情绪压抑"]
  },
  {
    head: "survivable",
    cut: "sur/viv/able",
    cutMeaning: "超过；在上/生命；活/能够；可",
    pos: "adj.",
    zh: "可幸存的；能承受的",
    gloss: "able to survive",
    phrase: ["a survivable mistake", "可承受的错误"]
  },
  {
    head: "trembling",
    cut: "trembl/ing",
    cutMeaning: "颤抖/名词；形容词",
    pos: "adj./n.",
    zh: "颤抖的；颤抖",
    gloss: "shaking",
    phrase: ["trembling hands", "颤抖的双手"]
  },
  {
    head: "trophy",
    cut: "troph/y",
    cutMeaning: "养育；胜利标志/名词",
    pos: "n.",
    zh: "奖杯；战利品",
    gloss: "prize",
    phrase: ["win a trophy", "赢得奖杯"]
  },
  {
    head: "vendor",
    cut: "vend/or",
    cutMeaning: "出售/人",
    pos: "n.",
    zh: "小贩；供应商",
    gloss: "seller",
    phrase: ["a street vendor", "街头小贩"]
  },
  {
    head: "aisle",
    cut: "aisle",
    cutMeaning: "过道",
    pos: "n.",
    zh: "过道；通道",
    gloss: "passage between seats",
    phrase: ["walk down the aisle", "沿过道走"]
  },
  {
    head: "armour",
    cut: "arm/our",
    cutMeaning: "武装；保护/名词",
    pos: "n.",
    zh: "盔甲；防护层",
    gloss: "protective covering",
    phrase: ["wear armour", "穿盔甲"]
  },
  {
    head: "archway",
    cut: "arch/way",
    cutMeaning: "拱；弓/通道",
    pos: "n.",
    zh: "拱门；拱道",
    gloss: "arched entrance",
    phrase: ["under the archway", "在拱门下"]
  },
  {
    head: "arrears",
    cut: "ar/rear/s",
    cutMeaning: "向；加强/后面；拖欠/复数",
    pos: "n.",
    zh: "欠款；拖欠",
    gloss: "unpaid debt",
    phrase: ["rent in arrears", "拖欠租金"]
  },
  {
    head: "backward",
    cut: "back/ward",
    cutMeaning: "后面/方向",
    pos: "adv./adj.",
    zh: "向后；落后的",
    gloss: "toward the back",
    phrase: ["step backward", "向后退"]
  },
  {
    head: "betrayed",
    cut: "be/tray/ed",
    cutMeaning: "使；加强/交出；背叛/形容词",
    pos: "adj.",
    zh: "被背叛的",
    gloss: "deceived, abandoned",
    phrase: ["feel betrayed", "感到被背叛"]
  },
  {
    head: "citrus",
    cut: "citr/us",
    cutMeaning: "柑橘/名词",
    pos: "n./adj.",
    zh: "柑橘；柑橘类的",
    gloss: "orange-like fruit",
    phrase: ["citrus scent", "柑橘香气"]
  },
  {
    head: "comfortable",
    cut: "com/fort/able",
    cutMeaning: "共同；加强/力量；安慰/能够；可",
    pos: "adj.",
    zh: "舒服的；自在的",
    gloss: "at ease",
    phrase: ["feel comfortable", "感到舒服"]
  },
  {
    head: "discretion",
    cut: "dis/cret/ion",
    cutMeaning: "分开；辨别/分辨；判断/名词",
    pos: "n.",
    zh: "谨慎；自行决定权",
    gloss: "careful judgment",
    phrase: ["use discretion", "谨慎行事"]
  },
  {
    head: "employee",
    cut: "em/ploy/ee",
    cutMeaning: "使进入/卷入；使用/受事者",
    pos: "n.",
    zh: "雇员；员工",
    gloss: "worker",
    phrase: ["a new employee", "新员工"]
  },
  {
    head: "inconvenience",
    cut: "in/con/ven/ience",
    cutMeaning: "不；无/共同；加强/来/名词",
    pos: "n./v.",
    zh: "不便；麻烦",
    gloss: "trouble, difficulty",
    phrase: ["cause inconvenience", "造成不便"]
  },
  {
    head: "junior",
    cut: "jun/ior",
    cutMeaning: "年轻/形容词；名词",
    pos: "adj./n.",
    zh: "年少的；低年级学生；下级",
    gloss: "younger, lower rank",
    phrase: ["a junior member", "初级成员"]
  },
  {
    head: "ledger",
    cut: "ledg/er",
    cutMeaning: "账簿；放置/物",
    pos: "n.",
    zh: "分类账；账簿",
    gloss: "account book",
    phrase: ["check the ledger", "核对账簿"]
  },
  {
    head: "profile",
    cut: "pro/file",
    cutMeaning: "向前/线；轮廓",
    pos: "n./v.",
    zh: "简介；侧面轮廓；描写",
    gloss: "outline, description",
    phrase: ["student profile", "学生档案"]
  },
  {
    head: "reassigned",
    cut: "re/as/sign/ed",
    cutMeaning: "再次；重新/向；加强/标记；指定/形容词",
    pos: "adj.",
    zh: "被重新分配的",
    gloss: "assigned again",
    phrase: ["reassigned duties", "重新分配的职责"]
  },
  {
    head: "recovery",
    cut: "re/cover/y",
    cutMeaning: "再次；重新/覆盖；找回/名词",
    pos: "n.",
    zh: "恢复；康复；找回",
    gloss: "return to health",
    phrase: ["slow recovery", "缓慢恢复"]
  },
  {
    head: "reversible",
    cut: "re/vers/ible",
    cutMeaning: "再次；向回/转/能够；可",
    pos: "adj.",
    zh: "可逆的；可撤销的",
    gloss: "able to be reversed",
    phrase: ["reversible damage", "可逆损伤"]
  },
  {
    head: "reversibility",
    cut: "re/vers/ibil/ity",
    cutMeaning: "再次；向回/转/能够；可/名词",
    pos: "n.",
    zh: "可逆性",
    gloss: "ability to be reversed",
    phrase: ["test reversibility", "测试可逆性"]
  },
  {
    head: "sincerity",
    cut: "sincer/ity",
    cutMeaning: "真诚/名词",
    pos: "n.",
    zh: "真诚；诚意",
    gloss: "honesty",
    phrase: ["speak with sincerity", "真诚地说"]
  },
  {
    head: "usher",
    cut: "ush/er",
    cutMeaning: "引导/人",
    pos: "n./v.",
    zh: "引座员；引导",
    gloss: "guide, attendant",
    phrase: ["usher guests inside", "引导客人入内"]
  },
  {
    head: "admirable",
    cut: "ad/mir/able",
    cutMeaning: "向；加强/惊奇；敬佩/能够；可",
    pos: "adj.",
    zh: "令人钦佩的",
    gloss: "worthy of respect",
    phrase: ["admirable courage", "令人钦佩的勇气"]
  },
  {
    head: "holistic",
    cut: "hol/istic",
    cutMeaning: "整体/形容词",
    pos: "adj.",
    zh: "整体的；全面的",
    gloss: "whole-system",
    phrase: ["a holistic view", "整体视角"]
  },
  {
    head: "impatience",
    cut: "im/pati/ence",
    cutMeaning: "不；无/忍受；耐心/名词",
    pos: "n.",
    zh: "不耐烦；急躁",
    gloss: "lack of patience",
    phrase: ["hide her impatience", "掩饰她的不耐烦"]
  },
  {
    head: "onboarding",
    cut: "on/board/ing",
    cutMeaning: "进入；在上/板；组织/名词",
    pos: "n.",
    zh: "入职培训；引导流程",
    gloss: "orientation process",
    phrase: ["onboarding paperwork", "入职文件"]
  },
  {
    head: "optimism",
    cut: "optim/ism",
    cutMeaning: "最好；乐观/主义；状态",
    pos: "n.",
    zh: "乐观；乐观主义",
    gloss: "hopefulness",
    phrase: ["cautious optimism", "谨慎乐观"]
  },
  {
    head: "overactivity",
    cut: "over/activ/ity",
    cutMeaning: "过度/行动；活跃/名词",
    pos: "n.",
    zh: "过度活跃",
    gloss: "excessive activity",
    phrase: ["mental overactivity", "精神过度活跃"]
  },
  {
    head: "overexplains",
    cut: "over/explain/s",
    cutMeaning: "过度/解释/第三人称",
    pos: "v.",
    zh: "解释过多",
    gloss: "explains too much",
    phrase: ["he overexplains everything", "他什么都解释过多"]
  },
  {
    head: "pastry",
    cut: "past/ry",
    cutMeaning: "面团；糕点/名词",
    pos: "n.",
    zh: "糕点；酥皮点心",
    gloss: "baked sweet food",
    phrase: ["a small pastry", "一块小糕点"]
  },
  {
    head: "payment",
    cut: "pay/ment",
    cutMeaning: "支付/名词",
    pos: "n.",
    zh: "付款；报酬",
    gloss: "money paid",
    phrase: ["delay payment", "延迟付款"]
  },
  {
    head: "petty",
    cut: "pet/ty",
    cutMeaning: "小；寻求/形容词",
    pos: "adj.",
    zh: "小气的；琐碎的",
    gloss: "small-minded, minor",
    phrase: ["petty jealousy", "小气的嫉妒"]
  },
  {
    head: "practised",
    cut: "practis/ed",
    cutMeaning: "练习；熟练/形容词",
    pos: "adj.",
    zh: "熟练的；老练的",
    gloss: "skilled by practice",
    phrase: ["a practised smile", "老练的微笑"]
  },
  {
    head: "punctuation",
    cut: "punct/u/ation",
    cutMeaning: "点；标点/词尾/名词",
    pos: "n.",
    zh: "标点；标点符号",
    gloss: "marks in writing",
    phrase: ["correct punctuation", "正确标点"]
  },
  {
    head: "receptionist",
    cut: "re/cept/ion/ist",
    cutMeaning: "回；接收/拿；接受/名词/人",
    pos: "n.",
    zh: "接待员",
    gloss: "front-desk worker",
    phrase: ["ask the receptionist", "询问接待员"]
  },
  {
    head: "rehearsal",
    cut: "re/hears/al",
    cutMeaning: "再次；重新/耙；重复练习/名词",
    pos: "n.",
    zh: "排练；预演",
    gloss: "practice before performance",
    phrase: ["after rehearsal", "排练后"]
  },
  {
    head: "relationship",
    cut: "re/lat/ion/ship",
    cutMeaning: "回；关联/带来；联系/名词/关系",
    pos: "n.",
    zh: "关系；关联",
    gloss: "connection",
    phrase: ["a complicated relationship", "复杂关系"]
  },
  {
    head: "repeatability",
    cut: "re/peat/abil/ity",
    cutMeaning: "再次；重新/寻求；重复/能够；可/名词",
    pos: "n.",
    zh: "可重复性",
    gloss: "ability to repeat",
    phrase: ["test repeatability", "测试可重复性"]
  },
  {
    head: "secondary",
    cut: "second/ary",
    cutMeaning: "第二；次要/形容词",
    pos: "adj.",
    zh: "次要的；中等教育的",
    gloss: "less important",
    phrase: ["a secondary concern", "次要问题"]
  },
  {
    head: "strategically",
    cut: "strateg/ic/al/ly",
    cutMeaning: "策略/形容词/形容词/副词",
    pos: "adv.",
    zh: "战略上；有策略地",
    gloss: "with strategy",
    phrase: ["act strategically", "有策略地行动"]
  },
  {
    head: "supervision",
    cut: "super/vis/ion",
    cutMeaning: "在上；超过/看/名词",
    pos: "n.",
    zh: "监督；管理",
    gloss: "oversight",
    phrase: ["under supervision", "在监督下"]
  },
  {
    head: "underdressed",
    cut: "under/dress/ed",
    cutMeaning: "不足；在下/穿衣/形容词",
    pos: "adj.",
    zh: "穿着过于随便的",
    gloss: "too informally dressed",
    phrase: ["feel underdressed", "觉得穿得太随便"]
  },
  {
    head: "unfinished",
    cut: "un/finish/ed",
    cutMeaning: "不；相反/完成/形容词",
    pos: "adj.",
    zh: "未完成的",
    gloss: "not complete",
    phrase: ["unfinished business", "未了之事"]
  },
  {
    head: "endorsement",
    cut: "en/dors/e/ment",
    cutMeaning: "使进入/背；支持/词尾/名词",
    pos: "n.",
    zh: "认可；支持；背书",
    gloss: "approval, support",
    phrase: ["public endorsement", "公开支持"]
  },
  {
    head: "failed",
    cut: "fail/ed",
    cutMeaning: "失败/形容词",
    pos: "adj.",
    zh: "失败的；未成功的",
    gloss: "unsuccessful",
    phrase: ["a failed attempt", "一次失败的尝试"]
  },
  {
    head: "failing",
    cut: "fail/ing",
    cutMeaning: "失败/名词；形容词",
    pos: "n./adj.",
    zh: "缺点；失败的",
    gloss: "weakness, failing",
    phrase: ["a personal failing", "个人缺点"]
  },
  {
    head: "administratively",
    cut: "administr/ative/ly",
    cutMeaning: "管理/形容词/副词",
    pos: "adv.",
    zh: "行政上；管理上",
    gloss: "in administration",
    phrase: ["administratively convenient", "行政上便利"]
  },
  {
    head: "annoyingly",
    cut: "annoy/ing/ly",
    cutMeaning: "烦扰/形容词/副词",
    pos: "adv.",
    zh: "恼人地；烦人地",
    gloss: "irritatingly",
    phrase: ["annoyingly slow", "慢得烦人"]
  },
  {
    head: "aspirational",
    cut: "a/spir/ation/al",
    cutMeaning: "向；加强/呼吸；渴望/名词/形容词",
    pos: "adj.",
    zh: "有抱负的；向往中的",
    gloss: "ambitious, ideal",
    phrase: ["aspirational language", "带有理想色彩的语言"]
  },
  {
    head: "boldness",
    cut: "bold/ness",
    cutMeaning: "大胆/名词",
    pos: "n.",
    zh: "大胆；勇敢",
    gloss: "courage, confidence",
    phrase: ["unexpected boldness", "意外的大胆"]
  },
  {
    head: "cancellation",
    cut: "cancel/l/ation",
    cutMeaning: "取消/词尾/名词",
    pos: "n.",
    zh: "取消；撤销",
    gloss: "calling off",
    phrase: ["a sudden cancellation", "突然取消"]
  },
  {
    head: "coldness",
    cut: "cold/ness",
    cutMeaning: "冷；冷淡/名词",
    pos: "n.",
    zh: "寒冷；冷淡",
    gloss: "lack of warmth",
    phrase: ["emotional coldness", "情感冷淡"]
  },
  {
    head: "costly",
    cut: "cost/ly",
    cutMeaning: "代价；费用/形容词",
    pos: "adj.",
    zh: "昂贵的；代价高的",
    gloss: "expensive",
    phrase: ["a costly mistake", "代价高昂的错误"]
  },
  {
    head: "crueler",
    cut: "cruel/er",
    cutMeaning: "残酷/比较级",
    pos: "adj.",
    zh: "更残酷的",
    gloss: "more cruel",
    phrase: ["a crueler answer", "更残酷的回答"]
  },
  {
    head: "definitely",
    cut: "defin/ite/ly",
    cutMeaning: "限定；明确/形容词/副词",
    pos: "adv.",
    zh: "肯定地；明确地",
    gloss: "certainly",
    phrase: ["definitely true", "肯定是真的"]
  },
  {
    head: "disagreeable",
    cut: "dis/agree/able",
    cutMeaning: "否定；分开/同意；一致/能够；可",
    pos: "adj.",
    zh: "令人不快的；难相处的",
    gloss: "unpleasant",
    phrase: ["a disagreeable tone", "令人不快的语气"]
  },
  {
    head: "discomfort",
    cut: "dis/comfort",
    cutMeaning: "否定；分开/安慰；舒服",
    pos: "n./v.",
    zh: "不适；不安",
    gloss: "unease, pain",
    phrase: ["hide discomfort", "掩饰不适"]
  },
  {
    head: "distributive",
    cut: "dis/tribut/ive",
    cutMeaning: "分开；分配/给予；分配/形容词",
    pos: "adj.",
    zh: "分配的；分布的",
    gloss: "relating to distribution",
    phrase: ["distributive fairness", "分配公平"]
  },
  {
    head: "entitlement",
    cut: "en/title/ment",
    cutMeaning: "使进入/标题；权利/名词",
    pos: "n.",
    zh: "权利；资格；特权感",
    gloss: "right, claim",
    phrase: ["a sense of entitlement", "特权感"]
  },
  {
    head: "formality",
    cut: "form/al/ity",
    cutMeaning: "形式/形容词/名词",
    pos: "n.",
    zh: "正式手续；礼节；形式性",
    gloss: "formal procedure",
    phrase: ["a legal formality", "法律手续"]
  },
  {
    head: "graceful",
    cut: "grace/ful",
    cutMeaning: "优雅；恩典/充满",
    pos: "adj.",
    zh: "优雅的；得体的",
    gloss: "elegant",
    phrase: ["a graceful exit", "体面的离场"]
  },
  {
    head: "honestly",
    cut: "honest/ly",
    cutMeaning: "诚实/副词",
    pos: "adv.",
    zh: "诚实地；说真的",
    gloss: "truthfully",
    phrase: ["answer honestly", "诚实回答"]
  },
  {
    head: "incompetence",
    cut: "in/com/pet/ence",
    cutMeaning: "不；无/共同；完全/追求；寻求/名词",
    pos: "n.",
    zh: "无能；不胜任",
    gloss: "lack of ability",
    phrase: ["professional incompetence", "专业无能"]
  },
  {
    head: "inconveniently",
    cut: "in/con/ven/ient/ly",
    cutMeaning: "不；无/共同；加强/来/形容词/副词",
    pos: "adv.",
    zh: "不方便地；麻烦地",
    gloss: "awkwardly",
    phrase: ["inconveniently timed", "时间安排得不方便"]
  },
  {
    head: "insurer",
    cut: "in/sur/er",
    cutMeaning: "进入；加强/安全；保证/人",
    pos: "n.",
    zh: "保险公司；承保人",
    gloss: "insurance provider",
    phrase: ["contact the insurer", "联系保险公司"]
  },
  {
    head: "kindly",
    cut: "kind/ly",
    cutMeaning: "仁慈；友善/副词",
    pos: "adv./adj.",
    zh: "友善地；亲切的",
    gloss: "gently, kindly",
    phrase: ["speak kindly", "亲切地说"]
  },
  {
    head: "maturely",
    cut: "mature/ly",
    cutMeaning: "成熟/副词",
    pos: "adv.",
    zh: "成熟地；理智地",
    gloss: "sensibly",
    phrase: ["respond maturely", "成熟地回应"]
  },
  {
    head: "misunderstand",
    cut: "mis/under/stand",
    cutMeaning: "错误/在下；理解/站立；理解",
    pos: "v.",
    zh: "误解",
    gloss: "understand wrongly",
    phrase: ["misunderstand the question", "误解问题"]
  },
  {
    head: "overcautious",
    cut: "over/caut/ious",
    cutMeaning: "过度/小心/形容词",
    pos: "adj.",
    zh: "过分谨慎的",
    gloss: "too careful",
    phrase: ["an overcautious plan", "过分谨慎的计划"]
  },
  {
    head: "overperform",
    cut: "over/perform",
    cutMeaning: "超过/执行；表现",
    pos: "v.",
    zh: "表现超出预期",
    gloss: "perform better than expected",
    phrase: ["overperform expectations", "表现超出预期"]
  },
  {
    head: "professionally",
    cut: "profession/al/ly",
    cutMeaning: "职业；专业/形容词/副词",
    pos: "adv.",
    zh: "专业地；职业上",
    gloss: "in a professional way",
    phrase: ["handle it professionally", "专业地处理它"]
  },
  {
    head: "reallocation",
    cut: "re/alloc/ation",
    cutMeaning: "再次；重新/分配/名词",
    pos: "n.",
    zh: "重新分配",
    gloss: "redistribution",
    phrase: ["resource reallocation", "资源重新分配"]
  },
  {
    head: "regional",
    cut: "region/al",
    cutMeaning: "地区/形容词",
    pos: "adj.",
    zh: "地区的；区域的",
    gloss: "local, area-based",
    phrase: ["regional differences", "地区差异"]
  },
  {
    head: "respectable",
    cut: "re/spect/able",
    cutMeaning: "再次；回看/看；观察/能够；可",
    pos: "adj.",
    zh: "体面的；值得尊敬的",
    gloss: "decent, worthy",
    phrase: ["a respectable answer", "体面的回答"]
  },
  {
    head: "seniority",
    cut: "senior/ity",
    cutMeaning: "年长；资深/名词",
    pos: "n.",
    zh: "资历；年长",
    gloss: "higher rank by age or service",
    phrase: ["rank by seniority", "按资历排序"]
  },
  {
    head: "sponsorship",
    cut: "sponsor/ship",
    cutMeaning: "赞助者/关系；状态",
    pos: "n.",
    zh: "赞助；资助",
    gloss: "financial support",
    phrase: ["corporate sponsorship", "企业赞助"]
  },
  {
    head: "tutorial",
    cut: "tutor/ial",
    cutMeaning: "导师；辅导/形容词；名词",
    pos: "n./adj.",
    zh: "教程；辅导课",
    gloss: "lesson, guide",
    phrase: ["a short tutorial", "一个简短教程"]
  },
  {
    head: "unusually",
    cut: "un/usual/ly",
    cutMeaning: "不；相反/通常/副词",
    pos: "adv.",
    zh: "异常地；不寻常地",
    gloss: "not normally",
    phrase: ["unusually quiet", "异常安静"]
  },
  {
    head: "unwell",
    cut: "un/well",
    cutMeaning: "不；相反/健康；良好",
    pos: "adj.",
    zh: "身体不适的",
    gloss: "ill",
    phrase: ["feel unwell", "感觉不舒服"]
  },
  {
    head: "unwilling",
    cut: "un/will/ing",
    cutMeaning: "不；相反/意愿/形容词",
    pos: "adj.",
    zh: "不愿意的",
    gloss: "reluctant",
    phrase: ["unwilling to answer", "不愿回答"]
  },
  {
    head: "wrapper",
    cut: "wrap/er",
    cutMeaning: "包裹/物",
    pos: "n.",
    zh: "包装纸；包装物；封装器",
    gloss: "covering, container",
    phrase: ["a paper wrapper", "纸包装"]
  },
  {
    head: "finished",
    cut: "finish/ed",
    cutMeaning: "完成/形容词",
    pos: "adj.",
    zh: "完成的；结束的",
    gloss: "complete",
    phrase: ["a finished draft", "完成的草稿"]
  },
  {
    head: "hearing",
    cut: "hear/ing",
    cutMeaning: "听见/名词",
    pos: "n.",
    zh: "听力；听证会",
    gloss: "listening ability, formal session",
    phrase: ["a public hearing", "公开听证会"]
  },
  {
    head: "medically",
    cut: "medic/al/ly",
    cutMeaning: "治疗；医学/形容词/副词",
    pos: "adv.",
    zh: "医学上；医疗方面",
    gloss: "in medical terms",
    phrase: ["medically necessary", "医学上必要的"]
  },
  {
    head: "reallocating",
    cut: "re/alloc/at/ing",
    cutMeaning: "再次；重新/分配/动词；使成为/名词",
    pos: "v.",
    zh: "正在重新分配",
    gloss: "redistributing",
    phrase: ["reallocating resources", "重新分配资源"]
  },
  {
    head: "quantified",
    cut: "quant/ify/ed",
    cutMeaning: "数量/使成为/形容词",
    pos: "adj.",
    zh: "量化的",
    gloss: "measured in numbers",
    phrase: ["quantified evidence", "量化证据"]
  },
  {
    head: "submitted",
    cut: "sub/mit/ed",
    cutMeaning: "在下/送；放/形容词",
    pos: "adj.",
    zh: "已提交的；屈服的",
    gloss: "sent in",
    phrase: ["submitted documents", "已提交文件"]
  },
  {
    head: "admitted",
    cut: "ad/mit/ed",
    cutMeaning: "向；加强/送；放/形容词",
    pos: "adj.",
    zh: "被承认的；被准许进入的",
    gloss: "accepted, confessed",
    phrase: ["admitted mistake", "承认的错误"]
  },
  {
    head: "admitting",
    cut: "ad/mit/ing",
    cutMeaning: "向；加强/送；放/名词",
    pos: "v.",
    zh: "承认；准许进入",
    gloss: "accepting, confessing",
    phrase: ["admitting responsibility", "承认责任"]
  },
  {
    head: "applied",
    cut: "ap/ply/ed",
    cutMeaning: "向；加强/折叠；应用/形容词",
    pos: "adj.",
    zh: "应用的；已申请的",
    gloss: "practical, used",
    phrase: ["applied knowledge", "应用知识"]
  },
  {
    head: "classified",
    cut: "class/ify/ed",
    cutMeaning: "类别/使成为/形容词",
    pos: "adj.",
    zh: "分类的；机密的",
    gloss: "sorted, secret",
    phrase: ["classified information", "机密信息"]
  },
  {
    head: "cancelling",
    cut: "cancel/l/ing",
    cutMeaning: "取消/词尾/名词",
    pos: "v.",
    zh: "正在取消",
    gloss: "calling off",
    phrase: ["cancelling a meeting", "取消会议"]
  },
  {
    head: "carried",
    cut: "carri/ed",
    cutMeaning: "携带；承载/形容词",
    pos: "v.",
    zh: "携带；承载；被通过",
    gloss: "brought, supported",
    phrase: ["carried by habit", "由习惯承载"]
  },
  {
    head: "clipped",
    cut: "clip/p/ed",
    cutMeaning: "夹；剪/词尾/形容词",
    pos: "adj.",
    zh: "剪短的；夹住的",
    gloss: "cut short",
    phrase: ["a clipped reply", "简短生硬的回答"]
  },
  {
    head: "logged",
    cut: "log/g/ed",
    cutMeaning: "记录/词尾/形容词",
    pos: "adj.",
    zh: "已记录的",
    gloss: "recorded",
    phrase: ["logged activity", "已记录活动"]
  },
  {
    head: "blurred",
    cut: "blur/r/ed",
    cutMeaning: "模糊/词尾/形容词",
    pos: "adj.",
    zh: "模糊的",
    gloss: "unclear",
    phrase: ["blurred memory", "模糊的记忆"]
  },
  {
    head: "chipped",
    cut: "chip/p/ed",
    cutMeaning: "碎片；缺口/词尾/形容词",
    pos: "adj.",
    zh: "有缺口的；破损的",
    gloss: "damaged at the edge",
    phrase: ["a chipped cup", "有缺口的杯子"]
  },
  {
    head: "finder",
    cut: "find/er",
    cutMeaning: "发现/人；物",
    pos: "n.",
    zh: "发现者；取景器",
    gloss: "one who finds",
    phrase: ["the finder of the note", "发现纸条的人"]
  },
  { head: "irritation", cut: "irrit/ation", cutMeaning: "刺激；恼怒/名词", pos: "n.", zh: "恼怒；刺激", gloss: "annoyance", phrase: ["hide irritation", "掩饰恼怒"] },
  { head: "readable", cut: "read/able", cutMeaning: "阅读/能够；可", pos: "adj.", zh: "易读的；清晰的", gloss: "easy to read", phrase: ["readable handwriting", "清晰的字迹"] },
  { head: "readiness", cut: "ready/ness", cutMeaning: "准备好/名词", pos: "n.", zh: "准备就绪；愿意", gloss: "preparedness", phrase: ["readiness to learn", "学习准备度"] },
  { head: "reluctance", cut: "re/luct/ance", cutMeaning: "向后；反复/挣扎；不愿/名词", pos: "n.", zh: "不情愿；勉强", gloss: "unwillingness", phrase: ["show reluctance", "表现出不情愿"] },
  { head: "post-crisis", cut: "post/crisis", cutMeaning: "之后/危机", pos: "adj.", zh: "危机后的", gloss: "after a crisis", phrase: ["post-crisis recovery", "危机后恢复"] },
  { head: "ambulance", cut: "ambul/ance", cutMeaning: "行走；移动/名词", pos: "n.", zh: "救护车", gloss: "emergency vehicle", phrase: ["call an ambulance", "叫救护车"] },
  { head: "beautiful", cut: "beauty/ful", cutMeaning: "美/充满", pos: "adj.", zh: "美丽的", gloss: "lovely", phrase: ["a beautiful answer", "漂亮的回答"] },
  { head: "hopeful", cut: "hope/ful", cutMeaning: "希望/充满", pos: "adj.", zh: "有希望的；乐观的", gloss: "optimistic", phrase: ["feel hopeful", "感到有希望"] },
  { head: "mysterious", cut: "myster/ious", cutMeaning: "神秘/形容词", pos: "adj.", zh: "神秘的；难以解释的", gloss: "strange, unknown", phrase: ["a mysterious silence", "神秘的沉默"] },
  { head: "workstation", cut: "work/station", cutMeaning: "工作/站点；位置", pos: "n.", zh: "工作站；工作台", gloss: "work area", phrase: ["shared workstation", "共享工作站"] },
  { head: "arrogance", cut: "arrog/ance", cutMeaning: "傲慢；声称/名词", pos: "n.", zh: "傲慢；自大", gloss: "pride, superiority", phrase: ["quiet arrogance", "安静的傲慢"] },
  { head: "cheerfulness", cut: "cheer/ful/ness", cutMeaning: "愉快/充满/名词", pos: "n.", zh: "愉快；开朗", gloss: "happiness", phrase: ["forced cheerfulness", "勉强的开朗"] },
  { head: "clerical", cut: "cleric/al", cutMeaning: "职员；神职/形容词", pos: "adj.", zh: "文书的；办事员的", gloss: "office-related", phrase: ["clerical work", "文书工作"] },
  { head: "collateral", cut: "col/later/al", cutMeaning: "共同；加强/侧边/形容词", pos: "n./adj.", zh: "抵押品；附带的", gloss: "security, secondary", phrase: ["collateral damage", "附带损害"] },
  { head: "contemptuous", cut: "con/tempt/u/ous", cutMeaning: "共同；加强/轻视/词尾/形容词", pos: "adj.", zh: "轻蔑的；鄙视的", gloss: "scornful", phrase: ["a contemptuous look", "轻蔑的一瞥"] },
  { head: "contractual", cut: "contract/ual", cutMeaning: "合同；收缩/形容词", pos: "adj.", zh: "合同的；契约的", gloss: "by contract", phrase: ["contractual terms", "合同条款"] },
  { head: "effortless", cut: "effort/less", cutMeaning: "努力/无；缺少", pos: "adj.", zh: "不费力的；自然的", gloss: "easy, smooth", phrase: ["effortless confidence", "自然的自信"] },
  { head: "excellence", cut: "ex/cell/ence", cutMeaning: "出；超过/升高；突出/名词", pos: "n.", zh: "卓越；优秀", gloss: "high quality", phrase: ["academic excellence", "学术卓越"] },
  { head: "exclamation", cut: "ex/claim/ation", cutMeaning: "出；向外/呼喊；声称/名词", pos: "n.", zh: "惊叹；感叹语", gloss: "sudden cry", phrase: ["an exclamation of surprise", "惊讶的感叹"] },
  { head: "flirtatious", cut: "flirt/at/ious", cutMeaning: "调情/动词；词尾/形容词", pos: "adj.", zh: "调情的；轻浮的", gloss: "playfully romantic", phrase: ["a flirtatious smile", "带调情意味的微笑"] },
  { head: "floral", cut: "flor/al", cutMeaning: "花/形容词", pos: "adj.", zh: "花的；花香的", gloss: "flower-related", phrase: ["floral perfume", "花香香水"] },
  { head: "necessary", cut: "necess/ary", cutMeaning: "需要；必要/形容词", pos: "adj.", zh: "必要的", gloss: "needed", phrase: ["necessary evidence", "必要证据"] },
  { head: "peripheral", cut: "peri/pher/al", cutMeaning: "周围/带来；边缘/形容词", pos: "adj.", zh: "外围的；次要的", gloss: "outer, secondary", phrase: ["peripheral details", "次要细节"] },
  { head: "politeness", cut: "polite/ness", cutMeaning: "礼貌/名词", pos: "n.", zh: "礼貌；客气", gloss: "courtesy", phrase: ["formal politeness", "正式礼貌"] },
  { head: "sainthood", cut: "saint/hood", cutMeaning: "圣人/身份；状态", pos: "n.", zh: "圣徒身份；圣洁", gloss: "state of being a saint", phrase: ["perform sainthood", "表现圣洁"] },
  { head: "solemnity", cut: "solemn/ity", cutMeaning: "庄严/名词", pos: "n.", zh: "庄严；严肃", gloss: "seriousness", phrase: ["ceremonial solemnity", "仪式的庄严"] },
  { head: "stillness", cut: "still/ness", cutMeaning: "静止；安静/名词", pos: "n.", zh: "寂静；静止", gloss: "quietness", phrase: ["absolute stillness", "绝对寂静"] },
  { head: "stubbornness", cut: "stubborn/ness", cutMeaning: "固执/名词", pos: "n.", zh: "固执；倔强", gloss: "obstinacy", phrase: ["quiet stubbornness", "安静的固执"] },
  { head: "thoughtful", cut: "thought/ful", cutMeaning: "想法；思考/充满", pos: "adj.", zh: "体贴的；深思的", gloss: "considerate", phrase: ["a thoughtful gesture", "体贴的举动"] },
  { head: "uselessness", cut: "use/less/ness", cutMeaning: "使用/无；缺少/名词", pos: "n.", zh: "无用；无能为力", gloss: "lack of usefulness", phrase: ["a sense of uselessness", "无用感"] },
  { head: "visibility", cut: "vis/ibil/ity", cutMeaning: "看/能够；可/名词", pos: "n.", zh: "可见度；能见度", gloss: "ability to be seen", phrase: ["low visibility", "低能见度"] },
  { head: "vulgarity", cut: "vulgar/ity", cutMeaning: "粗俗/名词", pos: "n.", zh: "粗俗；庸俗", gloss: "crudeness", phrase: ["avoid vulgarity", "避免粗俗"] },
  { head: "unsupported", cut: "un/support/ed", cutMeaning: "不；相反/支持/形容词", pos: "adj.", zh: "无支持的；无根据的", gloss: "not supported", phrase: ["unsupported claim", "无根据的说法"] },
  { head: "disinfectant", cut: "dis/infect/ant", cutMeaning: "分开；除去/感染/名词", pos: "n./adj.", zh: "消毒剂；消毒的", gloss: "germ-killing substance", phrase: ["smell of disinfectant", "消毒水味"] },
  { head: "disqualifies", cut: "dis/qual/ify/s", cutMeaning: "否定；分开/资格/使成为/第三人称", pos: "v.", zh: "取消资格", gloss: "makes ineligible", phrase: ["disqualifies a candidate", "取消候选人资格"] },
  { head: "distressingly", cut: "distress/ing/ly", cutMeaning: "痛苦；忧虑/形容词/副词", pos: "adv.", zh: "令人痛苦地；令人不安地", gloss: "upsettingly", phrase: ["distressingly quiet", "安静得令人不安"] },
  { head: "immaculate", cut: "im/macul/ate", cutMeaning: "不；无/污点/形容词", pos: "adj.", zh: "一尘不染的；完美的", gloss: "spotless", phrase: ["immaculate uniform", "一尘不染的制服"] },
  { head: "inquiry", cut: "in/quir/y", cutMeaning: "进入；向内/询问/名词", pos: "n.", zh: "询问；调查", gloss: "question, investigation", phrase: ["formal inquiry", "正式调查"] },
  { head: "insane", cut: "in/sane", cutMeaning: "不；无/理智；健全", pos: "adj.", zh: "疯狂的；精神失常的", gloss: "mad, irrational", phrase: ["an insane risk", "疯狂的风险"] },
  { head: "insufferably", cut: "in/suffer/able/ly", cutMeaning: "不；无/忍受/能够；可/副词", pos: "adv.", zh: "令人无法忍受地", gloss: "unbearably", phrase: ["insufferably polite", "礼貌得令人难受"] },
  { head: "intimidate", cut: "in/timid/ate", cutMeaning: "使进入/胆怯/动词", pos: "v.", zh: "恐吓；使胆怯", gloss: "frighten, threaten", phrase: ["intimidate a witness", "恐吓证人"] },
  { head: "overhead", cut: "over/head", cutMeaning: "在上；超过/头", pos: "adj./adv./n.", zh: "头顶上的；在头顶上；经费开销", gloss: "above, operating cost", phrase: ["overhead lights", "头顶灯"] },
  { head: "regret", cut: "re/gret", cutMeaning: "回；反复/悲伤；懊悔", pos: "n./v.", zh: "后悔；遗憾", gloss: "sadness about the past", phrase: ["regret the decision", "后悔这个决定"] },
  { head: "respite", cut: "re/spite", cutMeaning: "再次；缓和/看；延缓", pos: "n.", zh: "暂缓；喘息", gloss: "short rest", phrase: ["a brief respite", "短暂喘息"] },
  { head: "underpaid", cut: "under/pay/ed", cutMeaning: "不足；在下/支付/形容词", pos: "adj.", zh: "薪酬过低的", gloss: "paid too little", phrase: ["underpaid staff", "低薪员工"] },
  { head: "unfolds", cut: "un/fold/s", cutMeaning: "打开；展开/折叠/第三人称", pos: "v.", zh: "展开；逐渐显现", gloss: "opens, develops", phrase: ["the scene unfolds", "场景展开"] },
  { head: "unlock", cut: "un/lock", cutMeaning: "打开；解除/锁", pos: "v.", zh: "解锁；开启", gloss: "open a lock", phrase: ["unlock the door", "解锁门"] },
  { head: "unpaid", cut: "un/pay/ed", cutMeaning: "不；未/支付/形容词", pos: "adj.", zh: "未付款的；无薪的", gloss: "not paid", phrase: ["unpaid work", "无薪工作"] },
  { head: "unpleasant", cut: "un/pleasant", cutMeaning: "不；相反/令人愉快", pos: "adj.", zh: "令人不快的", gloss: "disagreeable", phrase: ["an unpleasant truth", "令人不快的真相"] },
  { head: "untidy", cut: "un/tidy", cutMeaning: "不；相反/整洁", pos: "adj.", zh: "不整洁的", gloss: "messy", phrase: ["an untidy room", "凌乱的房间"] }
  ,{ head: "interested", cut: "interest/ed", cutMeaning: "兴趣；利益/形容词", pos: "adj.", zh: "感兴趣的；关心的", gloss: "curious, concerned", phrase: ["interested in history", "对历史感兴趣"] }
  ,{ head: "geologic", cut: "geo/log/ic", cutMeaning: "地球；土地/学；研究/形容词", pos: "adj.", zh: "地质的", gloss: "geological", phrase: ["geologic time", "地质时间"] }
  ,{ head: "immunize", cut: "immun/ize", cutMeaning: "免疫/动词", pos: "v.", zh: "使免疫；给…接种", gloss: "vaccinate", phrase: ["immunize children", "给儿童接种免疫"] }
  ,{ head: "immunization", cut: "immun/iz/ation", cutMeaning: "免疫/动词/名词", pos: "n.", zh: "免疫；免疫接种", gloss: "vaccination", phrase: ["childhood immunization", "儿童免疫接种"] }
  ,{ head: "organisation", cut: "organ/is/ation", cutMeaning: "组织/动词/名词", pos: "n.", zh: "组织；机构", gloss: "organization", phrase: ["international organisation", "国际组织"] }
  ,{ head: "organization", cut: "organ/iz/ation", cutMeaning: "组织/动词/名词", pos: "n.", zh: "组织；机构", gloss: "institution, group", phrase: ["community organization", "社区组织"] }
  ,{ head: "organizational", cut: "organ/iz/ation/al", cutMeaning: "组织/动词/名词/形容词", pos: "adj.", zh: "组织的；机构的", gloss: "institutional", phrase: ["organizational structure", "组织结构"] }
  ,{ head: "constructionism", cut: "construct/ion/ism", cutMeaning: "建造；构成/名词/主义", pos: "n.", zh: "建构主义", gloss: "constructionist theory", phrase: ["social constructionism", "社会建构主义"] }
  ,{ head: "constructionist", cut: "construct/ion/ist", cutMeaning: "建造；构成/名词/人；形容词", pos: "n./adj.", zh: "建构主义者；建构主义的", gloss: "constructionism-related", phrase: ["constructionist view", "建构主义观点"] }
  ,{ head: "dependability", cut: "depend/ability", cutMeaning: "依靠/能力；性质", pos: "n.", zh: "可靠性；可信赖性", gloss: "reliability", phrase: ["system dependability", "系统可靠性"] }
  ,{ head: "dependably", cut: "depend/ably", cutMeaning: "依靠/副词", pos: "adv.", zh: "可靠地；可信赖地", gloss: "reliably", phrase: ["work dependably", "可靠地运行"] }
  ,{ head: "digitalization", cut: "digit/al/iz/ation", cutMeaning: "数字/形容词/动词/名词", pos: "n.", zh: "数字化", gloss: "digitization", phrase: ["service digitalization", "服务数字化"] }
  ,{ head: "inventiveness", cut: "invent/ive/ness", cutMeaning: "发明；创造/形容词/名词", pos: "n.", zh: "创造力；发明才能", gloss: "creativity", phrase: ["technical inventiveness", "技术创造力"] }
  ,{ head: "productiveness", cut: "product/ive/ness", cutMeaning: "产品；产出/形容词/名词", pos: "n.", zh: "生产力；多产性", gloss: "productivity", phrase: ["economic productiveness", "经济生产力"] }
  ,{ head: "usefulness", cut: "use/ful/ness", cutMeaning: "使用/充满/名词", pos: "n.", zh: "有用性；实用性", gloss: "utility", phrase: ["practical usefulness", "实际有用性"] }
  ,{ head: "carefulness", cut: "care/ful/ness", cutMeaning: "关心；谨慎/充满/名词", pos: "n.", zh: "谨慎；仔细", gloss: "caution", phrase: ["scientific carefulness", "科学上的谨慎"] }
  ,{ head: "carelessness", cut: "care/less/ness", cutMeaning: "关心；谨慎/缺少/名词", pos: "n.", zh: "粗心；疏忽", gloss: "negligence", phrase: ["dangerous carelessness", "危险的粗心"] }
  ,{ head: "connectedness", cut: "connect/ed/ness", cutMeaning: "连接/形容词/名词", pos: "n.", zh: "连接性；关联感", gloss: "connection, relatedness", phrase: ["social connectedness", "社会连接感"] }
  ,{ head: "interpretable", cut: "interpret/able", cutMeaning: "解释；理解/能够；可", pos: "adj.", zh: "可解释的；可理解的", gloss: "explainable", phrase: ["interpretable data", "可解释的数据"] }
  ,{ head: "scriptural", cut: "script/ur/al", cutMeaning: "写；经文/名词/形容词", pos: "adj.", zh: "经文的；经典的", gloss: "scripture-related", phrase: ["scriptural tradition", "经文传统"] }
  ,{ head: "treatable", cut: "treat/able", cutMeaning: "处理；治疗/能够；可", pos: "adj.", zh: "可治疗的；可处理的", gloss: "curable, manageable", phrase: ["a treatable disease", "可治疗的疾病"] }
  ,{ head: "abnormality", cut: "ab/normal/ity", cutMeaning: "偏离；不/正常/名词", pos: "n.", zh: "异常；反常", gloss: "irregularity", phrase: ["detect an abnormality", "发现异常"] }
  ,{ head: "awkwardness", cut: "awkward/ness", cutMeaning: "尴尬；笨拙/名词", pos: "n.", zh: "尴尬；笨拙", gloss: "clumsiness, discomfort", phrase: ["social awkwardness", "社交尴尬"] }
  ,{ head: "brightness", cut: "bright/ness", cutMeaning: "明亮；聪明/名词", pos: "n.", zh: "亮度；明亮", gloss: "light intensity", phrase: ["screen brightness", "屏幕亮度"] }
  ,{ head: "denial", cut: "deny/al", cutMeaning: "否认；拒绝/名词", pos: "n.", zh: "否认；拒绝", gloss: "refusal", phrase: ["official denial", "官方否认"] }
  ,{ head: "dictatorial", cut: "dict/ator/ial", cutMeaning: "说；命令/人；统治者/形容词", pos: "adj.", zh: "独裁的；专横的", gloss: "authoritarian", phrase: ["dictatorial control", "独裁控制"] }
  ,{ head: "expandable", cut: "ex/pand/able", cutMeaning: "向外/展开/能够；可", pos: "adj.", zh: "可扩展的；可展开的", gloss: "extendable", phrase: ["expandable storage", "可扩展存储"] }
  ,{ head: "incitement", cut: "in/cit/e/ment", cutMeaning: "进入；加强/呼唤；激起/动词/名词", pos: "n.", zh: "煽动；刺激", gloss: "provocation", phrase: ["incitement to violence", "煽动暴力"] }
  ,{ head: "incorporation", cut: "in/corpor/ation", cutMeaning: "进入/身体；整体/名词", pos: "n.", zh: "合并；纳入；公司成立", gloss: "inclusion, formation", phrase: ["legal incorporation", "法人注册"] }
  ,{ head: "reflective", cut: "re/flect/ive", cutMeaning: "回；反/弯曲；反射/形容词", pos: "adj.", zh: "反思的；反射的", gloss: "thoughtful, mirror-like", phrase: ["reflective practice", "反思性实践"] }
  ,{ head: "reviser", cut: "re/vis/er", cutMeaning: "再次；重新/看/人", pos: "n.", zh: "修订者；复习者", gloss: "person who revises", phrase: ["careful reviser", "细心的修订者"] }
  ,{ head: "consultative", cut: "consult/ative", cutMeaning: "咨询；商议/形容词", pos: "adj.", zh: "咨询的；协商的", gloss: "advisory", phrase: ["consultative process", "协商过程"] }
  ,{ head: "describable", cut: "de/scrib/able", cutMeaning: "向下；完全/写；描述/能够；可", pos: "adj.", zh: "可描述的", gloss: "able to be described", phrase: ["clearly describable pattern", "清楚可描述的模式"] }
  ,{ head: "identifiable", cut: "ident/ify/able", cutMeaning: "身份；相同/使成为/能够；可", pos: "adj.", zh: "可识别的；可确认的", gloss: "recognizable", phrase: ["identifiable features", "可识别特征"] }
  ,{ head: "inspiring", cut: "in/spir/ing", cutMeaning: "进入；加强/呼吸；精神/形容词", pos: "adj.", zh: "鼓舞人心的；启发性的", gloss: "encouraging", phrase: ["an inspiring speech", "鼓舞人心的演讲"] }
  ,{ head: "mergeable", cut: "merge/able", cutMeaning: "合并；融合/能够；可", pos: "adj.", zh: "可合并的", gloss: "able to merge", phrase: ["mergeable records", "可合并记录"] }
  ,{ head: "nutritional", cut: "nutrit/ion/al", cutMeaning: "滋养；营养/名词/形容词", pos: "adj.", zh: "营养的；营养学的", gloss: "dietary", phrase: ["nutritional value", "营养价值"] }
  ,{ head: "supporter", cut: "support/er", cutMeaning: "支持/人", pos: "n.", zh: "支持者；拥护者", gloss: "backer", phrase: ["strong supporter", "坚定支持者"] }
  ,{ head: "reasonableness", cut: "reason/able/ness", cutMeaning: "理由；理性/能够；可/名词", pos: "n.", zh: "合理性；理性", gloss: "fairness, logic", phrase: ["test reasonableness", "检验合理性"] }
  ,{ head: "reasoner", cut: "reason/er", cutMeaning: "推理；理由/人", pos: "n.", zh: "推理者；论证者", gloss: "logical thinker", phrase: ["careful reasoner", "谨慎的推理者"] }
  ,{ head: "understandability", cut: "under/stand/ability", cutMeaning: "充分；在下/站立；理解/能力；性质", pos: "n.", zh: "可理解性", gloss: "clarity", phrase: ["text understandability", "文本可理解性"] }
  ,{ head: "understandably", cut: "under/stand/ably", cutMeaning: "充分；在下/站立；理解/副词", pos: "adv.", zh: "可以理解地；合情合理地", gloss: "reasonably", phrase: ["understandably cautious", "可以理解地谨慎"] }
  ,{ head: "announcer", cut: "an/nounce/er", cutMeaning: "向；加强/报告；宣布/人", pos: "n.", zh: "播音员；宣布者", gloss: "speaker, presenter", phrase: ["radio announcer", "电台播音员"] }
  ,{ head: "conflictingly", cut: "con/flict/ing/ly", cutMeaning: "共同；相互/冲突/形容词/副词", pos: "adv.", zh: "冲突地；矛盾地", gloss: "contradictorily", phrase: ["answer conflictingly", "回答得相互矛盾"] }
  ,{ head: "internationalise", cut: "inter/nation/al/ise", cutMeaning: "之间；相互/民族；国家/形容词/动词", pos: "v.", zh: "使国际化", gloss: "make international", phrase: ["internationalise education", "使教育国际化"] }
  ,{ head: "predictive", cut: "pre/dict/ive", cutMeaning: "在前；预先/说；断言/形容词", pos: "adj.", zh: "预测性的；预示的", gloss: "forecasting", phrase: ["predictive model", "预测模型"] }
  ,{ head: "believability", cut: "believe/ability", cutMeaning: "相信/能力；性质", pos: "n.", zh: "可信度；可信性", gloss: "credibility", phrase: ["story believability", "故事可信度"] }
  ,{ head: "believably", cut: "believe/ably", cutMeaning: "相信/副词", pos: "adv.", zh: "可信地；真实可信地", gloss: "credibly", phrase: ["act believably", "演得可信"] }
  ,{ head: "clearness", cut: "clear/ness", cutMeaning: "清楚；明亮/名词", pos: "n.", zh: "清楚；明晰", gloss: "clarity", phrase: ["clearness of explanation", "解释的清晰度"] }
  ,{ head: "harmfulness", cut: "harm/ful/ness", cutMeaning: "伤害/充满/名词", pos: "n.", zh: "有害性；危害程度", gloss: "damage potential", phrase: ["chemical harmfulness", "化学有害性"] }
  ,{ head: "accountably", cut: "account/ably", cutMeaning: "说明；负责/副词", pos: "adv.", zh: "负责任地；可问责地", gloss: "responsibly", phrase: ["act accountably", "负责任地行动"] }
  ,{ head: "finality", cut: "final/ity", cutMeaning: "最终；最后/名词", pos: "n.", zh: "终局性；最终性", gloss: "conclusiveness", phrase: ["sense of finality", "终局感"] }
  ,{ head: "localisation", cut: "local/is/ation", cutMeaning: "本地；地方/动词/名词", pos: "n.", zh: "本地化；定位", gloss: "localization", phrase: ["software localisation", "软件本地化"] }
  ,{ head: "specificity", cut: "spec/ific/ity", cutMeaning: "看；种类/使成为；具体/名词", pos: "n.", zh: "具体性；特异性", gloss: "precision", phrase: ["diagnostic specificity", "诊断特异性"] }
  ,{ head: "quantifiable", cut: "quant/ify/able", cutMeaning: "数量/使成为/能够；可", pos: "adj.", zh: "可量化的", gloss: "measurable", phrase: ["quantifiable benefit", "可量化收益"] }
  ,{ head: "suggester", cut: "suggest/er", cutMeaning: "建议；暗示/人", pos: "n.", zh: "建议者；提出者", gloss: "one who suggests", phrase: ["original suggester", "最初建议者"] }
  ,{ head: "thoroughness", cut: "thorough/ness", cutMeaning: "彻底；全面/名词", pos: "n.", zh: "彻底；细致", gloss: "completeness", phrase: ["research thoroughness", "研究的细致程度"] }
  ,{ head: "judgment", cut: "judg/ment", cutMeaning: "判断；裁决/名词", pos: "n.", zh: "判断；判决", gloss: "decision, opinion", phrase: ["sound judgment", "明智判断"] }
  ,{ head: "practicality", cut: "practic/al/ity", cutMeaning: "实践；实际/形容词/名词", pos: "n.", zh: "实用性；可行性", gloss: "usefulness, feasibility", phrase: ["practicality of the plan", "计划的可行性"] }
  ,{ head: "circularity", cut: "circul/ar/ity", cutMeaning: "圆；循环/形容词/名词", pos: "n.", zh: "圆形；循环性", gloss: "roundness, circular logic", phrase: ["logical circularity", "逻辑循环"] }
  ,{ head: "periodical", cut: "period/ic/al", cutMeaning: "时期；周期/形容词/形容词", pos: "n./adj.", zh: "期刊；周期性的", gloss: "journal, periodic", phrase: ["academic periodical", "学术期刊"] }
  ,{ head: "relocation", cut: "re/loc/ation", cutMeaning: "重新/地方；位置/名词", pos: "n.", zh: "迁移；重新安置", gloss: "move, resettlement", phrase: ["resident relocation", "居民搬迁"] }
  ,{ head: "strenuously", cut: "strenu/ous/ly", cutMeaning: "用力；奋力/形容词/副词", pos: "adv.", zh: "竭力地；奋力地", gloss: "vigorously", phrase: ["argue strenuously", "竭力争辩"] }
  ,{ head: "gainfulness", cut: "gain/ful/ness", cutMeaning: "获得；收益/充满/名词", pos: "n.", zh: "有利；获益性", gloss: "profitability", phrase: ["economic gainfulness", "经济获益性"] }
  ,{ head: "nativeness", cut: "native/ness", cutMeaning: "本地的；天生的/名词", pos: "n.", zh: "本土性；天生性", gloss: "native quality", phrase: ["linguistic nativeness", "语言本土性"] }
  ,{ head: "financier", cut: "finance/ier", cutMeaning: "金融；资金/人", pos: "n.", zh: "金融家；出资人", gloss: "funding person", phrase: ["private financier", "私人出资人"] }
  ,{ head: "donor", cut: "don/or", cutMeaning: "给予/人", pos: "n.", zh: "捐赠者；供体", gloss: "giver", phrase: ["a private donor", "私人捐赠者"] }
  ,{ head: "difficult", cut: "diffi/cult", cutMeaning: "困难/培养；处理", pos: "adj.", zh: "困难的；难相处的", gloss: "hard", phrase: ["a difficult choice", "困难的选择"] }
  ,{ head: "apron", cut: "apron", cutMeaning: "围裙", pos: "n.", zh: "围裙", gloss: "protective garment", phrase: ["wear an apron", "穿围裙"] }
  ,{ head: "brave", cut: "brave", cutMeaning: "勇敢", pos: "adj./v.", zh: "勇敢的；勇敢面对", gloss: "courageous", phrase: ["brave enough", "足够勇敢"] }
  ,{ head: "napkin", cut: "nap/kin", cutMeaning: "餐巾/小物", pos: "n.", zh: "餐巾；纸巾", gloss: "table cloth", phrase: ["fold a napkin", "折餐巾"] }
  ,{ head: "pregnant", cut: "pregn/ant", cutMeaning: "怀孕；充满/形容词", pos: "adj.", zh: "怀孕的；意味深长的", gloss: "expecting, meaningful", phrase: ["a pregnant pause", "意味深长的停顿"] }
  ,{ head: "tablet", cut: "tabl/et", cutMeaning: "板；桌/小物", pos: "n.", zh: "平板电脑；药片", gloss: "pad, pill", phrase: ["a tablet screen", "平板屏幕"] }
  ,{ head: "badge", cut: "badge", cutMeaning: "徽章；标记", pos: "n.", zh: "徽章；标识", gloss: "sign, mark", phrase: ["wear a badge", "佩戴徽章"] }
  ,{ head: "cardigan", cut: "cardigan", cutMeaning: "开襟羊毛衫", pos: "n.", zh: "开襟衫；羊毛衫", gloss: "knitted jacket", phrase: ["a soft cardigan", "柔软的开襟衫"] }
  ,{ head: "dumplings", cut: "dumpl/ing/s", cutMeaning: "团子；饺子/名词/复数", pos: "n.", zh: "饺子；团子", gloss: "filled dough food", phrase: ["share dumplings", "一起吃饺子"] }
  ,{ head: "furniture", cut: "furn/iture", cutMeaning: "供应；装设/名词", pos: "n.", zh: "家具", gloss: "movable household items", phrase: ["office furniture", "办公家具"] }
  ,{ head: "blazer", cut: "blaz/er", cutMeaning: "闪耀；火焰/物", pos: "n.", zh: "西装外套；运动夹克", gloss: "jacket", phrase: ["a navy blazer", "海军蓝西装外套"] }
  ,{ head: "booklet", cut: "book/let", cutMeaning: "书/小物", pos: "n.", zh: "小册子", gloss: "small book", phrase: ["an information booklet", "信息小册子"] }
  ,{ head: "dislike", cut: "dis/like", cutMeaning: "否定；分开/喜欢", pos: "n./v.", zh: "不喜欢；厌恶", gloss: "not like", phrase: ["hide her dislike", "掩饰她的不喜欢"] }
  ,{ head: "charming", cut: "charm/ing", cutMeaning: "魅力/形容词", pos: "adj.", zh: "迷人的；讨人喜欢的", gloss: "attractive", phrase: ["a charming smile", "迷人的微笑"] }
  ,{ head: "doorway", cut: "door/way", cutMeaning: "门/道路", pos: "n.", zh: "门口；出入口", gloss: "entrance", phrase: ["stand in the doorway", "站在门口"] }
  ,{ head: "espresso", cut: "espresso", cutMeaning: "浓缩咖啡", pos: "n.", zh: "浓缩咖啡", gloss: "strong coffee", phrase: ["order an espresso", "点一杯浓缩咖啡"] }
  ,{ head: "velvet", cut: "velvet", cutMeaning: "天鹅绒", pos: "n./adj.", zh: "天鹅绒；柔软的", gloss: "soft fabric", phrase: ["velvet curtains", "天鹅绒窗帘"] }
  ,{ head: "compasses", cut: "com/pass/es", cutMeaning: "共同；完全/步；测量/复数", pos: "n.", zh: "圆规；罗盘", gloss: "measuring tools", phrase: ["a pair of compasses", "一副圆规"] }
  ,{ head: "dataset", cut: "data/set", cutMeaning: "数据/集合", pos: "n.", zh: "数据集", gloss: "data collection", phrase: ["training dataset", "训练数据集"] }
  ,{ head: "metronome", cut: "metr/o/nom/e", cutMeaning: "测量/词尾/规则/词尾", pos: "n.", zh: "节拍器", gloss: "timing device", phrase: ["a ticking metronome", "滴答作响的节拍器"] }
  ,{ head: "obedient", cut: "ob/edi/ent", cutMeaning: "朝向；加强/听从/形容词", pos: "adj.", zh: "顺从的；服从的", gloss: "compliant", phrase: ["obedient silence", "顺从的沉默"] }
  ,{ head: "restroom", cut: "rest/room", cutMeaning: "休息/房间", pos: "n.", zh: "洗手间；厕所", gloss: "toilet", phrase: ["find the restroom", "找到洗手间"] }
  ,{ head: "scooter", cut: "scoot/er", cutMeaning: "快速移动/物", pos: "n.", zh: "踏板车；小型摩托车", gloss: "small vehicle", phrase: ["ride a scooter", "骑踏板车"] }
  ,{ head: "raincoats", cut: "rain/coat/s", cutMeaning: "雨/外套/复数", pos: "n.", zh: "雨衣", gloss: "waterproof coats", phrase: ["wet raincoats", "湿雨衣"] }
  ,{ head: "visibly", cut: "vis/ible/ly", cutMeaning: "看/能够；可/副词", pos: "adv.", zh: "明显地；看得见地", gloss: "noticeably", phrase: ["visibly nervous", "明显紧张"] }
  ,{ head: "waiter", cut: "wait/er", cutMeaning: "等待；服务/人", pos: "n.", zh: "服务员；男侍者", gloss: "server", phrase: ["call the waiter", "叫服务员"] }
  ,{ head: "worried", cut: "worri/ed", cutMeaning: "担忧/形容词", pos: "adj.", zh: "担心的；焦虑的", gloss: "anxious", phrase: ["look worried", "看起来担心"] }
  ,{ head: "advise", cut: "ad/vis/e", cutMeaning: "向；加强/看；考虑/词尾", pos: "v.", zh: "建议；劝告", gloss: "recommend", phrase: ["advise caution", "建议谨慎"] }
  ,{ head: "compresses", cut: "com/press/es", cutMeaning: "共同；加强/压/第三人称", pos: "v.", zh: "压缩；压紧", gloss: "press together", phrase: ["compresses the file", "压缩文件"] }
  ,{ head: "contingent", cut: "con/tang/ent", cutMeaning: "共同；加强/接触；取决于/形容词", pos: "adj./n.", zh: "取决于的；代表团", gloss: "dependent, group", phrase: ["contingent on approval", "取决于批准"] }
  ,{ head: "criticise", cut: "crit/ic/ise", cutMeaning: "判断；批评/形容词/动词", pos: "v.", zh: "批评；评论", gloss: "criticize", phrase: ["criticise the plan", "批评计划"] }
  ,{ head: "denominated", cut: "de/nomin/at/ed", cutMeaning: "向下；指定/命名/动词/形容词", pos: "adj.", zh: "以……计价的；命名的", gloss: "named, valued in", phrase: ["dollar-denominated debt", "美元计价债务"] }
  ,{ head: "deranged", cut: "de/rang/ed", cutMeaning: "离开；扰乱/排列；秩序/形容词", pos: "adj.", zh: "疯狂的；精神错乱的", gloss: "mad, disordered", phrase: ["a deranged idea", "疯狂的想法"] }
  ,{ head: "displeased", cut: "dis/pleas/ed", cutMeaning: "否定；分开/取悦/形容词", pos: "adj.", zh: "不高兴的；不满的", gloss: "annoyed", phrase: ["look displeased", "看起来不满"] }
  ,{ head: "institutionalised", cut: "in/stitut/ion/al/ised", cutMeaning: "进入；使/建立；放置/名词/形容词/动词", pos: "adj.", zh: "制度化的；被机构收容的", gloss: "made institutional", phrase: ["institutionalised habit", "制度化习惯"] }
  ,{ head: "audacious", cut: "aud/acious", cutMeaning: "敢；大胆/形容词", pos: "adj.", zh: "大胆的；鲁莽的", gloss: "bold, daring", phrase: ["an audacious plan", "大胆计划"], example: ["The audacious proposal surprised officials who expected a safer design.", "这个大胆提议让原本期待更保守设计的官员感到惊讶。"] }
  ,{ head: "drumlin", cut: "druml/in", cutMeaning: "小山脊/名词", pos: "n.", zh: "鼓丘；冰碛丘", gloss: "glacial hill", phrase: ["a glacial drumlin", "冰川鼓丘"], example: ["A drumlin can show the direction in which ancient ice once moved.", "鼓丘可以显示古代冰川曾经移动的方向。"] }
  ,{ head: "hippopotamus", cut: "hippo/potam/us", cutMeaning: "马/河流/名词", pos: "n.", zh: "河马", gloss: "river horse", phrase: ["a river hippopotamus", "河马"], example: ["A hippopotamus spends much of the day in water to keep its skin cool.", "河马一天中大部分时间待在水里以保持皮肤凉爽。"] }
  ,{ head: "immaterially", cut: "im/material/ly", cutMeaning: "不；无/物质；材料/副词", pos: "adv.", zh: "无关紧要地；非物质地", gloss: "insignificantly", phrase: ["change immaterially", "变化不大"], example: ["The correction changed the total immaterially and did not affect the conclusion.", "这项修正对总数影响很小，并未影响结论。"] }
  ,{ head: "impressionist", cut: "im/press/ion/ist", cutMeaning: "进入；使/压；印/名词/人", pos: "n./adj.", zh: "印象派艺术家；印象派的", gloss: "impressionist artist", phrase: ["an impressionist painter", "印象派画家"], example: ["The impressionist painter used light rather than sharp outlines.", "这位印象派画家使用光影而不是清晰轮廓。"] }
  ,{ head: "instructional", cut: "in/struct/ion/al", cutMeaning: "进入/建立；指导/名词/形容词", pos: "adj.", zh: "教学的；指导性的", gloss: "educational", phrase: ["instructional material", "教学材料"], example: ["Instructional videos helped students repeat the experiment safely.", "教学视频帮助学生安全地重复实验。"] }
  ,{ head: "intertwine", cut: "inter/twine", cutMeaning: "相互；之间/缠绕", pos: "v.", zh: "交织；缠绕", gloss: "weave together", phrase: ["intertwine stories", "交织故事"], example: ["Trade and politics often intertwine in the history of ports.", "贸易和政治在港口历史中常常交织在一起。"] }
  ,{ head: "isotherm", cut: "iso/therm", cutMeaning: "相等/热", pos: "n.", zh: "等温线", gloss: "equal-temperature line", phrase: ["draw an isotherm", "绘制等温线"], example: ["An isotherm links places that share the same temperature.", "等温线连接温度相同的地点。"] }
  ,{ head: "manufacturing", cut: "manu/fact/ur/ing", cutMeaning: "手/做/名词/名词", pos: "n./adj.", zh: "制造业；制造的", gloss: "production", phrase: ["manufacturing cost", "制造成本"], example: ["Manufacturing moved closer to the port after transport improved.", "运输改善后，制造业向港口附近转移。"] }
  ,{ head: "marginalise", cut: "margin/al/ise", cutMeaning: "边缘/形容词/动词", pos: "v.", zh: "使边缘化", gloss: "push aside", phrase: ["marginalise small groups", "边缘化小群体"], example: ["A policy can marginalise residents who lack documents.", "一项政策可能会边缘化缺少证件的居民。"] }
  ,{ head: "mathematic", cut: "math/emat/ic", cutMeaning: "学习；数学/结果/形容词", pos: "adj.", zh: "数学的", gloss: "mathematical", phrase: ["mathematic reasoning", "数学推理"], example: ["Mathematic reasoning made the pattern easier to test.", "数学推理使这种模式更容易检验。"] }
  ,{ head: "metaphysic", cut: "meta/phys/ic", cutMeaning: "超越/自然；物质/形容词", pos: "n./adj.", zh: "形而上学；形而上的", gloss: "metaphysical thought", phrase: ["a metaphysic question", "形而上问题"], example: ["The debate became metaphysic when evidence could no longer decide it.", "当证据无法再裁定时，争论变成了形而上问题。"] }
  ,{ head: "neurogenesis", cut: "neuro/genesis", cutMeaning: "神经/产生；形成", pos: "n.", zh: "神经发生；神经生成", gloss: "nerve-cell formation", phrase: ["adult neurogenesis", "成人神经生成"], example: ["Neurogenesis may continue in parts of the adult brain.", "神经生成可能在成年大脑的某些区域继续发生。"] }
  ,{ head: "neurosis", cut: "neur/osis", cutMeaning: "神经/状态；病症", pos: "n.", zh: "神经症", gloss: "anxiety disorder", phrase: ["mild neurosis", "轻度神经症"], example: ["The old diagnosis treated chronic anxiety as a form of neurosis.", "旧诊断把长期焦虑视为神经症的一种。"] }
  ,{ head: "optimise", cut: "optim/ise", cutMeaning: "最好/动词", pos: "v.", zh: "优化；使最佳", gloss: "improve, maximize", phrase: ["optimise performance", "优化性能"], example: ["Engineers optimise the system to reduce wasted energy.", "工程师优化系统以减少能源浪费。"] }
  ,{ head: "organiser", cut: "organ/is/er", cutMeaning: "器官；组织/动词/人", pos: "n.", zh: "组织者；整理工具", gloss: "planner", phrase: ["event organiser", "活动组织者"], example: ["The organiser changed the schedule after heavy rain.", "组织者在大雨后更改了日程。"] }
  ,{ head: "outburst", cut: "out/burst", cutMeaning: "向外/爆发", pos: "n.", zh: "爆发；突然发作", gloss: "eruption", phrase: ["an emotional outburst", "情绪爆发"], example: ["The outburst revealed public anger over the new rule.", "这次爆发显示出公众对新规则的愤怒。"] }
  ,{ head: "overthrow", cut: "over/throw", cutMeaning: "翻转；超过/投掷", pos: "v./n.", zh: "推翻；打倒", gloss: "topple", phrase: ["overthrow a regime", "推翻政权"], example: ["The rebels tried to overthrow the old regime.", "叛军试图推翻旧政权。"] }
  ,{ head: "overwhelming", cut: "over/whelm/ing", cutMeaning: "过度；压倒/淹没/形容词", pos: "adj.", zh: "压倒性的；巨大的", gloss: "enormous, overpowering", phrase: ["overwhelming evidence", "压倒性证据"], example: ["Overwhelming evidence forced the committee to change its report.", "压倒性证据迫使委员会修改报告。"] }
  ,{ head: "perilous", cut: "peril/ous", cutMeaning: "危险/形容词", pos: "adj.", zh: "危险的；艰险的", gloss: "dangerous", phrase: ["a perilous journey", "危险旅程"], example: ["The mountain route became perilous after the snowstorm.", "暴风雪后，山路变得危险。"] }
  ,{ head: "pineal", cut: "pine/al", cutMeaning: "松果/形容词", pos: "adj.", zh: "松果体的", gloss: "relating to pineal gland", phrase: ["pineal gland", "松果体"], example: ["The pineal gland responds to changes in light.", "松果体会对光线变化作出反应。"] }
  ,{ head: "politic", cut: "polit/ic", cutMeaning: "城市；政治/形容词", pos: "adj.", zh: "明智的；策略性的", gloss: "prudent, tactical", phrase: ["a politic answer", "策略性的回答"], example: ["Silence was the politic choice during the tense meeting.", "在紧张会议上，沉默是明智选择。"] }
  ,{ head: "positioning", cut: "posit/ion/ing", cutMeaning: "放置/名词/名词", pos: "n.", zh: "定位；安置", gloss: "placement", phrase: ["careful positioning", "谨慎定位"], example: ["Careful positioning of sensors improved the accuracy of the data.", "传感器的谨慎定位提高了数据准确性。"] }
  ,{ head: "practise", cut: "pract/ise", cutMeaning: "行动；实践/动词", pos: "v.", zh: "练习；实践", gloss: "practice", phrase: ["practise regularly", "定期练习"], example: ["Students practise the method before using it in the field.", "学生在实地使用该方法前先练习。"] }
  ,{ head: "practitioner", cut: "pract/ition/er", cutMeaning: "行动；实践/名词/人", pos: "n.", zh: "从业者；实践者", gloss: "professional", phrase: ["medical practitioner", "医疗从业者"], example: ["A skilled practitioner can adapt general rules to local needs.", "熟练从业者能把通用规则适应本地需求。"] }
  ,{ head: "preposterous", cut: "pre/poster/ous", cutMeaning: "在前/在后；相反/形容词", pos: "adj.", zh: "荒谬的；离谱的", gloss: "absurd", phrase: ["a preposterous claim", "荒谬说法"], example: ["The claim sounded preposterous until the hidden data appeared.", "在隐藏数据出现前，这个说法听起来很荒谬。"] }
  ,{ head: "quarterly", cut: "quarter/ly", cutMeaning: "四分之一；季度/副词", pos: "adv./adj.", zh: "每季度；季度的", gloss: "every three months", phrase: ["quarterly report", "季度报告"], example: ["The company publishes a quarterly report on energy use.", "公司每季度发布一份能源使用报告。"] }
  ,{ head: "radial", cut: "rad/ial", cutMeaning: "射线；半径/形容词", pos: "adj.", zh: "放射状的；径向的", gloss: "ray-like", phrase: ["radial pattern", "放射状图案"], example: ["The city grew in a radial pattern around the old market.", "城市围绕旧市场呈放射状发展。"] }
  ,{ head: "reasoning", cut: "reason/ing", cutMeaning: "理由；推理/名词", pos: "n.", zh: "推理；论证", gloss: "logic, inference", phrase: ["scientific reasoning", "科学推理"], example: ["Clear reasoning matters more than a dramatic conclusion.", "清晰推理比戏剧性结论更重要。"] }
  ,{ head: "rebellious", cut: "rebell/ious", cutMeaning: "反抗/形容词", pos: "adj.", zh: "叛逆的；反抗的", gloss: "defiant", phrase: ["rebellious students", "叛逆学生"], example: ["A rebellious province refused to follow the new tax rule.", "一个反抗的省份拒绝遵守新税规。"] }
  ,{ head: "reciprocal", cut: "re/ciprocal", cutMeaning: "回；相互/交换", pos: "adj./n.", zh: "相互的；互惠的", gloss: "mutual", phrase: ["reciprocal support", "相互支持"], example: ["The treaty created reciprocal duties between the two states.", "条约在两国之间建立了相互义务。"] }
  ,{ head: "relentless", cut: "re/lent/less", cutMeaning: "反复；回/放松/无", pos: "adj.", zh: "不停的；不懈的", gloss: "persistent", phrase: ["relentless pressure", "持续压力"], example: ["Relentless pressure from voters forced officials to respond.", "选民持续不断的压力迫使官员回应。"] }
  ,{ head: "remember", cut: "re/member", cutMeaning: "再次；回/记忆；成员", pos: "v.", zh: "记得；记住", gloss: "recall", phrase: ["remember details", "记住细节"], example: ["Witnesses often remember the same event differently.", "目击者常常以不同方式记住同一事件。"] }
  ,{ head: "reorganise", cut: "re/organ/ise", cutMeaning: "重新/组织/动词", pos: "v.", zh: "重组；重新安排", gloss: "restructure", phrase: ["reorganise departments", "重组部门"], example: ["The school had to reorganise classes after the building closed.", "建筑关闭后，学校不得不重新安排班级。"] }
  ,{ head: "repay", cut: "re/pay", cutMeaning: "回；再/支付", pos: "v.", zh: "偿还；报答", gloss: "pay back", phrase: ["repay debt", "偿还债务"], example: ["The village used harvest profits to repay the loan.", "村庄用收成利润偿还贷款。"] }
  ,{ head: "scripture", cut: "script/ure", cutMeaning: "写/名词", pos: "n.", zh: "经文；经典", gloss: "sacred writing", phrase: ["ancient scripture", "古代经文"], example: ["The inscription was treated as scripture by later followers.", "后来的追随者把这段铭文视为经文。"] }
  ,{ head: "sector", cut: "sect/or", cutMeaning: "切分；部分/名词", pos: "n.", zh: "部门；领域；扇形", gloss: "section, field", phrase: ["public sector", "公共部门"], example: ["The energy sector changed quickly after prices rose.", "价格上涨后，能源部门迅速变化。"] }
  ,{ head: "sender", cut: "send/er", cutMeaning: "发送/人", pos: "n.", zh: "发送者；寄件人", gloss: "person who sends", phrase: ["message sender", "消息发送者"], example: ["The sender used a code to hide the real location.", "发送者使用暗码隐藏真实位置。"] }
  ,{ head: "striking", cut: "strik/ing", cutMeaning: "打击；显著/形容词", pos: "adj.", zh: "显著的；引人注目的", gloss: "remarkable", phrase: ["a striking difference", "显著差异"], example: ["The two maps show a striking difference in coastline shape.", "两张地图显示出海岸线形状的显著差异。"] }
  ,{ head: "subscriber", cut: "sub/scrib/er", cutMeaning: "在下；签署/写/人", pos: "n.", zh: "订阅者；用户", gloss: "paying reader, user", phrase: ["online subscriber", "线上订阅者"], example: ["Each subscriber received the report before it became public.", "每位订阅者都在报告公开前收到了它。"] }
  ,{ head: "surrounding", cut: "sur/round/ing", cutMeaning: "周围/圆；围绕/形容词", pos: "adj./n.", zh: "周围的；环境", gloss: "nearby, environment", phrase: ["surrounding area", "周边地区"], example: ["The surrounding villages depended on the same river.", "周边村庄依靠同一条河流。"] }
  ,{ head: "thickness", cut: "thick/ness", cutMeaning: "厚/名词", pos: "n.", zh: "厚度；浓度", gloss: "depth, density", phrase: ["wall thickness", "墙体厚度"], example: ["Researchers measured the thickness of each ice layer.", "研究人员测量了每层冰的厚度。"] }
  ,{ head: "thinker", cut: "think/er", cutMeaning: "思考/人", pos: "n.", zh: "思想家；思考者", gloss: "philosopher", phrase: ["political thinker", "政治思想家"], example: ["The thinker argued that law should protect the weak.", "这位思想家主张法律应保护弱者。"] }
  ,{ head: "torment", cut: "tor/ment", cutMeaning: "扭转；折磨/名词", pos: "n./v.", zh: "折磨；痛苦", gloss: "suffering, torture", phrase: ["mental torment", "精神折磨"], example: ["Uncertainty can torment families waiting for news.", "不确定性会折磨等待消息的家庭。"] }
  ,{ head: "tourist", cut: "tour/ist", cutMeaning: "旅行；巡游/人", pos: "n.", zh: "游客；旅游者", gloss: "traveller", phrase: ["foreign tourist", "外国游客"], example: ["A tourist economy can change housing prices in old cities.", "旅游经济会改变老城的住房价格。"] }
  ,{ head: "trader", cut: "trade/er", cutMeaning: "贸易/人", pos: "n.", zh: "商人；交易者", gloss: "merchant, dealer", phrase: ["local trader", "当地商人"], example: ["A trader carried salt inland and returned with grain.", "一名商人把盐运往内陆，再带着谷物返回。"] }
  ,{ head: "tremor", cut: "trem/or", cutMeaning: "颤抖/名词", pos: "n.", zh: "震颤；轻微地震", gloss: "small shake", phrase: ["earth tremor", "轻微地震"], example: ["A small tremor shook the instruments before dawn.", "黎明前一次轻微震动摇晃了仪器。"] }
  ,{ head: "trilobite", cut: "tri/lob/ite", cutMeaning: "三/叶；裂片/名词", pos: "n.", zh: "三叶虫", gloss: "three-lobed fossil animal", phrase: ["trilobite fossil", "三叶虫化石"], example: ["A trilobite fossil can help date ancient rock layers.", "三叶虫化石可以帮助测定古老岩层的年代。"] }
  ,{ head: "uneasy", cut: "un/easy", cutMeaning: "不；相反/容易；舒适", pos: "adj.", zh: "不安的；不自在的", gloss: "anxious, uncomfortable", phrase: ["uneasy silence", "不安的沉默"], example: ["An uneasy silence followed the official announcement.", "官方公告后出现了一阵不安的沉默。"] }
  ,{ head: "walker", cut: "walk/er", cutMeaning: "行走/人", pos: "n.", zh: "步行者；助行架", gloss: "person who walks", phrase: ["a careful walker", "谨慎的步行者"], example: ["A walker noticed cracks in the old bridge.", "一名步行者注意到旧桥上的裂缝。"] }
  ,{ head: "worker", cut: "work/er", cutMeaning: "工作/人", pos: "n.", zh: "工人；劳动者", gloss: "employee, labourer", phrase: ["factory worker", "工厂工人"], example: ["Each worker recorded the temperature before entering the tunnel.", "每名工人在进入隧道前记录温度。"] }
  ,{ head: "writer", cut: "writ/er", cutMeaning: "写/人", pos: "n.", zh: "作者；作家", gloss: "author", phrase: ["science writer", "科学作家"], example: ["The writer explained a difficult theory with a simple image.", "作者用一个简单图像解释了困难理论。"] }
  ];

const EXTRA_EXAMPLE_PATCHES = {
  observatory: [
    [0, "The observatory recorded the eclipse before clouds covered the mountain.", "云层覆盖山峰前，天文台记录了这次日食。"]
  ],
  settlement: [
    [0, "The settlement grew near a river because water made farming easier.", "这个定居点在河边发展起来，因为水源让农业更容易。"]
  ],
  probability: [
    [0, "The probability of flooding increased after the wetlands were removed.", "湿地被移除后，洪水发生的概率上升了。"]
  ],
  notation: [
    [0, "Mathematical notation allowed the students to express the pattern clearly.", "数学符号让学生能够清楚表达这个模式。"]
  ],
  transition: [
    [0, "The transition from fossil fuel to renewable energy changed local jobs.", "从化石燃料向可再生能源的转型改变了当地就业。"]
  ],
  insulator: [
    [0, "A good insulator keeps heat inside the building during winter.", "好的绝缘材料能在冬天把热量留在建筑内部。"]
  ],
  prevalent: [
    [0, "Respiratory illness became more prevalent after the factory opened.", "工厂开业后，呼吸系统疾病变得更普遍。"]
  ],
  norm: [
    [0, "In many societies, sharing food is a social norm rather than a written rule.", "在许多社会中，分享食物是一种社会规范，而不是成文规则。"]
  ],
  prospective: [
    [0, "Prospective students visited the campus before choosing a programme.", "潜在学生在选择项目之前参观了校园。"]
  ],
  remedy: [
    [0, "The court ordered a remedy after the company breached the contract.", "公司违约后，法院下令采取补救措施。"]
  ],
  skepticism: [
    [0, "Scientific skepticism made researchers repeat the experiment before accepting the result.", "科学怀疑精神使研究人员在接受结果前重复实验。"]
  ],
  successive: [
    [0, "Successive storms damaged the same coastal road three times in one month.", "连续几场风暴在一个月内三次损坏同一条海岸道路。"]
  ],
  synthesis: [
    [0, "The synthesis of evidence from several studies changed the policy debate.", "多项研究证据的综合改变了政策讨论。"]
  ],
  ecosystemic: [
    [0, "An ecosystemic view connects soil, water, plants, and human activity.", "生态系统视角会连接土壤、水、植物和人类活动。"]
  ],
  industrialization: [
    [0, "Industrialization brought jobs to the city but increased air pollution.", "工业化给城市带来就业，但也增加了空气污染。"]
  ],
  fiscal: [
    [0, "Fiscal policy affected how much money schools received each year.", "财政政策影响学校每年获得多少资金。"]
  ],
  counterculture: [
    [0, "The counterculture rejected mainstream values and created new forms of music.", "反主流文化拒绝主流价值，并创造了新的音乐形式。"]
  ],
  computation: [
    [0, "Fast computation allowed scientists to model climate change more accurately.", "快速计算让科学家能更准确地模拟气候变化。"]
  ],
  turnover: [
    [0, "High staff turnover made it difficult for the hospital to maintain standards.", "高员工流动率使医院难以维持标准。"]
  ],
  differentiation: [
    [0, "Cell differentiation allows one embryo to develop many kinds of tissue.", "细胞分化使一个胚胎能发育出多种组织。"]
  ],
  synergy: [
    [0, "The synergy between design and engineering made the bridge both strong and elegant.", "设计与工程之间的协同作用使这座桥既坚固又优雅。"]
  ],
  accountability: [
    [0, "Public accountability requires officials to explain how money is spent.", "公共问责要求官员解释资金如何使用。"]
  ],
  fluency: [
    [0, "Reading fluency improves when students meet useful words in many contexts.", "当学生在多种语境中遇到有用词汇时，阅读流利度会提高。"]
  ],
  persuasion: [
    [0, "Effective persuasion depends on evidence as well as emotion.", "有效说服既依赖证据，也依赖情感。"]
  ],
  translation: [
    [0, "Accurate translation can preserve meaning even when word order changes.", "准确翻译即使改变词序也能保留含义。"]
  ],
  renovation: [
    [0, "The renovation kept the old facade while improving ventilation.", "这次翻修改善了通风，同时保留了旧立面。"]
  ],
  cityscape: [
    [0, "The new skyscraper changed the cityscape within a single decade.", "这座新摩天楼在十年内改变了城市景观。"]
  ],
  emergency: [
    [0, "The emergency dispatch team sent food and medicine before the roads reopened.", "道路重新开放前，紧急调度队送出了食物和药品。"]
  ],
  payment: [
    [0, "The final payment was delayed because the delivery record was incomplete.", "最后一笔付款被推迟，因为交付记录不完整。"]
  ],
  analyse: [
    [0, "Students analyse the schedule to find where the warning should appear.", "学生分析时间表，以找出警告应该出现的位置。"]
  ],
  profile: [
    [0, "The clinical profile described the patient's symptoms and treatment history.", "临床概况描述了病人的症状和治疗史。"]
  ],
  partnership: [
    [0, "The council formed a partnership with the university to provide scholarships.", "委员会与大学建立合作关系，以提供奖学金。"]
  ],
  scholarship: [
    [0, "The scholarship covered temporary dormitory costs for students in need.", "这项奖学金支付了困难学生的临时宿舍费用。"]
  ],
  neurology: [
    [0, "Neurology helped doctors understand why the patient lost balance after the injury.", "神经学帮助医生理解病人受伤后为什么失去平衡。"]
  ],
  warning: [
    [0, "A clear warning on the dormitory door directed students to another exit.", "宿舍门上清楚的警告把学生引向另一个出口。"]
  ],
  discreet: [
    [0, "The nurse gave a discreet gesture so the patient could protect her privacy.", "护士做了一个谨慎的手势，让病人能保护自己的隐私。"]
  ],
  gesture: [
    [0, "His small gesture of apology reduced the embarrassment in the room.", "他一个小小的道歉动作减轻了房间里的尴尬。"]
  ],
  privacy: [
    [0, "The new protocol protected patient privacy during the medical review.", "新规程在医疗审查期间保护了病人隐私。"]
  ],
  sanitary: [
    [0, "Sanitary fabric reduced the risk of infection in temporary shelters.", "卫生织物降低了临时避难所中的感染风险。"]
  ],
  response: [
    [0, "The social response changed after visible evidence appeared online.", "可见证据出现在网上后，社会反应发生了变化。"]
  ],
  specific: [
    [0, "The form asked for a specific contact number in case the crisis worsened.", "表格要求填写一个具体联系电话，以防危机恶化。"]
  ],
  advantage: [
    [0, "Early access gave the research team an advantage over later applicants.", "提前获得权限使研究团队比后来的申请者有优势。"]
  ],
  recommendation: [
    [0, "The committee's recommendation was to monitor the cohort for another month.", "委员会的建议是再监测这个队列一个月。"]
  ],
  approval: [
    [0, "Official approval was required before the trial could enter its next phase.", "试验进入下一阶段前需要官方批准。"]
  ],
  contingent: [
    [0, "Funding remained contingent on evidence that the procedure was safe.", "资金仍取决于该程序安全的证据。"]
  ],
  repeatability: [
    [0, "Repeatability mattered because another laboratory had to verify the result.", "可重复性很重要，因为另一家实验室必须核实结果。"]
  ],
  proximity: [
    [0, "The school benefited from its proximity to the medical faculty.", "这所学校受益于靠近医学院的位置。"]
  ],
  medical: [
    [0, "Medical access improved after the sponsor paid for a new clinic.", "赞助者出资建立新诊所后，医疗服务变好了。"]
  ],
  reversibility: [
    [0, "Reversibility was important because patients could withdraw if the therapy failed.", "可逆性很重要，因为治疗失败时病人可以退出。"]
  ],
  failure: [
    [0, "Equipment failure accelerated the deterioration of the stored samples.", "设备故障加速了储存样本的恶化。"]
  ],
  survivable: [
    [0, "Doctors judged the injury survivable if removal happened within an hour.", "医生判断，如果一小时内完成移除，这处伤是可存活的。"]
  ],
  removal: [
    [0, "The removal of the damaged tissue reduced the patient's urgent risk.", "受损组织的移除降低了病人的紧急风险。"]
  ],
  limitation: [
    [0, "The main limitation of the framework was its dependence on precise data.", "这个框架的主要限制是它依赖精确数据。"]
  ],
  suspicion: [
    [0, "The unusual sequence of events raised suspicion among the reviewers.", "这一异常的事件顺序引起了审查者的怀疑。"]
  ],
  operational: [
    [0, "The auction system became operational after the supervisor verified every version.", "主管核实每个版本后，拍卖系统开始运行。"]
  ],
  usable: [
    [0, "The compressed file was usable only after the missing standard was restored.", "缺失标准恢复后，压缩文件才可使用。"]
  ],
  supervisor: [
    [0, "The supervisor checked the deadline before approving the transfer.", "主管在批准转账前核对了截止日期。"]
  ],
  applicant: [
    [0, "Each applicant submitted a form before joining the expedition society.", "每名申请者在加入探险社团前提交了一张表格。"]
  ],
  requirement: [
    [0, "Registration was a requirement for using the equipment cabinet.", "登记是使用设备柜的要求。"]
  ],
  badge: [
    [0, "The badge showed that the recruit had completed safety instruction.", "徽章表明这名新成员已经完成安全培训。"]
  ],
  registration: [
    [0, "Registration closed before the corridor survey began.", "走廊调查开始前，登记已经关闭。"]
  ],
  aisle: [
    [0, "The metronome was stored in the cabinet beside the central aisle.", "节拍器存放在中央过道旁的柜子里。"]
  ],
  metronome: [
    [0, "The music society used a metronome to keep the expedition chant steady.", "音乐社用节拍器让探险口号保持稳定节奏。"]
  ],
  booklet: [
    [0, "The booklet explained the tradition behind each compass badge.", "小册子解释了每个指南针徽章背后的传统。"]
  ],
  funding: [
    [0, "Disaster funding was cancelled after the authority found incomplete records.", "主管机构发现记录不完整后，灾害资金被取消。"]
  ],
  preventable: [
    [0, "Investigators concluded that the disaster was preventable with better weather data.", "调查人员得出结论，如果有更好的天气数据，这场灾难本可预防。"]
  ],
  map: [
    [0, "The map helped senior staff evaluate which routes were still safe.", "地图帮助高级工作人员评估哪些路线仍然安全。"]
  ],
  incomplete: [
    [0, "Incomplete symptom records made the medical decision harder.", "不完整的症状记录使医疗决策更加困难。"]
  ],
  donor: [
    [0, "A private donor paid for new safety equipment after the flood.", "洪水后，一位私人捐赠者支付了新安全设备的费用。"]
  ],
  embarrassment: [
    [0, "The public cancellation caused embarrassment for the senior organisers.", "公开取消让高级组织者感到尴尬。"]
  ],
  mission: [
    [0, "The trade mission met local officials before visiting the port.", "贸易代表团在参观港口前会见了当地官员。"],
    [1, "The rescue team treated the search as a mission, not a routine task.", "救援队把这次搜寻视为使命，而不是普通任务。"]
  ],
  priority: [
    [1, "Emergency vehicles have priority when roads are blocked after a storm.", "暴风雨后道路受阻时，应急车辆享有优先权。"]
  ],
  clicker: [
    [0, "Each student used a clicker to answer the question at the same time.", "每个学生都用遥控答题器同时回答问题。"],
    [1, "The trainer used a clicker to mark the dog's correct response.", "训练员用响片标记狗的正确反应。"]
  ],
  clipper: [
    [0, "A fast clipper carried tea across the ocean before steamships became common.", "在蒸汽船普及前，快速帆船把茶叶运过海洋。"],
    [1, "The gardener cleaned the clipper before cutting the hedge.", "园丁修剪树篱前清洁了剪具。"]
  ],
  cocoon: [
    [0, "The silkworm formed a cocoon before changing into a moth.", "蚕在变成蛾之前结成茧。"],
    [1, "The new policy cocooned wealthy districts from problems faced by poorer areas.", "新政策把富裕地区保护起来，使其隔绝于贫困地区面临的问题。"]
  ],
  compactness: [
    [0, "The compactness of the design allowed the device to fit inside a pocket.", "设计的紧凑性使这个设备能放进口袋。"],
    [1, "The compactness of the summary made it useful for quick review.", "摘要的简洁性使它适合快速复习。"]
  ],
  connection: [
    [0, "The connection between poor housing and illness became clear during the survey.", "调查期间，住房差与疾病之间的联系变得清楚。"],
    [1, "A loose connection stopped the lamp from working.", "连接松动导致灯无法工作。"]
  ],
  consciously: [
    [0, "She consciously avoided dramatic language in the official report.", "她在官方报告中有意识地避免使用夸张语言。"],
    [1, "The patient was breathing consciously after the medicine took effect.", "药物生效后，病人清醒地呼吸着。"]
  ],
  conservative: [
    [0, "Conservative voters opposed the reform because it changed local traditions.", "保守派选民反对改革，因为它改变了地方传统。"],
    [1, "A conservative estimate is safer when the data are incomplete.", "数据不完整时，保守估计更安全。"]
  ],
  constitutionally: [
    [0, "The court asked whether the emergency order was constitutionally valid.", "法院询问这项紧急命令在宪法上是否有效。"],
    [1, "Some people are constitutionally more sensitive to heat.", "有些人体质上对热更敏感。"]
  ],
  construction: [
    [1, "The construction of the bridge used steel cables and concrete towers.", "这座桥的结构使用钢缆和混凝土塔。"],
    [2, "Her construction of the poem treats silence as a political choice.", "她对这首诗的建构把沉默视为一种政治选择。"]
  ],
  convulsion: [
    [0, "The child had a convulsion after the fever rose too quickly.", "孩子发烧上升过快后出现抽搐。"],
    [1, "The revolution caused a convulsion in the country's old political order.", "这场革命使该国旧政治秩序发生剧烈动荡。"]
  ],
  coordination: [
    [0, "Better coordination between hospitals reduced waiting times.", "医院之间更好的协调减少了等待时间。"],
    [1, "The injury affected his coordination, so walking became difficult.", "受伤影响了他的身体协调能力，因此走路变得困难。"]
  ],
  cosmic: [
    [0, "Cosmic radiation can damage instruments on long space missions.", "宇宙辐射会损坏长期太空任务中的仪器。"],
    [1, "The discovery had cosmic importance for scientists studying the origin of matter.", "这一发现对研究物质起源的科学家具有宏大的意义。"]
  ],
  cosmos: [
    [0, "Ancient astronomers tried to explain the order of the cosmos.", "古代天文学家试图解释宇宙的秩序。"],
    [1, "The philosopher imagined society as a small cosmos with its own order.", "这位哲学家把社会想象成一个有自身秩序的小宇宙。"]
  ],
  cotton: [
    [0, "Cotton exports made the port wealthy but deepened dependence on forced labour.", "棉花出口使港口富裕，但加深了对强迫劳动的依赖。"],
    [1, "Cotton cloth was lighter than wool in the humid climate.", "在潮湿气候中，棉布比羊毛更轻便。"]
  ],
  critic: [
    [0, "The critic praised the film's quiet ending but disliked its slow middle section.", "评论家赞扬这部电影安静的结尾，但不喜欢其中段的缓慢节奏。"],
    [1, "A critic of the plan argued that it would hurt small businesses.", "这项计划的批评者认为它会伤害小企业。"]
  ],
  cultivator: [
    [0, "A skilled cultivator can improve poor soil over several seasons.", "熟练的耕作者能在几个季节内改善贫瘠土壤。"],
    [1, "The cultivator broke the hard ground before seeds were planted.", "播种前，耕耘机打碎了坚硬的土地。"]
  ],
  cultured: [
    [0, "The cultured diplomat knew how to speak without embarrassing his host.", "这位有教养的外交官知道如何说话而不让主人难堪。"],
    [1, "Cultured cells allowed researchers to test the drug without using animals.", "人工培养的细胞使研究人员无需使用动物就能测试药物。"]
  ],
  darkness: [
    [0, "Darkness fell quickly after the storm covered the valley.", "暴风雨覆盖山谷后，黑暗很快降临。"],
    [1, "The novel uses darkness to suggest ignorance rather than simple fear.", "这部小说用黑暗暗示无知，而不仅仅是恐惧。"]
  ],
  dart: [
    [0, "The dart carried a small dose of medicine into the animal's shoulder.", "飞镖把少量药物送入动物肩部。"],
    [1, "A child darted across the road before the driver could react.", "司机还没反应过来，一个孩子就猛冲过马路。"]
  ],
  declaration: [
    [0, "The declaration stated that the river would be protected by law.", "这份宣言声明这条河将受法律保护。"],
    [1, "A customs declaration listed every object in the crate.", "海关申报单列出了箱子里的每件物品。"]
  ],
  definition: [
    [0, "A clear definition prevents readers from confusing similar terms.", "清晰的定义能防止读者混淆相似术语。"],
    [1, "The old photograph had poor definition around the faces.", "这张旧照片中人脸周围清晰度很差。"]
  ],
  deformation: [
    [0, "Heat caused deformation in the plastic container.", "高温导致塑料容器变形。"],
    [1, "The report called the false quotation a deformation of the witness's words.", "报告称这段错误引文扭曲了证人的话。"]
  ],
  deliberately: [
    [0, "The witness deliberately left out the name of the driver.", "证人故意省略了司机的名字。"],
    [1, "She spoke deliberately so the translator could follow every sentence.", "她说得很慎重从容，以便译员能跟上每句话。"]
  ],
  department: [
    [0, "The transport department repaired the bridge after the flood.", "交通部门在洪水后修复了桥梁。"],
    [1, "The history department stored old maps in a locked room.", "历史系把旧地图存放在上锁的房间里。"]
  ],
  depression: [
    [1, "The depression closed factories and pushed many families into debt.", "经济萧条使工厂关闭，并让许多家庭陷入债务。"],
    [2, "Rainwater collected in a shallow depression near the road.", "雨水积在道路旁一处浅凹地里。"]
  ],
  director: [
    [0, "The director used silence to make the final scene more painful.", "导演用沉默让最后一幕更令人痛苦。"],
    [1, "The director approved the budget before the team ordered new equipment.", "主管在团队订购新设备前批准了预算。"]
  ],
  disciplinary: [
    [0, "A disciplinary hearing followed the student's repeated rule violations.", "学生多次违反规则后，举行了纪律听证会。"],
    [1, "Disciplinary boundaries can make it hard for scientists to share methods.", "学科边界可能使科学家难以共享方法。"]
  ],
  disposition: [
    [0, "Her calm disposition helped the group work through the crisis.", "她沉稳的性情帮助团队度过危机。"],
    [1, "The child showed a disposition to ask questions before accepting rules.", "这个孩子表现出先提问再接受规则的倾向。"]
  ],
  documentation: [
    [0, "Clear documentation helped new workers operate the machine safely.", "清楚的文档帮助新工人安全操作机器。"],
    [1, "The refugees needed documentation before they could cross the border legally.", "难民需要证明材料才能合法越过边境。"]
  ],
  drama: [
    [0, "The drama shows how private choices can become public conflicts.", "这部戏剧展示了私人选择如何变成公共冲突。"],
    [1, "The committee avoided drama by announcing the decision quietly.", "委员会通过低调宣布决定避免了紧张局面。"]
  ],
  economically: [
    [0, "The village became economically dependent on one mine.", "这个村庄在经济上依赖一座矿山。"],
    [1, "The new engine used fuel more economically than the older model.", "新发动机比旧型号更节约地使用燃料。"]
  ],
  effectively: [
    [0, "The medicine worked effectively when patients took it early.", "病人早期服用时，这种药能有效发挥作用。"],
    [1, "The road was effectively closed after rocks fell from the cliff.", "悬崖落石后，这条路实际上关闭了。"]
  ],
  electricity: [
    [0, "Electricity allowed factories to work after sunset.", "电力使工厂能在日落后继续运转。"],
    [1, "Static electricity made dust cling to the plastic surface.", "静电使灰尘附着在塑料表面。"]
  ],
  elevation: [
    [0, "At higher elevation, the air becomes thinner and colder.", "海拔更高时，空气会变得更稀薄、更寒冷。"],
    [1, "The elevation of a local teacher to minister surprised the capital.", "一位地方教师被提升为部长，这让首都感到惊讶。"]
  ],
  endowment: [
    [0, "The university used its endowment to support poorer students.", "大学用捐赠基金支持较贫困的学生。"],
    [1, "A natural endowment of rivers made the region suitable for trade.", "河流这种天然资源使该地区适合贸易。"]
  ],
  economy: [
    [1, "The small car was bought for economy rather than speed.", "购买这辆小车是为了节约，而不是为了速度。"]
  ],
  episode: [
    [1, "The final episode explained why the detective had hidden the letter.", "最后一集解释了侦探为什么藏起那封信。"],
    [2, "A severe episode of fever kept the patient in hospital overnight.", "一次严重发烧发作使病人在医院住了一夜。"]
  ],
  event: [
    [0, "The flood became the central event in the town's memory.", "这场洪水成了小镇记忆中的核心事件。"],
    [1, "The school event raised money for new laboratory equipment.", "这场学校活动为新的实验室设备筹款。"]
  ],
  exhalation: [
    [0, "Slow exhalation helped the singer control each long note.", "缓慢呼气帮助歌手控制每个长音。"],
    [1, "The hot spring released a faint exhalation of steam.", "温泉散发出淡淡的蒸汽。"]
  ],
  fabrication: [
    [0, "The journalist lost his job after the fabrication was discovered.", "捏造事实被发现后，这名记者失去了工作。"],
    [1, "Metal fabrication requires accurate cutting and careful welding.", "金属制造需要精确切割和仔细焊接。"]
  ],
  facility: [
    [0, "The research facility stored samples at very low temperatures.", "研究设施在极低温下保存样本。"],
    [1, "Her facility with numbers made the accounting task easy.", "她处理数字的能力使会计任务变得容易。"]
  ],
  factor: [
    [0, "Cost was the main factor in the committee's decision.", "成本是委员会决策中的主要因素。"],
    [1, "Six is a factor of thirty because thirty can be divided by six.", "六是三十的因数，因为三十可以被六整除。"]
  ],
  fault: [
    [0, "The accident was not the driver's fault because the brakes had failed.", "事故不是司机的过错，因为刹车失灵了。"],
    [1, "An earthquake can occur when rock moves along a fault.", "岩石沿断层移动时可能发生地震。"]
  ],
  forgiveness: [
    [0, "Forgiveness did not mean that the damage was forgotten.", "宽恕并不意味着损害被遗忘。"],
    [1, "The agreement included forgiveness of part of the debt.", "协议包括免除部分债务。"]
  ],
  frontier: [
    [0, "The frontier town grew around a railway station and a grain market.", "这个边疆城镇围绕火车站和粮食市场发展起来。"],
    [1, "Genetic medicine is still a frontier of modern research.", "基因医学仍是现代研究的前沿。"]
  ],
  furnace: [
    [0, "The furnace kept the school warm during the winter storm.", "暖气炉在冬季风暴期间让学校保持温暖。"],
    [1, "The glass furnace had to reach extremely high temperatures.", "玻璃熔炉必须达到极高温度。"]
  ],
  gradient: [
    [0, "A temperature gradient formed between the warm coast and the cold hills.", "温暖海岸和寒冷山丘之间形成了温度梯度。"],
    [1, "The road's steep gradient made carts difficult to control.", "道路陡峭的坡度使马车难以控制。"]
  ],
  green: [
    [0, "Green paint marked the safe exit route.", "绿色油漆标出了安全出口路线。"],
    [1, "Green policies encouraged factories to reduce waste.", "环保政策鼓励工厂减少废物。"]
  ],
  guardian: [
    [0, "The child's guardian signed the medical form.", "孩子的监护人签署了医疗表格。"],
    [1, "The old law treated the king as guardian of the realm.", "旧法律把国王视为王国的守护者。"]
  ],
  heal: [
    [0, "Small wounds heal faster when they are kept clean.", "小伤口保持清洁时愈合更快。"],
    [1, "Public apologies can help heal a divided community.", "公开道歉可以帮助修复分裂的社群。"]
  ],
  fossil: [
    [1, "The fossil rule survived in the office long after its purpose had disappeared.", "这条陈腐规定在办公室里保留下来很久，尽管它的目的早已消失。"],
    [2, "Fossil pollen can show what plants grew in an ancient valley.", "化石花粉可以显示古代山谷中生长过什么植物。"]
  ],
  hesitation: [
    [0, "Her hesitation before answering made the committee ask another question.", "她回答前的犹豫使委员会又问了一个问题。"],
    [1, "A brief hesitation in his voice suggested that he was not certain.", "他声音中短暂的停顿表明他并不确定。"]
  ],
  holler: [
    [0, "The workers answered with a holler from the far end of the field.", "工人们从田地远端用一声喊叫回应。"],
    [1, "The guard had to holler over the noise of the engines.", "守卫不得不越过发动机噪声大声喊叫。"]
  ],
  horizontal: [
    [0, "The shelf must be horizontal or the instruments will slide.", "架子必须保持水平，否则仪器会滑落。"],
    [1, "Horizontal cooperation between departments solved the problem faster than orders from above.", "部门之间的横向合作比上级命令更快解决了问题。"]
  ],
  humanitarian: [
    [0, "Humanitarian aid reached the island three days after the storm.", "风暴后三天，人道主义援助抵达该岛。"],
    [1, "The humanitarian argued that refugees needed legal protection as well as food.", "这位人道主义者认为难民不仅需要食物，也需要法律保护。"]
  ],
  humanity: [
    [0, "Humanity has altered rivers, forests, and climate in every region.", "人类已经改变了每个地区的河流、森林和气候。"],
    [1, "The nurse's humanity mattered as much as her technical skill.", "这位护士的人道精神和她的技术能力一样重要。"]
  ],
  idea: [
    [0, "The idea sounded simple until the engineers tested it in real weather.", "这个想法听起来简单，直到工程师在真实天气中测试它。"],
    [1, "The idea of progress changed as people saw the cost of industrial growth.", "当人们看到工业增长的代价时，进步这一观念发生了变化。"]
  ],
  identification: [
    [1, "The identification of the handwriting linked the letter to the suspect.", "笔迹鉴定把这封信与嫌疑人联系起来。"],
    [2, "Strong identification with a group can shape how people judge evidence.", "对群体的强烈认同会影响人们判断证据的方式。"]
  ],
  illustration: [
    [0, "The case became an illustration of how small errors can change policy.", "这个案例成了小错误如何改变政策的例证。"],
    [1, "A clear illustration showed how the machine pulled water uphill.", "一幅清楚的插图展示了机器如何把水向上抽。"]
  ],
  imagery: [
    [0, "Satellite imagery revealed roads that were hidden under forest cover.", "卫星图像显示了隐藏在森林覆盖下的道路。"],
    [1, "The poem's ocean imagery suggests danger as well as freedom.", "这首诗的海洋意象既暗示自由，也暗示危险。"]
  ],
  implication: [
    [1, "The implication was that officials knew about the danger earlier.", "其暗示是官员更早就知道了危险。"],
    [2, "His implication in the scandal ended his political career.", "他卷入这场丑闻结束了他的政治生涯。"]
  ],
  imposition: [
    [0, "The imposition of new fees angered families already in debt.", "新费用的强加激怒了已经负债的家庭。"],
    [1, "The imposition of a tax on salt affected every household.", "对盐征税影响了每个家庭。"]
  ],
  impression: [
    [0, "The first impression of the school changed after visitors met the students.", "访客见到学生后，对学校的第一印象发生了变化。"],
    [1, "The seal left a sharp impression in the warm wax.", "印章在温热蜡上留下清晰印记。"]
  ],
  inadequate: [
    [0, "Inadequate drainage made the road flood after ordinary rain.", "排水不足使道路在普通降雨后就被淹。"],
    [1, "The report was inadequate because it ignored interviews with local workers.", "这份报告不合格，因为它忽视了对当地工人的访谈。"]
  ],
  inherent: [
    [1, "There is an inherent tension between speed and careful review.", "速度和仔细审查之间存在内在张力。"],
    [2, "Some inherited diseases reflect an inherent weakness in a gene.", "一些遗传病反映了基因中的先天弱点。"]
  ],
  instruction: [
    [1, "The instructions warned users not to open the device while it was running.", "用法说明警告用户不要在设备运行时打开它。"],
    [2, "The officer gave an instruction to close the bridge immediately.", "军官下达指示，要求立即关闭桥梁。"]
  ],
  insulation: [
    [1, "Social insulation kept wealthy families separate from the effects of the crisis.", "社会隔离使富裕家庭与危机影响分隔开来。"],
    [2, "Political insulation protected the agency from direct public pressure.", "政治上的孤立保护该机构免受直接公众压力。"]
  ],
  insurance: [
    [0, "Insurance helped the family rebuild after the fire.", "保险帮助这个家庭在火灾后重建。"],
    [1, "The insurance industry changed as storms became more frequent.", "随着风暴变得更频繁，保险业发生了变化。"]
  ],
  landmass: [
    [0, "The satellite image showed a large landmass beyond the ice shelf.", "卫星图像显示冰架之外有一大片陆地。"],
    [1, "Australia is a landmass separated from other continents by wide oceans.", "澳大利亚是一片被辽阔海洋与其他大陆隔开的大片陆地。"]
  ],
  landscape: [
    [1, "The landscape in the gallery showed a river crossing a pale valley.", "画廊里的风景画展示了一条穿过浅色山谷的河。"],
    [2, "The political landscape changed after young voters joined the election.", "年轻选民参与选举后，政治格局发生了变化。"]
  ],
  marsupial: [
    [0, "Marsupial mammals carry their young in a pouch during early development.", "有袋类哺乳动物在幼崽早期发育时用育儿袋携带它们。"]
  ],
  massacre: [
    [0, "The massacre changed how later governments recorded military violence.", "这场大屠杀改变了后来政府记录军事暴力的方式。"]
  ],
  miss: [
    [0, "Students may miss the main argument when they focus only on dates and names.", "学生如果只关注日期和姓名，可能会错过主要论点。"]
  ],
  neck: [
    [0, "The narrow neck of land controlled movement between the two valleys.", "这片狭窄地带控制着两个山谷之间的通行。"]
  ],
  note: [
    [0, "Researchers note every unusual result before deciding whether it matters.", "研究人员会先记录每个异常结果，再判断它是否重要。"]
  ],
  rice: [
    [0, "Rice cultivation depends on water control more than many dry crops do.", "水稻种植比许多旱作物更依赖水资源控制。"]
  ],
  rich: [
    [0, "A rich archive can reveal ordinary lives as well as famous events.", "丰富的档案既能揭示普通人的生活，也能揭示著名事件。"]
  ],
  ridge: [
    [0, "A rocky ridge protected the settlement from strong coastal winds.", "一道岩石山脊保护这个定居点免受强劲海风影响。"]
  ],
  rulebook: [
    [0, "The rulebook gave judges a common standard for every match.", "这本规则手册为每场比赛的裁判提供了共同标准。"]
  ],
  serve: [
    [0, "The old canal still serves villages that are far from the railway.", "这条旧运河仍然服务于远离铁路的村庄。"]
  ],
  sign: [
    [0, "The minister refused to sign the agreement until the final clause was changed.", "部长拒绝签署协议，直到最后一项条款被修改。"]
  ],
  skin: [
    [0, "Thick skin protects the animal from sharp rocks and dry air.", "厚皮保护这种动物免受尖锐岩石和干燥空气的伤害。"]
  ],
  southwestern: [
    [0, "The southwestern coast receives less rain than the mountains inland.", "西南海岸的降雨少于内陆山区。"]
  ],
  spire: [
    [0, "The church spire helped travellers recognize the town from a distance.", "教堂尖塔帮助旅行者从远处认出这座城镇。"]
  ],
  spirit: [
    [0, "The reform kept the spirit of the old law while changing its wording.", "这项改革改变了措辞，但保留了旧法律的精神。"]
  ],
  statute: [
    [0, "A statute can protect workers only if courts enforce it.", "只有法院执行，成文法才能保护工人。"]
  ],
  store: [
    [0, "Villages store grain after harvest to survive months of bad weather.", "村庄在收获后储存粮食，以度过数月恶劣天气。"]
  ],
  teach: [
    [0, "Good examples teach students how a word behaves in real sentences.", "好的例句会教学生一个词在真实句子中的用法。"]
  ],
  test: [
    [0, "The drought will test whether the new water policy is practical.", "这场干旱将考验新的水资源政策是否可行。"]
  ],
  thumb: [
    [0, "The thumb allows humans to hold tools with unusual precision.", "拇指使人类能够非常精确地握住工具。"]
  ],
  torture: [
    [0, "Long uncertainty can torture families waiting for official news.", "长期的不确定会折磨等待官方消息的家庭。"]
  ],
  touch: [
    [0, "Even a brief touch can damage fragile painted surfaces.", "即使短暂接触也可能损坏脆弱的彩绘表面。"]
  ],
  treat: [
    [0, "Doctors treat infection more successfully when symptoms are reported early.", "如果症状被及早报告，医生治疗感染会更成功。"]
  ],
  void: [
    [0, "The court declared the contract void because one signature was false.", "法院宣布合同无效，因为其中一个签名是假的。"]
  ],
  well: [
    [0, "After several weeks of rest, the patient was well enough to travel.", "休息几周后，病人健康到足以旅行。"]
  ],
  wool: [
    [0, "Wool keeps heat better than many plant fibres when it is dry.", "干燥时，羊毛比许多植物纤维更保暖。"]
  ],
  campaign: [
    [0, "The health campaign used local radio to explain the new vaccine schedule.", "这场健康宣传活动利用地方广播解释新的疫苗接种安排。"],
    [1, "Her election campaign focused on housing costs and public transport.", "她的竞选活动聚焦住房成本和公共交通。"],
    [2, "The winter campaign failed because troops lacked food and warm clothing.", "冬季战役失败了，因为部队缺少食物和保暖衣物。"],
    [3, "Residents campaigned for cleaner water after several children became ill.", "几名儿童生病后，居民发起运动要求更清洁的水。"]
  ],
  civil: [
    [0, "Civil courts usually handle disputes between citizens or organizations.", "民事法院通常处理公民或组织之间的纠纷。"],
    [1, "Civil war divided the region for more than a decade.", "内战使该地区分裂了十多年。"],
    [2, "Civil engineers designed bridges rather than military equipment.", "土木工程师设计桥梁，而不是军事装备。"],
    [3, "A civil reply helped the meeting continue after a tense question.", "礼貌的回答帮助会议在一个紧张问题之后继续进行。"]
  ],
  cross: [
    [0, "A red cross on the map marked the emergency station.", "地图上的红色十字标出了急救站。"],
    [1, "Farmers crossed the river before the bridge was built.", "桥建成前，农民们渡过这条河。"],
    [2, "Two trade routes crossed near the old market.", "两条贸易路线在旧市场附近交叉。"],
    [3, "The judge sounded cross when the witness changed his story.", "证人改变说法时，法官听起来很恼怒。"]
  ],
  action: [
    [0, "Quick action prevented the fire from spreading to nearby houses.", "迅速行动阻止了火势蔓延到附近房屋。"],
    [1, "The drug's action becomes weaker when it is stored in heat.", "这种药物受热储存时作用会变弱。"],
    [2, "The residents brought a legal action against the company.", "居民对这家公司提起了法律诉讼。"]
  ],
  activity: [
    [0, "Outdoor activity improved the children's sleep and attention.", "户外活动改善了孩子们的睡眠和注意力。"],
    [1, "Volcanic activity increased after several small earthquakes.", "几次小地震后，火山活动增强了。"],
    [2, "The enzyme loses activity when the temperature is too high.", "温度过高时，这种酶会失去活性。"]
  ],
  aggressive: [
    [0, "Aggressive behaviour made other animals leave the feeding area.", "攻击性行为使其他动物离开了进食区。"],
    [1, "The company used an aggressive strategy to enter the foreign market.", "这家公司采用强势策略进入外国市场。"],
    [2, "An aggressive infection can spread before patients notice clear symptoms.", "强烈的感染可能在病人注意到明显症状前扩散。"]
  ],
  application: [
    [1, "The practical application of the theory changed how doctors treated pain.", "这一理论的实际应用改变了医生治疗疼痛的方式。"],
    [2, "The application of oil keeps the wooden surface from drying out.", "涂油可以防止木质表面变干。"],
    [3, "The mobile application stores maps for use without internet access.", "这个手机应用程序会储存地图，以便离线使用。"]
  ],
  association: [
    [0, "The medical association published new advice for rural clinics.", "这个医学协会为乡村诊所发布了新建议。"],
    [1, "Researchers found an association between poor sleep and memory loss.", "研究人员发现睡眠差与记忆下降之间有关联。"],
    [2, "Long association with local families helped the teacher understand the village.", "与当地家庭长期交往帮助这位教师理解村庄。"]
  ],
  attachment: [
    [0, "The email attachment contained maps of the proposed road.", "邮件附件包含拟建道路的地图。"],
    [1, "A child's attachment to one caregiver can affect later trust.", "儿童对一位照护者的依恋会影响后来的信任。"],
    [2, "A metal attachment fixed the sensor to the wall.", "一个金属连接件把传感器固定在墙上。"]
  ],
  bill: [
    [1, "The bill would limit how much factories could release into the river.", "这项法案将限制工厂向河流排放的量。"],
    [2, "She paid with a large bill because the machine would not accept coins.", "她用一张大面额钞票付款，因为机器不收硬币。"],
    [3, "The bird used its long bill to pull insects from the mud.", "这只鸟用长喙从泥里取出昆虫。"]
  ],
  brush: [
    [0, "A soft brush removed dust without damaging the ancient painting.", "软刷清除了灰尘，却没有损坏古画。"],
    [1, "Workers brushed sand from the carved stones before photographing them.", "工人在拍照前刷掉雕石上的沙子。"],
    [2, "A brief brush with failure made the team redesign the experiment.", "一次短暂的失败经历让团队重新设计实验。"]
  ],
  chance: [
    [0, "The scholarship gave rural students a chance to study abroad.", "这项奖学金给农村学生提供了出国学习的机会。"],
    [1, "The chance of flooding increases when forests above the town are removed.", "城镇上方的森林被砍伐后，洪水发生的可能性会增加。"],
    [2, "The discovery happened by chance during a routine survey.", "这一发现是在一次常规调查中偶然发生的。"]
  ],
  alignment: [
    [0, "The alignment of the stones suggests that builders followed the path of the sun.", "这些石块的排列说明建造者可能遵循了太阳的路径。"],
    [1, "Better alignment between schools and employers helped students find practical training.", "学校和雇主之间更好的一致性帮助学生找到实践培训。"],
    [2, "The small states formed an alignment to protect trade across the region.", "这些小国组成联盟以保护该地区的贸易。"]
  ],
  antagonist: [
    [0, "In the debate, the scientist's main antagonist questioned every piece of evidence.", "在辩论中，这位科学家的主要对手质疑每一项证据。"],
    [1, "The novel's antagonist hides his plan until the final chapter.", "小说中的反派直到最后一章才暴露计划。"],
    [2, "The drug works as an antagonist by blocking the receptor.", "这种药作为拮抗剂，通过阻断受体起作用。"]
  ],
  bubble: [
    [0, "Air bubbles rose from the mud when the divers stepped into the pool.", "潜水员踩进池塘时，气泡从泥里升起。"],
    [1, "A housing bubble can make ordinary apartments seem impossibly expensive.", "房地产泡沫会让普通公寓显得贵得离谱。"],
    [2, "Water began to bubble when gas escaped from the pipe.", "气体从管道逸出时，水开始冒泡。"]
  ],
  burst: [
    [0, "The old pipe burst after a week of freezing weather.", "经过一周严寒天气后，旧管道爆裂了。"],
    [1, "Protesters burst into the hall before the vote began.", "投票开始前，抗议者突然冲进大厅。"],
    [2, "A sudden burst of rain forced the hikers to leave the ridge.", "一阵突如其来的雨迫使徒步者离开山脊。"]
  ],
  character: [
    [1, "The island's character changed after tourism replaced fishing.", "旅游业取代捕鱼业后，这座岛的特色发生了变化。"],
    [2, "The main character learns to trust others only near the end of the story.", "主角直到故事接近结尾才学会信任他人。"],
    [3, "Ancient characters on the stone were too worn to read clearly.", "石头上的古代文字磨损严重，难以看清。"]
  ],
  click: [
    [0, "A click from the lock told her that the door had closed properly.", "锁发出咔嗒声，说明门已经关好。"],
    [1, "Users click the highlighted word to open its card.", "用户点击高亮单词来打开词卡。"],
    [2, "The explanation finally clicked when the teacher drew a simple diagram.", "老师画了一个简单图示后，这个解释终于让人明白了。"]
  ],
  concentration: [
    [0, "Long passages require concentration because small details often change the answer.", "长文章需要专注，因为小细节常常会改变答案。"],
    [1, "The concentration of factories near the river increased pollution downstream.", "河边工厂的集中使下游污染增加。"],
    [2, "A high concentration of salt prevents many plants from growing.", "高盐浓度会阻止许多植物生长。"]
  ],
  control: [
    [0, "Local control of water gates reduced conflict between farms.", "地方对水闸的管理减少了农场之间的冲突。"],
    [1, "Engineers control the temperature to keep the reaction stable.", "工程师控制温度以保持反应稳定。"],
    [2, "The control group received the same food but no extra vitamin.", "对照组得到相同食物，但没有额外维生素。"]
  ],
  correspondence: [
    [0, "The scientist's correspondence shows how slowly news travelled in the nineteenth century.", "这位科学家的通信显示十九世纪消息传播得多么缓慢。"],
    [1, "There is a close correspondence between the map and the actual coastline.", "这张地图与真实海岸线之间高度相符。"],
    [2, "The correspondence between language and identity is not always simple.", "语言与身份之间的关联并不总是简单。"]
  ],
  cosmetic: [
    [0, "Some cosmetic products were tested for safety before they reached shops.", "一些化妆品在进入商店前接受了安全测试。"],
    [1, "Cosmetic surgery became more common as techniques improved.", "随着技术进步，整容手术变得更常见。"],
    [2, "The reform was only cosmetic because it changed the title but not the power.", "这项改革只是表面的，因为它改变了名称却没有改变权力。"]
  ],
  critical: [
    [0, "Critical readers ask what evidence a writer has left out.", "批判性读者会问作者遗漏了什么证据。"],
    [1, "Early warning is critical when storms move faster than expected.", "当风暴移动速度快于预期时，早期预警至关重要。"],
    [2, "The patient remained in critical condition after the accident.", "事故后病人仍处于危急状态。"]
  ],
  deliver: [
    [1, "The mayor delivered a speech about flood protection after the storm.", "暴风雨后，市长发表了关于防洪的演讲。"],
    [2, "The new policy failed to deliver the savings that officials promised.", "新政策未能实现官员承诺的节省。"],
    [3, "A trained nurse helped deliver the baby in the remote village.", "一名受过训练的护士在偏远村庄帮助接生。"]
  ],
  demonstration: [
    [0, "The experiment provided a clear demonstration of how pressure changes boiling point.", "这个实验清楚证明了压力如何改变沸点。"],
    [1, "The teacher gave a demonstration before students used the equipment.", "学生使用设备前，老师做了示范。"],
    [2, "A peaceful demonstration filled the square after the law was announced.", "法律公布后，广场上举行了和平示威。"]
  ],
  development: [
    [0, "Language development depends on hearing words in meaningful situations.", "语言发展依赖于在有意义的情境中听到词语。"],
    [1, "The development of the harbour brought jobs but damaged wetlands.", "港口开发带来了工作机会，但破坏了湿地。"],
    [2, "A sudden development in the case forced police to reopen the investigation.", "案件中的一个新情况迫使警方重新展开调查。"]
  ],
  division: [
    [0, "The division of land into small farms changed village life.", "土地被划分成小农场改变了村庄生活。"],
    [1, "The research division tests new materials for aircraft.", "研究部门测试飞机用新材料。"],
    [2, "Division by zero is not allowed in ordinary arithmetic.", "普通算术中不允许除以零。"]
  ],
  handle: [
    [0, "Experienced nurses handle emergencies calmly when equipment fails.", "设备故障时，有经验的护士会冷静处理紧急情况。"],
    [1, "Only trained workers may handle the chemical waste.", "只有受过训练的工人可以操作这些化学废料。"],
    [2, "The bronze handle was worn smooth by centuries of use.", "这个青铜把手因数百年的使用而被磨得光滑。"]
  ],
  hollow: [
    [0, "A hollow log became a shelter for insects during winter.", "一根空心木头成了昆虫过冬的庇护处。"],
    [1, "The leader's promise sounded hollow after years of delay.", "多年拖延之后，这位领导人的承诺听起来空洞无力。"],
    [2, "The village lay in a sheltered hollow below the ridge.", "村庄位于山脊下一个受保护的凹地里。"]
  ],
  property: [
    [0, "Families lost property when the river changed course during the flood.", "洪水中河道改向时，许多家庭失去了财产。"],
    [1, "Elasticity is a property that allows rubber to return to its shape.", "弹性是一种使橡胶恢复形状的特性。"],
    [2, "Property rights became unclear after the border moved.", "边界移动后，所有权变得不清楚。"]
  ],
  stock: [
    [0, "The store kept extra stock before the winter roads closed.", "冬季道路关闭前，商店保留了额外库存。"],
    [1, "The company's stock fell after the safety report was released.", "安全报告发布后，这家公司的股票下跌。"],
    [2, "Farmers stock grain in dry rooms to protect it from mould.", "农民把粮食储存在干燥房间里以防发霉。"]
  ],
  introduction: [
    [0, "The introduction of the speaker helped the audience understand her background.", "对演讲者的介绍帮助听众了解她的背景。"],
    [1, "The introduction of foreign crops changed local farming habits.", "外来作物的引进改变了当地农业习惯。"],
    [2, "The introduction explains why the author chose this method.", "导言解释了作者为什么选择这种方法。"]
  ],
  mobile: [
    [0, "Mobile workers followed seasonal jobs from one region to another.", "流动工人跟随季节性工作从一个地区转到另一个地区。"],
    [1, "Public opinion is mobile when new evidence appears quickly.", "新证据迅速出现时，公众意见是多变的。"],
    [2, "A mobile hung above the child's bed and moved in the light wind.", "一个风动装饰物挂在孩子床上方，在微风中转动。"]
  ],
  physical: [
    [1, "Physical laws explain why the same object falls at the same rate in a vacuum.", "物理定律解释了为什么同一物体在真空中以相同速度下落。"],
    [2, "Digital maps still depend on physical servers that need electricity.", "数字地图仍依赖需要电力的实体服务器。"],
    [3, "Students needed a physical before joining the school sports team.", "学生加入校队前需要体检。"]
  ],
  position: [
    [1, "She accepted a position at the museum after finishing her degree.", "完成学位后，她接受了博物馆的一个职位。"],
    [2, "The committee changed its position after reading the new evidence.", "委员会阅读新证据后改变了立场。"],
    [3, "Engineers positioned the camera above the entrance to record foot traffic.", "工程师把摄像机安置在入口上方以记录人流。"]
  ],
  positive: [
    [0, "A positive result showed that the water contained harmful bacteria.", "阳性结果显示水中含有有害细菌。"],
    [1, "Positive feedback from residents encouraged the team to expand the project.", "居民的积极反馈鼓励团队扩大项目。"],
    [2, "The report offered positive proof that the document was not original.", "报告提供了确凿证据，证明该文件不是原件。"]
  ],
  radical: [
    [1, "The proposal seemed radical because it replaced private cars with shared transport.", "这项提案看起来很激进，因为它用共享交通取代私家车。"],
    [2, "A free radical can damage cells if the body cannot control it.", "如果身体无法控制，自由基可能损伤细胞。"],
    [3, "Some radicals demanded immediate reform rather than gradual change.", "一些激进分子要求立即改革，而不是逐步改变。"]
  ],
  recognition: [
    [0, "Official recognition allowed the community to protect its language in schools.", "官方承认使这个社群能够在学校保护自己的语言。"],
    [1, "Face recognition systems often fail when images are unclear.", "图像不清晰时，人脸识别系统常常失败。"],
    [2, "The scientist received recognition only after other teams confirmed her results.", "其他团队确认她的结果后，这位科学家才获得认可。"]
  ],
  reference: [
    [0, "The article made a brief reference to earlier climate records.", "这篇文章简短提到了早期气候记录。"],
    [1, "Students kept the dictionary nearby for reference while reading.", "学生阅读时把词典放在旁边以便参考。"],
    [2, "A strong reference from a former teacher helped him get the job.", "前任老师的一封有力推荐信帮助他得到这份工作。"]
  ],
  relative: [
    [0, "Relative humidity rises when air cools during the night.", "夜间空气变冷时，相对湿度会上升。"],
    [1, "The cost is relative to the distance goods must travel.", "成本与货物必须运输的距离有关。"],
    [2, "A relative cared for the children while their parents worked abroad.", "父母在国外工作时，一位亲属照顾这些孩子。"]
  ],
  resistance: [
    [0, "Resistance to the tax grew after merchants saw the new rules.", "商人看到新规定后，对这项税的反抗增加了。"],
    [1, "Air resistance slows a falling object before it reaches the ground.", "空气阻力会在物体落地前减缓其下落速度。"],
    [2, "Copper has lower electrical resistance than many other metals.", "铜的电阻低于许多其他金属。"]
  ],
  sophisticated: [
    [1, "A sophisticated microscope can reveal structures that ordinary lenses miss.", "精密显微镜能显示普通镜头看不到的结构。"],
    [2, "The argument became more sophisticated after the writer considered several objections.", "作者考虑了几种反对意见后，论证变得更复杂。"],
    [3, "Sophisticated warning systems give coastal towns more time to evacuate.", "先进预警系统给沿海城镇更多撤离时间。"]
  ],
  abandonment: [
    [0, "The abandonment of the canal forced traders to use longer roads.", "运河的废弃迫使商人使用更长的道路。"],
    [1, "Animal shelters often deal with abandonment after owners move away.", "主人搬走后，动物收容所常常要处理遗弃问题。"]
  ],
  absolutely: [
    [0, "The room was absolutely silent after the alarm stopped.", "警报停止后，房间里完全安静。"],
    [1, "The treaty forbids the practice absolutely, even during emergencies.", "该条约绝对禁止这种做法，即使在紧急情况下也是如此。"]
  ],
  absorption: [
    [0, "The absorption of water makes dry seeds swell before they grow.", "水分吸收会让干种子在生长前膨胀。"],
    [1, "Her absorption in the experiment made her forget the time.", "她全神贯注于实验，以至于忘了时间。"]
  ],
  accelerator: [
    [0, "The particle accelerator allowed physicists to observe tiny collisions.", "粒子加速器使物理学家能够观察微小碰撞。"],
    [1, "Cheap transport became an accelerator of urban growth.", "廉价交通成为城市增长的促进因素。"]
  ],
  accessible: [
    [1, "The online archive made rare documents accessible to rural students.", "在线档案使农村学生能够获取稀有文件。"],
    [2, "Clear examples make difficult grammar accessible to beginners.", "清楚的例句使困难语法对初学者更容易理解。"]
  ],
  accusation: [
    [0, "The accusation was serious, so investigators asked for written evidence.", "这项指控很严重，因此调查人员要求书面证据。"],
    [1, "Her accusation that the report was biased led to a public review.", "她指责报告有偏见，这引发了公开审查。"]
  ],
  adhesive: [
    [0, "An adhesive strip kept the sensor attached to the patient's skin.", "一条黏性贴片让传感器固定在病人皮肤上。"],
    [1, "The repair failed because the adhesive could not hold in wet air.", "修理失败了，因为这种胶合剂在潮湿空气中粘不住。"]
  ],
  advertising: [
    [0, "Advertising can shape demand before consumers compare real quality.", "广告会在消费者比较真实质量之前影响需求。"],
    [1, "The advertising budget was larger than the budget for product testing.", "广告预算比产品测试预算更大。"]
  ],
  aesthetic: [
    [1, "The bridge had aesthetic value as well as practical strength.", "这座桥既有实用强度，也有审美价值。"],
    [2, "The museum's aesthetic favoured simple shapes and natural materials.", "这家博物馆的审美风格偏好简单形状和天然材料。"]
  ],
  affirmative: [
    [0, "The judge gave an affirmative answer after checking the document.", "法官检查文件后给出了肯定回答。"],
    [1, "Affirmative policies aimed to correct long-term exclusion from universities.", "积极支持性政策旨在纠正大学长期排斥某些群体的问题。"]
  ],
  alternative: [
    [0, "Solar power offered an alternative when fuel became too expensive.", "燃料过于昂贵时，太阳能提供了一种替代方案。"],
    [1, "The doctor suggested an alternative treatment with fewer side effects.", "医生建议了一种副作用更少的替代治疗。"]
  ],
  announcement: [
    [1, "The announcement of the discovery brought reporters to the laboratory.", "这一发现的发布把记者带到了实验室。"],
    [2, "A notice on the door served as an announcement of the schedule change.", "门上的通知起到了宣布日程变更的作用。"]
  ],
  antiquity: [
    [0, "In antiquity, coastal cities often grew rich through trade and shipbuilding.", "在古代，沿海城市常常通过贸易和造船致富。"],
    [1, "The museum returned the stolen antiquity to the country where it was found.", "博物馆把被盗古物归还给发现它的国家。"]
  ],
  apparatus: [
    [0, "The laboratory apparatus measured pressure changes inside the sealed chamber.", "实验室设备测量密封舱内的压力变化。"],
    [1, "A large administrative apparatus was needed to collect taxes across the empire.", "这个帝国需要庞大的行政机构来征收税款。"]
  ],
  apparently: [
    [0, "The disease apparently spread through water rather than direct contact.", "这种疾病显然是通过水传播，而不是直接接触传播。"],
    [1, "Apparently, the old map was copied from an even earlier drawing.", "据说，这张旧地图是从一幅更早的图复制来的。"]
  ],
  appearance: [
    [0, "The sudden appearance of smoke forced the miners to leave the tunnel.", "烟雾突然出现，迫使矿工离开隧道。"],
    [1, "The building's appearance changed after workers removed the modern paint.", "工人去除现代油漆后，这座建筑的外观发生了变化。"]
  ],
  argument: [
    [1, "Her argument depends on evidence from letters, maps, and tax records.", "她的论点依赖书信、地图和税务记录中的证据。"],
    [2, "A strong argument explains not only what happened but why it mattered.", "有力的论证不仅解释发生了什么，还解释为什么重要。"]
  ],
  arrival: [
    [0, "The arrival of steamships reduced the town's dependence on horses.", "蒸汽船的到来减少了这座城镇对马匹的依赖。"],
    [1, "The new arrival brought tools that local workers had never seen.", "这位新来者带来了当地工人从未见过的工具。"]
  ],
  articulation: [
    [1, "Clear articulation helps listeners distinguish similar sounds.", "清晰发音帮助听者区分相似音。"],
    [2, "The robot's articulation allowed its arm to turn in several directions.", "这个机器人的关节连接方式使手臂能朝多个方向转动。"]
  ],
  assistant: [
    [1, "The teaching assistant answered questions after the lecture.", "助教在讲座后回答问题。"],
    [2, "An assistant editor checked the figures before publication.", "助理编辑在出版前检查了图表。"]
  ],
  astronomical: [
    [0, "Astronomical observations helped sailors estimate their position at sea.", "天文观测帮助水手估算海上的位置。"],
    [1, "The cost of repairing the palace was astronomical.", "修复宫殿的费用极其庞大。"]
  ],
  atomic: [
    [0, "Atomic structure explains why elements react in different ways.", "原子结构解释了元素为什么以不同方式反应。"],
    [1, "Atomic energy promised cheap power but created new safety risks.", "原子能承诺提供廉价电力，但带来了新的安全风险。"]
  ],
  attention: [
    [1, "The trial attracted public attention because the evidence was unusual.", "这场审判因证据异常而引起公众关注。"],
    [2, "The soldier stood at attention while the officer inspected the line.", "军官检阅队列时，士兵立正站好。"]
  ],
  audit: [
    [1, "Independent experts audited the accounts after the charity lost money.", "慈善机构亏损后，独立专家审查了账目。"],
    [2, "She audited a history course without taking the final exam.", "她旁听了一门历史课，但没有参加期末考试。"]
  ],
  auditor: [
    [0, "The auditor found that several payments had not been recorded.", "审计员发现几笔付款没有被记录。"],
    [1, "As an auditor, he could attend lectures but did not receive credit.", "作为旁听生，他可以听课，但不能获得学分。"]
  ],
  author: [
    [0, "The author based the novel on interviews with railway workers.", "作者根据对铁路工人的访谈创作了这部小说。"],
    [1, "A small committee authored the first version of the constitution.", "一个小委员会起草了宪法的第一版。"]
  ],
  automatically: [
    [0, "The doors close automatically when the train begins to move.", "火车开始移动时，车门会自动关闭。"],
    [1, "Experienced readers do not automatically trust every statistic in a passage.", "有经验的读者不会不假思索地相信文章中的每个统计数字。"]
  ],
  basement: [
    [0, "The museum kept fragile documents in a dry basement.", "博物馆把脆弱文件保存在干燥的地下室。"],
    [1, "Engineers inspected the basement of the tower before repairing the walls.", "工程师修墙前检查了塔楼的基底。"]
  ],
  block: [
    [0, "A stone block from the old temple was reused in the city wall.", "旧寺庙的一块石块被重新用于城墙。"],
    [1, "Fallen trees blocked the road after the storm.", "暴风雨后，倒下的树阻塞了道路。"]
  ],
  bodily: [
    [0, "Bodily movement helps young children learn balance.", "身体运动帮助幼儿学习平衡。"],
    [1, "The guard carried the injured man bodily out of the smoke.", "守卫把受伤男子整个身体抬出了烟雾。"]
  ],
  bomb: [
    [0, "The bomb damaged the station but left the bridge standing.", "炸弹损坏了车站，但桥仍然立着。"],
    [1, "Aircraft bombed the harbour before troops landed.", "部队登陆前，飞机轰炸了港口。"]
  ],
  breathless: [
    [0, "The climb left the children breathless at the top of the hill.", "爬到山顶后，孩子们喘不过气来。"],
    [1, "The audience waited in breathless silence for the result.", "观众屏息静默地等待结果。"]
  ],
  building: [
    [0, "The old building survived because its stone walls were unusually thick.", "这座旧建筑保存下来，是因为石墙异常厚。"],
    [1, "The building of canals changed trade across the region.", "运河建设改变了整个地区的贸易。"]
  ],
  cache: [
    [0, "Explorers found a cache of tools hidden under the floor.", "探险者在地板下发现了一批隐藏工具。"],
    [1, "The browser cache stores images so pages can open faster.", "浏览器缓存储存图像，使页面打开更快。"]
  ],
  camp: [
    [0, "The survey team set up camp near the river.", "调查队在河边搭建营地。"],
    [1, "The debate divided scientists into two camps.", "这场争论把科学家分成两个阵营。"]
  ],
  capacity: [
    [1, "Her capacity to explain complex ideas made her an effective teacher.", "她解释复杂思想的能力使她成为一名有效的教师。"],
    [2, "He signed the letter in his capacity as director of the museum.", "他以博物馆馆长的身份签署了这封信。"]
  ],
  builder: [
    [0, "The builder chose local stone because it survived winter frost.", "建造者选择当地石材，因为它经得住冬季霜冻。"],
    [1, "Shared meals can be a builder of trust in a new team.", "共同进餐可以成为新团队信任的促进因素。"]
  ],
  bulb: [
    [0, "The new bulb used less electricity than the old lamp.", "新灯泡比旧灯耗电更少。"],
    [1, "A tulip bulb stores food underground before spring growth.", "郁金香球茎在春季生长前把养分储存在地下。"]
  ],
  canon: [
    [0, "The legal canon guided judges when written statutes were unclear.", "当成文法不清楚时，法律准则指导法官。"],
    [1, "Many readers argued that the novel belonged in the national canon.", "许多读者认为这部小说属于国家经典作品。"]
  ],
  carboniferous: [
    [0, "Carboniferous rocks often contain layers rich in ancient plant material.", "含碳岩石常常含有富含古代植物物质的层。"],
    [1, "The Carboniferous produced many of the coal deposits later used by industry.", "石炭纪形成了许多后来被工业使用的煤层。"]
  ],
  careful: [
    [0, "Careful measurement reduced mistakes in the temperature record.", "仔细测量减少了温度记录中的错误。"],
    [1, "A careful driver slows down before a narrow bridge.", "小心的司机会在窄桥前减速。"]
  ],
  careless: [
    [0, "Careless copying introduced several errors into the manuscript.", "粗心抄写给手稿带来了几个错误。"],
    [1, "His careless attitude toward safety worried the other workers.", "他对安全漫不经心的态度让其他工人担心。"]
  ],
  category: [
    [0, "The museum created a new category for objects used in daily work.", "博物馆为日常劳动中使用的物品建立了一个新类别。"],
    [1, "Beauty is a difficult category because each culture defines it differently.", "美是一个困难的范畴，因为每种文化对它的定义不同。"]
  ],
  celebrity: [
    [0, "The celebrity used her fame to raise money for flood victims.", "这位名人利用自己的名气为洪灾受害者筹款。"],
    [1, "Celebrity can disappear quickly when public attention moves elsewhere.", "当公众注意转向别处时，知名度可能很快消失。"]
  ],
  cent: [
    [0, "The price rose by only one cent, but millions of buyers noticed.", "价格只上涨了一分钱，但数百万买家都注意到了。"],
    [1, "A cent is one hundredth of a dollar.", "一美分是一美元的百分之一。"]
  ],
  ceremonial: [
    [0, "Ceremonial clothing showed the speaker's role in the community.", "仪式服装显示了演讲者在社群中的角色。"],
    [1, "The ceremonial lasted three days and included songs from several villages.", "这场仪式持续三天，包括几个村庄的歌曲。"]
  ],
  charter: [
    [0, "The city charter described the powers of local officials.", "城市宪章说明了地方官员的权力。"],
    [1, "The company chartered a boat to survey the islands.", "公司包租了一艘船去调查这些岛屿。"]
  ],
  chest: [
    [0, "Cold air made his chest hurt during the climb.", "爬山时，冷空气使他的胸口疼痛。"],
    [1, "The wooden chest contained letters from the first settlers.", "这个木箱装着第一批定居者的信件。"]
  ],
  chocolate: [
    [0, "Chocolate became popular in Europe after sugar prices fell.", "糖价下降后，巧克力在欧洲变得流行。"],
    [1, "The artist used chocolate brown paint for the old wooden door.", "画家用巧克力棕色颜料画旧木门。"]
  ],
  circuit: [
    [0, "A broken circuit stopped the alarm from ringing.", "断开的电路使警报无法响起。"],
    [1, "The judge travelled a rural circuit to hear cases in distant towns.", "法官沿乡村巡回路线前往偏远城镇审理案件。"]
  ],
  circulation: [
    [1, "Improved roads increased the circulation of newspapers beyond the capital.", "道路改善增加了报纸在首都以外的流通。"],
    [2, "The magazine's circulation fell when readers moved online.", "读者转向线上后，这本杂志的发行量下降了。"]
  ],
  classical: [
    [0, "Classical architecture used columns, balance, and clear proportions.", "古典建筑使用柱式、平衡和清晰比例。"],
    [1, "The experiment became a classical example of careful observation.", "这个实验成了细致观察的经典例子。"]
  ],
  clause: [
    [0, "A clause in the contract allowed either side to cancel after six months.", "合同中的一项条款允许任何一方在六个月后取消。"],
    [1, "The dependent clause cannot stand alone as a complete sentence.", "从属分句不能单独作为完整句子。"]
  ],
  coherent: [
    [1, "The witness gave a coherent account that matched the physical evidence.", "证人给出了与实物证据相符的一致叙述。"],
    [2, "Coherent light makes the laser useful for precise measurement.", "相干光使激光可用于精确测量。"]
  ],
  cohesion: [
    [1, "Repeated keywords improved the cohesion of the essay.", "重复关键词改善了文章的衔接。"],
    [2, "Water droplets form because of cohesion between molecules.", "水滴形成是因为分子之间的内聚力。"]
  ],
  colonise: [
    [0, "Foreign powers tried to colonise the island for its harbour.", "外国势力试图殖民这座岛，以获取其港口。"],
    [1, "Mosses can colonise bare rock before larger plants arrive.", "苔藓能在较大植物到来前占据裸岩。"]
  ],
  commentary: [
    [0, "The radio commentary helped listeners follow the match without seeing it.", "广播评论帮助听众在看不到比赛的情况下跟上进程。"],
    [1, "The edition included commentary explaining difficult historical references.", "这个版本包含解释困难历史典故的注释。"]
  ],
  companion: [
    [0, "A trusted companion made the long journey less frightening.", "可信赖的同伴让漫长旅程没那么可怕。"],
    [1, "The dog became a companion to patients living alone.", "这只狗成了独居病人的陪伴者。"]
  ],
  competition: [
    [0, "Competition for water increased during the dry season.", "旱季期间，对水的竞争加剧了。"],
    [1, "The school competition asked students to design a safer bridge.", "学校竞赛要求学生设计一座更安全的桥。"]
  ],
  composition: [
    [1, "The painting's composition leads the eye toward the small boat.", "这幅画的构图把视线引向小船。"],
    [2, "Her first composition combined local folk music with modern rhythm.", "她的第一首作品把当地民间音乐与现代节奏结合起来。"]
  ],
  confidence: [
    [1, "Public confidence in the hospital improved after the errors were reported openly.", "错误被公开报告后，公众对医院的信任提高了。"],
    [2, "A wider sample gives researchers greater confidence in the result.", "更大的样本使研究人员对结果更有信心。"]
  ],
  domestic: [
    [1, "Domestic work was rarely counted in official economic reports.", "家务劳动很少被计入官方经济报告。"],
    [2, "Domestic animals changed human diets and farming patterns.", "家养动物改变了人类饮食和农业模式。"]
  ],
  dramatic: [
    [1, "The actor paused for dramatic effect before revealing the letter.", "演员在揭示信件前停顿，以制造戏剧效果。"],
    [2, "A dramatic description made the storm seem almost alive.", "生动的描述使这场风暴仿佛有生命。"]
  ],
  gross: [
    [1, "Gross negligence allowed polluted water to reach the town.", "严重疏忽使污染水流入城镇。"],
    [2, "The film grossed more than expected in its first week.", "这部电影第一周的总收入超过预期。"]
  ],
  thorough: [
    [0, "A thorough investigation checked the records, interviews, and physical evidence before reaching a conclusion.", "一项彻底的调查会在得出结论前检查记录、访谈和实物证据。"],
    [1, "The guide gave a thorough description of each stage in the experiment.", "这份指南对实验的每个阶段都作了详尽说明。"],
    [2, "A thorough editor notices small errors that other readers often miss.", "一丝不苟的编辑会注意到其他读者常常漏掉的小错误。"]
  ],
  academic: [
    [0, "Academic writing requires evidence, clear definitions, and careful use of sources.", "学术写作需要证据、清楚的定义和谨慎使用资料来源。"],
    [1, "The question became academic once the company had already cancelled the project.", "公司已经取消项目后，这个问题就变得不切实际了。"]
  ],
  formal: [
    [0, "A formal complaint must include dates, names, and a clear description of the problem.", "正式投诉必须包括日期、姓名和对问题的清楚描述。"],
    [1, "The ceremony gave formal recognition to a change that had already happened in practice.", "这场仪式对实践中已经发生的变化给予了形式上的承认。"]
  ],
  reception: [
    [1, "The hotel improved reception by training staff to answer questions clearly.", "酒店通过培训员工清楚回答问题来改善接待服务。"],
    [2, "Radio reception became weak when the ship moved behind the cliffs.", "船驶到悬崖后方时，无线电接收效果变弱了。"]
  ],
  recover: [
    [0, "Wetlands can recover their natural function if pollution is reduced for several years.", "如果污染减少几年，湿地可以恢复其自然功能。"],
    [1, "Patients recover faster when treatment begins before the infection spreads.", "如果在感染扩散前开始治疗，病人会恢复得更快。"]
  ],
  believe: [
    [0, "Researchers believe the pattern is real only after independent teams repeat the result.", "只有独立团队重复得出结果后，研究人员才相信这种模式是真实的。"]
  ],
  convenient: [
    [0, "Online forms are convenient for users, but they can exclude people without reliable internet access.", "在线表格对用户很方便，但可能排除无法稳定上网的人。"]
  ],
  effective: [
    [1, "The new safety rule becomes effective at the beginning of next month.", "新的安全规定从下个月初开始生效。"]
  ],
  emotion: [
    [0, "Strong emotion can make a memory feel certain even when some details are wrong.", "强烈情绪会让记忆显得确定，即使某些细节是错的。"]
  ],
  final: [
    [0, "The final report changed after scientists found a mistake in the early measurements.", "科学家发现早期测量中有错误后，最终报告发生了变化。"]
  ],
  kind: [
    [0, "A kind response can reduce conflict before a small disagreement becomes serious.", "仁慈的回应可以在小分歧变严重之前减少冲突。"]
  ],
  labor: [
    [0, "Manual labor became less dangerous after the factory introduced better protective equipment.", "工厂引入更好的防护设备后，体力劳动变得没那么危险。"]
  ],
  limit: [
    [0, "Strict water limits forced farms to change the crops they planted.", "严格的用水限制迫使农场改变种植作物。"]
  ],
  mark: [
    [0, "A dark line on the wall marked the highest level reached by the flood.", "墙上的一条深色线标出了洪水达到的最高水位。"]
  ],
  object: [
    [0, "Archaeologists treated the broken bowl as an object that could reveal trade links.", "考古学家把这个破碗视为能揭示贸易联系的物体。"]
  ],
  opinion: [
    [0, "Public opinion changed after residents saw the full cost of the proposal.", "居民看到该提案的全部成本后，公众观点发生了变化。"]
  ],
  person: [
    [0, "One person can notice a risk that a large committee has overlooked.", "一个人可能注意到大型委员会忽视的风险。"]
  ],
  place: [
    [0, "The team chose a dry place to store the samples during the rainy season.", "团队在雨季选择了一个干燥的地方存放样本。"]
  ],
  play: [
    [0, "Children use play to test rules, roles, and social boundaries.", "儿童通过玩耍来试探规则、角色和社交边界。"]
  ],
  polish: [
    [0, "The writer revised the introduction several times to polish the argument.", "作者多次修改引言以润色论证。"]
  ],
  price: [
    [0, "The price of imported grain rose when storms damaged the main port.", "暴风雨损坏主要港口后，进口谷物价格上涨。"]
  ],
  profit: [
    [0, "A company may increase profit by cutting waste rather than lowering wages.", "公司可以通过减少浪费而不是降低工资来增加利润。"]
  ],
  provide: [
    [0, "Public libraries provide quiet space, internet access, and help with difficult forms.", "公共图书馆提供安静空间、网络接入以及填写困难表格的帮助。"]
  ],
  realise: [
    [0, "Officials realised too late that the old bridge could not carry heavier traffic.", "官员太晚才意识到旧桥无法承载更重的交通流量。"]
  ],
  recovery: [
    [0, "Economic recovery was slow because many small businesses had lost their customers.", "经济复苏缓慢，因为许多小企业已经失去了顾客。"]
  ],
  static: [
    [0, "A static model cannot show how quickly families move when jobs disappear.", "静态模型无法显示就业消失时家庭迁移的速度。"]
  ],
  value: [
    [0, "The value of clean water becomes obvious when a city faces a long drought.", "当城市面临长期干旱时，清洁水的价值会变得明显。"]
  ],
  view: [
    [0, "From the historian's view, the invention changed work more than leisure.", "从历史学家的观点看，这项发明对工作的改变大于对休闲的改变。"]
  ],
  human: [
    [0, "Human memory changes when people retell the same event many times.", "人们多次复述同一事件时，人类记忆会发生变化。"],
    [1, "A human can adapt to a new climate, but the process may take years.", "人能够适应新的气候，但这个过程可能需要多年。"]
  ],
  eventually: [[0, "The small settlement eventually became a busy port.", "这个小定居点最终变成了繁忙港口。"]],
  several: [[0, "Several witnesses described the same sound before the building shook.", "几名目击者描述了建筑摇晃前同一种声音。"]],
  world: [[0, "The ancient map showed a world much smaller than the one sailors later discovered.", "这张古地图显示的世界比后来水手发现的世界小得多。"]],
  time: [[0, "Scientists need time to test whether a new method is reliable.", "科学家需要时间来检验一种新方法是否可靠。"]],
  coast: [
    [0, "Villages along the coast depended on fishing and seasonal trade.", "沿海村庄依靠捕鱼和季节性贸易。"],
    [1, "The boat began to coast after the engine was switched off.", "发动机关闭后，小船开始滑行。"]
  ],
  entirely: [[0, "The result was not entirely unexpected after weeks of heavy rain.", "经过数周大雨后，这个结果并非完全出人意料。"]],
  directly: [[0, "The new road connects the inland town directly with the harbour.", "新道路把内陆城镇和港口直接连接起来。"]],
  animal: [[0, "Each animal leaves traces that can reveal its diet and movement.", "每种动物都会留下能揭示其饮食和活动的痕迹。"]],
  early: [
    [0, "Early evidence suggests that the settlement was larger than expected.", "早期证据表明该定居点比预期更大。"],
    [1, "The research team arrived early to record the morning temperature.", "研究小组提前到达以记录清晨温度。"]
  ],
  gradually: [[0, "The language gradually changed as traders moved between regions.", "随着商人在地区之间流动，这种语言逐渐发生变化。"]],
  make: [[0, "Repeated observations make the pattern easier to recognize.", "反复观察使这种模式更容易被识别。"]],
  hold: [
    [0, "The clamp can hold the sample steady during the experiment.", "夹具能在实验中固定样本。"],
    [1, "The museum holds records from several coastal communities.", "博物馆保存着几个沿海社区的记录。"],
    [2, "Some historians hold that climate change influenced the migration.", "一些历史学家认为气候变化影响了迁徙。"]
  ],
  southern: [[0, "Southern winds brought warm air across the valley.", "南风把暖空气带过山谷。"]],
  creature: [
    [0, "The fossil belonged to a small sea creature with a hard shell.", "这块化石属于一种有硬壳的小型海洋生物。"],
    [1, "The story describes the city as a creature that grows at night.", "这个故事把城市描写成一种在夜间生长的造物。"]
  ],
  food: [[0, "Stored food allowed the community to survive the long winter.", "储存的食物让这个社群熬过了漫长冬季。"]],
  stone: [[0, "Workers used local stone to build the walls of the temple.", "工人使用当地石材建造寺庙墙体。"]],
  turn: [[0, "A sudden turn in the river created a natural harbour.", "河流突然转弯形成了天然港湾。"]],
  central: [
    [0, "The central chamber was warmer than the outer rooms.", "中央房间比外侧房间更暖。"],
    [1, "Water control became a central issue in the farming debate.", "水资源控制成了农业争论中的核心问题。"]
  ],
  community: [
    [0, "The local community repaired the road after the flood.", "当地社区在洪水后修复了道路。"],
    [1, "A shared language helped the migrants form a new community.", "共同语言帮助移民形成新的共同体。"],
    [2, "A coral community can collapse when water temperature rises too quickly.", "水温上升过快时，珊瑚群落可能崩溃。"]
  ],
  winter: [[0, "In winter, the river froze and trade moved onto the ice.", "冬天河流结冰，贸易转移到冰面上。"]],
  brain: [
    [0, "The human brain can compare sounds before a person notices the difference.", "人脑能在人察觉差异之前比较声音。"],
    [1, "The project needed a brain who understood both history and statistics.", "这个项目需要一个同时懂历史和统计的聪明人。"]
  ],
  court: [
    [0, "The court examined whether the factory had broken environmental law.", "法院审查该工厂是否违反了环境法。"],
    [1, "The school built a new court for basketball and tennis.", "学校建了一个新的篮球和网球场地。"],
    [2, "Several cities court investment by offering tax advantages.", "几个城市通过税收优惠争取投资。"]
  ],
  drive: [
    [0, "Researchers had to drive across the desert to reach the site.", "研究人员必须开车穿过沙漠到达遗址。"],
    [1, "Rising demand can drive companies to search for cheaper materials.", "需求上升会推动公司寻找更便宜的材料。"],
    [2, "The soldiers tried to drive the animals away from the crops.", "士兵试图把动物从庄稼地赶走。"],
    [3, "Her drive to solve the problem kept the team focused.", "她解决问题的冲劲让团队保持专注。"]
  ],
  experiment: [
    [0, "The experiment tested whether salt slowed the growth of bacteria.", "这个实验测试盐是否会减缓细菌生长。"],
    [1, "Engineers experiment with lighter materials to reduce fuel use.", "工程师尝试使用更轻的材料来减少燃料消耗。"]
  ],
  moment: [[0, "At that moment, the signal disappeared from every screen.", "就在那一刻，信号从每个屏幕上消失了。"]],
  order: [[0, "Written rules created order in a market that had become chaotic.", "书面规则为一个变得混乱的市场建立了秩序。"]],
  simultaneously: [[0, "The two instruments recorded the same vibration simultaneously.", "两台仪器同时记录到了同一次振动。"]],
  centre: [[0, "The research centre stores samples from many regions.", "这个研究中心保存着来自许多地区的样本。"]],
  direction: [
    [0, "The direction of the wind changed before the storm arrived.", "暴风雨到来前风向发生了变化。"],
    [1, "Clear direction helped volunteers finish the survey quickly.", "清楚的指导帮助志愿者快速完成调查。"]
  ],
  government: [[0, "The government introduced rules to protect coastal wetlands.", "政府出台规定保护沿海湿地。"]],
  local: [[0, "Local farmers noticed the change before national officials did.", "当地农民比国家官员更早注意到这种变化。"]],
  original: [
    [0, "The original plan was cheaper but less safe.", "最初的方案更便宜但安全性较低。"],
    [1, "The archive keeps the original beside a digital copy.", "档案馆把原件和数字副本放在一起保存。"]
  ],
  sunlight: [[0, "Sunlight warmed the shallow water and helped algae grow.", "阳光温暖了浅水区并帮助藻类生长。"]],
  chemical: [
    [0, "A chemical reaction changed the colour of the liquid.", "化学反应改变了液体的颜色。"],
    [1, "The laboratory stored each chemical in a labelled bottle.", "实验室把每种化学品存放在贴有标签的瓶子里。"]
  ],
  design: [
    [0, "The bridge design reduced pressure on the central support.", "桥梁设计减轻了中央支柱的压力。"],
    [1, "Engineers design shelters that can survive strong winds.", "工程师设计能够抵御强风的避难所。"]
  ],
  movement: [[0, "The movement of warm water changed the local climate.", "暖水流动改变了当地气候。"]],
  available: [
    [0, "Reliable data became available after the second survey.", "第二次调查后，可靠数据变得可获得。"],
    [1, "The old machine is still available for simple tests.", "这台旧机器仍可用于简单测试。"],
    [2, "The doctor is available after three o'clock.", "医生三点以后有空。"]
  ],
  colony: [
    [0, "The island became a colony after foreign ships arrived.", "外国船只到达后，这座岛成了殖民地。"],
    [1, "A colony of ants built tunnels under the dry soil.", "一群蚂蚁在干土下筑起通道。"]
  ],
  continuously: [[0, "The sensor measured temperature continuously for six months.", "传感器连续六个月测量温度。"]],
  leaf: [[0, "A broad leaf loses water more quickly in hot wind.", "宽大的叶子在热风中失水更快。"]],
  natural: [[0, "Natural barriers protected the valley from sudden invasion.", "天然屏障保护了山谷免受突然入侵。"]],
  agricultural: [[0, "Agricultural production increased when irrigation became reliable.", "灌溉变得可靠后，农业产量增加了。"]],
  interior: [[0, "The interior wall was covered with painted symbols.", "内部墙面覆盖着彩绘符号。"]],
  late: [[0, "Late reports suggested that the storm had damaged the harbour.", "后来的报告显示暴风雨损坏了港口。"]],
  present: [[0, "The speaker will present the results after the final test.", "发言人会在最终测试后呈现结果。"]],
  cell: [
    [0, "A cell can divide rapidly when conditions are favourable.", "条件有利时，细胞可以迅速分裂。"],
    [1, "The prisoner was kept in a narrow cell below the courthouse.", "囚犯被关在法院地下的一间狭小牢房里。"],
    [2, "The activist cell communicated through coded messages.", "这个行动小组通过加密信息沟通。"],
    [3, "The spreadsheet cell contained the wrong number.", "电子表格单元格里填了错误数字。"]
  ],
  electrical: [[0, "Electrical signals passed through the damaged cable irregularly.", "电信号不规则地通过受损电缆。"]],
  method: [[0, "The new method reduced error without increasing cost.", "这种新方法减少了误差而没有增加成本。"]],
  previously: [[0, "The species had previously been recorded only in warmer seas.", "这个物种以前只在更温暖的海域被记录过。"]],
  rain: [[0, "Heavy rain filled the basin within a few hours.", "大雨在几小时内灌满了盆地。"]],
  real: [[0, "The real cost of the project appeared only after repairs began.", "维修开始后，项目的真实成本才显现出来。"]],
  sound: [
    [0, "The argument may sound reasonable, but the evidence is weak.", "这个论点听起来也许合理，但证据很薄弱。"],
    [1, "A sound bridge design must account for wind and weight.", "可靠的桥梁设计必须考虑风力和重量。"],
    [2, "A sound body recovers more quickly after illness.", "健康的身体在病后恢复得更快。"],
    [3, "The committee made a sound decision after reviewing the data.", "委员会审查数据后作出了合理决定。"]
  ],
  approximately: [[0, "The wall was approximately two metres thick.", "这堵墙大约两米厚。"]],
  increasingly: [[0, "Water became increasingly scarce as the city expanded.", "随着城市扩张，水变得越来越稀缺。"]],
  lifetime: [[0, "A single tree can store carbon throughout its lifetime.", "一棵树可以在其一生中储存碳。"]],
  patiently: [[0, "The archaeologist patiently brushed dust from the fragile bone.", "考古学家耐心地刷去脆弱骨头上的尘土。"]],
  polar: [[0, "Polar ice reflects sunlight and helps cool the planet.", "极地冰反射阳光，帮助地球降温。"]],
  short: [[0, "A short report can still contain precise evidence.", "简短报告仍然可以包含精确证据。"]],
  snow: [[0, "Fresh snow covered the tracks before researchers could measure them.", "研究人员来得及测量前，新雪覆盖了足迹。"]],
  station: [
    [0, "The research station collected weather data every morning.", "研究站每天早晨收集天气数据。"],
    [1, "The train station became crowded after the announcement.", "公告发布后，火车站变得拥挤。"],
    [2, "The platform at the station was rebuilt after the flood.", "车站的站台在洪水后被重建。"]
  ],
  subsequently: [[0, "The law was subsequently revised after public criticism.", "这项法律随后在公众批评后被修改。"]],
  temperature: [[0, "A small rise in temperature can change the breeding season.", "温度小幅上升就可能改变繁殖季节。"]],
  ultimately: [
    [0, "The experiment ultimately failed because the samples were contaminated.", "实验最终失败，因为样本被污染了。"],
    [1, "The debate is ultimately about who controls public resources.", "这场争论本质上关乎谁控制公共资源。"]
  ],
  universal: [[0, "A universal rule may still affect different communities unequally.", "一条普遍规则仍可能对不同社群产生不平等影响。"]],
  childhood: [[0, "Childhood nutrition can influence health many years later.", "童年营养会在多年后影响健康。"]],
  exactly: [
    [0, "The instrument measured exactly three grams of powder.", "仪器精确测量出三克粉末。"],
    [1, "That is exactly the pattern the model predicted.", "这正是模型预测的模式。"]
  ],
  factory: [[0, "The factory released warm water into the river.", "工厂把温水排入河流。"]],
  fish: [[0, "Fish moved upstream when the water became warmer.", "水变暖时，鱼向上游移动。"]],
  immediately: [[0, "The alarm sounded immediately after the pressure dropped.", "压力下降后警报立即响起。"]],
  machine: [[0, "The machine sorted seeds by size and weight.", "这台机器按大小和重量分拣种子。"]],
  marine: [
    [0, "Marine trade connected the island to distant markets.", "海上贸易把这座岛和遥远市场连接起来。"],
    [1, "Marine animals are sensitive to changes in water temperature.", "海洋动物对水温变化很敏感。"]
  ],
  publicly: [[0, "The mayor publicly admitted that the estimate was wrong.", "市长公开承认估算错误。"]],
  repeatedly: [[0, "Researchers repeatedly tested the sample to confirm the result.", "研究人员反复测试样本以确认结果。"]],
  shell: [
    [0, "The shell protected the creature from sharp sand.", "外壳保护这种生物免受尖锐沙粒伤害。"],
    [1, "The old shell was found near the battlefield.", "旧炮弹在战场附近被发现。"]
  ],
  signal: [
    [0, "A weak signal warned engineers that the bridge was moving.", "微弱信号警告工程师桥梁正在移动。"],
    [1, "The red light signals danger to approaching ships.", "红灯向靠近的船只发出危险信号。"]
  ],
  song: [[0, "The song preserved the story of a migration across the mountains.", "这首歌保存了一段翻山迁徙的故事。"]],
  wave: [[0, "A large wave carried sand over the low wall.", "一个大浪把沙子卷过低墙。"]]
};

const EXTRA_GLOSS_PATCHES = {
  late: [[0, "delayed, recent"]],
  material: [[1, "raw substance"]],
  nebulae: [[0, "clouds of gas"]],
  open: [[0, "unlocked, available"]],
  present: [[0, "show, current"]],
  resource: [[0, "supply, asset"]],
  scratche: [[0, "scratch, scrape"]],
  thin: [[0, "slender, weak"]],
  transplant: [[2, "implanted organ"]],
  undergone: [[0, "experienced"]],
  undergraduate: [[0, "college student"]],
  underwent: [[0, "experienced"]],
  upright: [[0, "vertical, honest"]],
  walk: [[0, "move on foot"]],
  accent: [[0, "pronunciation"]],
  alumnus: [[0, "former student"]],
  anxiolytic: [[0, "anti-anxiety drug"]],
  behind: [[0, "at the back"]],
  biennial: [[0, "every two years"]],
  championship: [[0, "title competition"]],
  except: [[0, "exclude"]],
  flagellum: [[0, "whip-like tail"]],
  fly: [[0, "move through air"]],
  fractal: [[0, "repeating pattern"]],
  incognito: [[0, "secretly"]],
  injectable: [[0, "able to be injected"]],
  inland: [[0, "interior, away from coast"]],
  "load-bearing": [[0, "weight-supporting"]],
  northward: [[0, "toward the north"]],
  outermost: [[0, "farthest outside"]],
  outward: [[0, "external"]],
  overland: [[0, "by land"]],
  plicate: [[0, "folded"]],
  repose: [[0, "rest, place trust"]],
  reprint: [[0, "print again"]],
  seventeen: [[0, "number 17"]],
  transmitted: [[0, "passed on"]],
  travelled: [[0, "experienced in travel"]],
  travelling: [[0, "moving"]],
  whereby: [[0, "by which"]],
  wherein: [[0, "in which"]],
  introduction: [[1, "bringing in"], [2, "preface"]],
  mobile: [[0, "movable"], [1, "changeable"], [2, "hanging decoration"]],
  physical: [[1, "natural, physics-related"], [2, "material, tangible"]],
  radical: [[2, "reactive atom group"], [3, "extreme reformer"]],
  reference: [[0, "mention"], [1, "source, consultation"], [2, "recommendation"]],
  relative: [[1, "related"], [2, "family member"]],
  landscape: [[0, "scenery"], [1, "landscape painting"]],
  mineral: [[1, "mineral-related"]],
  optional: [[0, "not required"], [1, "voluntary"]],
  promptly: [[0, "quickly"], [1, "immediately"]],
  slightly: [[0, "a little"], [1, "somewhat"]],
  president: [[0, "head of state"], [1, "university head"], [2, "company head"]],
  preference: [[0, "liking"], [1, "priority"]],
  pursuit: [[1, "activity, occupation"]],
  scavenger: [[1, "carrion-eating animal"]],
  sponge: [[1, "sponger, parasite"]]
};

function addExtraCardPatches(cards) {
  const byHead = new Map(cards.map((card) => [card.head, card]));
  for (const patch of EXTRA_CARD_PATCHES) {
    const existing = byHead.get(patch.head);
    if (existing) {
      existing.cut = existing.cut || patch.cut;
      existing.cutMeaning = existing.cutMeaning || patch.cutMeaning;
      const first = existing.senses?.[0];
      if (first && patch.phrase && !(first.phrases || []).some((item) => item.en === patch.phrase[0])) {
        first.phrases = first.phrases || [];
        first.phrases.unshift({ en: patch.phrase[0], zh: patch.phrase[1] });
      }
      continue;
    }
    cards.push({
      head: patch.head,
      phonetic: "",
      cut: patch.cut,
      cutMeaning: patch.cutMeaning,
      senses: [{
        index: "",
        pos: patch.pos,
        zh: patch.zh,
        gloss: patch.gloss,
        examples: patch.example ? [{ en: patch.example[0], zh: patch.example[1] }] : [],
        phrases: patch.phrase ? [{ en: patch.phrase[0], zh: patch.phrase[1] }] : []
      }]
    });
  }
  return cards.sort((a, b) => a.head.localeCompare(b.head));
}

function addExtraExamplePatches(cards) {
  const byHead = new Map(cards.map((card) => [card.head, card]));
  for (const [head, patches] of Object.entries(EXTRA_EXAMPLE_PATCHES)) {
    const card = byHead.get(head);
    if (!card || !Array.isArray(card.senses)) continue;
    for (const [senseIndex, en, zh] of patches) {
      const sense = card.senses[senseIndex] || card.senses[0];
      if (!sense || !en || !zh) continue;
      sense.examples = sense.examples || [];
      const exists = sense.examples.some((example) => example.en === en);
      if (!exists) sense.examples.unshift({ en, zh });
    }
  }
  return cards;
}

function addExtraGlossPatches(cards) {
  const byHead = new Map(cards.map((card) => [card.head, card]));
  for (const [head, patches] of Object.entries(EXTRA_GLOSS_PATCHES)) {
    const card = byHead.get(head);
    if (!card || !Array.isArray(card.senses)) continue;
    for (const [senseIndex, gloss] of patches) {
      const sense = card.senses[senseIndex] || card.senses[0];
      if (sense && gloss) sense.gloss = gloss;
    }
  }
  return cards;
}

function removeIncompleteExamples(cards) {
  const polluted = /(Learners can use|Academic readers often meet|Researchers often use|word network|appears in reading contexts|In academic writing,|prefix-preserved family)/i;
  for (const card of cards) {
    for (const sense of card.senses || []) {
      sense.examples = (sense.examples || []).filter((example) => (
        clean(example.en) &&
        clean(example.zh) &&
        !polluted.test(example.en) &&
        !polluted.test(example.zh)
      ));
      sense.phrases = (sense.phrases || []).map((phrase) => ({
        en: phrase.en,
        zh: clean(phrase.zh).replace(/,Card$/i, "")
      }));
    }
  }
  return cards;
}

const CUT_OVERRIDES = {
  electroencephalogram: ["electro/encephalo/gram", "电/脑/记录；图"],
  palaeoanthropologist: ["palaeo/anthrop/o/log/ist", "古/人类/连接/学；研究/人"],
  pedestrianisation: ["ped/estr/ian/is/ation", "脚；步行/相关/人；形容词/动词/名词"],
  crystallographic: ["crystall/o/graph/ic", "晶体/连接/写；记录/形容词"],
  deconstructivist: ["de/construct/iv/ist", "拆开；向下/建造；构成/形容词/人"],
  immunodeficiency: ["immuno/de/fic/iency", "免疫/缺少；向下/做；形成/名词"],
  interoperability: ["inter/oper/abil/ity", "相互；之间/工作；操作/能够；可/名词"],
  neurotransmitter: ["neuro/trans/mit/ter", "神经/穿过；转移/发送；传递/物"],
  desertification: ["desert/ific/ation", "沙漠/使成为/名词"],
  diversification: ["di/vers/ific/ation", "分开；离开/转/使成为/名词"],
  electromagnetic: ["electro/magnet/ic", "电/磁/形容词"],
  marginalisation: ["margin/al/is/ation", "边缘/形容词/动词/名词"],
  neuroplasticity: ["neuro/plast/ic/ity", "神经/塑造/形容词/名词"],
  ophthalmologist: ["ophthalm/o/log/ist", "眼/连接/学；研究/人"],
  procrastination: ["pro/crastin/ation", "向前；拖延/明天；延迟/名词"],
  standardisation: ["standard/is/ation", "标准/动词/名词"],
  suprachiasmatic: ["supra/chiasm/atic", "在上；超过/交叉/形容词"],
  undistinguished: ["un/distinguish/ed", "不；相反/区分；辨别/形容词"],
  gentrification: ["gentr/ific/ation", "士绅；上层/使成为/名词"],
  lateralisation: ["later/al/is/ation", "侧边/形容词/动词/名词"],
  lateralization: ["later/al/iz/ation", "侧边/形容词/动词/名词"],
  methodological: ["method/o/log/ic/al", "方法/连接/学；研究/形容词/形容词"],
  pasteurisation: ["pasteur/is/ation", "巴氏；灭菌/动词/名词"],
  preferentially: ["prefer/ent/ial/ly", "偏爱；更喜欢/形容词/形容词/副词"],
  quintessential: ["quint/ess/ent/ial", "第五/本质/形容词/形容词"],
  representative: ["re/present/ative", "再次；回/呈现；代表/形容词；人"],
  revitalisation: ["re/vital/is/ation", "再次；重新/生命；活力/动词/名词"],
  secularization: ["secular/iz/ation", "世俗的/动词/名词"],
  stratification: ["strat/ific/ation", "层/使成为/名词"],
  susceptibility: ["sus/cept/ibil/ity", "在下；暗中/拿取；接受/能够；可/名词"],
  systematically: ["system/atic/al/ly", "系统/形容词/形容词/副词"],
  uncontrollable: ["un/control/lable", "不；相反/控制/能够；可"],
  utilitarianism: ["util/it/arian/ism", "有用；使用/名词/人；形容词/主义"],
  virtualisation: ["virtual/is/ation", "虚拟的/动词/名词"],
  contradictory: ["contra/dict/ory", "反对；相反/说；断言/形容词"],
  ethnocentrism: ["ethno/centr/ism", "民族/中心/主义"],
  globalisation: ["glob/al/is/ation", "球；全球/形容词/动词/名词"],
  justification: ["just/ific/ation", "正义；正确/使成为/名词"],
  metacognition: ["meta/cogn/ition", "超越；关于自身/知道；认识/名词"],
  metamorphosis: ["meta/morph/osis", "改变；超越/形状/状态；过程"],
  neighbourhood: ["neighbour/hood", "邻居/状态；范围"],
  opportunistic: ["op/port/un/ist/ic", "朝向/携带；机会/名词/人/形容词"],
  painstakingly: ["pain/stak/ing/ly", "痛苦/用力；努力/形容词/副词"],
  philosophical: ["philo/soph/ic/al", "爱/智慧/形容词/形容词"],
  procrastinate: ["pro/crastin/ate", "向前；拖延/明天；延迟/动词"],
  progressively: ["pro/gress/ive/ly", "向前/行走；前进/形容词/副词"],
  qualification: ["qual/ific/ation", "性质；资格/使成为/名词"],
  recalibration: ["re/calibr/ation", "重新/校准/名词"],
  reunification: ["re/uni/fic/ation", "重新/一/使成为/名词"],
  technological: ["techn/o/log/ic/al", "技术/连接/学；研究/形容词/形容词"],
  telecommunication: ["tele/commun/ication", "远；电/共同；交流/名词"],
  transcription: ["trans/script/ion", "转移；穿过/写/名词"],
  unambiguously: ["un/ambigu/ous/ly", "不；相反/游移；不明确/形容词/副词"],
  unflinchingly: ["un/flinch/ing/ly", "不；相反/退缩/形容词/副词"],
  bureaucratic: ["bureau/crat/ic", "办公室；机构/统治；官员/形容词"],
  catastrophic: ["catastroph/ic", "灾难/形容词"],
  choreography: ["chor/e/o/graph/y", "舞蹈；合唱/词尾/连接/写；记录/名词"],
  civilisation: ["civil/is/ation", "公民；文明/动词/名词"],
  connectivity: ["connect/iv/ity", "连接/形容词/名词"],
  cryptography: ["crypt/o/graph/y", "隐藏/连接/写；记录/名词"],
  digitization: ["digit/iz/ation", "数字/动词/名词"],
  epistemology: ["epistem/o/log/y", "知识/连接/学；研究/名词"],
  geographical: ["geo/graph/ic/al", "地球；土地/写；记录/形容词/形容词"],
  hypothetical: ["hypo/thet/ic/al", "在下；假设/放置；提出/形容词/形容词"],
  longitudinal: ["long/itud/in/al", "长/状态/名词/形容词"],
  meritocratic: ["merit/o/crat/ic", "功绩/连接/统治；制度/形容词"],
  methodically: ["method/ic/al/ly", "方法/形容词/形容词/副词"],
  modification: ["mod/ific/ation", "方式；模式/使成为/名词"],
  neuroscience: ["neuro/sci/ence", "神经/知道/名词"],
  conservatoire: ["conserv/atoire", "保存；训练/场所"],
  fallingwater: ["falling/water", "落下的/水"],
  northeastern: ["north/east/ern", "北/东/形容词"],
  occupational: ["occup/ation/al", "占据；职业/名词/形容词"],
  optimisation: ["optim/is/ation", "最好/动词/名词"],
  periodically: ["period/ic/al/ly", "周期；时期/形容词/形容词/副词"],
  photovoltaic: ["photo/volta/ic", "光/电压；伏特/形容词"],
  proclamation: ["pro/claim/ation", "向前；公开/呼喊；宣称/名词"],
  quantitative: ["quant/it/ative", "数量/名词/形容词"],
  ramification: ["ram/ific/ation", "分枝/使成为/名词"],
  relentlessly: ["re/lent/less/ly", "反复；回/放松/无/副词"],
  salinization: ["salin/iz/ation", "盐/动词/名词"],
  significance: ["sign/ific/ance", "标记；意义/使成为/名词"],
  sophisticated: ["soph/istic/at/ed", "智慧；诡辩/相关/动词/形容词"],
  stereoscopic: ["stereo/scop/ic", "立体/看；观察/形容词"],
  stratigraphy: ["strat/i/graph/y", "层/连接/写；记录/名词"],
  subterranean: ["sub/terr/anean", "在下/土地/形容词"],
  sufficiently: ["suf/fic/ient/ly", "在下；充分/做；形成/形容词/副词"],
  thematically: ["theme/atic/al/ly", "主题/形容词/形容词/副词"],
  thermohaline: ["thermo/hal/ine", "热/盐/形容词"],
  toxicologist: ["tox/ic/o/log/ist", "毒/形容词/连接/学；研究/人"],
  tranquillity: ["tranquil/lity", "安静；平静/名词"],
  transparency: ["trans/par/ency", "穿过/显现；出现/名词"],
  unemployment: ["un/employ/ment", "不；无/雇用/名词"],
  unforgivable: ["un/for/giv/able", "不；相反/完全；离开/给予/能够；可"],
  unmistakable: ["un/mistak/able", "不；相反/错误；误认/能够；可"],
  unprofitable: ["un/profit/able", "不；相反/利润/能够；可"],
  unrepeatable: ["un/repeat/able", "不；相反/重复/能够；可"],
  unverifiable: ["un/ver/ify/able", "不；相反/真实/使成为/能够；可"],
  verification: ["ver/ific/ation", "真实/使成为/名词"],
  behaviorism: ["behavior/ism", "行为/主义"],
  bombardment: ["bombard/ment", "轰击；炮轰/名词"],
  catastrophe: ["cata/stroph/e", "向下；完全/转向；灾变/词尾"],
  catastrophic: ["cata/stroph/ic", "向下；完全/转向；灾变/形容词"],
  categorical: ["categor/ic/al", "类别/形容词/形容词"],
  cognitively: ["cogn/itive/ly", "知道；认识/形容词/副词"],
  consolatory: ["con/sol/atory", "共同；加强/安慰/形容词"],
  crustacean: ["crust/acean", "壳；硬层/动物名词"],
  cybernetic: ["cyber/net/ic", "控制；网络/网络/形容词"],
  derivative: ["deriv/ative", "引出；派生/形容词；名词"],
  durability: ["dur/abil/ity", "持久/能够；可/名词"],
  emblematic: ["emblem/atic", "象征/形容词"],
  flagellant: ["flagell/ant", "鞭打/人；形容词"],
  geological: ["geo/log/ic/al", "地球；土地/学；研究/形容词/形容词"],
  geothermal: ["geo/therm/al", "地球；土地/热/形容词"],
  advanced: ["ad/vanc/ed", "向前/前进/形容词"],
  inadequate: ["in/ad/equ/ate", "不/向；加强/相等；合适/形容词"],
  cognition: ["cogn/ition", "知道；认识/名词"],
  cognitive: ["cogn/itive", "知道；认识/形容词"],
  recognition: ["re/cogn/ition", "再次；重新/知道；认识/名词"],
  reciprocal: ["re/ciprocal", "回；相互/互换"],
  strategy: ["strateg/y", "战略；部署/名词"],
  emergency: ["e/merg/ency", "向外/浮现；出现/名词"],
  debt: ["debt", "债务"],
  fabric: ["fabric", "织物；结构"],
  favour: ["favour", "赞成；帮助"],
  neurology: ["neuro/log/y", "神经/学科；研究/名词"],
  foundation: ["found/ation", "基础；建立/名词"],
  president: ["pre/sid/ent", "在前；预先/坐；主持/人；形容词"],
  gesture: ["gest/ure", "携带；动作；姿态/名词"],
  cover: ["cover", "覆盖；保护"],
  counter: ["counter", "相反；柜台；计数器"],
  monitor: ["monit/or", "提醒；监视/人；物"],
  intervention: ["inter/ven/tion", "在中间；介入/来/名词"],
  contingent: ["con/ting/ent", "共同；加强/接触；取决于/形容词"],
  risk: ["risk", "风险"],
  bridge: ["bridge", "桥；连接"],
  reputation: ["re/put/ation", "再次；重新/认为；估计/名词"],
  innovation: ["in/nov/ation", "进入；使/新的/名词"],
  policy: ["polic/y", "国家；城市；治理/名词"],
  proximity: ["proxim/ity", "接近；邻近/名词"],
  margin: ["margin", "边缘；余地"],
  form: ["form", "形式；形成"],
  signature: ["sign/ature", "标记；签署/名词"],
  operational: ["oper/at/ion/al", "工作；操作/动词/名词/形容词"],
  deterioration: ["deterior/ation", "变坏；恶化/名词"],
  removal: ["remov/al", "移除；去除/名词"],
  registration: ["registr/ation", "登记；注册/名词"],
  supervisor: ["super/vis/or", "在上；监督/看/人"],
  safety: ["safe/ty", "安全/名词"],
  future: ["fut/ure", "将来；前方/名词"],
  experience: ["ex/per/ience", "向外/尝试；经历/名词"],
  experienced: ["ex/peri/ence/d", "向外/尝试；经历/形容词"],
  inexperienced: ["in/ex/peri/ence/d", "不；无/向外/尝试；经历/形容词"],
  diversify: ["di/vers/ify", "离开；分开/转/使成为"],
  diversified: ["di/vers/ifi/ed", "离开；分开/转/使成为/形容词"],
  diversification: ["di/vers/ific/ation", "离开；分开/转/使成为/名词"],
  codification: ["cod/ific/ation", "法规；编码/使成为/名词"],
  dispute: ["dis/put/e", "分开；不同/思考；争论/词尾"],
  disputable: ["dis/put/able", "分开；不同/思考；争论/能够；可"],
  repute: ["re/put/e", "再次；重新/认为；评价/词尾"],
  reputable: ["re/put/able", "再次；重新/认为；评价/能够；可"],
  disreputable: ["dis/re/put/able", "不；相反/再次；重新/认为；评价/能够；可"],
  absolutism: ["ab/solut/ism", "离开；完全/松开；解除/主义"],
  absolutist: ["ab/solut/ist", "离开；完全/松开；解除/人"],
  activate: ["activ/ate", "活跃；行动/动词"],
  administer: ["ad/minist/er", "向；加强/服务；管理/动词"],
  admitted: ["ad/mitt/ed", "向；加强/送入；承认/形容词"],
  admitting: ["ad/mitt/ing", "向；加强/送入；承认/名词；形容词"],
  advisable: ["ad/vis/able", "向；加强/看；考虑/能够；可"],
  align: ["a/lign", "向；加强/线；排列"],
  aligner: ["a/lign/er", "向；加强/线；排列/人；物"],
  alignment: ["a/lign/ment", "向；加强/线；排列/名词"],
  ambition: ["ambi/tion", "四周；两边/行动；状态"],
  amplifier: ["ampl/ifi/er", "大；扩大/使成为/人；物"],
  announcer: ["an/nounc/er", "向；加强/宣布；报告/人"],
  applied: ["ap/pli/ed", "向；加强/折叠；应用/形容词"],
  arguable: ["argu/able", "争论；证明/能够；可"],
  arguer: ["argu/er", "争论；证明/人"],
  aspiration: ["a/spir/ation", "向；加强/呼吸；渴望/名词"],
  attribution: ["at/tribut/ion", "向；加强/给予；归因/名词"],
  availability: ["avail/abil/ity", "可用；有价值/能够；可/名词"],
  breathing: ["breath/ing", "呼吸/名词；形容词"],
  capability: ["cap/abil/ity", "拿取；容纳/能够；可/名词"],
  category: ["categor/y", "类别；分类/名词"],
  ceremonial: ["ceremoni/al", "仪式/形容词"],
  ceremonialism: ["ceremoni/al/ism", "仪式/形容词/主义"],
  ceremonialist: ["ceremoni/al/ist", "仪式/形容词/人"],
  ceremonially: ["ceremoni/al/ly", "仪式/形容词/副词"],
  ceremonious: ["ceremoni/ous", "仪式/形容词"],
  chaotic: ["cha/os/ic", "裂开；混乱/状态/形容词"],
  citable: ["cit/able", "引用；召唤/能够；可"],
  citation: ["cit/ation", "引用；召唤/名词"],
  citizen: ["citiz/en", "公民；城市成员/人"],
  citizenship: ["citiz/en/ship", "公民；城市成员/人/身份"],
  closure: ["clos/ure", "关闭/名词"],
  commutable: ["com/mut/able", "共同；加强/改变；交换/能够；可"],
  commutation: ["com/mut/ation", "共同；加强/改变；交换/名词"],
  commuter: ["com/mut/er", "共同；加强/改变；交换/人"],
  contribution: ["con/tribut/ion", "共同；加强/给予；贡献/名词"],
  contributor: ["con/tribut/or", "共同；加强/给予；贡献/人"],
  contamination: ["con/tamin/ation", "共同；加强/接触；污染/名词"],
  derivation: ["de/riv/ation", "向下；离开/流；引出/名词"],
  derive: ["de/riv/e", "向下；离开/流；引出/词尾"],
  dignified: ["dign/ifi/ed", "尊严；价值/使成为/形容词"],
  divergence: ["di/verg/ence", "分开；离开/转向/名词"],
  evolutionarily: ["e/volut/ion/ari/ly", "向外/卷；转/名词/形容词/副词"],
  exclamation: ["ex/claim/ation", "向外/呼喊；宣称/名词"],
  expectation: ["ex/pect/ation", "向外/看；期待/名词"],
  explanation: ["ex/plan/ation", "向外/清楚；解释/名词"],
  hereditary: ["heredit/ary", "继承；遗传/形容词"],
  historically: ["histor/ic/al/ly", "历史/形容词/形容词/副词"],
  homosexuality: ["homo/sex/ual/ity", "相同/性/形容词/名词"],
  indignation: ["in/dign/ation", "不；无/尊严；价值/名词"],
  inherit: ["in/herit", "进入；取得/继承；遗产"],
  inherited: ["in/herit/ed", "进入；取得/继承；遗产/形容词"],
  inheritable: ["in/herit/able", "进入；取得/继承；遗产/能够；可"],
  inheritance: ["in/herit/ance", "进入；取得/继承；遗产/名词"],
  heritage: ["herit/age", "继承；遗产/名词"],
  inhere: ["in/her/e", "在内；内在/粘附；附着/动词"],
  inherence: ["in/her/ence", "在内；内在/粘附；附着/名词"],
  inherent: ["in/her/ent", "在内；内在/粘附；附着/形容词"],
  inherently: ["in/her/ent/ly", "在内；内在/粘附；附着/形容词/副词"],
  legitimacy: ["legit/im/acy", "合法/形容词/名词"],
  luminosity: ["lumin/os/ity", "光/状态/名词"],
  manuscript: ["manu/script", "手/写"],
  metabolism: ["meta/bol/ism", "改变；超越/抛；变化/过程；主义"],
  methodology: ["method/o/log/y", "方法/连接/学；研究/名词"],
  narcissism: ["narciss/ism", "自恋/主义；状态"],
  noticeably: ["notice/able/ly", "注意/能够；可/副词"],
  obediently: ["ob/edi/ent/ly", "朝向；加强/听从/形容词/副词"],
  observance: ["ob/serv/ance", "朝向；加强/保持；遵守/名词"],
  observatory: ["ob/serv/atory", "朝向；加强/观察/场所"],
  paleolithic: ["paleo/lith/ic", "古/石/形容词"],
  participant: ["particip/ant", "参与/人；形容词"],
  patriarchy: ["patri/archy", "父亲；父系/统治；制度"],
  perceptual: ["per/cept/ual", "完全；通过/拿取；感知/形容词"],
  permanence: ["per/man/ence", "完全；贯穿/停留；保持/名词"],
  perpetually: ["per/petu/al/ly", "贯穿；持续/追求；连续/形容词/副词"],
  phenomenon: ["phenomen/on", "显现；现象/名词"],
  philosopher: ["philo/soph/er", "爱/智慧/人"],
  phonograph: ["phono/graph", "声音/记录；写"],
  physically: ["phys/ic/al/ly", "自然；身体/形容词/形容词/副词"],
  plagiarist: ["plagiar/ist", "剽窃/人"],
  pollination: ["pollin/ation", "花粉；授粉/名词"],
  pollinator: ["pollin/ator", "花粉；授粉/者"],
  presidency: ["presid/ency", "坐在前；主持/名词"],
  proletarian: ["prolet/arian", "无产者/人；形容词"],
  proliferate: ["pro/lifer/ate", "向前；大量/带来；产生/动词"],
  prototyping: ["proto/typ/ing", "原始；初始/类型；模型/名词"],
  psychiatric: ["psych/iatr/ic", "心智/治疗/形容词"],
  rationalize: ["ration/al/ize", "理性；计算/形容词/动词"],
  reconceive: ["re/con/ceive", "重新/共同；完全/拿取；构想"],
  regulatory: ["regul/atory", "规则；管理/形容词"],
  reminiscent: ["re/min/isc/ent", "回；再次/记忆；心/相关/形容词"],
  reparation: ["re/par/ation", "重新/准备；修复/名词"],
  resilience: ["re/sil/ience", "回弹；重新/跳跃/名词"],
  ritualistic: ["ritual/ist/ic", "仪式/人；主义/形容词"],
  saturation: ["satur/ation", "充满；饱和/名词"],
  scepticism: ["scept/ic/ism", "怀疑/形容词/主义"],
  scholastic: ["schol/astic", "学校；学术/形容词"],
  scrutinise: ["scrutin/ise", "仔细检查/动词"],
  sensitivity: ["sens/itive/ity", "感觉/形容词/名词"],
  sequential: ["sequ/ent/ial", "跟随；连续/形容词/形容词"],
  sociologist: ["socio/log/ist", "社会/学；研究/人"],
  solidarity: ["solid/ar/ity", "团结；坚固/形容词/名词"],
  sovereignty: ["sover/eign/ty", "至上；主权/统治/名词"],
  sufficient: ["suf/fic/ient", "在下；充分/做；形成/形容词"],
  suffragette: ["suffrag/ette", "投票权/人"],
  sympathiser: ["sym/path/is/er", "共同/感受；痛苦/动词/人"],
  systematic: ["system/atic", "系统/形容词"],
  technically: ["techn/ic/al/ly", "技术/形容词/形容词/副词"],
  terrestrial: ["terr/estr/ial", "土地/相关/形容词"],
  theologian: ["theo/log/ian", "神/学；研究/人"],
  thoroughly: ["thorough/ly", "彻底的/副词"],
  triangular: ["tri/ang/ul/ar", "三/角/名词/形容词"],
  unambiguous: ["un/ambigu/ous", "不；相反/游移；不明确/形容词"],
  unbearable: ["un/bear/able", "不；相反/承受/能够；可"],
  unbearably: ["un/bear/able/ly", "不；相反/承受/能够；可/副词"],
  unbreakable: ["un/break/able", "不；相反/破裂/能够；可"],
  uncertainty: ["un/certain/ty", "不；相反/确定/名词"],
  unconscious: ["un/con/sci/ous", "不；相反/共同；完全/知道/形容词"],
  understood: ["under/stand", "在下；充分/站立；理解"],
  independently: ["in/de/pend/ent/ly", "不；无/向下；离开/悬挂；依靠/形容词/副词"],
  nanotechnology: ["nano/techn/o/log/y", "纳米/技术/连接/学；研究/名词"],
  predominantly: ["pre/domin/ant/ly", "在前；预先/支配；主导/形容词/副词"],
  transcontinental: ["trans/continent/al", "穿过；横跨/大陆/形容词"],
  unfairness: ["un/fair/ness", "不；相反/公平/名词"],
  unwittingly: ["un/wit/ting/ly", "不；相反/知道；意识/形容词/副词"],
  utilitarian: ["util/it/arian", "有用；使用/名词/人；形容词"],
  willingness: ["will/ing/ness", "意愿/形容词/名词"],
  worshipper: ["worship/per", "崇拜；敬拜/人"],
  saxophonist: ["saxo/phon/ist", "萨克斯/声音/人"],
  parliament: ["parlia/ment", "说话；商议/名词"],
  parliamentary: ["parlia/ment/ary", "说话；商议/名词/形容词"],
  vernacular: ["vernacul/ar", "本地；本族/形容词"],
  vernacularity: ["vernacul/ar/ity", "本地；本族/形容词/名词"],
  vocabulary: ["voc/abul/ary", "声音；召唤/相关/集合；名词"],
  chiaroscuro: ["chiaro/scuro", "明亮/黑暗"],
  guillotine: ["guillotin/e", "断头台/词尾"],
  marshmallow: ["marsh/mallow", "沼泽/锦葵；棉花糖"],
  nutcracker: ["nut/crack/er", "坚果/破裂；敲开/物；人"],
  pawnbroker: ["pawn/broker", "典当/经纪人；中间商"],
  plesiosaur: ["plesio/saur", "接近；近似/蜥蜴；爬行动物"],
  polynesian: ["poly/nes/ian", "多/岛/人；形容词"],
  propaganda: ["propag/anda", "传播；宣传/名词"],
  scriptoria: ["script/or/ia", "写/场所；物/复数"],
  smartphone: ["smart/phone", "智能/电话"],
  terracotta: ["terra/cotta", "土地；陶土/烧制"],
  undistinguished: ["un/dis/stingu/ish/ed", "不；相反/分开/刺；标记/动词/形容词"],
  vindictive: ["vindict/ive", "报复；维护/形容词"],
  virtuosity: ["virtu/os/ity", "美德；技艺/状态/名词"],
  whatsoever: ["what/so/ever", "什么/如此/任何"],
  wilderness: ["wild/er/ness", "野生；荒野/相关/名词"],
  chlorofluorocarbon: ["chloro/fluoro/carbon", "氯/氟/碳"],
  consequentialist: ["con/sequ/ent/ial/ist", "共同；加强/跟随；结果/形容词/形容词/人；主义者"],
  deconstructivism: ["de/construct/iv/ism", "拆开；向下/建造；构成/形容词/主义"],
  electroencephalographic: ["electro/encephalo/graph/ic", "电/脑/记录；图/形容词"],
  electroencephalography: ["electro/encephalo/graph/y", "电/脑/记录；图/名词"],
  interdisciplinary: ["inter/disciplin/ary", "在…之间/学习；训练；学科/形容词"],
  disciplinarian: ["disciplin/arian", "学习；训练；纪律/人"],
  neurotransmission: ["neuro/trans/mission", "神经/穿过；转移/发送；传递"],
  overestimate: ["over/estim/ate", "过度；超过/估计/动词"],
  overestimation: ["over/estim/ation", "过度；超过/估计/名词"],
  underestimate: ["under/estim/ate", "不足；低于/估计/动词"],
  underestimation: ["under/estim/ation", "不足；低于/估计/名词"],
  antique: ["antiqu/e", "古老；古董/词尾"],
  antiquated: ["antiqu/at/ed", "古老；古董/动词；使成为/形容词"],
  antiquatedness: ["antiqu/at/ed/ness", "古老；古董/动词；使成为/形容词/名词"],
  custom: ["custom", "习惯；惯例"],
  customarily: ["custom/ary/ly", "习惯；惯例/形容词/副词"],
  integrate: ["integr/ate", "完整/动词；使成为"],
  integration: ["integr/ation", "完整/名词"],
  integrative: ["integr/ative", "完整/形容词"],
  intentional: ["in/tent/ion/al", "向内；朝向/伸展；趋向/名词/形容词"],
  intentionally: ["in/tent/ion/al/ly", "向内；朝向/伸展；趋向/名词/形容词/副词"],
  intellect: ["intel/lect", "理解；智力/选择；收集"],
  intellectual: ["intel/lect/ual", "理解；智力/选择；收集/形容词"],
  intellectualism: ["intel/lect/ual/ism", "理解；智力/选择；收集/形容词/主义；学说"],
  intellectually: ["intel/lect/ual/ly", "理解；智力/选择；收集/形容词/副词"],
  intelligence: ["intel/lig/ence", "理解；智力/选择；收集/名词"],
  intelligent: ["intel/lig/ent", "理解；智力/选择；收集/形容词"],
  intelligently: ["intel/lig/ent/ly", "理解；智力/选择；收集/形容词/副词"],
  permeate: ["per/me/ate", "通过/流动；经过/动词"],
  permeation: ["per/me/ation", "通过/流动；经过/名词"],
  permeable: ["per/me/able", "通过/流动；经过/能够；可"],
  impermeable: ["im/per/me/able", "不；相反/通过/流动；经过/能够；可"],
  permeability: ["per/me/abil/ity", "通过/流动；经过/能够；可/名词"],
  semipermeable: ["semi/per/me/able", "半/通过/流动；经过/能够；可"],
  recover: ["re/cover", "再次；回/覆盖；恢复"],
  recovery: ["re/cover/y", "再次；回/覆盖；恢复/名词"],
  uncover: ["un/cover", "不；相反/覆盖；揭开"],
  solicit: ["solicit", "请求；招揽"],
  solicitation: ["solicit/ation", "请求；招揽/名词"],
  unsolicited: ["un/solicit/ed", "不；未/请求；招揽/形容词"],
  discipline: ["disciplin/e", "学习；训练；纪律/词尾"],
  disciplined: ["disciplin/ed", "学习；训练；纪律/形容词"],
  disciplinary: ["disciplin/ary", "学习；训练；纪律/形容词"],
  disciple: ["discip/le", "学习；训练/人"],
  micro: ["micro", "小；微"],
  fibre: ["fibr/e", "纤维/词尾"],
  fiber: ["fibr/er", "纤维/名词"],
  microfibre: ["micro/fibre", "小；微/纤维"],
  microfiber: ["micro/fiber", "小；微/纤维"],
  bamboofiber: ["bamboo/fiber", "竹/纤维"],
  nylonfiber: ["nylon/fiber", "尼龙/纤维"],
  water: ["wat/er", "水/名词"],
  waterproof: ["water/proof", "水/防护；证明"],
  windowless: ["window/less", "窗户/无；缺少"],
  backstory: ["back/story", "后面；背景/故事"],
  background: ["back/ground", "后面；背景/地面；基础"],
  walkway: ["walk/way", "行走/道路"],
  billfold: ["bill/fold", "纸币；账单/折叠"],
  teahouse: ["tea/house", "茶/房屋"],
  posture: ["pos/ture", "放/名词"],
  circle: ["circ/le", "圆；环/词尾"],
  encircle: ["en/circ/le", "使进入；使成为/圆；环/词尾"],
  suspicious: ["sus/spic/ious", "在下；随后/看/形容词"],
  oracle: ["ora/cle", "说；祈祷/名词"],
  hesitate: ["hes/itate", "粘着；停住/动词"],
  tortuous: ["tort/uous", "扭曲/形容词"],
  enact: ["en/act", "使成为/行动，做"],
  patriarch: ["patri/arch", "父亲/统治；首领"],
  apology: ["apo/log/y", "离开/说话；学科/名词"],
  regular: ["reg/ul/ar", "统治；规则/词尾/形容词"],
  regime: ["reg/ime", "统治；规则/名词"],
  reign: ["reg/n", "统治；规则/词尾"],
  suicide: ["sui/cid/e", "自己/切；杀/词尾"],
  strain: ["strain", "拉紧；压紧"],
  vitamin: ["vit/amin", "生命/名词"],
  versatile: ["vers/atile", "转/形容词"],
  cult: ["cult", "耕种；培养"],
  dictum: ["dict/um", "说话；断言/名词"],
  doubt: ["doub/t", "二；双/词尾"],
  platitude: ["plat/itude", "平坦/名词"],
  postcard: ["post/card", "之后；邮件/卡片"],
  dent: ["dent", "牙齿"],
  unanimous: ["un/anim/ous", "单一；一个/生命；精神/形容词"],
  void: ["void", "空"],
  alter: ["alter", "其他的；改变状态"],
  century: ["cent/ury", "一百/名词"],
  omission: ["o/miss/ion", "出；离开/送；放出/名词"],
  punish: ["pun/ish", "处罚/动词"],
  act: ["act", "行动；做"],
  radio: ["radi/o", "光线/名词"],
  temper: ["temper", "调和；时间引起的状态"],
  art: ["art", "技巧；艺术"],
  closet: ["clos/et", "关闭/名词"],
  crusade: ["crus/ade", "十字形；交叉/名词"],
  acquisitive: ["ac/quis/itive", "向；加强/寻求；询问/形容词"],
  query: ["quer/y", "寻求；询问/名词"],
  sting: ["sting", "刺；刺激"],
  extinct: ["ex/stinct", "出；向外/刺；刺激"],
  annuity: ["ann/u/ity", "年/词尾/名词"],
  centripetal: ["centr/i/petal", "中心/词尾/寻求；趋向"],
  firm: ["firm", "坚定的"],
  genuflect: ["genu/flect", "膝/弯曲"],
  habit: ["habit", "居住；习惯"],
  pedestrian: ["ped/estrian", "脚/人；形容词"],
  primitive: ["prim/itive", "主要的；第一/形容词"],
  species: ["speci/es", "外观；种类/名词"],
  specimen: ["speci/men", "外观；种类/名词"],
  sumptuous: ["sumpt/u/ous", "拿；取/词尾/形容词"],
  voluble: ["vol/uble", "卷；转/形容词"],
  volume: ["vol/ume", "卷；转/名词"],
  evolution: ["e/vol/ution", "出；向外/卷；转/名词"],
  agronomy: ["agro/nom/y", "农业/规则；管理/名词"],
  asterisk: ["aster/isk", "星星/小物；名词"],
  carbohydrate: ["carbo/hydr/ate", "碳/水/名词"],
  mark: ["mark", "记号；符号"],
  medium: ["med/ium", "中间/名词"],
  migratory: ["migr/atory", "迁移/形容词"],
  optics: ["opt/ic/s", "视力/形容词；名词/复数"],
  ordain: ["ordin/ain", "命令；顺序/动词"],
  patriot: ["patr/i/ot", "父亲；祖国/词尾/人"],
  stringency: ["string/ency", "拉紧/名词"],
  sum: ["sum", "总；加"],
  testimony: ["test/imony", "测试；证据/名词"],
  theocracy: ["theo/cracy", "神/统治或政体"],
  upheaval: ["up/heav/al", "向上/举起/名词"],
  upgrade: ["up/grade", "向上/步；级"],
  acid: ["acid", "尖；酸；锐利"],
  aptitude: ["apt/itude", "适应；能力/名词"],
  adept: ["ad/ept", "向；加强/适应；能力"],
  aquarium: ["aqu/arium", "水/名词"],
  cardiac: ["card/i/ac", "心脏/词尾/形容词"],
  carnivorous: ["carn/i/vor/ous", "肉/词尾/吃/形容词"],
  carcass: ["carn/ass", "肉/名词"],
  corpse: ["corp/se", "身体/名词"],
  crypt: ["crypt", "秘密；隐藏"],
  democrat: ["demo/crat", "人民/统治者"],
  demotic: ["demo/tic", "人民/形容词"],
  demography: ["demo/graph/y", "人民/书写；记录/名词"],
  fault: ["fault", "错误"],
  ideal: ["idea/al", "思想；观点/形容词"],
  loquacious: ["loqu/acious", "说话/形容词"],
  soliloquy: ["soli/loqu/y", "单独/说话/名词"],
  demobilize: ["de/mob/il/ize", "除去/动/词尾/动词"],
  mount: ["mount", "登上"],
  mountain: ["mount/ain", "登上/名词"],
  paramount: ["para/mount", "旁边；超过/登上"],
  norm: ["norm", "规则；规范"],
  phonology: ["phon/logy", "声音/学科"],
  euphony: ["eu/phon/y", "好/声音/名词"],
  symphony: ["sym/phon/y", "共同；一起/声音/名词"],
  picturesque: ["pict/uresque", "描画/像…的"],
  pictograph: ["pict/graph", "描画/书写；记录"],
  punctual: ["punct/u/al", "点/词尾/形容词"],
  utensil: ["ut/ensil", "用/工具"],
  verb: ["verb", "词语"],
  magnanimous: ["magn/anim/ous", "大/生命；精神/形容词"],
  capital: ["cap/ital", "头/名词；形容词"],
  chronology: ["chron/logy", "时间/学科"],
  fund: ["fund", "基础；底部"],
  foundation: ["found/ation", "基础；建立/名词"],
  fundamental: ["fund/ament/al", "基础；底部/名词/形容词"],
  graduate: ["grad/u/ate", "步；级/词尾/动词"],
  linguistics: ["lingu/ist/ics", "语言/人；从业者/学科"],
  memory: ["memor/y", "记忆/名词"],
  apt: ["apt", "适应；能力"],
  apathy: ["a/path/y", "无；不/感情；痛苦/名词"],
  pathos: ["path/os", "感情；痛苦/名词"],
  compulsory: ["com/puls/ory", "共同；加强/驱动；推/形容词"],
  philanthropy: ["phil/anthrop/y", "爱/人类/名词"],
  philology: ["phil/logy", "爱/学科"],
  duplex: ["du/plex", "二；双/重叠"],
  policy: ["polic/y", "国家；城市/名词"],
  politics: ["polit/ics", "国家；城市/学科"],
  property: ["propri/ety", "拥有/名词"],
  propriety: ["propri/ety", "拥有/名词"],
  text: ["text", "编织；文本"],
  tornado: ["torn/ado", "转；环绕/名词"],
  attorney: ["at/torn/ey", "向；加强/转；环绕/人"],
  turbine: ["turb/ine", "搅动/名词"],
  ascertain: ["as/cert/ain", "向；加强/确定；分辨/动词"],
  matrix: ["matr/ix", "母亲；来源/名词"],
  morphology: ["morph/logy", "形状/学科"],
  terrace: ["terr/ace", "土地/名词"],
  terrain: ["terr/ain", "土地/名词"],
  territory: ["terr/itory", "土地/名词"],
  thermometer: ["therm/o/meter", "热/词尾/测量器"],
  bureaucracy: ["bureau/cracy", "办公室；局/统治或政体"],
  criteria: ["crit/eria", "判断；评价/复数名词"],
  critique: ["crit/ique", "判断；评价/名词；动词"],
  maritime: ["marit/ime", "海洋/形容词"],
  motif: ["mot/if", "动/名词"],
  phobia: ["phob/ia", "厌恶；害怕/名词"],
  contaminant: ["con/tamin/ant", "共同；加强/接触；污染/名词"],
  decontaminate: ["de/con/tamin/ate", "除去/共同；加强/接触；污染/动词"],
  tangency: ["tang/ency", "接触/名词"],
  reintegrate: ["re/integr/ate", "再次；重新/完整/动词"],
  integer: ["integr/er", "完整/名词"],
  cosmology: ["cosm/logy", "世界；宇宙/学科"],
  proficient: ["pro/fic/ient", "向前；支持/做；产生效果/形容词"],
  wade: ["wad/e", "走/词尾"],
  wader: ["wad/er", "走/人；物"],
  vine: ["vine", "编织；藤"],
  vineyard: ["vine/yard", "藤/场地"],
  twine: ["twine", "编织"],
  umbrella: ["umbr/ella", "影子/名词"],
  umbra: ["umbr/a", "影子/名词"],
  vague: ["vag/ue", "漫游/形容词"],
  shareholder: ["share/hold/er", "份额/持有/人"],
  stakeholder: ["stake/hold/er", "利益；赌注/持有/人"],
  threshold: ["thres/hold", "踩踏；打谷/持有"],
  tail: ["tail", "剪裁；尾部"],
  super: ["super", "超；上"],
  superior: ["super/ior", "超；上/形容词"],
  supersede: ["super/sede", "超；上/坐；替代"],
  supreme: ["supreme", "最高的"],
  sovereign: ["sover/eign", "在上；统治/名词；形容词"],
  veil: ["veil", "盖上"],
  reveal: ["re/veal", "反向；再次/盖上"],
  revelation: ["re/vel/ation", "反向；再次/盖上/名词"],
  use: ["use", "用"],
  musician: ["music/ian", "音乐/人"],
  ensure: ["en/sure", "使成为/确定"],
  entry: ["entr/y", "进入/名词"],
  entrance: ["entr/ance", "进入/名词"],
  enthusiasm: ["en/the/usiasm", "在内；进入/神/名词"],
  enthusiastic: ["en/the/usi/astic", "在内；进入/神/词尾/形容词"],
  environment: ["en/viron/ment", "使进入/环绕/名词"],
  way: ["way", "道路；方式"],
  overlap: ["over/lap", "在上；超过/重叠"],
  overlook: ["over/look", "在上；超过/看"],
  overseas: ["over/sea/s", "在上；超过/海/复数"],
  oversleep: ["over/sleep", "过度；超过/睡眠"],
  through: ["through", "穿过"],
  plus: ["plus", "加"],
  minus: ["minus", "减"],
  downtown: ["down/town", "向下/城镇"],
  breakdown: ["break/down", "打破/向下"],
  paradox: ["para/dox", "旁边；超出/观点"],
  paradigm: ["para/digm", "旁边；超出/模型"],
  parallel: ["para/allel", "旁边；并列/平行"],
  parachute: ["para/chute", "旁边；保护/降落伞"],
  somewhat: ["some/what", "一些/什么"],
  tiresome: ["tire/some", "疲劳/形容词"],
  grace: ["grace", "优雅；恩惠"],
  vary: ["vari/y", "变化/动词"],
  variety: ["vari/ety", "变化/名词"],
  society: ["soci/ety", "同伴；社会/名词"],
  tempo: ["tempo", "时间；节奏"],
  sail: ["sail", "航行"],
  govern: ["govern", "统治"],
  vapour: ["vap/our", "蒸汽/名词"],
  odor: ["odor", "气味"],
  own: ["own", "拥有"],
  paint: ["paint", "绘画；涂色"],
  peer: ["peer", "同伴；凝视"],
  ministry: ["ministr/y", "服务；管理/名词"],
  sauce: ["sauce", "酱汁"],
  steam: ["steam", "蒸汽"],
  sweat: ["sweat", "汗"],
  tank: ["tank", "水箱；坦克"],
  physics: ["phys/ics", "自然；身体/学科"],
  type: ["type", "类型"],
  historian: ["histor/ian", "历史/人"],
  politician: ["polit/ician", "国家；城市/人"],
  technician: ["techn/ician", "技术/人"],
  technique: ["techn/ique", "技术/名词"],
  technology: ["techn/logy", "技术/学科"],
  prince: ["prince", "王子；首领"],
  fix: ["fix", "固定；修理"],
  moist: ["moist", "潮湿"],
  lure: ["lure", "诱惑"],
  sure: ["sure", "确定"],
  side: ["side", "边"],
  sort: ["sort", "种类；分类"],
  kid: ["kid", "孩子"],
  board: ["board", "木板；委员会"],
  thereby: ["there/by", "那里；因此/通过"],
  add: ["add", "增加"],
  place: ["place", "地方；放置"],
  air: ["air", "空气"],
  point: ["point", "点"],
  short: ["short", "短"],
  besides: ["be/side/s", "在旁/边/复数"],
  behind: ["be/hind", "在后/后方"],
  across: ["a/cross", "穿过/交叉"],
  along: ["a/long", "沿着/长"],
  offset: ["off/set", "离开/放置"],
  office: ["offic/e", "服务；职务/词尾"],
  electron: ["electr/on", "电/名词"],
  abroad: ["a/broad", "离开/宽阔"],
  address: ["ad/dress", "向；加强/整理；说话"],
  accessory: ["access/ory", "接近；进入/名词"],
  avenue: ["aven/ue", "来；道路/名词"],
  diminish: ["di/min/ish", "向下；削弱/小/动词"],
  diminishable: ["di/min/ish/able", "向下；削弱/小/动词/能够；可"],
  diminution: ["di/min/ution", "向下；削弱/小/名词"],
  minuscule: ["min/uscule", "小/形容词"],
  minute: ["min/ute", "小/形容词"],
  minimum: ["min/imum", "小/最小"],
  minimal: ["min/im/al", "小/词尾/形容词"],
  miner: ["min/er", "矿；挖/人"],
  minus: ["minus", "减"],
  cartography: ["carto/graph/y", "地图/写；图/名词"],
  geography: ["geo/graph/y", "地球；土地/写；图/名词"],
  ethnography: ["ethno/graph/y", "民族/写；图/名词"],
  oceanography: ["ocean/o/graph/y", "海洋/词尾/写；图/名词"],
  maintain: ["main/tain", "手；主要/持有"],
  manoeuvre: ["man/u/oeuvre", "手；操作/词尾/工作"],
  explicit: ["ex/plic/it", "出；向外/折叠；弯/形容词"],
  diverge: ["di/verg/e", "分开；离开/转/词尾"],
  possess: ["pos/sess", "放/坐；占有"],
  prison: ["pris/on", "抓住/名词"],
  purchase: ["pur/chase", "追求/追逐"],
  pursue: ["pur/sue", "追求/跟随"],
  secrete: ["se/cret/e", "分开/筛出；分辨/词尾"],
  select: ["se/lect", "分开/选择；收集"],
  sincere: ["sin/cere", "无；一/筛出；确定"],
  starve: ["starv/e", "饥饿/词尾"],
  stratosphere: ["strato/sphere", "层/球体"],
  withstand: ["with/stand", "反对；抵住/站立"],
  upright: ["up/right", "向上/直立；正确"],
  viscose: ["visc/ose", "黏；看/形容词"],
  summon: ["sum/mon", "拿；取/提醒；召唤"],
  hierarch: ["hier/arch", "神圣/统治者"],
  encamp: ["en/camp", "使进入/营地"],
  emancipate: ["e/man/cip/ate", "出；向外/手/拿/动词"],
  empire: ["em/pire", "取得；拥有/统治"],
  sonnet: ["son/net", "声音/小诗"],
  theatre: ["the/atre", "看；神/场所"],
  trace: ["tract/e", "拉；拖/词尾"],
  track: ["tract", "拉；拖"],
  treat: ["treat", "处理；拉"],
  sculpt: ["sculp/t", "雕刻/词尾"],
  authenticate: ["auth/entic/ate", "权威；真实/形容词/动词"],
  calligraphy: ["calli/graph/y", "美/书写；图/名词"],
  calorimetry: ["calori/metr/y", "热量/测量/名词"],
  carbon: ["carb/on", "碳/名词"],
  centrifuge: ["centr/i/fuge", "中心/词尾/逃离"],
  choreograph: ["choreo/graph", "舞蹈/书写；记录"],
  claustrophobia: ["claustro/phobia", "封闭空间/恐惧"],
  camouflage: ["camoufl/age", "伪装/名词"],
  canonize: ["canon/ize", "规则；经典/动词"],
  charge: ["charg/e", "负载；收费/词尾"],
  charter: ["chart/er", "图表；文件/名词"],
  check: ["check", "检查；制衡"],
  chlorine: ["chlor/ine", "绿；氯/名词"],
  chocolaty: ["chocolat/y", "巧克力/形容词"],
  chord: ["chord", "弦；和弦"],
  city: ["city", "城市"],
  class: ["class", "班级；类别"],
  clone: ["clon/e", "复制/词尾"],
  cloth: ["cloth", "布"],
  coal: ["coal", "煤"],
  code: ["code", "编码；密码"],
  coil: ["coil", "卷"],
  collide: ["col/lid/e", "共同；加强/撞击/词尾"],
  column: ["column", "柱；栏"],
  cooperate: ["co/oper/ate", "共同/工作/动词"],
  core: ["core", "核心"],
  corrode: ["cor/rod/e", "共同；加强/咬；侵蚀/词尾"],
  council: ["council", "会议；委员会"],
  counsel: ["counsel", "建议；律师"],
  courage: ["cour/age", "心；勇气/名词"],
  criminalize: ["crimin/al/ize", "罪/形容词/动词"],
  crystallize: ["crystal/ize", "晶体/动词"],
  culmination: ["culmin/ation", "顶点/名词"],
  cumulative: ["cumul/ative", "堆积/形容词"],
  curtail: ["cur/tail", "短/剪裁；尾部"],
  custom: ["custom", "习惯；惯例"],
  defense: ["de/fense", "离开；抵挡/防护"],
  deploy: ["de/ploy", "展开；布置/折叠"],
  detach: ["de/tach", "分开/接触；连接"],
  deviant: ["de/vi/ant", "离开/道路；行进/形容词"],
  digit: ["digit", "数字；手指"],
  dilemma: ["di/lemma", "二；双/命题"],
  haphazard: ["hap/hazard", "偶然/危险"],
  happy: ["happy", "快乐"],
  happiness: ["happy/ness", "快乐/名词"],
  harass: ["harass", "骚扰"],
  harassment: ["harass/ment", "骚扰/名词"],
  harmful: ["harm/ful", "伤害/充满"],
  harmless: ["harm/less", "伤害/无；缺少"],
  hazard: ["hazard", "危险"],
  hazardous: ["hazard/ous", "危险/形容词"],
  handcraft: ["hand/craft", "手/工艺"],
  handgun: ["hand/gun", "手/枪"],
  handheld: ["hand/held", "手/持有"],
  handle: ["hand/le", "手/词尾"],
  handwrite: ["hand/write", "手/写"],
  haemoglobin: ["haem/o/glob/in", "血/词尾/球/名词"],
  hailstone: ["hail/stone", "冰雹/石头"],
  hailstorm: ["hail/storm", "冰雹/风暴"],
  fulfill: ["ful/fill", "完全/填满"],
  fulfillment: ["ful/fill/ment", "完全/填满/名词"],
  freshwater: ["fresh/water", "新鲜/水"],
  freight: ["freight", "货运"],
  freighter: ["freight/er", "货运/人；物"],
  front: ["front", "前面"],
  frontal: ["front/al", "前面/形容词"],
  frontier: ["front/ier", "前面/边界"],
  fraudulence: ["fraud/ulence", "欺诈/名词"],
  fraudulent: ["fraud/ulent", "欺诈/形容词"],
  framework: ["frame/work", "框架/工作"],
  founder: ["found/er", "创立；发现/人；物"],
  foundry: ["found/ry", "铸造/场所"],
  formal: ["form/al", "形式/形容词"],
  formalise: ["form/al/ise", "形式/形容词/动词"],
  formation: ["form/ation", "形式/名词"],
  formative: ["form/ative", "形式/形容词"],
  informal: ["in/form/al", "不；无/形式/形容词"],
  follower: ["follow/er", "跟随/人"],
  focusable: ["focus/able", "焦点/能够；可"],
  flawless: ["flaw/less", "缺陷/无；缺少"],
  fleetness: ["fleet/ness", "快速；舰队/名词"],
  filler: ["fill/er", "填满/人；物"],
  fibrous: ["fibr/ous", "纤维/形容词"],
  fibrosis: ["fibr/osis", "纤维/病症"],
  fencer: ["fence/er", "围栏；剑术/人"],
  favourable: ["favour/able", "支持；赞同/能够；可"],
  farmer: ["farm/er", "农场/人"],
  faithful: ["faith/ful", "信任；信心/充满"],
  faithfully: ["faith/ful/ly", "信任；信心/充满/副词"],
  fadeless: ["fade/less", "褪色/无；缺少"],
  duct: ["duct", "引导；管道"],
  ductile: ["duct/ile", "引导；延展/形容词"],
  ductility: ["duct/ility", "引导；延展/名词"],
  overdue: ["over/due", "超过/到期"],
  subdue: ["sub/due", "在下；压下/应得；到期"],
  undue: ["un/due", "不；相反/到期；适当"],
  dutiful: ["duty/ful", "责任/充满"],
  dweller: ["dwell/er", "居住/人"],
  dwelltime: ["dwell/time", "停留/时间"],
  dynamometer: ["dynamo/meter", "动力/测量器"],
  earner: ["earn/er", "赚得/人"],
  earthquake: ["earth/quake", "地球；土地/震动"],
  echolocation: ["echo/location", "回声/定位"],
  echocardiogram: ["echo/cardio/gram", "回声/心脏/记录"],
  eclecticism: ["eclectic/ism", "折中/主义"],
  editable: ["edit/able", "编辑/能够；可"],
  editor: ["edit/or", "编辑/人"],
  editorial: ["edit/or/ial", "编辑/人/形容词"],
  egalitarian: ["egal/itarian", "平等/人；形容词"],
  egalitarianism: ["egal/itarian/ism", "平等/人；形容词/主义"],
  egocentric: ["ego/centr/ic", "自我/中心/形容词"],
  egoism: ["ego/ism", "自我/主义"],
  egoist: ["ego/ist", "自我/人"],
  electrocute: ["electr/o/cute", "电/词尾/杀"],
  electrocution: ["electr/o/cution", "电/词尾/名词"],
  electrode: ["electr/ode", "电/路径；极"],
  electrolysis: ["electr/o/lysis", "电/词尾/分解"],
  elitism: ["elite/ism", "精英/主义"],
  elitist: ["elite/ist", "精英/人"],
  elusive: ["e/lus/ive", "出；向外/玩；逃避/形容词"],
  elusiveness: ["e/lus/ive/ness", "出；向外/玩；逃避/形容词/名词"],
  embalm: ["em/balm", "使进入/香膏；保存"],
  embarrassment: ["embarrass/ment", "尴尬/名词"],
  emendation: ["emend/ation", "校订/名词"],
  endeavourer: ["endeavour/er", "努力/人"],
  engrossment: ["engross/ment", "全神贯注/名词"],
  ensure: ["en/sure", "使成为/确定"],
  ensurement: ["en/sure/ment", "使成为/确定/名词"],
  enthusiast: ["en/the/usi/ast", "在内；进入/神/词尾/人"],
  entirely: ["entire/ly", "整个/副词"],
  entireness: ["entire/ness", "整个/名词"],
  epical: ["epic/al", "史诗/形容词"],
  epochal: ["epoch/al", "时代/形容词"],
  essayist: ["essay/ist", "散文；尝试/人"],
  euphoriant: ["euphoria/nt", "欣快/名词；形容词"],
  excrete: ["ex/cret/e", "出；向外/筛出；分泌/词尾"],
  exhaustion: ["exhaust/ion", "耗尽/名词"],
  exhaustive: ["exhaust/ive", "耗尽/形容词"],
  inexhaustible: ["in/exhaust/ible", "不；无/耗尽/能够；可"],
  exoplanet: ["exo/planet", "外部/行星"],
  exoplanetary: ["exo/planet/ary", "外部/行星/形容词"],
  expansion: ["ex/pans/ion", "出；向外/展开/名词"],
  expansive: ["ex/pans/ive", "出；向外/展开/形容词"],
  explosion: ["ex/plos/ion", "出；向外/爆破/名词"],
  explosive: ["ex/plos/ive", "出；向外/爆破/形容词"],
  fibril: ["fibr/il", "纤维/小物"],
  fill: ["fill", "填满"],
  fireproof: ["fire/proof", "火/防护；证明"],
  firewall: ["fire/wall", "火/墙"],
  firm: ["firm", "坚定"],
  infirm: ["in/firm", "不；无/坚定"],
  infirmity: ["in/firm/ity", "不；无/坚定/名词"],
  flaw: ["flaw", "缺陷"],
  fleetness: ["fleet/ness", "快速；舰队/名词"],
  focus: ["focus", "焦点"],
  follow: ["follow", "跟随"],
  footbridge: ["foot/bridge", "脚/桥"],
  footnote: ["foot/note", "脚；底部/注释"],
  footprint: ["foot/print", "脚/印记"],
  frameable: ["frame/able", "框架/能够；可"],
  fraudster: ["fraud/ster", "欺诈/人"],
  freedom: ["free/dom", "自由/状态"],
  freelance: ["free/lance", "自由/长矛；职业"],
  freelancer: ["free/lance/er", "自由/长矛；职业/人"],
  freestone: ["free/stone", "自由；易分离/石头"],
  freeware: ["free/ware", "免费/物品"],
  freshly: ["fresh/ly", "新鲜/副词"],
  front: ["front", "前面"],
  fungal: ["fung/al", "真菌/形容词"],
  fungicide: ["fung/i/cide", "真菌/词尾/杀"],
  furious: ["fur/ious", "狂怒/形容词"],
  furnace: ["furn/ace", "炉/名词"],
  governable: ["govern/able", "治理/能够；可"],
  governance: ["govern/ance", "治理/名词"],
  government: ["govern/ment", "治理/名词"],
  governmental: ["govern/ment/al", "治理/名词/形容词"],
  governor: ["govern/or", "治理/人"],
  graph: ["graph", "写；图"],
  graphic: ["graph/ic", "写；图/形容词"],
  graphite: ["graph/ite", "写；图/名词"],
  graspable: ["grasp/able", "抓住/能够；可"],
  grassland: ["grass/land", "草/土地"],
  grassroots: ["grass/roots", "草/根"],
  groundless: ["ground/less", "地面；根据/无；缺少"],
  grouping: ["group/ing", "群；簇/名词"],
  guardian: ["guard/ian", "守卫/人"],
  guildship: ["guild/ship", "行会/身份；关系"],
  gunpowder: ["gun/powder", "枪/粉末"],
  habit: ["habit", "居住；习惯"],
  habitable: ["habit/able", "居住/能够；可"],
  habitat: ["habit/at", "居住/地点"],
  habitation: ["habit/ation", "居住/名词"],
  harmfulness: ["harm/ful/ness", "伤害/充满/名词"],
  harpooner: ["harpoon/er", "鱼叉/人"],
  hauler: ["haul/er", "拖运/人"],
  heart: ["heart", "心"],
  heartfelt: ["heart/felt", "心/感到"],
  herbaceous: ["herb/aceous", "草本/形容词"],
  herbalist: ["herb/al/ist", "草本/形容词/人"],
  herbicide: ["herb/i/cide", "草本/词尾/杀"],
  herbivore: ["herb/i/vore", "草本/词尾/吃"],
  herbivorous: ["herb/i/vor/ous", "草本/词尾/吃/形容词"],
  helio: ["helio", "太阳"],
  hideaway: ["hide/away", "隐藏/离开"],
  hideous: ["hide/ous", "隐藏；可怕/形容词"],
  hieroglyph: ["hiero/glyph", "神圣/刻写；符号"],
  hillock: ["hill/ock", "小山/小物"],
  homeostasis: ["homeo/stasis", "相同；稳定/站立；状态"],
  homeostatic: ["homeo/stat/ic", "相同；稳定/站立；状态/形容词"],
  hormonelike: ["hormone/like", "激素/像…的"],
  humane: ["human/e", "人/形容词"],
  hurricane: ["hurric/ane", "风暴/名词"],
  ichthyology: ["ichthy/logy", "鱼/学科"],
  idleness: ["idle/ness", "懒散/名词"],
  ignore: ["ig/nore", "不；无/知道"],
  jargonaut: ["jargon/naut", "行话/航行者"],
  jargonize: ["jargon/ize", "行话/动词"],
  kaleidoscope: ["kaleido/scope", "美丽形状/看；镜"],
  kangaroo: ["kangaroo", "袋鼠"],
  knowledge: ["know/ledge", "知道/名词"],
  labourer: ["labour/er", "劳动/人"],
  landless: ["land/less", "土地/无；缺少"],
  landmark: ["land/mark", "土地/标志"],
  landscape: ["land/scape", "土地/景观"],
  launch: ["launch", "发射；开始"],
  leaflet: ["leaf/let", "叶；页/小物"],
  leeward: ["lee/ward", "背风/方向"],
  license: ["lic/ense", "允许/名词"],
  lichenin: ["lichen/in", "地衣/物质"],
  limbless: ["limb/less", "肢体/无；缺少"],
  limestone: ["lime/stone", "石灰/石头"],
  limitation: ["limit/ation", "限制/名词"],
  linear: ["line/ar", "线/形容词"],
  linguistic: ["lingu/ist/ic", "语言/人/形容词"],
  loather: ["loathe/er", "厌恶/人"],
  locomote: ["loco/mote", "地方/动"],
  locomotion: ["loco/mot/ion", "地方/动/名词"],
  locomotive: ["loco/mot/ive", "地方/动/形容词"],
  lustre: ["lustr/e", "光亮/词尾"],
  mammalian: ["mamm/al/ian", "乳房；哺乳/形容词/形容词"],
  mammalogy: ["mamm/logy", "哺乳动物/学科"],
  map: ["map", "地图"],
  marine: ["mar/in/e", "海/形容词/词尾"],
  marinescience: ["marine/science", "海洋/科学"],
  marker: ["mark/er", "标志/人；物"],
  marketable: ["market/able", "市场/能够；可"],
  marketplace: ["market/place", "市场/地方"],
  masonry: ["mason/ry", "泥瓦匠/行业"],
  massacre: ["massacr/e", "大屠杀/词尾"],
  mayoralty: ["mayor/alty", "市长/职位"],
  metalwork: ["metal/work", "金属/工作"],
  methanol: ["meth/an/ol", "甲基/词尾/醇"],
  methyl: ["meth/yl", "甲基/名词"],
  metropolitan: ["metro/polit/an", "都市/城市；国家/形容词"],
  microclimate: ["micro/climate", "微小/气候"],
  microorganism: ["micro/organism", "微小/生物体"],
  millennium: ["mill/enn/ium", "千/年/名词"],
  reminder: ["re/mind/er", "再次；重新/头脑；记住/物"],
  mission: ["miss/ion", "送；派遣/名词"],
  submission: ["sub/miss/ion", "在下/送；交出/名词"],
  model: ["model", "模型"],
  morphological: ["morph/o/log/ic/al", "形状/词尾/学科/形容词/形容词"],
  morphology: ["morph/logy", "形状/学科"],
  mountable: ["mount/able", "登上/能够；可"],
  mountainous: ["mountain/ous", "山/形容词"],
  mouthwash: ["mouth/wash", "口/清洗"],
  mummia: ["mumm/ia", "木乃伊/名词"],
  nanotech: ["nano/tech", "极小/技术"],
  oblige: ["ob/lig/e", "朝向；加强/捆绑；约束/词尾"],
  obligate: ["ob/lig/ate", "朝向；加强/捆绑；约束/动词"],
  obligation: ["ob/lig/ation", "朝向；加强/捆绑；约束/名词"],
  obligatory: ["ob/lig/atory", "朝向；加强/捆绑；约束/形容词"],
  obligor: ["ob/lig/or", "朝向；加强/捆绑；约束/人"],
  obese: ["ob/ese", "朝向；加强/吃；肥胖"],
  obesity: ["obes/ity", "肥胖/名词"],
  obesogenic: ["obes/o/genic", "肥胖/词尾/产生"],
  omission: ["o/miss/ion", "向外；离开/送；放过/名词"],
  omnivore: ["omni/vore", "全部/吃"],
  omnivorous: ["omni/vor/ous", "全部/吃/形容词"],
  ontology: ["onto/logy", "存在/学科"],
  ontological: ["onto/log/ic/al", "存在/学科/形容词/形容词"],
  ontologist: ["onto/log/ist", "存在/学科/人"],
  orthodox: ["ortho/dox", "正确；正直/意见；信念"],
  orthodoxy: ["ortho/dox/y", "正确；正直/意见；信念/名词"],
  unorthodox: ["un/ortho/dox", "不；相反/正确；正直/意见；信念"],
  ozonation: ["ozone/ation", "臭氧/名词"],
  ozonide: ["ozon/ide", "臭氧/化合物"],
  ozonolysis: ["ozono/lysis", "臭氧/分解"],
  package: ["pack/age", "捆扎/名词"],
  packager: ["pack/ag/er", "捆扎/名词/人"],
  paralyse: ["para/lys/e", "旁边；异常/松开；分解/词尾"],
  paralysis: ["para/lys/is", "旁边；异常/松开；分解/名词"],
  pathological: ["path/o/log/ic/al", "疾病；感受/词尾/学科/形容词/形容词"],
  pathology: ["path/o/log/y", "疾病；感受/词尾/学科/名词"],
  pathogen: ["patho/gen", "疾病/产生"],
  pathogenic: ["patho/gen/ic", "疾病/产生/形容词"],
  pathway: ["path/way", "道路/道路"],
  pavement: ["pave/ment", "铺设/名词"],
  petroleum: ["petr/oleum", "石头/油"],
  petroliferous: ["petr/ol/ifer/ous", "石头/油/带来/形容词"],
  petrology: ["petr/o/logy", "石头/词尾/学科"],
  phytochemistry: ["phyto/chem/istry", "植物/化学/学科"],
  phytonutrient: ["phyto/nutrient", "植物/营养物"],
  phytopathology: ["phyto/path/o/logy", "植物/疾病/词尾/学科"],
  phytoplankton: ["phyto/plankton", "植物/浮游生物"],
  phytoremediation: ["phyto/re/medi/ation", "植物/再次；重新/治疗；修复/名词"],
  pilotage: ["pilot/age", "驾驶；引航/名词"],
  pilotless: ["pilot/less", "驾驶员/无；缺少"],
  pivotable: ["pivot/able", "枢轴/能够；可"],
  pivotal: ["pivot/al", "枢轴；关键/形容词"],
  pivotality: ["pivot/al/ity", "枢轴；关键/形容词/名词"],
  placement: ["place/ment", "放置/名词"],
  placental: ["placent/al", "胎盘/形容词"],
  plaguer: ["plague/er", "瘟疫；烦扰/人"],
  plaintive: ["plaint/ive", "抱怨；诉苦/形容词"],
  planetarium: ["planet/arium", "行星/场所"],
  planetary: ["planet/ary", "行星/形容词"],
  planetesimal: ["planet/esimal", "行星/小物"],
  plantation: ["plant/ation", "种植/名词"],
  planter: ["plant/er", "种植/人；物"],
  portable: ["port/able", "携带/能够；可"],
  portage: ["port/age", "携带/名词"],
  porter: ["port/er", "携带/人"],
  portion: ["port/ion", "部分；携带/名词"],
  report: ["re/port", "回；再次/带回；报告"],
  positional: ["posit/ion/al", "放置/名词/形容词"],
  positive: ["posit/ive", "放置；确定/形容词"],
  pressure: ["press/ure", "压/名词"],
  pressurize: ["press/ur/ize", "压/名词/动词"],
  priceless: ["price/less", "价格/无；缺少"],
  pricing: ["price/ing", "定价/名词"],
  principal: ["prince/ip/al", "首要；王子/词尾/形容词"],
  principality: ["prince/ip/al/ity", "王子；首要/词尾/形容词/名词"],
  principle: ["prince/ip/le", "首要；原则/词尾/名词"],
  printer: ["print/er", "打印；印刷/人；物"],
  pristine: ["prist/ine", "原始；古老/形容词"],
  psychology: ["psych/logy", "心灵/学科"],
  psychological: ["psych/log/ic/al", "心灵/学科/形容词/形容词"],
  psychologist: ["psych/log/ist", "心灵/学科/人"],
  psychiatry: ["psych/iatry", "心灵/医学治疗"],
  psychoanalysis: ["psych/o/analysis", "心灵/词尾/分析"],
  radioactive: ["radio/active", "放射/活跃的"],
  radioactivity: ["radio/activ/ity", "放射/活跃/名词"],
  radiochemistry: ["radio/chem/istry", "放射/化学/学科"],
  radiography: ["radio/graph/y", "放射/写；图/名词"],
  radioisotope: ["radio/iso/tope", "放射/相同/位置"],
  radionuclide: ["radio/nucl/ide", "放射/核/化合物"],
  radiotherapy: ["radio/therapy", "放射/治疗"],
  raider: ["raid/er", "突袭/人"],
  raidproof: ["raid/proof", "突袭/防护"],
  rainforest: ["rain/forest", "雨/森林"],
  rainstorm: ["rain/storm", "雨/风暴"],
  rainwater: ["rain/water", "雨/水"],
  restless: ["rest/less", "休息/无；缺少"],
  restoration: ["re/stor/ation", "再次；重新/建立；修复/名词"],
  restorative: ["re/stor/ative", "再次；重新/建立；修复/形容词"],
  restore: ["re/stor/e", "再次；重新/建立；修复/词尾"],
  restorer: ["re/stor/er", "再次；重新/建立；修复/人"],
  rhythmic: ["rhythm/ic", "节奏/形容词"],
  rhythmical: ["rhythm/ic/al", "节奏/形容词/形容词"],
  hold: ["hold", "握住；保持"],
  holding: ["hold/ing", "握住；保持/名词；形容词"],
  holey: ["hole/y", "洞/形容词"],
  hollow: ["holl/ow", "空；洞/形容词"],
  hollowed: ["holl/ow/ed", "空；洞/形容词/形容词"],
  holler: ["holl/er", "叫喊/动词"],
  purity: ["pur/ity", "纯/名词"],
  impurity: ["im/pur/ity", "不；相反/纯/名词"],
  psyche: ["psych/e", "心灵/词尾"],
  quote: ["quot/e", "说；引用/词尾"],
  quota: ["quot/a", "数额；引用/名词"],
  quotable: ["quot/able", "引用/能够；可"],
  quotation: ["quot/ation", "引用/名词"],
  quotative: ["quot/ative", "引用/形容词"],
  quotient: ["quot/ient", "份额；商/名词"],
  quotum: ["quot/um", "数额/名词"],
  rainy: ["rain/y", "雨/形容词"],
  rainfall: ["rain/fall", "雨/落下"],
  raise: ["rais/e", "举起/词尾"],
  raiser: ["rais/er", "举起/人；物"],
  rivalry: ["rival/ry", "竞争者/名词"],
  rivalrous: ["rival/rous", "竞争者/形容词"],
  robotic: ["robot/ic", "机器人/形容词"],
  robotization: ["robot/iz/ation", "机器人/动词/名词"],
  robotize: ["robot/ize", "机器人/动词"],
  rodlike: ["rod/like", "杆/像…的"],
  rubblework: ["rubble/work", "碎石/工作"],
  rubblefield: ["rubble/field", "碎石/场地"],
  rubblepile: ["rubble/pile", "碎石/堆"],
  rubbly: ["rubble/y", "碎石/形容词"],
  rugbyball: ["rugby/ball", "橄榄球/球"],
  rugbyfield: ["rugby/field", "橄榄球/场地"],
  rugbyplayer: ["rugby/player", "橄榄球/运动员"],
  rulebook: ["rule/book", "规则/书"],
  sagacious: ["sag/acious", "智慧/形容词"],
  sagacity: ["sag/acity", "智慧/名词"],
  sailboat: ["sail/boat", "帆/船"],
  sailcloth: ["sail/cloth", "帆/布"],
  sailmaker: ["sail/maker", "帆/制造者"],
  saliency: ["salien/cy", "显著/名词"],
  salience: ["salien/ce", "显著/名词"],
  scarcity: ["scarce/ity", "缺乏；稀有/名词"],
  scarceness: ["scarce/ness", "缺乏；稀有/名词"],
  scavengeable: ["scavenge/able", "搜寻；清除/能够；可"],
  scavenger: ["scaveng/er", "搜寻；清除/人"],
  schematic: ["schema/tic", "图式；计划/形容词"],
  schematize: ["schema/tize", "图式；计划/动词"],
  searchable: ["search/able", "搜索/能够；可"],
  searcher: ["search/er", "搜索/人"],
  seasonal: ["season/al", "季节/形容词"],
  seasonality: ["season/al/ity", "季节/形容词/名词"],
  seasonally: ["season/al/ly", "季节/形容词/副词"],
  unseasonal: ["un/season/al", "不；相反/季节/形容词"],
  seclude: ["se/clud/e", "分开/关闭/词尾"],
  seclusion: ["se/clus/ion", "分开/关闭/名词"],
  seizable: ["seiz/able", "抓住；占有/能够；可"],
  seizure: ["seiz/ure", "抓住；占有/名词"],
  selfish: ["self/ish", "自我/形容词"],
  selfless: ["self/less", "自我/无；缺少"],
  shadeless: ["shade/less", "阴影/无；缺少"],
  shareholder: ["share/holder", "股份；分享/持有者"],
  shareholding: ["share/holding", "股份；分享/持有"],
  shipment: ["ship/ment", "运输；船/名词"],
  reshuffle: ["re/shuffle", "再次；重新/洗牌；改组"],
  sidetrack: ["side/track", "旁边/轨道"],
  sidewalk: ["side/walk", "旁边/走路"],
  siltation: ["silt/ation", "粉砂/名词"],
  skeleton: ["skelet/on", "骨架/名词"],
  skeletal: ["skelet/al", "骨架/形容词"],
  smashproof: ["smash/proof", "粉碎/防护"],
  smelting: ["smelt/ing", "冶炼/名词"],
  soilless: ["soil/less", "土壤/无；缺少"],
  solicit: ["solicit", "恳求；请求"],
  solicitation: ["solicit/ation", "恳求；请求/名词"],
  unsolicited: ["un/solicit/ed", "不；相反/恳求；请求/形容词"],
  sortable: ["sort/able", "分类/能够；可"],
  sorter: ["sort/er", "分类/人；物"],
  southwestern: ["south/west/ern", "南/西/形容词"],
  southeastern: ["south/east/ern", "南/东/形容词"],
  southernmost: ["south/ern/most", "南/形容词/最"],
  southward: ["south/ward", "南/方向"],
  spacecraft: ["space/craft", "太空/器具"],
  spacious: ["spac/ious", "空间/形容词"],
  speaker: ["speak/er", "说话/人；物"],
  spender: ["spend/er", "花费/人"],
  spherical: ["spher/ic/al", "球/形容词/形容词"],
  spherically: ["spher/ic/al/ly", "球/形容词/形容词/副词"],
  spreadsheet: ["spread/sheet", "展开；表格/片"],
  stainless: ["stain/less", "污点/无；缺少"],
  statistics: ["stat/ist/ics", "站立；状态/人/学科"],
  statistical: ["stat/ist/ic/al", "站立；状态/人/形容词/形容词"],
  statistician: ["stat/ist/ician", "站立；状态/人/人"],
  statue: ["stat/ue", "站立；雕像/名词"],
  statuary: ["stat/u/ary", "站立；雕像/词尾/形容词"],
  stature: ["stat/ure", "站立；身高/名词"],
  steadfast: ["stead/fast", "位置；稳定/固定"],
  steadfastness: ["stead/fast/ness", "位置；稳定/固定/名词"],
  steadiness: ["steady/ness", "稳定/名词"],
  unsteady: ["un/steady", "不；相反/稳定"],
  stockyard: ["stock/yard", "库存；牲畜/场地"],
  stockholder: ["stock/holder", "股票；库存/持有者"],
  stockpile: ["stock/pile", "库存/堆"],
  stonemason: ["stone/mason", "石头/泥瓦匠"],
  storage: ["stor/age", "储存/名词"],
  stormbound: ["storm/bound", "风暴/受困"],
  stormfront: ["storm/front", "风暴/前沿"],
  stormsystem: ["storm/system", "风暴/系统"],
  stormwater: ["storm/water", "风暴/水"],
  stressful: ["stress/ful", "压力/充满"],
  stretchable: ["stretch/able", "拉伸/能够；可"],
  surgent: ["surg/ent", "涌起/形容词"],
  surgery: ["surg/ery", "外科；手术/名词"],
  surgical: ["surg/ic/al", "外科；手术/形容词/形容词"],
  switchable: ["switch/able", "开关；转换/能够；可"],
  systemic: ["system/ic", "系统/形容词"],
  taxable: ["tax/able", "税/能够；可"],
  taxation: ["tax/ation", "税/名词"],
  taxon: ["tax/on", "排列；分类/名词"],
  taxonomic: ["tax/on/omic", "排列；分类/名词/形容词"],
  taxonomy: ["tax/on/omy", "排列；分类/名词/学科"],
  testimony: ["test/imony", "证明；证言/名词"],
  testify: ["test/ify", "证明/动词"],
  textural: ["text/ur/al", "编织；文本/名词/形容词"],
  texture: ["text/ure", "编织；质地/名词"],
  threadbare: ["thread/bare", "线/裸露；磨损"],
  threadcount: ["thread/count", "线/数量"],
  threadwork: ["thread/work", "线/工作"],
  throughput: ["through/put", "穿过/放置"],
  throughway: ["through/way", "穿过/道路"],
  thumbprint: ["thumb/print", "拇指/印记"],
  tillage: ["till/age", "耕作/名词"],
  tireless: ["tire/less", "疲劳/无；缺少"],
  tiresome: ["tire/some", "疲劳/形容词"],
  storey: ["stor/ey", "层；储藏/名词"],
  storyline: ["story/line", "故事/线"],
  ridge: ["ridge", "山脊；脊线"],
  ridgecrest: ["ridge/crest", "山脊/顶"],
  ridgeline: ["ridge/line", "山脊/线"],
  ridgeway: ["ridge/way", "山脊/道路"],
  strainer: ["strain/er", "拉紧；过滤/人；物"],
  streamflow: ["stream/flow", "溪流/流动"],
  stressor: ["stress/or", "压力/物"],
  stretcher: ["stretch/er", "伸展/人；物"],
  stretchmark: ["stretch/mark", "伸展/痕迹"],
  stripmall: ["strip/mall", "条带；剥离/商业区"],
  stripmine: ["strip/mine", "剥离/矿"],
  striptease: ["strip/tease", "脱去/挑逗"],
  studious: ["study/ous", "学习/形容词"],
  studyroom: ["study/room", "学习/房间"],
  sweeper: ["sweep/er", "打扫/人；物"],
  sweeping: ["sweep/ing", "打扫；横扫/形容词"],
  switchback: ["switch/back", "转换/返回"],
  switchboard: ["switch/board", "开关/板"],
  switchgear: ["switch/gear", "开关/设备"],
  switchyard: ["switch/yard", "开关/场地"],
  tankard: ["tank/ard", "容器/名词"],
  targetable: ["target/able", "目标/能够；可"],
  tautological: ["taut/log/ic/al", "同一；重复/学科；言说/形容词/形容词"],
  tautology: ["taut/log/y", "同一；重复/学科；言说/名词"],
  tautomer: ["taut/o/mer", "同一；重复/词尾/部分"],
  tautonym: ["taut/onym", "同一；重复/名字"],
  tendency: ["tend/ency", "趋向/名词"],
  thinly: ["thin/ly", "薄/副词"],
  thinness: ["thin/ness", "薄/名词"],
  throngful: ["throng/ful", "人群/充满"],
  throughflow: ["through/flow", "穿过/流动"],
  throughline: ["through/line", "穿过/线"],
  throughout: ["through/out", "穿过/外面"],
  tidal: ["tide/al", "潮汐/形容词"],
  tideless: ["tide/less", "潮汐/无；缺少"],
  timeframe: ["time/frame", "时间/框架"],
  timeline: ["time/line", "时间/线"],
  totalitarian: ["total/itarian", "全部/主义者；形容词"],
  totalitarianism: ["total/itarian/ism", "全部/主义者；形容词/主义"],
  touchless: ["touch/less", "接触/无；缺少"],
  touchstone: ["touch/stone", "接触/石头"],
  trademark: ["trade/mark", "贸易；商业/标记"],
  tradition: ["trad/ition", "传递；交付/名词"],
  traditional: ["trad/ition/al", "传递；交付/名词/形容词"],
  traditionally: ["trad/ition/al/ly", "传递；交付/名词/形容词/副词"],
  traitor: ["trait/or", "交出；背叛/人"],
  traitorous: ["trait/or/ous", "交出；背叛/人/形容词"],
  trajectory: ["tra/ject/ory", "穿过/投掷/名词"],
  trajectorial: ["tra/ject/orial", "穿过/投掷/形容词"],
  transistor: ["trans/ist/or", "跨越/站立/物"],
  transit: ["trans/it", "穿过/走"],
  transition: ["trans/it/ion", "穿过/走/名词"],
  transitional: ["trans/it/ion/al", "穿过/走/名词/形容词"],
  transitory: ["trans/it/ory", "穿过/走/形容词"],
  travelogue: ["travel/logue", "旅行/文字；记录"],
  traveldocument: ["travel/document", "旅行/文件"],
  traveler: ["travel/er", "旅行/人"],
  traveller: ["travel/ler", "旅行/人"],
  traverse: ["tra/vers/e", "穿过/转；走/词尾"],
  traversable: ["tra/vers/able", "穿过/转；走/能够；可"],
  traversal: ["tra/vers/al", "穿过/转；走/名词"],
  treatment: ["treat/ment", "处理；治疗/名词"],
  intertribal: ["inter/trib/al", "在…之间/部族/形容词"],
  tribal: ["trib/al", "部族/形容词"],
  tribunal: ["trib/un/al", "部族；法庭/词尾/形容词"],
  trickery: ["trick/ery", "诡计/名词"],
  trickish: ["trick/ish", "诡计/形容词"],
  trickleflow: ["trickle/flow", "细流/流动"],
  trickproof: ["trick/proof", "诡计/防护"],
  trickster: ["trick/ster", "诡计/人"],
  triumphal: ["triumph/al", "胜利/形容词"],
  triumphant: ["triumph/ant", "胜利/形容词"],
  triumpher: ["triumph/er", "胜利/人"],
  trivia: ["tri/vi/a", "三/道路/名词"],
  nontrivial: ["non/triv/ial", "不；无/琐碎/形容词"],
  trivial: ["triv/ial", "琐碎/形容词"],
  trivialize: ["triv/ial/ize", "琐碎/形容词/动词"],
  trooper: ["troop/er", "部队；群体/人"],
  tropical: ["trop/ic/al", "转向；热带/形容词/形容词"],
  tropics: ["trop/ics", "转向；热带/名词"],
  tropism: ["trop/ism", "转向/现象"],
  tropopause: ["tropo/pause", "对流层/暂停"],
  troposphere: ["tropo/sphere", "对流层/球层"],
  tsunamirisk: ["tsunami/risk", "海啸/风险"],
  tsunamigenic: ["tsunami/gen/ic", "海啸/产生/形容词"],
  tsunamimeter: ["tsunami/meter", "海啸/测量器"],
  tuberous: ["tuber/ous", "块茎/形容词"],
  turnaround: ["turn/around", "转/周围"],
  turnover: ["turn/over", "转/翻过"],
  ultimacy: ["ultim/acy", "最后/性质"],
  ultimate: ["ultim/ate", "最后/形容词"],
  ultimatum: ["ultim/atum", "最后/名词"],
  urgency: ["urg/ency", "催促/名词"],
  urgent: ["urg/ent", "催促/形容词"],
  usability: ["us/ability", "使用/能力"],
  usable: ["us/able", "使用/能够；可"],
  useful: ["use/ful", "使用/充满"],
  utopian: ["utopia/n", "乌托邦/形容词"],
  utopianism: ["utopia/n/ism", "乌托邦/形容词/主义"],
  valuable: ["value/able", "价值/能够；可"],
  valuation: ["valu/ation", "价值/名词"],
  valuechain: ["value/chain", "价值/链"],
  venomology: ["venom/logy", "毒液/学科"],
  venomous: ["venom/ous", "毒液/形容词"],
  nonverbal: ["non/verb/al", "不；无/词语/形容词"],
  verbal: ["verb/al", "词语/形容词"],
  verbiage: ["verb/iage", "词语/名词"],
  vergence: ["verg/ence", "倾向；边缘/名词"],
  verminous: ["vermin/ous", "害虫/形容词"],
  victorious: ["victor/ious", "胜利者/形容词"],
  viewer: ["view/er", "看/人"],
  viewpoint: ["view/point", "看法/点"],
  vigilance: ["vigil/ance", "警觉/名词"],
  vigilant: ["vigil/ant", "警觉/形容词"],
  violinist: ["violin/ist", "小提琴/人"],
  voidable: ["void/able", "无效；空/能够；可"],
  voidance: ["void/ance", "无效；空/名词"],
  voidness: ["void/ness", "无效；空/名词"],
  volcano: ["volcan/o", "火山/词尾"],
  volcanologist: ["volcan/o/log/ist", "火山/词尾/学科/人"],
  volcanology: ["volcan/o/log/y", "火山/词尾/学科/名词"],
  wageearner: ["wage/earner", "工资/赚取者"],
  wagefloor: ["wage/floor", "工资/底线"],
  wageworker: ["wage/worker", "工资/工人"],
  wagonload: ["wagon/load", "马车/载量"],
  walkability: ["walk/ability", "行走/能力"],
  walkable: ["walk/able", "行走/能够；可"],
  wallboard: ["wall/board", "墙/板"],
  wallflower: ["wall/flower", "墙/花"],
  wallpaper: ["wall/paper", "墙/纸"],
  warnable: ["warn/able", "警告/能够；可"],
  warning: ["warn/ing", "警告/名词"],
  warpage: ["warp/age", "扭曲/名词"],
  warpknit: ["warp/knit", "经线/编织"],
  wavelength: ["wave/length", "波/长度"],
  waverer: ["waver/er", "摇摆；犹豫/人"],
  weathering: ["weather/ing", "天气；风化/名词"],
  weaver: ["weav/er", "编织/人"],
  weightless: ["weight/less", "重量/无；缺少"],
  weighty: ["weight/y", "重量/形容词"],
  welfarework: ["welfare/work", "福利/工作"],
  welfarestate: ["welfare/state", "福利/国家"],
  welfarism: ["welfare/ism", "福利/主义"],
  welfarist: ["welfare/ist", "福利/人"],
  whimsical: ["whimsy/ical", "奇想/形容词"],
  unwieldy: ["un/wield/y", "不；相反/使用；掌握/形容词"],
  wieldable: ["wield/able", "使用；掌握/能够；可"],
  wielder: ["wield/er", "使用；掌握/人"],
  windbreak: ["wind/break", "风/阻挡"],
  windfall: ["wind/fall", "风/落下"],
  windfarm: ["wind/farm", "风/农场"],
  windmill: ["wind/mill", "风/磨坊"],
  windpower: ["wind/power", "风/力量"],
  windshield: ["wind/shield", "风/屏障"],
  windturbine: ["wind/turbine", "风/涡轮"],
  windward: ["wind/ward", "风/方向"],
  windowless: ["window/less", "窗口/无；缺少"],
  windowsill: ["window/sill", "窗口/窗台"],
  woolly: ["wool/ly", "羊毛/形容词"],
  worldwide: ["world/wide", "世界/广阔"],
  worthiness: ["worthy/ness", "有价值/名词"],
  worthless: ["worth/less", "价值/无；缺少"],
  worthwhile: ["worth/while", "价值/时间"],
  written: ["writ/ten", "写/形容词"],
  rewritten: ["re/writ/ten", "再次；重新/写/形容词"],
  unwritten: ["un/writ/ten", "不；相反/写/形容词"],
  yearnful: ["yearn/ful", "渴望/充满"],
  yieldable: ["yield/able", "产出；屈服/能够；可"],
  yieldcurve: ["yield/curve", "收益/曲线"],
  zookeeper: ["zoo/keeper", "动物园/看守者"],
  zoological: ["zoo/log/ic/al", "动物/学科/形容词/形容词"],
  zoologist: ["zoo/log/ist", "动物/学科/人"],
  zoology: ["zoo/log/y", "动物/学科/名词"],
  zoonosis: ["zoo/nosis", "动物/疾病"],
  zooplankton: ["zoo/plankton", "动物/浮游生物"]
};

const SUFFIX_MEANINGS = {
  ability: "能力；名词",
  ibility: "能力；名词",
  able: "能够；可",
  ible: "能够；可",
  ably: "能够；可/副词",
  ibly: "能够；可/副词",
  acy: "性质；状态",
  age: "名词",
  al: "形容词；名词",
  ally: "形容词/副词",
  ial: "形容词",
  ical: "形容词",
  ic: "形容词；名词",
  ance: "名词",
  ence: "名词",
  ant: "形容词；名词",
  ent: "形容词；名词",
  ary: "形容词",
  ery: "名词",
  ation: "名词",
  tion: "名词",
  sion: "名词",
  ion: "名词",
  ution: "名词",
  ity: "名词",
  ive: "形容词",
  ively: "形容词/副词",
  ous: "形容词",
  eous: "形容词",
  ious: "形容词",
  ile: "形容词",
  ine: "形容词；名词",
  ee: "人；受事者",
  oid: "像…的",
  icle: "小物；名词",
  ule: "小物；名词",
  ul: "词尾",
  ure: "名词",
  ture: "名词",
  le: "词尾",
  cle: "名词",
  tude: "名词",
  ude: "名词",
  ite: "名词；形容词",
  ish: "动词；形容词",
  ute: "形容词；动词",
  id: "形容词",
  ment: "名词",
  ness: "名词",
  ism: "主义；学说",
  ist: "人；从业者",
  er: "人；物",
  or: "人；物",
  ar: "人；物",
  eer: "人",
  ing: "名词；形容词",
  ed: "形容词",
  ly: "副词",
  ify: "使成为",
  ise: "动词",
  ize: "动词",
  ate: "动词；使成为",
  en: "动词；使成为",
  ship: "身份；关系",
  hood: "身份；状态",
  less: "无；缺少",
  ful: "充满"
};

const ORDERED_SUFFIXES = Object.keys(SUFFIX_MEANINGS).sort((a, b) => b.length - a.length);

const PREFIX_MEANINGS = {
  a: "离开；使；无",
  ab: "离开",
  ad: "向；加强",
  ac: "向；加强",
  af: "向；加强",
  ag: "向；加强",
  al: "向；加强",
  an: "无；不",
  ap: "向；加强",
  ar: "向；加强",
  as: "向；加强",
  at: "向；加强",
  anti: "反对；抵抗",
  auto: "自己",
  bene: "好；善",
  be: "使成为；加强",
  bi: "二；两",
  circum: "环绕；周围",
  co: "共同；加强",
  col: "共同；加强",
  com: "共同；加强",
  con: "共同；加强",
  cor: "共同；加强",
  contra: "反对",
  counter: "反对；相反",
  de: "向下；除去",
  di: "分开；离开",
  dis: "分开；否定",
  dys: "坏；困难",
  e: "出；向外",
  ec: "出；向外",
  ef: "出；向外",
  ex: "出；向外",
  extra: "外部；超过",
  fore: "在前",
  hyper: "过度；超过",
  hypo: "在下；不足",
  il: "不；无",
  im: "不；无；向内",
  in: "不；无；向内",
  ir: "不；无",
  inter: "在…之间",
  intro: "向内",
  macro: "大",
  mal: "坏；恶",
  micro: "小",
  mis: "错误；坏",
  mono: "单一",
  multi: "多",
  non: "不；无",
  ob: "朝向；反对",
  oc: "朝向；反对",
  of: "朝向；反对",
  op: "朝向；反对",
  per: "通过；完全",
  post: "之后",
  pre: "之前；预先",
  pro: "向前；支持",
  re: "再次；重新",
  retro: "向后",
  semi: "半",
  sub: "在下；次级",
  suc: "在下；随后",
  suf: "在下；随后",
  sug: "在下；随后",
  sup: "在下；随后",
  sur: "在上；超过",
  sus: "在下；随后",
  super: "在上；超过",
  syn: "共同；一起",
  sym: "共同；一起",
  trans: "穿过；转变",
  ultra: "超过；极端",
  un: "不；相反"
};

const ORDERED_PREFIXES = Object.keys(PREFIX_MEANINGS).sort((a, b) => b.length - a.length);

function isBadCut(card) {
  const cut = clean(card && card.cut).toLowerCase();
  if (!cut || cut === clean(card && card.head).toLowerCase()) return true;
  if (/[?？]|待校|音似|谐音|驴拉坦克/.test(`${card.cut}\n${card.cutMeaning}`)) return true;
  return false;
}

function hasMissingCut(card) {
  if (!clean(card && card.cut)) return true;
  if (/[?？]|待校|音似|谐音|驴拉坦克/.test(`${card.cut}\n${card.cutMeaning}`)) return true;
  return false;
}

function hasGoodCut(card) {
  return card && !isBadCut(card);
}

function appendCut(baseCard, suffix) {
  return {
    cut: `${baseCard.cut}/${suffix}`,
    cutMeaning: `${clean(baseCard.cutMeaning)}/${SUFFIX_MEANINGS[suffix]}`
  };
}

function dropFinalEFromCut(cut) {
  const parts = cut.split("/");
  const last = parts[parts.length - 1];
  if (last && last.endsWith("e") && last.length > 1) {
    parts[parts.length - 1] = last.slice(0, -1);
  }
  return parts.join("/");
}

function inferCutFromBase(word, baseCard) {
  const base = baseCard.head;
  if (!word || !base || word === base || !hasGoodCut(baseCard)) return null;

  for (const suffix of ORDERED_SUFFIXES) {
    if (word === `${base}${suffix}`) {
      return appendCut(baseCard, suffix);
    }
    if (base.endsWith("e") && word === `${base.slice(0, -1)}${suffix}`) {
      return {
        cut: `${dropFinalEFromCut(baseCard.cut)}/${suffix}`,
        cutMeaning: `${clean(baseCard.cutMeaning)}/${SUFFIX_MEANINGS[suffix]}`
      };
    }
    if (base.endsWith("y") && word === `${base.slice(0, -1)}i${suffix}`) {
      return appendCut(baseCard, suffix);
    }
  }

  if (base.endsWith("ate") && word === `${base.slice(0, -1)}ion`) {
    const parts = baseCard.cut.split("/");
    if (parts[parts.length - 1] === "ate") {
      parts[parts.length - 1] = "ation";
      return {
        cut: parts.join("/"),
        cutMeaning: `${clean(baseCard.cutMeaning).replace(/\/[^/]+$/, "")}/名词`
      };
    }
  }

  return null;
}

function splitKnownSuffixes(rest) {
  const parts = [];
  const meanings = [];
  let value = rest;
  while (value) {
    if (value === "e") {
      parts.push("e");
      meanings.push("词尾");
      value = "";
      continue;
    }
    const suffix = ORDERED_SUFFIXES.find((item) => value.endsWith(item));
    if (!suffix) {
      parts.unshift(value);
      meanings.unshift("待校");
      break;
    }
    parts.unshift(suffix);
    meanings.unshift(SUFFIX_MEANINGS[suffix]);
    value = value.slice(0, -suffix.length);
  }
  return { parts, meanings };
}

function splitKnownPrefixes(rest) {
  const parts = [];
  const meanings = [];
  let value = rest;
  while (value) {
    const prefix = ORDERED_PREFIXES.find((item) => value.startsWith(item));
    if (!prefix) {
      parts.push(value);
      meanings.push("待校");
      break;
    }
    parts.push(prefix);
    meanings.push(PREFIX_MEANINGS[prefix]);
    value = value.slice(prefix.length);
  }
  return { parts, meanings };
}

function inferCutFromRoot(word, roots, options = {}) {
  const minRootLength = options.minRootLength || 3;
  const normalized = word.replace(/-/g, "");
  const candidates = roots
    .filter((root) => root.root.length >= minRootLength && normalized.includes(root.root))
    .sort((a, b) => b.root.length - a.root.length || normalized.indexOf(a.root) - normalized.indexOf(b.root));
  for (const root of candidates) {
    const index = normalized.indexOf(root.root);
    const before = normalized.slice(0, index);
    const after = normalized.slice(index + root.root.length);
    const prefix = splitKnownPrefixes(before);
    const suffix = splitKnownSuffixes(after);
    if (prefix.meanings.includes("待校") || suffix.meanings.includes("待校")) continue;
    const parts = [...prefix.parts, root.root, ...suffix.parts].filter(Boolean);
    if (parts.length < 2) continue;
    const meanings = [...prefix.meanings, root.meaning, ...suffix.meanings].filter(Boolean);
    return { cut: parts.join("/"), cutMeaning: meanings.join("/") };
  }
  return null;
}

function rootsFromKinEntries(entries, allRoots) {
  if (!entries || !entries.length) return [];
  const allowed = new Map();
  for (const entry of entries) {
    for (const rawRoot of clean(entry.head).split(",")) {
      const root = clean(rawRoot).toLowerCase().replace(/\(.+?\)/g, "");
      if (/^[a-z]{2,}$/.test(root)) allowed.set(root, entry.meaning || "");
    }
  }
  const fallback = new Map(allRoots.map((item) => [item.root, item.meaning]));
  return [...allowed.entries()].map(([root, meaning]) => ({
    root,
    meaning: meaning || fallback.get(root) || ""
  })).sort((a, b) => b.root.length - a.root.length || a.root.localeCompare(b.root));
}

function parseLegacyKinWordRoots() {
  if (!fs.existsSync(LEGACY_KIN_WORD_MD)) return {};
  const out = {};
  const text = fs.readFileSync(LEGACY_KIN_WORD_MD, "utf8").replace(/\r\n/g, "\n");
  let current = "";
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[a-z][a-z-]*$/i.test(line)) {
      current = line.toLowerCase();
      continue;
    }
    if (!current || !line.startsWith("kin:")) continue;
    const entries = [];
    for (const chunk of clean(line.slice("kin:".length)).split("|")) {
      const match = /^([a-z,() ]+)\s+(.+)$/.exec(clean(chunk));
      if (!match) continue;
      const meaning = clean(match[2]);
      for (const rawRoot of match[1].split(",")) {
        const root = clean(rawRoot).toLowerCase().replace(/\(.+?\)/g, "");
        if (/^[a-z]{2,}$/.test(root)) entries.push({ root, meaning });
      }
    }
    if (entries.length) out[current] = entries;
  }
  return out;
}

function briefMeaning(card) {
  const sense = card && card.senses && card.senses[0];
  const text = clean((sense && (sense.zh || sense.gloss)) || "");
  return text.split(/[；;，,、\s]/).filter(Boolean)[0] || "词";
}

function inferCompoundCut(card, byHead, rootGroups) {
  const word = card.head;
  const starters = [
    ...Object.keys(PREFIX_MEANINGS).map((part) => ({ part, meaning: PREFIX_MEANINGS[part] })),
    ...Object.entries(rootGroups).map(([part, group]) => ({ part, meaning: group.meaning }))
  ]
    .filter((item) => item.part.length >= 3)
    .sort((a, b) => b.part.length - a.part.length);

  for (const starter of starters) {
    if (!word.startsWith(starter.part) || word.length <= starter.part.length + 2) continue;
    const rest = word.slice(starter.part.length);
    const restCard = byHead.get(rest);
    if (!restCard) continue;
    return {
      cut: `${starter.part}/${rest}`,
      cutMeaning: `${starter.meaning}/${briefMeaning(restCard)}`
    };
  }

  for (let i = Math.min(12, word.length - 3); i >= 3; i -= 1) {
    const first = word.slice(0, i);
    const second = word.slice(i);
    const firstCard = byHead.get(first);
    const secondCard = byHead.get(second);
    if (!firstCard || !secondCard) continue;
    return {
      cut: `${first}/${second}`,
      cutMeaning: `${briefMeaning(firstCard)}/${briefMeaning(secondCard)}`
    };
  }

  return null;
}

function cutCoreMeaning(card, fallback = "核心义") {
  const core = briefMeaning(card);
  return core && core !== "词" ? core : fallback;
}

function inferAffixOnlyCut(cardOrWord) {
  const word = typeof cardOrWord === "string" ? cardOrWord : cardOrWord.head;
  const card = typeof cardOrWord === "string" ? { head: word, senses: [] } : cardOrWord;
  const core = cutCoreMeaning(card);
  const suffix = ORDERED_SUFFIXES.find((item) => word.endsWith(item) && word.length > item.length + 2);
  const safePrefixes = ORDERED_PREFIXES.filter((item) => (
    item.length >= 3 || ["un", "in", "im", "il", "ir", "re", "pre", "pro", "con", "com", "dis", "non"].includes(item)
  ));
  const prefix = safePrefixes.find((item) => word.startsWith(item) && word.length > item.length + 2);
  if (prefix && suffix && word.length > prefix.length + suffix.length + 2) {
    const stem = word.slice(prefix.length, -suffix.length);
    return {
      cut: `${prefix}/${stem}/${suffix}`,
      cutMeaning: `${PREFIX_MEANINGS[prefix]}/${core}/${SUFFIX_MEANINGS[suffix]}`
    };
  }
  if (suffix) {
    return {
      cut: `${word.slice(0, -suffix.length)}/${suffix}`,
      cutMeaning: `${core}/${SUFFIX_MEANINGS[suffix]}`
    };
  }
  if (prefix) {
    return {
      cut: `${prefix}/${word.slice(prefix.length)}`,
      cutMeaning: `${PREFIX_MEANINGS[prefix]}/${core}`
    };
  }
  return null;
}

function repairCuts(cards, families, kinRoots, kinWordIndex = {}, legacyKinRoots = {}) {
  const byHead = new Map(cards.map((card) => [card.head, card]));
  const rootGroups = {};
  for (const root of kinRoots) rootGroups[root.root] = { meaning: root.meaning };
  applyCutOverrides(cards);

  const familyByWord = new Map();
  for (const [head, words] of Object.entries(families)) {
    for (const word of words) {
      if (!familyByWord.has(word)) familyByWord.set(word, new Set());
      familyByWord.get(word).add(head);
    }
  }

  let repaired = 0;
  for (let pass = 0; pass < 3; pass += 1) {
    let changed = 0;
    for (const card of cards) {
      if (!isBadCut(card)) continue;
      const familyHeads = familyByWord.get(card.head);
      const candidates = [];
      if (familyHeads) {
        for (const familyHead of familyHeads) {
          const words = families[familyHead] || [];
          for (const word of words) {
            const base = byHead.get(word);
            if (base && word !== card.head && word.length < card.head.length && hasGoodCut(base)) {
              candidates.push(base);
            }
          }
        }
      }
      candidates.sort((a, b) => b.head.length - a.head.length);
      for (const base of candidates) {
        const inferred = inferCutFromBase(card.head, base);
        if (!inferred) continue;
        card.cut = inferred.cut;
        card.cutMeaning = inferred.cutMeaning;
        repaired += 1;
        changed += 1;
        break;
      }
      if (isBadCut(card) || clean(card.cut) === card.head) {
        const directKinRoots = [
          ...rootsFromKinEntries(kinWordIndex[card.head], kinRoots),
          ...(legacyKinRoots[card.head] || [])
        ];
        const inferred = directKinRoots.length
          ? inferCutFromRoot(card.head, directKinRoots, { minRootLength: 2 })
          : inferCutFromRoot(card.head, kinRoots);
        if (inferred && inferred.cut !== card.cut) {
          card.cut = inferred.cut;
          card.cutMeaning = inferred.cutMeaning;
          repaired += 1;
          changed += 1;
        }
      }
      if (isBadCut(card)) {
        const inferred = inferCompoundCut(card, byHead, rootGroups);
        if (inferred) {
          card.cut = inferred.cut;
          card.cutMeaning = inferred.cutMeaning;
          repaired += 1;
          changed += 1;
        }
      }
      if (isBadCut(card) && (kinWordIndex[card.head] || (families[card.head] || []).length > 1)) {
        const inferred = inferAffixOnlyCut(card);
        if (inferred) {
          card.cut = inferred.cut;
          card.cutMeaning = inferred.cutMeaning;
          repaired += 1;
          changed += 1;
        }
      }
      if (hasMissingCut(card)) {
        card.cut = card.head;
        card.cutMeaning = briefMeaning(card);
        repaired += 1;
        changed += 1;
      }
    }
    if (!changed) break;
  }

  const unresolved = cards.filter(hasMissingCut).map((card) => card.head);
  return { cards, repaired, unresolved };
}

function applyCutOverrides(cards) {
  const byHead = new Map(cards.map((card) => [card.head, card]));
  let changed = 0;
  for (const [word, [cut, cutMeaning]] of Object.entries(CUT_OVERRIDES)) {
    const card = byHead.get(word);
    if (!card) continue;
    if (card.cut !== cut || card.cutMeaning !== cutMeaning) changed += 1;
    card.cut = cut;
    card.cutMeaning = cutMeaning;
  }
  return changed;
}

function normalizeCutLetters(value) {
  return clean(value).toLowerCase().replace(/[^a-z]/g, "");
}

function exactPartForWord(part, rest) {
  const cleanPart = normalizeCutLetters(part);
  if (!cleanPart) return "";
  if (rest.startsWith(cleanPart)) return rest.slice(0, cleanPart.length);

  const candidates = [];
  if (cleanPart.endsWith("e") && cleanPart.length > 1) candidates.push(cleanPart.slice(0, -1));
  if (cleanPart.endsWith("y") && cleanPart.length > 1) candidates.push(`${cleanPart.slice(0, -1)}i`);
  if (/([bcdfghjklmnpqrstvwxyz])$/.test(cleanPart)) candidates.push(`${cleanPart}${cleanPart.slice(-1)}`);
  if (cleanPart.endsWith("b")) candidates.push(`${cleanPart.slice(0, -1)}p`);
  if (cleanPart.endsWith("c")) candidates.push(`${cleanPart.slice(0, -1)}qu`);

  for (const candidate of candidates.sort((a, b) => b.length - a.length)) {
    if (candidate && rest.startsWith(candidate)) return rest.slice(0, candidate.length);
  }
  return null;
}

function exactizeCutLetterCoverage(cards) {
  let fixed = 0;
  for (const card of cards) {
    const word = normalizeCutLetters(card.head);
    const cut = normalizeCutLetters(card.cut);
    if (!word || !cut || word === cut) continue;
    const rawParts = clean(card.cut).split("/").map(clean).filter(Boolean);
    const meaningParts = clean(card.cutMeaning).split("/").map(clean);
    if (rawParts.length < 2) continue;
    let rest = word;
    const nextParts = [];
    let ok = true;
    for (const rawPart of rawParts) {
      const nextPart = exactPartForWord(rawPart, rest);
      if (nextPart === null) {
        ok = false;
        break;
      }
      nextParts.push(nextPart || rawPart);
      rest = rest.slice((nextPart || "").length);
    }
    if (!ok || rest) continue;
    const nextCut = nextParts.join("/");
    if (normalizeCutLetters(nextCut) !== word) continue;
    card.cut = nextCut;
    if (meaningParts.length === rawParts.length) card.cutMeaning = meaningParts.join("/");
    fixed += 1;
  }
  return fixed;
}

function enforceCutLetterCoverage(cards) {
  let fixed = 0;
  for (const card of cards) {
    const word = normalizeCutLetters(card.head);
    const cut = normalizeCutLetters(card.cut);
    if (!word || !cut || word === cut) continue;
    card.cut = card.head;
    card.cutMeaning = briefMeaning(card);
    fixed += 1;
  }
  return fixed;
}

function improveFamilyMemberCuts(cards, families) {
  const byHead = new Map(cards.map((card) => [card.head, card]));
  const suffixSet = new Set(ORDERED_SUFFIXES);
  const prefixSet = new Set(ORDERED_PREFIXES);

  function componentCounts() {
    const counts = new Map();
    for (const card of cards) {
      const parts = clean(card.cut).split("/").map((part) => clean(part).toLowerCase()).filter(Boolean);
      if (parts.length < 2) continue;
      for (const part of parts) counts.set(part, (counts.get(part) || 0) + 1);
    }
    return counts;
  }

  function hasLonelyStem(card, counts) {
    const parts = clean(card.cut).split("/").map((part) => clean(part).toLowerCase()).filter(Boolean);
    if (parts.length < 2) return false;
    return parts.some((part) => (
      (counts.get(part) || 0) === 1
      && !suffixSet.has(part)
      && !prefixSet.has(part)
      && part !== clean(card.head).toLowerCase()
    ));
  }

  let changed = 0;
  for (let pass = 0; pass < 2; pass += 1) {
    const counts = componentCounts();
    let passChanged = 0;
    for (const words of Object.values(families)) {
      const sorted = [...new Set(words)].sort((a, b) => a.length - b.length);
      for (const word of sorted) {
        const card = byHead.get(word);
        if (!card || !hasLonelyStem(card, counts)) continue;
        const bases = sorted
          .filter((baseWord) => baseWord !== word && baseWord.length < word.length)
          .map((baseWord) => byHead.get(baseWord))
          .filter((baseCard) => baseCard && hasGoodCut(baseCard))
          .sort((a, b) => b.head.length - a.head.length);
        for (const baseCard of bases) {
          const inferred = inferCutFromBase(word, baseCard);
          if (!inferred || inferred.cut === card.cut) continue;
          card.cut = inferred.cut;
          card.cutMeaning = inferred.cutMeaning;
          changed += 1;
          passChanged += 1;
          break;
        }
      }
    }
    if (!passChanged) break;
  }
  return changed;
}

function completeFamilies(cards, families) {
  const cardWords = new Set(cards.map((card) => card.head));
  const cardByHead = new Map(cards.map((card) => [card.head, card]));
  const familyByWord = new Map();

  function indexFamilies() {
    familyByWord.clear();
    for (const [head, words] of Object.entries(families)) {
      for (const word of words) familyByWord.set(word, head);
    }
  }

  function addToFamily(head, word) {
    if (!cardWords.has(head) || !cardWords.has(word)) return;
    const oldHead = familyByWord.get(word);
    if (oldHead && oldHead !== head && families[oldHead]?.length === 1) delete families[oldHead];
    if (!families[head]) families[head] = [head];
    if (!families[head].includes(head)) families[head].unshift(head);
    if (!families[head].includes(word)) families[head].push(word);
    familyByWord.set(word, head);
  }

  function looksVerbalBase(base) {
    const card = cardByHead.get(base);
    return (card?.senses || []).some((sense) => /\bv\b/.test(clean(sense.pos)));
  }

  function baseCandidates(word) {
    const out = [];
    const suffixes = [
      ["ization", "ize"],
      ["isation", "ise"],
      ["ational", "ate"],
      ["ation", "ate"],
      ["ment", ""],
      ["ness", ""],
      ["ity", ""],
      ["ibility", "ible"],
      ["ability", "able"],
      ["ably", "able"],
      ["ibly", "ible"],
      ["able", ""],
      ["ible", ""],
      ["ically", "ic"],
      ["ally", "al"],
      ["ly", ""],
      ["ical", "ic"],
      ["ial", ""],
      ["al", ""],
      ["ive", ""],
      ["ous", ""],
      ["ious", "y"],
      ["eous", ""],
      ["ary", ""],
      ["ory", ""],
      ["ism", ""],
      ["ship", ""],
      ["hood", ""]
    ];
    for (const [suffix, replacement] of suffixes) {
      if (word.length <= suffix.length + 2 || !word.endsWith(suffix)) continue;
      const stem = word.slice(0, -suffix.length);
      if (stem.length < 4 && !["ity", "ly"].includes(suffix)) continue;
      out.push(stem + replacement);
      out.push(stem);
      if (stem.endsWith("i")) out.push(`${stem.slice(0, -1)}y`);
      out.push(`${stem}e`);
      if (stem.length > 2 && stem.at(-1) === stem.at(-2)) out.push(stem.slice(0, -1));
    }
    for (const suffix of ["er", "or"]) {
      if (word.length <= suffix.length + 3 || !word.endsWith(suffix)) continue;
      const stem = word.slice(0, -suffix.length);
      const variants = [stem, `${stem}e`];
      for (const variant of variants) {
        if (cardWords.has(variant) && looksVerbalBase(variant)) out.push(variant);
      }
    }
    for (const suffix of ["ist", "ian"]) {
      if (word.length <= suffix.length + 4 || !word.endsWith(suffix)) continue;
      const stem = word.slice(0, -suffix.length);
      if (cardWords.has(stem)) out.push(stem);
    }
    const prefixes = ["un", "in", "im", "il", "ir", "non"];
    for (const prefix of prefixes) {
      if (word.startsWith(prefix) && word.length > prefix.length + 2) out.push(word.slice(prefix.length));
    }
    return [...new Set(out.filter((item) => item && item !== word && cardWords.has(item)))];
  }

  indexFamilies();
  let added = 0;
  for (const card of cards) {
    const currentHead = familyByWord.get(card.head);
    if (currentHead && families[currentHead]?.length > 1) continue;
    const candidates = baseCandidates(card.head);
    const existingHead = candidates
      .map((word) => {
        const mapped = familyByWord.get(word);
        return mapped && cardWords.has(mapped) ? mapped : word;
      })
      .find((word) => word !== card.head && cardWords.has(word));
    if (existingHead) {
      addToFamily(existingHead, card.head);
      added += 1;
    }
  }

  for (const card of cards) {
    if (!familyByWord.has(card.head)) {
      families[card.head] = [card.head];
      familyByWord.set(card.head, card.head);
      added += 1;
    }
  }

  for (const [head, words] of Object.entries(families)) {
    families[head] = [...new Set(words.filter((word) => cardWords.has(word)))].sort((a, b) => {
      if (a === head) return -1;
      if (b === head) return 1;
      return a.localeCompare(b);
    });
    if (!families[head].length) delete families[head];
  }

  const finalFamilyByWord = new Set();
  for (const words of Object.values(families)) {
    for (const word of words) finalFamilyByWord.add(word);
  }
  for (const card of cards) {
    if (!finalFamilyByWord.has(card.head)) {
      families[card.head] = [card.head];
      added += 1;
    }
  }
  return added;
}

function closeSafeSingletonFamilies(cards, families) {
  const cardWords = new Set(cards.map((card) => card.head));
  const cardByHead = new Map(cards.map((card) => [card.head, card]));
  const familyByWord = new Map();

  function rebuildIndex() {
    familyByWord.clear();
    for (const [head, words] of Object.entries(families)) {
      for (const word of words) familyByWord.set(word, head);
    }
  }

  function verbal(base) {
    const card = cardByHead.get(base);
    return (card?.senses || []).some((sense) => /\bv\b/.test(clean(sense.pos)));
  }

  function candidates(word) {
    const out = [];
    const suffixes = [
      ["ization", "ize"], ["isation", "ise"], ["ational", "ate"], ["ation", "ate"],
      ["ment", ""], ["ness", ""], ["ity", ""],
      ["ibility", "ible"], ["ability", "able"], ["ably", "able"], ["ibly", "ible"],
      ["able", ""], ["ible", ""],
      ["ically", "ic"], ["ally", "al"], ["ly", ""], ["ical", "ic"],
      ["ism", ""], ["ship", ""], ["hood", ""]
    ];
    for (const [suffix, replacement] of suffixes) {
      if (word.length <= suffix.length + 2 || !word.endsWith(suffix)) continue;
      const stem = word.slice(0, -suffix.length);
      if (stem.length < 4) continue;
      out.push(stem + replacement, stem, `${stem}e`);
      if (stem.endsWith("i")) out.push(`${stem.slice(0, -1)}y`);
      if (stem.length > 2 && stem.at(-1) === stem.at(-2)) out.push(stem.slice(0, -1));
    }
    for (const suffix of ["er", "or"]) {
      if (word.length <= suffix.length + 3 || !word.endsWith(suffix)) continue;
      const stem = word.slice(0, -suffix.length);
      for (const base of [stem, `${stem}e`]) {
        if (cardWords.has(base) && verbal(base)) out.push(base);
      }
    }
    if (word.length > 6 && word.endsWith("ing")) {
      const stem = word.slice(0, -3);
      for (const base of [stem, `${stem}e`]) {
        if (cardWords.has(base) && verbal(base)) out.push(base);
      }
    }
    if (word.length > 5 && word.endsWith("ed")) {
      const stem = word.slice(0, -2);
      for (const base of [stem, `${stem}e`]) {
        if (cardWords.has(base) && verbal(base)) out.push(base);
      }
    }
    for (const suffix of ["ist", "ian"]) {
      if (word.length <= suffix.length + 4 || !word.endsWith(suffix)) continue;
      const stem = word.slice(0, -suffix.length);
      if (cardWords.has(stem)) out.push(stem);
    }
    for (const prefix of ["un", "in", "im", "il", "ir", "non"]) {
      if (word.startsWith(prefix) && word.length > prefix.length + 3) out.push(word.slice(prefix.length));
    }
    return [...new Set(out.filter((item) => item && item !== word && cardWords.has(item)))];
  }

  rebuildIndex();
  let merged = 0;
  for (const word of [...cardWords].sort()) {
    const oldHead = familyByWord.get(word);
    if (!oldHead || families[oldHead]?.length !== 1) continue;
    const base = candidates(word).find((item) => item !== word);
    if (!base) continue;
    const targetHead = familyByWord.get(base) || base;
    if (!targetHead || targetHead === oldHead || !cardWords.has(targetHead)) continue;
    if (!families[targetHead]) families[targetHead] = [targetHead];
    if (!families[targetHead].includes(word)) families[targetHead].push(word);
    delete families[oldHead];
    rebuildIndex();
    merged += 1;
  }
  return merged;
}

function fixKnownBadFamilies(families) {
  function removeWords(head, wordsToRemove) {
    if (!families[head]) return;
    const bad = new Set(wordsToRemove);
    families[head] = families[head].filter((word) => !bad.has(word));
    if (!families[head].length) delete families[head];
  }

  // stat/state/station are kin under "stand", but not one family card.
  removeWords("state", ["static", "statics", "statically", "antistatic"]);
  removeWords("stationwagon", ["station", "stationary", "stationer"]);
  removeWords("disciple", ["discipline", "disciplined", "disciplinary", "disciplinarian"]);
  families.static = [...new Set(["static", "statically", "statics", "antistatic", ...(families.static || [])])];
  families.station = [...new Set(["station", "stationary", "stationer", ...(families.station || [])])];
  families.discipline = [...new Set(["discipline", "disciplined", "disciplinary", "disciplinarian", ...(families.discipline || [])])];

  // Old source had the known bad merge hole/holey/hold. Hold is a separate family.
  removeWords("holey", ["hold", "holding"]);
  families.hold = [...new Set(["hold", "holding", ...(families.hold || [])])];
  removeWords("rich", ["rice", "ricefield", "ricepaddy"]);
  families.rice = [...new Set(["rice", "ricefield", "ricepaddy", ...(families.rice || [])])];
  removeWords("ride", ["ridge", "ridgecrest", "ridgeline", "ridgeway"]);
  families.ridge = [...new Set(["ridge", "ridgecrest", "ridgeline", "ridgeway", ...(families.ridge || [])])];
  removeWords("trade", ["tradition", "traditional", "traditionally"]);
  families.tradition = [...new Set(["tradition", "traditional", "traditionally", ...(families.tradition || [])])];
  removeWords("trait", ["traitor", "traitorous", "traitorousness"]);
  families.traitor = [...new Set(["traitor", "traitorous", "traitorousness", ...(families.traitor || [])])];
  removeWords("written", ["written", "rewritten", "unwritten"]);
  families.write = [...new Set(["write", "writing", "written", "rewritten", "unwritten", ...(families.write || [])])];
  removeWords("rise", ["risk"]);
  families.risk = [...new Set(["risk", ...(families.risk || [])])];
  removeWords("pole", ["policy"]);
  families.policy = [...new Set(["policy", ...(families.policy || [])])];
  removeWords("rest", ["restore"]);
  families.restore = [...new Set(["restore", ...(families.restore || [])])];
  removeWords("claustrophobia", ["clause"]);
  families.clause = [...new Set(["clause", ...(families.clause || [])])];
  removeWords("inhere", ["inherit", "inherits", "inheritable", "inheritance", "inherited", "hereditary", "heritage"]);
  families.inhere = [...new Set(["inhere", "inherence", "inherent", "inherently", ...(families.inhere || [])]
    .filter((word) => !["inherit", "inherits", "inheritable", "inheritance", "inherited", "hereditary", "heritage"].includes(word)))];
  families.inherit = [...new Set(["inherit", "inheritable", "inheritance", "inherited", "hereditary", "heritage", ...(families.inherit || [])]
    .filter((word) => word !== "inherits"))];
  if (families.stricter) {
    families.strict = [...new Set(["strict", ...(families.strict || []), ...families.stricter.filter((word) => word !== "stricter")])];
    delete families.stricter;
  }
  if (families.commercialize) {
    families.commercial = [...new Set(["commercial", ...(families.commercial || []), ...families.commercialize.filter((word) => word !== "commercialize")])];
    delete families.commercialize;
  }
  if (families.localise) {
    families.local = [...new Set(["local", ...(families.local || []), ...families.localise.filter((word) => word !== "localise")])];
    delete families.localise;
  }
  if (families.securitize) {
    families.secure = [...new Set(["secure", ...(families.secure || []), ...families.securitize.filter((word) => word !== "securitize")])];
    delete families.securitize;
  }
  if (families.earlier) {
    families.early = [...new Set(["early", ...(families.early || []), ...families.earlier.filter((word) => word !== "earlier")])];
    delete families.earlier;
  }
  if (families.estimate) {
    families.estimate = [...new Set([
      "estimate",
      ...(families.estimate || []),
      ...(families.overestimate || []),
      ...(families.underestimate || [])
    ])];
    delete families.overestimate;
    delete families.underestimate;
  }
}

function removeDuplicateSingletonFamilies(families) {
  const largerMembership = new Map();
  for (const [head, words] of Object.entries(families)) {
    if (!Array.isArray(words) || words.length <= 1) continue;
    for (const word of words) {
      if (word !== head) largerMembership.set(word, head);
    }
  }
  let removed = 0;
  for (const [head, words] of Object.entries(families)) {
    if (Array.isArray(words) && words.length === 1 && words[0] === head && largerMembership.has(head)) {
      delete families[head];
      removed += 1;
    }
  }
  return removed;
}

function parseKin() {
  const text = fs.readFileSync(KIN_MD, "utf8").replace(/\r\n/g, "\n");
  const clusters = [];
  const rootMeanings = new Map();
  const rootGroups = {};
  let current = null;

  function pushCurrent() {
    if (current && current.items.length) clusters.push(current);
    current = null;
  }

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const title = /^([^|：:]+)\s+([^|：:]+)[：:]$/.exec(line);
    if (title) {
      pushCurrent();
      current = { head: clean(title[1]), meaning: clean(title[2]), items: [] };
      for (const rawRoot of current.head.split(",")) {
        const root = clean(rawRoot).toLowerCase().replace(/\(.+?\)/g, "").trim();
        if (/^[a-z]{2,}$/.test(root)) {
          if (!rootMeanings.has(root)) rootMeanings.set(root, current.meaning);
          rootGroups[root] = { head: current.head, meaning: current.meaning };
        }
      }
      continue;
    }
    if (!current || !line.includes("|")) continue;
    const parts = line.split("|").map(clean);
    const left = parts[0] || "";
    const firstSpace = left.search(/\s/);
    if (firstSpace < 1) continue;
    current.items.push({
      word: left.slice(0, firstSpace).toLowerCase(),
      brief: clean(left.slice(firstSpace + 1)),
      example: parts[1] || "",
      example_zh: parts[2] || ""
    });
  }
  pushCurrent();

  const overIndex = clusters.findIndex((cluster) => cluster.head === "over");
  if (overIndex >= 0) {
    const overCluster = clusters[overIndex];
    const coverWords = new Set(["cover", "discover", "discovery", "recover", "recovery", "uncover"]);
    const coverItems = overCluster.items.filter((item) => coverWords.has(item.word));
    if (coverItems.length) {
      overCluster.items = overCluster.items.filter((item) => !coverWords.has(item.word));
      clusters.splice(overIndex + 1, 0, {
        head: "cover",
        meaning: "覆盖；发现",
        items: coverItems
      });
      rootMeanings.set("cover", "覆盖；发现");
      rootGroups.cover = { head: "cover", meaning: "覆盖；发现" };
    }
  }

  const wordIndex = {};
  for (const cluster of clusters) {
    const seen = new Set();
    cluster.items = cluster.items.filter((item) => {
      if (!item.word || seen.has(item.word)) return false;
      seen.add(item.word);
      return true;
    });
    for (const item of cluster.items) {
      if (!wordIndex[item.word]) wordIndex[item.word] = [];
      const exists = wordIndex[item.word].some((entry) => entry.head === cluster.head && entry.item.word === item.word);
      if (!exists) wordIndex[item.word].push({ head: cluster.head, meaning: cluster.meaning, item });
    }
  }
  const roots = [...rootMeanings.entries()]
    .map(([root, meaning]) => ({ root, meaning }))
    .sort((a, b) => b.root.length - a.root.length || a.root.localeCompare(b.root));
  return { clusters, wordIndex, roots, rootGroups };
}

function cleanKnownBadKinLinks(kin) {
  const bad = {
    character: ["lawyer"],
    compensate: ["company"],
    reward: ["relax"],
    resource: ["relax"],
    profile: ["problem"],
    proficiency: ["problem"],
    register: ["relax"],
    relief: ["recycle"],
    president: ["parent"],
    discreet: ["discuss"],
    gesture: ["culture"],
    sculpture: ["culture"],
    custom: ["lawyer"],
    variable: ["dangerous"],
    commute: ["company"],
    aviation: ["air"],
    editorial: ["doctor"],
    prototype: ["problem"],
    commodity: ["company"],
    ambiguous: ["dangerous"],
    ownership: ["lawyer"],
    homogeneous: ["dangerous"],
    architecture: ["culture"],
    spontaneous: ["dangerous"],
    reciprocal: ["relax"],
    remedy: ["relax"],
    rigorous: ["dangerous"],
    successive: ["doctor"],
    prolong: ["problem"],
    prominent: ["problem"],
    strenuous: ["dangerous"],
    labor: ["doctor"],
    fracture: ["culture"],
    communication: ["company"],
    commercial: ["company"],
    restore: ["recycle"],
    protect: ["problem"],
    failure: ["culture"],
    monitor: ["doctor"],
    reputation: ["recycle"],
    removal: ["relax"],
    revenue: ["relax"],
    recruit: ["recycle"],
    membership: ["lawyer"],
    aisle: ["air"],
    authority: ["doctor"],
    cautious: ["dangerous"],
    disaster: ["dangerous"],
    future: ["culture"]
  };
  let removed = 0;
  for (const [word, heads] of Object.entries(bad)) {
    const entries = kin.wordIndex[word];
    if (!entries) continue;
    const badHeads = new Set(heads);
    const kept = entries.filter((entry) => !badHeads.has(entry.head));
    removed += entries.length - kept.length;
    if (kept.length) kin.wordIndex[word] = kept;
    else delete kin.wordIndex[word];
  }
  return removed;
}

function writeJson(name, data) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), `${JSON.stringify(data, null, 2)}\n`);
}

const families = parseFamilies();
fixKnownBadFamilies(families);
const kin = parseKin();
const knownBadKinLinksRemoved = cleanKnownBadKinLinks(kin);
const legacyKinRoots = parseLegacyKinWordRoots();
const cutRepair = repairCuts(
  removeIncompleteExamples(
    addExtraExamplePatches(addExtraGlossPatches(addExtraCardPatches(fixKnownBadCardContent(mergeRegistryPatchCards(parseOwl())))))
  ),
  families,
  kin.roots,
  kin.wordIndex,
  legacyKinRoots
);
const cards = cutRepair.cards;
const familyCompleted = completeFamilies(cards, families);
const safeSingletonFamiliesClosed = closeSafeSingletonFamilies(cards, families);
const duplicateSingletonRemoved = removeDuplicateSingletonFamilies(families);
const familyMemberCutsImproved = improveFamilyMemberCuts(cards, families);
const finalCutOverridesApplied = applyCutOverrides(cards);
const cutCoverageExactized = exactizeCutLetterCoverage(cards);
const cutCoverageFallbacks = enforceCutLetterCoverage(cards);
applyFinalEntryCardFixes(cards);
families.precarious = ["precarious", "precariously", "precariousness"];
families.corrupt = ["corrupt", "corruption", "corruptible", "incorruptible"];

function applyFinalEntryCardFixes(cards) {
  const replace = (head, patch) => {
    const card = cards.find((item) => item.head === head);
    if (!card) {
      cards.push({ head, ...patch });
      return;
    }
    Object.assign(card, patch);
  };
  const stackPatch = (head, patch) => {
    const card = cards.find((item) => item.head === head);
    if (!card) {
      cards.push({ head, ...patch });
      return;
    }
    const oldSenses = card.senses || [];
    Object.assign(card, patch);
    const newSenses = card.senses || [];
    for (let i = 0; i < oldSenses.length; i += 1) {
      const oldSense = oldSenses[i] || {};
      const target = newSenses[i] || newSenses[0];
      if (!target) continue;
      target.examples = target.examples || [];
      target.phrases = target.phrases || [];
      for (const example of oldSense.examples || []) {
        if (example?.en && example?.zh && !target.examples.some((item) => item.en === example.en)) {
          target.examples.push(example);
        }
      }
      for (const phrase of oldSense.phrases || []) {
        if (phrase?.en && phrase?.zh && !target.phrases.some((item) => item.en === phrase.en)) {
          target.phrases.push(phrase);
        }
      }
    }
  };
  replace("president", {
    head: "president",
    cut: "pre/sid/ent",
    cutMeaning: "在前；预先/坐；主持/人；形容词",
    senses: [
      {
        index: "1",
        pos: "n.",
        zh: "总统；主席",
        gloss: "head of state, chair",
        examples: [
          {
            en: "The president announced an emergency plan after the flood damaged major roads.",
            zh: "洪水破坏主要道路后，总统宣布了一项紧急计划。"
          }
        ],
        phrases: [
          { en: "elected president", zh: "当选总统" },
          { en: "student president", zh: "学生会主席" }
        ]
      },
      {
        index: "2",
        pos: "n.",
        zh: "大学校长；公司总裁",
        gloss: "university or company head",
        examples: [
          {
            en: "The university president approved a new scholarship for medical students.",
            zh: "大学校长批准了一项面向医学生的新奖学金。"
          }
        ],
        phrases: [
          { en: "university president", zh: "大学校长" },
          { en: "company president", zh: "公司总裁" }
        ]
      }
    ]
  });
  replace("application", {
    head: "application",
    cut: "ap/plic/ation",
    cutMeaning: "向；加强/折叠；放上/名词",
    senses: [
      {
        index: "1",
        pos: "n.",
        zh: "申请；申请书",
        gloss: "request, form",
        examples: [
          {
            en: "Her application for the scholarship included a recommendation from her supervisor.",
            zh: "她的奖学金申请包括导师的一封推荐信。"
          }
        ],
        phrases: [
          { en: "job application", zh: "求职申请" },
          { en: "application form", zh: "申请表" }
        ]
      },
      {
        index: "2",
        pos: "n.",
        zh: "应用；运用",
        gloss: "use, practical use",
        examples: [
          {
            en: "The practical application of the theory changed how doctors treated pain.",
            zh: "这一理论的实际应用改变了医生治疗疼痛的方式。"
          }
        ],
        phrases: [
          { en: "practical application", zh: "实际应用" },
          { en: "mobile application", zh: "手机应用程序" }
        ]
      },
      {
        index: "3",
        pos: "n.",
        zh: "施用；涂抹",
        gloss: "putting on, applying",
        examples: [
          {
            en: "The application of oil keeps the wooden surface from drying out.",
            zh: "涂油可以防止木质表面变干。"
          }
        ],
        phrases: [
          { en: "application of medicine", zh: "药物施用" }
        ]
      }
    ]
  });
  const finalEntryPatches = {
    observe: {
      cut: "ob/serv/e",
      cutMeaning: "对着；仔细/保持；注意/动词",
      senses: [
        {
          index: "1",
          pos: "v.",
          zh: "观察；注意到",
          gloss: "watch, notice",
          examples: [
            {
              en: "Teachers can observe behaviour to identify students who need extra support early.",
              zh: "教师可以观察行为，尽早识别需要额外支持的学生。"
            }
          ],
          phrases: [
            { en: "observe behaviour", zh: "观察行为" },
            { en: "observe a pattern", zh: "观察到一种模式" }
          ]
        },
        {
          index: "2",
          pos: "v.",
          zh: "遵守；奉行",
          gloss: "follow, obey",
          examples: [
            {
              en: "Visitors must observe the safety rules inside the laboratory.",
              zh: "访客必须遵守实验室内的安全规则。"
            }
          ],
          phrases: [
            { en: "observe rules", zh: "遵守规则" },
            { en: "observe a tradition", zh: "遵循传统" }
          ]
        }
      ]
    },
    fabric: {
      cut: "fabric",
      cutMeaning: "织物；结构",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "布；织物",
          gloss: "cloth, textile",
          examples: [
            {
              en: "The sanitary fabric dried quickly after being washed.",
              zh: "这种卫生织物清洗后很快变干。"
            }
          ],
          phrases: [
            { en: "cotton fabric", zh: "棉布" },
            { en: "sanitary fabric", zh: "卫生织物" }
          ]
        },
        {
          index: "2",
          pos: "n.",
          zh: "结构；组织",
          gloss: "structure, framework",
          examples: [
            {
              en: "When trust breaks down, the social fabric of a community weakens.",
              zh: "当信任瓦解时，一个社区的社会结构就会变弱。"
            }
          ],
          phrases: [
            { en: "social fabric", zh: "社会结构" }
          ]
        }
      ]
    },
    counter: {
      cut: "counter",
      cutMeaning: "相反；柜台；计数器",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "柜台",
          gloss: "service desk",
          examples: [
            {
              en: "Medicine was kept behind the pharmacy counter.",
              zh: "药品放在药房柜台后面。"
            }
          ],
          phrases: [
            { en: "pharmacy counter", zh: "药房柜台" }
          ]
        },
        {
          index: "2",
          pos: "n.",
          zh: "计数器",
          gloss: "counting device",
          examples: [
            {
              en: "The counter recorded every visitor entering the museum.",
              zh: "计数器记录每位进入博物馆的访客。"
            }
          ],
          phrases: [
            { en: "digital counter", zh: "数字计数器" }
          ]
        },
        {
          index: "3",
          pos: "adj./adv.",
          zh: "相反的；相反地",
          gloss: "opposite, against",
          examples: [
            {
              en: "The evidence runs counter to the official explanation.",
              zh: "证据与官方解释相反。"
            }
          ],
          phrases: [
            { en: "run counter to", zh: "与...相反" }
          ]
        },
        {
          index: "4",
          pos: "v.",
          zh: "反驳；反击",
          gloss: "oppose, respond against",
          examples: [
            {
              en: "The lawyer countered the accusation with new documents.",
              zh: "律师用新文件反击指控。"
            }
          ],
          phrases: [
            { en: "counter an argument", zh: "反驳论点" }
          ]
        }
      ]
    },
    protect: {
      cut: "pro/tect",
      cutMeaning: "向前；支持/覆盖；保护",
      senses: [{
        index: "1",
        pos: "v.",
        zh: "保护；防护",
        gloss: "defend, keep safe",
        examples: [
          {
            en: "Wetlands protect coastal towns by absorbing storm water.",
            zh: "湿地通过吸收风暴水保护沿海城镇。"
          }
        ],
        phrases: [
          { en: "protect privacy", zh: "保护隐私" },
          { en: "protect a surface", zh: "保护表面" }
        ]
      }]
    },
    social: {
      cut: "soc/ial",
      cutMeaning: "同伴；社会/形容词",
      senses: [{
        index: "1",
        pos: "adj.",
        zh: "社会的；社交的",
        gloss: "relating to society",
        examples: [
          {
            en: "Social pressure can change behaviour without changing belief.",
            zh: "社会压力可以改变行为，而不改变信念。"
          }
        ],
        phrases: [
          { en: "social practice", zh: "社会实践" },
          { en: "social contact", zh: "社交接触" }
        ]
      }]
    },
    confidence: {
      cut: "con/fid/ence",
      cutMeaning: "共同；加强/相信/名词",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "信心；自信",
          gloss: "belief in oneself",
          examples: [
            {
              en: "Clear feedback can build students' confidence before a difficult exam.",
              zh: "清晰反馈可以在困难考试前增强学生的信心。"
            }
          ],
          phrases: [
            { en: "gain confidence", zh: "获得信心" },
            { en: "self-confidence", zh: "自信" }
          ]
        },
        {
          index: "2",
          pos: "n.",
          zh: "信任；信赖",
          gloss: "trust",
          examples: [
            {
              en: "Public confidence in the hospital improved after the errors were reported openly.",
              zh: "错误被公开报告后，公众对医院的信任提高了。"
            }
          ],
          phrases: [
            { en: "public confidence", zh: "公众信任" },
            { en: "confidence in government", zh: "对政府的信任" }
          ]
        },
        {
          index: "3",
          pos: "n.",
          zh: "置信；可靠程度",
          gloss: "statistical certainty",
          examples: [
            {
              en: "A wider sample gives researchers greater confidence in the result.",
              zh: "更大的样本使研究人员对结果更有把握。"
            }
          ],
          phrases: [
            { en: "confidence interval", zh: "置信区间" }
          ]
        }
      ]
    },
    trial: {
      cut: "tri/al",
      cutMeaning: "审讯；测试/名词；形容词",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "审判；审讯",
          gloss: "court hearing",
          examples: [
            {
              en: "The trial attracted public attention because the evidence was unusual.",
              zh: "这场审判因证据异常而引起公众关注。"
            }
          ],
          phrases: [
            { en: "criminal trial", zh: "刑事审判" }
          ]
        },
        {
          index: "2",
          pos: "n.",
          zh: "试验；试用；考验",
          gloss: "test, experiment",
          examples: [
            {
              en: "A clinical trial must test whether a treatment is both safe and effective.",
              zh: "临床试验必须检验一种治疗是否安全且有效。"
            }
          ],
          phrases: [
            { en: "clinical trial", zh: "临床试验" },
            { en: "trial period", zh: "试用期" }
          ]
        }
      ]
    },
    phase: {
      cut: "phase",
      cutMeaning: "阶段；相位",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "阶段；时期",
          gloss: "stage, period",
          examples: [
            {
              en: "The initial phase of reform should focus on testing and public feedback.",
              zh: "改革初始阶段应聚焦测试和公众反馈。"
            }
          ],
          phrases: [
            { en: "initial phase", zh: "初始阶段" }
          ]
        },
        {
          index: "2",
          pos: "n.",
          zh: "相位；相",
          gloss: "cyclic form or state",
          examples: [
            {
              en: "The moon's phase changes as its position around Earth changes.",
              zh: "月球绕地球的位置变化时，月相也会变化。"
            }
          ],
          phrases: [
            { en: "moon phase", zh: "月相" }
          ]
        }
      ]
    },
    monitor: {
      cut: "monit/or",
      cutMeaning: "提醒；监视/人；物",
      senses: [
        {
          index: "1",
          pos: "v.",
          zh: "监测；监控",
          gloss: "watch, track",
          examples: [
            {
              en: "Satellites can monitor climate change across remote polar regions.",
              zh: "卫星可以监测偏远极地地区的气候变化。"
            }
          ],
          phrases: [
            { en: "monitor progress", zh: "监测进展" },
            { en: "monitor behaviour", zh: "监控行为" }
          ]
        },
        {
          index: "2",
          pos: "n.",
          zh: "显示器；监测器",
          gloss: "screen, tracking device",
          examples: [
            {
              en: "The heart monitor showed a sudden change in the patient's rhythm.",
              zh: "心脏监测器显示病人的心律突然变化。"
            }
          ],
          phrases: [
            { en: "computer monitor", zh: "电脑显示器" },
            { en: "heart monitor", zh: "心脏监测器" }
          ]
        }
      ]
    },
    withdraw: {
      cut: "with/draw",
      cutMeaning: "向后/拉",
      senses: [
        {
          index: "1",
          pos: "v.",
          zh: "撤回；撤销",
          gloss: "take back, remove",
          examples: [
            {
              en: "Investors may withdraw support when political risks become too high.",
              zh: "当政治风险变得过高时，投资者可能撤回支持。"
            }
          ],
          phrases: [
            { en: "withdraw support", zh: "撤回支持" },
            { en: "withdraw an application", zh: "撤回申请" }
          ]
        },
        {
          index: "2",
          pos: "v.",
          zh: "退出；离开",
          gloss: "leave, pull out",
          examples: [
            {
              en: "Patients could withdraw from the trial at any time.",
              zh: "病人可以随时退出试验。"
            }
          ],
          phrases: [
            { en: "withdraw from a trial", zh: "退出试验" }
          ]
        },
        {
          index: "3",
          pos: "v.",
          zh: "取出；提取",
          gloss: "take out",
          examples: [
            {
              en: "She withdrew cash before travelling to the rural clinic.",
              zh: "她去乡村诊所前取了现金。"
            }
          ],
          phrases: [
            { en: "withdraw money", zh: "取钱" }
          ]
        }
      ]
    }
  };
  for (const [head, patch] of Object.entries(finalEntryPatches)) replace(head, { head, ...patch });
  const finalEntryPatchesTwo = {
    procedure: {
      cut: "pro/ced/ure",
      cutMeaning: "向前；支持/行走；前进/名词",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "程序；步骤",
          gloss: "process, steps",
          examples: [
            {
              en: "A clear procedure prevents confusion during an evacuation.",
              zh: "清晰程序能防止疏散时出现混乱。"
            }
          ],
          phrases: [
            { en: "safety procedure", zh: "安全程序" },
            { en: "standard procedure", zh: "标准程序" }
          ]
        },
        {
          index: "2",
          pos: "n.",
          zh: "手续；方法",
          gloss: "formal method",
          examples: [
            {
              en: "The visa procedure requires proof of study and financial support.",
              zh: "签证手续要求提供学习和经济支持证明。"
            }
          ],
          phrases: [
            { en: "legal procedure", zh: "法律程序" }
          ]
        }
      ]
    },
    faculty: {
      cut: "faculty",
      cutMeaning: "能力；全体教职员工",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "全体教职员工；院系",
          gloss: "teaching staff, department",
          examples: [
            {
              en: "The faculty voted to change the examination rules.",
              zh: "全体教职员工投票修改考试规则。"
            }
          ],
          phrases: [
            { en: "faculty meeting", zh: "教职员工会议" },
            { en: "medical faculty", zh: "医学院系" }
          ]
        },
        {
          index: "2",
          pos: "n.",
          zh: "能力；官能",
          gloss: "ability, capacity",
          examples: [
            {
              en: "Memory is a faculty that improves with practice.",
              zh: "记忆是一种能通过练习提高的能力。"
            }
          ],
          phrases: [
            { en: "mental faculty", zh: "心智能力" }
          ]
        }
      ]
    },
    address: {
      cut: "ad/dress",
      cutMeaning: "向；加强/整理；说话",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "地址",
          gloss: "location for mail",
          examples: [
            {
              en: "The package was returned because the address was wrong.",
              zh: "包裹因地址错误被退回。"
            }
          ],
          phrases: [
            { en: "home address", zh: "家庭住址" }
          ]
        },
        {
          index: "2",
          pos: "n.",
          zh: "讲话；演说",
          gloss: "formal speech",
          examples: [
            {
              en: "The president's address focused on public health.",
              zh: "总统讲话集中于公共卫生。"
            }
          ],
          phrases: [
            { en: "public address", zh: "公开讲话" }
          ]
        },
        {
          index: "3",
          pos: "v.",
          zh: "处理；应对",
          gloss: "deal with",
          examples: [
            {
              en: "The policy must address the causes of debt, not only the symptoms.",
              zh: "这项政策必须处理债务的原因，而不只是处理表面症状。"
            }
          ],
          phrases: [
            { en: "address a problem", zh: "处理问题" }
          ]
        },
        {
          index: "4",
          pos: "v.",
          zh: "向...讲话；写地址",
          gloss: "speak to, write an address",
          examples: [
            {
              en: "The mayor addressed the crowd after the flood.",
              zh: "洪水后，市长向人群讲话。"
            }
          ],
          phrases: [
            { en: "address the audience", zh: "向观众讲话" },
            { en: "address an envelope", zh: "在信封上写地址" }
          ]
        }
      ]
    },
    assess: {
      cut: "as/sess",
      cutMeaning: "朝向；加强/坐；评估",
      senses: [{
        index: "1",
        pos: "v.",
        zh: "评估；估算",
        gloss: "evaluate, estimate",
        examples: [
          {
            en: "Authorities should assess environmental impact before approving new roads.",
            zh: "当局在批准新道路前应评估环境影响。"
          }
        ],
        phrases: [
          { en: "assess risk", zh: "评估风险" },
          { en: "assess environmental impact", zh: "评估环境影响" }
        ]
      }]
    },
    framework: {
      cut: "frame/work",
      cutMeaning: "框架/工作",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "框架；构架",
          gloss: "structure, system",
          examples: [
            {
              en: "A safety framework must define who is responsible when machines injure workers.",
              zh: "安全框架必须规定机器伤害工人时谁负责。"
            }
          ],
          phrases: [
            { en: "safety framework", zh: "安全框架" },
            { en: "legal framework", zh: "法律框架" }
          ]
        },
        {
          index: "2",
          pos: "n.",
          zh: "原则体系；思想框架",
          gloss: "set of principles",
          examples: [
            {
              en: "The ethical framework guided doctors when evidence was uncertain.",
              zh: "证据不确定时，伦理框架指导医生作出决定。"
            }
          ],
          phrases: [
            { en: "ethical framework", zh: "伦理框架" }
          ]
        }
      ]
    },
    mercy: {
      cut: "mercy",
      cutMeaning: "仁慈；宽恕",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "仁慈；怜悯",
          gloss: "compassion",
          examples: [
            {
              en: "Mercy toward the injured shaped the nurse's work.",
              zh: "对伤者的仁慈塑造了护士的工作。"
            }
          ],
          phrases: [
            { en: "show mercy", zh: "表现仁慈" }
          ]
        },
        {
          index: "2",
          pos: "n.",
          zh: "宽恕；从轻处理",
          gloss: "forgiveness, leniency",
          examples: [
            {
              en: "The judge showed mercy to the young offender.",
              zh: "法官宽恕了年轻违法者。"
            }
          ],
          phrases: [
            { en: "ask for mercy", zh: "请求宽恕" }
          ]
        }
      ]
    },
    limitation: {
      cut: "limit/ation",
      cutMeaning: "限制/名词",
      senses: [{
        index: "1",
        pos: "n.",
        zh: "限制；局限性",
        gloss: "restriction, weakness",
        examples: [
          {
            en: "The main limitation of the framework was its dependence on precise data.",
            zh: "这个框架的主要限制是它依赖精确数据。"
          }
        ],
        phrases: [
          { en: "main limitation", zh: "主要局限" },
          { en: "legal limitation", zh: "法律限制" }
        ]
      }]
    },
    objective: {
      cut: "ob/ject/ive",
      cutMeaning: "在前；对着/投掷；目标/形容词；名词",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "目标；目的",
          gloss: "aim, target",
          examples: [
            {
              en: "The main objective of the survey was to identify unsafe routes.",
              zh: "这项调查的主要目标是找出不安全路线。"
            }
          ],
          phrases: [
            { en: "strategic objective", zh: "战略目标" }
          ]
        },
        {
          index: "2",
          pos: "adj.",
          zh: "客观的",
          gloss: "impartial, fact-based",
          examples: [
            {
              en: "Objective evidence helps citizens judge whether a costly project is worthwhile.",
              zh: "客观证据帮助市民判断昂贵项目是否值得。"
            }
          ],
          phrases: [
            { en: "objective evidence", zh: "客观证据" }
          ]
        }
      ]
    },
    process: {
      cut: "pro/cess",
      cutMeaning: "向前/走；行进",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "过程；进程",
          gloss: "series of steps",
          examples: [
            {
              en: "The healing process can continue after pain has disappeared.",
              zh: "疼痛消失后，愈合过程仍可能继续。"
            }
          ],
          phrases: [
            { en: "decision-making process", zh: "决策过程" }
          ]
        },
        {
          index: "2",
          pos: "n.",
          zh: "程序；手续",
          gloss: "procedure",
          examples: [
            {
              en: "The application process takes longer when documents are missing.",
              zh: "文件缺失时，申请程序会花更久。"
            }
          ],
          phrases: [
            { en: "application process", zh: "申请流程" }
          ]
        },
        {
          index: "3",
          pos: "v.",
          zh: "处理；加工",
          gloss: "handle, treat",
          examples: [
            {
              en: "The factory processes waste water before releasing it into the river.",
              zh: "工厂在把废水排入河流前先进行处理。"
            }
          ],
          phrases: [
            { en: "process data", zh: "处理数据" }
          ]
        }
      ]
    },
    operational: {
      cut: "oper/at/ion/al",
      cutMeaning: "工作；操作/动词/名词/形容词",
      senses: [{
        index: "1",
        pos: "adj.",
        zh: "运作的；可操作的",
        gloss: "working, ready for use",
        examples: [
          {
            en: "The auction system became operational after the supervisor verified every version.",
            zh: "主管核实每个版本后，拍卖系统开始运行。"
          }
        ],
        phrases: [
          { en: "operational cost", zh: "运营成本" },
          { en: "fully operational", zh: "完全可运行的" }
        ]
      }]
    },
    signature: {
      cut: "sign/ature",
      cutMeaning: "标记；签署/名词",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "签名",
          gloss: "written name",
          examples: [
            {
              en: "A digital signature can verify identity in online public services.",
              zh: "数字签名可以在线上公共服务中验证身份。"
            }
          ],
          phrases: [
            { en: "digital signature", zh: "数字签名" }
          ]
        },
        {
          index: "2",
          pos: "n.",
          zh: "特征；标志",
          gloss: "distinctive feature",
          examples: [
            {
              en: "The pattern became a signature of the artist's later work.",
              zh: "这种图案成了这位艺术家后期作品的标志性特征。"
            }
          ],
          phrases: [
            { en: "signature style", zh: "标志性风格" }
          ]
        }
      ]
    }
  };
  for (const [head, patch] of Object.entries(finalEntryPatchesTwo)) replace(head, { head, ...patch });
  const chapterZeroExamPatches = {
    restraint: {
      cut: "re/strain/t",
      cutMeaning: "回；反复/拉紧；约束/名词",
      senses: [{
        index: "1",
        pos: "n.",
        zh: "克制；约束；限制",
        gloss: "control, restriction",
        examples: [{
          en: "Legal restraint prevents emergency powers from becoming a permanent habit.",
          zh: "法律约束能防止紧急权力变成永久习惯。"
        }],
        phrases: [
          { en: "show restraint", zh: "表现克制" },
          { en: "restraint on power", zh: "对权力的限制" }
        ]
      }]
    },
    discipline: {
      cut: "disciplin/e",
      cutMeaning: "学习；训练；纪律/词尾",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "自律；纪律",
          gloss: "self-control, order",
          examples: [{
            en: "Discipline helps a rescue team follow protocol when the situation becomes chaotic.",
            zh: "局面混乱时，纪律能帮助救援队遵守流程。"
          }],
          phrases: [
            { en: "self-discipline", zh: "自律" },
            { en: "strict discipline", zh: "严格纪律" }
          ]
        },
        {
          index: "2",
          pos: "n.",
          zh: "学科；专业领域",
          gloss: "academic field, subject",
          examples: [{
            en: "Neurology became a discipline because doctors needed shared methods to study the nervous system.",
            zh: "神经学成为一门学科，是因为医生需要共同方法来研究神经系统。"
          }],
          phrases: [{ en: "academic discipline", zh: "学科" }]
        }
      ]
    },
    structural: {
      cut: "struct/ur/al",
      cutMeaning: "建造；结构/名词/形容词",
      senses: [{
        index: "1",
        pos: "adj.",
        zh: "结构性的；结构上的",
        gloss: "structure-related, systemic",
        examples: [{
          en: "Structural weakness in the bridge made the route unsafe after heavy rain.",
          zh: "桥梁的结构性弱点使这条路线在暴雨后变得不安全。"
        }],
        phrases: [
          { en: "structural damage", zh: "结构性损坏" },
          { en: "structural problem", zh: "结构性问题" }
        ]
      }]
    },
    requirement: {
      cut: "re/quir/e/ment",
      cutMeaning: "反复；回/寻求；要求/动词/名词",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "要求；规定",
          gloss: "rule, demand",
          examples: [{
            en: "The payment receipt was a requirement before students could access the laboratory.",
            zh: "学生进入实验室前，付款收据是一项要求。"
          }],
          phrases: [{ en: "legal requirement", zh: "法律要求" }]
        },
        {
          index: "2",
          pos: "n.",
          zh: "必要条件；所需之物",
          gloss: "need, condition",
          examples: [{
            en: "Reliable evidence is a basic requirement for a fair assessment.",
            zh: "可靠证据是公正评估的基本必要条件。"
          }],
          phrases: [{ en: "basic requirement", zh: "基本必要条件" }]
        }
      ]
    },
    access: {
      cut: "ac/cess",
      cutMeaning: "向；加强/走；进入",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "进入权；使用权",
          gloss: "right to enter or use",
          examples: [{
            en: "Emergency workers need access to the inventory before they can dispatch supplies.",
            zh: "应急人员需要清单访问权，才能调派物资。"
          }],
          phrases: [{ en: "access to records", zh: "查阅记录的权限" }]
        },
        {
          index: "2",
          pos: "n.",
          zh: "通道；入口",
          gloss: "entry, route",
          examples: [{
            en: "Flood water blocked access to the clinic for two days.",
            zh: "洪水阻断了通往诊所的通道两天。"
          }],
          phrases: [{ en: "road access", zh: "道路通道" }]
        },
        {
          index: "3",
          pos: "v.",
          zh: "访问；获取",
          gloss: "reach, obtain",
          examples: [{
            en: "Only verified staff can access the payment system.",
            zh: "只有经过核验的工作人员才能访问支付系统。"
          }],
          phrases: [{ en: "access a database", zh: "访问数据库" }]
        }
      ]
    },
    demonstrate: {
      cut: "de/monstr/ate",
      cutMeaning: "加强/显示；指明/动词",
      senses: [
        {
          index: "1",
          pos: "v.",
          zh: "证明；表明",
          gloss: "show, prove",
          examples: [{
            en: "The audit demonstrated that several payments had never reached the supplier.",
            zh: "审计证明有几笔付款从未到达供应商。"
          }],
          phrases: [{ en: "demonstrate accuracy", zh: "证明准确性" }]
        },
        {
          index: "2",
          pos: "v.",
          zh: "展示；演示",
          gloss: "display, illustrate",
          examples: [{
            en: "The instructor demonstrated how to verify a signature before accepting a transfer.",
            zh: "讲师演示了在接受转账前如何核验签名。"
          }],
          phrases: [{ en: "demonstrate a procedure", zh: "演示流程" }]
        }
      ]
    },
    consistency: {
      cut: "con/sist/ency",
      cutMeaning: "共同；加强/站立；保持一致/名词",
      senses: [{
        index: "1",
        pos: "n.",
        zh: "一致性；连贯性",
        gloss: "agreement, coherence",
        examples: [{
          en: "Consistency in the records helped investigators recover the missing payment quickly.",
          zh: "记录的一致性帮助调查人员迅速找回丢失的付款。"
        }],
        phrases: [
          { en: "logical consistency", zh: "逻辑一致性" },
          { en: "policy consistency", zh: "政策一致性" }
        ]
      }]
    },
    allocate: {
      cut: "al/loc/ate",
      cutMeaning: "向；加强/放置；位置/动词",
      senses: [{
        index: "1",
        pos: "v.",
        zh: "分配；拨给",
        gloss: "assign, distribute",
        examples: [{
          en: "The council must allocate emergency funds before the road can be repaired.",
          zh: "委员会必须先分配应急资金，道路才能修复。"
        }],
        phrases: [
          { en: "allocate resources", zh: "分配资源" },
          { en: "allocate funding", zh: "拨给资金" }
        ]
      }]
    },
    institution: {
      cut: "in/stitut/ion",
      cutMeaning: "进入；使成/放置；建立/名词",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "机构；组织",
          gloss: "organization, body",
          examples: [{
            en: "A trusted institution can coordinate recovery when many agencies hold different pieces of evidence.",
            zh: "当多个机构掌握不同证据时，可信机构可以协调恢复工作。"
          }],
          phrases: [{ en: "public institution", zh: "公共机构" }]
        },
        {
          index: "2",
          pos: "n.",
          zh: "制度；惯例",
          gloss: "system, established practice",
          examples: [{
            en: "The institution of public review makes hidden clauses harder to preserve.",
            zh: "公开审查制度使隐藏条款更难被保留下来。"
          }],
          phrases: [{ en: "legal institution", zh: "法律制度" }]
        }
      ]
    },
    framework: {
      cut: "frame/work",
      cutMeaning: "框架/工作；体系",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "框架；构架",
          gloss: "structure, system",
          examples: [{
            en: "The new framework explains how evidence, consent, and jurisdiction should interact.",
            zh: "新框架解释了证据、同意和管辖权应如何相互作用。"
          }],
          phrases: [{ en: "legal framework", zh: "法律框架" }]
        },
        {
          index: "2",
          pos: "n.",
          zh: "原则体系；思维框架",
          gloss: "set of principles",
          examples: [{
            en: "An ethical framework helps officials act when every option has a cost.",
            zh: "当每个选项都有代价时，伦理框架能帮助官员行动。"
          }],
          phrases: [{ en: "ethical framework", zh: "伦理框架" }]
        }
      ]
    },
    assessment: {
      cut: "as/sess/ment",
      cutMeaning: "向；加强/坐；评估/名词",
      senses: [{
        index: "1",
        pos: "n.",
        zh: "评估；评价",
        gloss: "evaluation, judgment",
        examples: [{
          en: "The assessment compared accuracy with speed before changing the dispatch protocol.",
          zh: "这项评估在改变调度流程前比较了准确性和速度。"
        }],
        phrases: [
          { en: "risk assessment", zh: "风险评估" },
          { en: "formal assessment", zh: "正式评估" }
        ]
      }]
    },
    precision: {
      cut: "pre/cis/ion",
      cutMeaning: "向前；预先/切；决定/名词",
      senses: [{
        index: "1",
        pos: "n.",
        zh: "精确；精度",
        gloss: "exactness, accuracy",
        examples: [{
          en: "Precision matters when a single digit can send a payment to the wrong account.",
          zh: "当一个数字就可能把付款转到错误账户时，精确性很重要。"
        }],
        phrases: [
          { en: "high precision", zh: "高精度" },
          { en: "measurement precision", zh: "测量精度" }
        ]
      }]
    },
    accuracy: {
      cut: "ac/cur/acy",
      cutMeaning: "向；加强/关心；注意/名词",
      senses: [{
        index: "1",
        pos: "n.",
        zh: "准确性；正确性",
        gloss: "correctness, exactness",
        examples: [{
          en: "The accuracy of the inventory determined whether the team could find the missing medicine.",
          zh: "清单的准确性决定了团队能否找到丢失的药品。"
        }],
        phrases: [
          { en: "data accuracy", zh: "数据准确性" },
          { en: "improve accuracy", zh: "提高准确性" }
        ]
      }]
    },
    selective: {
      cut: "se/lect/ive",
      cutMeaning: "分开/选择；收集/形容词",
      senses: [{
        index: "1",
        pos: "adj.",
        zh: "有选择性的；选择性的",
        gloss: "choosy, discriminating",
        examples: [{
          en: "Selective access to evidence can make a public assessment appear neutral when it is not.",
          zh: "对证据的选择性开放会让公共评估看起来中立，尽管事实并非如此。"
        }],
        phrases: [
          { en: "selective access", zh: "选择性访问" },
          { en: "selective attention", zh: "选择性注意" }
        ]
      }]
    },
    neutral: {
      cut: "neutr/al",
      cutMeaning: "中性；不偏/形容词",
      senses: [
        {
          index: "1",
          pos: "adj.",
          zh: "中立的；不偏不倚的",
          gloss: "impartial, unbiased",
          examples: [{
            en: "A neutral reviewer should examine the clause without protecting either side.",
            zh: "中立审查者应审查条款，而不保护任何一方。"
          }],
          phrases: [{ en: "neutral position", zh: "中立立场" }]
        },
        {
          index: "2",
          pos: "adj.",
          zh: "中性的；无明显特征的",
          gloss: "neither one nor the other",
          examples: [{
            en: "The report used neutral language so readers could focus on the evidence.",
            zh: "报告使用中性语言，让读者能专注于证据。"
          }],
          phrases: [{ en: "neutral language", zh: "中性语言" }]
        }
      ]
    },
    precarious: {
      phonetic: "prɪˈkeriəs",
      cut: "precari/ous",
      cutMeaning: "不稳定；依赖他人恩准/形容词",
      senses: [{
        index: "1",
        pos: "adj.",
        zh: "不稳定的；危险的",
        gloss: "unstable, insecure",
        examples: [{
          en: "The family's recovery remained precarious because one unpaid debt could cancel months of progress.",
          zh: "这个家庭的恢复仍不稳定，因为一笔未付债务就可能抵消数月进展。"
        }],
        phrases: [
          { en: "precarious position", zh: "不稳定处境" },
          { en: "precarious balance", zh: "脆弱平衡" }
        ]
      }]
    },
    precariously: {
      cut: "precari/ous/ly",
      cutMeaning: "不稳定；依赖他人恩准/形容词/副词",
      senses: [{
        index: "1",
        pos: "adv.",
        zh: "不稳定地；危险地",
        gloss: "insecurely, dangerously",
        examples: [{
          en: "The old shelf leaned precariously above the medicine cabinet.",
          zh: "旧架子危险地倾斜在药柜上方。"
        }],
        phrases: [{ en: "hang precariously", zh: "危险地悬着" }]
      }]
    },
    precariousness: {
      cut: "precari/ous/ness",
      cutMeaning: "不稳定；依赖他人恩准/形容词/名词",
      senses: [{
        index: "1",
        pos: "n.",
        zh: "不稳定；危险状态",
        gloss: "insecurity, instability",
        examples: [{
          en: "The precariousness of the route made emergency delivery difficult.",
          zh: "路线的不稳定使应急递送变得困难。"
        }],
        phrases: [{ en: "economic precariousness", zh: "经济不稳定" }]
      }]
    },
    theoretical: {
      cut: "theor/et/ical",
      cutMeaning: "看；理论/名词连接/形容词",
      senses: [{
        index: "1",
        pos: "adj.",
        zh: "理论上的；理论性的",
        gloss: "abstract, conceptual",
        examples: [{
          en: "A theoretical model is useful only if it can explain the evidence in a real case.",
          zh: "理论模型只有在能解释真实案例中的证据时才有用。"
        }],
        phrases: [
          { en: "theoretical framework", zh: "理论框架" },
          { en: "theoretical explanation", zh: "理论解释" }
        ]
      }]
    },
    circumstance: {
      cut: "circum/stance",
      cutMeaning: "周围/站立；处境",
      senses: [{
        index: "1",
        pos: "n.",
        zh: "情况；境况；环境",
        gloss: "situation, condition",
        examples: [{
          en: "Under the circumstance, the officer had discretion to delay the transfer.",
          zh: "在这种情况下，官员有权酌情推迟转交。"
        }],
        phrases: [
          { en: "under the circumstances", zh: "在这种情况下" },
          { en: "special circumstance", zh: "特殊情况" }
        ]
      }]
    },
    ambiguity: {
      cut: "ambi/gu/ity",
      cutMeaning: "两边；双重/引导；不确定/名词",
      senses: [{
        index: "1",
        pos: "n.",
        zh: "模糊性；歧义",
        gloss: "uncertainty, double meaning",
        examples: [{
          en: "Ambiguity in the clause allowed both sides to claim they had followed the protocol.",
          zh: "条款中的歧义让双方都声称自己遵守了流程。"
        }],
        phrases: [
          { en: "legal ambiguity", zh: "法律歧义" },
          { en: "reduce ambiguity", zh: "减少模糊性" }
        ]
      }]
    },
    discretion: {
      cut: "dis/cret/ion",
      cutMeaning: "分开/辨别；判断/名词",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "谨慎；慎重",
          gloss: "carefulness, prudence",
          examples: [{
            en: "Discretion is necessary when a report contains private medical evidence.",
            zh: "当报告包含私人医疗证据时，谨慎是必要的。"
          }],
          phrases: [{ en: "use discretion", zh: "谨慎行事" }]
        },
        {
          index: "2",
          pos: "n.",
          zh: "自行决定权；酌处权",
          gloss: "freedom to decide",
          examples: [{
            en: "The protocol gave officers discretion to arrange delivery during an emergency.",
            zh: "该流程允许官员在紧急情况下酌情安排递送。"
          }],
          phrases: [{ en: "official discretion", zh: "官方酌处权" }]
        }
      ]
    },
    consent: {
      cut: "con/sent",
      cutMeaning: "共同/感觉；意见",
      senses: [{
        index: "1",
        pos: "n./v.",
        zh: "同意；许可",
        gloss: "agreement, permission",
        examples: [{
          en: "Researchers must obtain consent before exposing volunteers to any avoidable risk.",
          zh: "研究人员在让志愿者接触任何可避免风险前必须取得同意。"
        }],
        phrases: [
          { en: "informed consent", zh: "知情同意" },
          { en: "give consent", zh: "给予同意" }
        ]
      }]
    },
    conceal: {
      cut: "con/ceal",
      cutMeaning: "共同；完全/隐藏",
      senses: [{
        index: "1",
        pos: "v.",
        zh: "隐藏；隐瞒",
        gloss: "hide, cover up",
        examples: [{
          en: "A false inventory can conceal missing equipment until a real emergency begins.",
          zh: "虚假清单可能会隐藏设备缺失，直到真正的紧急情况开始。"
        }],
        phrases: [
          { en: "conceal evidence", zh: "隐藏证据" },
          { en: "conceal a debt", zh: "隐瞒债务" }
        ]
      }]
    },
    preserve: {
      cut: "pre/serv/e",
      cutMeaning: "预先；在前/保持；服务/动词",
      senses: [
        {
          index: "1",
          pos: "v.",
          zh: "保留；保存",
          gloss: "keep, save",
          examples: [{
            en: "The archive preserves old payment records so later investigators can verify them.",
            zh: "档案馆保存旧付款记录，以便后来的调查人员核验。"
          }],
          phrases: [{ en: "preserve records", zh: "保存记录" }]
        },
        {
          index: "2",
          pos: "v.",
          zh: "维持；保护",
          gloss: "maintain, protect",
          examples: [{
            en: "A clear protocol can preserve public trust during an emergency.",
            zh: "清晰流程能在紧急情况下维持公众信任。"
          }],
          phrases: [{ en: "preserve trust", zh: "维持信任" }]
        }
      ]
    },
    expose: {
      cut: "ex/pos/e",
      cutMeaning: "出；向外/放置/动词",
      senses: [
        {
          index: "1",
          pos: "v.",
          zh: "暴露；使接触",
          gloss: "uncover, leave unprotected",
          examples: [{
            en: "A broken clause exposed workers to risks that the original contract had tried to prevent.",
            zh: "一条失效条款使工人暴露于原合同试图防止的风险中。"
          }],
          phrases: [{ en: "expose workers to risk", zh: "使工人暴露于风险" }]
        },
        {
          index: "2",
          pos: "v.",
          zh: "揭露；揭示",
          gloss: "reveal, disclose",
          examples: [{
            en: "The audit exposed a pattern of selective reporting in the institution.",
            zh: "审计揭露了该机构选择性报告的模式。"
          }],
          phrases: [{ en: "expose corruption", zh: "揭露腐败" }]
        }
      ]
    },
    evidence: {
      cut: "e/vid/ence",
      cutMeaning: "出/看见/名词",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "证据；证明",
          gloss: "proof, support",
          examples: [{
            en: "The committee refused to act until it had clear evidence of misconduct.",
            zh: "委员会在获得明确不当行为证据前拒绝行动。"
          }],
          phrases: [{ en: "clear evidence", zh: "明确证据" }]
        },
        {
          index: "2",
          pos: "n.",
          zh: "迹象；根据",
          gloss: "sign, indication",
          examples: [{
            en: "The empty shelves were evidence of a serious inventory problem.",
            zh: "空货架是库存出现严重问题的迹象。"
          }],
          phrases: [{ en: "evidence of failure", zh: "失败迹象" }]
        }
      ]
    },
    protocol: {
      cut: "proto/col",
      cutMeaning: "最初；第一/粘合；规则记录",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "流程；规程",
          gloss: "procedure, rules",
          examples: [{
            en: "The emergency protocol told staff when to dispatch medicine and when to wait for verification.",
            zh: "应急流程告诉工作人员何时调派药品，何时等待核验。"
          }],
          phrases: [{ en: "safety protocol", zh: "安全流程" }]
        },
        {
          index: "2",
          pos: "n.",
          zh: "协议；通信协议",
          gloss: "agreement, communication rules",
          examples: [{
            en: "A secure protocol protects payment data during transfer.",
            zh: "安全协议在转账过程中保护支付数据。"
          }],
          phrases: [{ en: "communication protocol", zh: "通信协议" }]
        }
      ]
    },
    inventory: {
      cut: "in/vent/ory",
      cutMeaning: "进入；里面/来；发现/物；名词",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "清单；详细目录",
          gloss: "list, catalogue",
          examples: [{
            en: "The rescue team checked the inventory before arranging delivery to each shelter.",
            zh: "救援队在安排向每个避难所递送前检查了清单。"
          }],
          phrases: [{ en: "equipment inventory", zh: "设备清单" }]
        },
        {
          index: "2",
          pos: "n.",
          zh: "库存；存货",
          gloss: "stock, supplies",
          examples: [{
            en: "Low inventory forced the clinic to limit payments to essential medicine.",
            zh: "库存不足迫使诊所只为必需药品付款。"
          }],
          phrases: [{ en: "inventory control", zh: "库存管理" }]
        }
      ]
    },
    recovery: {
      cut: "re/cover/y",
      cutMeaning: "再次；回/覆盖；恢复/名词",
      senses: [
        {
          index: "1",
          pos: "n.",
          zh: "恢复；康复",
          gloss: "return to health or normal state",
          examples: [{
            en: "Recovery after the flood depended on cooperation between the clinic and the council.",
            zh: "洪水后的恢复取决于诊所与委员会之间的合作。"
          }],
          phrases: [{ en: "economic recovery", zh: "经济恢复" }]
        },
        {
          index: "2",
          pos: "n.",
          zh: "找回；追回",
          gloss: "getting back",
          examples: [{
            en: "The recovery of the missing payment required accurate records and patient verification.",
            zh: "找回丢失付款需要准确记录和耐心核验。"
          }],
          phrases: [{ en: "data recovery", zh: "数据恢复；找回" }]
        }
      ]
    },
    cooperation: {
      cut: "co/oper/at/ion",
      cutMeaning: "共同/工作；操作/动词/名词",
      senses: [{
        index: "1",
        pos: "n.",
        zh: "合作；协作",
        gloss: "collaboration, working together",
        examples: [{
          en: "Cooperation between institutions made the recovery faster and more accurate.",
          zh: "机构之间的合作让恢复工作更快也更准确。"
        }],
        phrases: [
          { en: "international cooperation", zh: "国际合作" },
          { en: "close cooperation", zh: "密切合作" }
        ]
      }]
    },
    jurisdiction: {
      cut: "juris/dict/ion",
      cutMeaning: "法律；权利/说；宣布/名词",
      senses: [{
        index: "1",
        pos: "n.",
        zh: "管辖权；管辖范围",
        gloss: "legal authority, official power",
        examples: [{
          en: "The court had jurisdiction because the transfer was arranged inside the city.",
          zh: "法院拥有管辖权，因为这次转交是在城内安排的。"
        }],
        phrases: [
          { en: "legal jurisdiction", zh: "法律管辖权" },
          { en: "outside the jurisdiction", zh: "超出管辖范围" }
        ]
      }]
    },
    deteriorate: {
      cut: "deterior/ate",
      cutMeaning: "变坏；更差/动词",
      senses: [
        {
          index: "1",
          pos: "v.",
          zh: "恶化；变坏",
          gloss: "worsen, decline",
          examples: [{
            en: "The patient's condition began to deteriorate when delivery of the medicine was delayed.",
            zh: "药品递送延误后，病人的情况开始恶化。"
          }],
          phrases: [{ en: "deteriorate rapidly", zh: "迅速恶化" }]
        },
        {
          index: "2",
          pos: "v.",
          zh: "退化；变质",
          gloss: "decay, degrade",
          examples: [{
            en: "Paper records deteriorate quickly if the archive is damp.",
            zh: "如果档案室潮湿，纸质记录会很快变质。"
          }],
          phrases: [{ en: "deteriorate over time", zh: "随时间退化" }]
        }
      ]
    },
    materially: {
      cut: "materi/al/ly",
      cutMeaning: "物质；重要内容/形容词/副词",
      senses: [{
        index: "1",
        pos: "adv.",
        zh: "实质上；显著地",
        gloss: "substantially, significantly",
        examples: [{
          en: "The missing signature materially changed the legal status of the payment.",
          zh: "缺失的签名实质上改变了这笔付款的法律状态。"
        }],
        phrases: [
          { en: "materially affect", zh: "实质影响" },
          { en: "materially different", zh: "实质不同" }
        ]
      }]
    }
  };
  for (const [head, patch] of Object.entries(chapterZeroExamPatches)) replace(head, { head, ...patch });
  const chapterOneGptPatches = {
    aeon: {
      cut: "aeon",
      cutMeaning: "极漫长时期",
      senses: [{
        index: "1", pos: "n.", zh: "极漫长的时期；千万年", gloss: "vast age, eternity",
        examples: [{ en: "Human civilisation occupies only a tiny moment beside the aeons of Earth history.", zh: "和地球历史的漫长年代相比，人类文明只占极短一瞬。" }],
        phrases: [{ en: "after aeons of change", zh: "经过极漫长的变化之后" }, { en: "geological aeons", zh: "地质年代" }]
      }]
    },
    primordial: {
      cut: "prim/ordi/al",
      cutMeaning: "最初；首要/开始；秩序/形容词",
      senses: [
        {
          index: "1", pos: "adj.", zh: "原始的；最初的", gloss: "original, earliest, primitive",
          examples: [{ en: "Primordial matter gradually formed the structures from which stars later emerged.", zh: "原始物质逐渐形成了后来恒星从中出现的结构。" }],
          phrases: [{ en: "primordial matter", zh: "原始物质" }, { en: "primordial life", zh: "原始生命" }]
        },
        {
          index: "2", pos: "adj.", zh: "本能的；根本的", gloss: "instinctive, fundamental",
          examples: [{ en: "A primordial fear of danger can make people react before they fully understand a threat.", zh: "对危险的原始恐惧会让人在完全理解威胁之前作出反应。" }],
          phrases: [{ en: "primordial fear", zh: "原始恐惧" }]
        }
      ]
    },
    dissipate: {
      cut: "dis/sip/ate",
      cutMeaning: "分散；离开/投掷；散开/动词",
      senses: [
        {
          index: "1", pos: "v.", zh: "消散；驱散", gloss: "disperse, fade, scatter",
          examples: [{ en: "Clear public information can dissipate fear during a health crisis.", zh: "清晰的公共信息可以在健康危机中消除恐惧。" }],
          phrases: [{ en: "dissipate heat", zh: "散热" }, { en: "dissipate fear", zh: "消除恐惧" }]
        },
        {
          index: "2", pos: "v.", zh: "浪费；挥霍", gloss: "waste, squander",
          examples: [{ en: "Poor planning can dissipate public resources that should support schools and hospitals.", zh: "糟糕规划可能浪费本应用于学校和医院的公共资源。" }],
          phrases: [{ en: "dissipate resources", zh: "浪费资源" }]
        }
      ]
    },
    inconceivable: {
      cut: "in/con/ceiv/able",
      cutMeaning: "不/共同；完全/拿取；构想/形容词",
      senses: [{
        index: "1", pos: "adj.", zh: "不可想象的；难以置信的", gloss: "unimaginable, unthinkable",
        examples: [{ en: "Unchecked climate change could cause inconceivable damage to coastal cities.", zh: "不受控制的气候变化可能对沿海城市造成不可想象的损害。" }],
        phrases: [{ en: "inconceivable heat", zh: "不可想象的高温" }, { en: "inconceivable damage", zh: "不可想象的损害" }]
      }]
    },
    beam: {
      cut: "beam",
      cutMeaning: "光束；横梁；发射",
      senses: [
        {
          index: "1", pos: "n.", zh: "光束", gloss: "ray, shaft of light",
          examples: [{ en: "A beam of light can reveal tiny particles floating in the air.", zh: "一束光可以显现空气中漂浮的微小颗粒。" }],
          phrases: [{ en: "a beam of light", zh: "一束光" }, { en: "laser beam", zh: "激光束" }]
        },
        {
          index: "2", pos: "n.", zh: "横梁；支梁", gloss: "supporting bar",
          examples: [{ en: "Old houses may collapse if their wooden beams are damaged by moisture.", zh: "如果木梁受潮损坏，老房子可能倒塌。" }],
          phrases: [{ en: "wooden beam", zh: "木梁" }]
        },
        {
          index: "3", pos: "v.", zh: "发射；传送", gloss: "transmit, send",
          examples: [{ en: "Satellites beam signals across long distances to connect remote areas.", zh: "卫星远距离发射信号，把偏远地区连接起来。" }],
          phrases: [{ en: "beam signals", zh: "发射信号" }]
        }
      ]
    },
    disentangle: {
      cut: "dis/en/tangle",
      cutMeaning: "分开；解除/使进入/缠结",
      senses: [
        {
          index: "1", pos: "v.", zh: "解开；摆脱纠缠", gloss: "untangle, free, separate",
          examples: [{ en: "Young adults may struggle to disentangle themselves from unhealthy debt.", zh: "年轻人可能很难摆脱不健康债务。" }],
          phrases: [{ en: "disentangle oneself from debt", zh: "摆脱债务纠缠" }]
        },
        {
          index: "2", pos: "v.", zh: "理清；区分", gloss: "clarify, sort out",
          examples: [{ en: "Students should learn to disentangle fact from opinion when reading news online.", zh: "学生阅读网络新闻时应学会区分事实和观点。" }],
          phrases: [{ en: "disentangle fact from opinion", zh: "区分事实和观点" }]
        }
      ]
    },
    dense: {
      cut: "dense",
      cutMeaning: "密集；浓厚",
      senses: [
        {
          index: "1", pos: "adj.", zh: "密集的；浓厚的", gloss: "crowded, compact, thick",
          examples: [{ en: "Dense fog can disrupt flights and make road transport dangerous.", zh: "浓雾会扰乱航班，并使道路交通变得危险。" }],
          phrases: [{ en: "dense fog", zh: "浓雾" }, { en: "dense population", zh: "密集人口" }]
        },
        {
          index: "2", pos: "adj.", zh: "难懂的；复杂的", gloss: "difficult, complex",
          examples: [{ en: "Dense academic writing becomes easier when teachers identify its main claim.", zh: "当老师指出主要论点时，难懂的学术写作会更容易理解。" }],
          phrases: [{ en: "dense argument", zh: "复杂难懂的论证" }]
        }
      ]
    },
    propagate: {
      cut: "pro/pag/ate",
      cutMeaning: "向前；公开/固定；推进/动词",
      senses: [
        {
          index: "1", pos: "v.", zh: "传播；扩散", gloss: "spread, transmit",
          examples: [{ en: "False information can propagate freely when platforms lack effective moderation.", zh: "当平台缺乏有效审核时，虚假信息会自由传播。" }],
          phrases: [{ en: "propagate signals", zh: "传播信号" }]
        },
        {
          index: "2", pos: "v.", zh: "繁殖；培育", gloss: "breed, reproduce",
          examples: [{ en: "Farmers can propagate plants from seeds or cuttings to protect local food supplies.", zh: "农民可以通过种子或插枝繁殖植物，以保护本地食物供应。" }],
          phrases: [{ en: "propagate plants", zh: "繁殖植物" }]
        }
      ]
    },
    nascent: {
      cut: "nasc/ent",
      cutMeaning: "出生；产生/形容词",
      senses: [{
        index: "1", pos: "adj.", zh: "新生的；初期的", gloss: "emerging, newly formed",
        examples: [{ en: "A nascent industry may need public investment before it can compete internationally.", zh: "新兴产业可能需要公共投资，才能参与国际竞争。" }],
        phrases: [{ en: "nascent industry", zh: "新兴产业" }, { en: "nascent democracy", zh: "新生民主制度" }]
      }]
    },
    void: {
      cut: "void",
      cutMeaning: "空；无效",
      senses: [
        {
          index: "1", pos: "n.", zh: "空处；空白；虚空", gloss: "empty space, emptiness",
          examples: [{ en: "Community libraries can fill a void when schools lack enough reading resources.", zh: "当学校缺乏足够阅读资源时，社区图书馆可以填补空白。" }],
          phrases: [{ en: "fill a void", zh: "填补空白" }]
        },
        {
          index: "2", pos: "adj.", zh: "无效的", gloss: "invalid, not effective",
          examples: [{ en: "A contract may become void if one party was forced to sign it.", zh: "如果一方被迫签署，合同可能变得无效。" }],
          phrases: [{ en: "null and void", zh: "无效的" }]
        },
        {
          index: "3", pos: "adj.", zh: "缺乏的；没有的", gloss: "lacking, without",
          examples: [{ en: "A public accusation void of evidence can damage trust and reputation.", zh: "缺乏证据的公开指控可能损害信任和声誉。" }],
          phrases: [{ en: "void of evidence", zh: "缺乏证据" }]
        }
      ]
    },
    incomprehensible: {
      cut: "in/com/pre/hens/ible",
      cutMeaning: "不/共同；完全/向前/抓住；理解/形容词",
      senses: [{
        index: "1", pos: "adj.", zh: "无法理解的；难以领会的", gloss: "hard to grasp, beyond understanding",
        examples: [{ en: "If public policies are written in incomprehensible language, citizens may lose trust.", zh: "如果公共政策用难以理解的语言写成，公民可能失去信任。" }],
        phrases: [{ en: "incomprehensible system", zh: "难以理解的系统" }]
      }]
    },
    compression: {
      cut: "com/press/ion",
      cutMeaning: "共同；完全/压；挤/名词",
      senses: [
        {
          index: "1", pos: "n.", zh: "压缩；压迫", gloss: "pressure, squeezing, compacting",
          examples: [{ en: "Extreme compression can change the physical properties of a material.", zh: "极端压缩可以改变一种材料的物理性质。" }],
          phrases: [{ en: "extreme compression", zh: "极端压缩" }]
        },
        {
          index: "2", pos: "n.", zh: "数据压缩；文本压缩", gloss: "reduction, shortening",
          examples: [{ en: "Data compression allows platforms to store and transmit information more efficiently.", zh: "数据压缩使平台能更高效地存储和传输信息。" }],
          phrases: [{ en: "data compression", zh: "数据压缩" }]
        }
      ]
    },
    erupt: {
      cut: "e/rupt",
      cutMeaning: "出/破裂",
      senses: [
        {
          index: "1", pos: "v.", zh: "爆发；喷发", gloss: "burst out, explode",
          examples: [{ en: "Violence may erupt when social inequality remains unresolved for too long.", zh: "当社会不平等长期得不到解决时，暴力可能爆发。" }],
          phrases: [{ en: "violence erupts", zh: "暴力爆发" }, { en: "a volcano erupts", zh: "火山喷发" }]
        },
        {
          index: "2", pos: "v.", zh: "突然表达强烈情绪", gloss: "burst into anger",
          examples: [{ en: "Parents may erupt in anger when schools fail to explain important decisions.", zh: "当学校没有解释重要决定时，家长可能勃然大怒。" }],
          phrases: [{ en: "erupt in anger", zh: "勃然大怒" }]
        }
      ]
    },
    undergo: {
      cut: "under/go",
      cutMeaning: "在下；承受/经历；去",
      senses: [
        {
          index: "1", pos: "v.", zh: "经历；经受", gloss: "experience, go through",
          examples: [{ en: "Education systems must undergo reform when old exams fail to measure real ability.", zh: "当旧考试无法衡量真实能力时，教育体系必须经历改革。" }],
          phrases: [{ en: "undergo reform", zh: "经历改革" }]
        },
        {
          index: "2", pos: "v.", zh: "接受治疗或手术", gloss: "receive, have",
          examples: [{ en: "Patients should receive clear information before they undergo surgery.", zh: "病人在接受手术前应该获得清晰信息。" }],
          phrases: [{ en: "undergo surgery", zh: "接受手术" }]
        }
      ]
    },
    exponential: {
      cut: "ex/pon/ent/ial",
      cutMeaning: "出/放置；提出/名词；人/形容词",
      senses: [
        {
          index: "1", pos: "adj.", zh: "指数级的；急剧增长的", gloss: "rapidly accelerating",
          examples: [{ en: "The exponential growth of online information makes reliable sources harder to identify.", zh: "线上信息的指数级增长使可靠来源更难识别。" }],
          phrases: [{ en: "exponential growth", zh: "指数级增长" }]
        },
        {
          index: "2", pos: "adj.", zh: "指数的；幂的", gloss: "using powers",
          examples: [{ en: "Exponential functions are often used to model population growth.", zh: "指数函数常用于模拟人口增长。" }],
          phrases: [{ en: "exponential function", zh: "指数函数" }]
        }
      ]
    },
    inflation: {
      cut: "in/flat/ion",
      cutMeaning: "进入；使成/吹；膨胀/名词",
      senses: [
        {
          index: "1", pos: "n.", zh: "膨胀；扩张", gloss: "expansion, swelling",
          examples: [{ en: "Cosmic inflation describes a very early period when the universe expanded rapidly.", zh: "宇宙暴胀描述的是宇宙早期快速扩张的阶段。" }],
          phrases: [{ en: "cosmic inflation", zh: "宇宙暴胀" }]
        },
        {
          index: "2", pos: "n.", zh: "通货膨胀", gloss: "rising prices",
          examples: [{ en: "High inflation reduces consumers' purchasing power and pressures low-income families.", zh: "高通胀削弱消费者购买力，并给低收入家庭带来压力。" }],
          phrases: [{ en: "control inflation", zh: "控制通胀" }]
        }
      ]
    },
    velocity: {
      cut: "veloc/ity",
      cutMeaning: "快速/名词",
      senses: [
        {
          index: "1", pos: "n.", zh: "速度；速率", gloss: "speed, rate of movement",
          examples: [{ en: "Satellites must travel at a precise velocity to remain in orbit.", zh: "卫星必须以精确速度运行才能留在轨道中。" }],
          phrases: [{ en: "high velocity", zh: "高速" }]
        },
        {
          index: "2", pos: "n.", zh: "变化速度；发展速度", gloss: "pace, rate",
          examples: [{ en: "The velocity of technological change makes curricula hard to update quickly.", zh: "技术变化的速度使课程难以及时更新。" }],
          phrases: [{ en: "velocity of change", zh: "变化速度" }]
        }
      ]
    },
    defy: {
      cut: "de/fy",
      cutMeaning: "离开；反向/信任；挑战",
      senses: [
        {
          index: "1", pos: "v.", zh: "违抗；挑战", gloss: "resist, disobey, challenge",
          examples: [{ en: "Citizens may defy authority when laws are seen as unfair.", zh: "当法律被认为不公平时，公民可能反抗权威。" }],
          phrases: [{ en: "defy authority", zh: "反抗权威" }]
        },
        {
          index: "2", pos: "v.", zh: "超出理解；难以解释", gloss: "go beyond, be beyond",
          examples: [{ en: "Quantum physics often defies intuition because particles do not behave like ordinary objects.", zh: "量子物理常常违背直觉，因为粒子的行为不像普通物体。" }],
          phrases: [{ en: "defy intuition", zh: "违背直觉" }, { en: "defy interpretation", zh: "难以解读" }]
        }
      ]
    },
    epoch: {
      cut: "epoch",
      cutMeaning: "时代；纪元",
      senses: [{
        index: "1", pos: "n.", zh: "时代；纪元；历史阶段", gloss: "era, period, age",
        examples: [{ en: "The internet has created a new epoch in which information spreads faster than institutions can regulate it.", zh: "互联网创造了一个新时代，在其中信息传播速度超过机构监管速度。" }],
        phrases: [{ en: "historical epoch", zh: "历史时代" }, { en: "remote epoch", zh: "遥远时代" }]
      }]
    },
    remote: {
      cut: "re/mote",
      cutMeaning: "离开；向后/移动；远离",
      senses: [
        {
          index: "1", pos: "adj.", zh: "遥远的；偏僻的", gloss: "distant, far-off",
          examples: [{ en: "Remote regions often suffer from limited access to healthcare and education.", zh: "偏远地区通常难以获得医疗和教育资源。" }],
          phrases: [{ en: "remote region", zh: "偏远地区" }]
        },
        {
          index: "2", pos: "adj.", zh: "远程的；线上的", gloss: "online, virtual",
          examples: [{ en: "Remote work can reduce commuting pressure but weaken social interaction.", zh: "远程办公可以减少通勤压力，但可能削弱社交互动。" }],
          phrases: [{ en: "remote work", zh: "远程办公" }]
        }
      ]
    },
    encompass: {
      cut: "en/com/pass",
      cutMeaning: "使进入；包围/共同；完全/走；范围",
      senses: [{
        index: "1", pos: "v.", zh: "包括；涵盖；围住", gloss: "include, cover, contain",
        examples: [{ en: "Public health policy should encompass prevention, diagnosis and long-term care.", zh: "公共卫生政策应涵盖预防、诊断和长期护理。" }],
        phrases: [{ en: "encompass a wide range of issues", zh: "涵盖广泛问题" }]
      }]
    },
    condense: {
      cut: "con/dense",
      cutMeaning: "共同；加强/密集；浓缩",
      senses: [
        {
          index: "1", pos: "v.", zh: "压缩；浓缩；缩短", gloss: "compress, shorten, concentrate",
          examples: [{ en: "Teachers can condense difficult theories into visual examples.", zh: "老师可以把困难理论压缩成可视化例子。" }],
          phrases: [{ en: "condense information", zh: "压缩信息" }]
        },
        {
          index: "2", pos: "v.", zh: "凝结；冷凝", gloss: "turn into liquid",
          examples: [{ en: "Water vapour condenses on cold glass when warm air meets a cooler surface.", zh: "暖空气遇到较冷表面时，水蒸气会在冷玻璃上凝结。" }],
          phrases: [{ en: "water vapour condenses", zh: "水蒸气凝结" }]
        }
      ]
    },
    singularity: {
      cut: "singul/ar/ity",
      cutMeaning: "单一；独特/形容词/名词",
      senses: [
        {
          index: "1", pos: "n.", zh: "奇点；异常点", gloss: "critical point, exceptional point",
          examples: [{ en: "In cosmology, a singularity refers to a point where density becomes extremely high.", zh: "在宇宙学中，奇点指密度变得极高的点。" }],
          phrases: [{ en: "gravitational singularity", zh: "引力奇点" }]
        },
        {
          index: "2", pos: "n.", zh: "独特性；非凡性", gloss: "uniqueness, distinctiveness",
          examples: [{ en: "The singularity of the manuscript made it valuable to scholars.", zh: "这份手稿的独特性使其对学者很有价值。" }],
          phrases: [{ en: "cultural singularity", zh: "文化独特性" }]
        }
      ]
    },
    radiance: {
      cut: "radi/ance",
      cutMeaning: "光线；辐射/名词",
      senses: [
        {
          index: "1", pos: "n.", zh: "光辉；光芒", gloss: "brightness, light",
          examples: [{ en: "Art can preserve the radiance of a culture after its political power disappears.", zh: "艺术可以在政治权力消失后保存一种文化的光辉。" }],
          phrases: [{ en: "ancient radiance", zh: "古老光辉" }]
        },
        {
          index: "2", pos: "n.", zh: "容光焕发；光彩", gloss: "glow, visible happiness",
          examples: [{ en: "Her radiance returned when she heard that the recovery had succeeded.", zh: "听到恢复成功后，她重新容光焕发。" }],
          phrases: [{ en: "facial radiance", zh: "面部光彩" }]
        }
      ]
    },
    attenuate: {
      cut: "at/tenu/ate",
      cutMeaning: "向；加强/薄；拉细/动词",
      senses: [
        {
          index: "1", pos: "v.", zh: "削弱；减弱", gloss: "weaken, reduce",
          examples: [{ en: "Clear evidence can attenuate public fear when people face unfamiliar medical risks.", zh: "当人们面对陌生医疗风险时，清晰证据可以减弱公众恐惧。" }],
          phrases: [{ en: "attenuate a signal", zh: "削弱信号" }]
        },
        {
          index: "2", pos: "v.", zh: "使变薄；使变细", gloss: "make thin, stretch out",
          examples: [{ en: "Expansion can attenuate light until only a faint signal remains.", zh: "膨胀会削弱光，直到只剩微弱信号。" }],
          phrases: [{ en: "attenuated light", zh: "衰减后的光" }]
        }
      ]
    },
    relentless: {
      cut: "re/lent/less",
      cutMeaning: "反复；回/放缓；宽容/没有",
      senses: [
        {
          index: "1", pos: "adj.", zh: "不停的；持续强烈的", gloss: "persistent, continuous",
          examples: [{ en: "Relentless competition may improve efficiency but damage workers' mental health.", zh: "持续激烈的竞争可能提高效率，但会损害劳动者心理健康。" }],
          phrases: [{ en: "relentless pressure", zh: "持续压力" }]
        },
        {
          index: "2", pos: "adj.", zh: "不留情的；严酷的", gloss: "harsh, unforgiving",
          examples: [{ en: "Relentless criticism can make young researchers afraid to test new ideas.", zh: "无情批评会让年轻研究者害怕测试新想法。" }],
          phrases: [{ en: "relentless criticism", zh: "无情批评" }]
        }
      ]
    },
    permeate: {
      cut: "per/me/ate",
      cutMeaning: "穿过；完全/通过；移动/动词",
      senses: [
        {
          index: "1", pos: "v.", zh: "弥漫；遍布", gloss: "spread through",
          examples: [{ en: "Digital technology now permeates education, work and entertainment.", zh: "数字技术如今渗透教育、工作和娱乐。" }],
          phrases: [{ en: "permeate daily life", zh: "渗透日常生活" }]
        },
        {
          index: "2", pos: "v.", zh: "渗透；影响各部分", gloss: "penetrate, affect throughout",
          examples: [{ en: "Distrust can permeate an institution when leaders conceal evidence.", zh: "当领导层隐藏证据时，不信任会渗透整个机构。" }],
          phrases: [{ en: "permeate society", zh: "渗透社会" }]
        }
      ]
    },
    faint: {
      cut: "faint",
      cutMeaning: "微弱；昏眩",
      senses: [
        {
          index: "1", pos: "adj.", zh: "微弱的；模糊的", gloss: "weak, slight, unclear",
          examples: [{ en: "A faint signal can still contain valuable information.", zh: "一个微弱信号仍可能包含有价值的信息。" }],
          phrases: [{ en: "faint light", zh: "微弱的光" }, { en: "faint hope", zh: "一线希望" }]
        },
        {
          index: "2", pos: "v.", zh: "昏倒", gloss: "lose consciousness",
          examples: [{ en: "Several workers fainted after standing for hours in extreme heat.", zh: "几名工人在酷热中站了数小时后昏倒。" }],
          phrases: [{ en: "faint from hunger", zh: "饿晕" }]
        }
      ]
    },
    fraction: {
      cut: "fract/ion",
      cutMeaning: "打碎；分开/名词",
      senses: [
        {
          index: "1", pos: "n.", zh: "小部分；一点点", gloss: "small part",
          examples: [{ en: "Even a small fraction of public spending can improve education if it supports teachers.", zh: "哪怕公共支出的一小部分，如果投向教师，也能改善教育。" }],
          phrases: [{ en: "a small fraction of the cost", zh: "成本的一小部分" }]
        },
        {
          index: "2", pos: "n.", zh: "分数", gloss: "mathematical part",
          examples: [{ en: "Students convert a fraction into a decimal to compare quantities more easily.", zh: "学生把分数转成小数，以便更容易比较数量。" }],
          phrases: [{ en: "simple fraction", zh: "简单分数" }]
        }
      ]
    },
    audible: {
      cut: "aud/ible",
      cutMeaning: "听/形容词",
      senses: [{
        index: "1", pos: "adj.", zh: "听得见的；声音清楚的", gloss: "able to be heard",
        examples: [{ en: "Public warnings should be clearly audible during emergencies.", zh: "公共警报在紧急情况下应该清楚可听。" }],
        phrases: [{ en: "barely audible", zh: "几乎听不见的" }, { en: "audible warning", zh: "可听警告" }]
      }]
    },
    linger: {
      cut: "linger",
      cutMeaning: "逗留；残留",
      senses: [
        {
          index: "1", pos: "v.", zh: "逗留；停留", gloss: "stay longer",
          examples: [{ en: "Students lingered after class to ask about the ancient writing system.", zh: "学生课后留下来询问古代文字系统。" }],
          phrases: [{ en: "linger after class", zh: "课后逗留" }]
        },
        {
          index: "2", pos: "v.", zh: "继续存在；迟迟不消散", gloss: "remain, persist",
          examples: [{ en: "The lingering effects of poverty can limit education after income improves.", zh: "贫困的持续影响即使在收入改善后也会限制教育。" }],
          phrases: [{ en: "lingering doubts", zh: "挥之不去的疑虑" }]
        }
      ]
    },
    dawn: {
      cut: "dawn",
      cutMeaning: "黎明；开端；显现",
      senses: [
        {
          index: "1", pos: "n.", zh: "黎明", gloss: "daybreak",
          examples: [{ en: "The researchers left the village before dawn to reach the site safely.", zh: "研究者黎明前离开村庄，以便安全到达现场。" }],
          phrases: [{ en: "before dawn", zh: "黎明前" }]
        },
        {
          index: "2", pos: "n.", zh: "开端；初期", gloss: "beginning, emergence",
          examples: [{ en: "The dawn of artificial intelligence has forced schools to rethink learning.", zh: "人工智能时代的开端迫使学校重新思考学习。" }],
          phrases: [{ en: "the dawn of the digital age", zh: "数字时代开端" }]
        },
        {
          index: "3", pos: "v.", zh: "逐渐明白；开始显现", gloss: "become clear",
          examples: [{ en: "It dawned on the committee that the protocol had failed.", zh: "委员会逐渐意识到流程已经失效。" }],
          phrases: [{ en: "it dawned on me", zh: "我逐渐意识到" }]
        }
      ]
    },
    scholar: {
      cut: "schol/ar",
      cutMeaning: "学校；学问/人",
      senses: [
        {
          index: "1", pos: "n.", zh: "学者", gloss: "academic, researcher, expert",
          examples: [{ en: "Leading scholars often disagree because historical evidence can be incomplete.", zh: "重要学者之间常有分歧，因为历史证据可能不完整。" }],
          phrases: [{ en: "leading scholar", zh: "重要学者" }]
        },
        {
          index: "2", pos: "n.", zh: "奖学金获得者", gloss: "scholarship student",
          examples: [{ en: "Young scholars need funding and academic freedom to develop original ideas.", zh: "青年学者需要资金和学术自由来发展原创思想。" }],
          phrases: [{ en: "Rhodes scholar", zh: "罗德奖学金获得者" }]
        }
      ]
    },
    command: {
      cut: "com/mand",
      cutMeaning: "共同；完全/命令；委托",
      senses: [
        {
          index: "1", pos: "v.", zh: "掌握；精通", gloss: "master, know well",
          examples: [{ en: "Students who command academic English can understand complex arguments more quickly.", zh: "精通学术英语的学生能更快理解复杂论证。" }],
          phrases: [{ en: "command a language", zh: "精通一门语言" }]
        },
        {
          index: "2", pos: "v.", zh: "命令；指挥；控制", gloss: "order, control",
          examples: [{ en: "A commander must command an army under pressure without losing judgment.", zh: "指挥官必须在压力下指挥军队，同时不失去判断。" }],
          phrases: [{ en: "command an army", zh: "指挥军队" }]
        },
        {
          index: "3", pos: "n.", zh: "掌握；控制；指挥权", gloss: "mastery, control, authority",
          examples: [{ en: "A strong command of language helps students compare sources and detect weak arguments.", zh: "扎实的语言能力帮助学生比较资料并识别薄弱论点。" }],
          phrases: [{ en: "a strong command of English", zh: "英语掌握很好" }]
        }
      ]
    },
    crack: {
      cut: "crack",
      cutMeaning: "裂开；破解",
      senses: [
        {
          index: "1", pos: "v.", zh: "破解；解决", gloss: "decode, solve, decipher",
          examples: [{ en: "Historians cracked the code by comparing repeated symbols with known names.", zh: "历史学家通过比较重复符号和已知名字破解了密码。" }],
          phrases: [{ en: "crack a code", zh: "破解密码" }]
        },
        {
          index: "2", pos: "v.", zh: "裂开；破裂", gloss: "break, split",
          examples: [{ en: "Poorly built roads may crack under pressure from heavy traffic.", zh: "建造质量差的道路可能在重型交通压力下开裂。" }],
          phrases: [{ en: "crack under pressure", zh: "在压力下破裂" }]
        },
        {
          index: "3", pos: "n.", zh: "裂缝；漏洞", gloss: "gap, split, weakness",
          examples: [{ en: "The pandemic exposed cracks in many public health systems.", zh: "疫情暴露了许多公共卫生系统中的漏洞。" }],
          phrases: [{ en: "a crack in the system", zh: "制度漏洞" }]
        }
      ]
    },
    restore: {
      cut: "re/store",
      cutMeaning: "再次；回/放置；储存",
      senses: [
        {
          index: "1", pos: "v.", zh: "恢复；重新建立", gloss: "bring back, re-establish",
          examples: [{ en: "Clear communication can restore public confidence after a policy failure.", zh: "政策失败后，清晰沟通可以恢复公众信心。" }],
          phrases: [{ en: "restore confidence", zh: "恢复信心" }]
        },
        {
          index: "2", pos: "v.", zh: "修复；修缮", gloss: "repair, renovate",
          examples: [{ en: "Museums restore damaged paintings to preserve artistic heritage.", zh: "博物馆修复受损画作，以保存艺术遗产。" }],
          phrases: [{ en: "restore ancient buildings", zh: "修复古建筑" }]
        },
        {
          index: "3", pos: "v.", zh: "归还；恢复给", gloss: "return, give back",
          examples: [{ en: "Courts may restore property to its original owner if it was taken illegally.", zh: "如果财产被非法夺走，法院可能将其归还原主人。" }],
          phrases: [{ en: "restore rights", zh: "恢复权利" }]
        }
      ]
    },
    capacity: {
      cut: "cap/ac/ity",
      cutMeaning: "拿；容纳/向；加强/名词",
      senses: [
        {
          index: "1", pos: "n.", zh: "能力；才能", gloss: "ability, capability",
          examples: [{ en: "Education should strengthen students' capacity to think independently.", zh: "教育应增强学生独立思考的能力。" }],
          phrases: [{ en: "capacity to think", zh: "思考能力" }]
        },
        {
          index: "2", pos: "n.", zh: "容量；容纳量", gloss: "volume, holding ability",
          examples: [{ en: "Cloud services increase storage capacity but raise concerns about data privacy.", zh: "云服务增加储存容量，但也引发数据隐私担忧。" }],
          phrases: [{ en: "storage capacity", zh: "储存容量" }]
        },
        {
          index: "3", pos: "n.", zh: "身份；职位", gloss: "role, position",
          examples: [{ en: "In her capacity as principal, she must balance parents' demands with teachers' workload.", zh: "以校长身份，她必须平衡家长需求和教师工作量。" }],
          phrases: [{ en: "in a professional capacity", zh: "以专业身份" }]
        }
      ]
    },
    erect: {
      cut: "e/rect",
      cutMeaning: "向外；使成/直；正",
      senses: [
        {
          index: "1", pos: "v.", zh: "建立；竖立", gloss: "build, set up",
          examples: [{ en: "The city erected a monument to remember the workers who rebuilt the bridge.", zh: "这座城市建立纪念碑，以纪念重建桥梁的工人。" }],
          phrases: [{ en: "erect a monument", zh: "建立纪念碑" }]
        },
        {
          index: "2", pos: "adj.", zh: "竖直的；挺直的", gloss: "upright, straight",
          examples: [{ en: "An erect posture can make a speaker appear more confident.", zh: "挺直的姿势会让演讲者显得更自信。" }],
          phrases: [{ en: "an erect posture", zh: "挺直的姿势" }]
        }
      ]
    },
    corrupt: {
      cut: "cor/rupt",
      cutMeaning: "共同；完全/破裂；败坏",
      senses: [
        {
          index: "1", pos: "adj.", zh: "腐败的；堕落的", gloss: "dishonest, immoral",
          examples: [{ en: "Corrupt officials can make citizens lose trust in public institutions.", zh: "腐败官员会让公民失去对公共机构的信任。" }],
          phrases: [{ en: "corrupt officials", zh: "腐败官员" }]
        },
        {
          index: "2", pos: "v.", zh: "腐蚀；败坏", gloss: "damage morally, spoil",
          examples: [{ en: "Secret payments can corrupt public institutions before the damage becomes visible.", zh: "秘密付款会在损害显现之前腐蚀公共机构。" }],
          phrases: [{ en: "corrupt public institutions", zh: "腐蚀公共机构" }]
        }
      ]
    },
    corruption: {
      cut: "cor/rupt/ion",
      cutMeaning: "共同；完全/破裂；败坏/名词",
      senses: [{
        index: "1", pos: "n.", zh: "腐败；腐化", gloss: "dishonesty, moral decay",
        examples: [{ en: "Independent audits can expose corruption before it becomes normal inside an institution.", zh: "独立审计可以在腐败成为机构内部常态之前揭露它。" }],
        phrases: [{ en: "political corruption", zh: "政治腐败" }]
      }]
    },
    corruptible: {
      cut: "cor/rupt/ible",
      cutMeaning: "共同；完全/破裂；败坏/可...的",
      senses: [{
        index: "1", pos: "adj.", zh: "易腐败的；可被收买的", gloss: "open to bribery, morally weak",
        examples: [{ en: "A corruptible official can turn a fair protocol into a private advantage.", zh: "一个易被收买的官员可能把公平流程变成私人利益。" }],
        phrases: [{ en: "corruptible official", zh: "易腐败官员" }]
      }]
    }
  };
  for (const [head, patch] of Object.entries(chapterOneGptPatches)) stackPatch(head, { head, ...patch });
}

function buildCutIndex(cards) {
  const index = {};
  for (const card of cards) {
    const cut = clean(card.cut);
    if (!cut) continue;
    for (const part of cut.split("/").map((item) => clean(item).toLowerCase()).filter(Boolean)) {
      if (!index[part]) index[part] = [];
      if (!index[part].includes(card.head)) index[part].push(card.head);
    }
  }
  for (const [part, words] of Object.entries(index)) {
    words.sort();
    if (words.length < 2) delete index[part];
  }
  return index;
}

function buildRootCutIndex(cards, rootGroups) {
  const index = {};
  for (const card of cards) {
    const parts = clean(card.cut).split("/").map((item) => clean(item).toLowerCase()).filter(Boolean);
    for (const part of parts) {
      const group = rootGroups[part];
      if (!group) continue;
      if (!index[part]) index[part] = { head: group.head, meaning: group.meaning, words: [] };
      if (!index[part].words.includes(card.head)) index[part].words.push(card.head);
    }
  }
  for (const [part, entry] of Object.entries(index)) {
    entry.words.sort();
    if (entry.words.length < 2) delete index[part];
  }
  return index;
}

const cutIndex = buildCutIndex(cards);
const rootCutIndex = buildRootCutIndex(cards, kin.rootGroups);

writeJson("cards.json", {
  source: OWL_MD,
  count: cards.length,
  cards
});
writeJson("families.json", {
  source: FAMILY_JS,
  count: Object.keys(families).length,
  families
});
writeJson("kin.json", {
  source: KIN_MD,
  count: kin.clusters.length,
  clusters: kin.clusters,
  wordIndex: kin.wordIndex,
  roots: kin.roots,
  rootGroups: kin.rootGroups
});
writeJson("cut-index.json", {
  source: KIN_MD,
  count: Object.keys(cutIndex).length,
  index: cutIndex,
  rootIndex: rootCutIndex
});
writeJson("entries.json", {
  entries: cards.map((card) => card.head)
});
writeJson("cut-audit.json", {
  repaired: cutRepair.repaired,
  unresolved_count: cutRepair.unresolved.length,
  unresolved: cutRepair.unresolved
});

console.log(`cards ${cards.length}`);
console.log(`families ${Object.keys(families).length}`);
console.log(`kin clusters ${kin.clusters.length}`);
console.log(`kin wordIndex ${Object.keys(kin.wordIndex).length}`);
console.log(`legacy kin roots ${Object.keys(legacyKinRoots).length}`);
console.log(`cut repaired ${cutRepair.repaired}`);
console.log(`cut unresolved ${cutRepair.unresolved.length}`);
console.log(`family completed ${familyCompleted}`);
console.log(`safe singleton families closed ${safeSingletonFamiliesClosed}`);
console.log(`duplicate singleton removed ${duplicateSingletonRemoved}`);
console.log(`family member cuts improved ${familyMemberCutsImproved}`);
console.log(`known bad kin links removed ${knownBadKinLinksRemoved}`);
console.log(`final cut overrides applied ${finalCutOverridesApplied}`);
console.log(`cut coverage exactized ${cutCoverageExactized}`);
console.log(`cut coverage fallbacks ${cutCoverageFallbacks}`);
