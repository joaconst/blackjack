# Pendientes e ideas

Lista corta de cosas para retomar entre sesiones. No es un roadmap cerrado.
Marcar con `[x]` al terminar y borrar lo descartado.

## Verificación pendiente

- [ ] Probar la actualización real de la PWA en un iPhone: instalar v2.5, subir
      a v2.6 y confirmar que Ajustes muestra la versión nueva tras cerrar y
      abrir la app.
- [ ] Jugar unas manos con cada nivel de bots en un teléfono real y ajustar si
      Difícil queda demasiado difícil o Fácil demasiado fácil.
- [ ] Probar las ciegas altas ($50.000/$100.000 y $50.000.000/$100.000.000) y
      una entrada grande en un teléfono real: legibilidad, fichas y confirmación
      del all-in.
- [ ] Sentir en la mesa las frecuencias de faroles (Pocos, Normal, Muchos) y
      ajustar los multiplicadores si Muchos resulta demasiado o Pocos pasa
      desapercibido.
- [ ] Confirmar que la charla se lee bien en pantallas chicas y que el globo no
      tapa el estado del asiento en una mano larga con all-ins.
- [ ] Confirmar en un teléfono real que deslizar arriba/abajo en el póker no
      mueve ni rebota la pantalla (en emulación no hay barra de URL ni rebote de
      iOS).
- [ ] Revisar el contraste del badge `.score.is-win` / `.is-lose`, de las cajas
      de split y de la mesa de póker en **tema oscuro** (las capturas actuales
      son en claro).
- [ ] Repasar el resultado por mano en split con 3 y 4 manos en 320×568.
- [ ] Probar una mano de póker completa en un teléfono real: turnos de los bots,
      subida, all-in y reanudación al recargar.
- [ ] Sentir la tragamonedas en un teléfono real: que el giro no se sienta lento,
      que el doble toque para acelerar sea cómodo y que la apuesta escrita con el
      teclado numérico no tape la hoja.
- [ ] Revisar el contraste de la máquina en **tema oscuro** en un teléfono real
      (los símbolos usan tokens propios en `css/slots.css`).

## Ideas

- [ ] **Tragamonedas estilo Sweet Bonanza** como juego aparte (no reemplaza a la
      clásica): grilla de 6×5 con bloques que caen y se reemplazan (cascada),
      pagos por 8 o más símbolos iguales en cualquier posición, multiplicadores
      en las cascadas y una ronda de **tiradas gratis** con un símbolo scatter.
      Arrancar por el motor puro (`js/games/sweet/engine.js`) con `rng` inyectable
      y un test de RTP por simulación, como la clásica; recién después la interfaz.
      Ojo con el alto de la grilla en 320×568: 6 columnas no entran con los
      tamaños de celda actuales, así que la ventana tiene que escalar de verdad.
- [ ] Mover los scripts de Playwright (`run8.cjs`, `run-poker.cjs`,
      `visual.cjs`, `probe-touch*.cjs`, `probe-slots.cjs`,
      `probe-slots-edge.cjs`, `probe-smoke-games.cjs`) al repo en `tests/e2e/`
      para no depender de la carpeta temporal, con un `npm run test:e2e`
      opcional.
- [ ] Evaluar una segunda variante de póker (por ejemplo, torneos cortos).
- [ ] Evaluar perfiles de bots más marcados (por ejemplo, un maníaco que suba
      casi siempre) además de Ana tight, Beto equilibrado y Caro agresiva.
- [x] Bots con niveles Fácil/Normal/Difícil, lectura de board, proyectos, faroles
      y charla que puede mentir.
- [x] Ciegas elegibles, entrada por mano sin tope y hoja Mesa con fichas.
- [x] Escalera de ciegas adaptable al saldo y ciega personalizada (v2.10).
- [x] Control de faroles de Sin a Muchos y faroles más visibles en la charla.
- [x] Tragamonedas clásica 3×3 con 5 líneas fijas, apuesta libre y gestos (v2.12).
- [x] Agregar gestos de póker: retirarse, igualar/pasar, abrir la subida y ver el
      final después de retirarse.
- [ ] Evaluar gestos para ajustar el monto de subida dentro del panel, reutilizando
      `raiseOptions`, `clampRaiseTarget` y `stepRaiseTarget`.
- [ ] Tests unitarios para las reglas de gestos (umbrales y dirección), hoy solo
      cubiertas por E2E.
- [ ] Revisar accesibilidad: foco visible en botones de la mesa y etiquetas
      `aria-live` para el estado de la mano.
- [ ] Evaluar recordar la última apuesta también al recargar (hoy se pierde la
      mesa, `state.hands` no se persiste a propósito).

## Descartado

- Persistir `state.hands`: complica la reanudación y no aporta al juego diario.
- Mostrar la versión en el pie de la pantalla principal: se movió a Ajustes.
