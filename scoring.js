'use strict';

// Toda la lógica de puntuación está aquí (sin DOM). Ajusta SCORING_CONFIG para cambiar el balance.
// Los puntos de línea / T-Spin se multiplican por el nivel; el combo multiplica el total de la jugada.

const SCORING_CONFIG = {
  line: [0, 100, 300, 500, 800],      // por nº de líneas
  tspin: [400, 800, 1200, 1600],      // T-Spin completo con 0–3 líneas
  tspinMini: [100, 200, 400],         // Mini T-Spin con 0–2 líneas
  comboCap: 8,                        // multiplicador máximo de combo
  b2bMultiplier: 1.5,                 // bonus Back-to-Back (Tetris / T-Spin consecutivos)
  perfectClear: [0, 800, 1200, 1800, 2000], // por nº de líneas de la jugada final (× nivel, sin combo)
  softDrop: 1,                        // puntos por fila
  hardDrop: 2,                        // puntos por fila
};

const LINE_NAMES = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'];

function createScoreState() {
  return { chain: 0, b2b: false };
}

// Esquinas de la matriz 3×3 de la T (r,c) y arista "frontal" según hacia dónde apunta la T.
const T_CORNERS = [[0, 0], [0, 2], [2, 0], [2, 2]];
const T_FRONT = {
  top: [[0, 0], [0, 2]], right: [[0, 2], [2, 2]], bottom: [[2, 0], [2, 2]], left: [[0, 0], [2, 0]],
};

// Debe llamarse ANTES de merge(). Regla de 3 esquinas; solo si el último movimiento fue una rotación.
// Devuelve 'none' | 'mini' | 'full'.
function detectTSpin(board, piece, lastWasRotation, rows, cols) {
  if (piece.type !== 3 || !lastWasRotation || piece.shape.length !== 3) return 'none';
  const filled = ([r, c]) => {
    const x = piece.x + c, y = piece.y + r;
    if (x < 0 || x >= cols || y >= rows) return true;   // paredes y suelo cuentan
    if (y < 0) return false;
    return board[y][x] !== 0;
  };
  const count = T_CORNERS.filter(filled).length;
  if (count < 3) return 'none';

  const s = piece.shape;
  // la arista central que falta es la "espalda"; la T apunta al lado opuesto
  const missing = !s[0][1] ? 'top' : !s[1][2] ? 'right' : !s[2][1] ? 'bottom' : 'left';
  const front = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[missing];
  return T_FRONT[front].every(filled) ? 'full' : 'mini';
}

function basePoints(cleared, tspin) {
  if (tspin === 'full') return SCORING_CONFIG.tspin[Math.min(cleared, 3)];
  if (tspin === 'mini') return SCORING_CONFIG.tspinMini[Math.min(cleared, 2)];
  return SCORING_CONFIG.line[cleared] || 0;
}

function clearTitle(cleared, tspin) {
  if (tspin === 'full') return cleared ? `T-SPIN ${LINE_NAMES[cleared]}` : 'T-SPIN';
  if (tspin === 'mini') return cleared ? `MINI T-SPIN ${LINE_NAMES[cleared]}` : 'MINI T-SPIN';
  return LINE_NAMES[cleared] || '';
}

// Se llama una vez por pieza bloqueada. Muta `state` y devuelve el evento de puntuación.
function scoreLock(state, { cleared, tspin = 'none', level, boardEmpty = false }) {
  const cfg = SCORING_CONFIG;
  const difficult = cleared > 0 && (cleared === 4 || tspin !== 'none');
  const ev = {
    cleared, tspin, level, points: 0, multiplier: 1, chain: 0,
    b2bApplied: false, b2bActive: state.b2b, perfect: false,
    title: clearTitle(cleared, tspin),
  };

  let base = basePoints(cleared, tspin);

  if (cleared > 0) {
    if (difficult) {
      if (state.b2b) { base *= cfg.b2bMultiplier; ev.b2bApplied = true; }
      state.b2b = true;
    } else {
      state.b2b = false;
    }
    state.chain++;
  } else {
    state.chain = 0;     // bloquear sin líneas rompe el combo (el B2B no se toca)
  }

  ev.b2bActive = state.b2b;
  ev.chain = state.chain;
  ev.multiplier = Math.max(1, Math.min(state.chain, cfg.comboCap));
  ev.points = Math.round(base * level * ev.multiplier);

  if (cleared > 0 && boardEmpty) {
    ev.perfect = true;
    ev.points += (cfg.perfectClear[cleared] || 0) * level;
  }
  return ev;
}

// Líneas completadas por un power-up (Gravedad, Rayo…): puntúa como línea normal sin tocar combo ni B2B.
function scoreClearOnly(cleared, level) {
  return (SCORING_CONFIG.line[cleared] || 0) * level;
}

function scoreDrop(cells, hard) {
  return cells * (hard ? SCORING_CONFIG.hardDrop : SCORING_CONFIG.softDrop);
}

if (typeof module !== 'undefined') {
  module.exports = { SCORING_CONFIG, createScoreState, detectTSpin, scoreLock, scoreClearOnly, scoreDrop };
}
