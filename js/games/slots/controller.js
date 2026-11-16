// Controlador compartido de las dos máquinas de 6×5.
// La página elige el juego con <body data-slot-game="tactica|pulso">.
// Todo lo particular (reglas, pagos, tema, íconos) vive en games/.

import { normalizeBonus, resolveSpin } from './core/spin.js';
import { TACTICA_GAME } from './games/tactica.js';
import { PULSO_GAME } from './games/pulso.js';
import { TACTICA_ART } from './games/tactica.art.js';
import { PULSO_ART } from './games/pulso.art.js';
import {
  CHIP_TIERS,
  DAILY_FLOOR,
  formatMoney,
  msUntilNextDay,
} from '../../core/money.js';
import { PROGRESS_KEY, SLOT_BONUS_PREFIX, removeStored } from '../../core/storage.js';
import { readStored, writeStored } from '../../core/storage.js';
import { loadPrefs, savePrefs as saveStoredPrefs } from '../../core/prefs.js';
import {
  applyDailyTopUp,
  loadProgress,
  saveProgress as saveStoredProgress,
} from '../../core/wallet.js';
import {
  animateWallet as animateWalletUI,
  applyGestures as applyGesturesUI,
  applySoundState,
  applyTheme as applyThemeUI,
  createInstallUI,
  createSheetUI,
  createToast,
  formatDuration,
  resolvedTheme,
  setVersion,
  watchTheme,
} from '../../core/ui.js';
import {
  chipIndex,
  createAddFundsSheet,
  makeChip,
} from '../../core/chips.js';
import { GESTURE_EDGE, TAP_MAX_MS, isDoubleTap } from '../../core/gestures.js';
import { sound, unlockSoundOnGesture } from '../../sound.js';

const APP_VERSION = 'v3.1';

const SLOT_MIN_BET = 5;
const SLOT_DEFAULT_BET = 10;
const BET_TIERS = [5, 10, 25, 100, 500];

const SPEEDS = [
  { label: 'Lenta', factor: 1.35 },
  { label: 'Normal', factor: 1 },
  { label: 'Rápida', factor: 0.6 },
];

// T.column es el escalón entre columnas: la grilla cae de a una.
const T = { column: 70, drop: 300, win: 430, fall: 250, between: 260, bonus: 520 };
// Duración de la animación CSS, a velocidad normal. Se escala con la velocidad.
const DROP_MS = 340;
const FALL_MS = 300;

const GAME_ID = document.body.dataset.slotGame === 'pulso' ? 'pulso' : 'tactica';
const GAME = GAME_ID === 'pulso' ? PULSO_GAME : TACTICA_GAME;
const ART = GAME_ID === 'pulso' ? PULSO_ART : TACTICA_ART;
const COPY = GAME.copy;
const BET_KEY = `${GAME_ID}Bet`;
const BONUS_KEY = `${SLOT_BONUS_PREFIX}${GAME_ID}`;

const money = formatMoney;

let resetting = false;
// Solo se reescribe el bono guardado si la partida lo tocó: así una recarga
// apenas abre la página no borra los giros gratis que ya estaban en disco.
let bonusTouched = false;

const els = {
  balance: document.getElementById('balance'),
  cabinet: document.getElementById('cabinet'),
  grid: document.getElementById('grid'),
  result: document.getElementById('result'),
  resultTitle: document.getElementById('resultTitle'),
  resultDetail: document.getElementById('resultDetail'),
  multiplierBadge: document.getElementById('multiplierBadge'),
  multiplierValue: document.getElementById('multiplierValue'),
  bonusBadge: document.getElementById('bonusBadge'),
  bonusCount: document.getElementById('bonusCount'),
  gameMark: document.getElementById('gameMark'),
  gameName: document.getElementById('gameName'),
  gameSub: document.getElementById('gameSub'),
  brandName: document.getElementById('brandName'),
  gamesBtn: document.getElementById('gamesBtn'),
  betPanel: document.getElementById('betPanel'),
  betAmountBtn: document.getElementById('betAmountBtn'),
  betChips: document.getElementById('betChips'),
  spinBtn: document.getElementById('spinBtn'),
  speedBtn: document.getElementById('speedBtn'),
  autoStop: document.getElementById('autoStop'),
  autoButtons: Array.from(document.querySelectorAll('[data-auto]')),
  noFundsPanel: document.getElementById('noFundsPanel'),
  countdown: document.getElementById('countdown'),
  noFundsRulesBtn: document.getElementById('noFundsRulesBtn'),
  themeBtn: document.getElementById('themeBtn'),
  soundBtn: document.getElementById('soundBtn'),
  gesturesBtn: document.getElementById('gesturesBtn'),
  gesturesValue: document.getElementById('gesturesValue'),
  themeColor: document.getElementById('themeColor'),
  installBtn: document.getElementById('installBtn'),
  menuBtn: document.getElementById('menuBtn'),
  toast: document.getElementById('toast'),
  sheet: document.getElementById('sheet'),
  sheetClose: document.getElementById('sheetClose'),
  sheetInstallBtn: document.getElementById('sheetInstallBtn'),
  installStatus: document.getElementById('installStatus'),
  installSteps: document.getElementById('installSteps'),
  appVersion: document.getElementById('appVersion'),
  rulesList: document.getElementById('rulesList'),
  payTable: document.getElementById('payTable'),
  rtpInfo: document.getElementById('rtpInfo'),
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
  betSheet: document.getElementById('betSheet'),
  betClose: document.getElementById('betClose'),
  betTotal: document.getElementById('betTotal'),
  betAfter: document.getElementById('betAfter'),
  betInput: document.getElementById('betInput'),
  betHint: document.getElementById('betHint'),
  betSheetChips: document.getElementById('betSheetChips'),
  betMax: document.getElementById('betMax'),
  betClear: document.getElementById('betClear'),
  betUse: document.getElementById('betUse'),
};

/* ---------- Apuesta ---------- */

function normalizeBet(value, balance) {
  if (!(balance >= SLOT_MIN_BET)) return 0;
  const amount = Math.floor(Number(value));
  if (!Number.isFinite(amount) || amount < SLOT_MIN_BET) {
    return Math.min(SLOT_DEFAULT_BET, balance);
  }
  return Math.min(amount, balance);
}

function betOptions(balance) {
  return BET_TIERS.filter((tier) => tier <= balance);
}

/* ---------- Estado ---------- */

const storedPrefs = loadPrefs();
const storedProgress = loadProgress();
const savedBet = storedPrefs[BET_KEY] ?? storedPrefs.slotsBet;

const state = {
  balance: storedProgress.balance,
  lastTopUp: storedProgress.lastTopUp,
  theme: storedPrefs.theme,
  sound: storedPrefs.sound,
  gestures: storedPrefs.gestures,
  seenSlotHint: storedPrefs.seenSlotHint === true,
  speed: [0, 1, 2].includes(storedPrefs.slotSpeed) ? storedPrefs.slotSpeed : 1,
  bet: normalizeBet(savedBet, storedProgress.balance),
  bonus: normalizeBonus(GAME, readStored(BONUS_KEY), {
    bet: normalizeBet(savedBet, storedProgress.balance) || SLOT_DEFAULT_BET,
  }),
  spinning: false,
  inBonus: false,
  auto: 0,
  autoTimer: 0,
  displayBalance: storedProgress.balance,
  grid: null,
  cells: [],
  turbo: false,
  bonusSpin: 0,
};

function saveProgress() {
  if (resetting) return;
  saveStoredProgress({ balance: state.balance, lastTopUp: state.lastTopUp });
}

function savePrefs(patch = {}) {
  saveStoredPrefs({
    theme: state.theme,
    sound: state.sound,
    gestures: state.gestures,
    slotSpeed: state.speed,
    seenSlotHint: state.seenSlotHint,
    [BET_KEY]: state.bet,
    game: GAME_ID,
    ...patch,
  });
}

function saveBonus() {
  if (resetting) return;
  bonusTouched = true;
  if (state.bonus) writeStored(BONUS_KEY, state.bonus);
  else removeStored(BONUS_KEY);
}

function ensureBet() {
  if (state.spinning) return;
  const next = normalizeBet(state.bet || SLOT_DEFAULT_BET, state.balance);
  if (next === state.bet) return;
  state.bet = next;
  savePrefs();
}

/* ---------- Tema, sonido y gestos ---------- */

function applyTheme() {
  applyThemeUI({ theme: state.theme, themeColor: els.themeColor, themeBtn: els.themeBtn });
}

watchTheme(() => state.theme, applyTheme);

function applySound() {
  applySoundState({ enabled: state.sound, soundBtn: els.soundBtn });
}

function applyGestures() {
  applyGesturesUI({
    enabled: state.gestures,
    gesturesBtn: els.gesturesBtn,
    gesturesValue: els.gesturesValue,
  });
}

/* ---------- Grilla ---------- */

function idleGrid() {
  return Array.from({ length: GAME.reels }, () =>
    Array.from(
      { length: GAME.rows },
      () => GAME.symbols[Math.floor(Math.random() * GAME.symbols.length)],
    ),
  );
}

function artFor(id) {
  const art = ART[id] || '<circle cx="12" cy="12" r="8" fill="currentColor"/>';
  return `<svg class="slot-cell__art" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${art}</svg>`;
}

function buildGrid() {
  els.grid.replaceChildren();
  state.cells = [];
  for (let col = 0; col < GAME.reels; col += 1) {
    const column = [];
    for (let row = 0; row < GAME.rows; row += 1) {
      const cell = document.createElement('div');
      cell.className = 'slot-cell';
      cell.dataset.symbol = '';
      cell.style.gridColumn = String(col + 1);
      cell.style.gridRow = String(row + 1);
      cell.style.setProperty('--col', col);
      cell.style.setProperty('--row', row);
      els.grid.append(cell);
      column.push(cell);
    }
    state.cells.push(column);
  }
}

function setCell(cell, id) {
  if (!id) return;
  if (cell.dataset.symbol === id) return;
  cell.dataset.symbol = id;
  cell.className = `slot-cell slot-sym--${id}${GAME.specialIds.has(id) ? ' is-special' : ''}`;
  cell.innerHTML = artFor(id);
}

function clearWins() {
  for (const column of state.cells) {
    for (const cell of column) cell.classList.remove('is-win');
  }
}

function markWins(wins) {
  for (const win of wins) {
    for (const [col, row] of win.cells) {
      const cell = state.cells[col] && state.cells[col][row];
      if (cell) cell.classList.add('is-win');
    }
  }
}

/** Pinta una grilla completa (o solo algunas columnas) y anima lo que cambió. */
function renderGrid(grid, { drop = false, fall = false, cols = null } = {}) {
  const previous = state.grid;
  const changed = [];
  const columns = cols || Array.from({ length: GAME.reels }, (_, index) => index);

  if (!state.grid) state.grid = grid.map((column) => column.slice());

  for (const col of columns) {
    for (let row = 0; row < GAME.rows; row += 1) {
      const id = grid[col][row];
      const cell = state.cells[col][row];
      if (previous && previous[col][row] === id) continue;
      setCell(cell, id);
      changed.push(cell);
    }
    state.grid[col] = grid[col].slice();
  }

  // Al saltear el giro, todo aterriza ya: el resultado no cambia, solo el viaje.
  if (state.turbo || (!drop && !fall) || !changed.length) return;

  const duration = (drop ? DROP_MS : FALL_MS) * animationScale();
  const className = drop ? 'is-drop' : 'is-falling';

  for (const cell of changed) {
    cell.classList.remove(className);
    void cell.offsetWidth;
    cell.classList.add(className);
  }
  setTimeout(() => {
    for (const cell of changed) cell.classList.remove(className);
  }, duration + 140);
}

function visibleOrbs(spin) {
  if (!state.grid) return [];
  return spin.orbs.filter(({ col, row, value }) => {
    const id = state.grid[col][row];
    return id === GAME.multipliers.id && value > 0;
  });
}

function multBadgeTotal(spin) {
  const orbs = visibleOrbs(spin);
  const sum = orbs.reduce((total, orb) => total + orb.value, 0);
  if (state.inBonus && GAME.multipliers.bonus === 'accumulate') {
    // En el bono de Táctica manda el acumulado, no solo lo que se ve.
    const total = spin.multiplier.totalMultiplier || 0;
    return total > 0 ? total : sum;
  }
  return sum;
}

function refreshMultiplierBadge(spin) {
  const total = spin ? multBadgeTotal(spin) : 0;
  els.multiplierBadge.hidden = total <= 0;
  if (total > 0) els.multiplierValue.textContent = String(total);
}

function updateGridLabel() {
  if (!state.grid) return;
  const counts = new Map();
  for (const column of state.grid) {
    for (const id of column) counts.set(id, (counts.get(id) || 0) + 1);
  }
  const parts = [];
  for (const [id, count] of counts) {
    const meta = GAME.symbolMeta[id];
    const label = meta
      ? meta.label
      : id === GAME.scatter.id
        ? GAME.scatter.label
        : GAME.multipliers
          ? GAME.multipliers.label
          : 'especial';
    parts.push(`${count} ${label}`);
  }
  els.grid.setAttribute('aria-label', `Grilla: ${parts.join(', ')}`);
}

/* ---------- Saldo y controles ---------- */

function renderWallet(tone = null) {
  els.balance.textContent = money(state.displayBalance);
  if (tone) animateWalletUI(els.balance, tone);
}

let betChipSignature = '';

function renderBetChips() {
  const options = betOptions(state.balance);
  const signature = options.join(',');
  if (signature !== betChipSignature) {
    betChipSignature = signature;
    els.betChips.replaceChildren(...options.map((value) => makeChip(value, { verb: 'Apostar' })));
  }
  els.betChips.hidden = options.length === 0;

  for (const chip of els.betChips.children) {
    const active = Number(chip.dataset.value) === state.bet;
    chip.classList.toggle('is-active', active);
    chip.setAttribute('aria-pressed', String(active));
    chip.disabled = state.spinning;
  }
}

function renderBet() {
  els.betAmountBtn.textContent = money(state.bet);
  els.betAmountBtn.disabled = state.spinning;
  els.betAmountBtn.setAttribute('aria-label', `Apuesta ${money(state.bet)}: cambiar monto`);
  els.speedBtn.textContent = `Velocidad: ${SPEEDS[state.speed].label}`;
  els.speedBtn.disabled = state.spinning;

  for (const button of els.autoButtons) {
    button.disabled = state.spinning;
    button.classList.toggle('is-active', state.auto > 0);
  }
  els.autoStop.hidden = state.auto <= 0;
}

function renderBonus() {
  const active = Boolean(state.bonus);
  els.bonusBadge.hidden = !active;
  if (active) els.bonusCount.textContent = String(state.bonus.remaining);
}

function renderControls() {
  const empty = !state.spinning && !state.bonus && state.balance < SLOT_MIN_BET;
  els.betPanel.hidden = empty;
  els.noFundsPanel.hidden = !empty;

  const canSpin =
    !state.spinning && !state.bonus && state.bet >= SLOT_MIN_BET && state.bet <= state.balance;
  els.spinBtn.disabled = !canSpin;
  els.spinBtn.textContent = state.spinning ? 'Girando…' : state.bonus ? 'Bono en curso' : 'Girar';
  els.spinBtn.setAttribute(
    'aria-label',
    state.spinning || state.bonus
      ? 'Girando'
      : canSpin
        ? `Girar con ${money(state.bet)}`
        : 'Girar',
  );
}

function render() {
  renderWallet();
  renderBet();
  renderBetChips();
  renderBonus();
  renderControls();
  renderCountdown();
  placeToast();
}

/**
 * El aviso flota sobre la barra de título de la máquina: no tapa ni la grilla,
 * ni el resultado, ni el botón Girar. Se mide la máquina porque su alto cambia
 * con la pantalla.
 */
const TOAST_LIFT = 32;

function placeToast() {
  const top = els.cabinet.getBoundingClientRect().top;
  const bottom = window.innerHeight - top - TOAST_LIFT;
  document.documentElement.style.setProperty(
    '--slot-toast-bottom',
    `${Math.max(16, Math.round(bottom))}px`,
  );
}

function setResult(title, detail, tone = 'neutral') {
  els.resultTitle.textContent = title;
  els.resultDetail.textContent = detail;
  els.result.dataset.tone = tone;
}

function maybeTopUp() {
  const result = applyDailyTopUp(state.balance, state.lastTopUp);
  if (!result.applied) return false;

  state.balance = result.balance;
  state.displayBalance = result.balance;
  state.lastTopUp = result.today;
  ensureBet();
  saveProgress();
  savePrefs();
  render();
  toast(`Bono diario: +${money(result.credited)} hasta ${money(DAILY_FLOOR)}`);
  return true;
}

/* ---------- Tiempos ---------- */

/** Esperas vivas: al saltear el giro se cancelan y resuelven todas juntas. */
const pendingWaits = new Set();

function speedFactor() {
  return SPEEDS[state.speed].factor;
}

function animationScale() {
  return state.turbo ? 0 : speedFactor();
}

function wait(ms) {
  if (state.turbo) return Promise.resolve();
  const delay = Math.max(16, Math.round(ms * speedFactor()));
  return new Promise((resolve) => {
    const entry = { resolve, id: 0 };
    entry.id = setTimeout(() => {
      pendingWaits.delete(entry);
      resolve();
    }, delay);
    pendingWaits.add(entry);
  });
}

/** Pasa la velocidad a CSS: la caída en sí también respeta la config. */
function applyAnimationSpeed() {
  const scale = animationScale();
  els.grid.style.setProperty('--slot-drop', `${Math.round(DROP_MS * scale)}ms`);
  els.grid.style.setProperty('--slot-fall', `${Math.round(FALL_MS * scale)}ms`);
}

/** Doble toque durante el giro: se saltea la animación, no el resultado. */
function skipAnimation() {
  if (state.turbo || !state.spinning) return;
  state.turbo = true;
  for (const entry of pendingWaits) {
    clearTimeout(entry.id);
    entry.resolve();
  }
  pendingWaits.clear();
  els.grid.classList.add('is-turbo');
  applyAnimationSpeed();
  for (const column of state.cells) {
    for (const cell of column) cell.classList.remove('is-drop', 'is-falling');
  }
}

function endTurbo() {
  state.turbo = false;
  els.grid.classList.remove('is-turbo');
  applyAnimationSpeed();
}

/* ---------- Animación ---------- */

async function animateSpin(spin) {
  endTurbo();

  // La grilla cae columna por columna; el escalón y la caída siguen la velocidad.
  if (state.sound) sound.play('spin');
  for (let col = 0; col < GAME.reels; col += 1) {
    renderGrid(spin.initialGrid, { drop: true, cols: [col] });
    await wait(T.column);
  }

  refreshMultiplierBadge(spin);
  updateGridLabel();
  await wait(T.drop);

  for (const step of spin.steps) {
    markWins(step.wins);
    if (state.sound && !state.turbo) {
      sound.play(step.index === 0 ? 'win' : 'cascade', { level: step.index });
    }
    const count = step.wins.reduce((total, win) => total + win.count, 0);
    setResult(`Cascada ${step.index + 1}`, `${count} fichas · +${money(step.pay)}`, 'win');
    await wait(T.win);

    clearWins();
    renderGrid(step.after, { fall: true });
    refreshMultiplierBadge(spin);
    updateGridLabel();
    await wait(T.fall);
  }

  refreshMultiplierBadge(spin);
  endTurbo();
}

function winDetail(spin) {
  const parts = [];
  if (spin.cascades > 0) {
    parts.push(`${spin.cascades} cascada${spin.cascades === 1 ? '' : 's'}`);
  }
  if (spin.multiplier.applied) parts.push(`×${spin.multiplier.value}`);
  if (spin.scatter.pay > 0) {
    parts.push(`${spin.scatter.count} ${GAME.scatter.label} · ${money(spin.scatter.pay)}`);
  }
  if (!parts.length) return 'Probá de nuevo';
  return parts.join(' · ');
}

function finishSpin(spin) {
  endTurbo();
  state.displayBalance = state.balance;
  renderBonus();

  if (spin.totalWin > 0) {
    setResult(`Ganaste ${money(spin.totalWin)}`, winDetail(spin), 'win');
    const ratio = spin.totalWin / Math.max(1, spin.bet);
    if (state.sound) sound.play(ratio >= 25 ? 'bigWin' : 'win');
  } else {
    setResult('No hubo premio', 'Probá de nuevo · desde 8 iguales', 'neutral');
  }

  if (spin.freeSpins.triggered) {
    const free = spin.nextBonus ? spin.nextBonus.remaining : GAME.scatter.freeSpins;
    toast(`¡${free} giros gratis!`);
    if (state.sound) sound.play('bonus');
  }

  renderWallet(spin.net > 0 ? 'win' : spin.net < 0 ? 'lose' : null);
  render();
}

/* ---------- Giros ---------- */

async function runBonus(bonus) {
  state.bonus = normalizeBonus(GAME, bonus, { bet: bonus.bet });
  if (!state.bonus) {
    render();
    return;
  }

  state.inBonus = true;
  state.spinning = true;
  state.bonusSpin = 0;
  saveBonus();
  render();
  toast(`Bono: ${state.bonus.remaining} giros por jugar`);
  await wait(T.between);

  let guard = 0;
  let won = 0;
  while (state.bonus && guard < 400) {
    guard += 1;
    state.bonusSpin += 1;
    const spin = resolveSpin(GAME, {
      bet: state.bonus.bet,
      bonus: state.bonus,
      capture: true,
    });

    // La plata y los giros restantes se guardan antes de animar: si recargás
    // en medio del giro, no se cobra dos veces.
    state.balance += spin.net;
    state.bonus = spin.nextBonus;
    // El saldo visible no adelanta el premio: recién sube al cerrar la animación.
    state.displayBalance = state.balance - spin.totalWin;
    saveProgress();
    saveBonus();

    setResult(
      `Giro gratis ${state.bonusSpin}`,
      state.bonus ? `Quedan ${state.bonus.remaining}` : 'Último giro',
      'spin',
    );
    render();
    await animateSpin(spin);

    state.displayBalance = state.balance;
    const win = spin.totalWin;
    won += win;
    if (win > 0) {
      const label = spin.multiplier.applied ? `×${spin.multiplier.value} · ` : '';
      setResult(`Ganaste ${money(win)}`, `${label}${winDetail(spin)}`, 'win');
    } else {
      setResult('Sin premio en este giro', 'Sigue el bono', 'neutral');
    }
    renderBonus();
    renderWallet(win > 0 ? 'win' : null);
    if (state.sound && win > 0) sound.play(win / spin.bet >= 25 ? 'bigWin' : 'win');

    if (spin.freeSpins.added) {
      toast(`+${spin.freeSpins.added} giros por los ${spin.scatter.count} ${GAME.scatter.label}`);
      if (state.sound) sound.play('bonus');
    }

    if (state.bonus) await wait(T.bonus);
  }

  // Si se tocó la guarda, el bono se corta acá para no quedar trabado.
  const spinsPlayed = state.bonusSpin;
  state.bonus = null;
  state.inBonus = false;
  state.spinning = false;
  state.bonusSpin = 0;
  saveBonus();
  refreshMultiplierBadge();
  setResult(
    won > 0 ? `Bono: ${money(won)}` : 'Bono terminado',
    `${spinsPlayed} giros gratis · de vuelta al juego base`,
    won > 0 ? 'win' : 'neutral',
  );
  render();
  toast('Bono terminado');
}

async function spin() {
  if (state.spinning) return;
  if (state.bonus) {
    await runBonus(state.bonus);
    return;
  }

  ensureBet();
  if (state.bet < SLOT_MIN_BET || state.bet > state.balance) {
    render();
    toast('No te alcanza para esa apuesta');
    return;
  }

  const bet = state.bet;
  const result = resolveSpin(GAME, { bet, capture: true });

  // El saldo se aplica al instante: si recargás en medio del giro, ya está.
  state.balance += result.net;
  // Lo que se ve todavía no incluye el premio: se muestra al cerrar la cascada.
  state.displayBalance = state.balance - result.totalWin;
  state.spinning = true;
  state.turbo = false;
  saveProgress();
  savePrefs();
  render();

  setResult('Girando…', `${money(bet)} en juego`, 'spin');
  await animateSpin(result);
  finishSpin(result);

  state.spinning = false;

  if (result.nextBonus) {
    await runBonus(result.nextBonus);
  }

  if (state.auto > 0) {
    state.auto -= 1;
    if (state.auto > 0) scheduleAuto();
    else stopAuto(false);
  }
  render();
}

/* ---------- Auto ---------- */

function scheduleAuto() {
  clearTimeout(state.autoTimer);
  state.autoTimer = setTimeout(() => {
    state.autoTimer = 0;
    if (state.auto > 0) spin();
  }, Math.max(180, T.between * SPEEDS[state.speed].factor));
}

function startAuto(count) {
  if (state.spinning || state.bonus) {
    toast('Esperá a que termine el giro');
    return;
  }
  state.auto = count;
  render();
  spin();
}

function stopAuto(notify = true) {
  clearTimeout(state.autoTimer);
  state.autoTimer = 0;
  if (state.auto > 0 && notify) toast('Auto detenido');
  state.auto = 0;
  render();
}

/* ---------- Countdown ---------- */

function renderCountdown() {
  if (els.noFundsPanel.hidden) return;
  els.countdown.textContent = formatDuration(msUntilNextDay());
}

/* ---------- Feedback ---------- */

const toast = createToast(els.toast);

/* ---------- Instalación ---------- */

const installUI = createInstallUI({
  installBtn: els.installBtn,
  sheetInstallBtn: els.sheetInstallBtn,
  installSteps: els.installSteps,
  installStatus: els.installStatus,
  openSheet: (scroll) => sheetUI.open(scroll),
  toast,
});

const renderInstall = installUI.renderInstall;

/* ---------- Hoja de ajustes ---------- */

function showResetConfirm(show) {
  els.resetConfirm.hidden = !show;
  els.resetBtn.hidden = show;
}

const sheetUI = createSheetUI({
  sheet: els.sheet,
  sheetClose: els.sheetClose,
  installStatus: els.installStatus,
  renderInstall,
  onClose: () => showResetConfirm(false),
});

const openSheet = sheetUI.open;
const closeSheet = sheetUI.close;

/* ---------- Hoja de otro monto ---------- */

let lastFocusedBet = null;

function readBetDraft() {
  const base = state.balance;
  const text = els.betInput.value;
  const raw = Number(text.replace(/\D/g, ''));

  if (base < SLOT_MIN_BET) return { bet: null, reason: 'nofunds', raw: 0 };
  if (!text) return { bet: null, reason: 'empty', raw: 0 };
  if (!Number.isFinite(raw) || raw < SLOT_MIN_BET) return { bet: null, reason: 'min', raw };
  if (raw > base) return { bet: base, reason: 'max', raw };
  return { bet: raw, reason: '', raw };
}

function renderBetSheet() {
  const base = state.balance;
  const draft = readBetDraft();
  const preview = draft.bet ?? draft.raw;

  els.betTotal.textContent = money(preview);
  els.betAfter.textContent = draft.bet
    ? `Saldo después: ${money(base - draft.bet)}`
    : `Tenés ${money(base)}`;
  els.betUse.disabled = !draft.bet;
  els.betUse.textContent = draft.bet ? `Apostar ${money(draft.bet)}` : 'Elegí un monto';

  els.betHint.textContent =
    draft.reason === 'nofunds'
      ? 'No te alcanza para la apuesta mínima.'
      : draft.reason === 'min'
        ? `El mínimo es ${money(SLOT_MIN_BET)}.`
        : draft.reason === 'max'
          ? `Tu saldo es ${money(base)}: se apuesta todo.`
          : draft.reason === 'empty'
            ? `Entre ${money(SLOT_MIN_BET)} y ${money(base)}.`
            : base <= SLOT_MIN_BET
              ? 'Se apuesta todo tu saldo.'
              : 'El monto se guarda para la próxima vez.';
}

function buildBetSheetChips() {
  const options = betOptions(state.balance);
  els.betSheetChips.replaceChildren(
    ...options.map((value) => makeChip(value, { verb: 'Usar' })),
  );
  els.betSheetChips.hidden = options.length === 0;
}

function openBetSheet() {
  if (state.spinning) return;
  lastFocusedBet = document.activeElement;

  const initial = state.bet >= SLOT_MIN_BET ? state.bet : SLOT_DEFAULT_BET;
  els.betInput.value = initial >= SLOT_MIN_BET ? String(initial) : '';

  buildBetSheetChips();
  renderBetSheet();
  els.betSheet.hidden = false;
  document.body.classList.add('has-sheet');
  els.betInput.focus({ preventScroll: true });
  els.betInput.select();
  if (state.sound) sound.play('tick');
}

function closeBetSheet() {
  els.betSheet.hidden = true;
  if (els.sheet.hidden && els.addSheet.hidden) {
    document.body.classList.remove('has-sheet');
  }
  if (lastFocusedBet && typeof lastFocusedBet.focus === 'function') {
    lastFocusedBet.focus({ preventScroll: true });
  }
}

function applyBetDraft() {
  const { bet } = readBetDraft();
  if (!bet) return;

  state.bet = bet;
  savePrefs();
  closeBetSheet();
  render();
  toast(`Apuesta ${money(bet)}`);
  if (state.sound) sound.play('unlockTier');
}

/* ---------- Agregar fichas ---------- */

const addFundsUI = createAddFundsSheet({
  addFundsBtn: els.addFundsBtn,
  addSheet: els.addSheet,
  addClose: els.addClose,
  addTotal: els.addTotal,
  addAfter: els.addAfter,
  addConfirm: els.addConfirm,
  addUndo: els.addUndo,
  addClear: els.addClear,
  addChips: els.addChips,
  getBase: () => state.balance,
  onChip: (value) => {
    if (state.sound) sound.play('chip', { index: chipIndex(value) });
  },
  onUndo: () => {
    if (state.sound) sound.play('tick');
  },
  onClear: () => {
    if (state.sound) sound.play('tick');
  },
  onConfirm: (amount) => {
    state.balance += amount;
    state.displayBalance += amount;
    ensureBet();
    saveProgress();
    savePrefs();
    render();
    toast(`Agregaste ${money(amount)}`);
    if (state.sound) sound.play('unlockTier');
  },
  isOtherSheetOpen: () => !els.sheet.hidden || !els.betSheet.hidden,
});

const closeAddSheet = addFundsUI.close;

/* ---------- Cambiar de juego ---------- */

function switchGame() {
  if (state.spinning) {
    toast(state.bonus ? 'Terminá el bono para cambiar' : 'Esperá a que termine el giro');
    return;
  }
  stopAuto(false);
  savePrefs({ game: '' });
  location.href = 'index.html';
}

/* ---------- Gestos ---------- */

let activeGesture = null;
let lastTap = { t: 0, x: 0, y: 0 };

function gesturesEnabled() {
  return (
    state.gestures &&
    els.sheet.hidden &&
    els.addSheet.hidden &&
    els.betSheet.hidden
  );
}

function clearGesture() {
  if (!activeGesture) return;
  const { id } = activeGesture;
  activeGesture = null;
  els.cabinet.classList.remove('is-gesturing');
  try {
    els.cabinet.releasePointerCapture(id);
  } catch {
    /* ya no estaba capturado */
  }
}

function onCabinetPointerDown(event) {
  if (!gesturesEnabled()) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  if (event.isPrimary === false) return;

  if (activeGesture) clearGesture();

  const x = event.clientX;
  const y = event.clientY;
  if (x < GESTURE_EDGE || x > window.innerWidth - GESTURE_EDGE) return;
  if (y < GESTURE_EDGE || y > window.innerHeight - GESTURE_EDGE) return;

  const now = performance.now();
  activeGesture = {
    id: event.pointerId,
    x0: x,
    y0: y,
    t0: now,
    doubleTap: isDoubleTap(lastTap, now, x, y),
  };

  els.cabinet.classList.add('is-gesturing');
  try {
    els.cabinet.setPointerCapture(event.pointerId);
  } catch {
    /* algunos navegadores no lo permiten */
  }
}

function onCabinetPointerUp(event) {
  const gesture = activeGesture;
  if (!gesture || event.pointerId !== gesture.id) return;

  activeGesture = null;
  els.cabinet.classList.remove('is-gesturing');
  try {
    els.cabinet.releasePointerCapture(event.pointerId);
  } catch {
    /* ya no estaba capturado */
  }

  const dx = event.clientX - gesture.x0;
  const dy = event.clientY - gesture.y0;
  if (Math.hypot(dx, dy) >= 12) {
    lastTap = { t: 0, x: 0, y: 0 };
    return;
  }

  if (performance.now() - gesture.t0 > TAP_MAX_MS) {
    lastTap = { t: 0, x: 0, y: 0 };
    return;
  }

  if (gesture.doubleTap) {
    lastTap = { t: 0, x: 0, y: 0 };
    if (state.spinning) {
      skipAnimation();
      if (state.sound) sound.play('tick');
    } else {
      spin();
    }
    return;
  }

  lastTap = { t: performance.now(), x: gesture.x0, y: gesture.y0 };
}

function onCabinetPointerCancel(event) {
  if (!activeGesture || event.pointerId !== activeGesture.id) return;
  clearGesture();
  lastTap = { t: 0, x: 0, y: 0 };
}

els.cabinet.addEventListener('pointerdown', onCabinetPointerDown);
els.cabinet.addEventListener('pointerup', onCabinetPointerUp);
els.cabinet.addEventListener('pointercancel', onCabinetPointerCancel);
els.cabinet.addEventListener('lostpointercapture', (event) => {
  if (!activeGesture || activeGesture.id !== event.pointerId) return;
  clearGesture();
});
els.cabinet.addEventListener('contextmenu', (event) => event.preventDefault());

/* ---------- Tabla de pagos ---------- */

function payLabel(value) {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded).replace('.', ',');
}

function buildPayTable() {
  const rows = [];

  for (const id of GAME.symbols) {
    const meta = GAME.symbolMeta[id];
    const table = GAME.pays[id];
    const row = document.createElement('div');
    row.className = 'slot-pay';

    const symbol = document.createElement('span');
    symbol.className = `slot-pay__sym slot-sym--${id}`;
    symbol.setAttribute('aria-hidden', 'true');
    symbol.innerHTML = artFor(id);

    const name = document.createElement('span');
    name.className = 'slot-pay__name';
    name.textContent = meta.label;

    const tiers = document.createElement('span');
    tiers.className = 'slot-pay__tiers';
    for (const [count, pay] of Object.entries(table)) {
      const item = document.createElement('span');
      item.className = 'slot-pay__tier';
      item.innerHTML = `<b>${count}+</b> ×${payLabel(pay)}`;
      tiers.append(item);
    }

    row.append(symbol, name, tiers);
    rows.push(row);
  }

  const scatterRow = document.createElement('div');
  scatterRow.className = 'slot-pay slot-pay--special';
  const scatterSym = document.createElement('span');
  scatterSym.className = `slot-pay__sym slot-sym--${GAME.scatter.id}`;
  scatterSym.setAttribute('aria-hidden', 'true');
  scatterSym.innerHTML = artFor(GAME.scatter.id);
  const scatterName = document.createElement('span');
  scatterName.className = 'slot-pay__name';
  scatterName.textContent = GAME.scatter.label;
  const scatterTiers = document.createElement('span');
  scatterTiers.className = 'slot-pay__tiers';
  const scatterEntries = Object.entries(GAME.scatter.pays);
  for (const [index, [count, pay]] of scatterEntries.entries()) {
    const item = document.createElement('span');
    item.className = 'slot-pay__tier';
    const plus = index === scatterEntries.length - 1 ? '+' : '';
    item.innerHTML = `<b>${count}${plus}</b> ×${payLabel(pay)}`;
    scatterTiers.append(item);
  }
  scatterRow.append(scatterSym, scatterName, scatterTiers);

  const multRow = document.createElement('div');
  multRow.className = 'slot-pay slot-pay--special';
  const multSym = document.createElement('span');
  multSym.className = `slot-pay__sym slot-sym--${GAME.multipliers.id}`;
  multSym.setAttribute('aria-hidden', 'true');
  multSym.innerHTML = artFor(GAME.multipliers.id);
  const multName = document.createElement('span');
  multName.className = 'slot-pay__name';
  multName.textContent = GAME.multipliers.label;
  const multTiers = document.createElement('span');
  multTiers.className = 'slot-pay__tiers';
  const multItem = document.createElement('span');
  multItem.className = 'slot-pay__tier';
  const values = GAME.multipliers.values;
  multItem.textContent = `×${values[0]} a ×${values[values.length - 1]}`;
  multTiers.append(multItem);
  multRow.append(multSym, multName, multTiers);

  els.payTable.replaceChildren(...rows, scatterRow, multRow);

  const percent = (GAME.rtpTarget * 100).toFixed(0);
  els.rtpInfo.textContent =
    `A largo plazo devuelve alrededor del ${percent}% de lo apostado. ` +
    `${COPY.bonusLabel} con ${GAME.scatter.trigger} ${GAME.scatter.label}.`;
}

function buildCopy() {
  document.title = `${GAME.label} · Mesa`;
  els.gameMark.innerHTML = artFor('mark');
  els.gameName.textContent = GAME.label;
  els.gameSub.textContent = COPY.subtitle;
  els.brandName.textContent = GAME.label;
  els.rulesList.replaceChildren(
    ...COPY.rules.map((text) => {
      const li = document.createElement('li');
      li.textContent = text;
      return li;
    }),
  );
}

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
  if (state.sound) sound.play('toggle');
  toast(state.gestures ? 'Gestos activados' : 'Gestos desactivados · seguí con los botones');
});

els.menuBtn.addEventListener('click', () => openSheet());
els.sheetClose.addEventListener('click', closeSheet);
els.sheet.addEventListener('click', (event) => {
  if (event.target.closest('[data-close]')) closeSheet();
});
els.noFundsRulesBtn.addEventListener('click', () => openSheet());
els.gamesBtn.addEventListener('click', switchGame);

els.betChips.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip || chip.disabled) return;
  state.bet = normalizeBet(Number(chip.dataset.value), state.balance);
  savePrefs();
  if (state.sound) sound.play('chip', { index: chipIndex(Number(chip.dataset.value)) });
  render();
});

els.betAmountBtn.addEventListener('click', openBetSheet);
els.spinBtn.addEventListener('click', () => spin());

els.speedBtn.addEventListener('click', () => {
  state.speed = (state.speed + 1) % SPEEDS.length;
  savePrefs();
  applyAnimationSpeed();
  renderBet();
  if (state.sound) sound.play('tick');
  toast(`Velocidad ${SPEEDS[state.speed].label}`);
});

for (const button of els.autoButtons) {
  button.addEventListener('click', () => startAuto(Number(button.dataset.auto)));
}
els.autoStop.addEventListener('click', () => stopAuto());

els.betClose.addEventListener('click', closeBetSheet);
els.betSheet.addEventListener('click', (event) => {
  if (event.target.closest('[data-close-bet]')) closeBetSheet();
});
els.betInput.addEventListener('input', () => {
  const digits = els.betInput.value.replace(/\D/g, '').slice(0, 9);
  if (digits !== els.betInput.value) els.betInput.value = digits;
  renderBetSheet();
});
els.betInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  applyBetDraft();
});
els.betSheetChips.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip) return;
  els.betInput.value = chip.dataset.value;
  renderBetSheet();
  if (state.sound) sound.play('chip', { index: chipIndex(Number(chip.dataset.value)) });
});
els.betMax.addEventListener('click', () => {
  els.betInput.value = String(state.balance);
  renderBetSheet();
  if (state.sound) sound.play('tick');
});
els.betClear.addEventListener('click', () => {
  els.betInput.value = '';
  renderBetSheet();
  els.betInput.focus({ preventScroll: true });
  if (state.sound) sound.play('tick');
});
els.betUse.addEventListener('click', applyBetDraft);

els.resetBtn.addEventListener('click', () => showResetConfirm(true));
els.resetCancel.addEventListener('click', () => {
  showResetConfirm(false);
  els.resetBtn.focus({ preventScroll: true });
});
els.resetGo.addEventListener('click', () => {
  resetting = true;
  stopAuto(false);
  removeStored(PROGRESS_KEY);
  removeStored(`${SLOT_BONUS_PREFIX}tactica`);
  removeStored(`${SLOT_BONUS_PREFIX}pulso`);
  savePrefs({ slotsBet: SLOT_DEFAULT_BET, tacticaBet: SLOT_DEFAULT_BET, pulsoBet: SLOT_DEFAULT_BET });
  location.reload();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!els.betSheet.hidden) closeBetSheet();
  else if (!els.addSheet.hidden) closeAddSheet();
  else if (!els.sheet.hidden) closeSheet();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  maybeTopUp();
  render();
});

window.addEventListener('pagehide', () => {
  if (resetting) return;
  // Solo el saldo y el bono: escribir las prefs acá volvería a guardar
  // `game` después de "Cambiar de juego" y el selector rebotaría.
  saveProgress();
  if (bonusTouched) saveBonus();
});

window.addEventListener('resize', placeToast);
if (typeof ResizeObserver === 'function') {
  const toastObserver = new ResizeObserver(() => placeToast());
  toastObserver.observe(els.betPanel);
  toastObserver.observe(els.noFundsPanel);
}

setInterval(() => {
  renderCountdown();
  maybeTopUp();
}, 1000);

// Safari viejo ignora user-scalable=no: sus eventos de pellizco se cortan acá.
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

/* ---------- Aviso de gestos ---------- */

function scheduleGestureHint() {
  if (!state.gestures || state.seenSlotHint || state.balance < SLOT_MIN_BET) return;
  setTimeout(() => {
    if (!state.gestures || state.seenSlotHint) return;
    if (!els.sheet.hidden || !els.addSheet.hidden || !els.betSheet.hidden) return;
    toast('Doble toque: otra tirada · saltea la caída');
    state.seenSlotHint = true;
    savePrefs();
  }, 1600);
}

/* ---------- Arranque ---------- */

applyTheme();
applySound();
applyGestures();
buildCopy();
buildGrid();
renderGrid(idleGrid());
applyAnimationSpeed();
buildPayTable();
buildAddFundsChips();
unlockSoundOnGesture();
if (els.appVersion) setVersion(els.appVersion, APP_VERSION);

function buildAddFundsChips() {
  els.addChips.replaceChildren(...CHIP_TIERS.map((tier) => makeChip(tier)));
}

ensureBet();
savePrefs();
maybeTopUp();
render();

if (state.bonus) {
  // Bono pendiente: se retoma solo, sin cobrar nada.
  setTimeout(() => {
    if (state.bonus) runBonus(state.bonus);
  }, 700);
} else {
  scheduleGestureHint();
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
