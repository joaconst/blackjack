// Motor del blackjack: sin DOM, sin estado global. Todo testeable con Node.

import {
  DECKS,
  RANKS,
  RANK_LABEL,
  SUITS,
  SUIT_GLYPH,
  SUIT_LABEL,
  cardLabel,
  createShoe,
  shuffle,
} from '../../core/cards.js';
import {
  CHIP_TIERS,
  DAILY_FLOOR,
  START_BALANCE,
  availableChips,
  chipStack,
  dailyTopUp,
  dayKey,
  formatMoney,
  msUntilNextDay,
} from '../../core/money.js';

export {
  CHIP_TIERS,
  DAILY_FLOOR,
  DECKS,
  RANKS,
  RANK_LABEL,
  START_BALANCE,
  SUITS,
  SUIT_GLYPH,
  SUIT_LABEL,
  availableChips,
  cardLabel,
  chipStack,
  createShoe,
  dailyTopUp,
  dayKey,
  formatMoney,
  msUntilNextDay,
  shuffle,
};

export const MIN_BET = 5;
export const RESHUFFLE_AT = 78; // ~25% de 312 cartas
export const MAX_HANDS = 4;

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
 * Se puede dividir con dos cartas del mismo valor: 8 y 8, 10 y J, etc.
 * Un as vale 11, asi que dos ases tambien entran.
 */
export function canSplit(cards) {
  return (
    Array.isArray(cards) &&
    cards.length === 2 &&
    rankValue(cards[0].rank) === rankValue(cards[1].rank)
  );
}

/**
 * Resuelve una mano contra la banca.
 * `blackjack` solo se activa en la mano original de dos cartas: un 21
 * conseguido despues de dividir paga 1:1.
 */
export function settleHand(playerCards, dealerCards, bet, { blackjack = false } = {}) {
  if (!Number.isFinite(bet) || bet <= 0) return { result: 'push', payout: 0, net: 0 };

  const player = handValue(playerCards);
  const dealer = handValue(dealerCards);

  if (player > 21) {
    const { payout, net } = roundPayout('lose', bet);
    return { result: 'lose', blackjack: false, payout, net };
  }

  if (dealer > 21 || player > dealer) {
    const natural =
      blackjack && player === 21 && playerCards.length === 2 && !isBlackjack(dealerCards);
    const { payout, net } = roundPayout('win', bet, { blackjack: natural });
    return { result: 'win', blackjack: natural, payout, net };
  }

  if (player < dealer) {
    const { payout, net } = roundPayout('lose', bet);
    return { result: 'lose', blackjack: false, payout, net };
  }

  const { payout, net } = roundPayout('push', bet);
  return { result: 'push', blackjack: false, payout, net };
}

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

