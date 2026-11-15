// Motor de la tragamonedas clásica: 3 rodillos, 3 filas y 5 líneas fijas.
// Sin DOM y con `rng` inyectable: todo se puede testear con Node.

export const SLOT_REELS = 3;
export const SLOT_ROWS = 3;
export const SLOT_MIN_BET = 5;
export const SLOT_DEFAULT_BET = 10;

/**
 * Símbolos y pago por línea de tres iguales, en múltiplos de la apuesta total.
 * Con estos pagos y la tira de abajo el RTP es 95,15%.
 */
export const SLOT_SYMBOLS = {
  trebol: { glyph: '\u2663', label: 'trébol', pay: 2, tone: 'green' },
  corazon: { glyph: '\u2665', label: 'corazón', pay: 3, tone: 'red' },
  pica: { glyph: '\u2660', label: 'pica', pay: 5, tone: 'ink' },
  diamante: { glyph: '\u2666', label: 'diamante', pay: 10, tone: 'red' },
  estrella: { glyph: '\u2605', label: 'estrella', pay: 25, tone: 'gold' },
  siete: { glyph: '7', label: 'siete', pay: 80, tone: 'gold' },
};

/** Cuántas veces aparece cada símbolo en la tira de 30 posiciones. */
export const SLOT_COUNTS = {
  trebol: 8,
  corazon: 7,
  pica: 6,
  diamante: 5,
  estrella: 3,
  siete: 1,
};

/**
 * Tira de cada rodillo. Cada giro elige una posición al azar y se ven tres
 * símbolos consecutivos (con vuelta al principio al llegar al final).
 */
export const SLOT_STRIP = [
  'trebol',
  'corazon',
  'pica',
  'diamante',
  'estrella',
  'trebol',
  'corazon',
  'pica',
  'diamante',
  'trebol',
  'corazon',
  'pica',
  'trebol',
  'siete',
  'corazon',
  'diamante',
  'estrella',
  'trebol',
  'pica',
  'corazon',
  'trebol',
  'diamante',
  'pica',
  'corazon',
  'trebol',
  'estrella',
  'diamante',
  'pica',
  'corazon',
  'trebol',
];

/** Las 5 líneas: fila 0 arriba, 1 medio y 2 abajo. */
export const SLOT_LINES = [
  { id: 'top', label: 'Arriba', rows: [0, 0, 0] },
  { id: 'middle', label: 'Medio', rows: [1, 1, 1] },
  { id: 'bottom', label: 'Abajo', rows: [2, 2, 2] },
  { id: 'v', label: 'V', rows: [0, 1, 2] },
  { id: 'peak', label: 'Montaña', rows: [2, 1, 0] },
];

/** Símbolo que ocupa una fila del rodillo cuando frena en `stop`. */
export function stripSymbol(stop, row) {
  const length = SLOT_STRIP.length;
  const index = (Math.floor(stop) + Math.floor(row)) % length;
  return SLOT_STRIP[(index + length) % length];
}

/** Grilla de 3×3 para una posición de cada rodillo. */
export function gridForStops(stops) {
  return stops.map((stop) =>
    Array.from({ length: SLOT_ROWS }, (_, row) => stripSymbol(stop, row)),
  );
}

/** Líneas premiadas de una grilla, con el pago en dinero. */
export function evaluateLines(grid, bet) {
  const amount = Number.isFinite(bet) && bet > 0 ? bet : 0;
  const wins = [];

  for (const line of SLOT_LINES) {
    const symbols = line.rows.map((row, reel) => grid[reel][row]);
    const first = symbols[0];
    if (!symbols.every((symbol) => symbol === first)) continue;
    const multiplier = SLOT_SYMBOLS[first].pay;
    wins.push({
      id: line.id,
      label: line.label,
      rows: line.rows,
      symbol: first,
      multiplier,
      pay: Math.round(amount * multiplier),
    });
  }

  return wins;
}

/** Un giro completo: posiciones, grilla, líneas premiadas y neto. */
export function spinSlots({ bet, rng = Math.random } = {}) {
  const amount = Number.isFinite(bet) && bet > 0 ? Math.floor(bet) : 0;
  const stops = Array.from({ length: SLOT_REELS }, () =>
    Math.floor(rng() * SLOT_STRIP.length),
  );
  const grid = gridForStops(stops);
  const lines = evaluateLines(grid, amount);
  const win = lines.reduce((total, line) => total + line.pay, 0);

  return {
    bet: amount,
    stops,
    grid,
    lines,
    win,
    net: win - amount,
    multiplier: amount > 0 ? win / amount : 0,
  };
}

/** Ajusta una apuesta al mínimo, a un monto entero y al saldo disponible. */
export function normalizeSlotBet(value, balance) {
  const max = Number.isFinite(balance) ? Math.max(0, Math.floor(balance)) : 0;
  if (max < SLOT_MIN_BET) return 0;
  const raw = Number.isFinite(value) && value > 0 ? Math.floor(value) : SLOT_DEFAULT_BET;
  return Math.min(max, Math.max(SLOT_MIN_BET, raw));
}

/** Apuestas rápidas que entran en el saldo, de menor a mayor. */
export function slotBetOptions(balance) {
  const max = Number.isFinite(balance) ? Math.max(0, Math.floor(balance)) : 0;
  return [5, 10, 25, 100, 500].filter((value) => value <= max);
}

/** RTP exacto: cada línea paga con la frecuencia real de la tira. */
export function slotRtp() {
  const total = SLOT_STRIP.length;
  const perLine = Object.entries(SLOT_COUNTS).reduce((sum, [symbol, count]) => {
    const chance = count / total;
    return sum + chance ** 3 * SLOT_SYMBOLS[symbol].pay;
  }, 0);
  return SLOT_LINES.length * perLine;
}

/** Probabilidad de que al menos una línea pague en un giro. */
export function slotHitChance() {
  const total = SLOT_STRIP.length;
  const perLine = Object.values(SLOT_COUNTS).reduce(
    (sum, count) => sum + (count / total) ** 3,
    0,
  );
  return SLOT_LINES.length * perLine;
}
