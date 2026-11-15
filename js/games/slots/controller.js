import {
  SLOT_DEFAULT_BET,
  SLOT_LINES,
  SLOT_MIN_BET,
  SLOT_STRIP,
  SLOT_SYMBOLS,
  gridForStops,
  normalizeSlotBet,
  slotBetOptions,
  slotHitChance,
  slotRtp,
  spinSlots,
} from './engine.js';
import { DAILY_FLOOR, formatMoney, msUntilNextDay } from '../../core/money.js';
import { PROGRESS_KEY, removeStored } from '../../core/storage.js';
import { loadPrefs as loadStoredPrefs, savePrefs as saveStoredPrefs } from '../../core/prefs.js';
import {
  applyDailyTopUp,
  loadProgress as loadStoredProgress,
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
  buildAddChips,
  chipIndex,
  createAddFundsSheet,
  makeChip,
} from '../../core/chips.js';
import { GESTURE_EDGE, TAP_MAX_MS, isDoubleTap } from '../../core/gestures.js';
import { sound, unlockSoundOnGesture } from '../../sound.js';

const APP_VERSION = 'v2.12';
const money = formatMoney;
const SPIN_DURATIONS = [860, 1010, 1160];
const SPIN_FAST = 0.28;
const SPIN_MIN_MS = 70;
const FILLER_CELLS = 9;
const INITIAL_STOPS = [4, 16, 26];

let resetting = false;

const els = {
  balance: document.getElementById('balance'),
  cabinet: document.getElementById('cabinet'),
  reels: document.getElementById('reels'),
  strips: ['strip0', 'strip1', 'strip2'].map((id) => document.getElementById(id)),
  result: document.getElementById('result'),
  resultTitle: document.getElementById('resultTitle'),
  resultDetail: document.getElementById('resultDetail'),
  lineLegend: document.getElementById('lineLegend'),
  betPanel: document.getElementById('betPanel'),
  betAmount: document.getElementById('betAmount'),
  betChips: document.getElementById('betChips'),
  betOtherBtn: document.getElementById('betOtherBtn'),
  spinBtn: document.getElementById('spinBtn'),
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
  switchGameBtn: document.getElementById('switchGameBtn'),
  sheetInstallBtn: document.getElementById('sheetInstallBtn'),
  installStatus: document.getElementById('installStatus'),
  installSteps: document.getElementById('installSteps'),
  appVersion: document.getElementById('appVersion'),
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

/* ---------- Almacenamiento ---------- */

const storedPrefs = loadStoredPrefs();
const storedProgress = loadStoredProgress();

const state = {
  balance: storedProgress.balance,
  lastTopUp: storedProgress.lastTopUp,
  theme: storedPrefs.theme,
  sound: storedPrefs.sound,
  gestures: storedPrefs.gestures,
  bet: normalizeSlotBet(storedPrefs.slotsBet, storedProgress.balance),
  seenSlotHint: storedPrefs.seenSlotHint === true,
  spinning: false,
  spinWin: 0,
  grid: null,
  stops: INITIAL_STOPS.slice(),
  run: null,
  frame: 0,
};

function saveProgress() {
  if (resetting) return;
  saveStoredProgress({
    balance: state.balance,
    lastTopUp: state.lastTopUp,
  });
}

function savePrefs() {
  saveStoredPrefs({
    theme: state.theme,
    sound: state.sound,
    gestures: state.gestures,
    slotsBet: state.bet,
    seenSlotHint: state.seenSlotHint,
    game: 'slots',
  });
}

/** Deja siempre una apuesta válida cuando el saldo alcanza. */
function ensureBet() {
  if (state.spinning) return;
  const wanted = state.bet >= SLOT_MIN_BET ? state.bet : SLOT_DEFAULT_BET;
  const next = normalizeSlotBet(wanted, state.balance);
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

/* ---------- Rodillos ---------- */

function cellNode(symbol) {
  const cell = document.createElement('div');
  cell.className = `slot-cell slot-sym--${symbol}`;

  const glyph = document.createElement('span');
  glyph.className = 'slot-cell__glyph';
  glyph.setAttribute('aria-hidden', 'true');
  glyph.textContent = SLOT_SYMBOLS[symbol].glyph;

  cell.append(glyph);
  return cell;
}

function fillStrip(element, symbols) {
  element.replaceChildren(...symbols.map(cellNode));
  element.style.transform = 'translateY(0)';
}

function updateReelLabel() {
  if (!state.grid) return;
  const text = state.grid
    .map((reel) => reel.map((symbol) => SLOT_SYMBOLS[symbol].label).join(', '))
    .join(' · ');
  els.reels.setAttribute('aria-label', `Rodillos: ${text}`);
}

function buildReels() {
  state.grid = gridForStops(state.stops);
  els.strips.forEach((element, index) => fillStrip(element, state.grid[index]));
  updateReelLabel();
}

function clearWinMarks() {
  for (const strip of els.strips) {
    for (const cell of strip.children) cell.classList.remove('is-win');
  }
}

function markWins(result) {
  clearWinMarks();
  for (const line of result.lines) {
    line.rows.forEach((row, index) => {
      const cell = els.strips[index].children[row];
      if (cell) cell.classList.add('is-win');
    });
  }
}

/* ---------- Saldo y apuesta ---------- */

function visibleBalance() {
  return state.spinning ? state.balance - state.spinWin : state.balance;
}

function renderWallet(tone = null) {
  els.balance.textContent = money(visibleBalance());
  if (tone) animateWalletUI(els.balance, tone);
}

/** Saldo antes del giro: mantiene estables las fichas mientras corren los rodillos. */
function betBase() {
  return state.spinning ? visibleBalance() + state.bet : state.balance;
}

let betChipSignature = '';

function renderBetChips() {
  const options = slotBetOptions(betBase());
  const signature = options.join(',');
  if (signature !== betChipSignature) {
    betChipSignature = signature;
    els.betChips.replaceChildren(
      ...options.map((value) => makeChip(value, { verb: 'Apostar' })),
    );
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
  els.betAmount.textContent = money(state.bet);
  const custom =
    state.bet >= SLOT_MIN_BET && !slotBetOptions(betBase()).includes(state.bet);
  els.betOtherBtn.textContent = custom ? money(state.bet) : 'Otro monto';
  els.betOtherBtn.classList.toggle('is-active', custom);
  els.betOtherBtn.disabled = state.spinning;
}

function renderControls() {
  const empty = !state.spinning && state.balance < SLOT_MIN_BET;
  els.betPanel.hidden = empty;
  els.noFundsPanel.hidden = !empty;

  const canSpin =
    !state.spinning && state.bet >= SLOT_MIN_BET && state.bet <= state.balance;
  els.spinBtn.disabled = !canSpin;
  els.spinBtn.textContent = state.spinning ? 'Girando…' : 'Girar';
  els.spinBtn.setAttribute(
    'aria-label',
    state.spinning ? 'Girando' : canSpin ? `Girar con ${money(state.bet)}` : 'Girar',
  );
}

function render() {
  renderWallet();
  renderBet();
  renderBetChips();
  renderControls();
  renderCountdown();
  placeToast();
}

/**
 * El aviso flota arriba del panel de apuesta: si queda abajo tapa el botón Girar.
 * Se mide el panel porque su alto cambia con la altura de la pantalla.
 */
function placeToast() {
  const panel = els.betPanel.hidden ? els.noFundsPanel : els.betPanel;
  if (!panel || panel.hidden) return;
  const bottom = window.innerHeight - panel.getBoundingClientRect().top + 10;
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
  state.lastTopUp = result.today;
  ensureBet();
  saveProgress();
  savePrefs();
  render();
  toast(`Bono diario: +${money(result.credited)} hasta ${money(DAILY_FLOOR)}`);
  return true;
}

/* ---------- Giro ---------- */

function winDetail(result) {
  return result.lines.map((line) => `${line.label} ×${line.multiplier}`).join(' · ');
}

function easeOutCubic(value) {
  return 1 - (1 - value) ** 3;
}

function finishReel(reel) {
  fillStrip(reel.element, reel.final);
  reel.reelElement.classList.add('is-stopped');
  setTimeout(() => reel.reelElement.classList.remove('is-stopped'), 220);
  if (state.sound) sound.play('tick');
}

function stepReels(now) {
  const run = state.run;
  if (!run) return;

  let pending = false;
  for (const reel of run.reels) {
    if (reel.done) continue;
    const progress = Math.min(1, (now - reel.startedAt) / reel.duration);
    const y = reel.from + (reel.to - reel.from) * easeOutCubic(progress);
    reel.currentY = y;
    reel.element.style.transform = `translateY(${y}px)`;

    if (progress >= 1) {
      reel.done = true;
      finishReel(reel);
    } else {
      pending = true;
    }
  }

  if (pending) state.frame = requestAnimationFrame(stepReels);
  else finishSpin(run);
}

function finishSpin(run) {
  state.run = null;
  state.frame = 0;
  state.spinning = false;
  state.grid = run.result.grid.map((reel) => reel.slice());
  state.stops = run.result.stops.slice();
  updateReelLabel();
  markWins(run.result);

  const win = state.spinWin;
  state.spinWin = 0;
  if (win > 0) {
    setResult(`Ganaste ${money(win)}`, winDetail(run.result), 'win');
  } else {
    setResult('No hubo premio', 'Probá de nuevo · 5 líneas fijas', 'neutral');
  }

  ensureBet();
  render();
  animateWalletUI(
    els.balance,
    run.result.net > 0 ? 'win' : run.result.net < 0 ? 'lose' : null,
  );

  if (win > 0 && state.sound) {
    sound.play(run.result.multiplier >= 25 ? 'blackjack' : 'win');
  }
}

function animateReels(result) {
  const now = performance.now();
  const run = { result, reels: [] };

  els.strips.forEach((element, index) => {
    const reelElement = element.parentElement;
    const cell = reelElement.clientHeight / 3 || 1;
    const start = state.grid ? state.grid[index] : gridForStops(state.stops)[index];
    const filler = Array.from(
      { length: FILLER_CELLS },
      () => SLOT_STRIP[Math.floor(Math.random() * SLOT_STRIP.length)],
    );
    const sequence = [...start, ...filler, ...result.grid[index]];

    fillStrip(element, sequence);
    run.reels.push({
      element,
      reelElement,
      from: 0,
      to: -(sequence.length - 3) * cell,
      startedAt: now,
      duration: SPIN_DURATIONS[index] || SPIN_DURATIONS[SPIN_DURATIONS.length - 1],
      currentY: 0,
      done: false,
      final: result.grid[index],
    });
  });

  state.run = run;
  state.frame = requestAnimationFrame(stepReels);
}

function spin() {
  if (state.spinning) return;
  if (state.balance < SLOT_MIN_BET) {
    render();
    return;
  }
  if (state.bet < SLOT_MIN_BET) ensureBet();
  if (state.bet > state.balance) state.bet = normalizeSlotBet(state.bet, state.balance);
  if (state.bet < SLOT_MIN_BET) {
    render();
    return;
  }

  const result = spinSlots({ bet: state.bet });

  // El saldo se aplica al instante: si recargás en medio del giro, no se pierde.
  state.balance += result.net;
  state.spinWin = result.win;
  state.spinning = true;
  saveProgress();
  savePrefs();

  setResult('Girando…', `${money(result.bet)} en juego`, 'spin');
  render();
  animateReels(result);
}

function accelerateSpin() {
  const run = state.run;
  if (!run) return;

  const now = performance.now();
  let changed = false;
  for (const reel of run.reels) {
    if (reel.done) continue;
    const remaining = Math.max(0, reel.duration - (now - reel.startedAt));
    if (remaining <= SPIN_MIN_MS) continue;
    reel.from = reel.currentY;
    reel.startedAt = now;
    reel.duration = Math.max(SPIN_MIN_MS, remaining * SPIN_FAST);
    changed = true;
  }
  if (changed && state.sound) sound.play('tick');
}

function repeatSpin() {
  if (state.spinning) return;
  if (state.balance < SLOT_MIN_BET) {
    render();
    return;
  }
  if (state.bet < SLOT_MIN_BET) {
    state.bet = normalizeSlotBet(SLOT_DEFAULT_BET, state.balance);
    if (state.bet < SLOT_MIN_BET) return;
    savePrefs();
    render();
  }
  spin();
}

/* ---------- Fichas beta ---------- */

function renderCountdown() {
  if (els.noFundsPanel.hidden) return;
  els.countdown.textContent = formatDuration(msUntilNextDay());
}

/* ---------- Feedback ---------- */

const toast = createToast(els.toast);

/* ---------- Instalación (PWA / iOS) ---------- */

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
  const options = slotBetOptions(state.balance);
  els.betSheetChips.replaceChildren(
    ...options.map((value) => makeChip(value, { verb: 'Usar' })),
  );
  els.betSheetChips.hidden = options.length === 0;
}

function openBetSheet() {
  if (state.spinning) return;
  lastFocusedBet = document.activeElement;

  const initial =
    state.bet >= SLOT_MIN_BET
      ? state.bet
      : normalizeSlotBet(SLOT_DEFAULT_BET, state.balance);
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

/* ---------- Fichas beta: hoja ---------- */

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
    toast('Esperá a que frenen los rodillos');
    return;
  }
  saveStoredPrefs({ game: '' });
  location.href = 'index.html';
}

/* ---------- Gestos de la máquina ---------- */

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
    if (state.spinning) accelerateSpin();
    else repeatSpin();
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

function buildPayTable() {
  const entries = Object.entries(SLOT_SYMBOLS).sort((a, b) => b[1].pay - a[1].pay);
  els.payTable.replaceChildren(
    ...entries.map(([id, info]) => {
      const row = document.createElement('div');
      row.className = 'slot-pay';

      const symbol = document.createElement('span');
      symbol.className = `slot-pay__sym slot-sym--${id}`;
      symbol.setAttribute('aria-hidden', 'true');
      symbol.textContent = info.glyph;

      const name = document.createElement('span');
      name.className = 'slot-pay__name';
      name.textContent = info.label.charAt(0).toUpperCase() + info.label.slice(1);

      const multiplier = document.createElement('strong');
      multiplier.className = 'slot-pay__mult';
      multiplier.textContent = `×${info.pay}`;

      row.append(symbol, name, multiplier);
      return row;
    }),
  );

  const rtp = (slotRtp() * 100).toFixed(2).replace('.', ',');
  const every = (1 / slotHitChance()).toFixed(1).replace('.', ',');
  els.rtpInfo.textContent =
    `A largo plazo devuelve el ${rtp}% de lo apostado. ` +
    `Un premio cada ${every} giros.`;
}

function buildLineLegend() {
  els.lineLegend.replaceChildren(
    ...SLOT_LINES.map((line) => {
      const item = document.createElement('span');
      item.textContent = line.label;
      return item;
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
els.switchGameBtn.addEventListener('click', switchGame);

els.betChips.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip || chip.disabled) return;
  state.bet = normalizeSlotBet(Number(chip.dataset.value), state.balance);
  savePrefs();
  if (state.sound) sound.play('chip', { index: chipIndex(Number(chip.dataset.value)) });
  render();
});

els.betOtherBtn.addEventListener('click', openBetSheet);
els.spinBtn.addEventListener('click', spin);

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
  cancelAnimationFrame(state.frame);
  state.frame = 0;
  state.run = null;
  removeStored(PROGRESS_KEY);
  saveStoredPrefs({ slotsBet: SLOT_DEFAULT_BET });
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
  // Solo el saldo: escribir las prefs acá volvería a guardar `game: 'slots'`
  // después de "Cambiar de juego" y el selector rebotaría a la tragamonedas.
  saveProgress();
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
    toast('Doble toque: otra tirada · acelera el giro');
    state.seenSlotHint = true;
    savePrefs();
  }, 1500);
}

/* ---------- Arranque ---------- */

applyTheme();
applySound();
applyGestures();
buildReels();
buildPayTable();
buildLineLegend();
buildAddChips(els.addChips);
unlockSoundOnGesture();
if (els.appVersion) setVersion(els.appVersion, APP_VERSION);

ensureBet();
savePrefs();
maybeTopUp();
render();
renderInstall();
scheduleGestureHint();

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
