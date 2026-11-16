// Grilla 6×5: sorteo ponderado, gravedad con especiales bloqueados y relleno.
// `grid[col][row]`, con `null` en las celdas que se están cayendo.

import { pickMultiplier, pickSymbol } from './config.js';

export function emptyGrid(cols, rows) {
  return Array.from({ length: cols }, () => Array(rows).fill(null));
}

export function cloneGrid(grid) {
  return grid.map((column) => column.slice());
}

export function cloneLocked(locked) {
  return locked.map((column) => column.slice());
}

/**
 * Llena una grilla completa. Los especiales quedan bloqueados en su celda y
 * los multiplicadores guardan su valor al caer.
 */
export function createGrid(config, rng, { allowMultiplier = true, spawnedAt = 0 } = {}) {
  const grid = emptyGrid(config.reels, config.rows);
  const locked = emptyGrid(config.reels, config.rows).map((column) => column.map(() => false));
  const multipliers = [];

  for (let col = 0; col < config.reels; col += 1) {
    for (let row = 0; row < config.rows; row += 1) {
      const id = pickSymbol(config, rng, allowMultiplier);
      grid[col][row] = id;
      if (config.specialIds.has(id)) {
        locked[col][row] = true;
        if (config.multipliers && id === config.multipliers.id) {
          multipliers.push({ col, row, value: pickMultiplier(config, rng), at: spawnedAt });
        }
      }
    }
  }

  return { grid, locked, multipliers };
}

export function countSymbols(grid) {
  const counts = new Map();
  for (const column of grid) {
    for (const id of column) {
      if (!id) continue;
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  }
  return counts;
}

/** Celdas (col, row) de un símbolo, en orden de lectura. */
export function cellsOf(grid, id) {
  const cells = [];
  for (let col = 0; col < grid.length; col += 1) {
    for (let row = 0; row < grid[col].length; row += 1) {
      if (grid[col][row] === id) cells.push([col, row]);
    }
  }
  return cells;
}

export function removeCells(grid, cells) {
  for (const [col, row] of cells) grid[col][row] = null;
}

/**
 * Un tramo es el conjunto de filas seguidas que no tienen un especial.
 * Los especiales no se mueven: la gravedad ocurre dentro de cada tramo.
 */
function segments(rows, lockedColumn) {
  const list = [];
  let top = 0;
  for (let row = 0; row <= rows; row += 1) {
    if (row === rows || lockedColumn[row]) {
      if (row > top) list.push([top, row - 1]);
      top = row + 1;
    }
  }
  return list;
}

/**
 * Compacta cada tramo hacia abajo y rellena los huecos desde arriba del tramo.
 * Los símbolos nuevos pueden ser especiales: si toca, quedan bloqueados.
 */
export function gravityAndRefill(
  config,
  grid,
  locked,
  multipliers,
  rng,
  { allowMultiplier = true, spawnedAt = 0 } = {},
) {
  for (let col = 0; col < config.reels; col += 1) {
    for (const [top, bottom] of segments(config.rows, locked[col])) {
      const kept = [];
      for (let row = bottom; row >= top; row -= 1) {
        const id = grid[col][row];
        if (id) kept.push(id);
      }

      const size = bottom - top + 1;
      for (let index = 0; index < size; index += 1) {
        const row = bottom - index;
        if (index < kept.length) {
          grid[col][row] = kept[index];
          continue;
        }

        const id = pickSymbol(config, rng, allowMultiplier);
        grid[col][row] = id;
        if (config.specialIds.has(id)) {
          locked[col][row] = true;
          if (config.multipliers && id === config.multipliers.id) {
            multipliers.push({ col, row, value: pickMultiplier(config, rng), at: spawnedAt });
          }
        }
      }
    }
  }
}

/** Celdas del scatter, sin contar dos veces la misma posición. */
export function scatterCells(config, grid) {
  return cellsOf(grid, config.scatter.id);
}

/**
 * Adopta una grilla ya armada (tests o reanudación): marca los especiales
 * como bloqueados y reconstruye la lista de multiplicadores.
 */
export function adoptGrid(config, grid, { rng = Math.random, values = null } = {}) {
  if (grid.length !== config.reels) throw new Error('la grilla no tiene las columnas esperadas');
  const locked = emptyGrid(config.reels, config.rows);
  const multipliers = [];

  for (let col = 0; col < config.reels; col += 1) {
    if (grid[col].length !== config.rows) throw new Error('la grilla no tiene las filas esperadas');
    for (let row = 0; row < config.rows; row += 1) {
      const id = grid[col][row];
      if (!id) continue;
      if (config.specialIds.has(id)) {
        locked[col][row] = true;
        if (config.multipliers && id === config.multipliers.id) {
          const forced = values ? values[`${col},${row}`] : null;
          multipliers.push({
            col,
            row,
            value: forced || pickMultiplier(config, rng),
            at: 0,
          });
        }
      }
    }
  }

  return { grid: grid.map((column) => column.slice()), locked, multipliers };
}
