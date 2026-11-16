// Cascadas: evaluar, cobrar, borrar, caer y rellenar hasta que no queden grupos.

import { cloneGrid, gravityAndRefill, removeCells } from './grid.js';
import { findWins, winsTotal } from './evaluate.js';

/**
 * Corre la secuencia completa de cascadas sobre una grilla.
 * Devuelve los pasos (para animar), el total y la grilla final.
 * `multipliers` se muta: los especiales que caen durante el relleno se suman.
 */
export function runTumble({
  config,
  grid,
  locked,
  multipliers,
  rng,
  bet = 1,
  allowMultiplier = true,
  capture = true,
}) {
  const steps = [];
  let total = 0;
  let guardHit = false;
  let step = 0;

  for (;;) {
    const wins = findWins(config, grid);
    if (!wins.length) break;
    if (step >= config.tumble.maxCascades) {
      guardHit = true;
      break;
    }

    const pay = winsTotal(wins) * bet;
    total += pay;

    const before = capture ? cloneGrid(grid) : null;
    removeCells(
      grid,
      wins.flatMap((win) => win.cells),
    );
    gravityAndRefill(config, grid, locked, multipliers, rng, {
      allowMultiplier,
      spawnedAt: step + 1,
    });

    steps.push({
      index: step,
      wins,
      pay,
      grid: before,
      after: capture ? cloneGrid(grid) : null,
    });
    step += 1;
  }

  return { grid, steps, total, cascades: steps.length, guardHit };
}
