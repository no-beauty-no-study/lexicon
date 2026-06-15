#!/usr/bin/env node
/* ============================================================
   Merge codex's canonical portable lexicon (data/lexicon-portable/cards.json
   on branch codex/bgm-assets-upload — the "词库最新版") into our owl warehouse
   (data/vocab/wordOwl.js → window.WORD_OWL), which powers small/big cards, the
   cut, and the synonym quiz.

   Codex card  → owl entry:
     {head, phonetic, cut, cutMeaning,
      senses:[{pos, zh, gloss, examples:[{en,zh}], phrases:[{en,zh}]}]}
        ↓
     {ipa, cut:{slash,zh}, meanings:[{pos, zh, gloss, syns[], example,
      example_zh, phrases:[{en,zh}]}]}

   Merge policy: codex's card WINS for shared heads (cleaner data + the
   previously-missing academic words: serenity / disgorge / recalibrate /
   consequential …); our existing owl entries are KEPT for heads codex doesn't
   carry (≈1.4k), so coverage never regresses. (Basic everyday words codex
   still lacks — smile / floor / room — stay covered by VOCAB_CLAUDE_SUPPLEMENT.)

   Usage: node tools/merge-codex-lexicon.js [path/to/cards.json]
   (default: data/lexicon-portable/cards.json)
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const SRC = process.argv[2] || path.join(__dirname, "..", "data", "lexicon-portable", "cards.json");
const OWL = path.join(__dirname, "..", "data", "vocab", "wordOwl.js");

function toOwl(card) {
  return {
    ipa: card.phonetic || "",
    cut: { slash: card.cut || "", zh: card.cutMeaning || "" },
    meanings: (card.senses || []).map(s => ({
      pos: s.pos || "",
      zh: s.zh || "",
      gloss: s.gloss || "",
      syns: s.gloss ? s.gloss.split(/[,;，；、]\s*/).map(x => x.trim()).filter(Boolean) : [],
      example: (s.examples && s.examples[0] && s.examples[0].en) || "",
      example_zh: (s.examples && s.examples[0] && s.examples[0].zh) || "",
      phrases: (s.phrases || []).map(p => ({ en: p.en || "", zh: p.zh || "" })).filter(p => p.en || p.zh),
    })).filter(m => m.zh || m.gloss || m.example),
  };
}

// load current owl
const g = {}; { const window = g; eval(fs.readFileSync(OWL, "utf8")); }
const owl = g.WORD_OWL || {};
const before = Object.keys(owl).length;

const cards = JSON.parse(fs.readFileSync(SRC, "utf8")).cards || [];
let added = 0, replaced = 0;
for (const card of cards) {
  const head = String(card.head || "").trim().toLowerCase();
  if (!head) continue;
  if (owl[head]) replaced++; else added++;
  owl[head] = toOwl(card);            // codex wins on conflict
}

const out = "/* AUTO-GENERATED: word warehouse. Base = tools/parse-word-owl.js,\n"
  + "   then merged with codex's canonical lexicon-portable/cards.json via\n"
  + "   tools/merge-codex-lexicon.js (codex wins on shared heads). */\n"
  + "const WORD_OWL = " + JSON.stringify(owl) + ";\n"
  + "if (typeof window !== 'undefined') window.WORD_OWL = WORD_OWL;\n";
fs.writeFileSync(OWL, out);
console.log(`owl: ${before} → ${Object.keys(owl).length} (codex replaced ${replaced}, added ${added})`);
