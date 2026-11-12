import {
  MIN_BET,
  START_BALANCE,
  DECKS,
  RESHUFFLE_AT,
  DAILY_FLOOR,
  MAX_HANDS,
  CHIP_TIERS,
  SUIT_GLYPH,
  RANK_LABEL,
  SUIT_LABEL,
  createShoe,
  shuffle,
  handValue,
  isBlackjack,
  dealerShouldHit,
  canSplit,
  settleHand,
  dayKey,
  msUntilNextDay,
  dailyTopUp,
  availableChips,
  chipStack,
  formatMoney,
} from './engine.js';
import { sound, unlockSoundOnGesture } from './sound.js';

const PREFS_KEY = 'blackjack.prefs.v1';
const PROGRESS_KEY = 'blackjack.progress.v1';
const LEGACY_KEY = 'blackjack.state.v1';
const APP_VERSION = 'v1.0';
const money = formatMoney;
let resetting = false;

const els = {
  balance: document.getElementById('balance'),
  dealerCards: document.getElementById('dealerCards'),
  playerHands: document.getElementById('playerHands'),
  dealerScore: document.getElementById('dealerScore'),
  status: document.getElementById('status'),
  betPanel: document.getElementById('betPanel'),
  betAmount: document.getElementById('betAmount'),
  betSpot: document.getElementById('betSpot'),
  betChips: document.getElementById('betChips'),
  betTotal: document.getElementById('betTotal'),
  chips: document.getElementById('chips'),
  clearBetBtn: document.getElementById('clearBetBtn'),
  repeatBetBtn: document.getElementById('repeatBetBtn'),
  maxBetBtn: document.getElementById('maxBetBtn'),
  dealBtn: document.getElementById('dealBtn'),
  table: document.getElementById('table'),
  gestureHint: document.getElementById('gestureHint'),
  actionPanel: document.getElementById('actionPanel'),
  inPlay: document.getElementById('inPlay'),
  hitBtn: document.getElementById('hitBtn'),
  standBtn: document.getElementById('standBtn'),
  doubleBtn: document.getElementById('doubleBtn'),
  doubleTag: document.getElementById('doubleTag'),
  splitBtn: document.getElementById('splitBtn'),
  splitTag: document.getElementById('splitTag'),
  noFundsPanel: document.getElementById('noFundsPanel'),
  countdown: document.getElementById('countdown'),
  noFundsRulesBtn: document.getElementById('noFundsRulesBtn'),
  themeBtn: document.getElementById('themeBtn'),
  soundBtn: document.getElementById('soundBtn'),
  themeColor: document.getElementById('themeColor'),
  installBtn: document.getElementById('installBtn'),
  menuBtn: document.getElementById('menuBtn'),
  toast: document.getElementById('toast'),
  sheet: document.getElementById('sheet'),
  sheetClose: document.getElementById('sheetClose'),
  gesturesBtn: document.getElementById('gesturesBtn'),
  gesturesValue: document.getElementById('gesturesValue'),
  sheetInstallBtn: document.getElementById('sheetInstallBtn'),
  installStatus: document.getElementById('installStatus'),
  installSteps: document.getElementById('installSteps'),
  appVersion: document.getElementById('appVersion'),
  resetBtn: document.getElementById('resetBtn'),
  resetConfirm: document.getElementById('resetConfirm'),
  resetCancel: document.getElementById('resetCancel'),
  resetGo: document.getElementById('resetGo'),
  addFundsBtn: document.getElementById('addFundsBtn'),
  addSheet: document.getElementById('addSheet'),
  addClose: document.getElementById('addClose'),
  addTotal: document.getElementById('addTotal'),
  addAfter: document.getElementById('addAfter'),
  addChips: document.getElementById('addChips'),
  addUndo: document.getElementById('addUndo'),
  addClear: document.getElementById('addClear'),
  addConfirm: document.getElementById('addConfirm'),
};

/* ---------- Estado y persistencia ---------- */

function readStored(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const storedPrefs = readStored(PREFS_KEY);
const storedProgress = readStored(PROGRESS_KEY);
const legacy = readStored(LEGACY_KEY);

function loadPrefs() {
  // Al migrar desde la clave vieja, el tema y el sonido se conservan.
  const source = storedPrefs || legacy || {};
  return {
    theme: source.theme === 'light' || source.theme === 'dark' ? source.theme : 'auto',
    sound: typeof source.sound === 'boolean' ? source.sound : true,
    gestures: typeof source.gestures === 'boolean' ? source.gestures : true,
    seenGestureHint: source.seenGestureHint === true,
  };
}

function loadProgress() {
  const source = storedProgress || legacy || {};
  const balance =
    Number.isFinite(source.balance) && source.balance >= 0
      ? Math.floor(source.balance)
      : START_BALANCE;
  const bet = Number.isFinite(source.bet) && source.bet >= 0 ? Math.floor(source.bet) : 0;
  const lastBet =
    Number.isFinite(source.lastBet) && source.lastBet >= 0
      ? Math.floor(source.lastBet)
      : bet >= MIN_BET
        ? bet
        : 0;

  return {
    balance,
    bet,
    lastTopUp: typeof source.lastTopUp === 'string' ? source.lastTopUp : dayKey(),
    lastBet,
  };
}

const prefs = loadPrefs();
const progress = loadProgress();

// Guarda las claves nuevas una sola vez y retira la vieja.
const wrotePrefs = storedPrefs ? true : writeStored(PREFS_KEY, prefs);
const wroteProgress = storedProgress ? true : writeStored(PROGRESS_KEY, progress);
if (legacy && wrotePrefs && wroteProgress) {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* sin almacenamiento */
  }
}

function emptyHand(bet = 0) {
  return {
    cards: [],
    bet,
    doubled: false,
    done: false,
    settled: false,
    result: '',
    net: 0,
    natural: false,
    noResplit: false,
  };
}

const state = {
  ...progress,
  ...prefs,
  shoe: shuffle(createShoe(DECKS)),
  phase: 'betting', // betting | dealing | player | dealer
  hands: [emptyHand()],
  active: 0,
  dealer: [],
  holeHidden: false,
  roundBet: 0,
  busy: false,
  locked: false,
  status: { text: 'Hacé tu apuesta', tone: 'neutral' },
};

function saveProgress() {
  // Mientras se reinicia el progreso no hay que volver a escribir nada:
  // pagehide dispara save() justo despues de borrar el localStorage.
  if (resetting) return;
  writeStored(PROGRESS_KEY, {
    balance: state.balance,
    bet: state.bet,
    lastTopUp: state.lastTopUp,
    lastBet: state.lastBet,
  });
}

function savePrefs() {
  writeStored(PREFS_KEY, {
    theme: state.theme,
    sound: state.sound,
    gestures: state.gestures,
    seenGestureHint: state.seenGestureHint,
  });
}

function save() {
  saveProgress();
}

/* ---------- Tema ---------- */

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function resolvedTheme() {
  if (state.theme === 'light' || state.theme === 'dark') return state.theme;
  return darkQuery.matches ? 'dark' : 'light';
}

function applyTheme() {
  const theme = resolvedTheme();
  document.documentElement.dataset.theme = theme;
  if (els.themeColor) {
    els.themeColor.setAttribute('content', theme === 'dark' ? '#0f1210' : '#f6f5f0');
  }
  els.themeBtn.setAttribute(
    'aria-label',
    theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro',
  );
}

darkQuery.addEventListener('change', () => {
  if (state.theme === 'auto') applyTheme();
});

function applySound() {
  document.documentElement.dataset.sound = state.sound ? 'on' : 'off';
  els.soundBtn.setAttribute('aria-pressed', String(state.sound));
  els.soundBtn.setAttribute('aria-label', state.sound ? 'Silenciar sonidos' : 'Activar sonidos');
  sound.setMuted(!state.sound);
}

function applyGestures() {
  document.documentElement.dataset.gestures = state.gestures ? 'on' : 'off';
  els.gesturesBtn.setAttribute('aria-checked', String(state.gestures));
  els.gesturesBtn.classList.toggle('is-on', state.gestures);
  els.gesturesValue.textContent = state.gestures ? 'Activados' : 'Desactivados';
}

function buildAddChips() {
  els.addChips.replaceChildren(...CHIP_TIERS.map((tier) => makeChip(tier)));
}

/* ---------- Fichas ---------- */

function chipLabel(value) {
  if (value < 1000) return String(value);
  const k = value / 1000;
  return `${Number.isInteger(k) ? k : String(k).replace('.', ',')}k`;
}

function chipIndex(value) {
  const index = CHIP_TIERS.indexOf(value);
  return index < 0 ? 0 : index;
}

function makeChip(value, { button = true } = {}) {
  const node = document.createElement(button ? 'button' : 'span');
  if (button) {
    node.type = 'button';
    node.setAttribute('aria-label', `Agregar ${money(value)}`);
  } else {
    node.setAttribute('aria-hidden', 'true');
  }
  node.className = `chip chip--${value}`;
  node.dataset.value = String(value);

  const inner = document.createElement('span');
  inner.textContent = chipLabel(value);
  node.append(inner);
  return node;
}

function chipStackNode(chip, index) {
  const node = document.createElement('span');
  node.className = `chip chip--stack${chip.tier ? ` chip--${chip.tier}` : ' chip--combo'}`;
  node.style.setProperty('--i', String(index));
  node.style.setProperty('--dx', `${((index % 2) * 2 - 1) * (index % 3)}px`);
  node.style.setProperty('--rot', `${((index % 2) * 2 - 1) * 1.4}deg`);

  const inner = document.createElement('span');
  inner.textContent = chip.tier ? chipLabel(chip.value) : money(chip.value);
  node.append(inner);
  node.setAttribute('aria-hidden', 'true');
  return node;
}

let chipsKey = '';
let lastUnlocked = [];

function chipBankroll() {
  // Mientras hay una mano en juego el saldo ya tiene descontada la apuesta;
  // para la fila de fichas conviene mirar el total, asi no desaparecen
  // denominaciones a mitad del round ni se "desbloquean" de nuevo al cobrar.
  const inPlay =
    state.phase === 'dealing' || state.phase === 'player' || state.phase === 'dealer';
  return inPlay ? state.balance + state.roundBet : state.balance;
}

function renderChips() {
  const tiers = availableChips(chipBankroll());
  const key = tiers.join(',');
  const betting = state.phase === 'betting';
  lastUnlocked = [];

  if (key !== chipsKey) {
    const previous = chipsKey ? chipsKey.split(',').map(Number) : [];
    const added = previous.length ? tiers.filter((tier) => !previous.includes(tier)) : [];

    els.chips.replaceChildren(...tiers.map((tier) => makeChip(tier)));
    els.chips.classList.toggle('chips--rail', tiers.length > 4);
    chipsKey = key;

    if (added.length) {
      lastUnlocked = added;
      for (const tier of added) {
        const node = els.chips.querySelector(`.chip[data-value="${tier}"]`);
        if (node) node.classList.add('is-new');
      }
      toast(`Nueva ficha de ${money(Math.max(...added))}`);
      sound.play('unlockTier');
      requestAnimationFrame(() => {
        els.chips.scrollLeft = els.chips.scrollWidth;
      });
      setTimeout(() => {
        for (const node of els.chips.querySelectorAll('.is-new')) node.classList.remove('is-new');
      }, 900);
    }
  }

  const remaining = state.balance - state.bet;
  for (const chip of els.chips.children) {
    chip.disabled = !betting || Number(chip.dataset.value) > remaining;
  }
}

let spotKey = '';

function spotAmount() {
  if (state.phase === 'betting' && state.roundBet > 0) return state.roundBet;
  if (state.phase === 'betting' || state.phase === 'dealing') return state.bet;
  return state.roundBet;
}

function renderBetSpot() {
  const amount = spotAmount();
  els.betTotal.textContent = money(amount);
  els.betSpot.classList.toggle('is-empty', amount <= 0);

  const chips = chipStack(amount);
  const key = chips.map((chip) => chip.value).join(',');
  if (key === spotKey) return;
  spotKey = key;
  els.betChips.replaceChildren(...chips.map(chipStackNode));
}

function flyChip(source, value) {
  if (!source || !els.betSpot) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const from = source.getBoundingClientRect();
  const to = els.betSpot.getBoundingClientRect();
  if (!from.width || !to.width) return;

  const node = makeChip(value);
  node.classList.add('chip--fly');
  node.style.left = `${from.left}px`;
  node.style.top = `${from.top}px`;
  node.style.width = `${from.width}px`;
  node.style.height = `${from.height}px`;
  document.body.append(node);

  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const scale = Math.max(0.45, (to.width * 0.4) / from.width);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      node.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
      node.style.opacity = '0.6';
    });
  });

  setTimeout(() => node.remove(), 540);
}

function playChip(value) {
  sound.play('chip', { index: chipIndex(value) });
}

function animateSpot(tone) {
  els.betSpot.classList.remove('is-win', 'is-lose', 'is-push');
  void els.betSpot.offsetWidth;
  if (tone === 'win') els.betSpot.classList.add('is-win');
  else if (tone === 'lose') els.betSpot.classList.add('is-lose');
  else if (tone === 'push') els.betSpot.classList.add('is-push');
  if (tone !== 'lose') {
    const clear = tone === 'win' ? 2200 : 900;
    setTimeout(() => els.betSpot.classList.remove('is-win', 'is-push'), clear);
  }
}

function floatGain(text) {
  const node = document.createElement('span');
  node.className = 'bet-spot__float';
  node.textContent = text;
  els.betSpot.append(node);
  setTimeout(() => node.remove(), 1300);
}

/* ---------- Cartas ---------- */

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cardLabel(card) {
  const rank = RANK_LABEL[card.rank] || card.rank;
  return `${rank} de ${SUIT_LABEL[card.suit]}`;
}

function createFaceCard(card) {
  const node = document.createElement('div');
  node.className = 'card';
  node.dataset.suit = card.suit;
  node.dataset.rank = card.rank;
  node.dataset.sig = `${card.rank}-${card.suit}`;
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', cardLabel(card));

  const glyph = SUIT_GLYPH[card.suit];
  node.innerHTML =
    `<span class="card__corner card__corner--tl" aria-hidden="true">` +
    `<span class="card__rank">${card.rank}</span><span class="card__suit">${glyph}</span></span>` +
    `<span class="card__center" aria-hidden="true">${glyph}</span>` +
    `<span class="card__corner card__corner--br" aria-hidden="true">` +
    `<span class="card__rank">${card.rank}</span><span class="card__suit">${glyph}</span></span>`;

  return node;
}

function createBackCard() {
  const node = document.createElement('div');
  node.className = 'card card--back';
  node.dataset.sig = 'back';
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', 'Carta oculta');
  return node;
}

function renderCards(container, cards, hideSecond) {
  const signatures = cards.map((card, index) =>
    hideSecond && index === 1 ? 'back' : `${card.rank}-${card.suit}`,
  );

  while (container.children.length > signatures.length) {
    container.lastElementChild.remove();
  }

  signatures.forEach((signature, index) => {
    const existing = container.children[index];
    if (existing && existing.dataset.sig === signature) return;
    const hidden = hideSecond && index === 1;
    const node = hidden ? createBackCard() : createFaceCard(cards[index]);
    if (existing) existing.replaceWith(node);
    else container.appendChild(node);
  });
}

function activeHand() {
  return state.hands[state.active] || null;
}

/* ---------- Manos del jugador ---------- */

function makePlayerHand(index) {
  const node = document.createElement('section');
  node.className = 'hand hand--player';
  node.dataset.hand = String(index);

  const bar = document.createElement('div');
  bar.className = 'hand__bar';

  const name = document.createElement('span');
  name.className = 'hand__name';

  const tag = document.createElement('span');
  tag.className = 'hand__tag';
  tag.hidden = true;

  const score = document.createElement('span');
  score.className = 'score';
  score.textContent = '\u2014';

  bar.append(name, tag, score);

  const cards = document.createElement('div');
  cards.className = 'hand__cards';

  node.append(bar, cards);
  return node;
}

function renderPlayerHands() {
  const hands = state.hands;
  const multi = hands.length > 1;

  els.table.classList.toggle('is-split', multi);
  els.playerHands.classList.toggle('is-multi', multi);

  while (els.playerHands.children.length > hands.length) {
    els.playerHands.lastElementChild.remove();
  }

  hands.forEach((hand, index) => {
    let node = els.playerHands.children[index];
    if (!node) {
      node = makePlayerHand(index);
      els.playerHands.append(node);
    }

    const value = hand.cards.length ? handValue(hand.cards) : 0;
    const isActive = multi && state.phase === 'player' && index === state.active && !hand.done;
    node.classList.toggle('is-active', isActive);
    node.classList.toggle('is-dim', multi && state.phase === 'player' && index !== state.active);
    node.classList.toggle('is-win', hand.settled && hand.result === 'win');
    node.classList.toggle('is-lose', hand.settled && hand.result === 'lose');
    node.classList.toggle('is-push', hand.settled && hand.result === 'push');
    node.classList.toggle('is-bust', value > 21);

    node.setAttribute('aria-label', multi ? `Mano ${index + 1}` : 'Tu mano');

    const name = node.querySelector('.hand__name');
    name.textContent = multi ? `Mano ${index + 1}` : 'Vos';

    const tag = node.querySelector('.hand__tag');
    tag.hidden = !multi;
    if (multi) {
      tag.className = 'hand__tag';
      if (hand.settled) {
        const net = hand.net || 0;
        tag.textContent = net > 0 ? `+${money(net)}` : net < 0 ? `\u2212${money(-net)}` : '$0';
        tag.dataset.tone = net > 0 ? 'win' : net < 0 ? 'lose' : 'push';
        tag.setAttribute(
          'aria-label',
          net > 0 ? `Ganaste ${money(net)}` : net < 0 ? `Perdiste ${money(-net)}` : 'Empate',
        );
      } else {
        tag.textContent = money(hand.bet);
        tag.dataset.tone = 'bet';
        tag.setAttribute('aria-label', `Apuesta de ${money(hand.bet)}`);
      }
    }

    const score = node.querySelector('.score');
    score.textContent = hand.cards.length ? String(value) : '\u2014';
    score.classList.toggle('is-bust', value > 21);
    score.classList.toggle('is-blackjack', hand.natural && !hand.settled);

    renderCards(node.querySelector('.hand__cards'), hand.cards, false);
  });
}

function renderScores() {
  const dealer = state.dealer;
  if (!dealer.length) {
    els.dealerScore.textContent = '\u2014';
    els.dealerScore.classList.remove('is-bust', 'is-blackjack');
    return;
  }
  if (state.holeHidden) {
    els.dealerScore.textContent = '?';
    els.dealerScore.classList.remove('is-bust', 'is-blackjack');
    return;
  }

  const value = handValue(dealer);
  els.dealerScore.textContent = String(value);
  els.dealerScore.classList.toggle('is-bust', value > 21);
  els.dealerScore.classList.toggle('is-blackjack', isBlackjack(dealer));
}

/* ---------- Render ---------- */

function setStatus(text, tone = 'neutral') {
  state.status = { text, tone };
  els.status.textContent = text;
  els.status.dataset.tone = tone;
}

function splitPossible(hand = activeHand()) {
  if (!hand || state.phase !== 'player') return false;
  if (state.hands.length >= MAX_HANDS) return false;
  if (!canSplit(hand.cards)) return false;
  if (hand.noResplit) return false;
  return true;
}

function renderControls() {
  const betting = state.phase === 'betting';
  const dealing = state.phase === 'dealing';
  const outOfMoney = state.balance < MIN_BET;
  const showEmpty = betting && outOfMoney;
  const hand = activeHand();

  els.betPanel.hidden = !(betting || dealing) || showEmpty;
  els.noFundsPanel.hidden = !showEmpty;
  els.actionPanel.hidden = !(state.phase === 'player' || state.phase === 'dealer');

  const canDeal =
    betting &&
    !state.busy &&
    !state.locked &&
    state.bet >= MIN_BET &&
    state.bet <= state.balance;

  els.dealBtn.disabled = !canDeal;
  const hasCards = state.hands.some((item) => item.cards.length > 0) || state.dealer.length > 0;
  els.clearBetBtn.disabled = !betting || (state.bet <= 0 && !hasCards);
  els.repeatBetBtn.disabled =
    !betting ||
    state.lastBet < MIN_BET ||
    state.lastBet > state.balance ||
    state.lastBet === state.bet;
  els.repeatBetBtn.setAttribute(
    'aria-label',
    state.lastBet >= MIN_BET
      ? `Repetir la apuesta de ${money(state.lastBet)}`
      : 'Repetir la última apuesta',
  );
  els.maxBetBtn.disabled =
    !betting || state.balance < MIN_BET || state.bet >= state.balance;

  els.inPlay.textContent = money(state.roundBet || state.bet);
  els.hitBtn.disabled = state.phase !== 'player' || state.busy;
  els.standBtn.disabled = state.phase !== 'player' || state.busy;

  const canDouble =
    state.phase === 'player' &&
    !state.busy &&
    hand &&
    hand.cards.length === 2 &&
    !hand.doubled &&
    !hand.done &&
    state.balance >= hand.bet;

  els.doubleBtn.disabled = !canDouble;
  els.doubleTag.textContent = `+${money(hand ? hand.bet : state.bet)}`;

  const splittable = splitPossible(hand);
  els.splitBtn.hidden = !splittable;
  els.splitBtn.disabled =
    !splittable || state.busy || !hand || state.balance < hand.bet;
  els.splitTag.textContent = `+${money(hand ? hand.bet : 0)}`;
  els.splitBtn.setAttribute(
    'aria-label',
    hand ? `Dividir la mano y apostar ${money(hand.bet)} más` : 'Dividir la mano',
  );
}

function render() {
  els.balance.textContent = money(state.balance);
  els.betAmount.textContent = money(state.bet);
  renderCards(els.dealerCards, state.dealer, state.holeHidden);
  renderPlayerHands();
  renderScores();
  els.status.textContent = state.status.text;
  els.status.dataset.tone = state.status.tone;
  renderChips();
  renderBetSpot();
  renderControls();
}

/* ---------- Apuesta ---------- */

function setBetMessage() {
  setStatus(state.bet >= MIN_BET ? 'Listo para repartir' : 'Hacé tu apuesta', 'neutral');
}

function addChips(value, source = null) {
  if (state.phase !== 'betting') return;
  const next = Math.min(state.balance, state.bet + value);
  if (next === state.bet) return;

  state.bet = next;
  state.roundBet = 0;
  els.betSpot.classList.remove('is-win', 'is-lose', 'is-push');
  if (source) flyChip(source, value);
  playChip(value);
  setBetMessage();
  save();
  render();
}

function clearBet() {
  if (state.phase !== 'betting') return;
  const hadCards =
    state.hands.some((hand) => hand.cards.length > 0) || state.dealer.length > 0;
  if (state.bet === 0 && !hadCards && state.roundBet === 0) return;

  state.bet = 0;
  state.roundBet = 0;
  state.hands = [emptyHand()];
  state.active = 0;
  state.dealer = [];
  state.holeHidden = false;
  state.locked = false;
  els.betSpot.classList.remove('is-win', 'is-lose', 'is-push', 'is-allin');
  sound.play('tick');
  setBetMessage();
  save();
  render();
  if (hadCards) toast('Mesa limpia');
}

function repeatBet() {
  if (state.phase !== 'betting') return;

  const target = state.lastBet;
  if (target < MIN_BET) {
    toast('Todavía no hay una apuesta para repetir');
    return;
  }
  if (target > state.balance) {
    toast(`No te alcanza para repetir ${money(target)}`);
    return;
  }
  if (target === state.bet) {
    toast(`Ya tenés ${money(target)} apostado`);
    return;
  }

  state.bet = target;
  state.roundBet = 0;
  els.betSpot.classList.remove('is-win', 'is-lose', 'is-push', 'is-allin');
  playChip(target);
  setBetMessage();
  save();
  render();
  toast(`Apuesta repetida: ${money(target)}`);

  els.betSpot.classList.remove('is-repeat');
  void els.betSpot.offsetWidth;
  els.betSpot.classList.add('is-repeat');
  setTimeout(() => els.betSpot.classList.remove('is-repeat'), 520);
}

function quickDeal() {
  if (state.phase !== 'betting' || state.busy || state.locked) return;

  if (state.bet < MIN_BET) {
    const target = state.lastBet;
    if (target < MIN_BET) {
      toast('Poné fichas y tocá dos veces para repartir');
      return;
    }
    if (target > state.balance) {
      toast(`No te alcanza para repetir ${money(target)}`);
      return;
    }
    state.bet = target;
    state.roundBet = 0;
    playChip(target);
    setBetMessage();
    save();
    render();
  }

  deal();
}

function allBet() {
  if (state.phase !== 'betting' || state.balance < MIN_BET) return;
  if (state.bet === state.balance) return;

  state.bet = state.balance;
  state.roundBet = 0;
  els.betSpot.classList.remove('is-win', 'is-lose', 'is-push');
  sound.play('allin');
  setBetMessage();
  save();
  render();

  els.betSpot.classList.remove('is-allin');
  void els.betSpot.offsetWidth;
  els.betSpot.classList.add('is-allin');
  setTimeout(() => els.betSpot.classList.remove('is-allin'), 800);
}

/* ---------- Ronda ---------- */

function drawCard() {
  if (!state.shoe.length) state.shoe = shuffle(createShoe(DECKS));
  return state.shoe.pop();
}

async function deal() {
  if (state.phase !== 'betting' || state.busy || state.locked) return;
  if (state.bet < MIN_BET || state.bet > state.balance) return;

  if (state.shoe.length < RESHUFFLE_AT) state.shoe = shuffle(createShoe(DECKS));

  state.busy = true;
  state.phase = 'dealing';
  state.roundBet = state.bet;
  state.lastBet = state.bet;
  state.balance -= state.bet;
  state.hands = [emptyHand(state.bet)];
  state.active = 0;
  state.dealer = [];
  state.holeHidden = true;
  setStatus('Repartiendo…', 'neutral');
  save();
  render();

  for (const who of ['player', 'dealer', 'player', 'dealer']) {
    await wait(240);
    if (who === 'player') state.hands[0].cards.push(drawCard());
    else state.dealer.push(drawCard());
    sound.play('card');
    render();
  }

  await wait(260);
  const hand = state.hands[0];
  hand.natural = isBlackjack(hand.cards);
  const dealerNatural = isBlackjack(state.dealer);

  if (hand.natural || dealerNatural) {
    state.holeHidden = false;
    setStatus(hand.natural && !dealerNatural ? '¡Blackjack!' : 'La banca tiene blackjack', 'neutral');
    render();
    await wait(520);
    endRound();
    return;
  }

  state.phase = 'player';
  state.busy = false;
  setStatus(statusForActive(), 'neutral');
  render();
}

function statusForActive() {
  if (state.hands.length <= 1) return 'Tu turno';
  const active = state.active + 1;
  return `Mano ${active} de ${state.hands.length}`;
}

async function advanceHand() {
  let next = state.hands.findIndex((hand, index) => index > state.active && !hand.done);
  // Un 21 en una mano dividida tambien se planta solo.
  while (next >= 0 && handValue(state.hands[next].cards) === 21) {
    state.hands[next].done = true;
    state.active = next;
    next = state.hands.findIndex((hand, index) => index > state.active && !hand.done);
  }
  if (next >= 0) {
    state.active = next;
    state.busy = false;
    setStatus(statusForActive(), 'neutral');
    render();
    return;
  }
  await dealerTurn();
}

async function hit() {
  if (state.phase !== 'player' || state.busy) return;
  const hand = activeHand();
  if (!hand || hand.done) return;

  state.busy = true;
  hand.cards.push(drawCard());
  sound.play('card');
  render();

  const total = handValue(hand.cards);
  if (total > 21) {
    hand.done = true;
    hand.result = 'lose';
    setStatus('Te pasaste', 'lose');
    render();
    await wait(620);
    await advanceHand();
    return;
  }
  if (total === 21) {
    hand.done = true;
    setStatus('21', 'neutral');
    render();
    await wait(480);
    await advanceHand();
    return;
  }

  state.busy = false;
  render();
}

async function stand() {
  if (state.phase !== 'player' || state.busy) return;
  state.busy = true;
  const hand = activeHand();
  if (hand) hand.done = true;
  await advanceHand();
}

async function doubleDown() {
  if (state.phase !== 'player' || state.busy) return;
  const hand = activeHand();
  if (!hand || hand.done || hand.cards.length !== 2 || hand.doubled) return;
  if (state.balance < hand.bet) return;

  state.busy = true;
  state.balance -= hand.bet;
  state.roundBet += hand.bet;
  hand.bet *= 2;
  hand.doubled = true;
  hand.cards.push(drawCard());
  sound.play('card');
  setStatus('Doblaste', 'neutral');
  save();
  render();

  await wait(560);
  hand.done = true;
  if (handValue(hand.cards) > 21) {
    hand.result = 'lose';
    setStatus('Te pasaste', 'lose');
    render();
    await wait(320);
  }
  await advanceHand();
}

async function splitHand() {
  if (state.phase !== 'player' || state.busy) return;
  const hand = activeHand();
  if (!hand || hand.done || !splitPossible(hand)) return;

  if (state.balance < hand.bet) {
    toast(`Necesitás ${money(hand.bet)} para dividir`);
    return;
  }

  const index = state.active;
  const isAces = hand.cards[0].rank === 'A';

  state.busy = true;
  state.balance -= hand.bet;
  state.roundBet += hand.bet;

  const newHand = emptyHand(hand.bet);
  newHand.cards.push(hand.cards.pop());
  if (isAces) {
    hand.noResplit = true;
    newHand.noResplit = true;
  }
  state.hands.splice(index + 1, 0, newHand);

  setStatus('Dividiste', 'neutral');
  save();
  render();

  await wait(280);
  hand.cards.push(drawCard());
  newHand.cards.push(drawCard());
  sound.play('card');
  setStatus('Dividiste', 'neutral');
  render();
  await wait(360);

  if (isAces) {
    hand.done = true;
    newHand.done = true;
    await wait(300);
    await dealerTurn();
    return;
  }

  state.active = index;
  if (handValue(hand.cards) === 21) {
    hand.done = true;
    await advanceHand();
    return;
  }

  state.busy = false;
  setStatus(statusForActive(), 'neutral');
  render();
}

async function dealerTurn() {
  state.phase = 'dealer';
  state.holeHidden = false;
  state.busy = true;
  setStatus('Juega la banca…', 'neutral');
  render();

  await wait(620);
  const allBusted = state.hands.every((hand) => handValue(hand.cards) > 21);
  if (!allBusted) {
    while (dealerShouldHit(state.dealer)) {
      state.dealer.push(drawCard());
      sound.play('card');
      render();
      await wait(640);
    }
  }

  await wait(360);
  endRound();
}

function endRound() {
  const single = state.hands.length === 1;
  let payout = 0;
  let net = 0;

  for (const hand of state.hands) {
    const outcome = settleHand(hand.cards, state.dealer, hand.bet, { blackjack: hand.natural });
    hand.settled = true;
    hand.result = outcome.result;
    hand.net = outcome.net;
    hand.blackjack = outcome.blackjack === true;
    payout += outcome.payout;
    net += outcome.net;
  }
  state.balance += payout;

  const hand = state.hands[0];
  const playerBust = single && handValue(hand.cards) > 21;
  const dealerBust = handValue(state.dealer) > 21;
  let text = '';
  let tone = 'neutral';

  if (net > 0) {
    tone = 'win';
    if (single && hand.blackjack) text = `¡Blackjack! Ganaste ${money(net)}`;
    else if (single && dealerBust) text = `La banca se pasó. Ganaste ${money(net)}`;
    else if (single) text = `Ganaste ${money(net)}`;
    else text = `Ganaste ${money(net)} en total`;
  } else if (net < 0) {
    tone = 'lose';
    if (playerBust) text = `Te pasaste de 21. Perdiste ${money(-net)}`;
    else if (single && isBlackjack(state.dealer)) {
      text = `Blackjack de la banca. Perdiste ${money(-net)}`;
    } else if (single) text = `Perdiste ${money(-net)}`;
    else text = `Perdiste ${money(-net)} en total`;
  } else {
    const mixed = state.hands.some((item) => item.result !== 'push');
    tone = 'neutral';
    text = single || !mixed ? `Empate. Recuperás ${money(payout)}` : 'Quedaste igual';
  }

  state.phase = 'betting';
  state.busy = false;
  state.holeHidden = false;
  state.active = 0;

  if (state.bet > state.balance) state.bet = state.balance;
  if (state.bet < MIN_BET) state.bet = 0;

  state.locked = true;
  setStatus(text, tone);
  save();
  animateWallet(tone);
  render();

  animateSpot(tone);
  if (net > 0) {
    floatGain(`+${money(net)}`);
    sound.play(single && hand.blackjack ? 'blackjack' : 'win');
  } else if (net < 0) {
    sound.play('lose');
  } else {
    sound.play('push');
  }

  maybeTopUp();

  setTimeout(() => {
    state.locked = false;
    renderControls();
  }, 750);
}

/* ---------- Saldo diario ---------- */

function maybeTopUp() {
  if (state.phase !== 'betting') return false;

  const today = dayKey();
  const result = dailyTopUp({
    balance: state.balance,
    lastTopUp: state.lastTopUp,
    today,
    floor: DAILY_FLOOR,
  });

  if (!result.applied) return false;

  state.balance = result.balance;
  state.lastTopUp = today;
  if (state.bet > state.balance) state.bet = state.balance;
  setBetMessage();
  save();
  render();
  toast(`Bono diario: +${money(result.credited)} hasta ${money(DAILY_FLOOR)}`);
  return true;
}

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function tick() {
  if (!els.noFundsPanel.hidden) {
    els.countdown.textContent = formatDuration(msUntilNextDay());
  }
  maybeTopUp();
}

/* ---------- Feedback ---------- */

let toastTimer = 0;
let toastHideTimer = 0;

function toast(text) {
  clearTimeout(toastTimer);
  clearTimeout(toastHideTimer);
  els.toast.textContent = text;
  els.toast.hidden = false;
  requestAnimationFrame(() => els.toast.classList.add('is-visible'));

  toastTimer = setTimeout(() => {
    els.toast.classList.remove('is-visible');
    toastHideTimer = setTimeout(() => {
      els.toast.hidden = true;
    }, 220);
  }, 3400);
}

function animateWallet(tone) {
  if (tone !== 'win' && tone !== 'lose') return;
  const cls = tone === 'win' ? 'is-up' : 'is-down';
  els.balance.classList.remove('is-up', 'is-down');
  void els.balance.offsetWidth;
  els.balance.classList.add(cls);
  setTimeout(() => els.balance.classList.remove(cls), 800);
}

/* ---------- Instalación (PWA / iOS) ---------- */

const standalone =
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS =
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let installPrompt = null;

function renderInstall() {
  const canPrompt = Boolean(installPrompt);

  els.installBtn.hidden = standalone || (!canPrompt && !isIOS);
  if (!els.installBtn.hidden) {
    els.installBtn.setAttribute(
      'aria-label',
      canPrompt ? 'Instalar aplicación' : 'Cómo agregar a la pantalla de inicio',
    );
  }

  els.sheetInstallBtn.hidden = !canPrompt || standalone;
  els.installSteps.hidden = true;
  els.installSteps.replaceChildren();

  if (standalone) {
    els.installStatus.textContent = 'Ya estás usando la app instalada.';
    return;
  }
  if (canPrompt) {
    els.installStatus.textContent = 'Tu navegador permite instalarla con un toque.';
    return;
  }
  if (isIOS) {
    els.installStatus.textContent = 'En iPhone o iPad se agrega desde Safari:';
    const steps = [
      'Abrí esta página en Safari.',
      'Tocá el botón Compartir.',
      'Elegí “Agregar a pantalla de inicio”.',
      'Tocá “Agregar”.',
    ];
    for (const text of steps) {
      const li = document.createElement('li');
      li.textContent = text;
      els.installSteps.append(li);
    }
    els.installSteps.hidden = false;
    return;
  }
  els.installStatus.textContent =
    'Desde el menú del navegador elegí “Instalar aplicación” o “Agregar a la pantalla de inicio”.';
}

async function promptInstall() {
  if (!installPrompt) {
    openSheet(true);
    return;
  }
  const prompt = installPrompt;
  installPrompt = null;
  try {
    prompt.prompt();
    await prompt.userChoice;
  } catch {
    /* el navegador canceló */
  }
  renderInstall();
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  renderInstall();
});

window.addEventListener('appinstalled', () => {
  installPrompt = null;
  renderInstall();
  toast('App instalada');
});

/* ---------- Hoja de ajustes ---------- */

let lastFocused = null;
let lastFocusedAdd = null;

function showResetConfirm(show) {
  els.resetConfirm.hidden = !show;
  els.resetBtn.hidden = show;
}

function openSheet(scrollToInstall = false) {
  lastFocused = document.activeElement;
  renderInstall();
  els.sheet.hidden = false;
  document.body.classList.add('has-sheet');
  els.sheetClose.focus({ preventScroll: true });
  if (scrollToInstall) {
    setTimeout(() => {
      els.installStatus.scrollIntoView({ block: 'center' });
    }, 80);
  }
}

function closeSheet() {
  els.sheet.hidden = true;
  showResetConfirm(false);
  if (els.addSheet.hidden) document.body.classList.remove('has-sheet');
  if (lastFocused && typeof lastFocused.focus === 'function') {
    lastFocused.focus({ preventScroll: true });
  }
}

/* ---------- Beta: agregar fichas ---------- */

let addAmount = 0;
let addStack = [];

function renderAddSheet() {
  els.addTotal.textContent = money(addAmount);
  els.addAfter.textContent =
    addAmount > 0
      ? `${money(state.balance)} → ${money(state.balance + addAmount)}`
      : `Saldo: ${money(state.balance)}`;
  els.addConfirm.disabled = addAmount <= 0;
  els.addConfirm.textContent = addAmount > 0 ? `Agregar ${money(addAmount)}` : 'Agregar fichas';
  els.addUndo.disabled = addStack.length === 0;
  els.addClear.disabled = addStack.length === 0;
}

function openAddSheet() {
  lastFocusedAdd = document.activeElement;
  addAmount = 0;
  addStack = [];
  renderAddSheet();
  els.addSheet.hidden = false;
  document.body.classList.add('has-sheet');
  els.addClose.focus({ preventScroll: true });
}

function closeAddSheet() {
  els.addSheet.hidden = true;
  if (els.sheet.hidden) document.body.classList.remove('has-sheet');
  if (lastFocusedAdd && typeof lastFocusedAdd.focus === 'function') {
    lastFocusedAdd.focus({ preventScroll: true });
  }
}

function addFundsChip(value) {
  if (!Number.isFinite(value) || value <= 0) return;
  addStack.push(value);
  addAmount += value;
  playChip(value);
  renderAddSheet();
}

function undoAddFunds() {
  const value = addStack.pop();
  if (!value) return;
  addAmount = Math.max(0, addAmount - value);
  sound.play('tick');
  renderAddSheet();
}

function confirmAddFunds() {
  if (addAmount <= 0) return;

  state.balance += addAmount;
  if (state.phase === 'betting' && state.status.text === '') setBetMessage();
  save();
  render();

  // renderChips ya avisa y suena cuando se desbloquea una ficha nueva.
  if (lastUnlocked.length) {
    toast(`Agregaste ${money(addAmount)} · nueva ficha de ${money(Math.max(...lastUnlocked))}`);
  } else {
    toast(`Agregaste ${money(addAmount)}`);
    sound.play('unlockTier');
  }
  closeAddSheet();
}

/* ---------- Gestos ---------- */

const GESTURE_EDGE = 28;
const SWIPE_MIN = 64;
const SWIPE_LEFT_MIN = 80;
const SWIPE_ALLIN_MIN = 90;
const SWIPE_ALLIN_HINT = 45;
const DRAG_MAX = 150;
const SWIPE_MAX_MS = 900;
const DRAG_MAX_MS = 2500;
const TAP_MAX_MS = 500;
const DOUBLE_TAP_MS = 450;
const DOUBLE_TAP_DIST = 40;

let gesture = null;
let lastTap = { t: 0, x: 0, y: 0 };
let hintTimer = 0;

function gesturesAvailable() {
  return state.gestures && !document.body.classList.contains('has-sheet');
}

function showGestureHint(text) {
  const hint = els.gestureHint;
  if (!hint) return;
  clearTimeout(hintTimer);
  hint.textContent = text;
  hint.hidden = false;
  requestAnimationFrame(() => hint.classList.add('is-visible'));
  els.table.classList.add('is-gesturing');
}

function hideGestureHint() {
  const hint = els.gestureHint;
  if (!hint) return;
  hint.classList.remove('is-visible');
  els.table.classList.remove('is-gesturing');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => {
    hint.hidden = true;
  }, 180);
}

function swipeDirection(start, dx, dy) {
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  if (start.mode === 'bet') {
    if (dx <= -SWIPE_ALLIN_MIN && adx > ady * 1.15) return 'left';
    if (start.canClear && dy >= 52 && ady > adx * 1.15) return 'down';
    return '';
  }

  if (dy >= SWIPE_MIN && ady > adx * 1.15) return 'down';
  if (dy <= -SWIPE_MIN && ady > adx * 1.15) return 'up';
  if (dx <= -SWIPE_LEFT_MIN && adx > ady * 1.15) return 'left';
  if (dx >= SWIPE_MIN && adx > ady * 1.15) return 'right';
  return '';
}

function gestureHintText(start, direction) {
  if (start.mode === 'bet') {
    return direction === 'left' ? '← All in' : '↓ Limpiar';
  }
  if (direction === 'down') return '↓ Pedir';
  if (direction === 'up') return '↑ Plantarse';
  if (direction === 'right') {
    const hand = activeHand();
    const ready =
      splitPossible(hand) && hand && state.balance >= hand.bet;
    return ready ? '→ Dividir' : '→ Dividir (no disponible)';
  }
  return els.doubleBtn.disabled ? '← Doblar (no disponible)' : '← Doblar';
}

function setBetDrag(dx) {
  if (!els.betChips) return;
  els.betChips.style.transform = dx ? `translateX(${dx}px)` : '';
  els.betSpot.classList.toggle('is-dragging', Boolean(dx));
}

function onTablePointerDown(event) {
  if (!gesturesAvailable()) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  if (event.isPrimary === false) return;

  // Si un gesto anterior quedo colgado (pointerup perdido), no frena la mesa.
  if (gesture) {
    gesture = null;
    setBetDrag(0);
    hideGestureHint();
  }

  const x = event.clientX;
  const y = event.clientY;
  // Deja libre el borde: ahi el sistema usa el gesto de atras.
  if (x < GESTURE_EDGE || x > window.innerWidth - GESTURE_EDGE) return;
  if (y < GESTURE_EDGE || y > window.innerHeight - GESTURE_EDGE) return;

  const betting = state.phase === 'betting';
  if (!betting && state.phase !== 'player') return;

  const onSpot = Boolean(event.target.closest('.bet-spot'));
  const canClear =
    state.bet > 0 ||
    state.roundBet > 0 ||
    state.hands.some((hand) => hand.cards.length > 0) ||
    state.dealer.length > 0;

  const now = performance.now();
  const near = Math.hypot(x - lastTap.x, y - lastTap.y) < DOUBLE_TAP_DIST;
  // El doble toque se mide entre toques, sin contar lo que dura cada uno.
  const doubleTap = betting && lastTap.t > 0 && now - lastTap.t < DOUBLE_TAP_MS && near;

  gesture = {
    id: event.pointerId,
    x0: x,
    y0: y,
    t0: now,
    mode: betting ? 'bet' : 'play',
    onSpot,
    canClear,
    doubleTap,
    direction: '',
  };

  try {
    els.table.setPointerCapture(event.pointerId);
  } catch {
    /* algunos navegadores no lo permiten */
  }
}

function onTablePointerMove(event) {
  if (!gesture || event.pointerId !== gesture.id) return;

  const dx = event.clientX - gesture.x0;
  const dy = event.clientY - gesture.y0;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx < 8 && ady < 8) return;

  if (gesture.mode === 'bet' && gesture.onSpot) {
    const dragging = dx < 0 && adx > ady;
    setBetDrag(dragging ? Math.max(-DRAG_MAX, dx) : 0);
  }

  const direction = swipeDirection(gesture, dx, dy);
  // El aviso de All in aparece antes del umbral para que se vea que va.
  const hint =
    !direction && gesture.mode === 'bet' && dx <= -SWIPE_ALLIN_HINT && adx > ady * 1.15
      ? 'left'
      : direction;
  if (hint === gesture.direction) return;
  gesture.direction = hint;

  if (hint) showGestureHint(gestureHintText(gesture, hint));
  else hideGestureHint();
}

function onTablePointerUp(event) {
  if (!gesture || event.pointerId !== gesture.id) return;

  const start = gesture;
  gesture = null;
  try {
    els.table.releasePointerCapture(event.pointerId);
  } catch {
    /* ya no estaba capturado */
  }
  hideGestureHint();
  setBetDrag(0);

  const dx = event.clientX - start.x0;
  const dy = event.clientY - start.y0;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  const elapsed = performance.now() - start.t0;

  if (start.mode === 'bet') {
    if (adx < 12 && ady < 12) {
      if (elapsed <= TAP_MAX_MS) {
        if (start.doubleTap) {
          lastTap = { t: 0, x: 0, y: 0 };
          quickDeal();
        } else {
          lastTap = { t: performance.now(), x: start.x0, y: start.y0 };
        }
      } else {
        lastTap = { t: 0, x: 0, y: 0 };
      }
      return;
    }

    // Un arrastre no cuenta como toque.
    lastTap = { t: 0, x: 0, y: 0 };
    if (elapsed > DRAG_MAX_MS) return;
  } else if (elapsed > SWIPE_MAX_MS) {
    return;
  }

  const direction = swipeDirection(start, dx, dy);
  if (!direction) {
    if (start.mode === 'bet' && dx <= -SWIPE_ALLIN_HINT && adx > ady * 1.15) {
      toast('Arrastrá un poco más a la izquierda para All in');
    }
    return;
  }

  if (start.mode === 'bet') {
    if (direction === 'left') allBet();
    else if (direction === 'down') clearBet();
    return;
  }

  if (direction === 'down') hit();
  else if (direction === 'up') stand();
  else if (direction === 'right') {
    if (els.splitBtn.hidden || els.splitBtn.disabled) {
      toast('Necesitás dos cartas del mismo valor y saldo para dividir');
      return;
    }
    splitHand();
  } else if (direction === 'left') {
    if (els.doubleBtn.disabled) {
      toast('Para doblar necesitás 2 cartas y saldo suficiente');
      return;
    }
    doubleDown();
  }
}

function onTablePointerCancel(event) {
  if (!gesture || event.pointerId !== gesture.id) return;
  gesture = null;
  lastTap = { t: 0, x: 0, y: 0 };
  hideGestureHint();
  setBetDrag(0);
}

els.table.addEventListener('pointerdown', onTablePointerDown);
els.table.addEventListener('pointermove', onTablePointerMove);
els.table.addEventListener('pointerup', onTablePointerUp);
els.table.addEventListener('pointercancel', onTablePointerCancel);
els.table.addEventListener('lostpointercapture', (event) => {
  if (!gesture || gesture.id !== event.pointerId) return;
  gesture = null;
  hideGestureHint();
  setBetDrag(0);
});
els.table.addEventListener('contextmenu', (event) => event.preventDefault());

// Safari viejo ignora user-scalable=no: sus eventos de pellizco se cortan aca.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
}
document.addEventListener(
  'wheel',
  (event) => {
    if (event.ctrlKey) event.preventDefault();
  },
  { passive: false },
);

/* ---------- Eventos ---------- */

els.themeBtn.addEventListener('click', () => {
  state.theme = resolvedTheme() === 'dark' ? 'light' : 'dark';
  applyTheme();
  savePrefs();
});

els.soundBtn.addEventListener('click', () => {
  state.sound = !state.sound;
  applySound();
  savePrefs();
  if (state.sound) sound.play('toggle');
});

els.gesturesBtn.addEventListener('click', () => {
  state.gestures = !state.gestures;
  applyGestures();
  savePrefs();
  sound.play('toggle');
  toast(state.gestures ? 'Gestos activados' : 'Gestos desactivados · seguí con los botones');
});

els.addFundsBtn.addEventListener('click', openAddSheet);
els.addClose.addEventListener('click', closeAddSheet);
els.addUndo.addEventListener('click', undoAddFunds);
els.addClear.addEventListener('click', () => {
  addAmount = 0;
  addStack = [];
  sound.play('tick');
  renderAddSheet();
});
els.addConfirm.addEventListener('click', confirmAddFunds);

els.addChips.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip) return;
  addFundsChip(Number(chip.dataset.value));
});

els.addSheet.addEventListener('click', (event) => {
  if (event.target.closest('[data-close-add]')) closeAddSheet();
});

els.resetBtn.addEventListener('click', () => showResetConfirm(true));
els.resetCancel.addEventListener('click', () => {
  showResetConfirm(false);
  els.resetBtn.focus({ preventScroll: true });
});
els.resetGo.addEventListener('click', () => {
  resetting = true;
  try {
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* sin almacenamiento */
  }
  location.reload();
});

els.installBtn.addEventListener('click', promptInstall);
els.sheetInstallBtn.addEventListener('click', promptInstall);
els.menuBtn.addEventListener('click', () => openSheet());
els.sheetClose.addEventListener('click', closeSheet);
els.noFundsRulesBtn.addEventListener('click', () => openSheet());

els.sheet.addEventListener('click', (event) => {
  if (event.target.closest('[data-close]')) closeSheet();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!els.addSheet.hidden) closeAddSheet();
  else if (!els.sheet.hidden) closeSheet();
});

els.chips.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip) return;
  const value = Number(chip.dataset.value);
  if (Number.isFinite(value)) addChips(value, chip);
});

els.clearBetBtn.addEventListener('click', clearBet);
els.repeatBetBtn.addEventListener('click', repeatBet);
els.maxBetBtn.addEventListener('click', allBet);
els.dealBtn.addEventListener('click', deal);
els.hitBtn.addEventListener('click', hit);
els.standBtn.addEventListener('click', stand);
els.doubleBtn.addEventListener('click', doubleDown);
els.splitBtn.addEventListener('click', splitHand);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    maybeTopUp();
    tick();
  }
});

window.addEventListener('pagehide', save);

/* ---------- Arranque ---------- */

applyTheme();
applySound();
applyGestures();
buildAddChips();
unlockSoundOnGesture();
applyInitialState();

function applyInitialState() {
  if (state.bet > state.balance) state.bet = state.balance;
  if (state.bet < MIN_BET) state.bet = 0;
  if (els.appVersion) els.appVersion.textContent = `versión ${APP_VERSION}`;
  maybeTopUp();
  if (state.balance < MIN_BET) setStatus('', 'neutral');
  else setBetMessage();
  render();
  renderInstall();
  tick();
  setInterval(tick, 1000);
  scheduleGestureHint();
}

function scheduleGestureHint() {
  if (!state.gestures || state.seenGestureHint || state.balance < MIN_BET) return;
  setTimeout(() => {
    if (!state.gestures) return;
    toast('Doble toque reparte · ← all in · ↓ limpiar');
    state.seenGestureHint = true;
    savePrefs();
  }, 1400);
}

if ('serviceWorker' in navigator) {
  const secure =
    location.protocol === 'https:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1';
  if (secure) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js', { updateViaCache: 'none' })
        .then((registration) => {
          let lastCheck = 0;
          const checkUpdate = () => {
            if (document.hidden) return;
            const now = Date.now();
            if (now - lastCheck < 5 * 60 * 1000) return;
            lastCheck = now;
            registration.update().catch(() => {});
          };
          document.addEventListener('visibilitychange', checkUpdate);
          window.addEventListener('focus', checkUpdate);
        })
        .catch(() => {});
    });
  }
}
