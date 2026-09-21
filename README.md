# Root's — Catálogo web

Catálogo de productos Root's (condimentos, salsas, sacos y conservas). El cliente arma su pedido y lo envía por WhatsApp
con el listado, precio por unidad y total.

- **Sitio:** https://roots-catalogo.vercel.app
- **Panel de precios:** https://roots-catalogo.vercel.app/admin.html (con contraseña)
- **WhatsApp de pedidos:** +504 3191-0999 (`js/config.js`)

## Cómo funciona

Sitio estático (HTML/CSS/JS sin build) + dos funciones serverless para el panel.

| Archivo | Qué hace |
|---|---|
| `index.html`, `css/style.css`, `js/app.js` | Catálogo, categorías, buscador, carrito y animaciones |
| `js/cart.js`, `js/search.js` | Lógica pura (dinero, mensaje de WhatsApp, búsqueda). Con pruebas |
| `js/config.js` | Número de WhatsApp, categorías, contacto y URL del menú vivo |
| `data/products.js` | Respaldo estático de los productos (generado desde el Excel) |
| `admin.html`, `js/admin.js` | Panel para editar nombre, precio y "agotado" |
| `api/admin-login.js`, `api/admin-save.js` | Validan la contraseña y guardan `menu.json` en Vercel Blob |
| `lib/auth.js`, `lib/menu.js` | Contraseña con `scrypt` y validación del menú |
| `tools/` | Generación de datos e imágenes, semilla del Blob, servidor local |

Los datos vivos están en `menu.json` (Vercel Blob `roots-menu`). Si no carga en 3 s, el sitio usa `data/products.js`.
Los cambios del panel tardan entre 10 y 60 segundos en verse (caché de la CDN de Blob).

## Precios y códigos

- Todos los precios son **por unidad, con ISV incluido**. La columna "UND POR CAJA" del Excel se ignora.
- El **código del producto es el número de foto** (`FOTOS/<código>.png`). Son 55 productos, códigos 1–56 **sin el 10**
  (el Chile hojuela 300 g no está en la lista vigente).
- Categorías: `condimentos`, `salsas`, `sacos`, `conservas` (se toman de los encabezados del Excel).

## Desarrollo

```bash
npm install
npm test                 # pruebas (node:test)
node tools/serve.js      # http://localhost:8099 (solo estático; /api no corre en local)
```

### Actualizar la lista de precios

El Excel y las fotos originales **no van al repo** (carpeta `PRODUCTOS CATALOGO/`). Con el nuevo Excel en su lugar:

```bash
python tools/build_data.py        # Excel -> data/products.js (falla si la numeración cambió)
python tools/optimize_images.py   # PNG -> img/<código>.webp (solo si hay fotos nuevas)
node --env-file=.env.local tools/seed-blob.js   # sube el menú al Blob (pisa los cambios hechos desde el panel)
```

`build_data.py` empareja cada fila con su foto mediante `photo_code()` y verifica productos "ancla": si el cliente vuelve a
renumerar la lista, el script se detiene en lugar de asignar fotos equivocadas. Si eso pasa, revisar `photo_code()` y `ANCHORS`.

Requiere Python 3 con `openpyxl` y `Pillow`.

## Despliegue y variables de entorno

Cada push a `main` despliega solo en Vercel (proyecto `roots-catalogo`, equipo `fernando-team2`). Manual: `vercel --prod --yes`.

| Variable | Uso |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | Escribir `menu.json` en el Blob (la crea Vercel al conectar el store) |
| `ADMIN_PASSWORD_HASH` | `salt:hash` (scrypt) de la contraseña del panel |

Cambiar la contraseña del panel:

```bash
node tools/make_hash.js "nueva-contraseña-larga"      # imprime salt:hash
vercel env rm ADMIN_PASSWORD_HASH production --yes
printf '%s' "<salt:hash>" | vercel env add ADMIN_PASSWORD_HASH production
vercel --prod --yes                                   # las variables se leen al desplegar
```

Nota: `vercel link` / `vercel blob create-store` agregan líneas duplicadas a `.gitignore`; descartarlas con `git checkout .gitignore`.

## Documentos

- Diseño: `docs/superpowers/specs/2026-09-21-roots-catalogo-design.md`
- Plan de implementación: `docs/superpowers/plans/2026-09-21-roots-catalogo.md`
