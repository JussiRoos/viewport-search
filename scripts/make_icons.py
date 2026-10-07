"""Generates src/icons/icon-{16,32,48,128}.png. Requires Pillow: python3 scripts/make_icons.py"""
from pathlib import Path
from PIL import Image, ImageDraw

S = 1024  # draw large, downsample for antialiasing
BG = "#1e2a38"
TEXT = "#546e7a"
YELLOW = "#fff59d"  # ::highlight(vs-all)
ORANGE = "#ffb74d"  # ::highlight(vs-view)
FRAME = "#ffffff"


def draw(simple):
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, S - 1, S - 1), radius=220, fill=BG)
    if simple:
        # Small sizes: two thick lines with one in-view match and the viewport frame
        rows = [(380, None), (640, ORANGE)]
        h, frame = 130, (110, 230, 914, 794)
    else:
        # Page lines; the frame is the viewport: matches inside are orange, outside yellow
        rows = [(150, YELLOW), (360, ORANGE), (512, None), (664, ORANGE), (874, YELLOW)]
        h, frame = 76, (120, 255, 904, 769)
    spans = {YELLOW: (480, 720), ORANGE: (250, 520), None: None}
    for i, (y, color) in enumerate(rows):
        d.rounded_rectangle((200, y - h // 2, 824, y + h // 2), radius=h // 2, fill=TEXT)
        if color:
            x0, x1 = spans[color] if i % 2 else (spans[color][0] + 120, spans[color][1] + 104)
            d.rounded_rectangle((x0, y - h // 2 - 12, x1, y + h // 2 + 12), radius=24, fill=color)
    d.rounded_rectangle(frame, radius=70, outline=FRAME, width=56 if simple else 40)
    return img


out = Path(__file__).resolve().parent.parent / "src" / "icons"
out.mkdir(exist_ok=True)
for size in (16, 32, 48):
    draw(simple=size <= 32).resize((size, size), Image.LANCZOS).save(out / f"icon-{size}.png")
# Web Store guideline: 128px icon = 96px artwork + 16px transparent padding
icon = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
icon.paste(draw(simple=False).resize((96, 96), Image.LANCZOS), (16, 16))
icon.save(out / "icon-128.png")
