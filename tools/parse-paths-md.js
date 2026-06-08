#!/usr/bin/env node
/* ============================================================
   Parse the markdown Paths mainline (data/paths-source/mainline-25.md) — the
   author's 25-chapter draft WITH an explicit per-chapter BGM arrangement.

   Like 空白 10, the file uses U+2028/U+2029 inside lines, so once split on all
   terminators every speaker name, option (A./B./C.) and branch letter sits on
   its own segment. Markers:
     ## Chapter N · Title
     **Scene Tags:** …                 (ignored)
     **BGM:** then  - NN_track.mp3 — …  (ordered scene tracks)
     **Choice — Save** / **Choice — Affection**
     A./B./C. options · bare-letter branches · [Name ±N] · END./Continue.

   Emits data/paths-content.js (window.PATHS_STORY) and data/paths-bgm-tags.js
   (window.PATHS_BGM_TAGS). The ambient scene tracks (everything except the
   choice/result cues 2/13/14/28/29/30, which Views.vn fires automatically) are
   spread, in order, across each chapter's beats as direct paths/ filenames.
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const SRC = path.join(__dirname, "..", "data", "paths-source", "mainline-25.md");
const OUT_C = path.join(__dirname, "..", "data", "paths-content.js");
const OUT_T = path.join(__dirname, "..", "data", "paths-bgm-tags.js");

const SPLIT   = /[\r\n\u2028\u2029]/;
const CHAP    = /^##\s*Chapter\s+(\d+)\s*[·.]\s*(.+?)\s*$/;
const SCENE   = /^\*\*Scene Tags:/i;
const BGMHDR  = /^\*\*BGM:\*\*/i;
const CHOICE  = /^\*\*Choice\s*[—\-]\s*(Save|Affection)\*\*/i;
const OPT_RE  = /^([A-C])\.\s+(.*)$/;
const LETTER  = /^([ABC])$/;
const END_RE  = /^END\.$/, CONT_RE = /^Continue\.$/;
const AFFTAG  = /^\[\s*([A-Za-z][A-Za-z .'’-]*?)\s*([+\-−])\s*(\d+)\s*\]$/;
const NAME_RE = /^[A-Z][A-Za-z’']+(?: [A-Z][A-Za-z’']+){0,2}$/;
const TRACK   = /(\d{1,3})_[A-Za-z0-9_]+\.mp3/g;
const AUTO    = new Set([2, 13, 14, 28, 29, 30]);
const LEADS   = ["Shiro", "Hosea", "Jael", "Kye"];

const segs = fs.readFileSync(SRC, "utf8").split(SPLIT).map(s => s.trim());
const N = segs.length;

function isStructural(s) {
  return !s || CHAP.test(s) || CHOICE.test(s) || SCENE.test(s) || BGMHDR.test(s)
      || OPT_RE.test(s) || END_RE.test(s) || CONT_RE.test(s) || LETTER.test(s) || s.startsWith("-");
}
function affFrom(s) { const m = AFFTAG.exec(s); if (!m) return null; return { who: m[1].trim(), delta: (m[2] === "+" ? 1 : -1) * parseInt(m[3], 10) }; }

const chapters = [];
let cur = null, i = 0, inBgm = false;
function nextContent(j) { while (j < N && !segs[j]) j++; return j; }
function readProse(s, sink) {
  if (NAME_RE.test(s)) {
    const j = nextContent(i);
    if (j < N && !isStructural(segs[j])) { sink.push({ k: "s", who: s, t: segs[j] }); i = j + 1; return; }
  }
  sink.push({ k: "n", t: s });
}

while (i < N) {
  const s = segs[i]; i++;
  if (!s) continue;

  const cm = CHAP.exec(s);
  if (cm) { cur = { n: +cm[1], title: cm[2], blocks: [], bgm: [] }; chapters.push(cur); inBgm = false; continue; }
  if (!cur) continue;
  if (SCENE.test(s)) { inBgm = false; continue; }
  if (BGMHDR.test(s)) { inBgm = true; continue; }
  if (inBgm) {
    if (s.startsWith("-")) { let m; while ((m = TRACK.exec(s)) !== null) if (!AUTO.has(+m[1])) cur.bgm.push(m[0]); continue; }
    inBgm = false;   // first non-list segment ends the block; fall through
  }

  const ch = CHOICE.exec(s);
  if (ch) {
    const kind = /Affection/i.test(ch[1]) ? "affection" : "save";
    const qParts = [];
    while (i < N && !OPT_RE.test(segs[i])) { if (segs[i]) qParts.push(segs[i]); i++; }
    const opts = [];
    while (i < N && opts.length < 3) { const om = OPT_RE.exec(segs[i]); if (!om) break; opts.push({ key: om[1], t: om[2].trim() }); i++; }
    const branches = [];
    for (let b = 0; b < 3; b++) {
      i = nextContent(i);
      if (i >= N || !LETTER.test(segs[i])) break;
      const branch = { key: segs[i], aff: null, blocks: [], end: "CONTINUE" }; i++;
      while (i < N) {
        const bl = segs[i];
        if (END_RE.test(bl)) { branch.end = "END"; i++; break; }
        if (CONT_RE.test(bl)) { branch.end = "CONTINUE"; i++; break; }
        i++;
        if (!bl) continue;
        const a = affFrom(bl);
        if (a && !branch.aff && !branch.blocks.length) { branch.aff = a; continue; }
        readProse(bl, branch.blocks);
      }
      branches.push(branch);
    }
    cur.blocks.push({ k: "c", kind, q: qParts.join(" "), opts, branches });
    continue;
  }
  readProse(s, cur.blocks);
}

// ---- cast + chapter lead ----
const cast = new Set();
chapters.forEach(c => { const walk = bs => bs.forEach(b => { if (b.k === "s") cast.add(b.who); if (b.k === "c") b.branches.forEach(br => walk(br.blocks)); }); walk(c.blocks); });
function chapterLead(ch) {
  const blob = [];
  const walk = bs => bs.forEach(b => { blob.push(b.k === "s" ? b.who + " " + b.t : (b.t || "")); if (b.k === "c") b.branches.forEach(br => walk(br.blocks)); });
  walk(ch.blocks);
  const t = blob.join(" "); let best = null, n = 0;
  for (const L of LEADS) { const c = (t.match(new RegExp("\\b" + L + "\\b", "g")) || []).length; if (c > n) { n = c; best = L; } }
  return (best || "Sealyra").toLowerCase();
}

const out = { mainline: { id: "mainline", title: "The Paths", cast: [...cast].sort(), chapters: [] } };
const tags = { mainline: {} };
for (const ch of chapters) {
  ch.lead = chapterLead(ch);
  out.mainline.chapters.push({ n: ch.n, title: ch.title, lead: ch.lead, blocks: ch.blocks });
  const proseIdx = ch.blocks.map((b, k) => (b.k === "c" ? -1 : k)).filter(k => k >= 0);
  if (ch.bgm.length && proseIdx.length) {
    const seen = new Set(), clean = [];
    ch.bgm.forEach((trk, a) => {
      const at = proseIdx[Math.min(proseIdx.length - 1, Math.round(a * proseIdx.length / ch.bgm.length))];
      if (!seen.has(at)) { seen.add(at); clean.push([at, "paths/" + trk]); }
    });
    clean.sort((x, y) => x[0] - y[0]);
    tags.mainline[String(ch.n)] = clean;
  }
}

fs.writeFileSync(OUT_C,
  "/* AUTO-GENERATED by tools/parse-paths-md.js — do not edit by hand. */\n" +
  "const PATHS_STORY = " + JSON.stringify(out) + ";\n" +
  "if (typeof window !== 'undefined') window.PATHS_STORY = PATHS_STORY;\n");
fs.writeFileSync(OUT_T,
  "/* AUTO-GENERATED by tools/parse-paths-md.js — scene→track cues from the\n" +
  "   author's per-chapter **BGM:** arrangement (direct paths/ filenames;\n" +
  "   choice/result cues 2/13/14/28/29/30 are auto-fired in Views.vn). */\n" +
  "window.PATHS_BGM_TAGS = " + JSON.stringify(tags) + ";\n");

const nC = chapters.reduce((a, c) => a + c.blocks.filter(b => b.k === "c").length, 0);
const nB = chapters.reduce((a, c) => a + c.blocks.filter(b => b.k === "c").reduce((x, b) => x + b.branches.length, 0), 0);
const nT = Object.values(tags.mainline).reduce((a, l) => a + l.length, 0);
console.log(`${chapters.length} chapters, ${nC} choices, ${nB} branches, cast ${cast.size}, ${nT} bgm cues`);
