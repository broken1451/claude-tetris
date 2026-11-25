'use strict';

// Catálogo y lógica pura de power-ups (sin DOM). Se carga antes de game.js.
// Para añadir un power-up nuevo basta con agregar una entrada a POWERUPS.

const WILD = 8; // índice de bloque comodín (solo visual)
const MAX_CELL = 14; // mayor índice válido en el tablero (piezas especiales 9–13, 14 = basura/bloque fijo del Modo Desafío); debe coincidir con COLORS en game.js

const POWERUP_CONFIG = {
  everyLines: 5,     // cada cuántas líneas se tira el dado
  spawnChance: 0.6,  // probabilidad de obtener un power-up en ese hito
  maxInventory: 3,   // slots disponibles
  freezeMs: 5000,    // duración de Congelar
  scorePerCell: 10,  // puntos por bloque destruido
};

// target: null (instantáneo) | 'cell' {r,c} | 'line' {axis:'row'|'col', index} | 'color' {color}
// apply(board, target) trabaja sobre una COPIA y devuelve { board, cells, durationMs? }
const POWERUPS = {
  bomb: {
    id: 'bomb', name: 'Bomba', icon: '💣', color: '#ff7043', weight: 3, target: 'cell',
    hint: 'Elige el centro del área 3×3',
    apply(board, { r, c }) {
      const cells = [];
      for (let y = r - 1; y <= r + 1; y++)
        for (let x = c - 1; x <= c + 1; x++)
          if (board[y] && x >= 0 && x < board[y].length) {
            if (board[y][x]) cells.push({ r: y, c: x });
            board[y][x] = 0;
          }
      return { board, cells };
    },
  },
  lightning: {
    id: 'lightning', name: 'Rayo', icon: '⚡', color: '#ffee58', weight: 3, target: 'line',
    hint: 'Elige fila o columna (R para alternar)',
    apply(board, { axis, index }) {
      const cells = [];
      if (axis === 'row') {
        for (let c = 0; c < board[index].length; c++) {
          if (board[index][c]) cells.push({ r: index, c });
          board[index][c] = 0;
        }
      } else {
        for (let r = 0; r < board.length; r++) {
          if (board[r][index]) cells.push({ r, c: index });
          board[r][index] = 0;
        }
      }
      return { board, cells };
    },
  },
  tint: {
    id: 'tint', name: 'Tinte', icon: '🎨', color: '#ab47bc', weight: 2, target: 'color',
    hint: 'Elige un bloque: todo su color pasa a comodín',
    apply(board, { color }) {
      const cells = [];
      for (let r = 0; r < board.length; r++)
        for (let c = 0; c < board[r].length; c++)
          if (board[r][c] === color) { board[r][c] = WILD; cells.push({ r, c }); }
      return { board, cells };
    },
  },
  gravity: {
    id: 'gravity', name: 'Gravedad', icon: '⏬', color: '#26a69a', weight: 2, target: null,
    apply(board) {
      const rows = board.length, cols = board[0].length;
      const cells = [];
      for (let c = 0; c < cols; c++) {
        let write = rows - 1;
        for (let r = rows - 1; r >= 0; r--) {
          if (!board[r][c]) continue;
          if (write !== r) { board[write][c] = board[r][c]; board[r][c] = 0; cells.push({ r: write, c }); }
          write--;
        }
      }
      return { board, cells };
    },
  },
  freeze: {
    id: 'freeze', name: 'Congelar', icon: '❄️', color: '#4fc3f7', weight: 2, target: null,
    apply(board) {
      return { board, cells: [], durationMs: POWERUP_CONFIG.freezeMs };
    },
  },
};

function rollPowerUp(rng = Math.random) {
  const list = Object.values(POWERUPS);
  const total = list.reduce((s, p) => s + p.weight, 0);
  let x = rng() * total;
  for (const p of list) {
    x -= p.weight;
    if (x < 0) return p;
  }
  return list[list.length - 1];
}

function isValidBoard(board, rows, cols) {
  return Array.isArray(board) && board.length === rows &&
    board.every(row => Array.isArray(row) && row.length === cols &&
      row.every(v => Number.isInteger(v) && v >= 0 && v <= MAX_CELL));
}

// Aplica sobre una copia y valida; devuelve null si algo falla (el original no se toca).
function applySafely(board, def, target) {
  const rows = board.length, cols = board[0].length;
  try {
    const result = def.apply(board.map(row => [...row]), target);
    if (!result || !isValidBoard(result.board, rows, cols)) return null;
    return result;
  } catch (e) {
    return null;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { POWERUPS, POWERUP_CONFIG, WILD, MAX_CELL, rollPowerUp, applySafely, isValidBoard };
}
