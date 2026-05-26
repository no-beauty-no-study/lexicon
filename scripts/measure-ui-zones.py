#!/usr/bin/env python3
"""
measure-ui-zones.py v3 — find truly blank rectangles in painted UI bgs.

v2 was too strict (tolerance 14) so it picked tiny noise-free patches
instead of the actually-writable channels. v3 uses two tolerances:

  - 'paint tolerance' (≈30): a pixel is "ink" if it's MORE than this
    distance from the parchment colour. Everything else counts as
    blank-enough-for-text. This forgives subtle parchment grain.

  - 'line gap' (≥3px): when a row is mostly blank we treat it as part
    of the writable channel even if a single decorative line crosses it.

We also generate a debug overlay PNG per image so you can verify each
red rect actually sits in an empty patch, never crossing a painted line
or covering a painted scene.
"""
import os
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT  = "/tmp"


def estimate_parchment(arr_region):
    lum = arr_region.mean(axis=2)
    thr = np.percentile(lum, 80)
    bright = arr_region[lum >= thr]
    return np.median(bright, axis=0).astype(float)


def ink_mask(arr_region, base, tol=30.0):
    """True where pixel is painted ink (more than tol from parchment).
       The COMPLEMENT (~mask) is the blank parchment."""
    diff = np.linalg.norm(arr_region.astype(float) - base, axis=2)
    return diff > tol


def largest_blank_rect(blank):
    """Largest inscribed True-rectangle. blank is a 2-D bool array."""
    H, W = blank.shape
    if H == 0 or W == 0: return (0, 0, 0, 0)
    heights = np.zeros(W, dtype=np.int32)
    best_area = 0
    best = (0, 0, 0, 0)
    for y in range(H):
        heights = np.where(blank[y], heights + 1, 0).astype(np.int32)
        stack = []
        for i in range(W + 1):
            cur = int(heights[i]) if i < W else 0
            while stack and int(heights[stack[-1]]) > cur:
                top = stack.pop()
                left = stack[-1] + 1 if stack else 0
                width = i - left
                h = int(heights[top])
                area = h * width
                if area > best_area:
                    best_area = area
                    best = (left, y - h + 1, i, y + 1)
            stack.append(i)
    return best


def find_blank(im_arr, region, tol=30.0):
    x0, y0, x1, y1 = region
    sub  = im_arr[y0:y1, x0:x1]
    base = estimate_parchment(sub)
    ink  = ink_mask(sub, base, tol=tol)
    blank = ~ink
    rx0, ry0, rx1, ry1 = largest_blank_rect(blank)
    if (rx1 - rx0) <= 0 or (ry1 - ry0) <= 0:
        return None
    return (x0 + rx0, y0 + ry0, x0 + rx1, y0 + ry1)


# Search regions are tight: they exclude the curved corner ornaments of
# the footer arch so the largest-rect algorithm gives a wide channel,
# not a small patch wedged between corner curls.
JOBS = {
    "assets/illustrations/content/universe.jpg": [
        # Body parchment: central column, excluding princess strip on left.
        ("reading body slot",        0.30, 0.05, 0.95, 0.83),
        # Bottom nav: NARROW horizontal band inside the painted footer
        # tray. Limit x to central 60% to skip curved arch corners.
        ("reading bottom-nav slot",  0.30, 0.85, 0.78, 0.96),
    ],
    "assets/illustrations/content/earth-history.jpg": [
        ("reading body slot",        0.30, 0.05, 0.95, 0.83),
        ("reading bottom-nav slot",  0.30, 0.85, 0.78, 0.96),
    ],
    "assets/illustrations/content/europe-france.jpg": [
        ("reading body slot",        0.30, 0.05, 0.95, 0.83),
        ("reading bottom-nav slot",  0.30, 0.85, 0.78, 0.96),
    ],
    "assets/illustrations/content/europe-alice.jpg": [
        ("reading body slot",        0.30, 0.05, 0.95, 0.83),
        ("reading bottom-nav slot",  0.30, 0.85, 0.78, 0.96),
    ],
    "assets/bg/ui/select-mode.jpg": [
        # IMPORTANT: the painted select-mode artwork does NOT leave a
        # blank title plaque inside each arch — the arches are filled
        # with painted scenes. There IS a wide blank strip ABOVE the
        # arches, between the SELECT A MODE banner and the three round
        # arch icons. We measure that strip per-arch column instead.
        ("select arch1 top strip",   0.21, 0.16, 0.40, 0.27),
        ("select arch2 top strip",   0.40, 0.16, 0.59, 0.27),
        ("select arch3 top strip",   0.59, 0.16, 0.78, 0.27),
        # Bottom nav: similarly tight horizontal band in painted footer.
        ("select bottom-nav slot",   0.32, 0.85, 0.68, 0.96),
    ],
    "assets/bg/ui/chapters.jpg": [
        ("chapters bottom-nav slot", 0.28, 0.88, 0.72, 0.99),
    ],
}


def pct(v, total):
    return round(100.0 * v / total, 2)


def report(label, rect, W, H):
    if not rect:
        print(f"  {label:34s}  (not found)")
        return None
    x1, y1, x2, y2 = rect
    print(f"  {label:34s}  "
          f"px({x1:4d},{y1:4d})-({x2:4d},{y2:4d})  "
          f"left:{pct(x1,W):5.2f}%  top:{pct(y1,H):5.2f}%  "
          f"w:{pct(x2-x1,W):5.2f}%  h:{pct(y2-y1,H):5.2f}%")
    return rect


def save_debug(im, results, dst, search_regions):
    debug = im.convert("RGB").copy()
    draw  = ImageDraw.Draw(debug, "RGBA")
    # First draw the search regions as gold dashed boxes.
    for label, region in search_regions:
        x0, y0, x1, y1 = region
        for off in range(0, max(x1-x0, y1-y0), 12):
            draw.line([(x0+off, y0), (min(x1, x0+off+6), y0)], fill=(180, 150, 90, 180), width=1)
            draw.line([(x0+off, y1), (min(x1, x0+off+6), y1)], fill=(180, 150, 90, 180), width=1)
            draw.line([(x0, y0+off), (x0, min(y1, y0+off+6))], fill=(180, 150, 90, 180), width=1)
            draw.line([(x1, y0+off), (x1, min(y1, y0+off+6))], fill=(180, 150, 90, 180), width=1)
    # Then the detected blank rects in solid red.
    for label, rect in results:
        if not rect: continue
        x1, y1, x2, y2 = rect
        draw.rectangle([x1, y1, x2, y2], outline=(220, 40, 40, 255), width=3)
        draw.rectangle([x1, y1, x2, y2], fill=(220, 40, 40, 35))
        draw.rectangle([x1, max(0, y1-16), x1 + 9 + 6*len(label), y1],
                       fill=(244, 234, 210, 235))
        draw.text((x1+4, max(0, y1-13)), label, fill=(95, 50, 35))
    debug.save(dst)


def main():
    print()
    print("=" * 84)
    print("BLANK-ISLAND MEASUREMENT v3 — tolerance 30, tight search regions")
    print("=" * 84)
    all_results = []
    for path, jobs in JOBS.items():
        full = os.path.join(ROOT, path)
        if not os.path.exists(full): continue
        im   = Image.open(full)
        W, H = im.size
        arr  = np.array(im.convert("RGB"))
        print()
        print(f"{path}   {W}x{H}")
        print("-" * 84)

        results, regions = [], []
        for label, lp, tp, wp, hp in jobs:
            region = (int(lp*W), int(tp*H), int(wp*W), int(hp*H))
            regions.append((label, region))
            rect = find_blank(arr, region, tol=30.0)
            report(label, rect, W, H)
            results.append((label, rect))
            if rect:
                all_results.append((os.path.basename(path), label, rect, W, H))

        dst = os.path.join(OUT, f"ui-debug-{os.path.basename(path)}.png")
        save_debug(im, results, dst, regions)
        print(f"  [debug overlay → {dst}]")

    print()
    print("=" * 84)
    print("CSS suggestions")
    print("=" * 84)
    for fname, label, rect, W, H in all_results:
        x1, y1, x2, y2 = rect
        l = pct(x1, W); t = pct(y1, H)
        w = pct(x2-x1, W); h = pct(y2-y1, H)
        print(f"  /* {fname:30s} {label:30s} */  "
              f"left:{l:6.2f}%; top:{t:6.2f}%; width:{w:6.2f}%; height:{h:6.2f}%;")
    print()


if __name__ == "__main__":
    main()
