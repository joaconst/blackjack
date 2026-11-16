// Máquina 2: cargas que solo existen en los giros gratis y multiplican la tirada.
// Sin multiplicadores en el juego base; el acumulado se reinicia en cada giro.

import { prepareGame } from '../core/config.js';

export const PULSO = {
  id: 'pulso',
  label: 'Pulso',
  themeId: 'pulso',
  reels: 6,
  rows: 5,
  minMatch: 8,
  volatility: 'alta',
  rtpTarget: 0.96,

  symbols: [
    'pixelCian',
    'pixelLima',
    'pixelAmbar',
    'pixelMagenta',
    'pixelVioleta',
    'escudo',
    'orbe',
    'espiral',
    'corazon',
  ],

  symbolMeta: {
    pixelCian: { label: 'píxel cian', tone: 'cyan' },
    pixelLima: { label: 'píxel lima', tone: 'lime' },
    pixelAmbar: { label: 'píxel ámbar', tone: 'amber' },
    pixelMagenta: { label: 'píxel magenta', tone: 'magenta' },
    pixelVioleta: { label: 'píxel violeta', tone: 'violet' },
    escudo: { label: 'escudo', tone: 'cyan' },
    orbe: { label: 'orbe', tone: 'lime' },
    espiral: { label: 'espiral', tone: 'violet' },
    corazon: { label: 'corazón', tone: 'magenta' },
  },

  weights: {
    pixelCian: 30,
    pixelLima: 28,
    pixelAmbar: 26,
    pixelMagenta: 24,
    pixelVioleta: 22,
    escudo: 8,
    orbe: 7,
    espiral: 6,
    corazon: 5,
    portal: 3,
    carga: 3.2,
  },

  pays: {
    pixelCian: { 8: 0.33, 10: 0.81, 12: 2.43 },
    pixelLima: { 8: 0.36, 10: 0.9, 12: 2.59 },
    pixelAmbar: { 8: 0.41, 10: 0.97, 12: 2.92 },
    pixelMagenta: { 8: 0.45, 10: 1.14, 12: 3.24 },
    pixelVioleta: { 8: 0.48, 10: 1.22, 12: 3.57 },
    escudo: { 8: 0.81, 10: 2.43, 12: 8.11 },
    orbe: { 8: 0.97, 10: 2.92, 12: 9.73 },
    espiral: { 8: 1.3, 10: 3.57, 12: 12.97 },
    corazon: { 8: 1.62, 10: 4.87, 12: 19.46 },
  },

  scatter: {
    id: 'portal',
    label: 'portal',
    trigger: 4,
    pays: { 4: 3, 5: 5, 6: 100 },
    freeSpins: 10,
    retriggerMin: 3,
    retriggerAdd: 5,
  },

  multipliers: {
    id: 'carga',
    label: 'carga',
    values: [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 50, 100],
    valueWeights: [900, 700, 560, 460, 380, 290, 210, 150, 100, 60, 38, 12, 4],
    base: 'none',
    bonus: 'spin',
  },

  tumble: { maxCascades: 60 },

  copy: {
    subtitle: '6×5 · desde 8 iguales · cargas',
    rules: [
      'La grilla es de 6×5 y paga cualquier grupo de 8 o más símbolos iguales, sin importar dónde estén.',
      'Los símbolos ganadores desaparecen y los de arriba caen. Si vuelve a haber 8 iguales, la cascada sigue y se suma.',
      '4, 5 o 6 portales en un giro pagan 3×, 5× y 100× la apuesta, y abren 10 giros gratis.',
      'Los portales y las cargas quedan clavados en su celda durante todas las cascadas del giro.',
      'En el juego base no hay cargas: el premio es solo el de las cascadas y el portal.',
      'En los giros gratis, las cargas visibles se suman y multiplican únicamente el premio de esa tirada. Cada giro arranca de cero.',
      'Dentro del bono, 3 o más portales suman 5 giros extra y no vuelven a pagar.',
    ],
    bonusLabel: '10 giros gratis',
    multiplierNote: 'Las cargas van de 2× a 100× y se suman solo dentro del bono.',
  },
};

export const PULSO_GAME = prepareGame(PULSO);
