/* The Princess Lexicon — views.js
   One init(host, params) per view. The router clones the matching
   <template id="view-X"> into #stage, then calls Views.X.init(). */
const Views = (function () {

  /* shared helpers */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function cssEsc(s) {
    return String(s).replace(/["\\\n\r]/g, c =>
      c === '"' ? '\\"' : c === '\\' ? '\\\\' : '');
  }
  // Story entry hash. Story is LINEAR: tapping Story drops the
  // reader straight into the reading view — never into the chapter
  // index (which is for previewing, see browse=1 below). If progress
  // exists in tpl.lastRead, resume from there; otherwise start at the
  // first section of the first chapter.
  function storyEntryHash() {
    let last = null;
    try { last = JSON.parse(localStorage.getItem("tpl.lastRead") || "null"); }
    catch (_) {}
    if (last && last.chapter) {
      return `#reading?chapter=${encodeURIComponent(last.chapter)}`
           + `&section=${encodeURIComponent(last.section || "1.1")}`;
    }
    const first = (typeof CHAPTERS !== "undefined" && CHAPTERS[0]) || null;
    const chId  = first ? first.id : "universe";
    const sec   = first ? (first.firstSection || "1.1") : "1.1";
    return `#reading?chapter=${encodeURIComponent(chId)}`
         + `&section=${encodeURIComponent(sec)}`;
  }


  /* ---------- splash ----------
     The cover used to call window.go("#menu") the instant the tap
     bubbled to the global [data-go] delegate — no feedback, no
     ceremony, PowerPoint cut to the menu. The cover is now hand-
     wired here so we can:
       1. drift a layer of randomised "stardust" up the page on a
          loop (the wallpaper-engine-style pseudo-animation the
          user asked for);
       2. emit a 3-ring + central-burst water-ripple from the
          actual tap point on press;
       3. fade the cover out under the ripple before navigating. */
  const splash = {
    init(host) {
      // ----- Idle layer: drifting stardust ---------------------------
      for (let i = 0; i < 14; i++) {
        const s = document.createElement("div");
        s.className = "splash-sparkle";
        s.style.setProperty("--x",     (Math.random() * 96 + 2) + "%");
        s.style.setProperty("--d",     (11 + Math.random() * 11) + "s");
        s.style.setProperty("--delay", (-Math.random() * 12) + "s");
        s.style.setProperty("--sz",    (3 + Math.random() * 5) + "px");
        s.style.setProperty("--drift", ((Math.random() - 0.5) * 50) + "px");
        host.appendChild(s);
      }

      // ----- Tap-to-begin water ripple --------------------------------
      const hit = host.querySelector(".splash-hit");
      if (!hit) return;
      let fired = false;
      hit.addEventListener("click", (e) => {
        if (fired) return;
        fired = true;
        e.preventDefault();
        e.stopPropagation();
        const rect = hit.getBoundingClientRect();
        const fx = ((e.clientX - rect.left) / rect.width)  * 100;
        const fy = ((e.clientY - rect.top)  / rect.height) * 100;
        function ring(cls, delay) {
          const r = document.createElement("div");
          r.className = cls;
          r.style.left = fx + "%";
          r.style.top  = fy + "%";
          r.style.animationDelay = delay + "ms";
          host.appendChild(r);
        }
        ring("splash-ripple-center", 0);
        ring("splash-ripple-ring",   60);
        ring("splash-ripple-ring",   220);
        ring("splash-ripple-ring",   380);
        setTimeout(() => host.classList.add("is-leaving"), 240);
        setTimeout(() => window.go("#menu"), 820);
      });
    },
  };


  /* ---------- menu ---------- */
  const menu = {
    init(host) {
      // === button click + 4-layer antique feedback ==================
      // Layer 1 (hover)      → CSS only, mouse-only (iPad has no hover)
      // Layer 2 (press sink) → CSS only, .menu-btn:active rule
      // Layer 3 (gold ripple)→ ::after on .menu-btn, pointerdown fires
      // Layer 4 (badge bless)→ .is-activated class; the bigger blessing
      //                        + expanding ring play for 820ms before
      //                        navigation hands off to the page-turn.
      // A short warm bell tone fires on click for auditory "opening".
      function playBookChime() {
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          const ctx = new Ctx();
          // Two-note rising: G5 → C6, soft triangle wave, sustained
          // partial overtone for a small bell colour. ~520ms total.
          const notes = [783.99, 1046.50];
          const now = ctx.currentTime;
          notes.forEach((f, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "triangle"; o.frequency.value = f;
            const t0 = now + i * 0.08;
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.5);
            o.connect(g).connect(ctx.destination);
            o.start(t0); o.stop(t0 + 0.55);
          });
          // Light overtone for the warm-bell colour.
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.type = "sine"; o2.frequency.value = 1567.98;
          g2.gain.setValueAtTime(0, now);
          g2.gain.linearRampToValueAtTime(0.06, now + 0.04);
          g2.gain.exponentialRampToValueAtTime(0.0006, now + 0.45);
          o2.connect(g2).connect(ctx.destination);
          o2.start(now); o2.stop(now + 0.5);
          setTimeout(() => { try { ctx.close(); } catch (_) {} }, 1100);
        } catch (_) {}
      }
      host.querySelectorAll(".menu-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const a = btn.dataset.action;
          btn.classList.remove("is-activated");
          void btn.offsetWidth;
          btn.classList.add("is-activated");
          playBookChime();
          // Hold for ~600ms so the blessing's mid-flare hits the eye
          // before the page-turn animation begins. 820ms total anim;
          // hand off after the brightest moment.
          setTimeout(() => {
            if (a === "resume") window.go("#select");
            else                window.go("#chapters?browse=1");
          }, 600);
        });
        btn.addEventListener("pointerdown", (e) => {
          const rect = btn.getBoundingClientRect();
          if (!rect.width) return;
          const x = ((e.clientX - rect.left) / rect.width)  * 100;
          const y = ((e.clientY - rect.top)  / rect.height) * 100;
          btn.style.setProperty("--ripple-x", x + "%");
          btn.style.setProperty("--ripple-y", y + "%");
          btn.classList.remove("is-clicking");
          void btn.offsetWidth;
          btn.classList.add("is-clicking");
        });
        btn.addEventListener("animationend", (e) => {
          if (e.animationName === "menu-btn-ripple")     btn.classList.remove("is-clicking");
          if (e.animationName === "menu-badge-blessing") btn.classList.remove("is-activated");
        });
      });

      // === sparkles — explicit coords per the painting spec ==========
      // All point lists below are PIXEL coords on the 1536×1151
      // reference screenshot; converted to % inline (the painting
      // aspect ~1.334 matches the .page 1448×1086 ~1.333 closely
      // enough that the % mapping lands within 1px on the iPad).
      // Spread is now LEFT+RIGHT heavy per the user's complaint that
      // stars were "all crammed in the middle". 50 explicit coords
      // + 15 randomised dust particles in the night-sky region.
      const W = 1536, H = 1151;
      const px = (x) => (x / W * 100) + "%";
      const py = (y) => (y / H * 100) + "%";
      function spawnStar(x, y, opt) {
        const layer = host.querySelector(".cover-bg-layer");
        if (!layer) return;
        const s = document.createElement("div");
        s.className = "menu-star" + (opt.cross ? " is-cross" : "");
        s.style.setProperty("--x", px(x));
        s.style.setProperty("--y", py(y));
        s.style.setProperty("--sz", opt.size + "px");
        s.style.setProperty("--d", opt.dur + "s");
        s.style.setProperty("--delay", (-Math.random() * 5) + "s");
        if (opt.cross) s.textContent = "✦";
        layer.appendChild(s);
      }
      function rnd(lo, hi) { return lo + Math.random() * (hi - lo); }

      // --- LEFT half night sky (11 dots, 4 crosses) ---
      [
        [430, 214], [521, 207], [566, 229], [608, 245],
        [442, 286], [540, 343], [632, 334],
        [425, 394], [548, 458], [603, 482], [642, 520],
      ].forEach(([x, y]) =>
        spawnStar(x, y, { size: rnd(2, 4), dur: rnd(3.2, 5.5) }));
      [
        [472, 191], [490, 322], [594, 365], [479, 434],
      ].forEach(([x, y]) =>
        spawnStar(x, y, { cross: true, size: rnd(9, 13), dur: rnd(2.8, 5.5) }));

      // --- RIGHT half night sky (10 dots, 5 crosses) ---
      [
        [927, 214], [1027, 208], [1074, 233], [1116, 254],
        [915, 291], [1020, 346], [1110, 338],
        [907, 397], [1018, 462], [1104, 523],
      ].forEach(([x, y]) =>
        spawnStar(x, y, { size: rnd(2, 4), dur: rnd(3.2, 5.5) }));
      [
        [978, 192], [967, 322], [1072, 366], [958, 433], [1070, 490],
      ].forEach(([x, y]) =>
        spawnStar(x, y, { cross: true, size: rnd(9, 13), dur: rnd(2.8, 5.5) }));

      // --- MID-UPPER passage (sparse, all small dots) ---
      [
        [681, 214], [735, 198], [793, 202], [848, 219],
        [705, 274], [776, 254], [846, 279], [740, 326],
      ].forEach(([x, y]) =>
        spawnStar(x, y, { size: rnd(1.8, 3), dur: rnd(3.5, 5.8) }));

      // --- MOON halo (3 small dots, 1 cross flanking the moon) ---
      [
        [548, 251], [563, 308], [520, 295],
      ].forEach(([x, y]) =>
        spawnStar(x, y, { size: rnd(2, 3), dur: rnd(3.0, 5.0) }));
      spawnStar(586, 267, { cross: true, size: rnd(8, 11), dur: rnd(3.0, 5.0) });

      // --- WAND tip surround (5 dots, 3 crosses) ---
      [
        [639, 417], [678, 451], [635, 446], [699, 445], [652, 458],
      ].forEach(([x, y]) =>
        spawnStar(x, y, { size: rnd(2, 3.5), dur: rnd(2.5, 4.0) }));
      [
        [652, 405], [676, 412], [689, 430],
      ].forEach(([x, y]) =>
        spawnStar(x, y, { cross: true, size: rnd(8, 11), dur: rnd(2.5, 4.0) }));

      // --- DUST: 15 randomised sub-2px specks scattered through
      //     the night-sky region for the deep-field atmospheric
      //     density (no specific coords, just fills the gaps so the
      //     sky doesn't read as 50 isolated points). Distribution
      //     biased to the left+right halves like the explicit set.
      for (let i = 0; i < 15; i++) {
        const sideLeft = Math.random() < 0.5;
        const x = sideLeft ? rnd(410,  660) : rnd(880, 1140);
        const y = rnd(195, 545);
        spawnStar(x, y, { size: rnd(0.9, 1.8), dur: rnd(4.5, 7.5) });
      }
    },
  };


  /* ---------- select ---------- */
  const select = {
    init(host) {
      function playSelectChime() {
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          const ctx = new Ctx();
          const notes = [659.25, 880.00, 1318.51];
          const now = ctx.currentTime;
          notes.forEach((f, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "sine"; o.frequency.value = f;
            const t0 = now + i * 0.10;
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.16, t0 + 0.018);
            g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.65);
            o.connect(g).connect(ctx.destination);
            o.start(t0); o.stop(t0 + 0.7);
          });
          setTimeout(() => { try { ctx.close(); } catch (_) {} }, 1300);
        } catch (_) {}
      }
      const HOT_TO_TITLE = {
        "zone-select-story-hit":  ".zone-select-story-title",
        "zone-select-notes-hit":  ".zone-select-notes-title",
        "zone-select-garden-hit": ".zone-select-garden-title",
      };
      host.querySelectorAll(".select-hotspot").forEach(el => {
        el.addEventListener("click", (e) => {
          // Stop the global [data-go] delegate from also firing — we
          // want the 380 ms chime to play before nav, not be skipped.
          e.stopPropagation();
          const titleSel = Object.entries(HOT_TO_TITLE)
            .find(([cls]) => el.classList.contains(cls))?.[1];
          const titleEl = titleSel && host.querySelector(titleSel);
          if (titleEl) {
            titleEl.classList.remove("is-pressed");
            void titleEl.offsetWidth;
            titleEl.classList.add("is-pressed");
          }
          playSelectChime();
          const dest = el.dataset.action === "resume"
                     ? storyEntryHash()
                     : el.dataset.go;
          setTimeout(() => window.go(dest), 380);
        });
      });
    },
  };


  /* ---------- chapters ---------- */
  const chapters = {
    init(host, params) {
      const browse = params.browse === "1";
      const browseFlag = browse ? "&browse=1" : "";
      if (typeof CHAPTERS === "undefined") return;
      CHAPTERS.forEach((c) => {
        const text = host.querySelector(".zone-toc-" + c.number);
        const btn  = host.querySelector(".zone-toc-btn-" + c.number);
        if (text) text.innerHTML = `
          <div class="toc-card-text">
            <p class="toc-card-tagline">${esc(c.tagline || "")}</p>
          </div>`;
        if (btn) btn.innerHTML = `
          <button type="button" class="antique-button toc-open-btn"
                  data-go="#reading?chapter=${encodeURIComponent(c.id)}&section=${encodeURIComponent(c.firstSection || "1.1")}${browseFlag}">
            <span class="antique-button-corner tl"></span>
            <span class="antique-button-corner tr"></span>
            <span class="antique-button-corner bl"></span>
            <span class="antique-button-corner br"></span>
            <span class="antique-button-label">Open Chapter</span>
          </button>`;
      });
    },
  };


  /* ---------- reading ---------- */
  function markClickable(sentence) {
    const used = new Set();
    return sentence.replace(/[A-Za-z][a-zA-Z'-]*/g, (m) => {
      const lc = m.toLowerCase();
      if (used.has(lc) || !hasClickableWord(lc)) return m;
      used.add(lc);
      return `<span class="clickable-word" data-word="${lc}">${m}</span>`;
    });
  }
  function getPhrasePairs(entry) {
    const out = [];
    if (Array.isArray(entry.phrases)) {
      for (const p of entry.phrases) {
        if (out.length >= 2) break;
        if (p && p.en && p.zh) out.push({ en: p.en, zh: p.zh });
      }
    }
    if (out.length < 2 && Array.isArray(entry.kin)) {
      for (const k of entry.kin) {
        if (out.length >= 2) break;
        if (k && typeof k === "object" && Array.isArray(k.phrases)) {
          for (const p of k.phrases) {
            if (out.length >= 2) break;
            if (p && p.en && p.zh) out.push({ en: p.en, zh: p.zh });
          }
        }
      }
    }
    if (out.length < 2 && Array.isArray(entry.friend)) {
      for (const f of entry.friend) {
        if (out.length >= 2) break;
        if (typeof f === "string") {
          const m = f.match(/^(.+?)\s+([一-鿿].*)$/);
          if (m) out.push({ en: m[1].trim(), zh: m[2].trim() });
        }
      }
    }
    if (out.length < 2 && Array.isArray(entry.collocations)) {
      for (const c of entry.collocations) {
        if (out.length >= 2) break;
        if (typeof c === "string") out.push({ en: c, zh: "" });
      }
    }
    return out;
  }

  const reading = {
    init(host, params) {
      const chapterId  = params.chapter || "universe";
      const sectionNum = params.section || "1.1";
      const illustrationId = params.page || null;
      const book    = (typeof getChapterOrDefault === "function")
                       ? getChapterOrDefault(chapterId) : { number: "01", title: chapterId };
      const section = ChapterNav.findSection(chapterId, sectionNum);
      const isBrowse = params.browse === "1";

      if (!isBrowse) {
        try {
          localStorage.setItem("tpl.lastRead", JSON.stringify({
            chapter: chapterId, section: sectionNum,
            page: illustrationId, at: Date.now(),
          }));
        } catch (_) {}
      }

      const bg = typeof getChapterBackground === "function"
                 ? getChapterBackground(chapterId, illustrationId) : null;
      if (bg) host.style.backgroundImage = `url("${bg}")`;

      host.querySelector("[data-chapter-number]").textContent = "Chapter " + book.number;
      host.querySelector("[data-chapter-title]").textContent  = book.title;
      host.querySelector("[data-chapter-section]").textContent =
        section ? (section.number + " · " + section.title) : sectionNum;

      const body = host.querySelector(".reading-body");
      if (section && section.blocks && section.blocks.length) {
        body.innerHTML = section.blocks.map((sent, i) => {
          const audio = `${section.audio_prefix}-${i + 1}.mp3`;
          return `<p class="reveal-block" data-audio="${audio}">${markClickable(sent)}</p>`;
        }).join("");
      } else {
        body.innerHTML = `<p class="reveal-block">No content available yet for this section.</p>`;
      }

      function currentEntryFromStack() {
        const cur = host.querySelector(".word-card.is-current");
        if (!cur) return null;
        const id = cur.dataset.id;
        return (typeof WORDS !== "undefined" && WORDS.find(w => (w.id || w.word) === id))
            || (typeof WORD_LIBRARY !== "undefined" && WORD_LIBRARY.find(w => (w.id || w.word) === id))
            || null;
      }

      function clearCurrent(stack) {
        stack.querySelectorAll(".word-card.is-current")
             .forEach(c => c.classList.remove("is-current"));
      }
      function shortMeaning(entry) { return entry.meaning || ""; }

      function renderMarginalia(resolved) {
        const stack = host.querySelector(".word-card-stack");
        if (!stack) return;
        const entry = (resolved && (resolved.clickEntry || resolved.headEntry));
        if (!entry) return;
        const id = entry.id || entry.word;

        const empty = stack.querySelector(".word-card-empty");
        if (empty) empty.remove();

        const existing = stack.querySelector(`.word-card[data-id="${cssEsc(id)}"]`);
        if (existing) {
          clearCurrent(stack);
          existing.classList.add("is-current");
          existing.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return;
        }

        // Right-column block layout (user spec):
        //   单词 / 翻译 / 词组 翻译 / 词组 翻译 / (例句 if present)
        const phrases = getPhrasePairs(entry);
        const phraseRows = phrases.slice(0, 2).map(p => `
          <div class="word-card-phrase">
            <span class="wcp-en">${esc(p.en)}</span>
            ${p.zh ? `<span class="wcp-zh">${esc(p.zh)}</span>` : ""}
          </div>
        `).join("");
        const exEn = entry.example || "";
        const exZh = entry.exampleZh || entry.example_zh || "";
        const exampleRow = exEn ? `
          <div class="word-card-example">
            <span class="wce-en">${esc(exEn)}</span>
            ${exZh ? `<span class="wce-zh">${esc(exZh)}</span>` : ""}
          </div>` : "";

        const savedAlready = Storage.isSaved(id);
        const html = `
          <div class="word-card is-current is-entering${savedAlready ? " is-saved" : ""}" data-id="${esc(id)}">
            <div class="word-card-headword">${esc(entry.word || id)}</div>
            <div class="word-card-meaning">${esc(shortMeaning(entry))}</div>
            ${phraseRows}
            ${exampleRow}
          </div>`;
        clearCurrent(stack);
        stack.insertAdjacentHTML("beforeend", html);

        const fresh = stack.lastElementChild;
        // Strip the entry-animation class once the keyframe completes
        // so re-tapping the same card later doesn't replay it.
        setTimeout(() => fresh.classList.remove("is-entering"), 620);
        const drawerEntry = resolved.headEntry || entry;
        fresh.addEventListener("click", (e) => {
          e.stopPropagation();
          clearCurrent(stack);
          fresh.classList.add("is-current");
          if (typeof WordCard !== "undefined" && drawerEntry) {
            WordCard.openDrawer(drawerEntry);
          }
        });
        fresh.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }

      function syncMarginaliaButtons(entry) {
        const fold = host.querySelector('.marginalia-btn[data-action="fold"]');
        if (!fold) return;
        if (!entry) {
          fold.disabled = true; fold.classList.remove("is-active"); return;
        }
        const id = entry.id || entry.word;
        if (Storage.isSaved(id)) { fold.disabled = true;  fold.classList.add("is-active"); }
        else                     { fold.disabled = false; fold.classList.remove("is-active"); }
      }

      renderMarginalia(null);

      // Locket — the running count of folded words. Visible, growing
      // progress is a small but reliable engagement loop. Sync on
      // enter so the chip already shows the player's running total.
      function syncLocket(pop) {
        const el = host.querySelector("[data-saved-count]");
        if (!el) return;
        el.textContent = String(Storage.getNotes().length);
        if (pop) {
          const locket = el.closest(".marginalia-locket");
          if (locket) {
            locket.classList.remove("is-pop");
            void locket.offsetWidth;
            locket.classList.add("is-pop");
          }
        }
      }
      syncLocket(false);

      const fold = host.querySelector('.marginalia-btn[data-action="fold"]');
      if (fold) fold.addEventListener("click", (e) => {
        e.stopPropagation();
        const entry = currentEntryFromStack();
        if (!entry) return;
        const id = entry.id || entry.word;
        if (Storage.isSaved(id)) return;
        Storage.saveWord(id);
        syncMarginaliaButtons(entry);
        window.toast && window.toast("Folded into Notes");
        // Golden flash on the current card + persistent ❦ saved
        // indicator. Tactile feedback that the press actually did
        // something — without this, FOLD felt PowerPoint-y.
        const card = host.querySelector(".word-card.is-current");
        if (card) {
          card.classList.add("is-saved", "just-folded");
          setTimeout(() => card.classList.remove("just-folded"), 740);
        }
        syncLocket(true);
      });

      // Spawn a small burst of warm-gold particles at (clientX, clientY).
      // Coordinates are resolved into PERCENT of host's bounding rect so
      // they survive the .stage scale transform. Each sparkle is added
      // directly to host (the .page) and removed when its animation
      // completes — no global cleanup loop, no leak.
      function spawnWordSparkles(clientX, clientY) {
        const rect = host.getBoundingClientRect();
        if (!rect.width) return;
        const fx = ((clientX - rect.left) / rect.width)  * 100;
        const fy = ((clientY - rect.top)  / rect.height) * 100;
        for (let i = 0; i < 5; i++) {
          const s = document.createElement("div");
          s.className = "word-tap-sparkle";
          s.style.left = fx + "%";
          s.style.top  = fy + "%";
          s.style.setProperty("--ang",   (Math.random() * 360) + "deg");
          s.style.setProperty("--dist",  (24 + Math.random() * 38) + "px");
          s.style.animationDelay = (i * 24) + "ms";
          host.appendChild(s);
          setTimeout(() => { try { s.remove(); } catch (_) {} }, 880);
        }
      }

      body.addEventListener("click", (e) => {
        const el = e.target.closest(".clickable-word");
        if (!el) return;
        e.stopPropagation();
        spawnWordSparkles(e.clientX, e.clientY);
        host.querySelectorAll(".clickable-word.is-selected")
            .forEach(x => x.classList.remove("is-selected"));
        el.classList.add("is-selected");
        const resolved = (typeof resolveClickedWord === "function")
                         ? resolveClickedWord(el.dataset.word) : null;
        // Tapping a word in the text only fills the right-column card
        // (word / 翻译 / 词组 / 翻译 / 例句). The full word-card DRAWER
        // is opened by a SECOND tap on that right-column block — wired
        // up per-card inside renderMarginalia(). Do NOT auto-open the
        // drawer here.
        renderMarginalia(resolved);
        syncMarginaliaButtons(currentEntryFromStack());
        try {
          const entry = (resolved && (resolved.clickEntry || resolved.headEntry));
          const phrases = entry ? getPhrasePairs(entry).slice(0, 2) : [];
          const parts = [el.textContent, ...phrases.map(p => p.en)].filter(Boolean);
          TTS.speak(parts.join(". "));
        } catch (_) {}
      });

      host.addEventListener("click", (e) => {
        if (e.target.closest(".word-card")) {
          setTimeout(() => syncMarginaliaButtons(currentEntryFromStack()), 0);
        }
      });

      // Reveal blocks — tap anywhere on .page reveals next block; first
      // tap also reveals the chapter title block and reads the title +
      // section heading before the first paragraph.
      const blocks = Array.from(body.querySelectorAll(".reveal-block"));
      let nextIdx = 0;
      const firstBlock = blocks[0];
      if (firstBlock) {
        const t1 = (host.querySelector("[data-chapter-title]")?.textContent || "").trim();
        const t2 = (host.querySelector("[data-chapter-section]")?.textContent || "").trim();
        const intro = [t1, t2].filter(Boolean).join(". ");
        firstBlock.dataset.speakText = intro
          ? `${intro}. ${firstBlock.textContent}`
          : firstBlock.textContent;
      }
      function revealNext() {
        if (nextIdx >= blocks.length) return;
        const b = blocks[nextIdx++];
        b.classList.add("is-revealed");
        if (!b.querySelector(".ink-ripple")) {
          const r = document.createElement("span");
          r.className = "ink-ripple"; b.appendChild(r);
        }
        if (nextIdx === 1) {
          host.querySelector(".zone-reading-title")?.classList.add("is-revealed");
        }
        TTS.speak(b.dataset.speakText || b.textContent);
      }
      host.addEventListener("click", (e) => {
        if (e.target.closest("button, a, .clickable-word, .side-note-button,"
                           + " .marginalia-card, .word-card, input, select, textarea")) return;
        revealNext();
      });

      // Browse / preview mode (entered from the chapter index): no
      // Save, no Load, no Quiz (anti-cheat), and Next advances to the
      // NEXT CHAPTER instead of into the section's quiz. The index is
      // for browsing previews of chapters, not graded reading.
      if (isBrowse) {
        const nav = host.querySelector(".ui-bottom-nav");
        if (nav) {
          nav.querySelectorAll(
            '[data-go="#save"], [data-go="#load"], [data-quiz]'
          ).forEach(b => b.remove());
          // After removing Save/Load/Quiz from the 5-cell reading
          // nav, only Next + Menu remain → 2 cells, evenly split.
          // (Previously had --nav-count: 3, which left an empty
          // 3rd cell and shoved Next/Menu off-centre.)
          nav.style.setProperty("--nav-count", "2");
        }
      }

      const next = host.querySelector("[data-next]");
      if (next) next.addEventListener("click", (e) => {
        e.stopPropagation();
        if (isBrowse) {
          if (typeof CHAPTERS !== "undefined") {
            const i = CHAPTERS.findIndex(c => c.id === chapterId);
            if (i >= 0 && i + 1 < CHAPTERS.length) {
              const nb = CHAPTERS[i + 1];
              window.go(
                `#reading?chapter=${encodeURIComponent(nb.id)}`
                + `&section=${encodeURIComponent(nb.firstSection || "1.1")}`
                + `&browse=1`
              );
              return;
            }
          }
          window.go("#chapters?browse=1");
          return;
        }
        window.go(ChapterNav.nextAfterReading(chapterId, sectionNum));
      });
      const quizBtn = host.querySelector("[data-quiz]");
      if (quizBtn) quizBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.go(`#quiz?chapter=${encodeURIComponent(chapterId)}&section=${encodeURIComponent(sectionNum)}`);
      });
    },
  };


  /* ---------- quiz ---------- */
  const quiz = {
    init(host, params) {
      const LETTER = ["A", "B", "C", "D"];
      const chapterId  = params.chapter || "universe";
      const sectionNum = params.section || "1.1";
      const book    = (typeof getChapterOrDefault === "function")
                       ? getChapterOrDefault(chapterId) : { number: "01", title: chapterId };
      const section = ChapterNav.findSection(chapterId, sectionNum);

      const bg = typeof getChapterBackground === "function"
                 ? getChapterBackground(chapterId, params.page) : null;
      if (bg) host.style.backgroundImage = `url("${bg}")`;

      host.querySelector("[data-chapter-number]").textContent = "Chapter " + book.number;
      host.querySelector("[data-chapter-title]").textContent  = book.title;
      host.querySelector("[data-chapter-section]").textContent =
        section ? (section.number + " · " + section.title) : sectionNum;

      function shuffle(arr, seed) {
        const a = arr.slice(); let s = seed;
        for (let i = a.length - 1; i > 0; i--) {
          s = (s * 9301 + 49297) % 233280;
          const j = Math.floor((s / 233280) * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      }
      function poolFor(section) {
        const tokens = new Set();
        const text = (section.blocks || []).join(" ");
        const m = text.match(/\b[A-Za-z][A-Za-z'-]{3,}\b/g) || [];
        for (const t of m) tokens.add(t.toLowerCase());
        for (const q of section.quiz || []) tokens.add(String(q.a).toLowerCase());
        const STOP = new Set(["that","this","with","from","into","were","have","been",
          "their","they","them","what","which","when","than","such","also","upon",
          "between","because","while","after","before","about","every","other","more",
          "only","some","most","each","over","under","still","never","always","could",
          "would","should","might","there","these","those","where"]);
        for (const w of STOP) tokens.delete(w);
        return Array.from(tokens);
      }
      function buildOptions(answer, pool) {
        const norm = (s) => String(s || "").trim().toLowerCase();
        const distractors = [];
        for (const w of pool) {
          if (distractors.length >= 3) break;
          const ww = String(w).trim();
          if (!ww) continue;
          if (norm(ww) === norm(answer)) continue;
          if (distractors.some(d => norm(d) === norm(ww))) continue;
          distractors.push(ww);
        }
        while (distractors.length < 3) distractors.push("—");
        return shuffle([answer, ...distractors], answer.length || 1);
      }
      function renderItem(q, idx, pool, audioPrefix) {
        const opts = buildOptions(q.a, pool);
        // No .reveal-block here on purpose — earlier the class made
        // the question text 10%-opacity warm-grey by default ("invisible
        // ink"), so a player who hadn't tapped the page first couldn't
        // see anything. Quiz prompts need to be readable on entry.
        return `
          <article class="quiz-item" data-answer="${esc(q.a)}"
                   data-solved="0"
                   data-audio="${esc(audioPrefix)}-q${idx + 1}.mp3">
            <div class="quiz-no">Question ${idx + 1}</div>
            <p class="quiz-question">${esc(q.q)}</p>
            <ul class="quiz-options">
              ${opts.map((o, i) => `
                <li class="quiz-option" data-value="${esc(o)}">
                  <span class="quiz-option-letter">${LETTER[i]}.</span>
                  <span class="quiz-option-text">${esc(o)}</span>
                </li>
              `).join("")}
            </ul>
          </article>`;
      }
      function playSuccessChord() {
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          const ctx = new Ctx();
          const notes = [523.25, 659.25, 783.99, 1046.50];
          const now = ctx.currentTime;
          notes.forEach((f, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "sine"; o.frequency.value = f;
            const t0 = now + i * 0.18;
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.18, t0 + 0.025);
            g.gain.exponentialRampToValueAtTime(0.0008, t0 + 1.05);
            o.connect(g).connect(ctx.destination);
            o.start(t0); o.stop(t0 + 1.15);
          });
          setTimeout(() => { try { ctx.close(); } catch (_) {} }, 2400);
        } catch (_) {}
      }
      // Short, bright two-note "ding" played on EACH correct answer
      // (the 4-note chord is reserved for whole-chapter completion).
      function playCorrectDing() {
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          const ctx = new Ctx();
          const notes = [783.99, 1174.66]; // G5 → D6, a happy rising 5th
          const now = ctx.currentTime;
          notes.forEach((f, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "triangle"; o.frequency.value = f;
            const t0 = now + i * 0.10;
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.22, t0 + 0.015);
            g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.42);
            o.connect(g).connect(ctx.destination);
            o.start(t0); o.stop(t0 + 0.5);
          });
          setTimeout(() => { try { ctx.close(); } catch (_) {} }, 1000);
        } catch (_) {}
      }
      function showToast({ title, subtitle, ms = 1400 }) {
        const t = host.querySelector(".chapter-complete-toast");
        if (!t) return;
        t.querySelector(".chapter-complete-title").textContent    = title;
        t.querySelector(".chapter-complete-subtitle").textContent = subtitle;
        t.setAttribute("aria-hidden", "false");
        t.classList.add("is-visible");
        if (ms > 0) setTimeout(() => {
          t.classList.remove("is-visible");
          t.setAttribute("aria-hidden", "true");
        }, ms);
      }

      const pool  = section ? poolFor(section) : [];
      const items = (section && section.quiz) ? section.quiz : [];
      const body = host.querySelector(".quiz-body");
      body.innerHTML = items.length
        ? items.map((q, i) => renderItem(q, i, pool, section.audio_prefix)).join("")
        : `<div class="empty-state">No quiz available yet for this section.</div>`;

      function speakItem(item) {
        if (!item) return;
        const q = (item.querySelector(".quiz-question")?.textContent || "").trim();
        const opts = Array.from(item.querySelectorAll(".quiz-option-text"))
                       .map(el => el.textContent.trim()).filter(Boolean);
        const parts = [q];
        opts.forEach((o, i) => parts.push(`${LETTER[i]}. ${o}`));
        try { TTS.speak(parts.join(". ")); } catch (_) {}
      }
      let lastSpokenIdx = -1;
      function showThrough(n) {
        const all = host.querySelectorAll(".quiz-item");
        all.forEach((it, i) => it.classList.toggle("is-shown", i <= n));
        // Auto-read the newly-revealed question (and its options) so the
        // player can start without tapping. Only re-speak if we've
        // actually advanced past the last one we read.
        if (n > lastSpokenIdx) {
          lastSpokenIdx = n;
          const item = all[n];
          // Tiny delay so the fade-in starts before the voice kicks in
          // — feels more like the page is reading itself to you.
          setTimeout(() => speakItem(item), 220);
        }
      }
      showThrough(0);

      let advancing = false;
      let backingOut = false;

      function allCorrect() {
        const itemEls = host.querySelectorAll(".quiz-item");
        if (!itemEls.length) return false;
        return Array.from(itemEls).every(it => it.dataset.solved === "1");
      }
      // Star-burst helper. n stars fly radially out from the
      // center; angle / distance / size / phase-delay all randomised
      // so the visual never reads as identical loops. Also drops a
      // pulsing halo ring. Pure-CSS keyframes + auto-cleanup.
      function spawnStarBurst(n) {
        for (let i = 0; i < n; i++) {
          const s = document.createElement("div");
          s.className = "chapter-star";
          s.style.setProperty("--ang",  (Math.random() * 360) + "deg");
          s.style.setProperty("--dist", (160 + Math.random() * 240) + "px");
          s.style.setProperty("--sz",   (8 + Math.random() * 10) + "px");
          s.style.animationDelay = (Math.random() * 220) + "ms";
          host.appendChild(s);
          setTimeout(() => { try { s.remove(); } catch (_) {} }, 1700);
        }
        const halo = document.createElement("div");
        halo.className = "chapter-halo";
        host.appendChild(halo);
        setTimeout(() => { try { halo.remove(); } catch (_) {} }, 1450);
      }
      function isLastSectionOfChapter() {
        const list = ChapterNav.sectionsOf(chapterId);
        if (!list.length) return true;
        const i = list.findIndex(s => s.number === sectionNum);
        return i === list.length - 1;
      }
      function maybeChapterComplete() {
        if (advancing || !allCorrect()) return;
        advancing = true;
        const last = isLastSectionOfChapter();
        // Different reward weight depending on what's being closed.
        // A full chapter gets the 4-note chord, 16 stars, and a
        // longer celebration window. A single section gets 8 stars
        // and the brighter 2-note rising ding.
        if (last) {
          spawnStarBurst(16);
          showToast({
            title:    "Chapter Complete",
            subtitle: "The next chapter opens.",
            ms: 0,
          });
          playSuccessChord();
          setTimeout(() => {
            window.go(ChapterNav.nextAfterQuiz(chapterId, sectionNum));
          }, 1900);
        } else {
          spawnStarBurst(8);
          showToast({
            title:    "Section Cleared",
            subtitle: "Onwards to the next page.",
            ms: 0,
          });
          playCorrectDing();
          setTimeout(() => {
            window.go(ChapterNav.nextAfterQuiz(chapterId, sectionNum));
          }, 1300);
        }
      }

      body.addEventListener("click", (e) => {
        const opt = e.target.closest(".quiz-option");
        if (!opt || opt.classList.contains("is-locked")) return;
        e.stopPropagation();
        const item = opt.closest(".quiz-item");
        if (item.dataset.solved === "1") return;
        const answer = item.dataset.answer.toLowerCase().trim();
        const chosen = (opt.dataset.value || "").toLowerCase().trim();
        const correct = chosen === answer;
        item.querySelectorAll(".quiz-option.is-selected")
          .forEach(o => o.classList.remove("is-selected"));
        if (correct) {
          opt.classList.add("is-correct", "is-locked");
          item.dataset.solved = "1";
          item.querySelectorAll(".quiz-option").forEach(o => o.classList.add("is-locked"));
          // Happy feedback: a bright ding + a little gold sparkle on the
          // chosen option, then read the word the player got right.
          playCorrectDing();
          opt.classList.remove("is-pop"); void opt.offsetWidth; opt.classList.add("is-pop");
          try { TTS.speak(opt.dataset.value || opt.textContent || ""); } catch (_) {}
          const all = Array.from(host.querySelectorAll(".quiz-item"));
          const idx = all.indexOf(item);
          // Give the spoken word a beat before sliding the next question
          // in (which would otherwise cancel() the utterance mid-word).
          if (idx + 1 < all.length) setTimeout(() => showThrough(idx + 1), 900);
          else maybeChapterComplete();
        } else {
          if (backingOut) return;
          backingOut = true;
          opt.classList.add("is-wrong", "is-locked");
          try { TTS.speak(opt.dataset.value || opt.textContent || ""); } catch (_) {}
          const backHref = ChapterNav.prevBeforeQuiz(chapterId, sectionNum);
          setTimeout(() => window.go(backHref), 1500);
        }
      });

      const back = host.querySelector("[data-back]");
      if (back) back.addEventListener("click", (e) => {
        e.stopPropagation();
        window.go(ChapterNav.prevBeforeQuiz(chapterId, sectionNum));
      });
      const next = host.querySelector("[data-next]");
      if (next) next.addEventListener("click", (e) => {
        e.stopPropagation();
        if (allCorrect()) maybeChapterComplete();
        else showToast({
          title: "Answer the Questions",
          subtitle: "Choose the correct option for each.",
          ms: 1400,
        });
      });
    },
  };


  /* ---------- notes ---------- */
  const notes = {
    init(host) {
      const ids = Storage.getNotes();
      const getWord = (id) => (typeof window.getWord === "function" ? window.getWord(id) : null);
      const words = ids.map(getWord).filter(Boolean);

      const list = host.querySelector(".word-list");
      const detail = host.querySelector(".detail-pane");
      const countEl = host.querySelector("[data-notes-count]");
      if (countEl) countEl.textContent = words.length + " saved";

      if (!words.length) {
        list.innerHTML = `<li class="empty-state" style="margin:20px 0;">No saved words yet</li>`;
        detail.innerHTML = `<div class="empty-state">Empty Notes</div>`;
        return;
      }

      list.innerHTML = words.map(w => `
        <li class="word-list-item" data-id="${esc(w.id || w.word)}">
          <span class="wli-word">${esc(w.word)}</span>
          <span class="wli-meaning">${esc(w.meaning)}</span>
        </li>`).join("");

      function select(id) {
        host.querySelectorAll(".word-list-item").forEach(li => {
          li.classList.toggle("is-active", li.dataset.id === id);
        });
        const w = getWord(id);
        if (w) detail.innerHTML = WordCard.renderFullBody(w);
      }
      list.addEventListener("click", e => {
        const li = e.target.closest(".word-list-item");
        if (li) select(li.dataset.id);
      });
      select(words[0].id || words[0].word);
    },
  };


  /* ---------- word-garden ---------- */
  const wordGarden = {
    init(host) {
      let query = "";
      function allWords() {
        const seen = new Map();
        const push = (w) => {
          if (!w || !w.word) return;
          const id = (w.id || w.word).toLowerCase();
          if (!seen.has(id)) seen.set(id, w);
        };
        if (typeof WORDS !== "undefined") WORDS.forEach(push);
        if (typeof WORD_LIBRARY !== "undefined") WORD_LIBRARY.forEach(push);
        return Array.from(seen.values()).sort((a, b) => a.word.localeCompare(b.word));
      }
      function shortGloss(w) {
        if (w.meaning) return w.meaning;
        if (Array.isArray(w.kin)) {
          for (const k of w.kin) {
            if (k && typeof k === "object" && k.zh) return k.zh;
            if (typeof k === "string") return k;
          }
        }
        return "";
      }
      function filtered() {
        const all = allWords();
        if (!query) return all;
        return all.filter(w =>
          w.word.toLowerCase().includes(query) ||
          shortGloss(w).toLowerCase().includes(query)
        );
      }
      function rowHTML(w) {
        return `<li class="wg-row" data-id="${esc(w.id || w.word)}">
          <span class="wg-row-en">${esc(w.word)}</span>
          <span class="wg-row-zh">${esc(shortGloss(w))}</span>
        </li>`;
      }
      function renderTable() {
        const left  = host.querySelector("#wg-col-left");
        const right = host.querySelector("#wg-col-right");
        if (!left || !right) return;
        const list = filtered();
        const half = Math.ceil(list.length / 2);
        left.innerHTML  = list.slice(0, half).map(rowHTML).join("");
        right.innerHTML = list.slice(half).map(rowHTML).join("");
        host.querySelectorAll(".wg-row").forEach(row => {
          row.addEventListener("click", () => {
            const id = row.dataset.id;
            const entry = list.find(w => (w.id || w.word) === id);
            if (entry && typeof WordCard !== "undefined") WordCard.openDrawer(entry);
          });
        });
      }
      function renderAZ() {
        const az = host.querySelector("#wg-az");
        if (!az) return;
        const list = filtered();
        const has = new Set();
        list.forEach(w => has.add(w.word[0].toUpperCase()));
        const first = list[0] && list[0].word[0].toUpperCase();
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
        az.innerHTML = letters.map(L => {
          const cls = ["wg-az-letter"];
          if (!has.has(L)) cls.push("is-disabled");
          if (L === first) cls.push("is-current");
          return `<button type="button" class="${cls.join(" ")}" data-letter="${L}">${L}</button>`;
        }).join("");
        az.querySelectorAll(".wg-az-letter").forEach(btn => {
          btn.addEventListener("click", () => {
            if (btn.classList.contains("is-disabled")) return;
            az.querySelectorAll(".is-current").forEach(b => b.classList.remove("is-current"));
            btn.classList.add("is-current");
            const L = btn.dataset.letter;
            const target = list.find(w => w.word[0].toUpperCase() === L);
            if (!target) return;
            const node = host.querySelector(`.wg-row[data-id="${cssEsc(target.id || target.word)}"]`);
            if (node) node.scrollIntoView({ block: "center", behavior: "smooth" });
          });
        });
      }
      const search = host.querySelector("#wg-search");
      if (search) {
        search.addEventListener("input", (e) => {
          query = e.target.value.trim().toLowerCase();
          renderAZ(); renderTable();
        });
      }
      renderAZ(); renderTable();
    },
  };


  /* ---------- save / load ---------- */
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function nowStr() {
    const d = new Date();
    const p = n => (n < 10 ? "0" + n : "" + n);
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}  ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function slotHtml(slot, i, accent) {
    if (!slot) {
      return `<div class="slot ornate-panel is-strip is-clickable is-empty ${accent}" data-index="${i}">
        <div class="slot-no">Slot ${pad(i + 1)}</div>
        <div class="slot-empty">— Empty —</div>
        <div class="slot-meta">&nbsp;</div>
      </div>`;
    }
    const ch = (typeof getChapter === "function" && getChapter(slot.chapter))
             || { title: slot.chapter, number: "??" };
    const meta = slot.section
      ? `Section ${esc(slot.section)} · ${esc(slot.time || slot.savedAt || "")}`
      : `${esc(slot.position || "Page 1")} · ${esc(slot.time || slot.savedAt || "")}`;
    return `<div class="slot ornate-panel is-strip is-clickable ${accent}" data-index="${i}">
      <div class="slot-no">Slot ${pad(i + 1)} · Ch ${ch.number}</div>
      <div class="slot-chapter">${esc(ch.title)}</div>
      <div class="slot-meta">${meta}</div>
    </div>`;
  }
  function renderSlots(host, mode) {
    const grid = host.querySelector(".slot-grid");
    if (!grid) return;
    const slots = Storage.getSlots();
    const accent = mode === "save" ? "is-save" : "is-load";
    grid.innerHTML = slots.map((s, i) => slotHtml(s, i, accent)).join("");
    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".slot");
      if (!card) return;
      const i = +card.dataset.index;
      if (mode === "save") {
        let last = null;
        try { last = JSON.parse(localStorage.getItem("tpl.lastRead") || "null"); } catch (_) {}
        const chapterId = (last && last.chapter) || "universe";
        const sec       = (last && last.section) || "1.1";
        Storage.setSlot(i, {
          chapter: chapterId,
          section: sec,
          position: `Section ${sec}`,
          time: nowStr(),
        });
        window.toast && window.toast("Saved to Slot " + pad(i + 1));
        renderSlots(host, "save");
      } else {
        const slot = Storage.getSlots()[i];
        if (!slot) { window.toast && window.toast("Empty Slot"); return; }
        const sec = slot.section || "1.1";
        window.go(`#reading?chapter=${encodeURIComponent(slot.chapter)}&section=${encodeURIComponent(sec)}`);
      }
    });
  }
  const save = { init(host) { renderSlots(host, "save"); } };
  const load = { init(host) { renderSlots(host, "load"); } };


  /* ---------- voices ----------
     Lists every speechSynthesis voice the device has installed,
     surfaces the quality tier (Siri / Premium / Enhanced / Standard
     / Compact), and lets the user TEST + USE one. The chosen voice
     name is stored as `tpl.voice` and read back by TTS.pickVoice as
     a hard override. Necessary because iOS will silently fall back
     to the compact (robotic) tier of Ava/Samantha when no enhanced
     voice is downloaded, and the user has no other way to tell
     which voices are even present on their device. */
  function voiceTierLabel(v) {
    const s = ((v.voiceURI || "") + " " + (v.name || "")).toLowerCase();
    if (/siri/.test(s))     return "Siri";
    if (/neural/.test(s))   return "Neural";
    if (/premium/.test(s))  return "Premium";
    if (/enhanced/.test(s)) return "Enhanced";
    if (/compact/.test(s))  return "Compact";
    return "Standard";
  }
  const voices = {
    init(host) {
      const list = host.querySelector(".voices-list");

      function render() {
        // Page-turned away from the voices view — the chained
        // onvoiceschanged callback would otherwise paint into a
        // detached list. Bail silently.
        if (!list.isConnected) return;
        const vs = (window.speechSynthesis && window.speechSynthesis.getVoices()) || [];
        let current = "";
        try { current = localStorage.getItem("tpl.voice") || ""; } catch (_) {}
        const sorted = vs.slice().sort((a, b) => {
          const ae = /^en/i.test(a.lang), be = /^en/i.test(b.lang);
          if (ae !== be) return ae ? -1 : 1;
          return (a.name || "").localeCompare(b.name || "");
        });
        if (!sorted.length) {
          list.innerHTML = `<li class="voice-row"><span class="voice-name">No voices reported yet. Tap Rescan after a moment.</span></li>`;
          return;
        }
        list.innerHTML = sorted.map(v => {
          const isCurrent = current && (v.name === current || v.voiceURI === current);
          return `
            <li class="voice-row${isCurrent ? " is-current" : ""}"
                data-name="${esc(v.name || "")}"
                data-uri="${esc(v.voiceURI || "")}">
              <span class="voice-name">${esc(v.name || v.voiceURI || "?")}</span>
              <span class="voice-meta">${esc(v.lang || "")} · ${esc(voiceTierLabel(v))}</span>
              <button type="button" class="voice-test">Test</button>
              <button type="button" class="voice-use">${isCurrent ? "In Use" : "Use"}</button>
            </li>`;
        }).join("");
      }
      render();

      // If the engine hasn't filled getVoices() yet (common on iOS
      // first paint), retry once when it does. Chain rather than
      // replace, since tts.js also wires onvoiceschanged to bust its
      // pickVoice cache; overwriting it here would silently break
      // the auto-picker for the rest of the session.
      if (window.speechSynthesis && "onvoiceschanged" in window.speechSynthesis) {
        const prev = window.speechSynthesis.onvoiceschanged;
        window.speechSynthesis.onvoiceschanged = () => {
          try { if (typeof prev === "function") prev(); } catch (_) {}
          render();
        };
      }

      list.addEventListener("click", (e) => {
        const row = e.target.closest(".voice-row");
        if (!row) return;
        const name = row.dataset.name;
        const uri  = row.dataset.uri;
        const vs = (window.speechSynthesis && window.speechSynthesis.getVoices()) || [];
        const v  = vs.find(x => x.voiceURI === uri) || vs.find(x => x.name === name);
        if (e.target.closest(".voice-test")) {
          // SAME bug as the main TTS.speak: speak() must run inside
          // the click handler's user-gesture window or iOS drops
          // u.voice and substitutes the locale default. Sync.
          try { window.speechSynthesis.cancel(); } catch (_) {}
          const u = new SpeechSynthesisUtterance("Hello, this is a sample of my voice.");
          if (v) { u.lang = v.lang || "en-US"; u.voice = v; u.voice = v; }
          try { window.speechSynthesis.speak(u); } catch (_) {}
          return;
        }
        if (e.target.closest(".voice-use")) {
          // Store voiceURI, NOT name. iOS exposes multiple voices
          // sharing the same .name across quality tiers (compact /
          // enhanced / premium Ava all report name "Ava"); storing
          // the name lets the engine reorder to compact between
          // utterances. URI is unique per tier and stable.
          try { localStorage.setItem("tpl.voice", uri || name); } catch (_) {}
          if (TTS && TTS.pickVoice) TTS.pickVoice(true);
          render();
          window.toast && window.toast("Voice set: " + (name || uri));
        }
      });

      const clearBtn = host.querySelector('[data-action="clear-voice"]');
      if (clearBtn) clearBtn.addEventListener("click", () => {
        try { localStorage.removeItem("tpl.voice"); } catch (_) {}
        if (TTS && TTS.pickVoice) TTS.pickVoice(true);
        render();
        window.toast && window.toast("Voice reset to auto-pick");
      });
      const rescanBtn = host.querySelector('[data-action="rescan"]');
      if (rescanBtn) rescanBtn.addEventListener("click", () => render());
      const dbgBtn = host.querySelector('[data-action="toggle-debug"]');
      function syncDbgLabel() {
        if (!dbgBtn) return;
        let on = false;
        try { on = localStorage.getItem("tpl.voiceDebug") === "1"; } catch (_) {}
        dbgBtn.textContent = on ? "Debug ✓" : "Debug";
      }
      syncDbgLabel();
      if (dbgBtn) dbgBtn.addEventListener("click", () => {
        let on = false;
        try { on = localStorage.getItem("tpl.voiceDebug") === "1"; } catch (_) {}
        try { localStorage.setItem("tpl.voiceDebug", on ? "0" : "1"); } catch (_) {}
        syncDbgLabel();
        window.toast && window.toast(on ? "Debug toasts off" : "Debug toasts on");
      });
    },
  };


  return {
    splash, menu, select, chapters,
    reading, quiz, notes,
    "word-garden": wordGarden,
    save, load, voices,
  };
})();
