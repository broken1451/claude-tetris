'use strict';

// Records locales del Modo Clásico: lógica pura y persistencia (sin DOM). El render vive en game.js.
// localStorage('records') = { top: [{ name, score, lines, combo }], bestCombo, bestLines }
// `combo` es el multiplicador de combo más alto de la partida (0 = no se limpiaron líneas).

const RECORDS_CONFIG = {
  key: 'records',
  maxEntries: 5,
  maxNameLength: 12,
  defaultName: 'Anónimo',
};

function createRecords() {
  return { top: [], bestCombo: 0, bestLines: 0 };
}

// Entero >= 0; cualquier otra cosa (texto, NaN, Infinity, negativos) cuenta como 0.
function toCount(v) {
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

function normalizeName(name) {
  const text = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim() : '';
  // Array.from corta por caracteres completos (no parte emojis por la mitad)
  return Array.from(text).slice(0, RECORDS_CONFIG.maxNameLength).join('').trim() || RECORDS_CONFIG.defaultName;
}

function normalizeEntry(e) {
  return { name: normalizeName(e.name), score: toCount(e.score), lines: toCount(e.lines), combo: toCount(e.combo) };
}

// Convierte cualquier dato (posiblemente corrupto) en una estructura válida.
function sanitizeRecords(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const top = (Array.isArray(data.top) ? data.top : [])
    .filter(e => e && typeof e === 'object')
    .map(normalizeEntry)
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score)      // estable: a igual puntuación manda la más antigua
    .slice(0, RECORDS_CONFIG.maxEntries);
  return { top, bestCombo: toCount(data.bestCombo), bestLines: toCount(data.bestLines) };
}

function parseRecords(text) {
  try {
    return sanitizeRecords(JSON.parse(text));
  } catch (e) {
    return createRecords();
  }
}

// Posición (0-based) que ocuparía `score`, o -1 si no entra en el top. Los empates van detrás.
function rankFor(records, score) {
  if (!(score > 0)) return -1;
  let i = records.top.findIndex(e => score > e.score);
  if (i < 0) i = records.top.length;
  return i < RECORDS_CONFIG.maxEntries ? i : -1;
}

// Mejor combo y líneas máximas históricas: cuentan todas las partidas, entren o no en el top.
function updateBests(records, { lines, combo }) {
  return {
    top: records.top,
    bestCombo: Math.max(records.bestCombo, toCount(combo)),
    bestLines: Math.max(records.bestLines, toCount(lines)),
  };
}

// No muta `records`. Devuelve { records, index }; index = -1 si la entrada no entra en el top.
function addEntry(records, entry) {
  const clean = normalizeEntry(entry);
  const index = rankFor(records, clean.score);
  const next = updateBests(records, clean);
  if (index >= 0) {
    next.top = [...records.top.slice(0, index), clean, ...records.top.slice(index)]
      .slice(0, RECORDS_CONFIG.maxEntries);
  }
  return { records: next, index };
}

// `getStorage` se evalúa dentro de try: solo con acceder a localStorage ya puede saltar una excepción.
// Si no se puede leer o escribir, los records se conservan en memoria durante la sesión.
function createRecordStore(getStorage = () => localStorage) {
  let memory = createRecords();
  let unsaved = false;   // la última escritura falló: la memoria es más reciente que el almacenamiento

  function load() {
    if (!unsaved) {
      try {
        memory = parseRecords(getStorage().getItem(RECORDS_CONFIG.key));
      } catch (e) { /* sin almacenamiento: se usa la memoria */ }
    }
    return memory;
  }

  function save(records) {
    memory = records;
    try {
      getStorage().setItem(RECORDS_CONFIG.key, JSON.stringify(records));
      unsaved = false;
    } catch (e) {
      unsaved = true;
    }
  }

  return { load, save, reset: () => save(createRecords()) };
}

if (typeof module !== 'undefined') {
  module.exports = {
    RECORDS_CONFIG, createRecords, normalizeName, sanitizeRecords, parseRecords,
    rankFor, updateBests, addEntry, createRecordStore,
  };
}
