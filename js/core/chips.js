// Fichas, etiquetas y hoja de "agregar fichas" compartidas.

import { CHIP_TIERS, formatMoney } from './money.js';

export function chipLabel(value) {
  if (value < 1000) return String(value);
  const k = value / 1000;
  return `${Number.isInteger(k) ? k : String(k).replace('.', ',')}k`;
}

export function chipIndex(value) {
  const index = CHIP_TIERS.indexOf(value);
  return index < 0 ? 0 : index;
}

export function makeChip(value, { button = true } = {}) {
  const node = document.createElement(button ? 'button' : 'span');
  if (button) {
    node.type = 'button';
    node.setAttribute('aria-label', `Agregar ${formatMoney(value)}`);
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

export function buildAddChips(container) {
  container.replaceChildren(...CHIP_TIERS.map((tier) => makeChip(tier)));
}

/**
 * Hoja beta para sumar fichas. El controlador decide de dónde sale el saldo
 * visible y qué pasa al confirmar; acá vive el borrador y el render.
 */
export function createAddFundsSheet({
  addFundsBtn,
  addSheet,
  addClose,
  addTotal,
  addAfter,
  addConfirm,
  addUndo,
  addClear,
  addChips,
  getBase,
  onConfirm,
  onChip = null,
  onUndo = null,
  onClear = null,
  isOtherSheetOpen = () => false,
}) {
  let amount = 0;
  let stack = [];
  let lastFocused = null;

  function render() {
    const base = getBase();
    addTotal.textContent = formatMoney(amount);
    addAfter.textContent =
      amount > 0
        ? `${formatMoney(base)} → ${formatMoney(base + amount)}`
        : `Saldo: ${formatMoney(base)}`;
    addConfirm.disabled = amount <= 0;
    addConfirm.textContent = amount > 0 ? `Agregar ${formatMoney(amount)}` : 'Agregar fichas';
    addUndo.disabled = stack.length === 0;
    addClear.disabled = stack.length === 0;
  }

  function open() {
    lastFocused = document.activeElement;
    amount = 0;
    stack = [];
    render();
    addSheet.hidden = false;
    document.body.classList.add('has-sheet');
    addClose.focus({ preventScroll: true });
  }

  function close() {
    addSheet.hidden = true;
    if (!isOtherSheetOpen()) document.body.classList.remove('has-sheet');
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus({ preventScroll: true });
    }
  }

  function addChip(value) {
    if (!Number.isFinite(value) || value <= 0) return;
    stack.push(value);
    amount += value;
    if (onChip) onChip(value);
    render();
  }

  function undo() {
    const value = stack.pop();
    if (!value) return;
    amount = Math.max(0, amount - value);
    if (onUndo) onUndo();
    render();
  }

  function clear() {
    amount = 0;
    stack = [];
    if (onClear) onClear();
    render();
  }

  function confirm() {
    if (amount <= 0) return;
    const value = amount;
    onConfirm(value);
    close();
  }

  addFundsBtn.addEventListener('click', open);
  addClose.addEventListener('click', close);
  addUndo.addEventListener('click', undo);
  addClear.addEventListener('click', clear);
  addConfirm.addEventListener('click', confirm);
  addChips.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    addChip(Number(chip.dataset.value));
  });
  addSheet.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-add]')) close();
  });

  return { open, close, render };
}
