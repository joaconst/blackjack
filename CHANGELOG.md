# Historial de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Las versiones visibles de la app son `vX.Y` y coinciden con `APP_VERSION` en
`js/app.js`; el cache del service worker usa `blackjack-vX.Y`.

## [v2.10] — 2026-11-13

### Agregado
- **Ciegas a medida:** la hoja Mesa muestra las cuatro parejas estándar más
  grandes que entran en el saldo (hasta `$50.000.000/$100.000.000`) y suma
  **“Otra ciega…”** para escribir la ciega grande a mano. La chica es siempre la
  mitad exacta: la grande se ajusta al par de abajo. El máximo es **saldo ÷ 10**
  (para poder entrar con 10 ciegas grandes) y se avisa el techo en vez de
  recortar en silencio.
- Las etiquetas de la grilla se acortan (`$50k/$100k`, `$50M/$100M`) para que
  entren en 320 px; la pista y los avisos siguen mostrando el monto completo.

### Cambiado
- `normalizeBigBlind` acepta cualquier ciega par desde `$10`, no solo la lista
  fija, así la ciega personalizada persiste al recargar.
- Si la grilla queda impar, la última pareja ocupa la fila completa.
- `APP_VERSION = 'v2.10'`, `CACHE = 'blackjack-v2.10'`.

## [v2.9] — 2026-11-13

### Corregido
- **Hoja Mesa más clara:** la pista de las ciegas ahora muestra la ciega activa
  (“Ciega chica $5 · grande $10”) y el rango de la entrada se lee como tal:
  “Mínimo $100 (10 ciegas grandes) · máximo tu saldo”. Antes el texto quedaba
  pegado a los botones de ciega y parecía que el 100 y el millón eran las ciegas.
  Los montos y las reglas no cambian.

### Cambiado
- `APP_VERSION = 'v2.9'`, `CACHE = 'blackjack-v2.9'`.

## [v2.8] — 2026-11-13

### Cambiado
- **Ajustes de los bots más claros:** la charla en la mesa pasa arriba de los
  faroles, como bloque propio, y “Sin” se llama ahora **“Nunca”**. La clave
  interna sigue siendo `sin`, así que las preferencias guardadas no cambian.
- `APP_VERSION = 'v2.8'`, `CACHE = 'blackjack-v2.8'`.

## [v2.7] — 2026-11-13

### Mejorado
- **Charla más visible en la mesa:** la frase de los bots aparece en un globo
  de 11 px sobre el asiento, con hasta dos líneas, y dura **3,8 s** (antes
  1,9 s). El globo es un overlay: no mueve la mesa y sigue sin tapar “Se
  retiró”, “All in” ni el resultado. La frecuencia de charla y de faroles no
  cambia.

### Cambiado
- `APP_VERSION = 'v2.7'`, `CACHE = 'blackjack-v2.7'`.

## [v2.6] — 2026-11-13

### Agregado
- **Ciegas elegibles en el póker:** `$5/$10`, `$50/$100`, `$500/$1.000` y
  `$5.000/$10.000`. La elección se guarda y las ciegas que no alcanza el saldo
  quedan deshabilitadas.
- **Hoja Mesa** en el panel de inicio: se eligen las ciegas y la **entrada** con
  fichas, **Máximo** y **Limpiar**, entre manos. La entrada mínima son 10 ciegas
  grandes; al cambiar de ciegas se sugiere 100 ciegas grandes.
- **Entrada sin tope:** se puede entrar con todo el saldo (por ejemplo $100.000).
  Se quitó el cap fijo de $300 por mano.
- **Control de faroles** en Ajustes: **Sin**, **Pocos**, **Normal** y **Muchos**.
  “Sin” apaga faroles y semi-faroles; el resto escala la frecuencia.

### Cambiado
- **Niveles de los bots:** pasan a llamarse **Fácil**, **Normal** y **Difícil**,
  sin cambiar su fuerza. Las claves viejas `suave` y `duro` migran solas.
- Los bots farolean **un poco más** y, cuando farolean, hablan más seguido
  (~45% contra el 22% normal), así la mentira se nota sin carteles.
- Las subidas se redondean a la **ciega chica de la mesa**, también con ciegas
  altas.
- Los faroles preflop ahora también respetan el control de frecuencia.
- `APP_VERSION = 'v2.6'`, `CACHE = 'blackjack-v2.6'`.

### Corregido
- La mesa de póker arranca con las ciegas y la entrada elegidas, y la entrada
  guardada se recorta al saldo disponible al repartir.

## [v2.5] — 2026-11-12

### Agregado
- **Nivel de los bots** en Ajustes del póker: **Suave**, **Normal** y **Duro**. La
  elección se guarda y sobrevive a recargas y al cambio de juego.
- **Charla en la mesa:** los bots comentan la mano en su asiento. A veces la frase
  coincide con lo que hacen y a veces mienten, para que no se les lea la mano. Se
  puede apagar en Ajustes.

### Mejorado
- Los bots piensan la mano completa: rango preflop por posición, textura del
  board, proyectos y outs, valor, semi-farol y farol. Ana juega tight, Beto
  equilibrado y Caro agresiva.
- Los bots registran quién subió y cuántas veces, así pueden insistir con el
  farol o frenar cuando la mano se calienta. Ya no miran las cartas de los rivales.
- Las subidas se dimensionan por bote y se redondean a la ciega chica para que los
  montos queden prolijos.

### Corregido
- `bestHand` acepta 5, 6 o 7 cartas: antes el cálculo de proyectos en el flop
  rompía la mano.
- Al cambiar de juego, los ajustes del póker (nivel y charla) ya no se pierden:
  cada guardado conserva las claves que no toca.

### Cambiado
- `APP_VERSION = 'v2.5'`, `CACHE = 'blackjack-v2.5'`.

## [v2.4] — 2026-11-12

### Agregado
- **Modo beta en el póker:** el mismo botón para agregar fichas que ya estaba en
  el blackjack, en **Ajustes → Modo beta**, con pila de denominaciones, Deshacer,
  Limpiar y confirmación con el total en vivo. El saldo se guarda compartido y la
  hoja muestra el saldo disponible mientras hay una mano en curso.

### Corregido
- En el blackjack, deslizar hacia arriba o abajo ya no mueve la página, tampoco
  sobre las fichas ni los botones. Los gestos de juego (pedir, plantarse, limpiar
  y all in) siguen funcionando.

### Cambiado
- `.app` usa `touch-action: none` en `styles.css`, así que la pantalla de juego
  no panea en ninguno de los dos juegos. Las hojas y el selector conservan su
  scroll por quedar fuera de `.app`.
- Se quitaron todas las menciones a “fichas virtuales” de la interfaz, el
  manifest, el README y `package.json`.
- `APP_VERSION = 'v2.4'`, `CACHE = 'blackjack-v2.4'`.

## [v2.3] — 2026-11-12

### Corregido
- En el póker, deslizar hacia arriba o abajo ya no mueve la página: la pantalla
  de juego no se arrastra ni rebota. Los gestos verticales quedan muertos y solo
  responden los horizontales y el doble toque.
- La hoja de Ajustes conserva su scroll propio y el panel de subida se sigue
  acomodando solo en 320×568. Al cerrar el panel o repartir, la vista vuelve
  arriba.

### Cambiado
- `APP_VERSION = 'v2.3'`, `CACHE = 'blackjack-v2.3'`.
- `.app` del póker usa `touch-action: none`; `.poker__table` deja de permitir el
  paneo vertical.

## [v2.2] — 2026-11-12

### Agregado
- **Gestos de póker** sobre la mesa: deslizar a la **derecha** iguala o pasa; a la
  **izquierda** (90 px) te retira, con aviso a los 45 px; **doble toque** abre la
  subida.
- Después de retirarte, **doble toque** en la mesa salta al final de la mano y
  muestra al ganador. También queda el botón **Ver el final**.
- Interruptor de **Gestos** en Ajustes del póker, compartido con el blackjack.

### Cambiado
- `APP_VERSION = 'v2.2'`, `CACHE = 'blackjack-v2.2'`.
- La mesa usa `touch-action: pan-y` para que los gestos horizontales no rompan el
  scroll vertical.

## [v2.1] — 2026-11-12

### Mejorado
- Panel de subida del póker más claro: muestra el total, cuánto igualás,
  cuánto subís, la subida mínima y la máxima.
- Presets con etiqueta y monto (**Mínima**, **½ pozo**, **Pozo**, **All in**),
  redondeados a la ficha mínima y sin montos repetidos.
- Ajuste fino con **−$5 / +$5**, con repetición acelerada al mantener presionado,
  para elegir cualquier monto legal sin teclado.
- **Cancelar** cierra el panel sin ejecutar la subida.
- El **all-in** pide una confirmación extra y se muestra en rojo.
- En pantallas de 320×568 el panel se desplaza solo para que el botón de
  confirmar quede a la vista.

### Cambiado
- `APP_VERSION = 'v2.1'`, `CACHE = 'blackjack-v2.1'`.
- 5 tests nuevos de montos de subida; `npm test` suma 57.

## [v2.0] — 2026-11-11

### Agregado
- **Póker Texas Hold'em** contra 3 bots en `poker.html`, con ciegas $5/$10,
  subidas por presets, all-in, botes laterales y showdown con la mejor mano de
  cinco cartas.
- **Selector de juego** al primer arranque: Blackjack o Póker. La elección se
  guarda y se puede cambiar desde **Ajustes → Juego**; también bloquea el cambio
  en medio de una mano.
- **Saldo compartido** entre los dos juegos, con el mismo bono diario.
- La mesa de póker se guarda y se reanuda si recargás en medio de una mano; el
  saldo recién se ajusta al terminar.
- La app pasa a llamarse **Mesa** en el manifest, con atajos a cada juego.

### Cambiado
- `APP_VERSION = 'v2.0'`, `CACHE = 'blackjack-v2.0'`.
- 24 tests nuevos del motor de póker (`tests/poker.test.js`); `npm test` suma 52.

## [v1.1] — 2026-11-11

### Corregido
- La mano única ya no muestra una caja verde/roja alrededor de “VOS” y las
  cartas al terminar la mano. El resultado queda solo en el badge del puntaje
  (verde al ganar, rojo al perder) y en el texto de estado.
- Las cajas de resultado por mano se conservan únicamente en split, donde
  ayudan a distinguir cada mano.

### Cambiado
- `APP_VERSION = 'v1.1'`, `CACHE = 'blackjack-v1.1'`.

Commit: `3d469e3`.

## [v1.0] — 2026-11-11

### Cambiado
- La versión instalada se muestra solo en **Ajustes**, al final de la hoja
  (“Blackjack · fichas virtuales · versión v1.0”), y ya no en el pie de la
  pantalla principal.
- Se eliminó el CSS sin uso de `.app-version`; el layout de 320×568 vuelve a
  entrar sin scroll extra.

Commit: `7587666`.

## Sin versión visible

### 2026-11-11 — `bc7c025`
- All in y doble toque más tolerantes: All in desde cualquier parte de la mesa
  (umbral 90 px, aviso desde 45 px, sin límite de tiempo) y doble toque con
  ventana de 450 ms y toques de hasta 500 ms.
- Reset robusto ante un `pointerup` perdido.
- Chequeo de actualización del service worker al volver a la app.
- Primera etiqueta de versión visible en el pie (luego movida a Ajustes).

### 2026-11-11 — `510e09a`
- Split completo: hasta 4 manos, ases con una sola carta y 21 post-split 1:1.
- Limpiar la apuesta y la mesa desde cualquier parte de la mesa.
- Doble toque para repartir y restauración de la última apuesta.

### 2026-11-11 — `6b682fa`
- Gestos opcionales (apagar en Ajustes), preferencias separadas del progreso y
  zoom bloqueado.

### 2026-11-11 — `502fcb1`
- Base mobile v2: fichas virtuales, sonidos sintetizados, saldo diario, tema y
  PWA offline.
