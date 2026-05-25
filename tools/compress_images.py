"""One-off: rename + compress reference images into assets/bg/.
Run with: python3 _tools_compress.py
After it finishes the originals are deleted from the working tree.
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))

# Mapping: original filename → destination relative path
MAP = {
    # ---- UI / navigation pages ----
    "C1F92DD5-F950-4011-81E4-DFD527CC8FBD.png": "assets/bg/ui/splash.jpg",        # "Tap to Begin" cover
    "49B5D8DD-958A-4124-B0B5-97052517D061.png": "assets/bg/ui/main-menu.jpg",     # Main Menu
    "IMG_5881.jpeg":                            "assets/bg/ui/select-mode.jpg",   # Select a Mode
    "89C535ED-5D29-4B18-A89F-28C8C27298D7.png": "assets/bg/ui/chapters.jpg",      # Table of Contents
    "IMG_5877.jpeg":                            "assets/bg/ui/notes.jpg",         # Notes
    "IMG_5878.jpeg":                            "assets/bg/ui/word-garden.jpg",   # Word Garden
    "ACAD4BF0-F533-4DF0-B205-47CB77557EA5.png": "assets/bg/ui/page-blank.jpg",    # blank w/ BACK·MENU footer
    "67CAC3D4-6BA0-4960-9E98-12CC4FCAA1EB.png": "assets/bg/ui/frame-blank.jpg",   # ornate floral frame

    # ---- Reading-page backgrounds ----
    "IMG_5826.jpeg":                            "assets/bg/reading/01-universe.jpg",
    "2B118E5E-0B4E-492C-BE68-625416090226.png": "assets/bg/reading/01-universe-alt.jpg",
    "15A9B2D9-241F-4CE2-8DFC-9FECB38DEA3B.png": "assets/bg/reading/02-earth-history.jpg",
    "66AC5525-BF08-463E-8CAB-EEBD6089FB6F.png": "assets/bg/reading/03-africa.jpg",
    "9CDC210D-F512-4E66-A2DC-088891EDEA1D.png": "assets/bg/reading/03-africa-egypt.jpg",
    "4277276D-780F-43D6-BCDA-1CA7DE6EFF3F.png": "assets/bg/reading/04-antarctica.jpg",
    "86B23517-48D1-4136-9417-6E3A0592664D.png": "assets/bg/reading/05-australia-pacific.jpg",
    "F334DF30-D98F-4F65-A2D8-041E00282741.png": "assets/bg/reading/06-south-america.jpg",
    "C831204F-9846-413D-A432-E73240AA118D.png": "assets/bg/reading/07-asia.jpg",
    "4D837BEE-623C-424B-91E3-2273A5AC0A0B.png": "assets/bg/reading/08-oceans.jpg",
    "CDF8E700-79C7-4197-ACEC-EEED626F6AEA.png": "assets/bg/reading/09-europe.jpg",
    "33B1060E-2B3A-4C7C-8E5B-E08018B3B540.png": "assets/bg/reading/09-europe-alt.jpg",
    "ADE7D853-A642-47B3-ADBA-C60E58DB01C2.png": "assets/bg/reading/10-north-america.jpg",
}

MAX_DIM = 1800
QUALITY = 90        # keep colour saturation; ~88-92 is sweet spot for this style
PAPER_RGB = (244, 236, 218)  # var(--paper-warm) — flatten alpha onto this


def main():
    total_before = 0
    total_after = 0
    print(f"{'source':55s}  {'destination':50s}  {'before':>9s}  {'after':>9s}")
    print("-" * 140)
    for src, dst in MAP.items():
        src_path = os.path.join(ROOT, src)
        dst_path = os.path.join(ROOT, dst)
        if not os.path.exists(src_path):
            print(f"MISSING  {src}")
            continue
        with Image.open(src_path) as im:
            if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
                im_rgba = im.convert("RGBA")
                bg = Image.new("RGB", im_rgba.size, PAPER_RGB)
                bg.paste(im_rgba, mask=im_rgba.split()[-1])
                im_out = bg
            elif im.mode != "RGB":
                im_out = im.convert("RGB")
            else:
                im_out = im.copy()
            if max(im_out.size) > MAX_DIM:
                im_out.thumbnail((MAX_DIM, MAX_DIM), Image.LANCZOS)
            os.makedirs(os.path.dirname(dst_path), exist_ok=True)
            im_out.save(
                dst_path,
                "JPEG",
                quality=QUALITY,
                optimize=True,
                progressive=True,
                subsampling="4:4:4",  # avoid colour bleed on gold/blue inks
            )
        b = os.path.getsize(src_path)
        a = os.path.getsize(dst_path)
        total_before += b
        total_after += a
        print(f"{src:55s}  {dst:50s}  {b/1024:7.0f}KB  {a/1024:7.0f}KB")

    print("-" * 140)
    print(f"TOTAL  {total_before/1024/1024:.1f}MB  ->  {total_after/1024/1024:.1f}MB"
          f"  ({100*total_after/total_before:.1f}% of original)")

    # ----- delete originals so the root stays clean -----
    print("\nDeleting originals from working tree:")
    for src in MAP:
        src_path = os.path.join(ROOT, src)
        if os.path.exists(src_path):
            os.remove(src_path)
            print(f"  rm {src}")


if __name__ == "__main__":
    main()
