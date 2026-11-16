// Configuración de una máquina: validación y datos derivados.
// El core no sabe de qué juego se trata; todo lo particular vive acá.

/**
 * Prepara una config para que el motor la use sin recalcular pesos.
 * Devuelve una copia con `symbols`, `specialIds`, `entries` y `entriesNoMult`.
 */
export function prepareGame(source) {
  const config = {
    ...source,
    multipliers: source.multipliers ? { ...source.multipliers } : null,
    scatter: { ...source.scatter },
    tumble: { maxCascades: 60, ...source.tumble },
  };

  const scatterId = config.scatter.id;
  const multId = config.multipliers ? config.multipliers.id : null;

  config.specialIds = new Set([scatterId, multId].filter(Boolean));
  config.symbolIds = [...config.symbols];

  const weights = { ...config.weights };
  for (const id of config.symbolIds) {
    if (!weights[id]) throw new Error(`falta el peso de ${id}`);
    if (!config.pays[id]) throw new Error(`falta la tabla de pagos de ${id}`);
    if (!config.pays[id][config.minMatch]) {
      throw new Error(`la tabla de ${id} no tiene el escalón de ${config.minMatch}`);
    }
  }
  if (!weights[scatterId]) throw new Error('falta el peso del scatter');
  if (multId && !weights[multId]) throw new Error('falta el peso del multiplicador');

  config.entries = Object.entries(weights).map(([id, weight]) => [id, weight]);
  config.totalWeight = config.entries.reduce((sum, [, weight]) => sum + weight, 0);

  config.entriesNoMult = multId
    ? config.entries.filter(([id]) => id !== multId)
    : config.entries;
  config.totalWeightNoMult = config.entriesNoMult.reduce((sum, [, weight]) => sum + weight, 0);

  if (!(config.totalWeight > 0)) throw new Error('los pesos deben sumar más que cero');
  return config;
}

/** Escalón de pago que corresponde a una cantidad (8, 10, 12…). */
export function payTier(config, count) {
  const keys = Object.keys(config)
    .map(Number)
    .filter((key) => Number.isFinite(key))
    .sort((a, b) => a - b);
  let tier = null;
  for (const key of keys) {
    if (count >= key) tier = key;
  }
  return tier;
}

/** Pago de una combinación según la tabla y la cantidad de símbolos. */
export function payFor(table, count) {
  const tier = payTier(table, count);
  return tier === null ? 0 : table[tier];
}

/** Elige un símbolo por peso. `allowMultiplier` apaga el especial del juego. */
export function pickSymbol(config, rng, allowMultiplier = true) {
  const entries = allowMultiplier ? config.entries : config.entriesNoMult;
  const total = allowMultiplier ? config.totalWeight : config.totalWeightNoMult;
  let roll = rng() * total;
  for (const [id, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return id;
  }
  return entries[entries.length - 1][0];
}

/** Valor de un multiplicador. Con `valueWeights` los chicos salen más seguido. */
export function pickMultiplier(config, rng) {
  const { values, valueWeights } = config.multipliers;
  if (!valueWeights) {
    return values[Math.min(values.length - 1, Math.floor(rng() * values.length))];
  }

  const total = valueWeights.reduce((sum, weight) => sum + weight, 0);
  let roll = rng() * total;
  for (let index = 0; index < values.length; index += 1) {
    roll -= valueWeights[index];
    if (roll <= 0) return values[index];
  }
  return values[values.length - 1];
}
