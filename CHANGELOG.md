# Historial de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Las versiones visibles de la app son `vX.Y` y coinciden con `APP_VERSION` en
`js/app.js`; el cache del service worker usa `blackjack-vX.Y`.

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
