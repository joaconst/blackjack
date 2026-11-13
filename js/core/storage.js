// Almacenamiento local compartido. Sin estado de juego.

export const PREFS_KEY = 'blackjack.prefs.v1';
export const PROGRESS_KEY = 'blackjack.progress.v1';
export const LEGACY_KEY = 'blackjack.state.v1';
export const TABLE_KEY = 'poker.table.v1';

export function readStored(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

export function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStored(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* sin almacenamiento */
  }
}
