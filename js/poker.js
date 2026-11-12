import {
  DAILY_FLOOR,
  START_BALANCE,
  RANK_LABEL,
  SUIT_GLYPH,
  SUIT_LABEL,
  dayKey,
  msUntilNextDay,
  dailyTopUp,
  formatMoney,
} from './engine.js';
import {
  BB,
  TABLE_CAP,
  applyAction,
  advance as advanceTable,
  botAction,
  clampRaiseTarget,
  createTable,
  legalActions,
  raiseOptions,
  startHand as beginHand,
  stepRaiseTarget,
} from './poker-engine.js';
import { sound, unlockSoundOnGesture } from './sound.js';

const PREFS_KEY = 'blackjack.prefs.v1';
const PROGRESS_KEY = 'blackjack.progress.v1';
const TABLE_KEY = 'poker.table.v1';
const APP_VERSION = 'v2.1';
const money = formatMoney;
const PLAYER_NAMES = ['Vos', 'Ana', 'Beto', 'Caro'];
const BOT_PROFILES = ['balanced', 'tight', 'aggro'];
const BOT_DELAY_MIN = 620;
const BOT_DELAY_MAX = 1140;

let resetting = false;

const els = {
  balance: document.getElementById('balance'),
  seats: document.getElementById('seats'),
  community: document.getElementById('community'),
  pot: document.getElementById('pot'),
  status: document.getElementById('status'),
  youSeat: document.getElementById('youSeat'),
  youName: document.getElementById('youName'),
  youStack: document.getElementById('youStack'),
  youBet: document.getElementById('youBet'),
  youCards: document.getElementById('youCards'),
  result: document.getElementById('result'),
  resultTitle: document.getElementById('resultTitle'),
  resultText: document.getElementById('resultText'),
  resultNet: document.getElementById('resultNet'),
  startPanel: document.getElementById('startPanel'),
  startBtn: document.getElementById('startBtn'),
  startNote: document.getElementById('startNote'),
  tableInfo: document.getElementById('tableInfo'),
  actionPanel: document.getElementById('actionPanel'),
  actionRow: document.getElementById('actionRow'),
  foldBtn: document.getElementById('foldBtn'),
  callBtn: document.getElementById('callBtn'),
  raiseBtn: document.getElementById('raiseBtn'),
  raisePanel: document.getElementById('raisePanel'),
  raisePresets: document.getElementById('raisePresets'),
  raiseAmount: document.getElementById('raiseAmount'),
  raiseHint: document.getElementById('raiseHint'),
  raiseRange: document.getElementById('raiseRange'),
  raiseMinus: document.getElementById('raiseMinus'),
  raisePlus: document.getElementById('raisePlus'),
  raiseCancel: document.getElementById('raiseCancel'),
  raiseConfirm: document.getElementById('raiseConfirm'),
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
  switchGameBtn: document.getElementById('switchGameBtn'),
  sheetInstallBtn: document.getElementById('sheetInstallBtn'),
  installStatus: document.getElementById('installStatus'),
  installSteps: document.getElementById('installSteps'),
  appVersion: document.getElementById('appVersion'),
  resetBtn: document.getElementById('resetBtn'),
  resetConfirm: document.getElementById('resetConfirm'),
  resetCancel: document.getElementById('resetCancel'),
  resetGo: document.getElementById('resetGo'),
};

/* ---------- Almacenamiento ---------- */

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

const storedPrefs = readStored(PREFS_KEY) || {};
const storedProgress = readStored(PROGRESS_KEY) || {};

const state = {
  balance:
    Number.isFinite(storedProgress.balance) && storedProgress.balance >= 0
      ? Math.floor(storedProgress.balance)
      : START_BALANCE,
  lastTopUp: typeof storedProgress.lastTopUp === 'string' ? storedProgress.lastTopUp : dayKey(),
  theme:
    storedPrefs.theme === 'light' || storedPrefs.theme === 'dark' ? storedPrefs.theme : 'auto',
  sound: typeof storedPrefs.sound === 'boolean' ? storedPrefs.sound : true,
  table: null,
  busy: false,
  botTimer: 0,
  raiseOpen: false,
  raiseTarget: 0,
  lastNet: 0,
};

function saveProgress() {
  if (resetting) return;
  const current = readStored(PROGRESS_KEY) || {};
  writeStored(PROGRESS_KEY, {
    ...current,
    balance: state.balance,
    lastTopUp: state.lastTopUp,
  });
}

function savePrefs() {
  const current = readStored(PREFS_KEY) || {};
  writeStored(PREFS_KEY, {
    ...current,
    theme: state.theme,
    sound: state.sound,
    game: 'poker',
  });
}

function saveTable() {
  if (resetting) return;
  if (!state.table) {
    try {
      localStorage.removeItem(TABLE_KEY);
    } catch {
      /* sin almacenamiento */
    }
    return;
  }
  writeStored(TABLE_KEY, state.table);
}

function loadTable() {
  const table = readStored(TABLE_KEY);
  if (!table) return null;
  if (!Array.isArray(table.players) || table.players.length !== PLAYER_NAMES.length) return null;
  if (!Array.isArray(table.board) || !Array.isArray(table.deck)) return null;
  if (typeof table.settled !== 'boolean' || typeof table.startStack !== 'number') return null;
  if (!table.players.every((player) => player && Array.isArray(player.hole))) return null;
  return table;
}

/* ---------- Tema y sonido ---------- */

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

function applySound() {
  document.documentElement.dataset.sound = state.sound ? 'on' : 'off';
  els.soundBtn.setAttribute('aria-pressed', String(state.sound));
  els.soundBtn.setAttribute('aria-label', state.sound ? 'Silenciar sonidos' : 'Activar sonidos');
  sound.setMuted(!state.sound);
}

darkQuery.addEventListener('change', () => {
  if (state.theme === 'auto') applyTheme();
});

/* ---------- Cartas ---------- */

function cardLabel(card) {
  const rank = RANK_LABEL[card.rank] || card.rank;
  return `${rank} de ${SUIT_LABEL[card.suit]}`;
}

function faceNode(card) {
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

function backNode() {
  const node = document.createElement('div');
  node.className = 'card card--back';
  node.dataset.sig = 'back';
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', 'Carta oculta');
  return node;
}

function syncCards(container, cards, { hidden = false } = {}) {
  const signatures = cards.map((card) =>
    hidden ? 'back' : `${card.rank}-${card.suit}`,
  );

  while (container.children.length > signatures.length) {
    container.lastElementChild.remove();
  }

  signatures.forEach((signature, index) => {
    const existing = container.children[index];
    if (existing && existing.dataset.sig === signature) return;
    const node = hidden ? backNode() : faceNode(cards[index]);
    if (existing) existing.replaceWith(node);
    else container.appendChild(node);
  });
}

function syncSlots(container, cards) {
  const slots = container.children;
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    const card = cards[index];
    if (!card) {
      slot.classList.remove('is-filled');
      slot.replaceChildren();
      continue;
    }
    const signature = `${card.rank}-${card.suit}`;
    const current = slot.firstElementChild;
    if (!current || current.dataset.sig !== signature) {
      slot.replaceChildren(faceNode(card));
    }
    slot.classList.add('is-filled');
  }
}

function buildBoard() {
  for (let index = 0; index < 5; index += 1) {
    const slot = document.createElement('div');
    slot.className = 'card-slot';
    els.community.append(slot);
  }
  for (let index = 0; index < 2; index += 1) {
    const slot = document.createElement('div');
    slot.className = 'card-slot';
    els.youCards.append(slot);
  }
  PLAYER_NAMES.slice(1).forEach((_, offset) => {
    const seat = document.createElement('div');
    seat.className = 'seat';
    seat.dataset.seat = String(offset + 1);
    seat.innerHTML =
      `<span class="seat__name"></span>` +
      `<span class="seat__stack"></span>` +
      `<div class="seat__cards"></div>` +
      `<span class="seat__bet"></span>` +
      `<span class="seat__state"></span>`;
    els.seats.append(seat);
  });
}

/* ---------- Saldo ---------- */

function committed() {
  const table = state.table;
  if (!table || table.settled) return 0;
  return Math.max(0, table.startStack - table.players[0].stack);
}

function available() {
  return Math.max(0, state.balance - committed());
}

function maybeTopUp() {
  if (state.table && !state.table.settled) return false;

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
  saveProgress();
  render();
  toast(`Bono diario: +${money(result.credited)} hasta ${money(DAILY_FLOOR)}`);
  return true;
}

function applySettlement() {
  const table = state.table;
  if (!table || !table.settled || table.applied) return;

  const net = table.players[0].stack - table.startStack;
  state.lastNet = net;
  state.balance = Math.max(0, state.balance + net);
  table.applied = true;
  saveProgress();
  saveTable();
  if (net > 0) sound.play('win');
  else if (net < 0) sound.play('lose');
  else sound.play('push');
  animateWallet(net > 0 ? 'win' : net < 0 ? 'lose' : 'push');
}

function animateWallet(tone) {
  if (tone !== 'win' && tone !== 'lose') return;
  const cls = tone === 'win' ? 'is-up' : 'is-down';
  els.balance.classList.remove('is-up', 'is-down');
  void els.balance.offsetWidth;
  els.balance.classList.add(cls);
  setTimeout(() => els.balance.classList.remove(cls), 800);
}

/* ---------- Ronda ---------- */

function startNewHand() {
  if (state.busy) return;
  state.raiseOpen = false;
  state.raiseTarget = 0;
  state.lastNet = 0;

  if (state.balance < BB) {
    toast('No te alcanza para la ciega grande');
    return;
  }

  const stack = Math.min(state.balance, TABLE_CAP);
  const dealer = ((state.table ? state.table.dealer : -1) + 1) % PLAYER_NAMES.length;
  const table = createTable({ stack, dealer, names: PLAYER_NAMES });
  beginHand(table);
  state.table = table;
  saveTable();
  render();

  sound.play('card');
  setTimeout(() => sound.play('card'), 130);
  setTimeout(() => sound.play('card'), 260);

  advanceTable(table);
  saveTable();
  render();
  scheduleBots();
}

function actAsPlayer(action) {
  const table = state.table;
  if (!table || table.settled || state.busy || table.turn !== 0) return;

  const before = table.players[0].allIn;
  const boardBefore = table.board.length;
  const result = applyAction(table, 0, action);
  if (!result.ok) {
    toast('Esa jugada no está permitida');
    return;
  }

  state.raiseOpen = false;
  const player = table.players[0];
  if (!before && player.allIn) sound.play('allin');
  else if (action.type === 'fold') sound.play('tick');
  else sound.play('chip', { index: 5 });

  advanceTable(table);
  if (table.board.length > boardBefore) {
    setTimeout(() => sound.play('card'), 140);
  }

  if (table.settled) applySettlement();
  saveTable();
  render();
  if (!table.settled) scheduleBots();
}

function scheduleBots() {
  clearTimeout(state.botTimer);
  const table = state.table;
  if (!table || table.settled) {
    state.busy = false;
    return;
  }
  if (table.turn === 0) {
    state.busy = false;
    render();
    return;
  }
  if (table.turn === null) {
    advanceTable(table);
    saveTable();
    render();
    if (table.settled) applySettlement();
    scheduleBots();
    return;
  }

  state.busy = true;
  render();

  const expected = table.turn;
  const delay = BOT_DELAY_MIN + Math.random() * (BOT_DELAY_MAX - BOT_DELAY_MIN);
  state.botTimer = setTimeout(() => {
    const current = state.table;
    if (!current || current.settled || current.turn !== expected) {
      state.busy = false;
      return;
    }

    const wasAllIn = current.players[expected].allIn;
    const boardBefore = current.board.length;
    const action = botAction(current, expected, {
      profile: BOT_PROFILES[(expected - 1) % BOT_PROFILES.length],
      sims: 140,
    });
    let result = applyAction(current, expected, action);
    if (!result.ok) {
      // Red de seguridad: retirarse siempre es legal mientras sea su turno.
      result = applyAction(current, expected, { type: 'fold' });
    }
    if (!result.ok) {
      state.busy = false;
      render();
      return;
    }

    if (!wasAllIn && current.players[expected].allIn) sound.play('allin');
    else if (action.type === 'fold') sound.play('tick');
    else sound.play('chip', { index: 4 });

    advanceTable(current);
    if (current.board.length > boardBefore) {
      setTimeout(() => sound.play('card'), 140);
    }

    state.busy = false;
    if (current.settled) applySettlement();
    saveTable();
    render();
    scheduleBots();
  }, delay);
}

/* ---------- Render ---------- */

function resultInfo() {
  const table = state.table;
  if (!table || !table.settled || !table.result) return null;
  const result = table.result;
  const net = table.players[0].stack - table.startStack;

  let title = 'Mano terminada';
  let text = '';

  if (result.type === 'fold') {
    const winner = result.winners[0];
    title = winner.index === 0 ? 'Ganaste la mano' : `${winner.name} gana la mano`;
    text = `Los demás se retiraron · bote ${money(result.totalPot)}`;
  } else if (result.winners.length === 1) {
    const winner = result.winners[0];
    title = winner.index === 0 ? 'Ganaste la mano' : `${winner.name} gana la mano`;
    text = `${winner.hand} · ${money(winner.amount)}`;
  } else {
    title = 'Pozo dividido';
    text = result.winners.map((winner) => `${winner.name} ${money(winner.amount)}`).join(' · ');
  }

  return { title, text, net };
}

function renderSeats() {
  const table = state.table;
  const seats = els.seats.children;
  const winners =
    table && table.settled && table.result
      ? new Set(table.result.winners.map((winner) => winner.index))
      : new Set();

  for (let index = 1; index < PLAYER_NAMES.length; index += 1) {
    const seat = seats[index - 1];
    if (!seat) continue;
    const player = table ? table.players[index] : null;
    const isTurn = Boolean(table && !table.settled && table.turn === index);
    const revealed = Boolean(table && table.settled && table.showdown && player && !player.folded);

    seat.classList.toggle('is-turn', isTurn);
    seat.classList.toggle('is-folded', Boolean(player && player.folded));
    seat.classList.toggle('is-winner', winners.has(index));

    seat.querySelector('.seat__name').textContent = PLAYER_NAMES[index];
    seat.querySelector('.seat__stack').textContent = player ? money(player.stack) : '—';

    const cards = seat.querySelector('.seat__cards');
    if (!player || !player.hole.length || player.folded) cards.replaceChildren();
    else syncCards(cards, player.hole, { hidden: !revealed });

    const bet = seat.querySelector('.seat__bet');
    bet.textContent = player && player.bet > 0 ? money(player.bet) : '';

    let label = '';
    if (player && player.folded) label = 'Se retiró';
    else if (player && player.allIn) label = 'All in';
    else if (isTurn) label = 'Pensando…';
    else if (winners.has(index) && revealed) label = `Ganó · ${player.handName}`;
    else if (revealed) label = player.handName;
    seat.querySelector('.seat__state').textContent = label;
  }
}

function render() {
  const table = state.table;
  const info = resultInfo();
  const committedNow = committed();

  els.balance.textContent = money(available());
  els.youName.textContent = 'Vos';
  els.pot.textContent = money(
    table ? (table.settled && table.result ? table.result.totalPot : table.pot) : 0,
  );

  if (table) {
    syncSlots(els.community, table.board);
    syncSlots(els.youCards, table.players[0].hole);
    els.youStack.textContent = money(table.players[0].stack);
    els.youBet.textContent = table.players[0].folded
      ? 'Te retiraste'
      : table.players[0].bet > 0
        ? `En la mesa ${money(table.players[0].bet)}`
        : '';
    els.youSeat.classList.toggle('is-folded', table.players[0].folded);
    els.youSeat.classList.toggle(
      'is-turn',
      !table.settled && table.turn === 0 && !state.busy,
    );
    els.youSeat.classList.toggle(
      'is-winner',
      Boolean(table.settled && table.result && table.result.winners.some((winner) => winner.index === 0)),
    );
    els.tableInfo.textContent = money(table.startStack);
  } else {
    syncSlots(els.community, []);
    syncSlots(els.youCards, []);
    els.youStack.textContent = '—';
    els.youBet.textContent = '';
    els.youSeat.classList.remove('is-folded', 'is-turn');
    els.tableInfo.textContent = money(Math.min(state.balance, TABLE_CAP));
  }

  renderSeats();

  const idle = !table || table.settled;
  const noFunds = idle && available() < BB;

  els.startPanel.hidden = !idle || noFunds;
  els.actionPanel.hidden = idle;
  els.noFundsPanel.hidden = !noFunds;
  els.startBtn.disabled = available() < BB;
  els.startBtn.textContent = table && table.settled ? 'Otra mano' : 'Repartir mano';
  els.startNote.textContent = table
    ? `Vos contra 3 bots · ciegas $5/$10`
    : 'Vos contra 3 bots · Texas Hold\'em';

  if (info) {
    els.result.hidden = false;
    els.resultTitle.textContent = info.title;
    els.resultText.textContent = info.text;
    els.resultNet.textContent =
      info.net > 0 ? `+${money(info.net)}` : info.net < 0 ? `\u2212${money(-info.net)}` : '$0';
    els.resultNet.className = 'poker-result__net';
    els.resultNet.classList.add(
      info.net > 0 ? 'is-win' : info.net < 0 ? 'is-lose' : 'is-push',
    );
  } else {
    els.result.hidden = true;
  }

  renderStatus();
  renderControls();
  renderCountdown();
}

function renderStatus() {
  const table = state.table;
  const info = resultInfo();

  if (!table) {
    els.status.textContent = 'Elegí "Repartir mano" para empezar';
    els.status.dataset.tone = 'neutral';
    return;
  }

  if (table.settled && info) {
    els.status.textContent = info.title;
    els.status.dataset.tone =
      info.net > 0 ? 'win' : info.net < 0 ? 'lose' : 'neutral';
    return;
  }

  if (table.turn === 0) {
    const legal = legalActions(table, 0);
    if (!legal) {
      els.status.textContent = 'Pensando…';
    } else if (legal.toCall > 0) {
      els.status.textContent = `Te toca · igualar ${money(legal.call)}`;
    } else {
      els.status.textContent = 'Te toca · podés pasar o apostar';
    }
    els.status.dataset.tone = 'neutral';
    return;
  }

  if (table.turn !== null) {
    els.status.textContent = `${PLAYER_NAMES[table.turn]} piensa…`;
    els.status.dataset.tone = 'neutral';
    return;
  }

  els.status.textContent = 'Repartiendo…';
  els.status.dataset.tone = 'neutral';
}

function renderControls() {
  const table = state.table;
  const canAct = Boolean(table && !table.settled && table.turn === 0 && !state.busy);
  const legal = canAct ? legalActions(table, 0) : null;
  const options = canAct ? raiseOptions(table, 0) : null;

  els.foldBtn.disabled = !canAct;
  els.callBtn.disabled = !canAct;
  els.raiseBtn.disabled = !canAct || !options;

  if (legal) {
    els.callBtn.textContent =
      legal.toCall > 0 ? `Igualar ${money(legal.call)}` : 'Pasar';
    els.raiseBtn.textContent = table.currentBet === 0 ? 'Apostar' : 'Subir';
  } else {
    els.callBtn.textContent = 'Igualar';
    els.raiseBtn.textContent = 'Subir';
  }

  if (!canAct || !options) state.raiseOpen = false;
  els.actionRow.hidden = canAct && state.raiseOpen;
  els.raisePanel.hidden = !canAct || !state.raiseOpen;
  if (!els.raisePanel.hidden) renderRaise(options);
}

function currentRaiseOptions() {
  const table = state.table;
  if (!table || table.settled || table.turn !== 0 || state.busy) return null;
  return raiseOptions(table, 0);
}

function renderRaise(options) {
  if (!options) return;

  state.raiseTarget = clampRaiseTarget(state.table, 0, state.raiseTarget || options.raise.min);

  els.raisePresets.replaceChildren(
    ...options.presets.map((preset) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'poker-raise__preset';
      button.dataset.value = String(preset.amount);
      button.dataset.preset = preset.id;

      const label = document.createElement('span');
      label.className = 'poker-raise__preset-label';
      label.textContent = preset.label;

      const amount = document.createElement('span');
      amount.className = 'poker-raise__preset-amount';
      amount.textContent = money(preset.amount);

      button.append(label, amount);
      button.setAttribute('aria-pressed', String(preset.amount === state.raiseTarget));
      button.classList.toggle('is-selected', preset.amount === state.raiseTarget);
      return button;
    }),
  );

  paintRaise(options);
}

function paintRaise(options) {
  if (!options) return;
  const table = state.table;
  const target = state.raiseTarget;
  const allIn = target >= options.raise.max;
  const extra = Math.max(0, target - table.currentBet);

  els.raiseAmount.textContent = money(target);
  els.raiseHint.textContent = allIn
    ? `All in · subís ${money(extra)}`
    : options.toCall > 0
      ? `Igualás ${money(options.toCall)} · subís ${money(extra)}`
      : `Subís ${money(extra)}`;
  els.raiseRange.textContent = `Mínima ${money(options.raise.min)} · Máxima ${money(options.raise.max)}`;

  els.raiseConfirm.textContent = allIn
    ? 'Confirmar all in'
    : options.toCall > 0
      ? `Subir a ${money(target)}`
      : `Apostar ${money(target)}`;
  els.raiseConfirm.classList.toggle('btn--danger', allIn);
  els.raiseConfirm.classList.toggle('btn--primary', !allIn);

  for (const button of els.raisePresets.children) {
    const selected = Number(button.dataset.value) === target;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
}

function adjustRaise(steps, { silent = false } = {}) {
  const options = currentRaiseOptions();
  if (!options) return;
  const next = stepRaiseTarget(state.table, 0, state.raiseTarget, steps);
  if (next === state.raiseTarget) return;
  state.raiseTarget = next;
  if (!silent) sound.play('tick');
  paintRaise(options);
}

function closeRaise() {
  if (!state.raiseOpen) return;
  stopStepHold();
  state.raiseOpen = false;
  state.raiseTarget = 0;
  renderControls();
  els.raiseBtn.focus({ preventScroll: true });
}

function renderCountdown() {
  if (els.noFundsPanel.hidden) return;
  els.countdown.textContent = formatDuration(msUntilNextDay());
}

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
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

/* ---------- Instalación ---------- */

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
  document.body.classList.remove('has-sheet');
  if (lastFocused && typeof lastFocused.focus === 'function') {
    lastFocused.focus({ preventScroll: true });
  }
}

function switchGame() {
  const table = state.table;
  if (table && !table.settled) {
    toast('Terminá la mano para cambiar de juego');
    return;
  }
  if (table) {
    state.table = null;
    saveTable();
  }
  const current = readStored(PREFS_KEY) || {};
  writeStored(PREFS_KEY, { ...current, game: 'blackjack' });
  location.href = 'index.html';
}

/* ---------- Eventos ---------- */

els.startBtn.addEventListener('click', startNewHand);
els.foldBtn.addEventListener('click', () => actAsPlayer({ type: 'fold' }));
els.callBtn.addEventListener('click', () => {
  const table = state.table;
  if (!table) return;
  const legal = legalActions(table, 0);
  if (!legal) return;
  actAsPlayer({ type: legal.toCall > 0 ? 'call' : 'check' });
});
els.raiseBtn.addEventListener('click', () => {
  const options = currentRaiseOptions();
  if (!options) return;
  state.raiseOpen = true;
  state.raiseTarget = options.raise.min;
  sound.play('tick');
  renderControls();
  requestAnimationFrame(() => {
    if (els.raisePanel.hidden) return;
    els.raisePanel.scrollIntoView({ block: 'nearest' });
  });
});

els.raisePresets.addEventListener('click', (event) => {
  const button = event.target.closest('.poker-raise__preset');
  if (!button) return;
  const options = currentRaiseOptions();
  if (!options) return;
  const value = Number(button.dataset.value);
  if (!Number.isFinite(value)) return;
  state.raiseTarget = clampRaiseTarget(state.table, 0, value);
  sound.play('tick');
  paintRaise(options);
});

els.raiseConfirm.addEventListener('click', () => {
  const options = currentRaiseOptions();
  if (!options) return;
  if (state.raiseTarget >= options.raise.max) actAsPlayer({ type: 'allin' });
  else actAsPlayer({ type: 'raise', amount: state.raiseTarget });
});

els.raiseCancel.addEventListener('click', closeRaise);

const stepHold = { timer: 0, interval: 0 };

function stopStepHold() {
  clearTimeout(stepHold.timer);
  clearInterval(stepHold.interval);
  stepHold.timer = 0;
  stepHold.interval = 0;
}

function startStepHold(delta, event) {
  stopStepHold();
  if (event.pointerType === 'mouse' && event.button !== 0) return;

  adjustRaise(delta);
  if (typeof event.currentTarget.setPointerCapture === 'function') {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* sin captura de puntero */
    }
  }

  stepHold.timer = setTimeout(() => {
    let ticks = 0;
    stepHold.interval = setInterval(() => {
      ticks += 1;
      adjustRaise(delta * (ticks > 8 ? 5 : 1), { silent: true });
    }, 90);
  }, 420);
}

for (const [button, delta] of [
  [els.raiseMinus, -1],
  [els.raisePlus, 1],
]) {
  button.addEventListener('pointerdown', (event) => startStepHold(delta, event));
  button.addEventListener('pointerup', stopStepHold);
  button.addEventListener('pointercancel', stopStepHold);
  button.addEventListener('lostpointercapture', stopStepHold);
  button.addEventListener('click', (event) => {
    if (event.detail !== 0) return;
    adjustRaise(delta);
  });
}

window.addEventListener('pointerup', stopStepHold);
window.addEventListener('pointercancel', stopStepHold);
window.addEventListener('blur', stopStepHold);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopStepHold();
});

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

els.menuBtn.addEventListener('click', () => openSheet());
els.sheetClose.addEventListener('click', closeSheet);
els.sheet.addEventListener('click', (event) => {
  if (event.target.closest('[data-close]')) closeSheet();
});
els.noFundsRulesBtn.addEventListener('click', () => openSheet());
els.switchGameBtn.addEventListener('click', switchGame);
els.installBtn.addEventListener('click', promptInstall);
els.sheetInstallBtn.addEventListener('click', promptInstall);

els.resetBtn.addEventListener('click', () => showResetConfirm(true));
els.resetCancel.addEventListener('click', () => {
  showResetConfirm(false);
  els.resetBtn.focus({ preventScroll: true });
});
els.resetGo.addEventListener('click', () => {
  resetting = true;
  clearTimeout(state.botTimer);
  try {
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem(TABLE_KEY);
  } catch {
    /* sin almacenamiento */
  }
  location.reload();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!els.sheet.hidden) closeSheet();
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    maybeTopUp();
    render();
  }
});

window.addEventListener('pagehide', () => {
  saveProgress();
  saveTable();
});

setInterval(() => {
  renderCountdown();
  maybeTopUp();
}, 1000);

/* ---------- Arranque ---------- */

applyTheme();
applySound();
buildBoard();
unlockSoundOnGesture();
savePrefs();

state.table = loadTable();

if (state.table && state.table.settled && !state.table.applied) {
  applySettlement();
}

if (els.appVersion) els.appVersion.textContent = `versión ${APP_VERSION}`;

maybeTopUp();
render();

if (state.table && !state.table.settled) {
  scheduleBots();
}

renderInstall();

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
