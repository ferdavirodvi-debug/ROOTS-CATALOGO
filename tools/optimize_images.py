"""Convierte los PNG originales a WebP livianos (lado mayor 640 px, fondo blanco).

Solo convierte las fotos de productos que están en data/products.js (la foto 10 queda fuera).
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "PRODUCTOS CATALOGO" / "IMAGENES DE PRODUCTOS" / "FOTOS"
DST = ROOT / "img"
DATA = ROOT / "data" / "products.js"
MAX = 640


def product_codes():
    text = DATA.read_text(encoding="utf-8")
    return [p["code"] for p in json.loads(text[text.index("["): text.rindex("]") + 1])]


def main():
    DST.mkdir(exist_ok=True)
    total = 0
    codes = product_codes()
    for code in codes:
        im = Image.open(SRC / f"{code}.png")
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.split()[-1])
            im = bg
        else:
            im = im.convert("RGB")
        im.thumbnail((MAX, MAX), Image.LANCZOS)
        out = DST / f"{code}.webp"
        im.save(out, "WEBP", quality=80, method=6)
        total += out.stat().st_size
        print(f"{code}.webp {im.size} {out.stat().st_size // 1024} KB")
    print(f"Total: {len(codes)} fotos, {total // 1024} KB")


if __name__ == "__main__":
    main()
