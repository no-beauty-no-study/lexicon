#!/usr/bin/env python3
"""
zone-table.py — print every CSS-positioned UI zone in pixel + % form.

Stage canvas is 1448 x 1086 px (defined in layout.css / app.js as
STAGE_W / STAGE_H). All `%` coordinates in CSS are computed against
this canvas, so the pixel coords reported here ARE the pixel coords
each painted JPG must align with.

Run:  python3 scripts/zone-table.py
"""
STAGE_W, STAGE_H = 1448, 1086

ZONES = [
    # (page, name, left%, top%, width%, height%)
    ("reading/quiz", "title zone",       35.00,  7.60, 38.00, 15.00),
    ("reading/quiz", "body zone",        31.40, 25.20, 48.20, 51.50),
    ("reading/quiz", "marginalia zone",  80.20, 18.20, 13.50, 22.00),
    ("reading/quiz", "bottom nav (var)", 31.20, 88.15, 49.50,  3.20),

    ("select", "story title",     22.80, 33.60, 18.60, 10.50),
    ("select", "notes title",     40.90, 33.60, 18.60, 10.50),
    ("select", "garden title",    58.90, 33.60, 18.60, 10.50),
    ("select", "story hotspot",   22.80, 28.30, 18.60, 49.20),
    ("select", "notes hotspot",   40.90, 28.30, 18.60, 49.20),
    ("select", "garden hotspot",  58.90, 28.30, 18.60, 49.20),
    ("select", "bottom nav (var)", 35.50, 86.00, 29.00,  8.20),
]

def main():
    print()
    print(f"STAGE = {STAGE_W} x {STAGE_H} px (designed canvas)")
    print()
    print(f"{'page':14s}  {'zone':18s}  "
          f"{'x1':>5s} {'y1':>5s}  {'x2':>5s} {'y2':>5s}    "
          f"{'left%':>7s} {'top%':>7s} {'w%':>7s} {'h%':>7s}")
    print("-" * 92)
    for page, name, l, t, w, h in ZONES:
        x1 = round(l / 100 * STAGE_W)
        y1 = round(t / 100 * STAGE_H)
        x2 = round((l + w) / 100 * STAGE_W)
        y2 = round((t + h) / 100 * STAGE_H)
        print(f"{page:14s}  {name:18s}  "
              f"{x1:5d} {y1:5d}  {x2:5d} {y2:5d}    "
              f"{l:6.2f}% {t:6.2f}% {w:6.2f}% {h:6.2f}%")
    print()

if __name__ == "__main__":
    main()
