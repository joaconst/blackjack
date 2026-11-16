# Mesa — notas para agentes

Memoria de trabajo del proyecto. Se carga automáticamente en cada sesión.
Mantené este archivo corto y actualizado: si cambia el estado, la versión o una
regla, editá acá en el mismo commit.

## Qué es

Blackjack, póker (Texas Hold'em) y dos tragamonedas 6×5, **Táctica** y
**Pulso**, mobile y en español. Sin frameworks ni build: HTML, CSS y JS puro con
ES modules. PWA instalable y offline.

- Repo: <https://github.com/joaconst/blackjack.git>, rama `main`, al día con
  `origin`.
- Versión actual: `v3.0` (`APP_VERSION` en
  `js/games/blackjack/controller.js`, `js/games/poker/controller.js` y
  `js/games/slots/controller.js`, `CACHE` en `sw.js`).
- El detalle de cada versión está en `CHANGELOG.md`; lo que falta, en `TODO.md`.

## Comandos

```bash
npm test                       # 111 tests unitarios de los motores (node --test)
npm start                      # npx serve . (el service worker necesita localhost o HTTPS)
node --check js/games/blackjack/controller.js   # chequeo de sintaxis antes de commitear
node --check js/games/poker/controller.js
node --check js/games/slots/controller.js
node --check js/games/blackjack/engine.js
node --check js/games/poker/engine.js
node --check js/sound.js
node --check sw.js
Get-ChildItem js\games\slots\core,js\games\slots\games -Filter *.js |
  ForEach-Object { node --check $_.FullName }
```

Servidor de pruebas usado en sesiones anteriores: `http://localhost:4173/`.
Las pruebas E2E con Playwright viven en `C:\Users\const\AppData\Local\Temp\opencode\bj-test\`
(`run8.cjs` regresión de blackjack, `run-poker.cjs` póker y selector,
`probe-raise2.cjs` panel de subida, `probe-poker-gestures.cjs` gestos y salto al
final, `probe-bj-noscroll.cjs` bloqueo vertical y hojas del blackjack,
`probe-beta-poker.cjs` fichas beta del póker y textos, `probe-bot-levels.cjs`
niveles, faroles y charla de los bots, `probe-v26-smoke.cjs` hoja Mesa, ciegas,
entrada sin tope y 320×568, `probe-v29-mesa.cjs` pistas de ciegas y entrada,
`probe-v210-blinds.cjs` escalera adaptable y ciega personalizada,
`probe-v3-slots.cjs` Táctica y Pulso de punta a punta (selector, giro, ajustes,
apuesta libre, doble toque, bono, badge y capturas), `probe-v3-smoke.cjs`
navegación entre los cuatro juegos y redirección de `slots.html`,
`shot-v3-dark.cjs` capturas del tema oscuro, `measure-head.cjs` medidas de la
cabecera, `shot-win.cjs` / `shot-themes.cjs` capturas, `visual.cjs` capturas,
`probe-touch*.cjs` gestos).
Son temporales: si se limpian, hay que rehacerlas.
Playwright usa `channel: 'msedge'`, viewport 390×844 y 320×568, `isMobile` y
`hasTouch`. Ojo: `serve` reescribe las URLs sin `.html` (`/tactica`, `/pulso`,
`/poker`), así que los `waitForURL` van con regex (`/\/tactica(\.html)?$/`), no
con `'**/tactica.html'`. `browser.newContext()` no acepta `channel`: va en
`chromium.launch()`.

## Reglas del proyecto

- **No tocar `js/sound.js` ni los volúmenes** salvo pedido explícito.
- Interfaz en **español rioplatense** (vos, podés, tocá).
- **Mobile-first**; los botones son la vía principal y los gestos un atajo.
- Mantener el estilo del código y los nombres existentes; sin dependencias nuevas.
- **Cada cambio en archivos que sirve la PWA** (HTML, CSS, JS, manifest, icons)
  sube la versión en cuatro lugares a la vez: `APP_VERSION` en
  `js/games/blackjack/controller.js`, `APP_VERSION` en
  `js/games/poker/controller.js`, `APP_VERSION` en
  `js/games/slots/controller.js` y `CACHE` en `sw.js` (`blackjack-vX.Y`). Si no,
  la PWA instalada sigue mostrando la versión vieja. Los `.md` no requieren bump.
- La versión se muestra **solo en Ajustes** (`#appVersion`, pie de la hoja).
- Commits en español, Conventional Commits: `fix:`, `feat:`, `docs:`.
  Después de commitear, `git push origin main` y confirmar árbol limpio.

## Arquitectura

```
index.html            blackjack, selector de los cuatro juegos y hojas
poker.html            mesa de póker y hoja de ajustes
tactica.html          tragamonedas Táctica, ajustes y hoja de "otro monto"
pulso.html            tragamonedas Pulso (mismo markup, data-slot-game)
slots.html            redirección a tactica.html o pulso.html
css/tokens.css        variables de color, tipografía y medidas
css/styles.css        layout, mesa, controles, hojas, animaciones
css/cards.css         skin de cartas y fichas
css/chooser.css       selector de juego
css/poker.css         mesa, asientos y acciones de póker
css/slots.css         gabinete 6×5, celdas, cascada, tabla de pagos
css/slots-themes.css  paletas clara/oscura y color por símbolo de cada máquina
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
js/games/slots/controller.js       grilla, cascada, bono, apuesta y gestos
js/games/slots/core/config.js      validación de la config y pesos derivados
js/games/slots/core/grid.js        grilla 6×5, gravedad, relleno y especiales
js/games/slots/core/evaluate.js    grupos de 8+, scatter y multiplicadores
js/games/slots/core/tumble.js      cascadas y acumulación de premios
js/games/slots/core/spin.js        tirada completa, bono y multiplicador
js/games/slots/core/metrics.js     simulador de RTP y métricas
js/games/slots/games/tactica.js    reglas y pagos de Táctica
js/games/slots/games/pulso.js      reglas y pagos de Pulso
js/games/slots/games/*.art.js      SVG de cada símbolo y marca de la máquina
tools/slot-rtp.mjs    calibración de RTP por simulación (node tools/slot-rtp.mjs)
sw.js                 cache offline (subir CACHE en cada deploy)
tests/engine.test.js  28 tests del blackjack
tests/poker.test.js   47 tests del póker
tests/slots.test.js   36 tests de las tragamonedas 6×5
```

- **Capa común (`js/core/`):** todo lo que no es regla de un juego. Los
  controladores no vuelven a definir almacenamiento, prefs, saldo, cartas,
  fichas, avisos, hojas ni umbrales de gestos: se importan de acá. Para sumar un
  juego nuevo: motor puro + controlador en `js/games/<juego>/`.
- **Persistencia:** `blackjack.prefs.v1` (tema, sonido, gestos, `botLevel`,
  `botBluff`, `botTalk`, `bigBlind`, `buyIn`, `tacticaBet`, `pulsoBet`,
  `seenSlotHint`, `game`) y `blackjack.progress.v1` (saldo, apuesta, último saldo
  diario). El saldo es compartido entre los juegos; `game` vale
  `'blackjack' | 'poker' | 'tactica' | 'pulso' | ''`, y `'slots'` migra a
  `'tactica'` en `normalizePrefs`. La apuesta de cada máquina se guarda en su
  clave (`tacticaBet`, `pulsoBet`); `slotsBet` de v2.12 se lee como respaldo.
  `savePrefs()` de `js/core/prefs.js` mezcla el parche con lo guardado: no volver
  a escribirlo con un objeto fijo o se pierden el nivel, los faroles, la charla,
  las ciegas, la entrada y las apuestas de las máquinas al cambiar de juego.
- `state.hands` **no se persiste**: al recargar se vuelve a la fase de apuesta.
- La mesa de póker sí se persiste en `poker.table.v1`; si recargás en medio de
  una mano, se reanuda. El neto se aplica al saldo recién al terminar (`applied`).
- El bono de cada máquina se persiste aparte en `slots.bonus.v1.<juego>`
  (`SLOT_BONUS_PREFIX` en `js/core/storage.js`) y se retoma solo a los 700 ms del
  arranque.
- `index.html` redirige a `poker.html` si `game === 'poker'`, a `tactica.html` si
  es `'tactica'` o el viejo `'slots'`, y a `pulso.html` si es `'pulso'`. El póker
  y las máquinas guardan `game = ''` antes de volver al selector: el póker para no
  hacer ping-pong y cada máquina para que se pueda elegir otro juego. La
  tragamonedas **no llama a `savePrefs()` en `pagehide`** (solo guarda el saldo y,
  si la partida lo tocó, el bono): si lo hiciera, reescribiría `game` al salir y
  el selector rebotaría a la máquina.
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
  compartida con el blackjack y las dos máquinas.
- **Tragamonedas 6×5 (`js/games/slots/`):** un motor y dos máquinas. El core
  (`core/config.js`, `grid.js`, `evaluate.js`, `tumble.js`, `spin.js`,
  `metrics.js`) no sabe de temas ni de nombres: todo lo particular (símbolos,
  pesos, pagos, scatter, multiplicadores y textos) vive en `games/tactica.js` y
  `games/pulso.js`, que pasan por `prepareGame()`. El arte está en
  `games/*.art.js`.
- **Reglas comunes:** grilla `grid[col][row]` de 6×5 (30 celdas), pago por **8 o
  más iguales en cualquier posición** (sin líneas), una combinación por símbolo
  y se suman todas. `pays` tiene tres escalones: 8-9, 10-11 y 12+ (`payTier` /
  `payFor`), siempre sobre la **apuesta total**. `findWins` excluye los
  especiales; `runTumble` cobra, borra, aplica gravedad por columna y rellena, y
  acumula todas las cascadas. `tumble.maxCascades = 60` es una guarda, no una
  regla de juego.
- **Especiales clavados:** `createGrid`/`adoptGrid` marcan `locked`, y el scatter
  y el multiplicador nunca se borran ni se mueven. `gravityAndRefill` compacta
  por tramos entre especiales, conservando el orden de caída de cada columna;
  `segments` es el que corta los tramos. Si se agrega un especial, sumarlo a
  `specialIds` (lo hace `prepareGame`) y revisar `segments`.
- **Scatter (objetivo / portal):** 4, 5 o 6+ pagan 3×, 5× y 100× la apuesta,
  aparte del premio de cascadas y nunca multiplicado. 4+ abre el bono. Dentro
  del bono, 3+ suman 5 giros (`retriggerAdd`) y no vuelven a pagar.
- **Táctica:** `multipliers.base = 'sum'`: las medallas visibles se suman al
  cerrar las cascadas y multiplican la tirada si hubo premio. En el bono
  (`bonus: 'accumulate'`) el `totalMultiplier` se mantiene entre tiradas, solo
  se aplica si hubo premio **y** cayó una medalla nueva, y se reinicia al
  empezar el bono. 15 giros gratis.
- **Pulso:** `base: 'none'` y `bonus: 'spin'`: las cargas solo existen en los
  giros gratis, se suman y multiplican únicamente el premio de esa tirada; cada
  giro arranca de cero. 10 giros gratis.
- **Una sola fuente de verdad:** pesos y pagos son los de `games/*.js`; de ahí
  salen el RTP, la frecuencia de premio y el peso del bono. El objetivo es 96% y
  se calibra por **simulación** (`tools/slot-rtp.mjs` o `simulate()` de
  `core/metrics.js`, 200k tiradas en el test), no por enumeración. No tocar pesos
  ni pagos sin volver a correr `npm test` y la calibración.
- **Resolución antes de animar:** `resolveSpin()` devuelve la tirada completa
  (cascadas, scatter, multiplicador, bono y saldo) antes de mover la grilla. El
  controlador aplica `state.balance += result.net` al instante y usa
  `state.displayBalance` para no adelantar el premio: si recargás en medio del
  giro, la plata ya está contada.
- **Bono:** `normalizeBonus()` valida y recorta (`MAX_BONUS_SPINS = 200`) y el
  controlador tiene su propia guarda de 400 giros. Corre solo, usa la apuesta que
  lo disparó, se guarda en `slots.bonus.v1.<juego>` antes de animar y se retoma
  a los 700 ms del arranque. Al terminar deja el resultado “Bono: $X”.
- **Apuesta y velocidad:** `SLOT_MIN_BET = 5` y cualquier entero desde ahí; la
  apuesta se guarda en `tacticaBet` / `pulsoBet`. Las fichas rápidas salen de
  `BET_TIERS` ($5, $10, $25, $100 y $500) y aparecen según el saldo. `SPEEDS`
  tiene tres niveles (Lenta 1,35×, Normal 1×, Rápida 0,6×) y los tiempos base
  están en `T`. El auto es x10/x50/x100 (`state.auto`).
- **Tema y estilos:** `body[data-slot-game="tactica|pulso"]` elige la paleta de
  `css/slots-themes.css` y el color de cada símbolo (`--sym-*`); `css/slots.css`
  solo tiene la estructura. Para reestilar una máquina alcanza con tocar su
  bloque; para cambiar un ícono, su `*.art.js`.
- **Gestos:** los umbrales vienen de `js/core/gestures.js` (borde 28 px,
  `TAP_MAX_MS` 500, `isDoubleTap`). Doble toque quieto **gira**; doble toque
  girando activa `state.turbo`, que multiplica los tiempos restantes por **0,38**
  (mínimo 60 ms) sin saltear el resultado; se apaga al terminar el giro. La
  preferencia `gestures` es la misma de los otros dos juegos y el aviso de ayuda
  usa `seenSlotHint`, separado de `seenGestureHint`.
- **Aviso y badges:** el aviso (`.toast`) se apoya sobre la barra de título de la
  máquina (`TOAST_LIFT = 32` medido desde el borde superior del gabinete), no
  sobre la grilla, el resultado ni **Girar**. El badge de multiplicador vive en
  `.slot-cabinet__head`; `.slot-cabinet__titles { margin-right: auto }` empuja
  los badges a la derecha. En 320×568 la celda queda en ~26 px y la grilla mide
  ~172 px: sin scroll ni desborde.
- **La pantalla de juego no panea en ningún juego:** `.app` usa
  `touch-action: none` en `css/styles.css` y `.poker__table` lo repite. Los desliz
  verticales no mueven ni hacen rebotar la página, tampoco sobre las fichas. Las
  hojas de Ajustes, la de agregar fichas y el selector viven fuera de `.app`, así
  que conservan su scroll. El scroll por código sigue andando (`scrollIntoView`
  del panel de subida y del banner de resultado); `closeRaise()` y
  `startNewHand()` vuelven a `scrollY = 0`. No mover el bloqueo a `html`/`body`:
  rompería las hojas.
- **Fichas beta:** están en los cuatro juegos, en Ajustes. La hoja vive en
  `createAddFundsSheet` (`js/core/chips.js`); el controlador aporta el saldo base
  y qué pasa al confirmar. El póker usa `available()`, así no cuenta lo
  comprometido en la mano. Al confirmar se llama a `saveProgress()` y `render()`.
  `makeChip(value, { verb })` cambia la etiqueta accesible: en las máquinas las
  fichas dicen “Apostar” y en la hoja “Usar”.
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

La tragamonedas usa el mismo `Math.random` inyectado. El resultado se calcula
antes de animar, pero el relleno de la grilla consume semilla, así que no vale
predecir un premio por semilla. Para capturar un giro ganador, girar hasta que
salga (lo hace `probe-v3-slots.cjs`) o forzar el escenario desde el motor en Node
con `resolveSpin(config, { grid, multValues })`. Para sembrar un bono, escribir
`slots.bonus.v1.<juego>` en `localStorage` desde `addInitScript` antes de cargar
la página, sin recargar después.

## Verificación antes de dar algo por terminado

1. `node --check` de los tres controladores (`blackjack`, `poker`, `slots`), los
   dos `engine.js` (blackjack y póker), `js/sound.js`, `sw.js` y todos los
   módulos de `js/games/slots/core/` y `js/games/slots/games/`.
2. `npm test` → 111/111 (28 de blackjack + 47 de póker + 36 de tragamonedas).
3. Playwright blackjack: victoria (244) y derrota (3) en mano única sin caja;
   split (18) conserva cajas redondeadas; capturas en 390×844 y 320×568; sin
   errores de consola. Comprobar que un swipe vertical sobre las fichas, el
   encabezado o los botones no cambia `scrollY`, que los gestos de pedir y
   plantarse siguen andando y que la hoja de Ajustes scrollea.
4. Playwright póker (`run-poker.cjs`): selector, persistencia, reanudación,
   bloqueo de cambio en mano, liquidación del saldo, regreso al selector y sin
   desborde en 320×568. Probar aparte el panel de subida (`probe-raise2.cjs`):
   presets, −/+, cancelar, all-in confirmado y botón de confirmar visible en
   320×568. Probar los gestos (`probe-poker-gestures.cjs`): doble toque, swipe
   derecha/izquierda, interruptor apagado, botón Ver el final, recarga después de
   retirarse y salto al ganador en 390×844 y 320×568. Comprobar además que un
   swipe vertical sobre la mesa y sobre los controles no cambia `scrollY`, que la
   hoja de Ajustes sí scrollea y que el gesto horizontal sigue funcionando
   después. Probar las fichas beta del póker: sumar, deshacer, limpiar,
   confirmar con el saldo actualizado y persistido, y que no queden textos de
   “fichas virtuales” en ninguna de las páginas. Probar los bots
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
5. Playwright tragamonedas (`probe-v3-slots.cjs`): selector con las **cuatro
   tarjetas**, grilla de 30 celdas, giro con saldo sin spoiler, ajustes con las 7
   reglas, la tabla de pagos, el RTP y la versión, apuesta libre de $37, doble
   toque, bono retomado y terminado, badge de medallas y layout en 390×844 y
   320×568 sin desborde ni scroll vertical. Sumar `probe-v3-smoke.cjs`
   (blackjack ↔ póker ↔ Táctica ↔ Pulso sin rebotes, `slots.html` redirige y la
   versión del blackjack) y `shot-v3-dark.cjs` (capturas del tema oscuro).
   Revisar las capturas: el aviso no debe tapar la barra de título, el resultado
   ni **Girar**, las celdas ganadoras quedan marcadas en dorado y las dos
   máquinas conservan su paleta.
6. Si se tocó interacción, probar gestos con touch real simulado (CDP
   `Input.dispatchTouchEvent`), no solo con clicks.
7. Commit + push y confirmar que `HEAD` y `origin/main` coinciden.
