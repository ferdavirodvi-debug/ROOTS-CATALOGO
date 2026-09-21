# Catálogo web Root's — Diseño

Fecha: 2026-09-21 · Repo: `ferdavirodvi-debug/ROOTS-CATALOGO` · Producción: https://roots-catalogo.vercel.app

## 1. Objetivo

Catálogo web de productos Root's (condimentos, salsas, sacos, conservas) donde un cliente B2B navega por
categorías simples, arma un pedido y lo envía por WhatsApp a Root's como mensaje con el listado de productos,
precio unitario, subtotales y total.

Prioridad de diseño: **eficiencia y simplicidad**. Muchos clientes no son jóvenes ni técnicos, así que
cada acción debe ser obvia, con pocos pasos, letra grande y botones grandes.

Referencias del usuario:
- **PERFUMASTER** (`Desktop\PERFUMASTER`): categorías simples y definidas.
- **CRUNCHIES** (`Desktop\CRUNCHIES`): carrito + mensaje por WhatsApp + panel admin sobre Vercel Blob.
- **foodsroots.com**: el aspecto visual y las animaciones deben sentirse como la web actual de Root's.

## 2. Alcance

Incluido (v1):
- Catálogo de 56 productos con foto, nombre, presentación y precio por unidad.
- 4 categorías + buscador.
- Carrito persistente y envío del pedido por WhatsApp (+504 3191-0999).
- Panel `admin.html` con contraseña para editar precios, nombres y marcar productos agotados.
- Estilo y animaciones de foodsroots.com (adaptadas, sin pantalla de carga).
- Despliegue automático en Vercel.

Fuera de alcance (v1):
- Pagos en línea, cuentas de cliente, inventario, envío/flete, cupones.
- Alta/baja de productos y subida de fotos desde el admin (los 56 productos son fijos por código; se agregan por código en una fase posterior).
- Selector caja/unidad: **todos los precios son por unidad y la columna "UND POR CAJA" del Excel se ignora** (decisión del usuario).
- Multi-idioma (solo español), dominio propio.

## 3. Datos

Fuente: `PRODUCTOS CATALOGO/LISTADO DE PRODUCTOS CON PRECIO/LISTADO PRECIOS ROOTS.xlsx` (56 filas, códigos 1–56)
y `PRODUCTOS CATALOGO/IMAGENES DE PRODUCTOS/FOTOS/{código}.png`. Ambas carpetas quedan **fuera del repo**.

Modelo de producto:

```js
{
  code: 12,                       // = número de foto = código del Excel
  name: 'Consomé de pollo',       // limpio, con acentos corregidos, sin presentación
  presentation: '1 lb',           // extraída del nombre del Excel
  category: 'condimentos',        // condimentos | salsas | sacos | conservas
  price: 30,                      // L por unidad, ISV incluido
  image: 'img/12.webp',
  soldOut: false                  // editable desde el admin
}
```

Categorías (nombres visibles): Condimentos y especias (1–31, incluye las bebidas solubles del Excel),
Salsas y vinagres (32–42), Sacos (43–53), Conservas (54–56).

Limpieza: el Excel trae acentos corruptos (`GAL�N`, `JALAPE�O`, `SALVADURE�O`) y el encabezado `CODIMENTOS`.
El script de generación aplica un mapa de nombres explícito y revisado a mano (no regex ciega) y falla si
algún código 1–56 queda sin nombre, precio o foto. "SALVADURE�O" se verifica contra la etiqueta de la foto 55.

Fuentes de datos en tiempo de ejecución:
1. `menu.json` público en Vercel Blob (fuente viva, editable desde el admin).
2. `data/products.js` en el repo (respaldo estático si el Blob no carga en ~3 s).

## 4. Arquitectura

Sitio estático sin build + 2 funciones serverless. Mismo patrón que CRUNCHIES.

```
index.html · admin.html
css/style.css
js/config.js      // WhatsApp, moneda, menuUrl, textos
js/cart.js        // lógica pura: agregar/quitar, totales, mensaje WhatsApp (testeable en Node)
js/app.js         // UI: render, filtros, búsqueda, carrito, animaciones
js/admin.js       // UI del panel
data/products.js  // respaldo estático generado desde el Excel
api/admin-login.js · api/admin-save.js
img/              // logo.svg, {1..56}.webp, favicons
tools/            // build-data (Excel → products.js), optimize-images (PNG → WebP), seed-blob, serve
tests/            // node:test para cart.js y búsqueda
docs/superpowers/specs/
```

`js/cart.js` no toca el DOM: recibe el catálogo y el estado del carrito y devuelve totales y texto.
Así el cálculo del dinero y el mensaje se prueban sin navegador.

## 5. Interfaz

**Header** (pegado arriba, verde claro `#E6F2DE`, sombra al hacer scroll): logo Root's, buscador, ícono de carrito con contador.

**Categorías**: fila de botones grandes tipo píldora, siempre visibles: Todos · Condimentos y especias · Salsas y vinagres · Sacos · Conservas. La activa se marca en verde profundo.

**Buscador**: filtra al escribir por nombre o código, ignorando mayúsculas y acentos. Sin resultados: mensaje claro con botón "Ver todos".

**Tarjeta de producto**: foto (contain, fondo blanco), nombre, presentación, precio `L 75.00 c/u`, selector `−  1  +` y botón verde "Agregar". Si `soldOut`: etiqueta "Agotado" y botón deshabilitado. Una vez agregado, la tarjeta muestra la cantidad en el carrito.

**Botón flotante del carrito** (abajo a la derecha, círculo verde con anillo pulsante): contador y total. Abre el carrito.

**Carrito** (panel lateral en escritorio, pantalla completa en celular): líneas con `− +` y quitar, subtotal por línea, total, campo "Nombre o negocio" (obligatorio) y botón grande "Enviar pedido por WhatsApp". Vacío: mensaje y botón "Ver productos".

**Pie**: teléfono, correo `sac@rootshn.com`, Instagram `@fooodroots`, Facebook, TikTok `@foodsroots`, enlace a foodsroots.com, y la nota "Precios por unidad, ISV incluido".

**Accesibilidad**: `lang="es"`, base 18 px, objetivos táctiles ≥ 48 px, contraste AA (verde `#2E7900` sobre blanco), foco visible, `aria-label` en íconos, controles operables con teclado.

## 6. Carrito y mensaje de WhatsApp

- Estado: `{ [code]: cantidad }` en `localStorage` (`roots_cart_v1`), con try/catch: si falla, funciona en memoria.
- Al cargar se **valida contra el catálogo vigente**: se descartan códigos desconocidos o agotados. **Los precios nunca se leen del almacenamiento**, siempre del catálogo.
- Cantidad entera 1–999; el campo numérico acepta escribir directo con teclado numérico.
- Importe por línea = cantidad × precio, redondeado a centavos por línea; total = suma de líneas.
- Envío: `https://wa.me/50431910999?text=<mensaje codificado>`; se abre en pestaña nueva.

Formato del mensaje (monospace no garantizado, texto plano):

```
Hola Root's, quiero hacer este pedido:

• 2 × Achiote molido 1 lb — L 75.00 c/u = L 150.00
• 1 × Consomé de pollo 1 lb — L 30.00 c/u = L 30.00

TOTAL: L 180.00 (precios con ISV incluido)
Cliente: Nombre o negocio
```

Los precios del mensaje son informativos: Root's confirma el pedido por WhatsApp, por lo que no hay
riesgo de cobro manipulado desde el navegador.

## 7. Panel de administración

`/admin.html`, con contraseña. Tabla de los 56 productos con: precio (editable), nombre (editable), interruptor "Agotado".
Guardar publica `menu.json` en Vercel Blob mediante `/api/admin-save`; los cambios se ven al instante sin republicar.

Diferencias de seguridad frente a CRUNCHIES (que usa un hash no criptográfico):
- Contraseña verificada en el servidor con `crypto.scrypt` y comparación `timingSafeEqual`; `ADMIN_PASSWORD_HASH` = `salt:hash` en variable de entorno de Vercel.
- `/api/admin-save` valida forma y rangos (56 códigos únicos, precio numérico ≥ 0 con 2 decimales, nombre no vacío, longitud máxima) antes de escribir.
- La contraseña generada se entrega al usuario en el chat y no se guarda en el repo ni en memoria.
- Se documenta que el admin no tiene límite de intentos (riesgo aceptado para v1, mitigable con contraseña larga).

## 8. Estilo y animaciones (de foodsroots.com)

- Tipografía: **Glory** (Google Fonts) en títulos, menú y precios; Roboto para botones y texto pequeño.
- Colores: verde profundo `#2E7900`, verde vivo `#3AB54A` / `#6DB83C`, verde claro `#E6F2DE` / `#D0E7C1`, marrón `#43220A` (logo), gris `#5C5C5C`, fondo blanco.
- Forma: tarjetas con radio 25 px, píldoras 50 px, títulos de sección centrados en verde.
- Logo oficial `LOGO2.svg` de foodsroots.com guardado localmente en `img/logo.svg`.
- Animaciones: aparición al entrar en pantalla (`IntersectionObserver`): `fadeInUp` en secciones y `zoomIn` en tarjetas con escalonado corto (máx. 40 ms por tarjeta, tope total 400 ms), duración 0.4–0.6 s; hovers de 0.3 s; anillo pulsante en el botón del carrito; `prefers-reduced-motion` las desactiva.
- **Sin pantalla de carga**; el contenido aparece de inmediato.

## 9. Imágenes

`tools/optimize-images.py` convierte cada PNG (1–2 MB) a WebP, lado mayor 640 px, calidad ≈ 80, fondo blanco para las RGBA,
manteniendo proporción; objetivo ≈ 30–60 KB por foto. Se guardan en `img/{código}.webp` (sí van al repo) con `width`/`height` explícitos
y `loading="lazy"` salvo las primeras 8. Los PNG originales no se tocan.

## 10. Despliegue y flujo de trabajo

- Un commit + push por cambio (preferencia del usuario), seguido de `vercel --prod --yes`. Vercel también despliega solo al hacer push.
- Crear el Blob store del proyecto, subir `menu.json` inicial con `tools/seed-blob.js` y fijar `SITE_CONFIG.menuUrl`.
- Variables de entorno en Vercel: `BLOB_READ_WRITE_TOKEN`, `ADMIN_PASSWORD_HASH`.
- Revertir con `git checkout .gitignore` las líneas duplicadas que agrega `vercel link`.

## 11. Pruebas y criterios de aceptación

Automáticas (`node --test`):
- `cart.js`: totales con decimales (p. ej. `118.25 × 3`), cantidades límite, descarte de códigos agotados/desconocidos, formato exacto del mensaje.
- Búsqueda: insensible a acentos y mayúsculas, por nombre y por código.
- `build-data`: falla si falta nombre/precio/foto de algún código 1–56.

Verificación en navegador (celular 375 px y escritorio):
- Las 56 tarjetas muestran la foto y el nombre correctos (muestreo visual de al menos una foto por categoría).
- Agregar, cambiar cantidad, quitar y recargar la página conserva el carrito.
- El enlace de WhatsApp abre el chat con el número +50431910999 y el mensaje esperado.
- `/api/admin-login` rechaza contraseña incorrecta (401) y acepta la correcta; `/api/admin-save` rechaza datos inválidos (400); un cambio de precio en el admin se refleja en el catálogo sin republicar.
- Lighthouse móvil: rendimiento y accesibilidad sin advertencias graves; peso de la página inicial razonable en datos móviles.

## 12. Riesgos y decisiones abiertas

- **Tabla de precios**: el cliente puede volver a actualizarla; el admin y `tools/build-data` permiten reflejarlo sin rehacer nada.
- **Bebidas solubles** quedan dentro de Condimentos y especias como en el Excel; separarlas es un cambio de una línea de datos si Root's lo pide.
- **Fotos de formatos muy distintos** (bolsa, garrafa, saco, frasco): se muestran sin recorte dentro de un cuadro común de proporción fija, con fondo blanco.
- **Sin límite de intentos en el admin** (ver §7).
