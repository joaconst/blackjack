import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  payFor,
  payTier,
  pickMultiplier,
  prepareGame,
} from '../js/games/slots/core/config.js';
import {
  adoptGrid,
  createGrid,
  emptyGrid,
  gravityAndRefill,
  removeCells,
} from '../js/games/slots/core/grid.js';
import {
  findWins,
  multipliersTotal,
  scatterPrize,
  scatterState,
  winsTotal,
} from '../js/games/slots/core/evaluate.js';
import { runTumble } from '../js/games/slots/core/tumble.js';
import {
  MAX_BONUS_SPINS,
  normalizeBonus,
  playBonus,
  resolveMultiplier,
  resolveSpin,
} from '../js/games/slots/core/spin.js';
import { makeRng, simulate } from '../js/games/slots/core/metrics.js';
import { TACTICA, TACTICA_GAME } from '../js/games/slots/games/tactica.js';
import { PULSO, PULSO_GAME } from '../js/games/slots/games/pulso.js';

const GAMES = [TACTICA_GAME, PULSO_GAME];

/** Grilla con celdas vacías; `spec` usa claves "col,row". */
function board(game, spec = {}) {
  const grid = emptyGrid(game.reels, game.rows);
  for (const [key, id] of Object.entries(spec)) {
    const [col, row] = key.split(',').map(Number);
    grid[col][row] = id;
  }
  return grid;
}

/** Celdas en bloques de 3 columnas para que dos símbolos no se pisen. */
function block(count, startCol = 0, startRow = 0) {
  const spec = {};
  const pairs = [];
  for (let index = 0; index < count; index += 1) {
    const col = startCol + (index % 3);
    const row = startRow + Math.floor(index / 3);
    spec[`${col},${row}`] = true;
    pairs.push([col, row]);
  }
  return { spec, pairs };
}

function spots(id, pairs) {
  return Object.fromEntries(pairs.map(([col, row]) => [`${col},${row}`, id]));
}

function blockOf(id, count, startCol = 0, startRow = 0) {
  return spots(id, block(count, startCol, startRow).pairs);
}

/** Copia con multiplicadores casi imposibles y una sola cascada. */
function quiet(game) {
  return prepareGame({
    ...game,
    weights: { ...game.weights, [game.multipliers.id]: 1e-9 },
    tumble: { maxCascades: 1 },
  });
}

/** Copia sin multiplicadores aleatorios pero con cascadas completas. */
function clean(game) {
  return prepareGame({
    ...game,
    weights: { ...game.weights, [game.multipliers.id]: 1e-9 },
  });
}

/* ---------- Configuración ---------- */

test('las dos máquinas son 6×5 y pagan desde 8 iguales', () => {
  for (const game of GAMES) {
    assert.equal(game.reels, 6);
    assert.equal(game.rows, 5);
    assert.equal(game.minMatch, 8);
    assert.equal(game.symbols.length, 9);
    assert.equal(game.rtpTarget, 0.96);
  }
});

test('prepareGame rechaza un símbolo sin peso', () => {
  assert.throws(
    () => prepareGame({ ...TACTICA, weights: { ...TACTICA.weights, gemaVerde: 0 } }),
    /peso/,
  );
});

test('prepareGame rechaza una tabla sin el escalón mínimo', () => {
  assert.throws(
    () =>
      prepareGame({
        ...TACTICA,
        pays: { ...TACTICA.pays, gemaVerde: { 10: 1, 12: 2 } },
      }),
    /escalón/,
  );
});

test('los escalones de pago son 8-9, 10-11 y 12 o más', () => {
  const table = TACTICA.pays.estrella;
  assert.equal(payFor(table, 8), table[8]);
  assert.equal(payFor(table, 9), table[8]);
  assert.equal(payFor(table, 10), table[10]);
  assert.equal(payFor(table, 11), table[10]);
  assert.equal(payFor(table, 12), table[12]);
  assert.equal(payFor(table, 25), table[12]);
  assert.equal(payFor(table, 7), 0);
  assert.equal(payTier(table, 7), null);
});

test('el valor del multiplicador respeta los pesos', () => {
  const game = TACTICA_GAME;
  const rng = makeRng(5);
  const tally = new Map();
  for (let index = 0; index < 400; index += 1) {
    const value = pickMultiplier(game, rng);
    assert.ok(game.multipliers.values.includes(value));
    tally.set(value, (tally.get(value) || 0) + 1);
  }
  assert.ok((tally.get(2) || 0) > (tally.get(20) || 0), 'los chicos salen más seguido');
});

/* ---------- Grilla ---------- */

test('createGrid arma 6×5 solo con símbolos conocidos', () => {
  const rng = makeRng(11);
  const { grid } = createGrid(TACTICA_GAME, rng);
  const known = new Set([
    ...TACTICA_GAME.symbols,
    TACTICA_GAME.scatter.id,
    TACTICA_GAME.multipliers.id,
  ]);
  assert.equal(grid.length, 6);
  for (const column of grid) {
    assert.equal(column.length, 5);
    for (const id of column) assert.ok(known.has(id), `símbolo ${id}`);
  }
});

test('los especiales caen bloqueados y las medallas guardan su valor', () => {
  const { grid, locked, multipliers } = createGrid(TACTICA_GAME, makeRng(3));
  const medals = [];
  for (let col = 0; col < 6; col += 1) {
    for (let row = 0; row < 5; row += 1) {
      const id = grid[col][row];
      if (TACTICA_GAME.specialIds.has(id)) assert.equal(locked[col][row], true);
      if (id === 'medalla') medals.push([col, row]);
    }
  }
  assert.deepEqual(multipliers.map(({ col, row }) => [col, row]), medals);
  for (const medal of multipliers) {
    assert.ok(TACTICA_GAME.multipliers.values.includes(medal.value));
  }
});

test('sin multiplicadores permitidos no aparecen cargas (Pulso base)', () => {
  const rng = makeRng(21);
  for (let index = 0; index < 200; index += 1) {
    const { grid } = createGrid(PULSO_GAME, rng, { allowMultiplier: false });
    for (const column of grid) assert.ok(!column.includes('carga'));
  }
});

/* ---------- Grupos de 8 ---------- */

test('ocho iguales pagan y siete no', () => {
  const eight = findWins(TACTICA_GAME, board(TACTICA_GAME, blockOf('gemaVerde', 8)));
  assert.equal(eight.length, 1);
  assert.equal(eight[0].count, 8);
  assert.equal(eight[0].pay, TACTICA.pays.gemaVerde[8]);

  const seven = findWins(TACTICA_GAME, board(TACTICA_GAME, blockOf('gemaVerde', 7)));
  assert.deepEqual(seven, []);
});

test('varios símbolos pagan en la misma tirada y se suman', () => {
  const grid = board(TACTICA_GAME, {
    ...blockOf('gemaArena', 9),
    ...blockOf('estrella', 10, 3, 0),
  });
  const wins = findWins(TACTICA_GAME, grid);
  assert.equal(wins.length, 2);
  assert.equal(winsTotal(wins), TACTICA.pays.gemaArena[8] + TACTICA.pays.estrella[10]);
});

test('los especiales no forman grupos aunque haya muchos', () => {
  const grid = board(TACTICA_GAME, {
    ...blockOf('objetivo', 8),
    ...blockOf('medalla', 8, 3, 0),
  });
  assert.deepEqual(findWins(TACTICA_GAME, grid), []);
});

/* ---------- Gravedad ---------- */

test('la gravedad respeta los especiales bloqueados', () => {
  const game = quiet(TACTICA_GAME);
  const grid = board(game, {
    '0,0': 'gemaVerde',
    '0,1': 'objetivo',
    '0,2': 'gemaArena',
    '0,4': 'gemaGris',
  });
  const { locked, multipliers } = adoptGrid(game, grid);
  removeCells(grid, [[0, 3]]);
  gravityAndRefill(game, grid, locked, multipliers, makeRng(8), { allowMultiplier: false });

  assert.equal(grid[0][1], 'objetivo', 'el scatter no se mueve');
  assert.equal(grid[0][4], 'gemaGris', 'lo de abajo queda abajo');
  assert.equal(grid[0][3], 'gemaArena', 'el común cae dentro del tramo');
  assert.equal(grid[0][0], 'gemaVerde');
  assert.ok(grid[0][2], 'el hueco de arriba se rellena');
});

test('la gravedad conserva el orden dentro de la columna', () => {
  const game = quiet(PULSO_GAME);
  const grid = board(game, {
    '2,0': 'pixelCian',
    '2,1': 'pixelLima',
    '2,2': 'pixelAmbar',
    '2,3': 'pixelMagenta',
    '2,4': 'pixelVioleta',
  });
  const { locked, multipliers } = adoptGrid(game, grid);
  removeCells(grid, [[2, 1]]);
  gravityAndRefill(game, grid, locked, multipliers, makeRng(4), { allowMultiplier: false });

  const column = grid[2];
  assert.equal(column[4], 'pixelVioleta');
  assert.equal(column[3], 'pixelMagenta');
  assert.equal(column[2], 'pixelAmbar');
  assert.equal(column[1], 'pixelCian');
  assert.ok(column[0], 'arriba se rellena');
});

/* ---------- Cascadas ---------- */

test('una cascada cobra, borra, rellena y puede volver a pagar', () => {
  const game = clean(TACTICA_GAME);
  const grid = board(game, blockOf('gemaVerde', 8));
  const { locked, multipliers } = adoptGrid(game, grid);
  const tumble = runTumble({
    config: game,
    grid,
    locked,
    multipliers,
    rng: makeRng(6),
    bet: 10,
    allowMultiplier: false,
  });

  assert.ok(tumble.cascades >= 1);
  assert.equal(tumble.steps[0].pay, TACTICA.pays.gemaVerde[8] * 10);
  assert.equal(tumble.total, tumble.steps.reduce((sum, step) => sum + step.pay, 0));
  assert.equal(tumble.guardHit, false);
  for (const column of tumble.grid) assert.equal(column.length, 5);
});

test('la guarda de cascadas corta un bucle imposible', () => {
  const game = prepareGame({
    ...clean(TACTICA_GAME),
    tumble: { maxCascades: 0 },
  });
  const grid = board(game, blockOf('gemaVerde', 8));
  const { locked, multipliers } = adoptGrid(game, grid);
  const tumble = runTumble({
    config: game,
    grid,
    locked,
    multipliers,
    rng: makeRng(2),
    bet: 10,
    allowMultiplier: false,
  });
  assert.equal(tumble.cascades, 0);
  assert.equal(tumble.total, 0);
  assert.equal(tumble.guardHit, true);
});

/* ---------- Scatter ---------- */

test('el scatter se cuenta una sola vez en toda la cascada', () => {
  const grid = board(TACTICA_GAME, {
    ...spots('objetivo', [[0, 4], [1, 4], [2, 4], [3, 4]]),
    ...blockOf('gemaVerde', 8),
  });
  const state = scatterState(TACTICA_GAME, grid);
  assert.equal(state.count, 4);
  assert.equal(state.cells.length, 4);
});

test('el scatter paga 3×, 5× y 100× desde 4', () => {
  assert.equal(scatterPrize(TACTICA_GAME, 3), 0);
  assert.equal(scatterPrize(TACTICA_GAME, 4), 3);
  assert.equal(scatterPrize(TACTICA_GAME, 5), 5);
  assert.equal(scatterPrize(TACTICA_GAME, 6), 100);
  assert.equal(scatterPrize(TACTICA_GAME, 9), 100);
});

test('sumar los multiplicadores de la tirada', () => {
  assert.equal(multipliersTotal([]), 0);
  assert.equal(multipliersTotal([{ value: 3 }, { value: 5 }, { value: 10 }]), 18);
});

/* ---------- Multiplicadores por juego ---------- */

test('Táctica base suma las medallas y multiplica la tirada', () => {
  const game = quiet(TACTICA_GAME);
  const spin = resolveSpin(game, {
    bet: 10,
    rng: makeRng(9),
    grid: board(game, { ...blockOf('gemaVerde', 8), '5,4': 'medalla' }),
    multValues: { '5,4': 6 },
    capture: false,
  });

  assert.equal(spin.orbs.length, 1);
  assert.equal(spin.multiplier.value, 6);
  assert.equal(spin.multiplier.applied, true);
  assert.equal(spin.totalWin, spin.baseWin * 6);
  assert.equal(spin.scatter.pay, 0);
});

test('Táctica base no aplica medallas si la tirada no paga', () => {
  const game = quiet(TACTICA_GAME);
  const spin = resolveSpin(game, {
    bet: 10,
    rng: makeRng(10),
    grid: board(game, { '5,4': 'medalla' }),
    multValues: { '5,4': 50 },
    capture: false,
  });
  assert.equal(spin.baseWin, 0);
  assert.equal(spin.multiplier.applied, false);
  assert.equal(spin.multiplier.value, 1);
  assert.equal(spin.totalWin, 0);
});

test('Táctica bono acumula medallas nuevas sobre el total del bono', () => {
  const game = quiet(TACTICA_GAME);
  const bonus = { gameId: 'tactica', active: true, remaining: 5, totalMultiplier: 10, bet: 10 };
  const spin = resolveSpin(game, {
    bet: 10,
    rng: makeRng(12),
    bonus,
    grid: board(game, { ...blockOf('gemaVerde', 8), '5,4': 'medalla' }),
    multValues: { '5,4': 5 },
    capture: false,
  });

  assert.equal(spin.multiplier.value, 15);
  assert.equal(spin.multiplier.applied, true);
  assert.equal(spin.totalWin, spin.baseWin * 15);
  assert.equal(spin.nextBonus.totalMultiplier, 15);
  assert.equal(spin.nextBonus.remaining, 4);
});

test('Táctica bono sin medalla nueva no aplica el acumulado', () => {
  const game = quiet(TACTICA_GAME);
  const bonus = { gameId: 'tactica', active: true, remaining: 4, totalMultiplier: 15, bet: 10 };
  const spin = resolveSpin(game, {
    bet: 10,
    rng: makeRng(13),
    bonus,
    grid: board(game, blockOf('gemaVerde', 8)),
    capture: false,
  });

  assert.equal(spin.multiplier.applied, false);
  assert.equal(spin.multiplier.value, 1);
  assert.equal(spin.totalWin, spin.baseWin);
  assert.equal(spin.nextBonus.totalMultiplier, 15, 'el acumulado no se pierde');
});

test('Táctica bono no acumula si no hubo premio, aunque caiga medalla', () => {
  const game = quiet(TACTICA_GAME);
  const bonus = { gameId: 'tactica', active: true, remaining: 4, totalMultiplier: 15, bet: 10 };
  const spin = resolveSpin(game, {
    bet: 10,
    rng: makeRng(14),
    bonus,
    grid: board(game, { '5,4': 'medalla' }),
    multValues: { '5,4': 50 },
    capture: false,
  });

  assert.equal(spin.baseWin, 0);
  assert.equal(spin.multiplier.applied, false);
  assert.equal(spin.nextBonus.totalMultiplier, 15);
});

test('Pulso base nunca genera cargas', () => {
  const rng = makeRng(15);
  for (let index = 0; index < 300; index += 1) {
    const spin = resolveSpin(PULSO_GAME, { bet: 10, rng, capture: false });
    assert.equal(spin.orbs.length, 0);
    assert.equal(spin.multiplier.applied, false);
  }
});

test('Pulso bono multiplica solo la tirada por las cargas en pantalla', () => {
  const game = quiet(PULSO_GAME);
  const bonus = { gameId: 'pulso', active: true, remaining: 4, totalMultiplier: 0, bet: 10 };
  const spin = resolveSpin(game, {
    bet: 10,
    rng: makeRng(16),
    bonus,
    grid: board(game, {
      ...blockOf('pixelCian', 8),
      '5,4': 'carga',
      '5,3': 'carga',
    }),
    multValues: { '5,4': 3, '5,3': 4 },
    capture: false,
  });

  assert.equal(spin.orbs.length, 2);
  assert.equal(spin.multiplier.value, 7);
  assert.equal(spin.multiplier.applied, true);
  assert.equal(spin.totalWin, spin.baseWin * 7);
  assert.equal(spin.nextBonus.totalMultiplier, 0, 'no hay acumulado entre giros');
});

test('Pulso bono arranca cada giro sin cargas', () => {
  const bonus = { gameId: 'pulso', active: true, remaining: 3, totalMultiplier: 0, bet: 10 };
  const spin = resolveSpin(PULSO_GAME, {
    bet: 10,
    rng: makeRng(17),
    bonus,
    grid: board(PULSO_GAME, blockOf('pixelCian', 8)),
    capture: false,
  });
  assert.equal(spin.multiplier.applied, false);
  assert.equal(spin.multiplier.value, 1);
});

test('las reglas de cada máquina son independientes', () => {
  const t = resolveMultiplier(TACTICA_GAME, {
    inBonus: true,
    baseWin: 5,
    orbSum: 4,
    totalMultiplier: 10,
  });
  assert.deepEqual(t, { value: 14, applied: true, totalMultiplier: 14 });

  const p = resolveMultiplier(PULSO_GAME, {
    inBonus: true,
    baseWin: 5,
    orbSum: 4,
    totalMultiplier: 10,
  });
  assert.deepEqual(p, { value: 4, applied: true, totalMultiplier: 10 });

  const base = resolveMultiplier(PULSO_GAME, {
    inBonus: false,
    baseWin: 5,
    orbSum: 4,
    totalMultiplier: 0,
  });
  assert.equal(base.applied, false);
  assert.equal(base.value, 1);
});

/* ---------- Bono ---------- */

test('el scatter dispara los giros gratis y el premio no se multiplica', () => {
  const game = quiet(TACTICA_GAME);
  const spin = resolveSpin(game, {
    bet: 10,
    rng: makeRng(18),
    grid: board(game, {
      ...spots('objetivo', [[0, 4], [1, 4], [2, 4], [3, 4]]),
      ...blockOf('gemaVerde', 8),
      '5,4': 'medalla',
    }),
    multValues: { '5,4': 4 },
    capture: false,
  });

  assert.equal(spin.scatter.count, 4);
  assert.equal(spin.scatter.pay, 3 * 10);
  assert.equal(spin.totalWin, spin.baseWin * 4 + 30);
  assert.equal(spin.freeSpins.triggered, true);
  assert.equal(spin.nextBonus.remaining, TACTICA.scatter.freeSpins);
  assert.equal(spin.nextBonus.totalMultiplier, 0, 'el bono nuevo arranca en cero');
});

test('dentro del bono 3+ scatters solo suman 5 giros', () => {
  const game = quiet(TACTICA_GAME);
  const bonus = { gameId: 'tactica', active: true, remaining: 3, totalMultiplier: 0, bet: 10 };
  const spin = resolveSpin(game, {
    bet: 10,
    rng: makeRng(19),
    bonus,
    grid: board(game, {
      ...spots('objetivo', [[0, 4], [1, 4], [2, 4], [3, 4]]),
      ...blockOf('gemaVerde', 8),
    }),
    capture: false,
  });

  assert.equal(spin.scatter.pay, 0);
  assert.equal(spin.freeSpins.added, 5);
  assert.equal(spin.nextBonus.remaining, 3 - 1 + 5);
  assert.equal(spin.totalWin, spin.baseWin);
});

test('los giros gratis no cuestan y el neto es el premio', () => {
  const bonus = { gameId: 'pulso', active: true, remaining: 2, totalMultiplier: 0, bet: 25 };
  const spin = resolveSpin(PULSO_GAME, { bet: 25, rng: makeRng(20), bonus, capture: false });
  assert.equal(spin.cost, 0);
  assert.equal(spin.net, spin.totalWin);
});

test('normalizeBonus descarta bonus de otro juego o sin giros', () => {
  assert.equal(normalizeBonus(TACTICA_GAME, null), null);
  assert.equal(normalizeBonus(TACTICA_GAME, { remaining: 0 }), null);
  assert.equal(normalizeBonus(TACTICA_GAME, { gameId: 'pulso', remaining: 5 }), null);

  const bonus = normalizeBonus(TACTICA_GAME, { remaining: 9999, totalMultiplier: 7, bet: 50 });
  assert.equal(bonus.remaining, MAX_BONUS_SPINS);
  assert.equal(bonus.totalMultiplier, 7);
  assert.equal(bonus.bet, 50);
});

test('playBonus corre la ronda entera y devuelve el total', () => {
  const start = normalizeBonus(TACTICA_GAME, { remaining: 5, totalMultiplier: 2, bet: 10 });
  const round = playBonus(TACTICA_GAME, start, makeRng(23), { capture: false });
  assert.ok(round.spins.length >= 5);
  assert.equal(round.total, round.spins.reduce((sum, spin) => sum + spin.totalWin, 0));
  assert.equal(round.remaining, 0);
});

/* ---------- Integración ---------- */

test('el total de cada tirada es cascadas × multiplicador + scatter', () => {
  for (const game of GAMES) {
    const rng = makeRng(31);
    for (let index = 0; index < 300; index += 1) {
      const spin = resolveSpin(game, { bet: 10, rng, capture: false });
      const cascades = spin.multiplier.applied
        ? spin.baseWin * spin.multiplier.value
        : spin.baseWin;
      assert.equal(spin.totalWin, cascades + spin.scatter.pay);
      assert.equal(spin.net, spin.totalWin - 10);
    }
  }
});

test('la misma semilla da la misma tirada', () => {
  const a = resolveSpin(TACTICA_GAME, { bet: 10, rng: makeRng(77) });
  const b = resolveSpin(TACTICA_GAME, { bet: 10, rng: makeRng(77) });
  assert.deepEqual(a.initialGrid, b.initialGrid);
  assert.equal(a.totalWin, b.totalWin);
  assert.deepEqual(a.orbs, b.orbs);
});

test('la apuesta escala los premios', () => {
  const small = resolveSpin(PULSO_GAME, { bet: 10, rng: makeRng(88), capture: false });
  const big = resolveSpin(PULSO_GAME, { bet: 100, rng: makeRng(88), capture: false });
  assert.equal(big.baseWin, small.baseWin * 10);
  assert.equal(big.scatter.pay, small.scatter.pay * 10);
  assert.equal(big.totalWin, small.totalWin * 10);
});

/* ---------- RTP ---------- */

test('las dos máquinas rondan el 96% de RTP', () => {
  for (const game of GAMES) {
    const report = simulate(game, { spins: 200000, rng: makeRng(2024) });
    assert.ok(
      Math.abs(report.rtp - game.rtpTarget) < 0.02,
      `${game.label}: RTP ${(report.rtp * 100).toFixed(2)}%`,
    );
    assert.ok(report.hitRate > 0.2 && report.hitRate < 0.6, `${game.label}: premio`);
    assert.ok(report.avgCascades > 0.2, `${game.label}: cascadas`);
    assert.ok(report.bonusFrequency > 1 / 400, `${game.label}: bono demasiado raro`);
    assert.equal(report.guardHits, 0);
  }
});
