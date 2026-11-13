// Preferencias compartidas por los juegos.

import { PREFS_KEY, readStored, writeStored } from './storage.js';

const GAMES = ['blackjack', 'poker'];

/** Normaliza solo las claves comunes; las de cada juego pasan tal cual. */
export function normalizePrefs(source = {}) {
  return {
    theme: source.theme === 'light' || source.theme === 'dark' ? source.theme : 'auto',
    sound: typeof source.sound === 'boolean' ? source.sound : true,
    gestures: typeof source.gestures === 'boolean' ? source.gestures : true,
    seenGestureHint: source.seenGestureHint === true,
    game: GAMES.includes(source.game) ? source.game : '',
  };
}

/** Lee las prefs guardadas (o `source`, para migrar claves viejas). */
export function loadPrefs(source = null) {
  const stored = source || readStored(PREFS_KEY) || {};
  return { ...stored, ...normalizePrefs(stored) };
}

/** Guarda un parche sin pisar las claves que no toca. */
export function savePrefs(patch) {
  const current = readStored(PREFS_KEY) || {};
  return writeStored(PREFS_KEY, { ...current, ...patch });
}
