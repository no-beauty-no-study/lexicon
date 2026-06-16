/* ============================================================
   The Princess Lexicon — saveLoad.js
   Shared by save.html and load.html.
   Mode = "save" or "load" (set via data-mode on .save-layout).
   ============================================================ */

(function () {
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    const root = document.querySelector(".save-layout");
    if (!root) return;
    const mode = root.dataset.mode === "load" ? "load" : "save";
    render(mode);
  }

  function render(mode) {
    const grid = document.querySelector(".slot-grid");
    const slots = Storage.getSlots();
    const accent = mode === "save" ? "is-save" : "is-load";
    grid.innerHTML = slots.map((slot, i) => slotHtml(slot, i, accent)).join("");
    grid.addEventListener("click", e => {
      const card = e.target.closest(".slot");
      if (!card) return;
      const i = +card.dataset.index;
      if (mode === "save") onSaveClick(i);
      else onLoadClick(slots[i]);
    });
  }

  function slotHtml(slot, i, accent) {
    if (!slot) {
      return `
        <div class="slot ornate-panel is-strip is-clickable is-empty ${accent}" data-index="${i}">
          <div class="slot-no">Slot ${pad(i + 1)}</div>
          <div class="slot-empty">— Empty —</div>
          <div class="slot-meta">&nbsp;</div>
        </div>
      `;
    }
    const ch = getChapter(slot.chapter) || { title: slot.chapter, number: "??" };
    return `
      <div class="slot ornate-panel is-strip is-clickable ${accent}" data-index="${i}">
        <div class="slot-no">Slot ${pad(i + 1)} · Ch ${ch.number}</div>
        <div class="slot-chapter">${esc(ch.title)}</div>
        <div class="slot-meta">${esc(slot.position || "Page 1")} · ${esc(slot.time)}</div>
      </div>
    `;
  }

  function onSaveClick(i) {
    // Mock current reading state — first chapter, page 1.
    const slot = {
      chapter: "universe",
      position: "Page 1 · 1.1 The First Light",
      time: nowStr(),
    };
    Storage.setSlot(i, slot);
    toast("Saved to Slot " + pad(i + 1));
    render("save");
  }

  function onLoadClick(slot) {
    if (!slot) { toast("Empty Slot"); return; }
    window.go(`reading.html?chapter=${encodeURIComponent(slot.chapter)}`);
  }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function nowStr() {
    const d = new Date();
    const p = n => (n < 10 ? "0" + n : "" + n);
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}  ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
