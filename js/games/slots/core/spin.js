// Resolución de una tirada: grilla, cascadas, scatter, multiplicadores y bono.
// Devuelve todo resuelto antes de animar, para que recargar no cambie nada.

import { adoptGrid, createGrid, cloneGrid } from './grid.js';
import { multipliersTotal, scatterPrize, scatterState } from './evaluate.js';
import { runTumble } from './tumble.js';

/** Tope de seguridad del bono; no es una regla de juego. */
export const MAX_BONUS_SPINS = 200;

/**
 * Estado del bono listo para usar. Descarta lo que no sirve y recorta topes.
 * `null` cuando no hay giros pendientes.
 */
export function normalizeBonus(config, raw, { bet = 0 } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.gameId && raw.gameId !== config.id) return null;
  const remaining = Math.max(0, Math.min(MAX_BONUS_SPINS, Math.floor(raw.remaining || 0)));
  if (!remaining) return null;
  return {
    gameId: config.id,
    active: true,
    remaining,
    totalMultiplier: Math.max(0, Number(raw.totalMultiplier) || 0),
    bet: Math.max(1, Math.floor(Number(raw.bet) || bet || 0)),
  };
}

/** Multiplicador que corresponde a esta tirada según las reglas del juego. */
export function resolveMultiplier(config, { inBonus, baseWin, orbSum, totalMultiplier }) {
  const rules = config.multipliers;
  const result = { value: 1, applied: false, totalMultiplier };

  if (!rules || orbSum <= 0 || baseWin <= 0) {
    return { ...result, totalMultiplier };
  }

  if (!inBonus) {
    if (rules.base === 'sum') {
      result.value = orbSum;
      result.applied = true;
    }
    return result;
  }

  if (rules.bonus === 'spin') {
    result.value = orbSum;
    result.applied = true;
    return result;
  }

  if (rules.bonus === 'accumulate') {
    // Solo acumula si hubo premio y cayó al menos un multiplicador nuevo.
    const next = totalMultiplier + orbSum;
    result.value = next;
    result.applied = true;
    result.totalMultiplier = next;
  }
  return result;
}

/**
 * Resuelve una tirada completa.
 *
 * - `bonus` es el estado devuelto por la tirada anterior (o el disparo).
 * - `capture` guarda las grillas de cada cascada para animar; en simulación se apaga.
 */
export function resolveSpin(
  config,
  { bet = 10, rng = Math.random, bonus = null, capture = true, grid = null, multValues = null } = {},
) {
  const inBonus = Boolean(bonus && bonus.remaining > 0);
  const allowMultiplier = Boolean(config.multipliers) &&
    (config.multipliers.base !== 'none' || inBonus);

  const start = grid
    ? adoptGrid(config, grid, { rng, values: multValues })
    : createGrid(config, rng, { allowMultiplier });
  const initialGrid = capture ? cloneGrid(start.grid) : null;
  const { multipliers, locked } = start;

  const tumble = runTumble({
    config,
    grid: start.grid,
    locked,
    multipliers,
    rng,
    bet,
    allowMultiplier,
    capture,
  });

  const scatter = scatterState(config, tumble.grid);
  const scatterPay = inBonus ? 0 : scatterPrize(config, scatter.count) * bet;
  const orbSum = multipliersTotal(multipliers);

  const multiplier = resolveMultiplier(config, {
    inBonus,
    baseWin: tumble.total,
    orbSum,
    totalMultiplier: bonus ? bonus.totalMultiplier || 0 : 0,
  });

  const cascadeWin = multiplier.applied ? tumble.total * multiplier.value : tumble.total;
  const totalWin = cascadeWin + scatterPay;

  let remaining = inBonus ? bonus.remaining - 1 : 0;
  let added = 0;
  if (inBonus && scatter.count >= config.scatter.retriggerMin) {
    remaining += config.scatter.retriggerAdd;
    added = config.scatter.retriggerAdd;
  }

  let triggered = false;
  if (!inBonus && scatter.count >= config.scatter.trigger) {
    triggered = true;
    remaining = config.scatter.freeSpins;
  }

  remaining = Math.max(0, Math.min(MAX_BONUS_SPINS, remaining));
  const nextBonus = remaining
    ? {
        gameId: config.id,
        active: true,
        remaining,
        // Un bono nuevo arranca el acumulado en cero.
        totalMultiplier: triggered ? 0 : multiplier.totalMultiplier,
        bet: inBonus ? bonus.bet : bet,
      }
    : null;

  const cost = inBonus ? 0 : bet;

  return {
    gameId: config.id,
    bet,
    inBonus,
    initialGrid,
    finalGrid: capture ? cloneGrid(tumble.grid) : null,
    steps: tumble.steps,
    cascades: tumble.cascades,
    guardHit: tumble.guardHit,
    baseWin: tumble.total,
    orbs: multipliers.map(({ col, row, value, at }) => ({ col, row, value, at })),
    multiplier,
    scatter: { count: scatter.count, cells: scatter.cells, pay: scatterPay },
    totalWin,
    cost,
    net: totalWin - cost,
    freeSpins: { triggered, added, remaining },
    nextBonus,
  };
}

/** Juega la ronda de giros gratis completa y devuelve el total. */
export function playBonus(config, bonus, rng, { bet = bonus.bet, capture = false } = {}) {
  const spins = [];
  let state = normalizeBonus(config, bonus, { bet });
  let total = 0;

  while (state && spins.length < MAX_BONUS_SPINS) {
    const spin = resolveSpin(config, { bet: state.bet, rng, bonus: state, capture });
    total += spin.totalWin;
    spins.push(spin);
    state = spin.nextBonus;
  }

  return { spins, total, remaining: state ? state.remaining : 0 };
}
