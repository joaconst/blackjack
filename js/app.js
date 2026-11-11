import {
  MIN_BET,
  START_BALANCE,
  DECKS,
  RESHUFFLE_AT,
  DAILY_FLOOR,
  CHIP_TIERS,
  SUIT_GLYPH,
  RANK_LABEL,
  SUIT_LABEL,
  createShoe,
  shuffle,
  handValue,
  isBlackjack,
  dealerShouldHit,
  roundPayout,
  dayKey,
  msUntilNextDay,
  dailyTopUp,
  availableChips,
  chipStack,
  formatMoney,
} from './engine.js';
import { sound, unlockSoundOnGesture } from './sound.js';

const STORAGE_KEY = 'blackjack.state.v1';
const money = formatMoney;
let resetting = false;

const els = {
  balance: document.getElementById('balance'),
  dealerCards: document.getElementById('dealerCards'),
  playerCards: document.getElementById('playerCards'),
  dealerScore: document.getElementById('dealerScore'),
  playerScore: document.getElementById('playerScore'),
  status: document.getElementById('status'),
  betPanel: document.getElementById('betPanel'),
  betAmount: document.getElementById('betAmount'),
  betSpot: document.getElementById('betSpot'),
  betChips: document.getElementById('betChips'),
  betTotal: document.getElementById('betTotal'),
  chips: document.getElementById('chips'),
  clearBetBtn: document.getElementById('clearBetBtn'),
  maxBetBtn: document.getElementById('maxBetBtn'),
  dealBtn: document.getElementById('dealBtn'),
  actionPanel: document.getElementById('actionPanel'),
  inPlay: document.getElementById('inPlay'),
  hitBtn: document.getElementById('hitBtn'),
  standBtn: document.getElementById('standBtn'),
  doubleBtn: document.getElementById('doubleBtn'),
  doubleTag: document.getElementById('doubleTag'),
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
  sheetInstallBtn: document.getElementById('sheetInstallBtn'),
  installStatus: document.getElementById('installStatus'),
  installSteps: document.getElementById('installSteps'),
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

function loadStored() {
  const fallback = {
    balance: START_BALANCE,
    bet: 0,
    lastTopUp: dayKey(),
    theme: 'auto',
    sound: true,
  };
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    raw = null;
  }
  if (!raw || typeof raw !== 'object') return fallback;

  return {
    balance:
      Number.isFinite(raw.balance) && raw.balance >= 0 ? Math.floor(raw.balance) : fallback.balance,
    bet: Number.isFinite(raw.bet) && raw.bet >= 0 ? Math.floor(raw.bet) : 0,
    lastTopUp: typeof raw.lastTopUp === 'string' ? raw.lastTopUp : fallback.lastTopUp,
    theme: raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : 'auto',
    sound: typeof raw.sound === 'boolean' ? raw.sound : true,
  };
}

const saved = loadStored();

const state = {
  ...saved,
  shoe: shuffle(createShoe(DECKS)),
  phase: 'betting', // betting | dealing | player | dealer
  player: [],
  dealer: [],
  holeHidden: false,
  roundBet: 0,
  busy: false,
  locked: false,
  status: { text: 'Hacé tu apuesta', tone: 'neutral' },
};

function save() {
  // Mientras se reinicia el progreso no hay que volver a escribir nada:
  // pagehide dispara save() justo despues de borrar el localStorage.
  if (resetting) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        balance: state.balance,
        bet: state.bet,
        lastTopUp: state.lastTopUp,
        theme: state.theme,
        sound: state.sound,
      }),
    );
  } catch {
    /* almacenamiento no disponible */
  }
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

function renderScores() {
  const player = state.player;
  if (player.length) {
    const value = handValue(player);
    els.playerScore.textContent = String(value);
    els.playerScore.classList.toggle('is-bust', value > 21);
    els.playerScore.classList.toggle('is-blackjack', isBlackjack(player));
  } else {
    els.playerScore.textContent = '\u2014';
    els.playerScore.classList.remove('is-bust', 'is-blackjack');
  }

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

function renderControls() {
  const betting = state.phase === 'betting';
  const dealing = state.phase === 'dealing';
  const outOfMoney = state.balance < MIN_BET;
  const showEmpty = betting && outOfMoney;

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
  els.clearBetBtn.disabled = !betting || state.bet <= 0;
  els.maxBetBtn.disabled =
    !betting || state.balance < MIN_BET || state.bet >= state.balance;

  els.inPlay.textContent = money(state.roundBet || state.bet);
  els.hitBtn.disabled = state.phase !== 'player' || state.busy;
  els.standBtn.disabled = state.phase !== 'player' || state.busy;

  const canDouble =
    state.phase === 'player' &&
    !state.busy &&
    state.player.length === 2 &&
    state.balance >= state.roundBet;

  els.doubleBtn.disabled = !canDouble;
  els.doubleTag.textContent = `+${money(state.roundBet || state.bet)}`;
}

function render() {
  els.balance.textContent = money(state.balance);
  els.betAmount.textContent = money(state.bet);
  renderCards(els.dealerCards, state.dealer, state.holeHidden);
  renderCards(els.playerCards, state.player, false);
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
  if (state.phase !== 'betting' || state.bet === 0) return;
  state.bet = 0;
  state.roundBet = 0;
  els.betSpot.classList.remove('is-win', 'is-lose', 'is-push');
  sound.play('tick');
  setBetMessage();
  save();
  render();
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
  state.balance -= state.bet;
  state.player = [];
  state.dealer = [];
  state.holeHidden = true;
  setStatus('Repartiendo…', 'neutral');
  save();
  render();

  for (const who of ['player', 'dealer', 'player', 'dealer']) {
    await wait(240);
    if (who === 'player') state.player.push(drawCard());
    else state.dealer.push(drawCard());
    sound.play('card');
    render();
  }

  await wait(260);
  const playerBJ = isBlackjack(state.player);
  const dealerBJ = isBlackjack(state.dealer);

  if (playerBJ || dealerBJ) {
    state.holeHidden = false;
    render();
    await wait(520);
    if (playerBJ && dealerBJ) finish('push');
    else if (playerBJ) finish('win', { blackjack: true });
    else finish('lose', { reason: 'dealerBlackjack' });
    return;
  }

  state.phase = 'player';
  state.busy = false;
  setStatus('Tu turno', 'neutral');
  render();
}

async function hit() {
  if (state.phase !== 'player' || state.busy) return;

  state.busy = true;
  state.player.push(drawCard());
  sound.play('card');
  render();

  const total = handValue(state.player);
  if (total > 21) {
    await wait(620);
    finish('lose', { reason: 'bust' });
    return;
  }
  if (total === 21) {
    await wait(480);
    await dealerTurn();
    return;
  }

  state.busy = false;
  render();
}

async function stand() {
  if (state.phase !== 'player' || state.busy) return;
  state.busy = true;
  await dealerTurn();
}

async function doubleDown() {
  if (state.phase !== 'player' || state.busy) return;
  if (state.player.length !== 2) return;
  if (state.balance < state.roundBet) return;

  state.busy = true;
  state.balance -= state.roundBet;
  state.roundBet *= 2;
  state.player.push(drawCard());
  sound.play('card');
  setStatus('Doblaste', 'neutral');
  save();
  render();

  await wait(560);
  if (handValue(state.player) > 21) {
    finish('lose', { reason: 'bust' });
    return;
  }
  await dealerTurn();
}

async function dealerTurn() {
  state.phase = 'dealer';
  state.holeHidden = false;
  state.busy = true;
  setStatus('Juega la banca…', 'neutral');
  render();

  await wait(620);
  while (dealerShouldHit(state.dealer)) {
    state.dealer.push(drawCard());
    render();
    await wait(640);
  }

  await wait(360);
  const player = handValue(state.player);
  const dealer = handValue(state.dealer);

  if (dealer > 21) finish('win', { reason: 'dealerBust' });
  else if (player > dealer) finish('win');
  else if (player < dealer) finish('lose');
  else finish('push');
}

function finish(result, { blackjack = false, reason = '' } = {}) {
  const bet = state.roundBet;
  const { payout, net } = roundPayout(result, bet, { blackjack });
  state.balance += payout;

  let text = '';
  let tone = 'neutral';

  if (result === 'win') {
    tone = 'win';
    if (blackjack) text = `¡Blackjack! Ganaste ${money(net)}`;
    else if (reason === 'dealerBust') text = `La banca se pasó. Ganaste ${money(net)}`;
    else text = `Ganaste ${money(net)}`;
  } else if (result === 'push') {
    text = `Empate. Recuperás ${money(bet)}`;
  } else {
    tone = 'lose';
    if (reason === 'bust') text = `Te pasaste de 21. Perdiste ${money(bet)}`;
    else if (reason === 'dealerBlackjack') text = `Blackjack de la banca. Perdiste ${money(bet)}`;
    else text = `Perdiste ${money(bet)}`;
  }

  state.phase = 'betting';
  state.busy = false;
  state.holeHidden = false;

  if (state.bet > state.balance) state.bet = state.balance;
  if (state.bet < MIN_BET) state.bet = 0;

  state.locked = true;
  setStatus(text, tone);
  save();
  animateWallet(tone);
  render();

  animateSpot(result === 'win' ? 'win' : result === 'push' ? 'push' : 'lose');
  if (result === 'win') {
    floatGain(`+${money(net)}`);
    sound.play(blackjack ? 'blackjack' : 'win');
  } else if (result === 'push') {
    sound.play('push');
  } else {
    sound.play('lose');
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

/* ---------- Eventos ---------- */

els.themeBtn.addEventListener('click', () => {
  state.theme = resolvedTheme() === 'dark' ? 'light' : 'dark';
  applyTheme();
  save();
});

els.soundBtn.addEventListener('click', () => {
  state.sound = !state.sound;
  applySound();
  save();
  if (state.sound) sound.play('toggle');
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
    localStorage.removeItem(STORAGE_KEY);
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
els.maxBetBtn.addEventListener('click', allBet);
els.dealBtn.addEventListener('click', deal);
els.hitBtn.addEventListener('click', hit);
els.standBtn.addEventListener('click', stand);
els.doubleBtn.addEventListener('click', doubleDown);

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
buildAddChips();
unlockSoundOnGesture();
applyInitialState();

function applyInitialState() {
  if (state.bet > state.balance) state.bet = state.balance;
  if (state.bet < MIN_BET) state.bet = 0;
  maybeTopUp();
  if (state.balance < MIN_BET) setStatus('', 'neutral');
  else setBetMessage();
  render();
  renderInstall();
  tick();
  setInterval(tick, 1000);
}

if ('serviceWorker' in navigator) {
  const secure =
    location.protocol === 'https:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1';
  if (secure) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}
