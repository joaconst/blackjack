// Cartas y mazos compartidos por los motores. Sin DOM.

export const DECKS = 6;
export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

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

/** Texto accesible de una carta: “As de picas”. */
export function cardLabel(card) {
  const rank = RANK_LABEL[card.rank] || card.rank;
  return `${rank} de ${SUIT_LABEL[card.suit]}`;
}
