import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createShoe,
  shuffle,
  rankValue,
  handValue,
  isSoft,
  isBlackjack,
  dealerShouldHit,
  roundPayout,
  dailyTopUp,
  dayKey,
  msUntilNextDay,
  formatMoney,
  availableChips,
  chipStack,
  CHIP_TIERS,
  DECKS,
  DAILY_FLOOR,
} from '../js/engine.js';

const hand = (...specs) =>
  specs.map((spec) => ({ rank: spec.slice(0, -1), suit: spec.slice(-1) }));

/* ---------- Manos ---------- */

test('cuenta cartas numéricas y figuras', () => {
  assert.equal(rankValue('2'), 2);
  assert.equal(rankValue('10'), 10);
  assert.equal(rankValue('J'), 10);
  assert.equal(rankValue('Q'), 10);
  assert.equal(rankValue('K'), 10);
  assert.equal(rankValue('A'), 11);
});

test('blackjack de dos cartas suma 21', () => {
  assert.equal(handValue(hand('AS', 'KH')), 21);
  assert.equal(handValue(hand('AD', '10C')), 21);
});

test('los ases bajan a 1 cuando hace falta', () => {
  assert.equal(handValue(hand('AS', 'AD')), 12);
  assert.equal(handValue(hand('AS', 'AD', '9H')), 21);
  assert.equal(handValue(hand('AS', 'AD', '9H', '9C')), 20);
  assert.equal(handValue(hand('AS', 'AD', 'AH', '8C')), 21);
});

test('mano pasada de 21', () => {
  assert.equal(handValue(hand('KH', 'QH', 'JS')), 30);
  assert.ok(handValue(hand('KH', 'QH', 'JS')) > 21);
});

test('soft hand se detecta solo si el as sigue valiendo 11', () => {
  assert.equal(isSoft(hand('AS', '6H')), true);
  assert.equal(isSoft(hand('AS', '6H', 'KH')), false);
  assert.equal(isSoft(hand('KH', '6H')), false);
});

test('blackjack solo con dos cartas', () => {
  assert.equal(isBlackjack(hand('AS', 'KH')), true);
  assert.equal(isBlackjack(hand('AS', '5H', '5D')), false);
  assert.equal(isBlackjack(hand('7S', '7H')), false);
});

test('la banca pide con 16 y se planta con 17 (incluido soft 17)', () => {
  assert.equal(dealerShouldHit(hand('10S', '6H')), true);
  assert.equal(dealerShouldHit(hand('10S', '7H')), false);
  assert.equal(dealerShouldHit(hand('AS', '6H')), false);
  assert.equal(dealerShouldHit(hand('AS', '5H')), true);
});

/* ---------- Mazo ---------- */

test('el zapato tiene 6 mazos completos', () => {
  const shoe = createShoe(DECKS);
  assert.equal(shoe.length, 6 * 52);
  const aces = shoe.filter((card) => card.rank === 'A');
  assert.equal(aces.length, 6 * 4);
  const kinds = new Set(shoe.map((card) => `${card.rank}${card.suit}`));
  assert.equal(kinds.size, 52);
});

test('shuffle conserva todas las cartas', () => {
  const shoe = createShoe(1);
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const mixed = shuffle(shoe, rand);
  assert.equal(mixed.length, 52);
  assert.deepEqual(
    mixed.map((card) => `${card.rank}${card.suit}`).sort(),
    shoe.map((card) => `${card.rank}${card.suit}`).sort(),
  );
  assert.notDeepEqual(mixed, shoe);
});

/* ---------- Pagos ---------- */

test('pago de mano ganada normal', () => {
  assert.deepEqual(roundPayout('win', 25), { payout: 50, net: 25 });
});

test('blackjack paga 3:2 redondeando', () => {
  assert.deepEqual(roundPayout('win', 25, { blackjack: true }), { payout: 63, net: 38 });
  assert.deepEqual(roundPayout('win', 100, { blackjack: true }), { payout: 250, net: 150 });
});

test('empate devuelve la apuesta y derrota no devuelve nada', () => {
  assert.deepEqual(roundPayout('push', 40), { payout: 40, net: 0 });
  assert.deepEqual(roundPayout('lose', 40), { payout: 0, net: -40 });
});

test('apuestas inválidas no pagan', () => {
  assert.deepEqual(roundPayout('win', 0), { payout: 0, net: 0 });
  assert.deepEqual(roundPayout('win', NaN), { payout: 0, net: 0 });
});

/* ---------- Saldo diario ---------- */

test('el piso diario completa solo por debajo de 500 y una vez por día', () => {
  assert.deepEqual(
    dailyTopUp({ balance: 0, lastTopUp: '2026-01-01', today: '2026-01-02' }),
    { balance: 500, credited: 500, applied: true },
  );
  assert.deepEqual(
    dailyTopUp({ balance: 300, lastTopUp: '2026-01-01', today: '2026-01-02' }),
    { balance: 500, credited: 200, applied: true },
  );
  assert.deepEqual(
    dailyTopUp({ balance: 800, lastTopUp: '2026-01-01', today: '2026-01-02' }),
    { balance: 800, credited: 0, applied: false },
  );
  assert.deepEqual(
    dailyTopUp({ balance: 100, lastTopUp: '2026-01-02', today: '2026-01-02' }),
    { balance: 100, credited: 0, applied: false },
  );
  assert.equal(DAILY_FLOOR, 500);
});

test('dayKey usa fecha local', () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59, 59)), '2026-01-05');
  assert.equal(dayKey(new Date(2026, 11, 31, 0, 0, 1)), '2026-12-31');
});

test('la cuenta hasta el próximo día nunca es negativa', () => {
  const now = new Date(2026, 0, 1, 23, 59, 30);
  assert.equal(msUntilNextDay(now), 30_000);
  assert.ok(msUntilNextDay() > 0);
  assert.ok(msUntilNextDay() <= 24 * 60 * 60 * 1000);
});

/* ---------- Formato ---------- */

test('formatea moneda es-AR sin decimales', () => {
  assert.equal(formatMoney(0), '$0');
  assert.equal(formatMoney(1000), '$1.000');
  assert.equal(formatMoney(1500), '$1.500');
});

/* ---------- Fichas ---------- */

test('las fichas disponibles aparecen con el saldo', () => {
  assert.deepEqual(availableChips(0), []);
  assert.deepEqual(availableChips(4), []);
  assert.deepEqual(availableChips(24), [5, 10]);
  assert.deepEqual(availableChips(250), [5, 10, 25, 100, 250]);
  assert.deepEqual(availableChips(1000), [5, 10, 25, 100, 250, 500, 1000]);
  assert.deepEqual(availableChips(100000), CHIP_TIERS);
});

test('la pila usa la ficha mas grande posible', () => {
  const values = (amount) => chipStack(amount).map((chip) => chip.value);

  assert.deepEqual(values(0), []);
  assert.deepEqual(values(5), [5]);
  assert.deepEqual(values(100), [100]);
  assert.deepEqual(values(250), [250]);
  assert.deepEqual(values(300), [250, 25, 25]);
  assert.deepEqual(values(500), [500]);
  assert.deepEqual(values(750), [500, 250]);
  assert.deepEqual(values(1000), [1000]);
  assert.deepEqual(values(1500), [1000, 500]);
  assert.deepEqual(values(2500), [2500]);
  assert.deepEqual(values(3000), [2500, 500]);
  assert.deepEqual(values(7400), [5000, 1000, 1000, 250, 100, 25, 25]);
});

test('la pila nunca pasa de 7 fichas y suma exacto', () => {
  for (let amount = 1; amount <= 20000; amount += 1) {
    const chips = chipStack(amount);
    assert.ok(chips.length > 0, `pila vacia en ${amount}`);
    assert.ok(chips.length <= 7, `${chips.length} fichas en ${amount}`);
    assert.equal(
      chips.reduce((sum, chip) => sum + chip.value, 0),
      amount,
      `no suma ${amount}`,
    );
    assert.ok(chips.every((chip) => chip.value > 0));
  }
});

test('los sobrantes se funden en la ultima ficha', () => {
  const chips = chipStack(12345);
  assert.ok(chips.length <= 7);
  assert.equal(
    chips.reduce((sum, chip) => sum + chip.value, 0),
    12345,
  );
  assert.equal(chips[chips.length - 1].tier, null);

  const odd = chipStack(123);
  assert.deepEqual(
    odd.map((chip) => chip.value),
    [100, 10, 13],
  );
});
