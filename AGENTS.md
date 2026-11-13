# Mesa — notas para agentes

Memoria de trabajo del proyecto. Se carga automáticamente en cada sesión.
Mantené este archivo corto y actualizado: si cambia el estado, la versión o una
regla, editá acá en el mismo commit.

## Qué es

Blackjack y póker (Texas Hold'em) mobile, en español. Sin
frameworks ni build: HTML, CSS y JS puro con ES modules. PWA instalable y offline.

- Repo: <https://github.com/joaconst/blackjack.git>, rama `main`, al día con
  `origin`.
- Versión actual: `v2.11` (`APP_VERSION` en
  `js/games/blackjack/controller.js` y `js/games/poker/controller.js`, `CACHE`
  en `sw.js`).
- El detalle de cada versión está en `CHANGELOG.md`; lo que falta, en `TODO.md`.

## Comandos

```bash
npm test                       # 75 tests unitarios de los dos motores (node --test)
npm start                      # npx serve . (el service worker necesita localhost o HTTPS)
node --check js/games/blackjack/controller.js   # chequeo de sintaxis antes de commitear
node --check js/games/poker/controller.js
node --check js/games/blackjack/engine.js
node --check js/games/poker/engine.js
node --check sw.js
```

Servidor de pruebas usado en sesiones anteriores: `http://localhost:4173/`.
Las pruebas E2E con Playwright viven en `C:\Users\const\AppData\Local\Temp\opencode\bj-test\`
(`run8.cjs` regresión de blackjack, `run-poker.cjs` póker y selector,
`probe-raise2.cjs` panel de subida, `probe-poker-gestures.cjs` gestos y salto al
final, `probe-bj-noscroll.cjs` bloqueo vertical y hojas del blackjack,
`probe-beta-poker.cjs` fichas beta del póker y textos, `probe-bot-levels.cjs`
niveles, faroles y charla de los bots, `probe-v26-smoke.cjs` hoja Mesa, ciegas,
entrada sin tope y 320×568, `probe-v29-mesa.cjs` pistas de ciegas y entrada,
`probe-v210-blinds.cjs` escalera adaptable y ciega personalizada, `visual.cjs`
capturas, `probe-touch*.cjs` gestos).
Son temporales: si se limpian, hay que rehacerlas.
Playwright usa `channel: 'msedge'`, viewport 390×844 y 320×568, `isMobile` y
`hasTouch`.

## Reglas del proyecto

- **No tocar `js/sound.js` ni los volúmenes** salvo pedido explícito.
- Interfaz en **español rioplatense** (vos, podés, tocá).
- **Mobile-first**; los botones son la vía principal y los gestos un atajo.
- Mantener el estilo del código y los nombres existentes; sin dependencias nuevas.
- **Cada cambio en archivos que sirve la PWA** (HTML, CSS, JS, manifest, icons)
  sube la versión en tres lugares a la vez: `APP_VERSION` en
  `js/games/blackjack/controller.js`, `APP_VERSION` en
  `js/games/poker/controller.js` y `CACHE` en `sw.js` (`blackjack-vX.Y`). Si no,
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
js/core/storage.js    claves y lectura/escritura de localStorage
js/core/money.js      dinero, calendario, fichas y pila de fichas
js/core/cards.js      mazos, palos y etiquetas de cartas
js/core/prefs.js      preferencias compartidas (tema, sonido, gestos, juego)
js/core/wallet.js     saldo y bono diario
js/core/gestures.js   umbrales de toque y swipe
js/core/chips.js      fichas y hoja de agregar fichas
js/core/ui.js         tema, sonido, avisos, instalación y hojas
js/sound.js           Web Audio sintetizado (no tocar sin pedido)
js/games/blackjack/engine.js       reglas y cálculos puros del blackjack, sin DOM
js/games/blackjack/controller.js   estado, DOM, persistencia, gestos, PWA
js/games/poker/engine.js           evaluador, apuestas, botes y bots, sin DOM
js/games/poker/controller.js       turnos, bots, gestos y saldo compartido
sw.js                 cache offline (subir CACHE en cada deploy)
tests/engine.test.js  28 tests del blackjack
tests/poker.test.js   47 tests del póker
```

- **Capa común (`js/core/`):** todo lo que no es regla de un juego. Los
  controladores no vuelven a definir almacenamiento, prefs, saldo, cartas,
  fichas, avisos, hojas ni umbrales de gestos: se importan de acá. Para sumar un
  juego nuevo: motor puro + controlador en `js/games/<juego>/`.
- **Persistencia:** `blackjack.prefs.v1` (tema, sonido, gestos, `botLevel`,
  `botBluff`, `botTalk`, `bigBlind`, `buyIn`, `game`) y `blackjack.progress.v1`
  (saldo, apuesta, último saldo diario). El saldo es compartido entre los dos
  juegos; `game` vale `'blackjack' | 'poker' | ''`. `savePrefs()` de
  `js/core/prefs.js` mezcla el parche con lo guardado: no volver a escribirlo con
  un objeto fijo o se pierden el nivel, los faroles, la charla, las ciegas y la
  entrada al cambiar de juego.
- `state.hands` **no se persiste**: al recargar se vuelve a la fase de apuesta.
- La mesa de póker sí se persiste en `poker.table.v1`; si recargás en medio de
  una mano, se reanuda. El neto se aplica al saldo recién al terminar (`applied`).
- `index.html` redirige a `poker.html` si `game === 'poker'`; el póker guarda
  `game = 'blackjack'` antes de volver para no hacer ping-pong.
- Clases de resultado: las cajas por mano (`.hand.is-win/.is-lose/.is-push`)
  aplican **solo** dentro de `.player-hands.is-multi` (split). En mano única el
  resultado se marca con el badge del puntaje (`.score.is-win/.is-lose`) y el
  texto de estado. No volver a poner fondo/borde al `.hand` suelto.
- Constantes de gestos en `js/core/gestures.js` (`GESTURE_EDGE` 28,
  `TAP_MAX_MS` 500, `DOUBLE_TAP_MS` 450, `DOUBLE_TAP_DIST` 40, `SWIPE_MAX_MS`
  900) e `isDoubleTap()`; el blackjack suma las suyas en su controlador: All in
  90 px (aviso 45 px, arrastre hasta 2500 ms), limpiar 52 px, juego 64/80 px en
  0,9 s.
- Gestos del póker en `js/games/poker/controller.js`: borde 28 px, doble toque
  450 ms/40 px, derecha 52 px para igualar/pasar, izquierda 90 px para retirarse
  (aviso a los 45 px) en 0,9 s. Después de retirarse, el doble toque o `#skipBtn`
  llaman a `skipToEnd()`, que cancela `state.botTimer` y corre a los bots hasta
  `settled` con una guarda de 500 acciones. La preferencia `gestures` es
  compartida con el blackjack.
- **La pantalla de juego no panea en ningún juego:** `.app` usa
  `touch-action: none` en `css/styles.css` y `.poker__table` lo repite. Los desliz
  verticales no mueven ni hacen rebotar la página, tampoco sobre las fichas. Las
  hojas de Ajustes, la de agregar fichas y el selector viven fuera de `.app`, así
  que conservan su scroll. El scroll por código sigue andando (`scrollIntoView`
  del panel de subida y del banner de resultado); `closeRaise()` y
  `startNewHand()` vuelven a `scrollY = 0`. No mover el bloqueo a `html`/`body`:
  rompería las hojas.
- **Fichas beta:** están en los dos juegos, en Ajustes. La hoja vive en
  `createAddFundsSheet` (`js/core/chips.js`); el controlador aporta el saldo base
  y qué pasa al confirmar. El póker usa `available()`, así no cuenta lo
  comprometido en la mano. Al confirmar se llama `saveProgress()` y `render()`.
- Póker: ciegas estándar `$5/$10`, `$50/$100`, `$500/$1.000`, `$5.000/$10.000`,
  `$50.000/$100.000`, `$500.000/$1.000.000`, `$5.000.000/$10.000.000` y
  `$50.000.000/$100.000.000` (`BIG_BLINDS`, ciega chica = grande / 2), más una
  **ciega personalizada** par desde `MIN_BIG_BLIND = 10` con techo
  `maxBigBlind(saldo)` = saldo / `MAX_BLIND_DIVISOR` (10). `blindOptions` muestra
  las `BLIND_OPTIONS` (4) parejas más grandes que entran, más la actual si es
  estándar; `customBigBlind(value, saldo)` ajusta la escrita a mano. Entrada
  elegible por mano (`buyIn`, default `DEFAULT_BUY_IN = 300`, mínimo 10 ciegas
  grandes, techo = saldo). **No hay tope de mesa.** Bots con Monte Carlo
  (`sims: 140`) y demoras de 620–1140 ms. El saldo disponible durante una mano es
  `balance - (startStack - stack del jugador)`. `startNewHand` usa
  `clampBuyIn(state.buyIn, state.balance, state.bigBlind)` y
  `createTable({ stack, sb: bb / 2, bb })`.
- **Hoja Mesa (`#tableSheet`):** se abre con `#tableBtn` y se elige ciegas y
  entrada con fichas (`CHIP_TIERS`), **Máximo** y **Limpiar**. `openTableSheet`
  no cambia nada si hay una mano activa. `renderBlindGrid` arma la grilla según
  el saldo y usa etiquetas cortas (`blindLabel`: `$50k/$100k`, `$50M/$100M`)
  para que entren en 320 px; `renderTableSheet` calcula el mínimo con
  `MIN_BUY_IN_BLINDS` y escribe `#blindHint` (ciega chica y grande activas) y
  `#tableMinHint` (“Mínimo … (10 ciegas grandes) · máximo tu saldo”), así que no
  volver a dejarlos como texto fijo en el HTML.
  `chooseBlind`/`setBlind` sugieren `suggestedBuyIn`; **“Otra ciega…”**
  (`#customBlindBtn`, panel `#customBlindPanel`) permite escribir la grande:
  `readCustomBlind`/`renderCustomBlind` validan mínimo, techo y par, y
  `applyCustomBlind` guarda el borrador. `confirmTable` guarda `bigBlind` y
  `buyIn` con `savePrefs()`. La entrada se aplica desde la próxima mano.
- Montos de subida: `raiseOptions`, `clampRaiseTarget` y `stepRaiseTarget` en
  `js/games/poker/engine.js` son la única fuente de verdad. El panel usa presets
  (mínima, ½ pozo, pozo, all in) y pasos de una ciega chica; reutilizar esas
  funciones si se agregan gestos de subida. El all-in siempre pide confirmación.
- **Bots (`js/games/poker/engine.js`):** `BOT_PROFILES` tiene `tight` (Ana),
  `balanced` (Beto) y `aggro` (Caro); el controlador los reparte con
  `BOT_PROFILES[(index - 1) % 3]`. `BOT_LEVELS` (`facil`/`normal`/`dificil`,
  etiquetas Fácil/Normal/Difícil) ajusta agresión, farol, tightness y `mistake`;
  `BOT_LEVEL_ALIASES` migra `suave → facil` y `duro → dificil` al leer prefs.
  `BOT_BLUFF_LEVELS` (`sin` 0, `pocos` 0,5×, `normal` 1×, `muchos` 1,6×) es el
  control de faroles; la opción `sin` se muestra como **“Nunca”** y apaga farol
  y semi-farol. `resolveTraits(profile,
  level, bluff)` mezcla las tres cosas y es lo único que leen las decisiones;
  deja `bluffFactor` para escalar los tiros preflop.
  `botAction(table, index, { profile, level, bluff, rng, sims })` decide con
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
  `BOT_TALK_BLUFF_CHANCE = 0.45` cuando el intent es `bluff`/`semiBluff`,
  `BOT_TALK_MS = 3800`). La frase se muestra en `.seat__talk`, un globo de 11 px
  a dos líneas como overlay del asiento (no mueve la mesa); el texto accesible
  sigue en `.seat__state`. Nunca tapa “Se retiró” ni “All in”: solo habla el
  asiento sin etiqueta. Se limpia al terminar la mano o repartir. En el showdown
  no se muestra ninguna etiqueta de farol.
- **Ajustes del póker:** el orden es Nivel de los bots → Charla (switch, con
  `.pref--gap`) → Faroles. La charla va antes a propósito: apagarla solo silencia
  comentarios, mientras que “Nunca” apaga el farol en el juego. No son el mismo
  eje, no fusionar los controles.

## Seeds deterministas para E2E

Se inyecta un `Math.random` con mulberry-ish en `addInitScript`:

| Seed | Resultado |
| --- | --- |
| `3` | derrota en mano única |
| `244` | victoria en mano única y sirve para 4 manos |
| `18` | par de 8 (split) |
| `122` | par de ases |

## Verificación antes de dar algo por terminado

1. `node --check` de `js/games/blackjack/controller.js`,
   `js/games/poker/controller.js`, los dos `engine.js` y `sw.js`.
2. `npm test` → 75/75 (28 de blackjack + 47 de póker).
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
   apagada nadie hable, y el layout en 320×568. Probar la mesa de v2.6
   (`probe-v26-smoke.cjs`): hoja Mesa, ciegas habilitadas por saldo, entrada con
   fichas, Máximo/Limpiar, entrada de $100.000 sin tope, persistencia al cambiar
   de juego, faroles Sin/Pocos/Normal/Muchos y layout en 320×568. Probar la
   escalera adaptable y la ciega personalizada (`probe-v210-blinds.cjs`): con
   saldo de $1.000.000 y $1.000.000.000, techo saldo/10, mínimo $10, par
   automático, avisos de máximo y mínimo, guardado, recarga, cancelar, jugar una
   mano con la ciega propia y layout en 320×568.
5. Si se tocó interacción, probar gestos con touch real simulado (CDP
   `Input.dispatchTouchEvent`), no solo con clicks.
6. Commit + push y confirmar que `HEAD` y `origin/main` coinciden.
