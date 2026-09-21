"""Genera data/products.js desde el Excel de precios. Falla si algo no cuadra.

El código de cada producto del catálogo es el NÚMERO DE FOTO (FOTOS/<código>.png).
La lista de precios vigente ("ROOTS 2") quitó "Chile en hojuelas 300 g" (foto 10) y recorrió su
numeración desde ahí, pero las fotos conservan la numeración anterior. Por eso cada fila de la lista
se empareja con su foto mediante `photo_code()` y se comprueba contra productos ancla: si el cliente
vuelve a mover la numeración, el script falla en vez de asignar fotos equivocadas.
"""
import json, re, sys
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / "PRODUCTOS CATALOGO" / "LISTADO DE PRODUCTOS CON PRECIO" / "LISTADO PRECIOS ROOTS 2.xlsx"
PHOTOS = ROOT / "PRODUCTOS CATALOGO" / "IMAGENES DE PRODUCTOS" / "FOTOS"
OUT = ROOT / "data" / "products.js"

# Chile hojuela 300 g (foto 10) no está en la lista vigente: no se publica sin precio.
MISSING_PHOTOS = {10}

# Fila de la lista -> nombre esperado (empieza con). Sirve para detectar renumeraciones.
ANCHORS = {9: "CHILE EN POLVO", 10: "COMINO MOLIDO", 11: "CONSOME DE POLLO", 30: "POZOL",
           31: "MOJO MARINADO", 41: "VINAGRE CONDIMENTADO", 42: "ACHIOTE MOLIDO 25 LB",
           52: "AJO EN POLVO 55 LB", 53: "REPOLLO CON REMOLACHA", 55: "ESCABECHE"}

# Por si el Excel vuelve a traer caracteres corruptos (U+FFFD), y una errata del Excel:
# la etiqueta de la foto 55 dice "SALVADOREÑO", el Excel dice "SALVADUREÑO".
FIXES = {"GAL�N": "GALÓN", "JALAPE�O": "JALAPEÑO", "SALVADURE�O": "SALVADOREÑO",
         "SALVADUREÑO": "SALVADOREÑO"}
ACCENTS = {"consome": "consomé", "curcuma": "cúrcuma", "oregano": "orégano"}
PRES_RE = re.compile(r"\s+(\d+(?:[./]\d+)?\s*(?:lb|g|oz|lts?)|gal[oó]n)\s*$", re.IGNORECASE)


def photo_code(list_code):
    return list_code if list_code < 10 else list_code + 1


def section_key(header):
    h = header.upper()
    if "ESPECIAS" in h: return "condimentos"
    if "SALSAS" in h: return "salsas"
    if "SACOS" in h: return "sacos"
    if "CONSERVAS" in h: return "conservas"
    sys.exit(f"Sección desconocida en el Excel: {header!r}")


def title(text):
    """Formato oración ('Ablandador de carne'), con los acentos que el Excel no trae."""
    words = [ACCENTS.get(w, w) for w in text.lower().split()]
    return " ".join(words).capitalize()


def pres(text):
    m = re.match(r"^(\d+(?:[./]\d+)?)\s*(lb|g|oz|lts?)$", text.strip(), re.IGNORECASE)
    if m: return f"{m.group(1)} {m.group(2).lower()}"
    return "1 galón" if text.lower().startswith("gal") else text


def main():
    ws = openpyxl.load_workbook(XLSX, data_only=True).active
    products, section, seen_rows = [], None, set()
    for row in ws.iter_rows(values_only=True):
        row_code, raw, _und_caja, price = row[:4]
        if not isinstance(row_code, (int, float)):
            if isinstance(row_code, str) and row_code.strip().upper() != "CODIGO":
                section = section_key(row_code)
            continue
        row_code = int(row_code)
        raw = str(raw).strip()
        for bad, good in FIXES.items(): raw = raw.replace(bad, good)
        if "�" in raw: sys.exit(f"Caracter corrupto sin corregir en fila {row_code}: {raw!r}")
        if row_code in ANCHORS and not raw.upper().startswith(ANCHORS[row_code]):
            sys.exit(f"La fila {row_code} ya no es {ANCHORS[row_code]!r} (es {raw!r}): la lista se renumeró, revisar photo_code().")
        seen_rows.add(row_code)
        m = PRES_RE.search(raw)
        if not m: sys.exit(f"No se pudo extraer la presentación de la fila {row_code}: {raw!r}")
        if price is None: sys.exit(f"Falta el precio de la fila {row_code}")
        code = photo_code(row_code)
        photo = PHOTOS / f"{code}.png"
        if not photo.exists(): sys.exit(f"Falta la foto {photo}")
        products.append({"code": code, "name": title(raw[: m.start()]), "presentation": pres(m.group(1)),
                         "category": section, "price": round(float(price), 2),
                         "image": f"img/{code}.webp", "soldOut": False})
    if seen_rows != set(range(1, 56)):
        sys.exit(f"Se esperaban las filas 1..55 y llegaron {len(seen_rows)}")
    products.sort(key=lambda p: p["code"])
    expected = [c for c in range(1, 57) if c not in MISSING_PHOTOS]
    if [p["code"] for p in products] != expected:
        sys.exit("Los códigos resultantes no son 1..56 sin el 10")
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text("// Generado por tools/build_data.py desde el Excel de precios. No editar a mano.\n"
                   "window.ROOTS_PRODUCTS = " + json.dumps(products, ensure_ascii=False, indent=2) + ";\n",
                   encoding="utf-8")
    print(f"OK: {len(products)} productos -> {OUT}")


if __name__ == "__main__":
    main()
