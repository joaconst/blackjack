# Pendientes e ideas

Lista corta de cosas para retomar entre sesiones. No es un roadmap cerrado.
Marcar con `[x]` al terminar y borrar lo descartado.

## Verificación pendiente

- [ ] Probar la actualización real de la PWA en un iPhone: instalar v2.0, subir
      a v2.1 y confirmar que Ajustes muestra la versión nueva tras cerrar y
      abrir la app.
- [ ] Revisar el contraste del badge `.score.is-win` / `.is-lose`, de las cajas
      de split y de la mesa de póker en **tema oscuro** (las capturas actuales
      son en claro).
- [ ] Repasar el resultado por mano en split con 3 y 4 manos en 320×568.
- [ ] Probar una mano de póker completa en un teléfono real: turnos de los bots,
      subida, all-in y reanudación al recargar.

## Ideas

- [ ] Mover los scripts de Playwright (`run8.cjs`, `run-poker.cjs`,
      `visual.cjs`, `probe-touch*.cjs`) al repo en `tests/e2e/` para no depender
      de la carpeta temporal, con un `npm run test:e2e` opcional.
- [ ] Evaluar una segunda variante de póker (por ejemplo, torneos cortos) o más
      perfiles de bots.
- [ ] Agregar gestos de póker reutilizando `raiseOptions`, `clampRaiseTarget` y
      `stepRaiseTarget` (por ejemplo, deslizar para subir o bajar el monto).
- [ ] Tests unitarios para las reglas de gestos (umbrales y dirección), hoy solo
      cubiertas por E2E.
- [ ] Revisar accesibilidad: foco visible en botones de la mesa y etiquetas
      `aria-live` para el estado de la mano.
- [ ] Evaluar recordar la última apuesta también al recargar (hoy se pierde la
      mesa, `state.hands` no se persiste a propósito).

## Descartado

- Persistir `state.hands`: complica la reanudación y no aporta al juego diario.
- Mostrar la versión en el pie de la pantalla principal: se movió a Ajustes.
