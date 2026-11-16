// Simulador de RTP y métricas. Se usa en tools/slot-rtp.mjs y en los tests.

import { resolveSpin } from './spin.js';

/** RNG determinista (mulberry32) para tests y simulaciones reproducibles. */
export function makeRng(seed = 1) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Corre `spins` tiradas base (con sus bonos completos) y devuelve las métricas.
 * El RTP se mide sobre lo apostado en las tiradas base: los giros gratis no cuestan.
 */
export function simulate(config, { spins = 100000, rng = makeRng(1), bet = 100 } = {}) {
  let wagered = 0;
  let won = 0;
  let bonusWon = 0;
  let played = 0;
  let bonusSpins = 0;
  let bonusRounds = 0;
  let hitSpins = 0;
  let cascadeTotal = 0;
  let maxWinX = 0;
  let guardHits = 0;

  for (let index = 0; index < spins; index += 1) {
    wagered += bet;
    const spin = resolveSpin(config, { bet, rng, capture: false });
    won += spin.totalWin;
    played += 1;
    cascadeTotal += spin.cascades;
    if (spin.totalWin > 0) hitSpins += 1;
    if (spin.guardHit) guardHits += 1;
    maxWinX = Math.max(maxWinX, spin.totalWin / bet);

    let bonus = spin.nextBonus;
    if (spin.freeSpins.triggered) {
      bonusRounds += 1;
      let guard = 0;
      while (bonus && guard < 500) {
        const free = resolveSpin(config, {
          bet: bonus.bet,
          rng,
          bonus,
          capture: false,
        });
        guard += 1;
        played += 1;
        bonusSpins += 1;
        won += free.totalWin;
        bonusWon += free.totalWin;
        cascadeTotal += free.cascades;
        if (free.totalWin > 0) hitSpins += 1;
        if (free.guardHit) guardHits += 1;
        maxWinX = Math.max(maxWinX, free.totalWin / bonus.bet);
        bonus = free.nextBonus;
      }
    }
  }

  return {
    spins,
    played,
    wagered,
    won,
    rtp: wagered ? won / wagered : 0,
    hitRate: played ? hitSpins / played : 0,
    avgCascades: played ? cascadeTotal / played : 0,
    bonusRounds,
    bonusSpins,
    bonusFrequency: spins ? bonusRounds / spins : 0,
    bonusShare: won ? bonusWon / won : 0,
    maxWinX,
    guardHits,
  };
}

/** Texto corto para la consola del simulador. */
export function formatReport(config, report) {
  const percent = (value) => `${(value * 100).toFixed(2)}%`;
  return [
    `${config.label}:`,
    `  RTP            ${percent(report.rtp)}`,
    `  Premio         ${percent(report.hitRate)} de las tiradas`,
    `  Cascadas       ${report.avgCascades.toFixed(2)} por tirada`,
    `  Bono           1 cada ${report.bonusFrequency ? Math.round(1 / report.bonusFrequency) : '∞'} tiradas (${report.bonusSpins} giros)`,
    `  Peso del bono  ${percent(report.bonusShare)} del premio`,
    `  Premio máximo  ${report.maxWinX.toFixed(0)}×`,
    report.guardHits ? `  Avisos         ${report.guardHits} topes de cascada` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
