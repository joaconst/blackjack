# Mesa — notas para agentes

Memoria de trabajo del proyecto. Se carga automáticamente en cada sesión.
Mantené este archivo corto y actualizado: si cambia el estado, la versión o una
regla, editá acá en el mismo commit.

## Qué es

Blackjack y póker (Texas Hold'em) mobile con fichas virtuales, en español. Sin
frameworks ni build: HTML, CSS y JS puro con ES modules. PWA instalable y offline.

- Repo: <https://github.com/joaconst/blackjack.git>, rama `main`, al día con
  `origin`.
- Versión actual: `v2.0` (`APP_VERSION` en `js/app.js` y `js/poker.js`, `CACHE`
  en `sw.js`).
- El detalle de cada versión está en `CHANGELOG.md`; lo que falta, en `TODO.md`.

## Comandos

```bash
npm test                       # 52 tests unitarios de los dos motores (node --test)
npm start                      # npx serve . (el service worker necesita localhost o HTTPS)
node --check js/app.js         # chequeo de sintaxis antes de commitear
node --check js/poker.js
node --check js/poker-engine.js
node --check sw.js
```

Servidor de pruebas usado en sesiones anteriores: `http://localhost:4173/`.
Las pruebas E2E con Playwright viven en `C:\Users\const\AppData\Local\Temp\opencode\bj-test\`
(`run8.cjs` regresión de blackjack, `run-poker.cjs` póker y selector,
`visual.cjs` capturas, `probe-touch*.cjs` gestos). Son temporales: si se limpian,
hay que rehacerlas. Playwright usa `channel: 'msedge'`, viewport 390×844 y
320×568, `isMobile` y `hasTouch`.

## Reglas del proyecto

- **No tocar `js/sound.js` ni los volúmenes** salvo pedido explícito.
- Interfaz en **español rioplatense** (vos, podés, tocá).
- **Mobile-first**; los botones son la vía principal y los gestos un atajo.
- Mantener el estilo del código y los nombres existentes; sin dependencias nuevas.
- **Cada cambio en archivos que sirve la PWA** (HTML, CSS, JS, manifest, icons)
  sube la versión en tres lugares a la vez: `APP_VERSION` en `js/app.js`,
  `APP_VERSION` en `js/poker.js` y `CACHE` en `sw.js` (`blackjack-vX.Y`). Si no,
  la PWA instalada sigue mostrando la versión vieja. Los `.md` no requieren bump.
- La versión se muestra **solo en Ajustes** (`#appVersion`, pie de la hoja).
- Commits en español, Conventional Commits: `fix:`, `feat:`, `docs:`.
  Después de commitear, `git push origin main` y confirmar árbol limpio.

## Arquitectura

```
index.html            blackjack, selector de juego y hojas
poker.html            mesa de póker y hoja de ajustes
css/tokens.css        variables de color, tipografía y medidas
css/styles.css        layout, mesa, controles, hojas, animaciones
css/cards.css         skin de cartas y fichas
css/chooser.css       selector de juego
css/poker.css         mesa, asientos y acciones de póker
js/engine.js          reglas y cálculos puros del blackjack, sin DOM
js/poker-engine.js    evaluador, apuestas, botes y bots, sin DOM
js/sound.js           Web Audio sintetizado (no tocar sin pedido)
js/app.js             estado, DOM, persistencia, gestos, PWA
js/poker.js           controlador del póker, turnos, bots y saldo compartido
sw.js                 cache offline (subir CACHE en cada deploy)
tests/engine.test.js  28 tests del blackjack
tests/poker.test.js   24 tests del póker
```

- `state.hands` **no se persiste**: al recargar se vuelve a la fase de apuesta.
- La mesa de póker sí se persiste en `poker.table.v1`; si recargás en medio de
  una mano, se reanuda. El neto se aplica al saldo recién al terminar (`applied`).
- Persistencia: `blackjack.prefs.v1` (tema, sonido, gestos, `game`) y
  `blackjack.progress.v1` (saldo, apuesta, último saldo diario). El saldo es
  compartido entre los dos juegos; `game` vale `'blackjack' | 'poker' | ''`.
- `index.html` redirige a `poker.html` si `game === 'poker'`; el póker guarda
  `game = 'blackjack'` antes de volver para no hacer ping-pong.
- Clases de resultado: las cajas por mano (`.hand.is-win/.is-lose/.is-push`)
  aplican **solo** dentro de `.player-hands.is-multi` (split). En mano única el
  resultado se marca con el badge del puntaje (`.score.is-win/.is-lose`) y el
  texto de estado. No volver a poner fondo/borde al `.hand` suelto.
- Constantes de gestos en `js/app.js`: borde 28 px, All in 90 px (aviso 45 px,
  arrastre hasta 2500 ms), limpiar 52 px, juego 64/80 px en 0,9 s, doble toque
  450 ms y 40 px.
- Póker: ciegas $5/$10, cap por mano $300 (`TABLE_CAP`), bots con Monte Carlo
  (`sims: 140`) y demoras de 620–1140 ms. El saldo disponible durante una mano es
  `balance - (startStack - stack del jugador)`.

## Seeds deterministas para E2E

Se inyecta un `Math.random` con mulberry-ish en `addInitScript`:

| Seed | Resultado |
| --- | --- |
| `3` | derrota en mano única |
| `244` | victoria en mano única y sirve para 4 manos |
| `18` | par de 8 (split) |
| `122` | par de ases |

## Verificación antes de dar algo por terminado

1. `node --check` de `js/app.js`, `js/poker.js`, `js/poker-engine.js` y `sw.js`.
2. `npm test` → 52/52.
3. Playwright blackjack: victoria (244) y derrota (3) en mano única sin caja;
   split (18) conserva cajas redondeadas; capturas en 390×844 y 320×568; sin
   errores de consola.
4. Playwright póker (`run-poker.cjs`): selector, persistencia, reanudación,
   bloqueo de cambio en mano, liquidación del saldo, regreso al blackjack y sin
   desborde en 320×568.
5. Si se tocó interacción, probar gestos con touch real simulado (CDP
   `Input.dispatchTouchEvent`), no solo con clicks.
6. Commit + push y confirmar que `HEAD` y `origin/main` coinciden.
