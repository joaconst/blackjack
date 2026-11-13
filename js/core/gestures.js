// Umbrales y helpers de gestos compartidos.

export const GESTURE_EDGE = 28;
export const TAP_MAX_MS = 500;
export const DOUBLE_TAP_MS = 450;
export const DOUBLE_TAP_DIST = 40;
export const SWIPE_MAX_MS = 900;

/** ¿El toque actual completa un doble toque? */
export function isDoubleTap(last, now, x, y) {
  return last.t > 0 && now - last.t < DOUBLE_TAP_MS && Math.hypot(x - last.x, y - last.y) < DOUBLE_TAP_DIST;
}
