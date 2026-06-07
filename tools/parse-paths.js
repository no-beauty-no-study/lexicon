#!/usr/bin/env node
/* ============================================================
   The Paths — interactive-novel parser.

   Input : data/paths-source/*.txt  (one storyline per file)
   Output: data/paths-content.js    (structured, marker-free model)

   The SOURCE keeps structural markers for the parser; the OUTPUT and the
   page never show them, and TTS never speaks speaker labels, markers, or
   affection tags. We do NOT rewrite the prose — only segment it.

   NOTE ON LINE BREAKS: the source uses U+2028 / U+2029 (LINE / PARAGRAPH
   SEPARATOR) in addition to \n, so a "line" is split on all four. With that
   split, every speaker name sits on its own line, every option (A. / B. /
   C.) on its own line, and every branch opens with a bare letter line —
   exactly the structure below.

   Source grammar:
     Chapter N · Title          chapter header
     <paragraph>                narration (one info-unit per line)
     Name                       a speaker label (its own line)…
     <text…>                    …followed by that speaker's beat
     — SAVE —                   a survival choice follows
     — AFFECTION —              an affection choice follows
     <question>
     A. opt / B. opt / C. opt   the three options (each its own line)
     A | B | C                  branch opens with a bare letter line
       [Name +N] / [Name −N]    optional affection tag (own line)
       <branch beats…>
       END. | Continue.         END → restart THIS chapter; Continue → flow on

   Emitted block model (per chapter, in order):
     {k:"n", t}                       narration
     {k:"s", who, t}                  speaker beat (who = label, never TTS'd)
     {k:"c", kind, q, opts:[{key,t}],
        branches:[{key, aff:{who,delta}|null, blocks:[…], end:"END"|"CONTINUE"}]}
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "..", "data", "paths-source");
const OUT = path.join(__dirname, "..", "data", "paths-content.js");

const SOURCES = [
  { id: "mainline", file: "main-line.txt", title: "The Paths" },
];

const SPLIT     = /[\r\n\u2028\u2029]/;
const CHAP_RE   = /^Chapter\s+(\d+)\s*[·.]\s*(.+?)\s*$/;
const SAVE_RE   = /^—\s*SAVE\s*—$/;
const AFF_RE    = /^—\s*AFFECTION\s*—$/;
const OPT_RE     = /^([A-C])\.\s+(.*)$/;
const LETTER_RE = /^([ABC])$/;
const END_RE    = /^END\.$/;
const CONT_RE   = /^Continue\.$/;
const AFFTAG_RE = /^\[\s*([A-Za-z][A-Za-z .'’-]*?)\s*([+\-−])\s*(\d+)\s*\]$/;
// A bare speaker label: 1–3 Capitalised words, letters/apostrophes only (so
// "END.", "Continue.", "A", options and full sentences never qualify).
const NAME_RE   = /^[A-Z][A-Za-z’']+(?: [A-Z][A-Za-z’']+){0,2}$/;

function isStructural(s) {
  return !s || CHAP_RE.test(s) || SAVE_RE.test(s) || AFF_RE.test(s) ||
         OPT_RE.test(s) || END_RE.test(s) || CONT_RE.test(s) || LETTER_RE.test(s);
}
function affFrom(s) {
  const m = AFFTAG_RE.exec(s);
  if (!m) return null;
  const sign = m[2] === "+" ? 1 : -1;
  return { who: m[1].trim(), delta: sign * parseInt(m[3], 10) };
}

function parse(text) {
  const segs = text.split(SPLIT).map(s => s.trim());
  const chapters = [];
  let cur = null, i = 0;
  const N = segs.length;
  const push = b => { if (cur) cur.blocks.push(b); };
  const nextContent = () => { let j = i; while (j < N && !segs[j]) j++; return j; };

  // Read one prose segment into a block, consuming a following content line
  // when the segment is a bare speaker label. Used at top level and inside
  // branches via `sink` (the array to push into).
  function readProse(s, sink) {
    if (NAME_RE.test(s)) {
      const j = nextContent();
      if (j < N && !isStructural(segs[j])) {     // name + its beat
        const t = segs[j]; i = j + 1;
        sink.push({ k: "s", who: s, t });
        return;
      }
    }
    sink.push({ k: "n", t: s });                 // plain narration
  }

  while (i < N) {
    const s = segs[i]; i++;
    if (!s) continue;

    const cm = CHAP_RE.exec(s);
    if (cm) { cur = { n: +cm[1], title: cm[2], blocks: [] }; chapters.push(cur); continue; }
    if (!cur) continue;

    if (SAVE_RE.test(s) || AFF_RE.test(s)) {
      const kind = AFF_RE.test(s) ? "affection" : "save";
      const qParts = [];
      while (i < N && !OPT_RE.test(segs[i])) { if (segs[i]) qParts.push(segs[i]); i++; }
      const opts = [];
      while (i < N && opts.length < 3) {
        const om = OPT_RE.exec(segs[i]); if (!om) break;
        opts.push({ key: om[1], t: om[2].trim() }); i++;
      }
      const branches = [];
      for (let b = 0; b < 3; b++) {
        let j = nextContent(); i = j;
        if (i >= N || !LETTER_RE.test(segs[i])) break;
        const key = segs[i]; i++;
        const branch = { key, aff: null, blocks: [], end: "CONTINUE" };
        while (i < N) {
          const ln = segs[i];
          if (END_RE.test(ln))  { branch.end = "END";      i++; break; }
          if (CONT_RE.test(ln)) { branch.end = "CONTINUE"; i++; break; }
          i++;
          if (!ln) continue;
          const a = affFrom(ln);
          if (a && !branch.aff && !branch.blocks.length) { branch.aff = a; continue; }
          readProse(ln, branch.blocks);
        }
        branches.push(branch);
      }
      push({ k: "c", kind, q: qParts.join(" "), opts, branches });
      continue;
    }

    readProse(s, cur.blocks);
  }
  return chapters;
}

const out = {};
const report = [];
// Which protagonist "owns" a chapter → which 立绘 / score it uses. Pick the
// most-mentioned male lead; fall back to the heroine.
const LEADS = ["Shiro", "Hosea", "Jael", "Kye"];
function chapterLead(ch) {
  const blob = [];
  const walk = bs => bs.forEach(b => { blob.push(b.k === "s" ? b.who + " " + b.t : (b.t || "")); if (b.k === "c") b.branches.forEach(br => walk(br.blocks)); });
  walk(ch.blocks);
  const text = blob.join(" ");
  let best = null, bestN = 0;
  for (const L of LEADS) {
    const n = (text.match(new RegExp("\\b" + L + "\\b", "g")) || []).length;
    if (n > bestN) { bestN = n; best = L; }
  }
  return (best || "Sealyra").toLowerCase();
}
for (const s of SOURCES) {
  const chapters = parse(fs.readFileSync(path.join(SRC_DIR, s.file), "utf8"));
  chapters.forEach(c => { c.lead = chapterLead(c); });
  const cast = new Set();
  const walk = bs => bs.forEach(b => {
    if (b.k === "s") cast.add(b.who);
    if (b.k === "c") b.branches.forEach(br => walk(br.blocks));
  });
  chapters.forEach(c => walk(c.blocks));
  out[s.id] = { id: s.id, title: s.title, cast: [...cast].sort(), chapters };
  const ch = chapters.reduce((a, c) => a + c.blocks.filter(b => b.k === "c").length, 0);
  const br = chapters.reduce((a, c) => a + c.blocks.filter(b => b.k === "c")
                                        .reduce((x, b) => x + b.branches.length, 0), 0);
  report.push(`${s.id}: ${chapters.length} chapters, ${ch} choices, ${br} branches, cast ${cast.size}`);
}

const banner = "/* AUTO-GENERATED by tools/parse-paths.js — do not edit by hand.\n" +
               "   Re-run: node tools/parse-paths.js  (source in data/paths-source/) */\n";
fs.writeFileSync(OUT,
  banner +
  "const PATHS_STORY = " + JSON.stringify(out) + ";\n" +
  "if (typeof window !== 'undefined') window.PATHS_STORY = PATHS_STORY;\n");

console.log(report.join("\n"));
console.log("wrote", path.relative(path.join(__dirname, ".."), OUT));
