# Mesa — notas para agentes

Memoria de trabajo del proyecto. Se carga automáticamente en cada sesión.
Mantené este archivo corto y actualizado: si cambia el estado, la versión o una
regla, editá acá en el mismo commit.

## Qué es

Blackjack y póker (Texas Hold'em) mobile, en español. Sin
frameworks ni build: HTML, CSS y JS puro con ES modules. PWA instalable y offline.

- Repo: <https://github.com/joaconst/blackjack.git>, rama `main`, al día con
  `origin`.
- Versión actual: `v2.5` (`APP_VERSION` en `js/app.js` y `js/poker.js`, `CACHE`
  en `sw.js`).
- El detalle de cada versión está en `CHANGELOG.md`; lo que falta, en `TODO.md`.

## Comandos

```bash
npm test                       # 68 tests unitarios de los dos motores (node --test)
npm start                      # npx serve . (el service worker necesita localhost o HTTPS)
node --check js/app.js         # chequeo de sintaxis antes de commitear
node --check js/poker.js
node --check js/poker-engine.js
node --check sw.js
```

Servidor de pruebas usado en sesiones anteriores: `http://localhost:4173/`.
Las pruebas E2E con Playwright viven en `C:\Users\const\AppData\Local\Temp\opencode\bj-test\`
(`run8.cjs` regresión de blackjack, `run-poker.cjs` póker y selector,
`probe-raise2.cjs` panel de subida, `probe-poker-gestures.cjs` gestos y salto al
final, `probe-bj-noscroll.cjs` bloqueo vertical y hojas del blackjack,
`probe-beta-poker.cjs` fichas beta del póker y textos, `probe-bot-levels.cjs`
niveles y charla de los bots, `visual.cjs` capturas, `probe-touch*.cjs` gestos).
Son temporales: si se limpian, hay que rehacerlas.
Playwright usa `channel: 'msedge'`, viewport 390×844 y 320×568, `isMobile` y
`hasTouch`.

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
js/poker.js           controlador del póker, turnos, bots, gestos y saldo compartido
sw.js                 cache offline (subir CACHE en cada deploy)
tests/engine.test.js  28 tests del blackjack
tests/poker.test.js   40 tests del póker
```

- `state.hands` **no se persiste**: al recargar se vuelve a la fase de apuesta.
- La mesa de póker sí se persiste en `poker.table.v1`; si recargás en medio de
  una mano, se reanuda. El neto se aplica al saldo recién al terminar (`applied`).
- Persistencia: `blackjack.prefs.v1` (tema, sonido, gestos, `botLevel`,
  `botTalk`, `game`) y `blackjack.progress.v1` (saldo, apuesta, último saldo
  diario). El saldo es compartido entre los dos juegos; `game` vale
  `'blackjack' | 'poker' | ''`. `savePrefs()` en los dos controladores conserva
  las claves que no toca: no volver a escribirlo con un objeto fijo o se pierden
  el nivel y la charla al cambiar de juego.
- `index.html` redirige a `poker.html` si `game === 'poker'`; el póker guarda
  `game = 'blackjack'` antes de volver para no hacer ping-pong.
- Clases de resultado: las cajas por mano (`.hand.is-win/.is-lose/.is-push`)
  aplican **solo** dentro de `.player-hands.is-multi` (split). En mano única el
  resultado se marca con el badge del puntaje (`.score.is-win/.is-lose`) y el
  texto de estado. No volver a poner fondo/borde al `.hand` suelto.
- Constantes de gestos en `js/app.js`: borde 28 px, All in 90 px (aviso 45 px,
  arrastre hasta 2500 ms), limpiar 52 px, juego 64/80 px en 0,9 s, doble toque
  450 ms y 40 px.
- Gestos del póker en `js/poker.js`: borde 28 px, doble toque 450 ms/40 px,
  derecha 52 px para igualar/pasar, izquierda 90 px para retirarse (aviso a los
  45 px) en 0,9 s. Después de retirarse, el doble toque o `#skipBtn` llaman a
  `skipToEnd()`, que cancela `state.botTimer` y corre a los bots hasta `settled`
  con una guarda de 500 acciones. La preferencia `gestures` es compartida con el
  blackjack.
- **La pantalla de juego no panea en ningún juego:** `.app` usa
  `touch-action: none` en `css/styles.css` y `.poker__table` lo repite. Los desliz
  verticales no mueven ni hacen rebotar la página, tampoco sobre las fichas. Las
  hojas de Ajustes, la de agregar fichas y el selector viven fuera de `.app`, así
  que conservan su scroll. El scroll por código sigue andando (`scrollIntoView`
  del panel de subida y del banner de resultado); `closeRaise()` y
  `startNewHand()` vuelven a `scrollY = 0`. No mover el bloqueo a `html`/`body`:
  rompería las hojas.
- **Fichas beta:** están en los dos juegos, en Ajustes. El póker repite el bloque
  de `js/app.js` (`makeChip`, `renderAddSheet`, `confirmAddFunds`) y usa
  `available()` para el saldo de la hoja, así no cuenta lo comprometido en la
  mano. Al confirmar se llama `saveProgress()` y `render()`.
- Póker: ciegas $5/$10, cap por mano $300 (`TABLE_CAP`), bots con Monte Carlo
  (`sims: 140`) y demoras de 620–1140 ms. El saldo disponible durante una mano es
  `balance - (startStack - stack del jugador)`.
- Montos de subida: `raiseOptions`, `clampRaiseTarget` y `stepRaiseTarget` en
  `js/poker-engine.js` son la única fuente de verdad. El panel usa presets
  (mínima, ½ pozo, pozo, all in) y pasos de una ciega chica; reutilizar esas
  funciones si se agregan gestos de subida. El all-in siempre pide confirmación.
- **Bots (`js/poker-engine.js`):** `BOT_PROFILES` tiene `tight` (Ana),
  `balanced` (Beto) y `aggro` (Caro); el controlador los reparte con
  `BOT_PROFILES[(index - 1) % 3]`. `BOT_LEVELS` (`suave`/`normal`/`duro`) ajusta
  agresión, farol, tightness y `mistake`; `resolveTraits(profile, level)` mezcla
  las dos cosas y es lo único que leen las decisiones.
  `botAction(table, index, { profile, level, rng, sims })` decide con
  `preflopScore`, `positionScore`, `boardTexture` y `drawInfo`; devuelve la acción
  con un `intent` (`value`, `bluff`, `semiBluff`, `draw`, `weak`) que
  `applyAction` usa solo para marcar `bluffing`, nunca para cambiar reglas.
  El tiro de `mistake` consume RNG siempre, aun con `mistake = 0`, para que dos
  niveles con la misma semilla se comparen de verdad.
- `bestHand` acepta 5, 6 o 7 cartas (`COMBOS_5/6/7`); no volver a asumir 7 o el
  cálculo de proyectos en el flop rompe la mano.
- La mesa guarda `lastAggressor`, `raisesThisStreet` y, por jugador, `raises`,
  `lastAction` y `bluffing`. `normalizeTable` completa las mesas viejas al cargar;
  si se agrega un campo, sumarlo ahí y en `resetStreet`/`startHand`.
- **Charla:** `pickBotLine(intent, rng)` elige de `BOT_TALK` y miente en ~38% de
  los casos. El controlador usa su propio LCG (`talkRandom`) para no consumir
  `Math.random` ni cambiar las manos repartidas (`BOT_TALK_CHANCE = 0.22`,
  `BOT_TALK_MS = 1900`). La frase nunca tapa “Se retiró” ni “All in”: solo habla
  el asiento sin etiqueta. Se limpia al terminar la mano o repartir.

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
2. `npm test` → 68/68.
3. Playwright blackjack: victoria (244) y derrota (3) en mano única sin caja;
   split (18) conserva cajas redondeadas; capturas en 390×844 y 320×568; sin
   errores de consola. Comprobar que un swipe vertical sobre las fichas, el
   encabezado o los botones no cambia `scrollY`, que los gestos de pedir y
   plantarse siguen andando y que la hoja de Ajustes scrollea.
4. Playwright póker (`run-poker.cjs`): selector, persistencia, reanudación,
   bloqueo de cambio en mano, liquidación del saldo, regreso al blackjack y sin
   desborde en 320×568. Probar aparte el panel de subida (`probe-raise2.cjs`):
   presets, −/+, cancelar, all-in confirmado y botón de confirmar visible en
   320×568. Probar los gestos (`probe-poker-gestures.cjs`): doble toque, swipe
   derecha/izquierda, interruptor apagado, botón Ver el final, recarga después de
   retirarse y salto al ganador en 390×844 y 320×568. Comprobar además que un
   swipe vertical sobre la mesa y sobre los controles no cambia `scrollY`, que la
   hoja de Ajustes sí scrollea y que el gesto horizontal sigue funcionando
   después. Probar las fichas beta del póker: sumar, deshacer, limpiar,
   confirmar con el saldo actualizado y persistido, y que no queden textos de
   “fichas virtuales” en ninguna de las dos páginas. Probar los bots
   (`probe-bot-levels.cjs`): los tres niveles, `aria-checked`, la pista, que se
   guarden al recargar y sobrevivan a ir al blackjack y volver, la charla y su
   interruptor, que la frase no tape retirado ni all in, que con la charla
   apagada nadie hable, y el layout en 320×568.
5. Si se tocó interacción, probar gestos con touch real simulado (CDP
   `Input.dispatchTouchEvent`), no solo con clicks.
6. Commit + push y confirmar que `HEAD` y `origin/main` coinciden.
