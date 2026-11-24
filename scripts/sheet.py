# contact sheet of stills: python scripts/sheet.py out.jpg a.jpg b.jpg ... (5 per row, 270x480 each, frame labels)
import sys, os
from PIL import Image, ImageDraw
out, files = sys.argv[1], sys.argv[2:]
W, H, N = 270, 480, 5
rows = (len(files) + N - 1) // N
S = Image.new("RGB", (W * N, H * rows), "black"); d = ImageDraw.Draw(S)
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB").resize((W, H)); x, y = (i % N) * W, (i // N) * H
    S.paste(im, (x, y)); d.rectangle([x, y, x + 60, y + 14], fill="black"); d.text((x + 2, y + 1), os.path.basename(f), fill="yellow")
S.save(out, quality=85)
