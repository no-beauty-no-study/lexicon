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

        # 1. Home — main menu
        await snap(page, f"{BASE}/index.html", "01-home")

        # 2. Chapter Index — TOC
        await snap(page, f"{BASE}/chapters.html", "02-chapters")

        # 3. Reading content — Universe 1.1 with all blocks revealed and a word pinned
        async def reading_setup(p):
            # Dismiss tap-overlay
            await p.click(".tap-overlay")
            # Reveal all remaining blocks by clicking the body 5 times.
            for _ in range(5):
                await p.click(".reading-body", position={"x": 600, "y": 100})
                await p.wait_for_timeout(120)
            # Click the "singularity" word (first .clickable-word) to populate side-note.
            cw = p.locator('.clickable-word[data-word="singularity"]').first
            if await cw.count() > 0:
                await cw.click()
        await snap(page, f"{BASE}/reading.html?chapter=universe&section=1.1",
                   "03-reading", prepare=reading_setup, wait_ms=1400)

        # 4. Reading with Word Drawer open
        async def drawer_setup(p):
            await p.click(".tap-overlay")
            for _ in range(5):
                await p.click(".reading-body", position={"x": 600, "y": 100})
                await p.wait_for_timeout(120)
            cw = p.locator('.clickable-word[data-word="singularity"]').first
            await cw.click()
            await p.wait_for_timeout(250)
            await p.click('.side-note-button[data-act="full"]')
            await p.wait_for_timeout(400)
        await snap(page, f"{BASE}/reading.html?chapter=universe&section=1.1",
                   "04-word-drawer", prepare=drawer_setup, wait_ms=600)

        # 5. Quiz page
        async def quiz_setup(p):
            await p.click(".tap-overlay")
            await p.wait_for_timeout(400)
        await snap(page, f"{BASE}/quiz.html?chapter=universe&section=1.1",
                   "05-quiz", prepare=quiz_setup, wait_ms=800)

        await ctx.close()
        await browser.close()


asyncio.run(main())
