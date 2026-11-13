// Saldo y progreso compartidos por los juegos.

import { PROGRESS_KEY, readStored, writeStored } from './storage.js';
import { DAILY_FLOOR, START_BALANCE, dailyTopUp, dayKey } from './money.js';

/** Completa el progreso guardado con defaults seguros. */
export function normalizeProgress(source = {}, { minBet = 0 } = {}) {
  const balance =
    Number.isFinite(source.balance) && source.balance >= 0
      ? Math.floor(source.balance)
      : START_BALANCE;
  const bet = Number.isFinite(source.bet) && source.bet >= 0 ? Math.floor(source.bet) : 0;
  const lastBet =
    Number.isFinite(source.lastBet) && source.lastBet >= 0
      ? Math.floor(source.lastBet)
      : bet >= minBet
        ? bet
        : 0;

  return {
    balance,
    bet,
    lastTopUp: typeof source.lastTopUp === 'string' ? source.lastTopUp : dayKey(),
    lastBet,
  };
}

export function loadProgress(source = null, options = {}) {
  const stored = source || readStored(PROGRESS_KEY) || {};
  return normalizeProgress(stored, options);
}

/** Guarda saldo y apuesta sin pisar las claves de otros juegos. */
export function saveProgress(progress) {
  const current = readStored(PROGRESS_KEY) || {};
  return writeStored(PROGRESS_KEY, { ...current, ...progress });
}

/** Aplica el piso diario y devuelve el resultado con la fecha usada. */
export function applyDailyTopUp(balance, lastTopUp) {
  const today = dayKey();
  const result = dailyTopUp({ balance, lastTopUp, today, floor: DAILY_FLOOR });
  return { ...result, today };
}
