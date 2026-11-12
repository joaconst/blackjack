# Blackjack — notas para agentes

Memoria de trabajo del proyecto. Se carga automáticamente en cada sesión.
Mantené este archivo corto y actualizado: si cambia el estado, la versión o una
regla, editá acá en el mismo commit.

## Qué es

Blackjack mobile con fichas virtuales, en español. Sin frameworks ni build:
HTML, CSS y JS puro con ES modules. PWA instalable y offline.

- Repo: <https://github.com/joaconst/blackjack.git>, rama `main`, al día con
  `origin`.
- Versión actual: `v1.1` (`APP_VERSION` en `js/app.js` y `CACHE` en `sw.js`).
- El detalle de cada versión está en `CHANGELOG.md`; lo que falta, en `TODO.md`.

## Comandos

```bash
npm test                       # 28 tests unitarios del motor (node --test)
npm start                      # npx serve . (el service worker necesita localhost o HTTPS)
node --check js/app.js         # chequeo de sintaxis antes de commitear
node --check sw.js
```

Servidor de pruebas usado en sesiones anteriores: `http://localhost:4173/`.
Las pruebas E2E con Playwright viven en `C:\Users\const\AppData\Local\Temp\opencode\bj-test\`
(`run8.cjs` regresión amplia, `visual.cjs` capturas, `probe-touch*.cjs` gestos).
Son temporales: si se limpian, hay que rehacerlas. Playwright usa
`channel: 'msedge'`, viewport 390×844 y 320×568, `isMobile` y `hasTouch`.

## Reglas del proyecto

- **No tocar `js/sound.js` ni los volúmenes** salvo pedido explícito.
- Interfaz en **español rioplatense** (vos, podés, tocá).
- **Mobile-first**; los botones son la vía principal y los gestos un atajo.
- Mantener el estilo del código y los nombres existentes; sin dependencias nuevas.
- **Cada cambio en archivos que sirve la PWA** (HTML, CSS, JS, manifest, icons)
  sube la versión en dos lugares a la vez: `APP_VERSION` en `js/app.js` y
  `CACHE` en `sw.js` (`blackjack-vX.Y`). Si no, la PWA instalada sigue mostrando
  la versión vieja. Los `.md` no requieren bump.
- La versión se muestra **solo en Ajustes** (`#appVersion`, pie de la hoja).
- Commits en español, Conventional Commits: `fix:`, `feat:`, `docs:`.
  Después de commitear, `git push origin main` y confirmar árbol limpio.

## Arquitectura

```
index.html            estructura y hojas (Ajustes, reglas, confirmaciones)
css/tokens.css        variables de color, tipografía y medidas
css/styles.css        layout, mesa, controles, hojas, animaciones
css/cards.css         skin de cartas y fichas
js/engine.js          reglas y cálculos puros, sin DOM
js/sound.js           Web Audio sintetizado (no tocar sin pedido)
js/app.js             estado, DOM, persistencia, gestos, PWA
sw.js                 cache offline (subir CACHE en cada deploy)
tests/engine.test.js  28 tests del motor
```

- `state.hands` **no se persiste**: al recargar se vuelve a la fase de apuesta.
- Persistencia: `blackjack.prefs.v1` (tema, sonido, gestos) y
  `blackjack.progress.v1` (saldo, apuesta, último saldo diario).
- Clases de resultado: las cajas por mano (`.hand.is-win/.is-lose/.is-push`)
  aplican **solo** dentro de `.player-hands.is-multi` (split). En mano única el
  resultado se marca con el badge del puntaje (`.score.is-win/.is-lose`) y el
  texto de estado. No volver a poner fondo/borde al `.hand` suelto.
- Constantes de gestos en `js/app.js`: borde 28 px, All in 90 px (aviso 45 px,
  arrastre hasta 2500 ms), limpiar 52 px, juego 64/80 px en 0,9 s, doble toque
  450 ms y 40 px.

## Seeds deterministas para E2E

Se inyecta un `Math.random` con mulberry-ish en `addInitScript`:

| Seed | Resultado |
| --- | --- |
| `3` | derrota en mano única |
| `244` | victoria en mano única y sirve para 4 manos |
| `18` | par de 8 (split) |
| `122` | par de ases |

## Verificación antes de dar algo por terminado

1. `node --check js/app.js` y `node --check sw.js`.
2. `npm test` → 28/28.
3. Playwright: victoria (244) y derrota (3) en mano única sin caja; split (18)
   conserva cajas redondeadas; capturas en 390×844 y 320×568; sin errores de
   consola.
4. Si se tocó interacción, probar gestos con touch real simulado (CDP
   `Input.dispatchTouchEvent`), no solo con clicks.
5. Commit + push y confirmar que `HEAD` y `origin/main` coinciden.
