// Motor del juego: sin DOM, sin estado global. Todo testeable con Node.

export const MIN_BET = 5;
export const START_BALANCE = 1000;
export const DAILY_FLOOR = 500;
export const DECKS = 6;
export const RESHUFFLE_AT = 78; // ~25% de 312 cartas

export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/**
 * Escalera de fichas. Cada denominacion aparece cuando el saldo la alcanza.
 * El patron 1 / 2,5 / 5 se repite por decada: 100, 250, 500, 1.000, 2.500...
 */
export const CHIP_TIERS = [
  5, 10, 25, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000,
];

export const SUIT_GLYPH = {
  spades: '\u2660',
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
};

export const RANK_LABEL = { A: 'As', J: 'Jota', Q: 'Reina', K: 'Rey' };
export const SUIT_LABEL = {
  spades: 'picas',
  hearts: 'corazones',
  diamonds: 'diamantes',
  clubs: 'tr\u00e9boles',
};

export function createShoe(decks = DECKS) {
  const cards = [];
  for (let d = 0; d < decks; d += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) cards.push({ suit, rank });
    }
  }
  return cards;
}

export function shuffle(cards, rand = Math.random) {
  const out = cards.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function rankValue(rank) {
  if (rank === 'A') return 11;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank);
}

export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += rankValue(card.rank);
    if (card.rank === 'A') aces += 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

export function isSoft(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += rankValue(card.rank);
    if (card.rank === 'A') aces += 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return aces > 0 && total <= 21;
}

export function isBlackjack(cards) {
  return cards.length === 2 && handValue(cards) === 21;
}

export function dealerShouldHit(cards) {
  return handValue(cards) < 17;
}

// La banca se planta en 17, incluido soft 17.

/**
 * Resultado economico de una mano.
 * - win: devuelve apuesta + ganancia (blackjack paga 3:2)
 * - push: devuelve la apuesta
 * - lose: no devuelve nada
 */
export function roundPayout(result, bet, { blackjack = false } = {}) {
  if (!Number.isFinite(bet) || bet <= 0) return { payout: 0, net: 0 };
  if (result === 'push') return { payout: bet, net: 0 };
  if (result === 'win') {
    const net = blackjack ? Math.round(bet * 1.5) : bet;
    return { payout: bet + net, net };
  }
  return { payout: 0, net: -bet };
}

export function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function msUntilNextDay(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return Math.max(0, next.getTime() - now.getTime());
}

/**
 * Piso diario: una vez por dia, si el saldo esta por debajo del piso,
 * se completa hasta el piso. Si ya se cobro hoy, no hace nada.
 */
export function dailyTopUp({ balance, lastTopUp, today, floor = DAILY_FLOOR }) {
  if (lastTopUp === today || balance >= floor) {
    return { balance, credited: 0, applied: false };
  }
  return { balance: floor, credited: floor - balance, applied: true };
}

export function formatMoney(value) {
  return '$' + Math.round(value).toLocaleString('es-AR');
}

/** Fichas que el saldo actual puede pagar, de menor a mayor. */
export function availableChips(balance, tiers = CHIP_TIERS) {
  const max = Number.isFinite(balance) ? Math.floor(balance) : 0;
  return tiers.filter((tier) => tier <= max);
}

/**
 * Arma la pila de fichas de una apuesta.
 * Usa la ficha mas grande posible y completa el resto con las menores.
 * Nunca devuelve mas de `maxChips`; lo que sobra se funde en la ultima
 * ficha, que queda sin denominacion (tier: null) pero con la suma exacta.
 */
export function chipStack(amount, { maxChips = 7, tiers = CHIP_TIERS } = {}) {
  const total = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  const limit = Math.max(1, Math.floor(maxChips));
  if (total <= 0) return [];

  const chips = [];
  let rest = total;

  for (let i = tiers.length - 1; i >= 0 && chips.length < limit; i -= 1) {
    const tier = tiers[i];
    while (rest >= tier && chips.length < limit) {
      chips.push({ value: tier, tier });
      rest -= tier;
    }
  }

  if (rest > 0) {
    if (chips.length) {
      const last = chips[chips.length - 1];
      const merged = last.value + rest;
      chips[chips.length - 1] = {
        value: merged,
        tier: tiers.includes(merged) ? merged : null,
      };
    } else {
      chips.push({ value: rest, tier: null });
    }
  }

  return chips;
}
