// Motor de póker (Texas Hold'em simplificado para una mesa de 4).
// Sin DOM y sin estado global: todo se puede testear con Node.
//
// Dinero: el motor trabaja con stacks de la mesa. El controlador decide
// cuánto poner en riesgo por mano y aplica el neto al saldo al terminar.

import { createShoe, shuffle } from './engine.js';

export const SB = 5;
export const BB = 10;
export const TABLE_CAP = 300;
export const START_STACK = 300;

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
  tight: { aggression: 0.32, tightness: 0.14, bluff: 0.025 },
  balanced: { aggression: 0.52, tightness: 0.04, bluff: 0.06 },
  aggro: { aggression: 0.78, tightness: -0.05, bluff: 0.12 },
};

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

const COMBOS_7 = (() => {
  const out = [];
  for (let a = 0; a < 7; a += 1) {
    for (let b = a + 1; b < 7; b += 1) {
      for (let c = b + 1; c < 7; c += 1) {
        for (let d = c + 1; d < 7; d += 1) {
          for (let e = d + 1; e < 7; e += 1) out.push([a, b, c, d, e]);
        }
      }
    }
  }
  return out;
})();

/** Mejor mano de 5 entre las 7 disponibles. Devuelve el puntaje y las cartas. */
export function bestHand(cards) {
  if (cards.length < 5) return { score: [0, 0], cards: cards.slice(), name: CATEGORY_NAMES[0] };
  let best = null;
  let bestCards = null;
  const source = cards.slice(0, 7);
  for (const combo of COMBOS_7) {
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
  table.street = 'preflop';

  for (const player of table.players) {
    player.stack = table.startStack;
    player.hole = [];
    player.folded = false;
    player.allIn = false;
    player.bet = 0;
    player.total = 0;
    player.acted = false;
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
  if (type === 'fold') {
    table.players[index].folded = true;
    table.players[index].acted = true;
  } else if (type === 'check') {
    if (!legal.check) return { ok: false, error: 'cannot-check' };
    table.players[index].acted = true;
  } else if (type === 'call') {
    if (legal.toCall === 0) {
      table.players[index].acted = true;
    } else {
      resolveCall(table, index);
    }
  } else if (type === 'raise') {
    resolveRaise(table, index, action.amount, legal);
  } else if (type === 'allin') {
    const player = table.players[index];
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
    } else {
      resolveCall(table, index);
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

export function botAction(table, index, { rng = Math.random, profile = 'balanced', sims = 120 } = {}) {
  const legal = legalActions(table, index);
  if (!legal) return { type: 'check' };
  const traits = BOT_PROFILES[profile] || BOT_PROFILES.balanced;

  if (!legal.raise && legal.toCall === 0) return { type: 'check' };
  if (!legal.raise) return { type: 'call' };

  const chance = equity(table, index, { sims, rng });
  const pot = table.pot;
  const potOdds = legal.toCall > 0 ? legal.toCall / (pot + legal.toCall) : 0;
  const foldLine = potOdds + 0.06 + traits.tightness - traits.aggression * 0.04;

  if (legal.toCall > 0 && chance < foldLine) {
    const cheap = legal.toCall <= table.bigBlind && chance > 0.24;
    if (!cheap) return { type: 'fold' };
  }

  const wantsRaise = chance > 0.66 + traits.tightness - traits.aggression * 0.1 || rng() < traits.bluff;
  if (wantsRaise) {
    const base = Math.max(table.bigBlind, Math.round(pot * (0.4 + rng() * 0.5)));
    const target = Math.min(legal.raise.max, Math.max(legal.raise.min, table.currentBet + base));
    const committed = target === legal.raise.max && target > table.currentBet;
    if (!committed || chance > 0.72 || rng() < 0.2) {
      return { type: 'raise', amount: target };
    }
  }

  if (legal.toCall > 0) return { type: 'call' };
  return { type: 'check' };
}
