# Mesa

Blackjack, póker y dos tragamonedas 6×5 mobile. Sin frameworks ni build: HTML,
CSS y JS puro. Se puede instalar como app en el celular (PWA) y funciona offline.

## Elegir juego

La primera vez la app pregunta si querés jugar al **Blackjack**, al **Póker**, a
**Táctica** o a **Pulso**. La elección queda guardada y se puede cambiar en
**Ajustes → Juego** (o desde la hoja de ajustes del póker y de las máquinas). Los
cuatro juegos comparten el mismo saldo y el mismo bono diario.

## Blackjack

- Empezás con **$1.000**.
- Apostás **solo tocando fichas**, sin teclado numérico. Apuesta mínima: $5 y
  máxima: todo el saldo (**All in**).
- Las fichas nuevas aparecen solas al llegar al saldo necesario:
  **100 → 250 → 500 → 1.000 → 2.500 → 5.000 → 10.000 → 25.000**.
  Si hay más de cuatro, la fila se desliza de costado.
- La apuesta se muestra en la mesa como una pila de fichas, con la denominación
  más grande posible. **Limpiar** borra la apuesta y, si quedó una mano anterior,
  también limpia la mesa.
- **Repetir** vuelve a poner la última apuesta jugada (si el saldo alcanza).
- **Pedir**, **Plantarse**, **Doblar** (solo con las dos cartas iniciales) y
  **Dividir** cuando tenés dos cartas del mismo valor.
- **Dividir** crea una mano nueva con la misma apuesta y se puede repetir hasta
  tener **4 manos**. Los ases divididos reciben una sola carta y se plantan solos.
  Un 21 después de dividir paga 1:1; el blackjack natural sigue pagando 3:2.
- La banca se planta en 17. Blackjack paga 3:2. Empate devuelve la apuesta.
- 6 mazos, se mezcla al 25% restante.
- Sin seguro ni rendición.

### Gestos

Los gestos son un atajo opcional; los botones siguen siendo la vía principal y
accesible. Se pueden apagar en **Ajustes → Gestos** y la elección queda guardada.

- **Apuesta:** doble toque en la mesa reparte (si no hay apuesta, restaura la
  última); deslizar hacia la **izquierda** hace **All in** y, si arrancás sobre la
  pila, la pila sigue al dedo; deslizar hacia **abajo** limpia la apuesta y la
  mesa desde **cualquier parte de la mesa**.
- **Jugando:** deslizar hacia **abajo** pide carta, hacia **arriba** se planta,
  hacia la **izquierda** dobla y hacia la **derecha** divide.
- El gesto tiene que empezar lejos del borde de la pantalla (unos 28 px) para no
  chocar con el gesto de atrás del teléfono. Para All in el umbral es de 90 px (el
  aviso aparece a los 45 px) y no hay límite de tiempo: podés arrastrar tranquilo.
  Limpiar son 52 px y los gestos de juego 64 px (80 px para doblar) en menos de
  0,9 s. El doble toque acepta hasta 450 ms entre toques y toques de hasta 500 ms.
- Mientras deslizás aparece el nombre de la acción sobre la mesa. Al soltar se
  ejecuta una sola vez.

La app bloquea el zoom por completo: doble toque y pellizco. Se refuerza con el
`viewport`, `touch-action` y un fallback para Safari viejo. Por eso el texto no se
agranda con pellizco; el tamaño base ya está pensado para mobile.

### Sonido

Los sonidos se sintetizan con Web Audio: no hay archivos de audio, así que
funcionan offline y no agregan peso. Suenan al tocar fichas, repartir cartas y al
terminar cada mano. El motor sube el volumen con un bus, un realce suave en
2–4 kHz y un compresor que hace de limitador para que no distorsione. El botón de
parlante los silencia y la elección queda guardada. En iPhone el audio se habilita
con el primer toque, como pide iOS.

### Modo beta

En **Ajustes → Modo beta** se pueden agregar fichas tocando denominaciones, sin
teclado, en los cuatro juegos. Es temporal, para probar apuestas grandes, y lo
agregado se guarda junto con el saldo. Tiene Deshacer, Limpiar y confirmación con
el total en vivo. En el póker la hoja muestra el saldo disponible, sin contar lo
comprometido en la mano.

## Póker

Texas Hold'em contra **3 bots** (Ana, Beto y Caro). Vos y los bots arrancan con
el mismo stack por mano: la entrada que elijas, **hasta tu saldo**, sin tope.

- Ciegas elegibles de **$5/$10**, **$50/$100**, **$500/$1.000** y
  **$5.000/$10.000**, según tu saldo. Una sola mano por vez y la mesa no cobra rake.
- Recibís dos cartas propias y hay cinco comunitarias: flop, turn y river.
- En cada ronda podés **retirarte**, **pasar/igualar**, **subir** o ir **all in**.
  El panel de subida muestra cuánto igualás y cuánto subís, con presets
  (mínima, ½ pozo, pozo y all in) y ajuste fino de **una ciega chica**. Mantené
  presionado para acelerar. El all in pide confirmación.
- Ganás con la mejor mano de cinco cartas o si todos los demás se retiran. Hay
  botes laterales cuando hay all-ins de distinto tamaño.
- Al terminar la mano, el neto (`stack final − stack inicial`) se suma o se resta
  al saldo compartido. Mientras jugás, el saldo muestra solo lo que no está
  comprometido en la mesa.
- La mesa se guarda: si recargás o volvés más tarde en medio de una mano, se
  reanuda donde estaba. El saldo no cambia hasta que la mano termina.
- No se puede cambiar de juego con una mano en curso.

### Mesa: ciegas y entrada

En el panel de inicio, tocá **Entrada / Ciegas** para abrir la hoja **Mesa** y
elegir entre manos:

- las **ciegas**, de `$5/$10` a `$5.000/$10.000`; las que no alcanza tu saldo
  quedan deshabilitadas;
- la **entrada**, con fichas de $10 a $100.000, **Máximo** para entrar con todo
  el saldo y **Limpiar** para empezar de nuevo. El mínimo son 10 ciegas grandes.

La elección se guarda y se aplica desde la próxima mano. Al cambiar de ciegas, la
entrada se acomoda a 100 ciegas grandes o a todo tu saldo si no alcanza. Si tu
saldo baja, al repartir se usa lo disponible. No hay tope de mesa: si tenés
$100.000 podés entrar con $100.000.

### Nivel de los bots

En **Ajustes → Nivel de los bots** elegís cómo juegan Ana, Beto y Caro. La
elección queda guardada y no se pierde al cambiar de juego.

- **Fácil:** ven más manos, pagan de más y farolean poco. Ideal para probar.
- **Normal:** mezclan valor y faroles, con decisiones más prolijas que antes.
- **Difícil:** rangos ajustados, más presión y faroles mejor elegidos.

Cada bot tiene su estilo: **Ana** juega tight, **Beto** equilibrado y **Caro**
agresiva. Piensan la mano completa: rango preflop por posición, textura del
board, proyectos y outs, y deciden cuándo apostar por valor, semi-farolear o
farolear. No miran tus cartas.

### Faroles

En **Ajustes → Faroles** controlás cuánto mienten los bots:

- **Sin:** no farolean ni semi-farolean; solo apuestan con mano hecha.
- **Pocos:** la frecuencia anterior, más discreta.
- **Normal:** faroles y semi-faroles repartidos. La mesa se anima.
- **Muchos:** farolean seguido y con más confianza.

Cuando un bot farolea tiene más probabilidad de comentar la mano, así que la
mentira se puede leer sin carteles ni etiquetas.

En la misma sección podés apagar la **charla en la mesa**. Cuando está activada,
los bots comentan la mano en su asiento: a veces dicen la verdad y a veces
mienten, así que no conviene fiarse.

### Gestos del póker

Los gestos son un atajo opcional; los botones siguen siendo la vía principal y
accesible. Se pueden apagar en **Ajustes → Gestos** y la elección se comparte con
los otros juegos.

- **Tu turno:** deslizá hacia la **derecha** para igualar o pasar; hacia la
  **izquierda** (90 px) para retirarte, con el aviso a los 45 px; **doble toque**
  para abrir el panel de subida.
- **Ya retirado:** **doble toque** en la mesa para saltar al final y ver al
  ganador. También está el botón **Ver el final**.
- Empezá el gesto lejos del borde (unos 28 px) para no chocar con el gesto de
  atrás del teléfono. Los gestos son horizontales para no competir con el scroll.
- **Arriba o abajo no hace nada:** la mesa no se desplaza ni rebota. La hoja de
  Ajustes sí scrollea, porque vive fuera del área de juego.
- El all in sigue en el panel de subida, con confirmación.

## Tragamonedas

Dos máquinas con el mismo motor y reglas propias: **Táctica** (verde oliva,
arena y acero) y **Pulso** (azul, cian y magenta). Las dos usan una grilla de
**6×5** y pagan **cualquier grupo de 8 o más símbolos iguales**, sin importar
dónde estén; no hay líneas.

### Reglas comunes

- Cada símbolo tiene su tabla con tres escalones: **8-9**, **10-11** y
  **12 o más**. El pago es un múltiplo de la **apuesta total** y se suman todos
  los grupos del giro.
- Los símbolos ganadores desaparecen y los de arriba caen: es una **cascada**.
  Si vuelve a haber 8 iguales, se paga otra vez y se sigue cayendo. Todas las
  cascadas se suman en el mismo giro.
- Los **especiales** (el scatter y las medallas o cargas) quedan clavados en su
  celda: no se mueven, no se borran y no se cuentan dos veces.
- El **scatter** (objetivo en Táctica, portal en Pulso) paga **3×, 5× o 100×**
  según caigan 4, 5 o 6 o más, aparte de las cascadas y sin multiplicador. Con 4
  o más arranca la ronda de giros gratis.
- Dentro del bono, 3 o más scatters suman **5 giros extra** y no vuelven a pagar.
- Los giros gratis usan la apuesta que los disparó y corren solos. Se guardan: si
  cerrás la app, al volver el bono sigue donde estaba.
- Las dos máquinas devuelven a largo plazo alrededor del **96%** de lo apostado.

### Táctica

- **15 giros gratis.** Las **medallas** van de 2× a 500×.
- En el juego base, las medallas visibles se suman al cerrar las cascadas y
  multiplican el premio de la tirada (solo si hubo premio).
- En el bono el acumulado se mantiene entre tiradas, pero solo se aplica cuando
  cae una medalla nueva y hubo premio. Arranca de cero al empezar el bono.
- Hay premio en cerca del **28%** de las tiradas base; el bono sale alrededor de
  una vez cada **130** tiradas.

### Pulso

- **10 giros gratis.** Las **cargas** van de 2× a 100×.
- En el juego base **no hay multiplicadores**: el premio es solo el de las
  cascadas y el portal.
- En los giros gratis, las cargas visibles se suman y multiplican únicamente el
  premio de esa tirada. Cada giro arranca de cero.
- Hay premio en cerca del **50%** de las tiradas base; el bono sale alrededor de
  una vez cada **130** tiradas.

### Apuesta, velocidad y gestos

- Apuesta mínima **$5**, sin máximo más que tu saldo, y **cualquier entero** desde
  ahí. Las fichas rápidas son $5, $10, $25, $100 y $500; **Otro monto** abre una
  hoja para escribir el monto que quieras y **queda guardado** por máquina.
- **Velocidad** en tres niveles: Lenta, Normal y Rápida.
- **Auto x10, x50 y x100:** repite la tirada esa cantidad de veces con la misma
  apuesta, con un botón para parar.
- El resultado se define antes de que caigan las celdas. El saldo se aplica al
  instante: durante la animación todavía no muestra el premio, que aparece al
  cerrar la cascada.
- Las celdas ganadoras se marcan en dorado y el marcador dice cuánto pagó la
  tirada y qué multiplicador se aplicó.
- **Doble toque con la máquina quieta:** gira. **Doble toque durante el giro:**
  acelera la cascada sin saltear el resultado. Los gestos se apagan en
  **Ajustes → Gestos** y la preferencia es la misma de los otros juegos.

### Saldo diario

Una vez por día, si tu saldo queda por debajo de **$500**, se completa hasta $500.
Si tenés $500 o más, no se agrega nada. Si te quedás sin saldo después de usar
el bono del día, la pantalla de espera muestra cuánto falta para la medianoche.

El progreso (saldo, apuesta, bono diario y última apuesta) se guarda aparte de
las preferencias (tema, sonido, gestos, juego elegido, apuestas de las máquinas,
nivel y charla de los bots y si ya viste la ayuda).
Reiniciar el progreso borra solo lo primero: el tema, el sonido y los ajustes se
mantienen. La clave vieja `blackjack.state.v1` se migra automáticamente
a `blackjack.progress.v1` y `blackjack.prefs.v1`.

## Correrlo local

```bash
npm start          # npx serve en http://localhost:3000
# o
python -m http.server 4173
```

Abrí `http://localhost:PUERTO`. El service worker necesita `localhost` o HTTPS:
si abrís `index.html` con doble clic, el juego funciona pero no se instala ni
funciona offline.

## Probarlo en el iPhone

Para instalarlo, la página tiene que estar publicada con HTTPS. La opción más
rápida es **Netlify Drop**:

1. Entrá a <https://app.netlify.com/drop>.
2. Arrastrá la carpeta `blackjack` completa.
3. Abrí la URL que te da Netlify en **Safari** desde el iPhone.
4. Tocá **Compartir → Agregar a pantalla de inicio → Agregar**.

También sirve GitHub Pages o Vercel. Al ser archivos estáticos, no hace falta
configurar nada más.

En Android/Chrome aparece el botón de instalar nativo. En iOS, la app detecta
Safari y muestra los pasos con el botón de instalación.

En **Ajustes**, al final, la app muestra la versión instalada (`versión v3.0`). Si
ves una versión vieja o no ves la etiqueta, cerrá y volvé a abrir la app para que
el service worker tome la actualización.

## Tests

```bash
npm test
```

Cubren puntajes, ases, bust, blackjack, reglas de la banca, pagos 3:2, empate,
split (mismo valor, hasta 4 manos, ases y 21 post-split), liquidación por mano,
doble, mazo, lógica del saldo diario y la pila de fichas (suma exacta, máximo de
7 fichas y denominaciones disponibles según el saldo).

Los tests de póker cubren el evaluador de 5, 6 o 7 cartas con desempates, ciegas y
turnos, subidas mínimas, montos y presets de subida, cierre de calles, retiro,
botes laterales, devolución de apuestas no igualadas, empates, equidad por Monte
Carlo y una simulación de 25 manos que verifica que las fichas se conserven.

Los bots tienen tests propios: textura del board, proyectos y outs, fuerza
preflop y posición, rasgos por perfil y nivel, migración de las claves viejas,
agresión con mano fuerte, farol head-up contra multiway, comparación entre nivel
Fácil y Difícil, control de faroles de Sin a Muchos (incluido que “Sin” nunca
devuelva farol), charla que puede mentir y una comprobación de que no leen las
cartas de los rivales. También se simula una mano completa en nivel Difícil y
otra con ciegas altas para verificar que las fichas cierren y que las subidas se
redondeen a la ciega chica. Hay tests de ciegas y entrada: sin tope de mesa, techo
en el saldo, mínimo de 10 ciegas grandes y entrada sugerida de 100.

Los tests de las tragamonedas cubren el motor 6×5: grupos de 8, 9, 10, 11 y 12 o
más en cualquier posición, evaluación de todos los símbolos, cascadas con
gravedad por columna, especiales clavados en su celda, scatter (pagos, disparo y
retrigger), reglas de multiplicador de cada máquina en base y bono, bono
persistido, determinismo y el RTP por simulación (200.000 tiradas por máquina,
las dos cerca del 96%).

Los gestos de la mesa y el salto al final se prueban aparte con Playwright y
toque real simulado, igual que el doble toque de las máquinas.

## Estructura

```
index.html             blackjack y selector de juego
poker.html             mesa de póker
tactica.html           tragamonedas Táctica y hojas
pulso.html             tragamonedas Pulso y hojas
slots.html             redirección a Táctica o Pulso
css/tokens.css         colores, tipografía y medidas globales
css/styles.css         layout, mesa, controles, hojas y animaciones
css/cards.css          aspecto de cartas y fichas (el "skin")
css/chooser.css        selector de juego
css/poker.css          mesa, asientos y acciones de póker
css/slots.css          gabinete 6×5, celdas, cascada y apuesta
css/slots-themes.css   paleta y colores de símbolos de cada máquina
js/core/storage.js     claves y lectura/escritura de localStorage
js/core/money.js       dinero, calendario, fichas y armado de la pila
js/core/cards.js       mazos, palos y etiquetas de cartas
js/core/prefs.js       preferencias compartidas (tema, sonido, gestos, juego)
js/core/wallet.js      saldo y bono diario
js/core/gestures.js    umbrales de toque y swipe
js/core/chips.js       fichas y hoja de agregar fichas
js/core/ui.js          tema, sonido, avisos, instalación y hojas
js/sound.js            sonidos sintetizados con Web Audio
js/games/blackjack/engine.js       reglas y cálculos del blackjack, sin DOM
js/games/blackjack/controller.js   interfaz del blackjack, estado y gestos
js/games/poker/engine.js           evaluador, apuestas, botes y bots, sin DOM
js/games/poker/controller.js       interfaz del póker, turnos y saldo compartido
js/games/slots/controller.js       interfaz de las máquinas, grilla y bono
js/games/slots/core/               motor 6×5 compartido (config, grid,
                                   evaluate, tumble, spin, metrics)
js/games/slots/games/              reglas, pagos y arte de Táctica y Pulso
tools/slot-rtp.mjs                 calibración del RTP por simulación
manifest.webmanifest
sw.js                  cache offline
icons/
tests/engine.test.js
tests/poker.test.js
tests/slots.test.js
```

Los cuatro juegos comparten `js/core/`: ahí vive todo lo que no es regla de un
juego (almacenamiento, saldo, preferencias, cartas, fichas, gestos e interfaz).
Para sumar un juego nuevo alcanza con un motor puro y un controlador en
`js/games/<juego>/` que importe esa capa.

Las tragamonedas son el ejemplo más modular: `core/` no toca el DOM ni conoce
nombres de símbolos. Todo lo de cada máquina —pesos, pagos, scatter,
multiplicadores, textos y arte— vive en `js/games/slots/games/`, así que se puede
cambiar una máquina sin tocar el motor. El RTP se mide simulando tiradas con
`tools/slot-rtp.mjs`.

## Cambiar el estilo de cartas y fichas

Todo el aspecto de cartas y fichas está en `css/cards.css`.

**Cartas.** El HTML se genera con atributos, nunca con estilos inline:

```html
<div class="card" data-suit="hearts" data-rank="A">
  <span class="card__corner card__corner--tl">...</span>
  <span class="card__center">♥</span>
  <span class="card__corner card__corner--br">...</span>
</div>
```

Para rediseñarlas alcanza con tocar las variables de `:root`:

| Variable | Qué controla |
| --- | --- |
| `--card-w`, `--card-h` | tamaño de la carta |
| `--card-radius` | redondeo |
| `--card-bg`, `--card-ink`, `--card-red` | colores del frontal |
| `--card-edge`, `--card-shadow` | borde y sombra |
| `--card-back`, `--card-back-deep` | dorso |
| `--card-back-line`, `--card-back-mark` | trama y símbolo del dorso |

El dorso es puro CSS (gradientes). Para reemplazarlo, cambiá el `background`
de `.card--back`.

**Fichas.** Cada ficha es un botón:

```html
<button class="chip chip--25" data-value="25"><span>25</span></button>
```

Los colores salen de `--chip-color` y `--chip-deep` en `.chip--5`, `.chip--10`,
`.chip--25`, `.chip--100`, `.chip--250`, `.chip--500`, `.chip--1000`,
`.chip--2500`, `.chip--5000`, `.chip--10000` y `.chip--25000`. El tamaño es
`--chip-size`. El aro, el borde segmentado y el centro se dibujan con `::before`
y `::after`.

La pila de la mesa se arma en `chipStack()` con `--chip-stack-size`,
`--chip-stack-step` y `--chip-stack-pad`; el sobrante se funde en la última ficha
(`.chip--combo`) para que el total siempre sea exacto.

**Tragamonedas.** Cada máquina se distingue por `<body data-slot-game="tactica">`
o `data-slot-game="pulso"`. En `css/slots-themes.css` está su paleta clara y
oscura (`--slot-accent`, `--slot-cabinet-a/b`, `--slot-cell-bg`, `--slot-head`…)
y el color de cada símbolo (`--sym-<id>`). En
`js/games/slots/games/<juego>.art.js` están los SVG de los símbolos y la marca de
la cabecera. Los nombres, pesos y pagos viven en
`js/games/slots/games/<juego>.js`; si los cambiás, volvé a correr `npm test` para
que el RTP siga cerca del 96%.

## Notas

- Si cambiás archivos y ya probaste la PWA, subí la versión de `CACHE` en
  `sw.js` (por ejemplo `blackjack-v3.0` → `blackjack-v3.1`) y `APP_VERSION` en
  `js/games/blackjack/controller.js`, `js/games/poker/controller.js` y
  `js/games/slots/controller.js` para que se actualice el cache y la versión que
  se muestra en Ajustes.
- Reiniciar progreso está en **Ajustes → Progreso**. Pide confirmación y borra
  saldo, apuesta, mesa de blackjack y mesa de póker; conserva tema, sonido y
  gestos.
- El saldo es uno solo para los cuatro juegos y el bono diario también. En póker,
  el saldo visible durante una mano descuenta lo comprometido en la mesa; el neto
  se aplica al terminar.
- El botón de tema arranca siguiendo al sistema; una vez que lo tocás, queda
  guardada tu elección.
- La apuesta del blackjack se guarda en múltiplos de $5; **All in** permite saldos
  que no son múltiplos de la ficha mínima. En las tragamonedas la apuesta es
  cualquier entero desde $5 y se guarda por separado en cada máquina.
- El modo beta es temporal y está pensado para pruebas, no para la versión final.
- **Split:** dos cartas del mismo valor, hasta 4 manos. Los ases reciben una sola
  carta y se plantan solos; el 21 post-split paga 1:1 y se puede doblar después
  de dividir. El blackjack natural original conserva el pago 3:2.
