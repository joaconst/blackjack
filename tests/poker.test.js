import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BB,
  BIG_BLINDS,
  BOT_BLUFF_LEVELS,
  BOT_LEVELS,
  DEFAULT_BUY_IN,
  MIN_BIG_BLIND,
  MIN_BUY_IN_BLINDS,
  SB,
  START_STACK,
  SUGGESTED_BUY_IN_BLINDS,
  applyAction,
  advance,
  bestHand,
  blindOptions,
  boardTexture,
  botAction,
  clampBuyIn,
  clampRaiseTarget,
  compareScores,
  createTable,
  customBigBlind,
  drawInfo,
  equity,
  evaluate5,
  legalActions,
  maxBigBlind,
  normalizeBigBlind,
  normalizeBluffLevel,
  normalizeBotLevel,
  normalizeTable,
  pickBotLine,
  positionScore,
  preflopScore,
  raiseOptions,
  resolveTraits,
  startHand,
  stepRaiseTarget,
  suggestedBuyIn,
} from '../js/games/poker/engine.js';

/* ---------- Utilidades ---------- */

const SUITS = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };

function card(code) {
  const suit = SUITS[code[1]];
  const raw = code.slice(0, -1);
  return { rank: raw === 'T' ? '10' : raw, suit };
}

function hand(codes) {
  return codes.split(' ').map(card);
}

function seededRng(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function tableWith({ stacks, dealer = 0 } = {}) {
  const table = createTable({ stack: START_STACK, dealer });
  const rng = seededRng(99);
  startHand(table, rng);
  if (stacks) {
    stacks.forEach((stack, index) => {
      table.players[index].stack = stack;
    });
  }
  return table;
}

/** Mesa armada a mano para probar una decisión concreta del bot. */
function botSpot({
  hole = 'AC AD',
  board = 'AS KH 7D',
  pot = 30,
  currentBet = 0,
  bet = 0,
  stack = START_STACK,
  turn = 1,
  dealer = 0,
  folded = [false, false, false, false],
  raisesThisStreet = 0,
  lastAggressor = null,
  bluffing = false,
} = {}) {
  const table = createTable({ dealer });
  startHand(table, seededRng(7));
  const boardCards = board ? hand(board) : [];
  table.board = boardCards;
  table.street = boardCards.length === 0
    ? 'preflop'
    : boardCards.length === 3
      ? 'flop'
      : boardCards.length === 4
        ? 'turn'
        : 'river';
  table.pot = pot;
  table.currentBet = currentBet;
  table.lastRaiseSize = BB;
  table.raisesThisStreet = raisesThisStreet;
  table.lastAggressor = lastAggressor;
  table.turn = turn;
  table.settled = false;

  table.players.forEach((player, index) => {
    player.hole = index === turn ? hand(hole) : hand('2C 3D');
    player.folded = Boolean(folded[index]);
    player.allIn = false;
    player.bet = index === turn ? bet : currentBet;
    player.stack = stack;
    player.acted = false;
    player.raises = 0;
    player.bluffing = index === turn ? bluffing : false;
  });

  return table;
}

/* ---------- Evaluador ---------- */

test('evalúa escalera real como escalera de color', () => {
  const score = evaluate5(hand('AS KS QS JS TS'));
  assert.equal(score[0], 8);
  assert.equal(score[1], 14);
});

test('evalúa escalera al as (A-2-3-4-5) con cinco alta', () => {
  const score = evaluate5(hand('AS 2H 3D 4C 5S'));
  assert.equal(score[0], 4);
  assert.equal(score[1], 5);
});

test('el póker desempata por la carta suelta', () => {
  const high = evaluate5(hand('9S 9H 9D 9C AS'));
  const low = evaluate5(hand('9S 9H 9D 9C KS'));
  assert.equal(high[0], 7);
  assert.equal(compareScores(high, low), 1);
});

test('full house desempata primero por el trío', () => {
  const aces = evaluate5(hand('AS AH AD 2C 2S'));
  const kings = evaluate5(hand('KS KH KD AC AS'));
  assert.equal(aces[0], 6);
  assert.equal(compareScores(aces, kings), 1);
});

test('color le gana a escalera', () => {
  const flush = evaluate5(hand('AS JS 8S 4S 2S'));
  const straight = evaluate5(hand('9S 8H 7D 6C 5S'));
  assert.equal(flush[0], 5);
  assert.equal(straight[0], 4);
  assert.equal(compareScores(flush, straight), 1);
});

test('doble par desempata por el kicker', () => {
  const aceKicker = evaluate5(hand('JS JH 4D 4C AS'));
  const kingKicker = evaluate5(hand('JS JH 4D 4C KS'));
  assert.equal(compareScores(aceKicker, kingKicker), 1);
});

test('par de ases le gana a par de reyes', () => {
  const aces = evaluate5(hand('AS AH 9D 6C 2S'));
  const kings = evaluate5(hand('KS KH AD 6C 2S'));
  assert.equal(compareScores(aces, kings), 1);
});

test('cartas altas se comparan de mayor a menor', () => {
  const a = evaluate5(hand('AS QH 9D 6C 2S'));
  const b = evaluate5(hand('KS QH 9D 6C 2S'));
  assert.equal(compareScores(a, b), 1);
});

test('mejor mano de 7 elige el color antes que la escalera', () => {
  const best = bestHand(hand('AS 2S 5S 9S KS QH JD'));
  assert.equal(best.score[0], 5);
  assert.equal(best.name, 'Color');
});

test('mejor mano de 7 encuentra el full entre las combinaciones', () => {
  const best = bestHand(hand('9S 9H 9D 4C 4S 2H 7D'));
  assert.equal(best.score[0], 6);
  assert.equal(best.name, 'Full');
});

test('escalera de color en 7 cartas', () => {
  const best = bestHand(hand('5H 6H 7H 8H 9H AS 2C'));
  assert.equal(best.score[0], 8);
  assert.equal(best.score[1], 9);
});

/* ---------- Apuestas ---------- */

test('reparte ciegas y arranca por el jugador después de la ciega grande', () => {
  const table = createTable({ dealer: 0 });
  startHand(table, seededRng(7));
  assert.equal(table.players[1].bet, SB);
  assert.equal(table.players[2].bet, BB);
  assert.equal(table.currentBet, BB);
  assert.equal(table.turn, 3);
  assert.equal(table.pot, SB + BB);
  assert.equal(table.players.every((player) => player.hole.length === 2), true);
});

test('legalActions calcula igualar y la subida mínima', () => {
  const table = createTable({ dealer: 0 });
  startHand(table, seededRng(8));
  const legal = legalActions(table, 3);
  assert.equal(legal.toCall, BB);
  assert.equal(legal.call, BB);
  assert.equal(legal.check, false);
  assert.equal(legal.raise.min, BB * 2);
  assert.equal(legal.raise.max, START_STACK);
});

test('raiseOptions arma presets claros dentro del rango legal', () => {
  const table = createTable({ dealer: 0 });
  startHand(table, seededRng(8));
  const options = raiseOptions(table, 3);
  assert.equal(options.raise.min, 20);
  assert.equal(options.raise.max, START_STACK);
  assert.equal(options.toCall, 10);
  assert.deepEqual(
    options.presets.map((preset) => preset.id),
    ['min', 'half', 'pot', 'allin'],
  );
  assert.deepEqual(
    options.presets.map((preset) => preset.amount),
    [20, 25, 35, START_STACK],
  );
  assert.equal(options.presets.every((preset) => preset.amount >= 20 && preset.amount <= START_STACK), true);
});

test('raiseOptions no repite montos y prioriza el all-in', () => {
  const table = createTable({ dealer: 0 });
  startHand(table, seededRng(8));
  table.players[3].stack = 35;
  const options = raiseOptions(table, 3);
  assert.equal(options.raise.max, 35);
  assert.deepEqual(
    options.presets.map((preset) => preset.label),
    ['Mínima', '½ pozo', 'All in'],
  );
  assert.equal(options.presets.at(-1).amount, 35);
});

test('raiseOptions devuelve null cuando no es el turno', () => {
  const table = createTable({ dealer: 0 });
  startHand(table, seededRng(8));
  assert.equal(raiseOptions(table, 0), null);
});

test('clampRaiseTarget respeta el mínimo y el máximo', () => {
  const table = createTable({ dealer: 0 });
  startHand(table, seededRng(8));
  assert.equal(clampRaiseTarget(table, 3, 2), 20);
  assert.equal(clampRaiseTarget(table, 3, 70), 70);
  assert.equal(clampRaiseTarget(table, 3, 999), START_STACK);
});

test('stepRaiseTarget avanza de a una ciega chica y no se pasa', () => {
  const table = createTable({ dealer: 0 });
  startHand(table, seededRng(8));
  assert.equal(stepRaiseTarget(table, 3, 20, 2), 30);
  assert.equal(stepRaiseTarget(table, 3, 20, -1), 20);
  assert.equal(stepRaiseTarget(table, 3, 298, 1), START_STACK);
  assert.equal(stepRaiseTarget(table, 3, START_STACK, 1), START_STACK);
});

test('no se puede cantar check con una apuesta pendiente', () => {
  const table = createTable({ dealer: 0 });
  startHand(table, seededRng(9));
  const result = applyAction(table, 3, { type: 'check' });
  assert.equal(result.ok, false);
});

test('la subida mínima después de una subida respeta el último aumento', () => {
  const table = createTable({ dealer: 0 });
  startHand(table, seededRng(10));
  assert.equal(applyAction(table, 3, { type: 'raise', amount: 30 }).ok, true);
  assert.equal(table.currentBet, 30);
  const legal = legalActions(table, 0);
  assert.equal(legal.raise.min, 50);
});

test('cuando todos igualan y la ciega grande no habla, no cierra la calle', () => {
  const table = createTable({ dealer: 0 });
  startHand(table, seededRng(11));
  applyAction(table, 3, { type: 'call' });
  applyAction(table, 0, { type: 'call' });
  applyAction(table, 1, { type: 'call' });
  advance(table);
  assert.equal(table.street, 'preflop');
  assert.equal(table.turn, 2);
});

test('la calle cierra con el check de la ciega grande y reparte el flop', () => {
  const table = createTable({ dealer: 0 });
  startHand(table, seededRng(12));
  applyAction(table, 3, { type: 'call' });
  applyAction(table, 0, { type: 'call' });
  applyAction(table, 1, { type: 'call' });
  applyAction(table, 2, { type: 'check' });
  advance(table);
  assert.equal(table.street, 'flop');
  assert.equal(table.board.length, 3);
  assert.equal(table.pot, BB * 4);
  assert.equal(table.turn, 1);
  assert.equal(table.players.every((player) => player.bet === 0), true);
});

test('si todos se retiran, la ciega grande gana lo apostado', () => {
  const table = createTable({ dealer: 0 });
  startHand(table, seededRng(13));
  applyAction(table, 3, { type: 'fold' });
  applyAction(table, 0, { type: 'fold' });
  applyAction(table, 1, { type: 'fold' });
  advance(table);
  assert.equal(table.settled, true);
  assert.equal(table.result.type, 'fold');
  assert.equal(table.result.winners[0].index, 2);
  assert.equal(table.players[2].stack, START_STACK + SB);
});

test('reparte un bote lateral cuando hay all-ins de distinto tamaño', () => {
  const table = createTable({ dealer: 0 });
  startHand(table, seededRng(14));
  table.street = 'river';
  table.board = hand('2C 7D 9H JS QD');
  table.players[0].hole = hand('KS KH');
  table.players[1].hole = hand('8S 8H');
  table.players[2].hole = hand('AS AH');
  table.players[3].hole = hand('KC KD');
  table.players[3].folded = true;
  table.players[0].total = 100;
  table.players[1].total = 200;
  table.players[2].total = 50;
  table.players[3].total = 50;
  table.players.forEach((player, index) => {
    player.stack = 0;
    player.allIn = index !== 3;
    player.bet = 0;
  });
  table.pot = 400;
  table.settled = false;

  advance(table);

  assert.equal(table.settled, true);
  assert.equal(table.result.type, 'showdown');
  // El short stack tiene el mejor hand: se lleva el bote principal de 200.
  assert.equal(table.players[2].stack, 200);
  // El segundo mejor se lleva el lateral de 100 y el tercero recupera lo no igualado.
  assert.equal(table.players[0].stack, 100);
  assert.equal(table.players[1].stack, 100);
  assert.equal(table.result.totalPot, 300);
});

test('devuelve la apuesta no igualada antes de pagar', () => {
  const table = createTable({ dealer: 0 });
  startHand(table, seededRng(15));
  applyAction(table, 3, { type: 'raise', amount: 300 });
  applyAction(table, 0, { type: 'fold' });
  applyAction(table, 1, { type: 'fold' });
  applyAction(table, 2, { type: 'fold' });
  advance(table);
  assert.equal(table.settled, true);
  assert.equal(table.result.type, 'fold');
  assert.equal(table.players[3].stack, START_STACK + SB + BB);
});

test('el bote se reparte cuando hay empate exacto', () => {
  const table = createTable({ dealer: 0 });
  startHand(table, seededRng(16));
  table.street = 'river';
  table.board = hand('2C 7D 9H JS QD');
  table.players[0].hole = hand('AS AH');
  table.players[1].hole = hand('AD AC');
  table.players[2].folded = true;
  table.players[3].folded = true;
  table.players[0].total = 40;
  table.players[1].total = 40;
  table.players[2].total = 20;
  table.players[3].total = 20;
  table.players.forEach((player) => {
    player.stack = 0;
    player.allIn = true;
    player.bet = 0;
  });
  table.pot = 120;
  table.settled = false;

  advance(table);
  assert.equal(table.result.type, 'showdown');
  assert.equal(table.players[0].stack + table.players[1].stack, 120);
});

/* ---------- Bots ---------- */

test('la equidad de una mano fuerte supera a la de una mano débil', () => {
  const table = createTable({ dealer: 0 });
  startHand(table, seededRng(17));
  table.board = hand('AS KH 7D');
  table.players[0].hole = hand('AC AD');
  table.players[1].hole = hand('2C 3D');
  table.players[2].folded = true;
  table.players[3].folded = true;
  const strong = equity(table, 0, { sims: 120, rng: seededRng(18) });
  const weak = equity(table, 1, { sims: 120, rng: seededRng(19) });
  assert.ok(strong > 0.85, `equidad fuerte: ${strong}`);
  assert.ok(weak < 0.15, `equidad débil: ${weak}`);
});

test('los bots juegan manos completas sin romper y conservan las fichas', () => {
  const total = START_STACK * 4;
  for (let seed = 1; seed <= 25; seed += 1) {
    const rng = seededRng(seed * 97);
    const table = createTable({ dealer: seed % 4 });
    startHand(table, rng);
    let guard = 0;
    while (!table.settled && guard < 80) {
      guard += 1;
      const index = table.turn;
      if (index === null) {
        advance(table, rng);
        continue;
      }
      const action = botAction(table, index, {
        rng,
        sims: 25,
        profile: ['tight', 'balanced', 'aggro'][index % 3],
      });
      const result = applyAction(table, index, action);
      assert.equal(result.ok, true, `seed ${seed}: acción inválida ${action.type}`);
      advance(table, rng);
    }
    assert.equal(table.settled, true, `seed ${seed}: la mano no cerró`);
    const chips = table.players.reduce((sum, player) => sum + player.stack, 0);
    assert.equal(chips, total, `seed ${seed}: fichas perdidas`);
    assert.equal(table.pot, 0);
    assert.equal(table.players.every((player) => player.stack >= 0), true);
  }
});

test('la textura del board distingue seco, húmedo y pareado', () => {
  const dry = boardTexture(hand('AS 7D 2C'));
  const wet = boardTexture(hand('9S 8S 7S'));
  const paired = boardTexture(hand('KS KD 4C'));

  assert.ok(dry.dry > 0.6, `seco: ${dry.dry}`);
  assert.ok(wet.wet > dry.wet, `${wet.wet} vs ${dry.wet}`);
  assert.equal(wet.flushy || wet.connected, true);
  assert.equal(paired.paired, true);
});

test('los proyectos detectan color, escalera abierta y gutshot', () => {
  const flush = drawInfo(hand('AS KS'), hand('QS 7S 2D'));
  assert.equal(flush.flushDraw, true);
  assert.ok(flush.outs >= 9, `outs color: ${flush.outs}`);

  const oesd = drawInfo(hand('9C 8D'), hand('7S 6H 2C'));
  assert.equal(oesd.oesd, true);
  assert.ok(oesd.outs >= 8, `outs escalera: ${oesd.outs}`);

  const gutshot = drawInfo(hand('9C 6D'), hand('7S 5H 2C'));
  assert.equal(gutshot.gutshot, true);
  assert.equal(gutshot.oesd, false);

  const overcards = drawInfo(hand('AC KD'), hand('9S 7H 2C'));
  assert.equal(overcards.overcards, 2);

  const madeFlush = drawInfo(hand('AS KS'), hand('QS JS 2S'));
  assert.equal(madeFlush.flushDraw, false);
  assert.ok(madeFlush.made >= 5, `mano hecha: ${madeFlush.made}`);
});

test('la fuerza preflop ordena las manos y premia la posición', () => {
  const aces = preflopScore(hand('AS AH'), 0.5);
  const kings = preflopScore(hand('KS KH'), 0.5);
  const junk = preflopScore(hand('7S 2D'), 0.5);

  assert.ok(aces > kings && kings > junk, `${aces} / ${kings} / ${junk}`);
  assert.ok(preflopScore(hand('AS KS'), 0.5) > preflopScore(hand('AS KD'), 0.5));
  assert.ok(preflopScore(hand('AS KS'), 1) > preflopScore(hand('AS KS'), 0.4));
  assert.equal(positionScore(createTable({ dealer: 0 }), 0), 1);
});

test('los niveles y perfiles cambian los rasgos de los bots', () => {
  const facil = resolveTraits('aggro', 'facil');
  const normal = resolveTraits('aggro', 'normal');
  const dificil = resolveTraits('aggro', 'dificil');

  assert.ok(dificil.aggression > normal.aggression && normal.aggression > facil.aggression);
  assert.ok(dificil.bluff > normal.bluff && normal.bluff > facil.bluff);
  assert.ok(facil.mistake > 0 && dificil.mistake === 0);
  assert.equal(resolveTraits('tight', 'dificil').level, 'dificil');
  assert.equal(BOT_LEVELS.normal.label, 'Normal');
  assert.equal(BOT_LEVELS.facil.label, 'Fácil');
  assert.equal(BOT_LEVELS.dificil.label, 'Difícil');
});

test('las claves viejas de nivel migran a Fácil y Difícil', () => {
  assert.equal(normalizeBotLevel('suave'), 'facil');
  assert.equal(normalizeBotLevel('duro'), 'dificil');
  assert.equal(normalizeBotLevel('normal'), 'normal');
  assert.equal(normalizeBotLevel('otro'), 'normal');
  assert.equal(normalizeBotLevel(undefined), 'normal');
});

test('el control de faroles escala de Sin a Muchos', () => {
  const sin = resolveTraits('balanced', 'normal', 'sin');
  const pocos = resolveTraits('balanced', 'normal', 'pocos');
  const normal = resolveTraits('balanced', 'normal', 'normal');
  const muchos = resolveTraits('balanced', 'normal', 'muchos');

  assert.equal(sin.bluff, 0);
  assert.equal(sin.semiBluff, 0);
  assert.ok(pocos.bluff > 0 && pocos.bluff < normal.bluff);
  assert.ok(muchos.bluff > normal.bluff && muchos.semiBluff > normal.semiBluff);
  assert.equal(normalizeBluffLevel('sin'), 'sin');
  assert.equal(normalizeBluffLevel('cualquiera'), 'normal');
  assert.equal(BOT_BLUFF_LEVELS.sin, 0);
});

test('un bot con mano fuerte apuesta y uno débil se retira', () => {
  const strongTable = botSpot({
    hole: 'AC AD',
    board: 'AS KH 7D',
    pot: 60,
    currentBet: 0,
    turn: 1,
  });
  const strongOptions = legalActions(strongTable, 1);
  const strongActions = [];
  for (let seed = 1; seed <= 8; seed += 1) {
    strongActions.push(
      botAction(strongTable, 1, {
        profile: 'aggro',
        level: 'normal',
        sims: 40,
        rng: seededRng(seed),
      }),
    );
  }
  const valueBet = strongActions.find((action) => action.type === 'raise');
  assert.ok(valueBet, JSON.stringify(strongActions));
  assert.ok(valueBet.amount >= strongOptions.raise.min);
  assert.ok(valueBet.amount <= strongOptions.raise.max);

  const weakTable = botSpot({
    hole: '2C 3D',
    board: 'AS KH 7D',
    pot: 60,
    currentBet: 30,
    turn: 1,
  });
  const weak = botAction(weakTable, 1, {
    profile: 'tight',
    level: 'dificil',
    sims: 40,
    rng: seededRng(9),
  });
  assert.equal(weak.type, 'fold');
});

test('los bots farolean más con aire en posición y heads-up', () => {
  const base = {
    hole: '9C 7D',
    board: 'AS 8H 2C',
    pot: 40,
    currentBet: 0,
    turn: 0,
  };
  const headsUp = botSpot({ ...base, folded: [false, false, true, true] });
  const multiway = botSpot({ ...base, folded: [false, false, false, false] });

  let headsUpBluffs = 0;
  let multiwayBluffs = 0;
  for (let seed = 1; seed <= 40; seed += 1) {
    const heads = botAction(headsUp, 0, {
      profile: 'aggro',
      level: 'normal',
      sims: 20,
      rng: seededRng(seed),
    });
    if (heads.intent === 'bluff') headsUpBluffs += 1;

    const multi = botAction(multiway, 0, {
      profile: 'aggro',
      level: 'normal',
      sims: 20,
      rng: seededRng(seed),
    });
    if (multi.intent === 'bluff') multiwayBluffs += 1;
  }

  assert.ok(headsUpBluffs > 0, 'no faroleó nunca heads-up');
  assert.ok(
    headsUpBluffs > multiwayBluffs,
    `heads-up ${headsUpBluffs} vs multiway ${multiwayBluffs}`,
  );
});

test('el nivel difícil presiona más que el fácil', () => {
  const table = botSpot({
    hole: '9C 7D',
    board: 'AS 8H 2C',
    pot: 40,
    currentBet: 0,
    turn: 0,
    folded: [false, false, true, true],
  });

  let facilRaises = 0;
  let dificilRaises = 0;
  for (let seed = 1; seed <= 40; seed += 1) {
    const facil = botAction(table, 0, {
      profile: 'aggro',
      level: 'facil',
      sims: 20,
      rng: seededRng(seed),
    });
    if (facil.type === 'raise') facilRaises += 1;

    const dificil = botAction(table, 0, {
      profile: 'aggro',
      level: 'dificil',
      sims: 20,
      rng: seededRng(seed),
    });
    if (dificil.type === 'raise') dificilRaises += 1;
  }

  assert.ok(dificilRaises > facilRaises, `difícil ${dificilRaises} vs fácil ${facilRaises}`);
});

test('los bots no miran las cartas de los rivales', () => {
  const table = botSpot({
    hole: 'AC KD',
    board: 'QS 8H 3D',
    pot: 30,
    currentBet: 0,
    turn: 1,
  });

  table.players[2].hole = hand('2C 2D');
  table.players[3].hole = hand('7C 7D');
  const first = botAction(table, 1, {
    profile: 'balanced',
    level: 'normal',
    sims: 30,
    rng: seededRng(21),
  });

  table.players[2].hole = hand('AS AH');
  table.players[3].hole = hand('KS KH');
  const second = botAction(table, 1, {
    profile: 'balanced',
    level: 'normal',
    sims: 30,
    rng: seededRng(21),
  });

  assert.deepEqual(first, second);
});

test('normalizeTable completa las mesas guardadas de antes', () => {
  const table = createTable();
  delete table.lastAggressor;
  delete table.raisesThisStreet;
  for (const player of table.players) {
    delete player.raises;
    delete player.lastAction;
    delete player.bluffing;
  }

  normalizeTable(table);

  assert.equal(table.lastAggressor, null);
  assert.equal(table.raisesThisStreet, 0);
  assert.equal(table.players[0].raises, 0);
  assert.equal(table.players[0].lastAction, '');
  assert.equal(table.players[0].bluffing, false);
});

test('la charla de los bots puede mentir y no repite siempre', () => {
  const tones = new Set();
  for (let seed = 1; seed <= 60; seed += 1) {
    const line = pickBotLine('bluff', seededRng(seed));
    assert.ok(typeof line.text === 'string' && line.text.length > 0);
    tones.add(line.tone);
  }

  assert.ok(tones.has('bluff'));
  assert.ok(tones.size > 1, [...tones].join(','));
});

test('los bots conservan las fichas también en nivel difícil', () => {
  const total = START_STACK * 4;
  for (let seed = 1; seed <= 10; seed += 1) {
    const rng = seededRng(seed * 131);
    const table = createTable({ dealer: seed % 4 });
    startHand(table, rng);
    let guard = 0;
    while (!table.settled && guard < 80) {
      guard += 1;
      const index = table.turn;
      if (index === null) {
        advance(table, rng);
        continue;
      }
      const action = botAction(table, index, {
        rng,
        sims: 20,
        profile: ['tight', 'balanced', 'aggro'][index % 3],
        level: 'dificil',
      });
      const result = applyAction(table, index, action);
      assert.equal(result.ok, true, `seed ${seed}: acción inválida ${action.type}`);
      advance(table, rng);
    }
    assert.equal(table.settled, true, `seed ${seed}: la mano no cerró`);
    const chips = table.players.reduce((sum, player) => sum + player.stack, 0);
    assert.equal(chips, total, `seed ${seed}: fichas perdidas`);
    assert.equal(table.pot, 0);
  }
});

test('la entrada no tiene tope: se limita solo por el saldo', () => {
  assert.equal(clampBuyIn(100000, 100000, 10), 100000);
  assert.equal(clampBuyIn(250000, 100000, 10), 100000);
  assert.equal(clampBuyIn(DEFAULT_BUY_IN, 1000, 10), DEFAULT_BUY_IN);
  assert.equal(clampBuyIn(0, 100000, 10), MIN_BUY_IN_BLINDS * 10);
  assert.equal(clampBuyIn(5, 1000, 10), MIN_BUY_IN_BLINDS * 10);
  assert.equal(clampBuyIn(999, 1000, 100), 1000);
  assert.equal(clampBuyIn(100, 500, 1000), 0);
  assert.equal(suggestedBuyIn(100000, 10), SUGGESTED_BUY_IN_BLINDS * 10);
  assert.equal(suggestedBuyIn(50000, 100), SUGGESTED_BUY_IN_BLINDS * 100);
  assert.equal(suggestedBuyIn(500, 100), 500);
});

test('normalizeBigBlind acepta cualquier ciega par desde 10', () => {
  for (const bb of BIG_BLINDS) assert.equal(normalizeBigBlind(bb), bb);
  assert.equal(normalizeBigBlind(500), 500);
  assert.equal(normalizeBigBlind('100'), 100);
  assert.equal(normalizeBigBlind(25001), 25000);
  assert.equal(normalizeBigBlind(7), BB);
  assert.equal(normalizeBigBlind('nada'), BB);
});

test('la ciega personalizada es par y no pasa de un décimo del saldo', () => {
  assert.equal(maxBigBlind(1000000), 100000);
  assert.equal(maxBigBlind(1000000000), 100000000);
  assert.equal(maxBigBlind(505), 50);
  assert.equal(customBigBlind(25000, 1000000), 25000);
  assert.equal(customBigBlind(25001, 1000000), 25000);
  assert.equal(customBigBlind(5, 1000000), MIN_BIG_BLIND);
  assert.equal(customBigBlind(500000, 1000000), 100000);
  assert.equal(customBigBlind(25000, 5), null);
  assert.equal(clampBuyIn(0, 1000000, 25000), 25000 * MIN_BUY_IN_BLINDS);
  assert.equal(suggestedBuyIn(1000000, 25000), 1000000);
});

test('blindOptions ofrece las parejas grandes y conserva la actual', () => {
  assert.deepEqual(blindOptions(300, 10), [10]);
  assert.deepEqual(blindOptions(1000000, 100000), [100, 1000, 10000, 100000]);
  assert.deepEqual(blindOptions(1000000, 10), [10, 100, 1000, 10000, 100000]);
  assert.deepEqual(blindOptions(1000000000, 100000000), [
    100000, 1000000, 10000000, 100000000,
  ]);
  assert.deepEqual(blindOptions(5, 10), [BB]);
});

test('las ciegas altas redondean las subidas y conservan las fichas', () => {
  const total = 100000 * 4;
  const rng = seededRng(4242);
  const table = createTable({ stack: 100000, sb: 5000, bb: 10000, dealer: 1 });
  startHand(table, rng);
  assert.equal(table.smallBlind, 5000);
  assert.equal(table.bigBlind, 10000);

  const options = raiseOptions(table, table.turn);
  assert.ok(options);
  assert.equal(options.raise.min % 5000, 0);
  for (const preset of options.presets) {
    assert.equal(preset.amount % 5000, 0, `${preset.label} ${preset.amount}`);
  }

  let guard = 0;
  while (!table.settled && guard < 100) {
    guard += 1;
    const index = table.turn;
    if (index === null) {
      advance(table, rng);
      continue;
    }
    const action = botAction(table, index, {
      rng,
      level: 'normal',
      profile: ['tight', 'balanced', 'aggro'][index % 3],
      sims: 25,
    });
    if (action.type === 'raise') {
      assert.equal(action.amount % 5000, 0, `subida ${action.amount}`);
    }
    const result = applyAction(table, index, action);
    assert.equal(result.ok, true, `acción inválida ${action.type}`);
    advance(table, rng);
  }

  assert.equal(table.settled, true);
  const chips = table.players.reduce((sum, player) => sum + player.stack, 0);
  assert.equal(chips, total);
  assert.equal(table.pot, 0);
});

test('con faroles en Sin los bots no farolean nunca', () => {
  const post = botSpot({
    hole: '9C 7D',
    board: 'AS 8H 2C',
    pot: 40,
    currentBet: 0,
    turn: 0,
    folded: [false, false, true, true],
  });

  for (let seed = 1; seed <= 60; seed += 1) {
    const action = botAction(post, 0, {
      profile: 'aggro',
      level: 'normal',
      bluff: 'sin',
      sims: 20,
      rng: seededRng(seed),
    });
    assert.notEqual(action.intent, 'bluff', `postflop seed ${seed}`);
    assert.notEqual(action.intent, 'semiBluff', `postflop seed ${seed}`);
  }

  for (let seed = 1; seed <= 60; seed += 1) {
    const table = createTable();
    startHand(table, seededRng(seed * 13));
    const action = botAction(table, table.turn, {
      profile: 'aggro',
      level: 'normal',
      bluff: 'sin',
      sims: 20,
      rng: seededRng(seed),
    });
    assert.notEqual(action.intent, 'bluff', `preflop seed ${seed}`);
    assert.notEqual(action.intent, 'semiBluff', `preflop seed ${seed}`);
  }
});
