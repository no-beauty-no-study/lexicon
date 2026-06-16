#!/usr/bin/env python3
"""
measure-master-frame.py — find the 4 blue circular corner medallions
painted at each page's corners, compute the master frame they enclose,
and dump the result as percentages + a debug overlay.

The master frame is the single source of truth for layout: every text
zone, hotspot and bottom-nav slot lives INSIDE this rectangle. The
outer painted page borders, scrollwork, ribbons and curtains are
outside it and must never be treated as writable space.

Algorithm:
  1. For each corner, take a ~14% x 14% square.
  2. Build a "blue-ink" mask: pixel is blue if B-channel exceeds both
     R and G by a margin AND its luminance is low (so we ignore the
     pale parchment which can be bluish in tone).
  3. Centroid of that mask = medallion centre.
  4. Master frame = bbox of the 4 medallion centres.

A debug PNG is saved per image showing:
  - cyan dots at each detected medallion centre
  - a gold rectangle for the master frame
  - red rectangles for previously-detected blank slots (overlay)
"""
import os
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def blue_ink_mask(arr_region):
    """True where pixel looks like SATURATED ink-blue (the small painted
       corner medallion is bright saturated blue, while a moon / sky
       region is a softer washed-out blue we want to reject)."""
    arr = arr_region.astype(np.int32)
    R, G, B = arr[..., 0], arr[..., 1], arr[..., 2]
    # Saturation: how much the blue channel exceeds the average of R+G.
    sat = B - (R + G) // 2
    saturated = sat > 22                        # strongly blue, not mottled
    # Mid-tone ink (not very pale, not pure black).
    lum = (R + G + B) // 3
    midtone = (lum > 60) & (lum < 165)
    return saturated & midtone


def centroid(mask):
    if not mask.any():
        return None
    ys, xs = np.where(mask)
    # Use median (robust to scattered specks) — for a roughly-round
    # cluster of pixels it's the cluster centre.
    return (int(np.median(xs)), int(np.median(ys)))


def find_medallion(arr, region):
    x0, y0, x1, y1 = region
    sub = arr[y0:y1, x0:x1]
    blue = blue_ink_mask(sub)
    c = centroid(blue)
    if c is not None:
        return (x0 + c[0], y0 + c[1], "blue")
    # Fallback: heaviest gold/ink cluster — for corners that don't use a
    # blue medallion (e.g. universe.jpg bottom-right).
    base = np.median(sub.reshape(-1, 3), axis=0)
    diff = np.linalg.norm(sub.astype(float) - base, axis=2)
    ink  = diff > np.percentile(diff, 88)
    c = centroid(ink)
    if c is not None:
        return (x0 + c[0], y0 + c[1], "fallback")
    return None


def master_frame(im, search_pct=0.07):
    """Tight corner regions only — 7% per side — so big painted features
       like the moon in universe.jpg can't bleed into the centroid."""
    W, H = im.size
    arr  = np.array(im.convert("RGB"))
    sx = int(search_pct * W); sy = int(search_pct * H)
    corners = {
        "tl": (0,     0,    sx,   sy),
        "tr": (W-sx,  0,    W,    sy),
        "bl": (0,     H-sy, sx,   H),
        "br": (W-sx,  H-sy, W,    H),
    }
    found = {k: find_medallion(arr, r) for k, r in corners.items()}
    pts   = {k: (v[0], v[1]) for k, v in found.items() if v}
    if len(pts) < 4:
        return None, found, corners
    xs = [p[0] for p in pts.values()]
    ys = [p[1] for p in pts.values()]
    frame = (min(xs), min(ys), max(xs), max(ys))
    return frame, found, corners


def save_overlay(im, frame, found, search_regions, dst):
    debug = im.convert("RGB").copy()
    draw  = ImageDraw.Draw(debug, "RGBA")
    # Search regions: faint cyan boxes.
    for k, r in search_regions.items():
        draw.rectangle(r, outline=(80, 140, 200, 90), width=1)
    # Each medallion centre: large cyan dot + label.
    for k, v in found.items():
        if not v: continue
        x, y, mode = v
        color = (40, 120, 220, 255) if mode == "blue" else (160, 110, 60, 255)
        r = 14
        draw.ellipse([x-r, y-r, x+r, y+r], outline=color, width=3)
        draw.ellipse([x-3, y-3, x+3, y+3], fill=color)
        draw.text((x + 18, y - 8), f"{k} ({mode})", fill=color)
    # Master frame: bold gold rectangle.
    if frame:
        x0, y0, x1, y1 = frame
        draw.rectangle([x0, y0, x1, y1], outline=(190, 150, 60, 255), width=5)
        draw.text((x0 + 8, y0 + 8), "MASTER FRAME", fill=(190, 150, 60))
    debug.save(dst)


def pct(v, total): return round(100.0 * v / total, 2)


def main():
    targets = [
        "assets/illustrations/content/universe.jpg",
        "assets/illustrations/content/europe-france.jpg",
        "assets/illustrations/content/europe-alice.jpg",
        "assets/bg/ui/select-mode.jpg",
        "assets/bg/ui/chapters.jpg",
        "assets/bg/ui/main-menu.jpg",
    ]
    print()
    print("=" * 80)
    print("MASTER FRAME DETECTION — blue corner medallion centroids")
    print("=" * 80)
    for path in targets:
        full = os.path.join(ROOT, path)
        if not os.path.exists(full): continue
        im   = Image.open(full)
        W, H = im.size
        frame, found, regions = master_frame(im)
        print()
        print(f"{path}   {W}x{H}")
        for k, v in found.items():
            if v:
                x, y, mode = v
                print(f"  corner {k}: px({x:4d},{y:4d})  "
                      f"({pct(x,W):5.2f}%, {pct(y,H):5.2f}%)   [{mode}]")
            else:
                print(f"  corner {k}: NOT FOUND")
        if frame:
            x0, y0, x1, y1 = frame
            w = x1 - x0; h = y1 - y0
            print(f"  master-frame: px({x0},{y0})-({x1},{y1})  "
                  f"left:{pct(x0,W):5.2f}% top:{pct(y0,H):5.2f}% "
                  f"w:{pct(w,W):5.2f}% h:{pct(h,H):5.2f}%")
        dst = f"/tmp/master-{os.path.basename(path)}.png"
        save_overlay(im, frame, found, regions, dst)
        print(f"  [debug overlay → {dst}]")
    print()


if __name__ == "__main__":
    main()
