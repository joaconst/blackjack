import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SLOT_COUNTS,
  SLOT_DEFAULT_BET,
  SLOT_LINES,
  SLOT_MIN_BET,
  SLOT_REELS,
  SLOT_ROWS,
  SLOT_STRIP,
  SLOT_SYMBOLS,
  evaluateLines,
  gridForStops,
  normalizeSlotBet,
  slotBetOptions,
  slotHitChance,
  slotRtp,
  spinSlots,
  stripSymbol,
} from '../js/games/slots/engine.js';

function seededRng(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Grilla 3×3 a partir de tres filas de símbolos. */
function grid(rows) {
  return [0, 1, 2].map((reel) => rows.map((row) => row[reel]));
}

/* ---------- Tira ---------- */

test('la tira tiene 30 posiciones y respeta los conteos', () => {
  assert.equal(SLOT_STRIP.length, 30);
  const tally = {};
  for (const symbol of SLOT_STRIP) tally[symbol] = (tally[symbol] || 0) + 1;
  assert.deepEqual(tally, SLOT_COUNTS);
});

test('todos los símbolos de la tira están definidos y pagan', () => {
  for (const symbol of new Set(SLOT_STRIP)) {
    assert.ok(SLOT_SYMBOLS[symbol], `símbolo ${symbol}`);
    assert.ok(SLOT_SYMBOLS[symbol].pay > 0);
  }
});

test('los pagos crecen con la rareza', () => {
  const byCount = Object.entries(SLOT_COUNTS)
    .sort((a, b) => b[1] - a[1])
    .map(([symbol]) => SLOT_SYMBOLS[symbol].pay);
  for (let i = 1; i < byCount.length; i += 1) {
    assert.ok(byCount[i] > byCount[i - 1], 'el símbolo más raro paga más');
  }
});

test('stripSymbol da la vuelta al llegar al final de la tira', () => {
  assert.equal(stripSymbol(0, 0), SLOT_STRIP[0]);
  assert.equal(stripSymbol(0, 2), SLOT_STRIP[2]);
  assert.equal(stripSymbol(29, 1), SLOT_STRIP[0]);
  assert.equal(stripSymbol(29, 2), SLOT_STRIP[1]);
  assert.equal(stripSymbol(-1, 0), SLOT_STRIP[29]);
});

test('gridForStops arma tres filas por rodillo', () => {
  const stops = [4, 17, 25];
  const result = gridForStops(stops);
  assert.equal(result.length, SLOT_REELS);
  for (const reel of result) assert.equal(reel.length, SLOT_ROWS);
  stops.forEach((stop, index) => {
    for (let row = 0; row < SLOT_ROWS; row += 1) {
      assert.equal(result[index][row], stripSymbol(stop, row));
    }
  });
});

/* ---------- Líneas y pagos ---------- */

test('la línea del medio paga los tres sietes', () => {
  const board = grid([
    ['trebol', 'diamante', 'corazon'],
    ['siete', 'siete', 'siete'],
    ['pica', 'estrella', 'trebol'],
  ]);
  const wins = evaluateLines(board, 10);
  assert.equal(wins.length, 1);
  assert.equal(wins[0].id, 'middle');
  assert.equal(wins[0].symbol, 'siete');
  assert.equal(wins[0].multiplier, 80);
  assert.equal(wins[0].pay, 800);
});

test('las cinco líneas se evalúan y se suman', () => {
  const board = grid([
    ['trebol', 'trebol', 'trebol'],
    ['siete', 'siete', 'siete'],
    ['pica', 'estrella', 'corazon'],
  ]);
  const wins = evaluateLines(board, 10);
  const ids = wins.map((line) => line.id).sort();
  assert.deepEqual(ids, ['middle', 'top']);
  assert.equal(
    wins.reduce((sum, line) => sum + line.pay, 0),
    820,
  );
});

test('sin tres iguales no hay premio', () => {
  const board = grid([
    ['trebol', 'corazon', 'pica'],
    ['diamante', 'estrella', 'siete'],
    ['pica', 'trebol', 'corazon'],
  ]);
  assert.deepEqual(evaluateLines(board, 100), []);
});

test('cada línea tiene su propia forma', () => {
  assert.equal(SLOT_LINES.length, 5);
  const shapes = SLOT_LINES.map((line) => line.rows.join(''));
  assert.deepEqual(shapes, ['000', '111', '222', '012', '210']);
});

/* ---------- Giro ---------- */

test('un giro devuelve la grilla completa y el neto correcto', () => {
  const spin = spinSlots({ bet: 25, rng: seededRng(7) });
  assert.equal(spin.grid.length, 3);
  for (const reel of spin.grid) assert.equal(reel.length, 3);
  assert.equal(spin.bet, 25);
  assert.equal(spin.net, spin.win - 25);
  assert.equal(spin.multiplier, spin.win / 25);
  assert.ok(spin.stops.every((stop) => stop >= 0 && stop < SLOT_STRIP.length));
});

test('el mismo rng da el mismo giro', () => {
  const a = spinSlots({ bet: 10, rng: seededRng(1234) });
  const b = spinSlots({ bet: 10, rng: seededRng(1234) });
  assert.deepEqual(a.grid, b.grid);
  assert.deepEqual(a.stops, b.stops);
  assert.equal(a.win, b.win);
});

test('200 giros con semilla fija siempre son válidos', () => {
  const rng = seededRng(99);
  for (let i = 0; i < 200; i += 1) {
    const spin = spinSlots({ bet: 10, rng });
    assert.equal(spin.grid.length, 3);
    assert.ok(spin.win >= 0);
    assert.ok(spin.win % 10 === 0, 'los pagos van en múltiplos de la apuesta');
    assert.equal(spin.net, spin.win - 10);
  }
});

test('una apuesta vacía no paga nada', () => {
  const spin = spinSlots({ bet: 0, rng: seededRng(3) });
  assert.equal(spin.win, 0);
  assert.equal(spin.net, 0);
  assert.equal(spin.multiplier, 0);
});

/* ---------- RTP ---------- */

test('el RTP es 95,15% y el premio sale 1 de cada 4,4 giros', () => {
  assert.ok(Math.abs(slotRtp() - 0.9515) < 0.0001);
  assert.ok(Math.abs(slotHitChance() - 0.2267) < 0.0005);
});

test('enumerar las 27.000 combinaciones confirma el RTP', () => {
  let total = 0;
  for (let a = 0; a < SLOT_STRIP.length; a += 1) {
    for (let b = 0; b < SLOT_STRIP.length; b += 1) {
      for (let c = 0; c < SLOT_STRIP.length; c += 1) {
        total += evaluateLines(gridForStops([a, b, c]), 10).reduce(
          (sum, line) => sum + line.pay,
          0,
        );
      }
    }
  }
  const combinations = SLOT_STRIP.length ** 3;
  const rtp = total / (combinations * 10);
  assert.ok(Math.abs(rtp - slotRtp()) < 1e-9, `RTP enumerado ${rtp}`);
});

/* ---------- Apuesta ---------- */

test('la apuesta se ajusta al mínimo, al entero y al saldo', () => {
  assert.equal(normalizeSlotBet(undefined, 1000), SLOT_DEFAULT_BET);
  assert.equal(normalizeSlotBet(7, 1000), 7);
  assert.equal(normalizeSlotBet(3, 1000), SLOT_MIN_BET);
  assert.equal(normalizeSlotBet(12.9, 1000), 12);
  assert.equal(normalizeSlotBet(1e9, 1000), 1000);
  assert.equal(normalizeSlotBet(250, 130), 130);
  assert.equal(normalizeSlotBet(50, 4), 0);
  assert.equal(normalizeSlotBet(50, 0), 0);
  assert.equal(normalizeSlotBet(9, 9), 9);
  assert.equal(normalizeSlotBet(0, 1000), SLOT_DEFAULT_BET);
});

test('una apuesta escrita a mano paga exacto', () => {
  const board = grid([
    ['trebol', 'diamante', 'corazon'],
    ['corazon', 'corazon', 'corazon'],
    ['pica', 'estrella', 'trebol'],
  ]);
  const wins = evaluateLines(board, 37);
  assert.equal(wins.length, 1);
  assert.equal(wins[0].pay, 111);
});

test('las apuestas rápidas entran en el saldo', () => {
  assert.deepEqual(slotBetOptions(1000), [5, 10, 25, 100, 500]);
  assert.deepEqual(slotBetOptions(30), [5, 10, 25]);
  assert.deepEqual(slotBetOptions(4), []);
  assert.deepEqual(slotBetOptions(0), []);
});
