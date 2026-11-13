// Piezas de interfaz compartidas: tema, sonido, avisos, instalación y hojas.

import { sound } from '../sound.js';

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const standalone =
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS =
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function resolvedTheme(theme) {
  if (theme === 'light' || theme === 'dark') return theme;
  return darkQuery.matches ? 'dark' : 'light';
}

export function applyTheme({ theme, themeColor, themeBtn }) {
  const value = resolvedTheme(theme);
  document.documentElement.dataset.theme = value;
  if (themeColor) {
    themeColor.setAttribute('content', value === 'dark' ? '#0f1210' : '#f6f5f0');
  }
  if (themeBtn) {
    themeBtn.setAttribute(
      'aria-label',
      value === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro',
    );
  }
}

export function watchTheme(getTheme, apply) {
  darkQuery.addEventListener('change', () => {
    if (getTheme() === 'auto') apply();
  });
}

export function applySoundState({ enabled, soundBtn }) {
  document.documentElement.dataset.sound = enabled ? 'on' : 'off';
  if (!soundBtn) return;
  soundBtn.setAttribute('aria-pressed', String(enabled));
  soundBtn.setAttribute('aria-label', enabled ? 'Silenciar sonidos' : 'Activar sonidos');
  sound.setMuted(!enabled);
}

export function applyGestures({ enabled, gesturesBtn, gesturesValue }) {
  document.documentElement.dataset.gestures = enabled ? 'on' : 'off';
  if (!gesturesBtn) return;
  gesturesBtn.setAttribute('aria-checked', String(enabled));
  gesturesBtn.classList.toggle('is-on', enabled);
  if (gesturesValue) gesturesValue.textContent = enabled ? 'Activados' : 'Desactivados';
}

export function createToast(el, { duration = 3400 } = {}) {
  let showTimer = 0;
  let hideTimer = 0;

  return function toast(text) {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    el.textContent = text;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('is-visible'));

    showTimer = setTimeout(() => {
      el.classList.remove('is-visible');
      hideTimer = setTimeout(() => {
        el.hidden = true;
      }, 220);
    }, duration);
  };
}

export function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function animateWallet(el, tone) {
  if (tone !== 'win' && tone !== 'lose') return;
  const cls = tone === 'win' ? 'is-up' : 'is-down';
  el.classList.remove('is-up', 'is-down');
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 800);
}

export function setVersion(el, version) {
  if (el) el.textContent = `versión ${version}`;
}

/** Instalación PWA/iOS: un solo lugar para el botón, la hoja y los avisos. */
export function createInstallUI({
  installBtn,
  sheetInstallBtn,
  installSteps,
  installStatus,
  openSheet,
  toast,
}) {
  let installPrompt = null;

  function renderInstall() {
    const canPrompt = Boolean(installPrompt);

    installBtn.hidden = standalone || (!canPrompt && !isIOS);
    if (!installBtn.hidden) {
      installBtn.setAttribute(
        'aria-label',
        canPrompt ? 'Instalar aplicación' : 'Cómo agregar a la pantalla de inicio',
      );
    }

    sheetInstallBtn.hidden = !canPrompt || standalone;
    installSteps.hidden = true;
    installSteps.replaceChildren();

    if (standalone) {
      installStatus.textContent = 'Ya estás usando la app instalada.';
      return;
    }
    if (canPrompt) {
      installStatus.textContent = 'Tu navegador permite instalarla con un toque.';
      return;
    }
    if (isIOS) {
      installStatus.textContent = 'En iPhone o iPad se agrega desde Safari:';
      const steps = [
        'Abrí esta página en Safari.',
        'Tocá el botón Compartir.',
        'Elegí “Agregar a pantalla de inicio”.',
        'Tocá “Agregar”.',
      ];
      for (const text of steps) {
        const li = document.createElement('li');
        li.textContent = text;
        installSteps.append(li);
      }
      installSteps.hidden = false;
      return;
    }
    installStatus.textContent =
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

  installBtn.addEventListener('click', promptInstall);
  sheetInstallBtn.addEventListener('click', promptInstall);

  return { renderInstall, promptInstall };
}

/** Hoja de ajustes: foco, clase del body y scroll opcional a instalación. */
export function createSheetUI({
  sheet,
  sheetClose,
  installStatus,
  renderInstall,
  isOtherSheetOpen = () => false,
  onClose = null,
}) {
  let lastFocused = null;

  function open(scrollToInstall = false) {
    lastFocused = document.activeElement;
    renderInstall();
    sheet.hidden = false;
    document.body.classList.add('has-sheet');
    sheetClose.focus({ preventScroll: true });
    if (scrollToInstall) {
      setTimeout(() => {
        installStatus.scrollIntoView({ block: 'center' });
      }, 80);
    }
  }

  function close() {
    sheet.hidden = true;
    if (onClose) onClose();
    if (!isOtherSheetOpen()) document.body.classList.remove('has-sheet');
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus({ preventScroll: true });
    }
  }

  return { open, close };
}
