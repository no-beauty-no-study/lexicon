#!/usr/bin/env python3
"""
measure-ui-zones.py — extract pixel coordinates of UI slots from
painted background JPGs.

For each painted JPG we scan candidate regions and detect the
bright "parchment" bands (where text / buttons should live) between
the darker decorative trim lines painted into the artwork.

Output: a single table CSV-ish, plus a CSS-variables snippet you can
paste into pages.css. Run from project root:

    python3 scripts/measure-ui-zones.py

The point is: never write `top: 88.15%` because it looks right.
Measure the painted slot, divide by image height, then write CSS.
"""
import os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Each image we want to measure + which slot type to find in it.
# 'illustration' images use the reading layout (princess col + body + footer).
# 'select-mode' has 3 arch title plaques + bottom nav.
# 'chapters' has chapter cards + bottom nav.
TARGETS = [
    ("assets/illustrations/content/universe.jpg",      "reading"),
    ("assets/illustrations/content/earth-history.jpg", "reading"),
    ("assets/illustrations/content/europe-france.jpg", "reading"),
    ("assets/illustrations/content/europe-alice.jpg",  "reading"),
    ("assets/bg/ui/select-mode.jpg",                   "select"),
    ("assets/bg/ui/chapters.jpg",                      "chapters"),
    ("assets/bg/ui/main-menu.jpg",                     "home"),
]


def row_brightness(im, x0, x1, y0, y1):
    """Mean luminance per row in [y0, y1) restricted to columns [x0, x1)."""
    gs = im.convert("L")
    w, h = gs.size
    px = gs.load()
    out = []
    for y in range(y0, y1):
        s = 0
        for x in range(x0, x1):
            s += px[x, y]
        out.append(s / (x1 - x0))
    return out


def col_brightness(im, y0, y1, x0, x1):
    """Mean luminance per column in [x0, x1) restricted to rows [y0, y1)."""
    gs = im.convert("L")
    px = gs.load()
    out = []
    for x in range(x0, x1):
        s = 0
        for y in range(y0, y1):
            s += px[x, y]
        out.append(s / (y1 - y0))
    return out


def find_brightest_band(profile, threshold_ratio=0.92):
    """Return (i0, i1) of the brightest contiguous band whose mean is
       >= threshold_ratio * max(profile). The "bottom-nav slot" is
       the painted page's brightest horizontal band beneath the body."""
    if not profile:
        return None
    pmax = max(profile)
    thr = pmax * threshold_ratio
    runs = []
    cur = None
    for i, v in enumerate(profile):
        if v >= thr:
            if cur is None:
                cur = [i, i]
            else:
                cur[1] = i
        else:
            if cur is not None:
                runs.append(tuple(cur))
                cur = None
    if cur is not None:
        runs.append(tuple(cur))
    if not runs:
        return None
    # Pick longest run.
    runs.sort(key=lambda r: r[1] - r[0], reverse=True)
    return runs[0]


def find_dark_line_band(profile, threshold_ratio=0.78):
    """Find the darkest contiguous band — used to spot painted trim lines
       (e.g. the bottom edge of an arch). Mirror of find_brightest_band."""
    if not profile:
        return None
    pmin = min(profile)
    thr = pmin + (max(profile) - pmin) * (1 - threshold_ratio)
    runs = []
    cur = None
    for i, v in enumerate(profile):
        if v <= thr:
            if cur is None:
                cur = [i, i]
            else:
                cur[1] = i
        else:
            if cur is not None:
                runs.append(tuple(cur))
                cur = None
    if cur is not None:
        runs.append(tuple(cur))
    if not runs:
        return None
    runs.sort(key=lambda r: r[1] - r[0], reverse=True)
    return runs[0]


def pct(v, total):
    return round(100.0 * v / total, 2)


def measure_bottom_nav_slot(im):
    """Scan the bottom 18% for a bright horizontal band — the painted
       footer's flat parchment strip where button labels should live."""
    w, h = im.size
    # Restrict x to the central 60% to avoid the left princess column
    # and the corner ornaments.
    x0, x1 = int(w * 0.20), int(w * 0.85)
    y0, y1 = int(h * 0.82), int(h * 0.99)
    rows = row_brightness(im, x0, x1, y0, y1)
    band = find_brightest_band(rows, threshold_ratio=0.965)
    if not band:
        return None
    by0, by1 = y0 + band[0], y0 + band[1]

    # Also find x range of bottom nav by scanning columns in that band
    cols = col_brightness(im, by0, by1, int(w * 0.10), int(w * 0.90))
    # The painted footer's content area is the longest bright run.
    cband = find_brightest_band(cols, threshold_ratio=0.96)
    if cband:
        bx0 = int(w * 0.10) + cband[0]
        bx1 = int(w * 0.10) + cband[1]
    else:
        bx0, bx1 = x0, x1
    return {"x1": bx0, "y1": by0, "x2": bx1, "y2": by1}


def measure_reading_body_band(im):
    """Bright band between top title slot and bottom-nav slot — the
       painted parchment where body text should flow."""
    w, h = im.size
    x0, x1 = int(w * 0.30), int(w * 0.80)
    y0, y1 = int(h * 0.20), int(h * 0.82)
    rows = row_brightness(im, x0, x1, y0, y1)
    band = find_brightest_band(rows, threshold_ratio=0.985)
    if not band:
        return None
    return {"x1": x0, "y1": y0 + band[0], "x2": x1, "y2": y0 + band[1]}


def measure_select_arches(im):
    """For select-mode.jpg, find the 3 arch columns (column bands of
       bright parchment) and within each, find the top title plaque
       (a small bright horizontal band high in the arch)."""
    w, h = im.size
    # Scan columns in the upper half to locate the 3 arches.
    y0, y1 = int(h * 0.25), int(h * 0.50)
    cols = col_brightness(im, y0, y1, int(w * 0.15), int(w * 0.85))
    # Find the three brightest column runs (the open arch interiors).
    pmax = max(cols)
    thr  = pmax * 0.92
    runs, cur = [], None
    for i, v in enumerate(cols):
        if v >= thr:
            if cur is None: cur = [i, i]
            else:           cur[1] = i
        else:
            if cur: runs.append(tuple(cur)); cur = None
    if cur: runs.append(tuple(cur))
    runs = [r for r in runs if (r[1] - r[0]) > 30]
    runs.sort(key=lambda r: r[0])
    arches = []
    for r in runs[:3]:
        arches.append({"x1": int(w * 0.15) + r[0], "x2": int(w * 0.15) + r[1]})
    return arches


def report(label, slot, W, H):
    if not slot:
        print(f"  {label:24s}  (not found)")
        return
    x1, y1, x2, y2 = slot["x1"], slot["y1"], slot["x2"], slot["y2"]
    print(f"  {label:24s}  "
          f"px({x1:4d},{y1:4d})-({x2:4d},{y2:4d})  "
          f"left:{pct(x1, W):5.2f}%  top:{pct(y1, H):5.2f}%  "
          f"w:{pct(x2 - x1, W):5.2f}%  h:{pct(y2 - y1, H):5.2f}%")


def main():
    print()
    print("UI ZONE MEASUREMENT — pixel sweep of painted background JPGs")
    print("=" * 76)
    css_snips = []
    for path, kind in TARGETS:
        full = os.path.join(ROOT, path)
        if not os.path.exists(full):
            print(f"  [skip] {path}")
            continue
        im = Image.open(full)
        W, H = im.size
        print()
        print(f"{path}   {W}x{H}  ({kind})")
        print("-" * 76)

        if kind == "reading":
            body = measure_reading_body_band(im)
            nav  = measure_bottom_nav_slot(im)
            report("reading body band",   body, W, H)
            report("bottom nav slot",     nav,  W, H)
            if nav:
                css_snips.append((
                    "reading/quiz (" + os.path.basename(path) + ")",
                    pct(nav["x1"], W), pct(nav["y1"], H),
                    pct(nav["x2"] - nav["x1"], W),
                    pct(nav["y2"] - nav["y1"], H),
                ))
        elif kind == "select":
            arches = measure_select_arches(im)
            for i, a in enumerate(arches):
                report(f"arch{i+1} x-range",
                       {"x1": a["x1"], "y1": 0, "x2": a["x2"], "y2": 0},
                       W, H)
            nav = measure_bottom_nav_slot(im)
            report("bottom nav slot", nav, W, H)
            if nav:
                css_snips.append((
                    "select", pct(nav["x1"], W), pct(nav["y1"], H),
                    pct(nav["x2"] - nav["x1"], W),
                    pct(nav["y2"] - nav["y1"], H),
                ))
        else:
            nav = measure_bottom_nav_slot(im)
            report("bottom nav slot", nav, W, H)
            if nav:
                css_snips.append((
                    kind, pct(nav["x1"], W), pct(nav["y1"], H),
                    pct(nav["x2"] - nav["x1"], W),
                    pct(nav["y2"] - nav["y1"], H),
                ))

    print()
    print("=" * 76)
    print("CSS variable suggestions (paste into pages.css)")
    print("=" * 76)
    for label, l, t, w, h in css_snips:
        print(f"  /* {label} */  "
              f"--nav-left:{l:5.2f}%; --nav-top:{t:5.2f}%; "
              f"--nav-width:{w:5.2f}%; --nav-height:{h:5.2f}%;")
    print()


if __name__ == "__main__":
    main()
