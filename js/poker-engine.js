// Motor de póker (Texas Hold'em simplificado para una mesa de 4).
// Sin DOM y sin estado global: todo se puede testear con Node.
//
// Dinero: el motor trabaja con stacks de la mesa. El controlador decide
// cuánto poner en riesgo por mano y aplica el neto al saldo al terminar.

import { createShoe, shuffle } from './engine.js';

export const SB = 5;
export const BB = 10;
export const START_STACK = 300;

// Ciegas estándar: la escalera 1/10 por década. Además se puede elegir una
// ciega personalizada, siempre par y con techo saldo / 10.
export const BIG_BLINDS = [10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000];
export const DEFAULT_BUY_IN = 300;
export const MIN_BUY_IN_BLINDS = 10;
export const SUGGESTED_BUY_IN_BLINDS = 100;
export const MIN_BIG_BLIND = 10;
// Con ciegas de más de un décimo del saldo no se puede entrar con 10 ciegas.
export const MAX_BLIND_DIVISOR = 10;
// Cuántas parejas estándar se muestran en la hoja Mesa.
export const BLIND_OPTIONS = 4;

/** Entero par hacia abajo; 0 si no es un número usable. */
function evenAtMost(value) {
  const n = Math.floor(Number(value) || 0);
  return n - (n % 2);
}

/** Ciega grande válida: par y de al menos 10. */
export function normalizeBigBlind(value) {
  const bb = evenAtMost(value);
  return bb >= MIN_BIG_BLIND ? bb : BB;
}

/** Techo de la ciega grande: un décimo del saldo, para entrar con 10 ciegas. */
export function maxBigBlind(balance) {
  return evenAtMost(Math.floor(Number(balance) || 0) / MAX_BLIND_DIVISOR);
}

/** Ajusta una ciega escrita a mano: par, mínimo 10 y techo saldo / 10. */
export function customBigBlind(value, balance) {
  const top = maxBigBlind(balance);
  if (top < MIN_BIG_BLIND) return null;
  const bb = Math.max(MIN_BIG_BLIND, Math.min(top, evenAtMost(value)));
  return bb >= MIN_BIG_BLIND ? bb : null;
}

/** Parejas estándar que se ofrecen, más la que ya tenías si entra en el saldo. */
export function blindOptions(balance, current = BB) {
  const top = maxBigBlind(balance);
  const list = BIG_BLINDS.filter((bb) => bb <= top).slice(-BLIND_OPTIONS);
  const actual = customBigBlind(current, balance);
  if (actual && BIG_BLINDS.includes(actual) && !list.includes(actual)) list.push(actual);
  list.sort((a, b) => a - b);
  return list.length ? list : [BB];
}

/** Entrada jugable: nunca por debajo de 10 ciegas grandes ni por encima del saldo. */
export function clampBuyIn(value, balance, bigBlind = BB) {
  const cash = Math.floor(Number(balance) || 0);
  const bb = normalizeBigBlind(bigBlind);
  if (cash < bb) return 0;
  const min = Math.min(bb * MIN_BUY_IN_BLINDS, cash);
  const wanted = Math.floor(Number(value));
  if (!Number.isFinite(wanted) || wanted <= 0) return min;
  return Math.max(min, Math.min(cash, wanted));
}

/** Entrada sugerida al cambiar de ciegas: 100 ciegas grandes o todo el saldo. */
export function suggestedBuyIn(balance, bigBlind = BB) {
  const bb = normalizeBigBlind(bigBlind);
  return clampBuyIn(bb * SUGGESTED_BUY_IN_BLINDS, balance, bb);
}

export const CATEGORY_NAMES = [
  'Carta alta',
  'Par',
  'Doble par',
  'Trío',
  'Escalera',
  'Color',
  'Full',
  'Póker',
  'Escalera de color',
];

const RANK_VALUE = {
  A: 14,
  K: 13,
  Q: 12,
  J: 11,
  10: 10,
  9: 9,
  8: 8,
  7: 7,
  6: 6,
  5: 5,
  4: 4,
  3: 3,
  2: 2,
};

export const BOT_PROFILES = {
  tight: {
    aggression: 0.34,
    tightness: 0.16,
    bluff: 0.08,
    semiBluff: 0.36,
    cbet: 0.55,
    barrel: 0.25,
    trap: 0.3,
    callMargin: 0.07,
  },
  balanced: {
    aggression: 0.54,
    tightness: 0.04,
    bluff: 0.17,
    semiBluff: 0.58,
    cbet: 0.68,
    barrel: 0.38,
    trap: 0.2,
    callMargin: 0.05,
  },
  aggro: {
    aggression: 0.8,
    tightness: -0.04,
    bluff: 0.3,
    semiBluff: 0.74,
    cbet: 0.78,
    barrel: 0.55,
    trap: 0.1,
    callMargin: 0.03,
  },
};

// El nivel elegido en Ajustes ajusta los rasgos del perfil. "Fácil" juega
// más suelto y se equivoca; "Difícil" ajusta rangos, presiona y casi no regala.
export const BOT_LEVELS = {
  facil: {
    label: 'Fácil',
    aggression: 0.72,
    bluff: 0.55,
    semiBluff: 0.7,
    tightness: -0.05,
    mistake: 0.07,
  },
  normal: {
    label: 'Normal',
    aggression: 1,
    bluff: 1,
    semiBluff: 1,
    tightness: 0,
    mistake: 0.02,
  },
  dificil: {
    label: 'Difícil',
    aggression: 1.12,
    bluff: 1.25,
    semiBluff: 1.15,
    tightness: 0.02,
    mistake: 0,
  },
};

// Claves viejas de v2.5: se migran al leer las preferencias.
const BOT_LEVEL_ALIASES = { suave: 'facil', duro: 'dificil' };

export function normalizeBotLevel(value) {
  const key = BOT_LEVEL_ALIASES[value] || value;
  return BOT_LEVELS[key] ? key : 'normal';
}

// Cuánto farolea la mesa. "Sin" apaga el farol y el semi-farol.
export const BOT_BLUFF_LEVELS = {
  sin: 0,
  pocos: 0.5,
  normal: 1,
  muchos: 1.6,
};

export function normalizeBluffLevel(value) {
  return typeof value === 'string' && value in BOT_BLUFF_LEVELS ? value : 'normal';
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

export function resolveTraits(profile, level = 'normal', bluff = 'normal') {
  const base = BOT_PROFILES[profile] || BOT_PROFILES.balanced;
  const key = normalizeBotLevel(level);
  const mod = BOT_LEVELS[key];
  const bluffMod = BOT_BLUFF_LEVELS[normalizeBluffLevel(bluff)];
  return {
    ...base,
    aggression: clamp(base.aggression * mod.aggression),
    tightness: base.tightness + mod.tightness,
    bluff: clamp(base.bluff * mod.bluff * bluffMod),
    semiBluff: clamp(base.semiBluff * mod.semiBluff * bluffMod),
    bluffFactor: bluffMod,
    mistake: mod.mistake,
    level: key,
  };
}

/* ---------- Cartas y evaluación ---------- */

export function makeDeck(rng = Math.random) {
  return shuffle(createShoe(1), rng);
}

function straightHigh(values) {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  for (let i = 0; i + 4 < unique.length; i += 1) {
    if (unique[i] - unique[i + 4] === 4) return unique[i];
  }
  if (unique.includes(14) && unique.includes(5) && unique.includes(4) && unique.includes(3) && unique.includes(2)) {
    return 5; // escalera al as: A-2-3-4-5
  }
  return 0;
}

/**
 * Evalúa exactamente 5 cartas y devuelve un puntaje comparable.
 * Formato: [categoría, desempate...] ordenado de mayor a menor.
 */
export function evaluate5(cards) {
  const values = cards.map((card) => RANK_VALUE[card.rank]).sort((a, b) => b - a);
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);

  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every((card) => card.suit === cards[0].suit);
  const high = straightHigh(values);

  if (flush && high) return [8, high];
  if (groups[0][1] === 4) {
    return [7, groups[0][0], groups[1][0]];
  }
  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return [6, groups[0][0], groups[1][0]];
  }
  if (flush) return [5, ...values];
  if (high) return [4, high];
  if (groups[0][1] === 3) {
    return [3, groups[0][0], ...groups.slice(1).map(([value]) => value).sort((a, b) => b - a)];
  }
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const pairs = [groups[0][0], groups[1][0]].sort((a, b) => b - a);
    return [2, pairs[0], pairs[1], groups[2][0]];
  }
  if (groups[0][1] === 2) {
    return [1, groups[0][0], ...groups.slice(1).map(([value]) => value).sort((a, b) => b - a)];
  }
  return [0, ...values];
}

export function compareScores(a, b) {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const left = a[i] || 0;
    const right = b[i] || 0;
    if (left !== right) return left > right ? 1 : -1;
  }
  return 0;
}

export function scoreName(score) {
  return CATEGORY_NAMES[score[0]] || 'Carta alta';
}

function combinations(size) {
  const out = [];
  const pick = (start, combo) => {
    if (combo.length === 5) {
      out.push(combo.slice());
      return;
    }
    for (let index = start; index < size; index += 1) {
      combo.push(index);
      pick(index + 1, combo);
      combo.pop();
    }
  };
  pick(0, []);
  return out;
}

const COMBOS_5 = combinations(5);
const COMBOS_6 = combinations(6);
const COMBOS_7 = combinations(7);

/** Mejor mano de 5 entre las disponibles (5, 6 o 7 cartas). */
export function bestHand(cards) {
  if (cards.length < 5) return { score: [0, 0], cards: cards.slice(), name: CATEGORY_NAMES[0] };
  const source = cards.slice(0, 7);
  const combos = source.length === 5 ? COMBOS_5 : source.length === 6 ? COMBOS_6 : COMBOS_7;
  let best = null;
  let bestCards = null;
  for (const combo of combos) {
    const five = combo.map((index) => source[index]);
    const score = evaluate5(five);
    if (!best || compareScores(score, best) > 0) {
      best = score;
      bestCards = five;
    }
  }
  return { score: best, cards: bestCards, name: scoreName(best) };
}

export function evaluate7(cards) {
  return bestHand(cards).score;
}

/* ---------- Mesa ---------- */

export function potTotal(table) {
  return table.pot;
}

export function contenders(table) {
  return table.players.filter((player) => !player.folded);
}

export function activeIndices(table) {
  return table.players
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => !player.folded && !player.allIn)
    .map(({ index }) => index);
}

function nextOpenIndex(table, from) {
  const count = table.players.length;
  for (let step = 1; step <= count; step += 1) {
    const index = (from + step) % count;
    const player = table.players[index];
    if (!player.folded && !player.allIn) return index;
  }
  return null;
}

export function createTable({
  stack = START_STACK,
  dealer = 0,
  names = ['Vos', 'Ana', 'Beto', 'Caro'],
  sb = SB,
  bb = BB,
} = {}) {
  return {
    dealer,
    smallBlind: sb,
    bigBlind: bb,
    startStack: stack,
    handNo: 0,
    street: 'idle', // idle | preflop | flop | turn | river
    deck: [],
    board: [],
    pot: 0,
    currentBet: 0,
    lastRaiseSize: bb,
    turn: null,
    settled: false,
    showdown: false,
    result: null,
    lastPot: 0,
    lastAggressor: null,
    raisesThisStreet: 0,
    players: names.map((name, index) => ({
      name,
      isYou: index === 0,
      stack,
      hole: [],
      folded: false,
      allIn: false,
      bet: 0,
      total: 0,
      acted: false,
      raises: 0,
      lastAction: '',
      bluffing: false,
      handName: '',
      bestScore: null,
    })),
  };
}

function payChips(table, player, amount) {
  const paid = Math.min(amount, player.stack);
  player.stack -= paid;
  player.bet += paid;
  player.total += paid;
  table.pot += paid;
  if (player.stack === 0) player.allIn = true;
  return paid;
}

function blindIndexes(table) {
  const count = table.players.length;
  if (count === 2) {
    return { sb: table.dealer, bb: (table.dealer + 1) % count };
  }
  return { sb: (table.dealer + 1) % count, bb: (table.dealer + 2) % count };
}

export function startHand(table, rng = Math.random) {
  const count = table.players.length;
  if (table.handNo > 0) table.dealer = (table.dealer + 1) % count;
  table.handNo += 1;

  table.deck = makeDeck(rng);
  table.board = [];
  table.pot = 0;
  table.currentBet = 0;
  table.lastRaiseSize = table.bigBlind;
  table.settled = false;
  table.showdown = false;
  table.result = null;
  table.lastPot = 0;
  table.lastAggressor = null;
  table.raisesThisStreet = 0;
  table.street = 'preflop';

  for (const player of table.players) {
    player.stack = table.startStack;
    player.hole = [];
    player.folded = false;
    player.allIn = false;
    player.bet = 0;
    player.total = 0;
    player.acted = false;
    player.raises = 0;
    player.lastAction = '';
    player.bluffing = false;
    player.handName = '';
    player.bestScore = null;
  }

  const order = [];
  for (let step = 1; step <= count; step += 1) {
    order.push((table.dealer + step) % count);
  }
  for (let round = 0; round < 2; round += 1) {
    for (const index of order) {
      table.players[index].hole.push(table.deck.pop());
    }
  }

  const { sb, bb } = blindIndexes(table);
  payChips(table, table.players[sb], table.smallBlind);
  payChips(table, table.players[bb], table.bigBlind);
  table.players[sb].acted = false;
  table.players[bb].acted = false;
  table.currentBet = Math.max(table.players[sb].bet, table.players[bb].bet, table.bigBlind);

  const first = count === 2 ? sb : (bb + 1) % count;
  table.turn = firstOpenFrom(table, first - 1);
  return table;
}

function firstOpenFrom(table, from) {
  const count = table.players.length;
  for (let step = 1; step <= count; step += 1) {
    const index = (from + step) % count;
    const player = table.players[index];
    if (!player.folded && !player.allIn) return index;
  }
  return null;
}

/* ---------- Reglas de apuesta ---------- */

export function legalActions(table, index) {
  const player = table.players[index];
  if (!player || table.settled || player.folded || player.allIn || table.turn !== index) return null;

  const toCall = Math.max(0, table.currentBet - player.bet);
  const call = Math.min(toCall, player.stack);
  const maxRaiseTo = player.bet + player.stack;
  const raiseStep = Math.max(table.bigBlind, table.lastRaiseSize);
  const minRaiseTo =
    table.currentBet === 0
      ? Math.min(table.bigBlind, maxRaiseTo)
      : Math.min(table.currentBet + raiseStep, maxRaiseTo);

  return {
    fold: true,
    check: toCall === 0,
    call,
    toCall,
    allIn: maxRaiseTo,
    raise: maxRaiseTo > table.currentBet ? { min: minRaiseTo, max: maxRaiseTo } : null,
  };
}

/**
 * Opciones de subida listas para la interfaz: rango legal y presets.
 * Devuelve null si el jugador no puede subir en este momento.
 */
export function raiseOptions(table, index) {
  const legal = legalActions(table, index);
  if (!legal || !legal.raise) return null;

  const { min, max } = legal.raise;
  const quantum = Math.max(1, table.smallBlind || SB);
  const roundTo = (value) => Math.round(value / quantum) * quantum;
  const clamp = (value) => Math.max(min, Math.min(max, roundTo(value)));
  const potAfterCall = table.pot + legal.toCall;

  const candidates = [
    { id: 'min', label: 'Mínima', amount: min },
    { id: 'half', label: '½ pozo', amount: clamp(table.currentBet + potAfterCall * 0.5) },
    { id: 'pot', label: 'Pozo', amount: clamp(table.currentBet + potAfterCall) },
  ];

  const seen = new Set();
  const presets = [];
  for (const preset of candidates) {
    if (seen.has(preset.amount) || preset.amount >= max) continue;
    seen.add(preset.amount);
    presets.push(preset);
  }
  // El all-in siempre va último y gana si coincide con otro preset.
  presets.push({ id: 'allin', label: 'All in', amount: max });

  return {
    ...legal,
    potAfterCall,
    presets,
  };
}

/** Ajusta un monto al rango legal de subida. */
export function clampRaiseTarget(table, index, value) {
  const options = raiseOptions(table, index);
  if (!options) return 0;
  const target = Math.floor(Number(value) || 0);
  return Math.max(options.raise.min, Math.min(options.raise.max, target));
}

/** Mueve el monto una cantidad de pasos de una ciega chica, sin salir del rango. */
export function stepRaiseTarget(table, index, current, steps = 1) {
  const options = raiseOptions(table, index);
  if (!options) return 0;
  const quantum = Math.max(1, table.smallBlind || SB);
  const base = clampRaiseTarget(table, index, current);
  const next = base + Math.floor(Number(steps) || 0) * quantum;
  return Math.max(options.raise.min, Math.min(options.raise.max, next));
}

function reopenAction(table, raiserIndex) {
  table.players.forEach((player, index) => {
    if (index !== raiserIndex && !player.folded && !player.allIn) player.acted = false;
  });
}

function resolveRaise(table, index, rawTarget, legal) {
  const player = table.players[index];
  let target = Math.floor(Number(rawTarget) || 0);
  if (!legal.raise) {
    // Sin margen para subir: lo máximo es igualar por todo el stack.
    return resolveCall(table, index);
  }
  target = Math.max(legal.raise.min, Math.min(legal.raise.max, target));
  const allIn = target === legal.raise.max;
  if (target < legal.raise.min && !allIn) return { ok: false, error: 'raise-too-small' };

  const increment = target - table.currentBet;
  payChips(table, player, target - player.bet);
  table.currentBet = target;
  if (increment >= table.lastRaiseSize) {
    table.lastRaiseSize = increment;
    reopenAction(table, index);
  }
  player.acted = true;
  return { ok: true };
}

function resolveCall(table, index) {
  const player = table.players[index];
  const toCall = Math.max(0, table.currentBet - player.bet);
  payChips(table, player, toCall);
  player.acted = true;
  return { ok: true };
}

export function applyAction(table, index, action) {
  const legal = legalActions(table, index);
  if (!legal) return { ok: false, error: 'not-your-turn' };

  const type = action && action.type;
  const intent = action && typeof action.intent === 'string' ? action.intent : '';
  const player = table.players[index];

  if (type === 'fold') {
    player.folded = true;
    player.acted = true;
    player.lastAction = 'fold';
    player.bluffing = false;
  } else if (type === 'check') {
    if (!legal.check) return { ok: false, error: 'cannot-check' };
    player.acted = true;
    player.lastAction = 'check';
  } else if (type === 'call') {
    if (legal.toCall === 0) {
      player.acted = true;
      player.lastAction = 'check';
    } else {
      resolveCall(table, index);
      player.lastAction = 'call';
    }
  } else if (type === 'raise') {
    const result = resolveRaise(table, index, action.amount, legal);
    if (!result.ok) return result;
    player.lastAction = 'raise';
    player.raises = (player.raises || 0) + 1;
    table.raisesThisStreet = (table.raisesThisStreet || 0) + 1;
    table.lastAggressor = index;
    player.bluffing = intent === 'bluff' || intent === 'semiBluff';
  } else if (type === 'allin') {
    const target = player.bet + player.stack;
    if (target > table.currentBet) {
      const step = Math.max(table.bigBlind, table.lastRaiseSize);
      const increment = target - table.currentBet;
      payChips(table, player, player.stack);
      table.currentBet = target;
      if (increment >= step) {
        table.lastRaiseSize = increment;
        reopenAction(table, index);
      }
      player.acted = true;
      player.lastAction = 'raise';
      player.raises = (player.raises || 0) + 1;
      table.raisesThisStreet = (table.raisesThisStreet || 0) + 1;
      table.lastAggressor = index;
      player.bluffing = intent === 'bluff' || intent === 'semiBluff';
    } else {
      resolveCall(table, index);
      player.lastAction = 'call';
    }
  } else {
    return { ok: false, error: 'unknown-action' };
  }

  table.turn = nextToAct(table, index);
  return { ok: true };
}

function nextToAct(table, from) {
  return nextOpenIndex(table, from);
}

/* ---------- Calles y cierre de mano ---------- */

function bettingDone(table) {
  const alive = table.players.filter((player) => !player.folded);
  if (alive.length <= 1) return true;
  const actors = alive.filter((player) => !player.allIn);
  if (actors.length === 0) return true;
  if (actors.length === 1) return actors[0].bet >= table.currentBet;
  return actors.every((player) => player.acted && player.bet === table.currentBet);
}

function refundUncalled(table) {
  const totals = table.players.map((player) => player.total);
  const sorted = [...totals].sort((a, b) => b - a);
  const top = sorted[0] || 0;
  const second = sorted[1] || 0;
  if (top <= second) return 0;
  const owners = table.players.filter((player) => player.total === top);
  if (owners.length !== 1) return 0;
  const owner = owners[0];
  const refund = top - second;
  owner.stack += refund;
  owner.total -= refund;
  table.pot -= refund;
  return refund;
}

function resetStreet(table, street) {
  table.street = street;
  table.currentBet = 0;
  table.lastRaiseSize = table.bigBlind;
  table.raisesThisStreet = 0;
  for (const player of table.players) {
    player.bet = 0;
    player.acted = false;
  }
}

function dealStreet(table, rng) {
  const burn = () => table.deck.pop();
  if (table.street === 'preflop') {
    burn();
    table.board.push(table.deck.pop(), table.deck.pop(), table.deck.pop());
    resetStreet(table, 'flop');
  } else if (table.street === 'flop') {
    burn();
    table.board.push(table.deck.pop());
    resetStreet(table, 'turn');
  } else if (table.street === 'turn') {
    burn();
    table.board.push(table.deck.pop());
    resetStreet(table, 'river');
  }
  table.turn = firstOpenFrom(table, table.dealer);
  // La rng no se usa: el mazo ya viene mezclado y persistido.
  void rng;
}

function resultWinner(table, index, amount, hand) {
  const player = table.players[index];
  player.stack += amount;
  return { index, name: player.name, amount, hand: hand || '', score: player.bestScore };
}

function finishFold(table) {
  refundUncalled(table);
  const winners = contenders(table);
  const winner = winners[0];
  const prize = table.pot;
  table.pot = 0;
  const entry = resultWinner(table, table.players.indexOf(winner), prize, '');
  table.result = {
    type: 'fold',
    pot: prize,
    totalPot: prize,
    winners: [entry],
    pots: [{ amount: prize, winners: [entry.index] }],
  };
  table.lastPot = prize;
  table.settled = true;
  table.turn = null;
}

function showdown(table) {
  refundUncalled(table);
  const totalPot = table.pot;
  const alive = table.players
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => !player.folded);

  for (const { player } of alive) {
    const best = bestHand([...player.hole, ...table.board]);
    player.bestScore = best.score;
    player.handName = best.name;
  }

  const levels = [...new Set(table.players.map((player) => player.total).filter((value) => value > 0))].sort(
    (a, b) => a - b,
  );

  const pots = [];
  let previous = 0;
  let potIndex = 0;

  for (const level of levels) {
    const layer = level - previous;
    let amount = 0;
    for (const player of table.players) {
      const contribution = Math.max(0, Math.min(player.total, level) - Math.min(player.total, previous));
      amount += contribution;
    }
    previous = level;
    if (amount <= 0) continue;

    const eligible = alive.filter(({ player }) => player.total >= level);
    if (!eligible.length) continue;

    let bestScore = eligible[0].player.bestScore;
    for (const { player } of eligible) {
      if (compareScores(player.bestScore, bestScore) > 0) bestScore = player.bestScore;
    }
    const winners = eligible.filter(({ player }) => compareScores(player.bestScore, bestScore) === 0);

    const share = Math.floor(amount / winners.length);
    let remainder = amount - share * winners.length;
    const ordered = [...winners].sort(
      (a, b) => ((a.index - table.dealer + table.players.length) % table.players.length) -
        ((b.index - table.dealer + table.players.length) % table.players.length),
    );

    const payouts = [];
    for (const { index } of ordered) {
      const extra = remainder > 0 ? 1 : 0;
      if (remainder > 0) remainder -= 1;
      const prize = share + extra;
      table.players[index].stack += prize;
      payouts.push({ index, name: table.players[index].name, amount: prize });
    }

    pots.push({ index: potIndex, amount, winners: payouts.map((entry) => entry.index), payouts });
    potIndex += 1;
  }

  const aggregate = new Map();
  for (const pot of pots) {
    for (const payout of pot.payouts) {
      const current = aggregate.get(payout.index) || {
        index: payout.index,
        name: payout.name,
        amount: 0,
        hand: table.players[payout.index].handName,
      };
      current.amount += payout.amount;
      aggregate.set(payout.index, current);
    }
  }

  table.pot = 0;
  table.lastPot = totalPot;
  table.result = {
    type: 'showdown',
    pot: totalPot,
    totalPot,
    winners: [...aggregate.values()],
    pots,
  };
  table.settled = true;
  table.turn = null;
  table.showdown = true;
}

/**
 * Cierra la calle si corresponde, reparte las siguientes y resuelve la mano.
 * Se llama después de cada acción (y al repartir).
 */
export function advance(table, rng = Math.random) {
  let guard = 0;
  while (!table.settled && guard < 12) {
    guard += 1;
    if (contenders(table).length <= 1) {
      finishFold(table);
      return table;
    }
    if (!bettingDone(table)) {
      // El turno ya lo dejó applyAction (o startHand).
      return table;
    }
    refundUncalled(table);
    if (table.street === 'river') {
      showdown(table);
      return table;
    }
    dealStreet(table, rng);
  }
  return table;
}

/* ---------- Bots ---------- */

function sampleWithoutReplacement(source, count, rng) {
  const copy = source.slice();
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const pick = Math.floor(rng() * copy.length);
    out.push(copy[pick]);
    copy[pick] = copy[copy.length - 1];
    copy.pop();
  }
  return out;
}

/**
 * Equidad por Monte Carlo: porcentaje de veces que la mano gana o empata
 * contra las manos desconocidas de los rivales que siguen en juego.
 */
export function equity(table, index, { sims = 120, rng = Math.random } = {}) {
  const player = table.players[index];
  const known = [...table.board, ...player.hole];
  const knownKey = new Set(known.map((card) => `${card.rank}-${card.suit}`));
  const remaining = makeDeck(rng).filter((card) => !knownKey.has(`${card.rank}-${card.suit}`));

  const rivals = contenders(table).filter((other) => other !== player);
  const missingBoard = 5 - table.board.length;
  let win = 0;
  let tie = 0;

  for (let sim = 0; sim < sims; sim += 1) {
    const drawn = sampleWithoutReplacement(remaining, missingBoard + rivals.length * 2, rng);
    const runout = drawn.slice(0, missingBoard);
    const board = [...table.board, ...runout];
    const mine = bestHand([...player.hole, ...board]).score;
    let best = mine;
    let ties = 1;
    let rivalIndex = missingBoard;
    for (let r = 0; r < rivals.length; r += 1) {
      const hole = [drawn[rivalIndex], drawn[rivalIndex + 1]];
      rivalIndex += 2;
      const theirs = bestHand([...hole, ...board]).score;
      const cmp = compareScores(theirs, best);
      if (cmp > 0) {
        best = theirs;
        ties = 0;
      } else if (cmp === 0) {
        ties += 1;
      }
    }
    if (ties === 1 && best === mine) win += 1;
    else if (best === mine) tie += 1;
  }

  return (win + tie / 2) / sims;
}

/* ---------- Lectura de la mesa ---------- */

const CHEN_HIGH = {
  14: 10,
  13: 8,
  12: 7,
  11: 6,
  10: 5,
  9: 4.5,
  8: 4,
  7: 3.5,
  6: 3,
  5: 2.5,
  4: 2,
  3: 1.5,
  2: 1,
};

/** Fuerza preflop normalizada (0-1), con bonus por posición. */
export function preflopScore(hole, position = 0.5) {
  if (!Array.isArray(hole) || hole.length < 2) return 0;
  const [high, low] = hole.map((card) => RANK_VALUE[card.rank]).sort((a, b) => b - a);
  const suited = hole[0].suit === hole[1].suit;
  let score;

  if (high === low) {
    score = 0.38 + high / 24;
  } else {
    let raw = CHEN_HIGH[high] || 1;
    if (suited) raw += 2;
    const gap = high - low;
    raw -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 3 : 4;
    if (gap <= 1 && high < 12) raw += 1;
    if (high >= 10 && low >= 10) raw += 2;
    if (high === 14 && suited) raw += 1;
    score = (raw + 4) / 24;
  }

  return clamp(score + (position - 0.5) * 0.06, 0, 1);
}

/** Posición relativa: 1 es el botón, 0.4 la ciega grande en una mesa de 4. */
export function positionScore(table, index) {
  const count = table.players.length;
  if (!count) return 0.5;
  const relative = (index - table.dealer + count) % count;
  if (count === 2) return relative === 0 ? 0.65 : 0.45;
  if (count === 4) {
    if (relative === 0) return 1;
    if (relative === 3) return 0.78;
    if (relative === 1) return 0.55;
    return 0.4;
  }
  return 1 - relative / count;
}

/** Textura del board: seco/húmedo, pareado, color posible y conectado. */
export function boardTexture(board) {
  if (!Array.isArray(board) || board.length === 0) {
    return { wet: 0, dry: 1, paired: false, flushy: false, connected: false, high: 0, maxSuit: 0 };
  }

  const suitCounts = new Map();
  const rankCounts = new Map();
  for (const card of board) {
    suitCounts.set(card.suit, (suitCounts.get(card.suit) || 0) + 1);
    const value = RANK_VALUE[card.rank];
    rankCounts.set(value, (rankCounts.get(value) || 0) + 1);
  }

  const maxSuit = Math.max(...suitCounts.values());
  const ranks = [...rankCounts.keys()].sort((a, b) => b - a);
  const paired = [...rankCounts.values()].some((count) => count >= 2);
  let connected = false;
  for (let i = 0; i + 2 < ranks.length; i += 1) {
    if (ranks[i] - ranks[i + 2] <= 4) connected = true;
  }

  const high = ranks[0] || 0;
  const flushy = maxSuit >= 3;
  const wet = clamp(
    (flushy ? 0.28 : 0) +
      (connected ? 0.22 : 0) +
      (paired ? 0.14 : 0) +
      (high >= 12 ? 0.08 : 0),
    0,
    0.9,
  );

  return { wet, dry: 1 - wet, paired, flushy, connected, high, maxSuit };
}

/** Proyectos de la mano propia: color, escalera, overcards y outs aproximados. */
export function drawInfo(hole, board) {
  const empty = {
    flushDraw: false,
    backdoorFlush: false,
    oesd: false,
    gutshot: false,
    overcards: 0,
    combo: false,
    outs: 0,
    made: 0,
  };
  if (!Array.isArray(hole) || hole.length < 2) return empty;
  if (!Array.isArray(board) || board.length < 3) return empty;

  const all = [...hole, ...board];
  const suitCounts = new Map();
  const holeSuits = new Map();
  for (const card of all) suitCounts.set(card.suit, (suitCounts.get(card.suit) || 0) + 1);
  for (const card of hole) holeSuits.set(card.suit, (holeSuits.get(card.suit) || 0) + 1);

  let flushDraw = false;
  for (const [suit, count] of suitCounts) {
    if (count === 4 && (holeSuits.get(suit) || 0) >= 1) flushDraw = true;
  }

  const boardSuits = new Map();
  for (const card of board) boardSuits.set(card.suit, (boardSuits.get(card.suit) || 0) + 1);
  const boardFlush = [...boardSuits.entries()].find(([, count]) => count >= 3);
  const backdoorFlush =
    board.length === 3 &&
    Boolean(boardFlush) &&
    (holeSuits.get(boardFlush[0]) || 0) >= 1 &&
    !flushDraw;

  const made = bestHand(all).score[0];
  const rankSet = new Set(all.map((card) => RANK_VALUE[card.rank]));
  const missing = new Set();
  if (made < 4) {
    for (let low = 1; low <= 10; low += 1) {
      const window = [low, low + 1, low + 2, low + 3, low + 4];
      const present = window.filter((value) => rankSet.has(value) || (value === 1 && rankSet.has(14)));
      if (present.length === 4) {
        const missingValue = window.find((value) => !present.includes(value));
        missing.add(missingValue === 1 ? 14 : missingValue);
      }
    }
  }

  const oesd = missing.size >= 2;
  const gutshot = missing.size === 1;
  const boardHigh = Math.max(...board.map((card) => RANK_VALUE[card.rank]));
  const overcards = hole.filter((card) => RANK_VALUE[card.rank] > boardHigh).length;
  const combo = flushDraw && (oesd || gutshot);

  let outs = 0;
  if (flushDraw) outs += 9;
  if (oesd) outs += 8;
  else if (gutshot) outs += 4;
  outs += overcards * 3;
  if (backdoorFlush) outs += 1;

  return {
    flushDraw,
    backdoorFlush,
    oesd,
    gutshot,
    overcards,
    combo,
    outs: Math.min(outs, 15),
    made,
  };
}

/* ---------- Charla de los bots ---------- */

export const BOT_TALK = {
  value: ['Buena mano', 'Esto se paga', 'Voy con todo', 'Te tengo'],
  bluff: ['Tengo el color', 'Te tengo', 'No te emociones', 'Esta mesa es mía'],
  semiBluff: ['Me falta una', 'Voy por el proyecto', 'Todavía la pego'],
  draw: ['Pago para ver', 'Me sirve el precio', 'Vamos a ver'],
  weak: ['No me da', 'Me voy', 'Guarda que vuelvo', 'Paso'],
};

const TALK_TONES = Object.keys(BOT_TALK);

/**
 * Elige una frase corta. No siempre coincide con la intención real: a veces
 * el bot miente para que no se le pueda leer la mano.
 */
export function pickBotLine(intent = 'weak', rng = Math.random) {
  const key =
    rng() < 0.62 && BOT_TALK[intent]
      ? intent
      : TALK_TONES[Math.floor(rng() * TALK_TONES.length)];
  const lines = BOT_TALK[key];
  return {
    text: lines[Math.floor(rng() * lines.length)],
    tone: key,
  };
}

/* ---------- Decisiones ---------- */

function preflopTarget(table, legal, { threeBet = false, rng = Math.random } = {}) {
  const quantum = Math.max(1, table.smallBlind || SB);
  let target;
  if (threeBet) {
    target = table.currentBet * (2.6 + rng() * 0.5);
  } else {
    const limpers = Math.max(
      0,
      table.players.filter(
        (player) =>
          !player.folded &&
          player.bet >= table.bigBlind &&
          player.bet <= table.currentBet,
      ).length - 1,
    );
    target = table.bigBlind * (2.5 + rng() * 0.8) + limpers * table.bigBlind;
  }
  target = Math.round(target / quantum) * quantum;
  return Math.max(legal.raise.min, Math.min(legal.raise.max, target));
}

function betAmount(table, legal, fraction, strong = false) {
  const quantum = Math.max(1, table.smallBlind || SB);
  const potAfterCall = table.pot + legal.toCall;
  let target = table.currentBet + potAfterCall * fraction;
  target = Math.round(target / quantum) * quantum;
  target = Math.max(legal.raise.min, Math.min(legal.raise.max, target));

  // Fuera de una mano fuerte no nos mandamos all-in sin querer.
  if (!strong && target > legal.raise.max * 0.82) {
    target = Math.max(legal.raise.min, Math.round((legal.raise.max * 0.55) / quantum) * quantum);
  }
  return target;
}

function preflopAction(table, index, { legal, traits, chance, position, rng }) {
  const player = table.players[index];
  const chen = preflopScore(player.hole, position);
  const score = clamp(chen * 0.85 + chance * 0.15, 0, 1);
  const toCall = legal.toCall;
  const raised = table.currentBet > table.bigBlind;
  const raises = table.raisesThisStreet || 0;
  const canRaise = Boolean(legal.raise);
  const cheap = toCall > 0 && toCall <= table.bigBlind * 1.5;
  const openLine =
    0.6 + traits.tightness * 0.25 - traits.aggression * 0.08 - (position - 0.5) * 0.16;
  const callLine = openLine - 0.13;
  const threeBetLine = 0.72 + traits.tightness * 0.1 - traits.aggression * 0.05;
  const mistake = rng() < traits.mistake;

  if (!raised) {
    if (canRaise && score >= openLine) {
      return { type: 'raise', amount: preflopTarget(table, legal, { rng }), intent: 'value' };
    }
    if (
      canRaise &&
      position > 0.72 &&
      raises === 0 &&
      score >= 0.32 &&
      rng() < (0.35 + traits.aggression * 0.25) * traits.bluffFactor
    ) {
      return { type: 'raise', amount: preflopTarget(table, legal, { rng }), intent: 'bluff' };
    }
    if (toCall === 0) return { type: 'check', intent: 'weak' };
    if (score >= callLine || (cheap && (chen >= 0.25 || score >= 0.3))) {
      return { type: 'call', intent: score >= 0.55 ? 'value' : 'draw' };
    }
    if (mistake) return { type: 'call', intent: 'weak' };
    return { type: 'fold', intent: 'weak' };
  }

  if (raises >= 2 && score < 0.78) return { type: 'fold', intent: 'weak' };
  if (canRaise && raises < 2 && score >= threeBetLine) {
    return {
      type: 'raise',
      amount: preflopTarget(table, legal, { threeBet: true, rng }),
      intent: 'value',
    };
  }
  if (score >= threeBetLine - 0.12 && toCall <= player.stack * 0.12) {
    return { type: 'call', intent: 'value' };
  }
  if (
    canRaise &&
    position > 0.7 &&
    raises === 1 &&
    score < callLine &&
    rng() < traits.bluff * 0.8
  ) {
    return {
      type: 'raise',
      amount: preflopTarget(table, legal, { threeBet: true, rng }),
      intent: 'bluff',
    };
  }
  if (cheap && chen >= 0.35 && toCall <= player.stack * 0.08) {
    return { type: 'call', intent: 'draw' };
  }
  if (score >= callLine - 0.04 && toCall <= player.stack * 0.1) {
    return { type: 'call', intent: 'value' };
  }
  if (mistake) return { type: 'call', intent: 'weak' };
  return { type: 'fold', intent: 'weak' };
}

export function botAction(
  table,
  index,
  {
    rng = Math.random,
    profile = 'balanced',
    level = 'normal',
    bluff = 'normal',
    sims = 120,
  } = {},
) {
  const legal = legalActions(table, index);
  if (!legal) return { type: 'check' };
  const traits = resolveTraits(profile, level, bluff);

  if (!legal.raise && legal.toCall === 0) return { type: 'check' };
  if (!legal.raise) return { type: 'call' };

  const player = table.players[index];
  const chance = equity(table, index, { sims, rng });
  const rivals = Math.max(1, contenders(table).length - 1);
  const position = positionScore(table, index);
  const texture = boardTexture(table.board);
  const draw = drawInfo(player.hole, table.board);
  const toCall = legal.toCall;
  const potOdds = toCall > 0 ? toCall / (table.pot + toCall) : 0;
  const cheap = toCall > 0 && toCall <= table.bigBlind;
  const canRaise = Boolean(legal.raise);

  if (table.street === 'preflop') {
    return preflopAction(table, index, { legal, traits, chance, position, rng });
  }

  // El tiro de error siempre consume RNG: así dos niveles con la misma semilla
  // parten de la misma secuencia y la comparación es justa.
  const mistake = rng() < traits.mistake;
  const foldLine =
    potOdds +
    traits.callMargin +
    traits.tightness * 0.5 -
    traits.aggression * 0.03 +
    (rivals - 1) * 0.015;
  const strongLine =
    0.62 + (rivals - 1) * 0.04 + traits.tightness * 0.1 - traits.aggression * 0.03;
  const monsterLine = 0.82 + (rivals - 1) * 0.02;
  const isMonster = chance >= monsterLine || draw.made >= 6;
  const isStrong = chance >= strongLine || draw.made >= 4;
  const isMedium = chance >= 0.42;
  const isAir = !isMedium && draw.outs === 0;

  if (toCall > 0) {
    if ((table.raisesThisStreet || 0) >= 2 && chance < 0.78 && draw.outs < 8) {
      return { type: 'fold', intent: 'weak' };
    }

    if (chance < foldLine) {
      const implied = draw.outs >= 8 ? 0.1 : draw.outs >= 4 ? 0.05 : 0;
      const canDraw =
        draw.outs >= 8 && table.street !== 'river' && toCall <= player.stack * 0.28;
      if (canDraw && chance + implied >= foldLine - 0.05 && rng() < 0.7) {
        return { type: 'call', intent: 'draw' };
      }
      if (cheap && chance > 0.24) return { type: 'call', intent: 'weak' };
      if (
        canRaise &&
        rivals === 1 &&
        texture.dry > 0.6 &&
        rng() < traits.bluff * 0.45
      ) {
        return { type: 'raise', amount: betAmount(table, legal, 0.5), intent: 'bluff' };
      }
      if (mistake) return { type: 'call', intent: 'weak' };
      return { type: 'fold', intent: 'weak' };
    }

    if (isMonster) {
      if (rng() < traits.trap && table.street !== 'river') {
        return { type: 'call', intent: 'value' };
      }
      return {
        type: 'raise',
        amount: betAmount(table, legal, 0.85 + rng() * 0.2, true),
        intent: 'value',
      };
    }
    if (isStrong) {
      if (rng() < 0.55 + traits.aggression * 0.25) {
        return {
          type: 'raise',
          amount: betAmount(table, legal, 0.65 + rng() * 0.2, true),
          intent: 'value',
        };
      }
      return { type: 'call', intent: 'value' };
    }
    if (isMedium) {
      if (
        canRaise &&
        rivals === 1 &&
        texture.dry > 0.55 &&
        rng() < traits.bluff * 0.35
      ) {
        return { type: 'raise', amount: betAmount(table, legal, 0.5), intent: 'bluff' };
      }
      return { type: 'call', intent: 'value' };
    }
    if (draw.outs >= 4) {
      if (canRaise && table.street !== 'river' && rng() < traits.semiBluff * 0.3) {
        return {
          type: 'raise',
          amount: betAmount(table, legal, 0.55),
          intent: 'semiBluff',
        };
      }
      if (chance + 0.08 >= foldLine || toCall <= table.pot * 0.25) {
        return { type: 'call', intent: 'draw' };
      }
    }
    return { type: 'call', intent: 'value' };
  }

  if (isMonster) {
    if (rng() < traits.trap && table.street !== 'river') {
      return { type: 'check', intent: 'value' };
    }
    return {
      type: 'raise',
      amount: betAmount(table, legal, 0.7 + rng() * 0.2, true),
      intent: 'value',
    };
  }
  if (isStrong) {
    return {
      type: 'raise',
      amount: betAmount(table, legal, 0.55 + rng() * 0.2, true),
      intent: 'value',
    };
  }
  if (isMedium) {
    if (texture.wet > 0.5 && rng() < 0.3) {
      return { type: 'raise', amount: betAmount(table, legal, 0.33), intent: 'value' };
    }
    return { type: 'check', intent: 'value' };
  }
  if (draw.outs >= 4) {
    const semi = traits.semiBluff * (table.street === 'flop' ? 1 : 0.8);
    if (rng() < semi) {
      return {
        type: 'raise',
        amount: betAmount(table, legal, 0.5 + rng() * 0.15),
        intent: 'semiBluff',
      };
    }
    return { type: 'check', intent: 'draw' };
  }
  if (isAir) {
    const canBluff =
      rivals === 1 &&
      texture.dry > 0.55 &&
      position > 0.45 &&
      table.street !== 'river';
    const barrel = player.bluffing && table.lastAggressor === index;
    const bluffChance = traits.bluff * (canBluff ? 1 : 0.15) * (barrel ? 1.25 : 1);
    if (rng() < bluffChance) {
      return {
        type: 'raise',
        amount: betAmount(table, legal, 0.45 + rng() * 0.15),
        intent: 'bluff',
      };
    }
  }

  return { type: 'check', intent: 'weak' };
}

/* ---------- Migración de mesas guardadas ---------- */

/** Completa los campos públicos que agregaron los bots en v2.5. */
export function normalizeTable(table) {
  if (!table || !Array.isArray(table.players)) return table;
  if (table.lastAggressor === undefined) table.lastAggressor = null;
  if (!Number.isFinite(table.raisesThisStreet)) table.raisesThisStreet = 0;
  for (const player of table.players) {
    if (!player) continue;
    if (!Number.isFinite(player.raises)) player.raises = 0;
    if (typeof player.lastAction !== 'string') player.lastAction = '';
    if (typeof player.bluffing !== 'boolean') player.bluffing = false;
  }
  return table;
}
