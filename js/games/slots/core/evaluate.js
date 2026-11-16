// Evaluación pay-anywhere: cuenta símbolos sin importar la posición.

import { payFor, payTier } from './config.js';
import { cellsOf } from './grid.js';

/**
 * Combinaciones de 8 o más iguales, una por símbolo.
 * Los especiales (scatter y multiplicador) no forman parte de los grupos.
 */
export function findWins(config, grid) {
  const counts = new Map();
  for (const column of grid) {
    for (const id of column) {
      if (!id || config.specialIds.has(id)) continue;
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  }

  const wins = [];
  for (const id of config.symbolIds) {
    const count = counts.get(id) || 0;
    if (count < config.minMatch) continue;
    wins.push({
      id,
      count,
      tier: payTier(config.pays[id], count),
      pay: payFor(config.pays[id], count),
      cells: cellsOf(grid, id),
    });
  }
  return wins;
}

export function winsTotal(wins) {
  return wins.reduce((sum, win) => sum + win.pay, 0);
}

/** Cantidad de scatter visibles y sus celdas. */
export function scatterState(config, grid) {
  const cells = cellsOf(grid, config.scatter.id);
  return { count: cells.length, cells };
}

/** Premio del scatter según la cantidad (4, 5 y 6 o más). */
export function scatterPrize(config, count) {
  if (count < config.scatter.trigger) return 0;
  return payFor(config.scatter.pays, count);
}

/** Suma de los multiplicadores que cayeron en esta tirada. */
export function multipliersTotal(list) {
  return list.reduce((sum, item) => sum + item.value, 0);
}
