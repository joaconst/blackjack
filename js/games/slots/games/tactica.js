// Máquina 1: cascada con medallas que multiplican la tirada y bono acumulado.
// Los nombres, pesos y pagos se cambian acá; el núcleo no sabe nada de esto.

import { prepareGame } from '../core/config.js';

export const TACTICA = {
  id: 'tactica',
  label: 'Táctica',
  themeId: 'tactica',
  reels: 6,
  rows: 5,
  minMatch: 8,
  volatility: 'media',
  rtpTarget: 0.96,

  symbols: [
    'gemaVerde',
    'gemaArena',
    'gemaCeleste',
    'gemaRoja',
    'gemaGris',
    'cantimplora',
    'placa',
    'reloj',
    'estrella',
  ],

  symbolMeta: {
    gemaVerde: { label: 'gema verde', tone: 'green' },
    gemaArena: { label: 'gema arena', tone: 'sand' },
    gemaCeleste: { label: 'gema celeste', tone: 'sky' },
    gemaRoja: { label: 'gema roja', tone: 'red' },
    gemaGris: { label: 'gema gris', tone: 'steel' },
    cantimplora: { label: 'cantimplora', tone: 'sand' },
    placa: { label: 'placa', tone: 'steel' },
    reloj: { label: 'reloj', tone: 'gold' },
    estrella: { label: 'estrella', tone: 'gold' },
  },

  weights: {
    gemaVerde: 23,
    gemaArena: 21,
    gemaCeleste: 19,
    gemaRoja: 17,
    gemaGris: 15,
    cantimplora: 10,
    placa: 9,
    reloj: 8,
    estrella: 7,
    objetivo: 3.2,
    medalla: 4.2,
  },

  // Múltiplos de la apuesta total: 8-9, 10-11, 12 o más.
  pays: {
    gemaVerde: { 8: 0.142, 10: 0.356, 12: 1.057 },
    gemaArena: { 8: 0.163, 10: 0.386, 12: 1.128 },
    gemaCeleste: { 8: 0.183, 10: 0.427, 12: 1.27 },
    gemaRoja: { 8: 0.193, 10: 0.498, 12: 1.402 },
    gemaGris: { 8: 0.213, 10: 0.528, 12: 1.544 },
    cantimplora: { 8: 0.356, 10: 1.057, 12: 3.515 },
    placa: { 8: 0.427, 10: 1.27, 12: 4.216 },
    reloj: { 8: 0.559, 10: 1.544, 12: 5.629 },
    estrella: { 8: 0.701, 10: 2.113, 12: 8.433 },
  },

  scatter: {
    id: 'objetivo',
    label: 'objetivo',
    trigger: 4,
    pays: { 4: 3, 5: 5, 6: 100 },
    freeSpins: 15,
    retriggerMin: 3,
    retriggerAdd: 5,
  },

  multipliers: {
    id: 'medalla',
    label: 'medalla',
    values: [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 50, 100, 250, 500],
    valueWeights: [820, 640, 520, 430, 360, 270, 200, 150, 105, 70, 45, 18, 7, 2, 1],
    base: 'sum',
    bonus: 'accumulate',
  },

  tumble: { maxCascades: 60 },

  copy: {
    subtitle: '6×5 · desde 8 iguales · cascadas',
    rules: [
      'La grilla es de 6×5 y paga cualquier grupo de 8 o más símbolos iguales, sin importar dónde estén.',
      'Los símbolos ganadores desaparecen y los de arriba caen. Si vuelve a haber 8 iguales, la cascada sigue y se suma.',
      '4, 5 o 6 objetivos en un giro pagan 3×, 5× y 100× la apuesta, y abren 15 giros gratis.',
      'Las medallas y los objetivos quedan clavados en su celda durante todas las cascadas del giro.',
      'En el juego base, las medallas visibles se suman al cerrar las cascadas y multiplican el premio de la tirada.',
      'En los giros gratis el acumulado se mantiene entre tiradas, pero solo se aplica cuando cae una medalla nueva y hubo premio.',
      'Dentro del bono, 3 o más objetivos suman 5 giros extra y no vuelven a pagar.',
    ],
    bonusLabel: '15 giros gratis',
    multiplierNote: 'Las medallas van de 2× a 500× y se suman entre sí.',
  },
};

export const TACTICA_GAME = prepareGame(TACTICA);
