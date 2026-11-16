// Simulador de RTP de las dos máquinas.
// Uso: node tools/slot-rtp.mjs [tiradas]

import { formatReport, makeRng, simulate } from '../js/games/slots/core/metrics.js';
import { TACTICA_GAME } from '../js/games/slots/games/tactica.js';
import { PULSO_GAME } from '../js/games/slots/games/pulso.js';

const spins = Number(process.argv[2] || 200000);
const seed = Number(process.argv[3] || 12345);

for (const game of [TACTICA_GAME, PULSO_GAME]) {
  const started = Date.now();
  const report = simulate(game, { spins, rng: makeRng(seed) });
  console.log(formatReport(game, report));
  console.log(`  (objetivo ${(game.rtpTarget * 100).toFixed(0)}% · ${spins} tiradas en ${Date.now() - started} ms)`);
  console.log('');
}
