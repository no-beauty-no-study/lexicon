"""Take phone-friendly screenshots of the key pages.
Requires the static server to already be running on :8765.
Outputs PNGs into /tmp/shots/."""
import asyncio, os, pathlib
from playwright.async_api import async_playwright

OUT = pathlib.Path("/tmp/shots")
OUT.mkdir(parents=True, exist_ok=True)

# Viewport matches the design canvas exactly so the .page fits 1:1.
VIEWPORT = {"width": 1448, "height": 1086}
BASE = "http://127.0.0.1:8765"


async def snap(page, url, name, *, prepare=None, wait_ms=400):
    await page.goto(url, wait_until="domcontentloaded")
    await page.wait_for_load_state("networkidle", timeout=8000)
    if prepare:
        await prepare(page)
    await page.wait_for_timeout(wait_ms)
    path = OUT / f"{name}.png"
    await page.screenshot(path=str(path), full_page=False)
    size = path.stat().st_size
    print(f"  wrote {path} ({size/1024:.0f} KB)")


async def main():
    async with async_playwright() as p:
        # Use the pre-installed chromium in this env (Playwright version
        # mismatch means we point at the binary directly).
        exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
        browser = await p.chromium.launch(executable_path=exe)
        ctx = await browser.new_context(viewport=VIEWPORT, device_scale_factor=2)
        page = await ctx.new_page()

        # 1. Home — main menu (antique-label buttons)
        await snap(page, f"{BASE}/index.html", "01-home")

        # 1b. Select mode page
        await snap(page, f"{BASE}/select.html", "01b-select")

        # 2. Chapter Index — TOC
        await snap(page, f"{BASE}/chapters.html", "02-chapters")

        # 3a. Reading default state — no selection, no highlights.
        async def reading_default(p):
            await p.click(".tap-overlay")
            for _ in range(6):
                await p.mouse.click(900, 600)
                await p.wait_for_timeout(100)
        await snap(page, f"{BASE}/reading.html?chapter=universe&section=1.1",
                   "03a-reading-default", prepare=reading_default, wait_ms=900)

        # 3b. Reading with one word selected — verify only ONE yellow stain.
        async def reading_selected(p):
            await p.click(".tap-overlay")
            for _ in range(6):
                await p.mouse.click(900, 600)
                await p.wait_for_timeout(100)
            cw = p.locator('.clickable-word[data-word="singularity"]').first
            if await cw.count() > 0:
                await cw.click()
        await snap(page, f"{BASE}/reading.html?chapter=universe&section=1.1",
                   "03b-reading-selected", prepare=reading_selected, wait_ms=900)

        # 3c. Reading sub-word click (a family/kin word) — marginalia should
        # show parent head + "via X · family/kin".
        async def reading_subword(p):
            await p.click(".tap-overlay")
            for _ in range(6):
                await p.mouse.click(900, 600)
                await p.wait_for_timeout(100)
            # find any word whose data-word resolves via family/kin
            await p.evaluate("""() => {
              const cws = [...document.querySelectorAll('.clickable-word')];
              for (const cw of cws) {
                const r = (typeof resolveClickedWord==='function')
                  ? resolveClickedWord(cw.dataset.word) : null;
                if (r && r.type !== 'head') { cw.click(); window.__sub=cw.dataset.word; return; }
              }
            }""")
        await snap(page, f"{BASE}/reading.html?chapter=universe&section=1.1",
                   "03c-reading-subword", prepare=reading_subword, wait_ms=600)

        # 4. Reading with WordDrawer open
        async def drawer_setup(p):
            await p.click(".tap-overlay")
            for _ in range(6):
                await p.mouse.click(900, 600)
                await p.wait_for_timeout(100)
            cw = p.locator('.clickable-word[data-word="singularity"]').first
            if await cw.count() > 0:
                await cw.click()
            await p.wait_for_timeout(250)
            await p.click('.marginalia-actions button[data-act="full"]')
            await p.wait_for_timeout(450)
        await snap(page, f"{BASE}/reading.html?chapter=universe&section=1.1",
                   "04-word-drawer", prepare=drawer_setup, wait_ms=700)

        # 5a. Quiz page — mid grading: 1 wrong (struck through), 1 unanswered, 1 correct
        async def quiz_mixed(p):
            await p.click(".tap-overlay")
            for _ in range(4):
                await p.mouse.click(900, 700)
                await p.wait_for_timeout(100)
            # Click the WRONG option of Q1 (a known distractor we control).
            await p.evaluate("""() => {
              const items = document.querySelectorAll('.quiz-item');
              if (items[0]) {
                const ans = items[0].dataset.answer.toLowerCase();
                const wrong = [...items[0].querySelectorAll('.quiz-option')]
                  .find(o => (o.dataset.value||'').toLowerCase() !== ans);
                if (wrong) wrong.click();
              }
              if (items[2]) {
                const ans = items[2].dataset.answer.toLowerCase();
                const right = [...items[2].querySelectorAll('.quiz-option')]
                  .find(o => (o.dataset.value||'').toLowerCase() === ans);
                if (right) right.click();
              }
            }""")
        await snap(page, f"{BASE}/quiz.html?chapter=universe&section=1.1",
                   "05a-quiz-mid", prepare=quiz_mixed, wait_ms=600)

        # 5b. Quiz complete — all correct, toast visible
        async def quiz_done(p):
            await p.click(".tap-overlay")
            for _ in range(4):
                await p.mouse.click(900, 700)
                await p.wait_for_timeout(100)
            await p.evaluate("""() => {
              window.go = () => {};   // suppress navigation for screenshot
              for (const item of document.querySelectorAll('.quiz-item')) {
                const ans = item.dataset.answer.toLowerCase();
                const right = [...item.querySelectorAll('.quiz-option')]
                  .find(o => (o.dataset.value||'').toLowerCase() === ans);
                if (right) right.click();
              }
            }""")
            await p.wait_for_timeout(400)
        await snap(page, f"{BASE}/quiz.html?chapter=universe&section=1.1",
                   "05b-quiz-complete", prepare=quiz_done, wait_ms=600)

        # 6. Reading — Europe / Alice sub-chapter (different painted bg)
        async def alice_setup(p):
            await p.click(".tap-overlay")
            for _ in range(4):
                await p.mouse.click(900, 600)
                await p.wait_for_timeout(100)
        await snap(page, f"{BASE}/reading.html?chapter=europe&section=9.1&page=europe-alice",
                   "06-reading-alice", prepare=alice_setup, wait_ms=1000)

        await ctx.close()
        await browser.close()


asyncio.run(main())
