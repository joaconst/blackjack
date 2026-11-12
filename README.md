# Blackjack

Blackjack mobile con fichas virtuales. Sin frameworks ni build: HTML, CSS y JS puro.
Se puede instalar como app en el celular (PWA) y funciona offline.

## Cómo jugar

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
teclado. Es temporal, para probar apuestas grandes, y lo agregado se guarda junto
con el saldo. Tiene Deshacer, Limpiar y confirmación con el total en vivo.

### Saldo diario

Una vez por día, si tu saldo queda por debajo de **$500**, se completa hasta $500.
Si tenés $500 o más, no se agrega nada. Si te quedás sin saldo después de usar
el bono del día, la pantalla de espera muestra cuánto falta para la medianoche.

El progreso (`saldo`, `apuesta`, bono diario y última apuesta) se guarda aparte de
las preferencias (`tema`, `sonido`, `gestos` y si ya viste la ayuda). Reiniciar el
progreso borra solo lo primero: el tema y los ajustes se mantienen. La clave vieja
`blackjack.state.v1` se migra automáticamente a `blackjack.progress.v1` y
`blackjack.prefs.v1`.

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

En **Ajustes**, al final, la app muestra la versión instalada (`versión v1.1`). Si
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

## Estructura

```
index.html
css/tokens.css     colores, tipografía y medidas globales
css/styles.css     layout, mesa, controles, hojas y animaciones
css/cards.css      aspecto de cartas y fichas (el "skin")
js/engine.js       reglas, cálculos y armado de la pila, sin DOM
js/sound.js        sonidos sintetizados con Web Audio
js/app.js          interfaz, estado, persistencia e instalación
manifest.webmanifest
sw.js              cache offline
icons/
tests/engine.test.js
```

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

## Notas

- Si cambiás archivos y ya probaste la PWA, subí la versión de `CACHE` en
  `sw.js` (por ejemplo `blackjack-v1.1` → `blackjack-v1.2`) y `APP_VERSION` en
  `js/app.js` para que se actualice el cache y la versión que se muestra en
  Ajustes.
- Reiniciar progreso está en **Ajustes → Progreso**. Pide confirmación y borra
  saldo, apuesta y mesa; conserva tema, sonido y gestos.
- El botón de tema arranca siguiendo al sistema; una vez que lo tocás, queda
  guardada tu elección.
- La apuesta se guarda en múltiplos de $5; **All in** permite saldos que no son
  múltiplos de la ficha mínima.
- El modo beta es temporal y está pensado para pruebas, no para la versión final.
- **Split:** dos cartas del mismo valor, hasta 4 manos. Los ases reciben una sola
  carta y se plantan solos; el 21 post-split paga 1:1 y se puede doblar después
  de dividir. El blackjack natural original conserva el pago 3:2.
