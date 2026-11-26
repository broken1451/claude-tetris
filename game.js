'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#ffffff', // 8 - comodín (Tinte); se pinta con degradado arcoíris
  // 9+ : piezas especiales (se dibujan con marco interior blanco)
  '#ff4081', // 9  - Pentominó + (rosa)
  '#c6ff00', // 10 - Pentominó U (lima)
  '#7c4dff', // 11 - Pentominó Y (violeta)
  '#00e676', // 12 - Single 1×1 (esmeralda)
  '#18ffff', // 13 - Hueca 3×3 (aqua)
  '#78909c', // 14 - basura / bloque fijo del Modo Desafío (gris)
];

const FIRST_SPECIAL = 9;

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  null,                                        // 8 reservado (comodín)
  [[0,9,0],[9,9,9],[0,9,0]],                  // 9  Pentominó +
  [[10,0,10],[10,10,10],[0,0,0]],             // 10 Pentominó U
  [[0,11,0,0],[11,11,11,11],[0,0,0,0],[0,0,0,0]], // 11 Pentominó Y
  [[12]],                                      // 12 Single 1×1
  [[13,13,13],[13,0,13],[13,13,13]],          // 13 Hueca 3×3
];

// Generación de piezas especiales. `chance` = probabilidad por pieza de que sea especial;
// `weights` reparte entre los tipos (el Single 12 no sale aquí: es recompensa por Tetris).
const SPECIAL_CONFIG = {
  chance: 0.1,
  weights: { 9: 1, 10: 1, 11: 1, 13: 1 },
  singleOnTetris: true,
};


const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const resumeBtn = document.getElementById('resume-btn');
const restartBtn = document.getElementById('restart-btn');

const slotsEl = document.getElementById('powerup-slots');
const toastEl = document.getElementById('toast');
const aimHintEl = document.getElementById('aim-hint');
const freezeBarEl = document.getElementById('freeze-bar');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
// puntuación avanzada (lógica en scoring.js)
let scoreState, lastWasRotation;
const comboEl = document.getElementById('combo');
const b2bEl = document.getElementById('b2b');
const volumeEl = document.getElementById('volume');
const muteBtn = document.getElementById('mute-btn');
// power-ups
let lockFlash = 0;   // ms restantes del destello al bloquear (piezas invisibles)
let inventory, freezeLeft, effects, aiming, shakeLeft;
// Modo Desafío: mode = 'classic' | 'challenge'; ch = { def, lvl, lvlIdx, st } (null en clásico)
let mode = 'classic', ch = null;
// Habilidades cargables (lógica pura en abilities.js). `queue` = piezas tras `next` (Visión anticipada).
let abil, queue, abilMenuOpen = false, lookaheadShown = false;
// Records locales: `onStart` = pantalla de inicio visible (no hay partida en marcha)
let onStart = true, runMaxCombo = 0;
const energyEl = document.getElementById('energy');
const energyFillEl = document.getElementById('energy-fill');
const energyTextEl = document.getElementById('energy-text');
const abilityMenuEl = document.getElementById('ability-menu');
const abilityTimersEl = document.getElementById('ability-timers');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const lookaheadCanvas = document.getElementById('lookahead-canvas');
const lookaheadCtx = lookaheadCanvas.getContext('2d');

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function rollSpecialType() {
  const entries = Object.entries(SPECIAL_CONFIG.weights);
  let x = Math.random() * entries.reduce((n, [, w]) => n + w, 0);
  for (const [type, w] of entries) {
    x -= w;
    if (x < 0) return Number(type);
  }
  return Number(entries[entries.length - 1][0]);
}

function randomPiece() {
  const special = Math.random() < SPECIAL_CONFIG.chance;
  return makePiece(special ? rollSpecialType() : Math.floor(Math.random() * 7) + 1);
}

function makePiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

const rotateCCW = shape => rotateCW(rotateCW(rotateCW(shape)));

function tryRotate() {
  const dir = chHook('rotateDir', 1);
  const rotated = dir < 0 ? rotateCCW(current.shape) : rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      lastWasRotation = true;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

// Quita las líneas completas y actualiza líneas/nivel/velocidad. Devuelve cuántas se quitaron;
// los puntos los calcula scoring.js desde el llamador.
function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    const prevLines = lines;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
    gainEnergy(cleared);
    if (cleared === 4 && SPECIAL_CONFIG.singleOnTetris) {
      next = makePiece(12);
      drawNext();
      notify('🎁 ¡Tetris! Pieza 1×1', COLORS[12]);
    }
    const hitos = Math.floor(lines / POWERUP_CONFIG.everyLines) - Math.floor(prevLines / POWERUP_CONFIG.everyLines);
    for (let i = 0; i < hitos; i++)
      if (Math.random() < POWERUP_CONFIG.spawnChance) grantPowerUp(rollPowerUp());
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += scoreDrop(gy - current.y, true);
  if (gy > current.y) lastWasRotation = false;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    lastWasRotation = false;
    score += scoreDrop(1, false);
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  const tspin = detectTSpin(board, current, lastWasRotation, ROWS, COLS);
  const lvl = level;                       // el nivel de la jugada es el anterior a limpiar
  const snap = ch ? null : takeSnapshot();
  merge();
  lockFlash = 250;
  const cleared = clearLines();
  if (snap) snap.energyGain = abil.energy - snap.energyBefore;
  abil.snapshot = snap;
  abil.holdUsed = false;
  drawHold();
  abil.undoneThisPiece = false;
  chOnLock(cleared);
  const ev = scoreLock(scoreState, {
    cleared, tspin, level: lvl, boardEmpty: board.every(row => row.every(v => !v)),
  });
  score += ev.points;
  updateHUD();
  onScoreEvent(ev);
  if (ch && checkChallenge()) return;
  spawn();
}

function spawn() {
  lastWasRotation = false;
  current = next;
  next = queue.shift();
  queue.push(randomPiece());
  if (collide(current.shape, current.x, current.y)) {
    if (ch) finishChallenge('lose'); else endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  if (colorIndex === WILD) {
    const g = context.createLinearGradient(x * size, y * size, (x + 1) * size, (y + 1) * size);
    ['#e57373', '#ffd54f', '#81c784', '#4dd0e1', '#ba68c8'].forEach((col, i, a) => g.addColorStop(i / (a.length - 1), col));
    context.fillStyle = g;
  } else {
    context.fillStyle = color;
  }
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  if (colorIndex >= FIRST_SPECIAL) {
    // marca de pieza especial: marco interior blanco + brillo
    context.strokeStyle = 'rgba(255,255,255,0.9)';
    context.lineWidth = 2;
    context.strokeRect(x * size + 5, y * size + 5, size - 10, size - 10);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || '#22222e';
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  if (shakeLeft > 0) ctx.translate((Math.random() - 0.5) * 6 * (shakeLeft / 300), (Math.random() - 0.5) * 6 * (shakeLeft / 300));
  drawGrid();
  if (!current) { ctx.restore(); return; }   // pantalla de inicio: aún no hay partida

  // board
  const hideLocked = chHook('hideLocked', false);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (hideLocked) {
        if (lockFlash > 0 && board[r][c]) drawBlock(ctx, c, r, board[r][c], BLOCK, 0.6 * lockFlash / 250);
        continue;
      }
      drawBlock(ctx, c, r, board[r][c], BLOCK);
    }

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);

  if (aiming) drawAimPreview();
  drawEffects();
  if (freezeLeft > 0) {
    ctx.fillStyle = 'rgba(79,195,247,0.12)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(79,195,247,0.8)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
  }
  ctx.restore();
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (next) drawPieceIn(nextCtx, next, NB, 0);
  drawLookahead();
}

// Dibuja una pieza centrada en una celda 4×4 (la `slot`-ésima en vertical) de un canvas.
function drawPieceIn(context, piece, size, slot) {
  const shape = piece.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2) + slot * 4;
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(context, offX + c, offY + r, shape[r][c], size);
}

function endGame() {
  if (ch) { finishChallenge('lose'); return; }
  if (gameOver || onStart) return;   // cada partida termina (y se registra) una sola vez
  gameOver = true;
  resumeBtn.classList.add('hidden');
  playSound('gameover');
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  showGameOverRecords();
}

function togglePause() {
  if (gameOver || onStart) return;
  if (!paused) cancelAim();
  paused = !paused;
  resumeBtn.classList.toggle('hidden', !paused);
  if (!paused) {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  updateEffects(dt);
  if (lockFlash > 0) lockFlash = Math.max(0, lockFlash - dt);
  if (ch) {
    ch.def.onTick?.(ch.st, dt, ch.lvl, chApi);
    updateChallengeHUD();
    if (checkChallenge()) return;
  }
  if (freezeLeft > 0) {
    freezeLeft = Math.max(0, freezeLeft - dt);
    updateFreezeBar();
    dropAccum = 0;
  } else if (!aiming) {
    dropAccum += dt;
  }
  tickAbilities(abil, dt);
  updateAbilityTimers();
  if (dropAccum >= dropInterval * (abil.timers.slow > 0 ? ABILITY_CONFIG.slowFactor : 1)) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastWasRotation = false;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  mode = 'classic'; ch = null;
  document.body.classList.remove('mode-challenge');
  resetRun();
}

function resetRun() {
  leaveRecordScreens();
  runMaxCombo = 0;
  abil = createAbilityState();
  queue = Array.from({ length: ABILITY_CONFIG.lookaheadCount }, randomPiece);
  abilMenuOpen = false;
  abilityMenuEl.classList.add('hidden');
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  scoreState = createScoreState();
  lastWasRotation = false;
  resetComboHUD();
  inventory = [];
  freezeLeft = 0;
  effects = [];
  aiming = null;
  shakeLeft = 0;
  toastEl.replaceChildren();
  aimHintEl.classList.add('hidden');
  canvas.classList.remove('aiming');
  updateFreezeBar();
  renderSlots();
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  resumeBtn.classList.add('hidden');
  overlay.classList.remove('win');
  restartBtn.textContent = 'Reiniciar';
  nextLevelBtn.classList.add('hidden');
  menuBtn.classList.add('hidden');
  lockFlash = 0;
  updateEnergyUI();
  updateAbilityTimers();
  drawHold();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

// Teclas de Hold (configurables: basta editar esta lista).
const HOLD_KEYS = ['KeyC', 'ShiftLeft', 'ShiftRight'];

document.addEventListener('keydown', e => {
  AudioManager.unlock();
  if (e.target instanceof HTMLInputElement && e.target.type === 'text') return;   // escribiendo el nombre
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (onStart) return;   // en la pantalla de inicio no hay teclas de juego
  if (abilMenuOpen) { handleAbilityMenuKey(e); return; }
  if (e.code === 'KeyP') { if (!menuOpen) togglePause(); return; }
  if (menuOpen || paused || gameOver) return;
  if (handlePowerUpKey(e)) return;
  if (e.code === 'KeyQ') { openAbilityMenu(); return; }
  if (HOLD_KEYS.includes(e.code)) { e.preventDefault(); doHold(); return; }
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) { current.x--; lastWasRotation = false; }
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) { current.x++; lastWasRotation = false; }
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

// ---- Power-ups ----

function notify(text, color) {
  const el = document.createElement('div');
  el.className = 'toast-item';
  el.textContent = text;
  if (color) el.style.setProperty('--pu-color', color);
  el.addEventListener('animationend', () => el.remove());
  toastEl.appendChild(el);
  while (toastEl.children.length > 3) toastEl.firstChild.remove();
}

function renderSlots(popIndex) {
  slotsEl.replaceChildren();
  for (let i = 0; i < POWERUP_CONFIG.maxInventory; i++) {
    const def = inventory[i];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot';
    if (def) {
      btn.classList.add('filled');
      if (i === popIndex) btn.classList.add('pop');
      if (aiming && aiming.slot === i) btn.classList.add('active');
      btn.style.setProperty('--pu-color', def.color);
      btn.title = `${def.name} (${i + 1})`;
      btn.textContent = def.icon;
      btn.addEventListener('click', () => { usePowerUp(i); btn.blur(); });
    } else {
      btn.disabled = true;
    }
    const key = document.createElement('span');
    key.className = 'key';
    key.textContent = i + 1;
    btn.appendChild(key);
    slotsEl.appendChild(btn);
  }
}

// def puede ser un objeto del catálogo o su id (útil desde la consola: grantPowerUp('bomb'))
function grantPowerUp(def) {
  if (typeof def === 'string') def = POWERUPS[def];
  if (!def || gameOver || onStart || ch) return false;
  if (inventory.length >= POWERUP_CONFIG.maxInventory) {
    notify('Inventario lleno', def.color);
    return false;
  }
  inventory.push(def);
  playSound('powerup');
  renderSlots(inventory.length - 1);
  notify(`${def.icon} ${def.name} obtenido`, def.color);
  return true;
}

function usePowerUp(slot) {
  if (paused || gameOver) return;
  const def = inventory[slot];
  if (!def) return;
  if (aiming && aiming.slot === slot) { cancelAim(); return; }
  if (!def.target) { applyPowerUp(slot, null); return; }
  aiming = { slot, def, r: Math.floor(ROWS / 2), c: Math.floor(COLS / 2), axis: 'row' };
  canvas.classList.add('aiming');
  updateAimHint();
  renderSlots();
}

function cancelAim() {
  if (!aiming) return;
  aiming = null;
  canvas.classList.remove('aiming');
  aimHintEl.classList.add('hidden');
  renderSlots();
}

function updateAimHint() {
  if (!aiming) return;
  aimHintEl.textContent = `${aiming.def.icon} ${aiming.def.hint} · Esc cancela`;
  aimHintEl.classList.remove('hidden');
}

function aimTarget() {
  const { def, r, c, axis } = aiming;
  if (def.target === 'cell') return { r, c };
  if (def.target === 'line') return { axis, index: axis === 'row' ? r : c };
  if (def.target === 'color') return board[r][c] >= 1 && board[r][c] <= 7 ? { color: board[r][c] } : null;
  return null;
}

function confirmAim() {
  const target = aimTarget();
  if (!target) { notify('Elige un bloque de color', aiming.def.color); return; }
  const slot = aiming.slot;
  cancelAim();
  applyPowerUp(slot, target);
}

const countBlocks = b => b.reduce((n, row) => n + row.filter(Boolean).length, 0);

function applyPowerUp(slot, target) {
  const def = inventory[slot];
  const res = applySafely(board, def, target);
  if (!res) { notify('No se pudo aplicar', def.color); return; }
  if (!res.cells.length && !res.durationMs) { notify(`${def.name}: sin efecto`, def.color); return; }

  const destroyed = countBlocks(board) - countBlocks(res.board);
  board = res.board;                       // el tablero ya fue validado
  inventory.splice(slot, 1);
  if (destroyed > 0) score += destroyed * POWERUP_CONFIG.scorePerCell;
  if (res.durationMs) { freezeLeft = res.durationMs; updateFreezeBar(); }

  notify(`${def.icon} ${def.name}!`, def.color);
  spawnEffects(def, res, target);

  playSound('powerup');
  const lvl = level;
  const n = clearLines();   // gravedad / rayo pueden completar líneas
  if (n) score += scoreClearOnly(n, lvl);   // sin tocar combo ni B2B
  updateHUD();
  renderSlots();

  // la pieza activa nunca debe quedar solapada con el tablero tras el efecto
  while (collide(current.shape, current.x, current.y) && current.y > -current.shape.length) current.y--;
  lastWasRotation = false;
  // va al final: endGame() registra el record, así que puntos y líneas ya deben ser definitivos
  if (collide(current.shape, current.x, current.y)) endGame();
}

function handlePowerUpKey(e) {
  if (aiming) {
    switch (e.code) {
      case 'Escape': cancelAim(); break;
      case 'ArrowLeft': aiming.c = Math.max(0, aiming.c - 1); break;
      case 'ArrowRight': aiming.c = Math.min(COLS - 1, aiming.c + 1); break;
      case 'ArrowUp': aiming.r = Math.max(0, aiming.r - 1); break;
      case 'ArrowDown': aiming.r = Math.min(ROWS - 1, aiming.r + 1); break;
      case 'Enter': case 'Space': confirmAim(); break;
      case 'KeyR': aiming.axis = aiming.axis === 'row' ? 'col' : 'row'; break;
      default:
        if (/^Digit[1-9]$/.test(e.code)) usePowerUp(Number(e.code.slice(5)) - 1);
        return true;
    }
    e.preventDefault();
    return true;   // en modo apuntado el resto de teclas no mueve la pieza
  }
  if (/^Digit[1-9]$/.test(e.code)) { usePowerUp(Number(e.code.slice(5)) - 1); return true; }
  return false;
}

function boardCellFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const c = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width) / BLOCK);
  const r = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height) / BLOCK);
  return { r: Math.min(ROWS - 1, Math.max(0, r)), c: Math.min(COLS - 1, Math.max(0, c)) };
}

canvas.addEventListener('mousemove', e => {
  if (!aiming) return;
  Object.assign(aiming, boardCellFromEvent(e));
});
canvas.addEventListener('click', e => {
  if (!aiming || paused || gameOver) return;
  Object.assign(aiming, boardCellFromEvent(e));
  confirmAim();
});
canvas.addEventListener('contextmenu', e => {
  if (!aiming) return;
  e.preventDefault();
  cancelAim();
});

function updateFreezeBar() {
  freezeBarEl.classList.toggle('hidden', freezeLeft <= 0);
  freezeBarEl.firstElementChild.style.width = `${(freezeLeft / POWERUP_CONFIG.freezeMs) * 100}%`;
}

// ---- Efectos visuales ----

function cellCenter(r, c) { return { x: (c + 0.5) * BLOCK, y: (r + 0.5) * BLOCK }; }

function burst(cells, color, n = 3, speed = 0.18) {
  for (const { r, c } of cells) {
    const { x, y } = cellCenter(r, c);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random());
      effects.push({ kind: 'particle', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.05,
        size: 2 + Math.random() * 3, color, t: 0, dur: 500 + Math.random() * 300 });
    }
  }
}

// Efectos por power-up (clave = id). Si falta, se usa un pulso genérico → catálogo ampliable.
const EFFECT_SPAWNERS = {
  bomb(def, res, target) {
    const { x, y } = cellCenter(target.r, target.c);
    effects.push({ kind: 'ring', x, y, maxR: BLOCK * 2.2, color: def.color, t: 0, dur: 450 });
    burst(res.cells, def.color, 4);
    shakeLeft = 300;
  },
  lightning(def, res, target) {
    const pts = [];
    const len = target.axis === 'row' ? COLS * BLOCK : ROWS * BLOCK;
    const mid = (target.index + 0.5) * BLOCK;
    for (let d = 0; d <= len; d += 15) pts.push({ d, o: d === 0 || d === len ? 0 : (Math.random() - 0.5) * 12 });
    effects.push({ kind: 'bolt', axis: target.axis, mid, pts, color: def.color, t: 0, dur: 400 });
    burst(res.cells, def.color, 3, 0.25);
  },
  tint(def, res) {
    effects.push({ kind: 'pulse', cells: res.cells, color: '#ffffff', t: 0, dur: 600 });
    burst(res.cells, def.color, 2, 0.1);
  },
  gravity(def, res) {
    effects.push({ kind: 'pulse', cells: res.cells, color: def.color, t: 0, dur: 450 });
    burst(res.cells, 'rgba(180,180,180,0.9)', 2, 0.08);
    shakeLeft = 200;
  },
  freeze(def) {
    effects.push({ kind: 'flash', color: '79,195,247', t: 0, dur: 500 });
    for (let i = 0; i < 30; i++)
      effects.push({ kind: 'particle', x: Math.random() * COLS * BLOCK, y: Math.random() * ROWS * BLOCK * 0.5,
        vx: (Math.random() - 0.5) * 0.05, vy: 0.04 + Math.random() * 0.08, size: 2 + Math.random() * 3,
        color: '#e1f5fe', t: 0, dur: 900 + Math.random() * 500 });
  },
};

function spawnEffects(def, res, target) {
  if (EFFECT_SPAWNERS[def.id]) EFFECT_SPAWNERS[def.id](def, res, target);
  else effects.push({ kind: 'flash', color: '255,255,255', t: 0, dur: 400 });
}

function updateEffects(dt) {
  if (shakeLeft > 0) shakeLeft = Math.max(0, shakeLeft - dt);
  for (const e of effects) {
    e.t += dt;
    if (e.kind === 'particle') { e.x += e.vx * dt; e.y += e.vy * dt; }
  }
  effects = effects.filter(e => e.t < e.dur);
}

function drawEffects() {
  for (const e of effects) {
    if (e.t < 0) continue;   // efectos con retardo
    const p = e.t / e.dur;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - p);
    switch (e.kind) {
      case 'ring':
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 5 * (1 - p) + 1;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.maxR * p, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'particle':
        ctx.fillStyle = e.color;
        ctx.fillRect(e.x - e.size / 2, e.y - e.size / 2, e.size, e.size);
        break;
      case 'bolt':
        ctx.strokeStyle = '#fff';
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 15;
        ctx.lineWidth = 3;
        ctx.beginPath();
        e.pts.forEach(({ d, o }, i) => {
          const x = e.axis === 'row' ? d : e.mid + o;
          const y = e.axis === 'row' ? e.mid + o : d;
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        });
        ctx.stroke();
        break;
      case 'pulse':
        ctx.fillStyle = e.color;
        for (const { r, c } of e.cells) ctx.fillRect(c * BLOCK + 1, r * BLOCK + 1, BLOCK - 2, BLOCK - 2);
        break;
      case 'text':
        ctx.globalAlpha = p < 0.6 ? 1 : (1 - p) / 0.4;
        ctx.font = `800 ${e.size}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.fillStyle = e.color;
        ctx.strokeText(e.text, e.x, e.y - p * 30);
        ctx.fillText(e.text, e.x, e.y - p * 30);
        break;
      case 'frame':
        ctx.strokeStyle = e.color;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 20;
        ctx.lineWidth = 4 + 3 * Math.sin(p * Math.PI * 6);
        ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
        break;
      case 'flash':
        ctx.fillStyle = `rgba(${e.color},${0.5 * (1 - p)})`;
        ctx.globalAlpha = 1;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        break;
    }
    ctx.restore();
  }
}

function drawAimPreview() {
  const { def, r, c, axis } = aiming;
  const cells = [];
  if (def.target === 'cell') {
    for (let y = r - 1; y <= r + 1; y++)
      for (let x = c - 1; x <= c + 1; x++)
        if (y >= 0 && y < ROWS && x >= 0 && x < COLS) cells.push({ r: y, c: x });
  } else if (def.target === 'line') {
    for (let i = 0; i < (axis === 'row' ? COLS : ROWS); i++)
      cells.push(axis === 'row' ? { r, c: i } : { r: i, c });
  } else if (def.target === 'color') {
    const col = board[r][c];
    if (col >= 1 && col <= 7)
      for (let y = 0; y < ROWS; y++)
        for (let x = 0; x < COLS; x++)
          if (board[y][x] === col) cells.push({ r: y, c: x });
  }
  ctx.save();
  ctx.globalAlpha = 0.28 + 0.12 * Math.sin(performance.now() / 120);
  ctx.fillStyle = def.color;
  for (const p of cells) ctx.fillRect(p.c * BLOCK, p.r * BLOCK, BLOCK, BLOCK);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = def.color;
  ctx.lineWidth = 2;
  ctx.strokeRect(c * BLOCK + 1, r * BLOCK + 1, BLOCK - 2, BLOCK - 2);
  ctx.restore();
}


// ---- Habilidades cargables (catálogo y reglas en abilities.js; solo Modo Clásico) ----

const MIN_ABILITY_COST = Math.min(...ABILITIES.map(a => a.cost));
const timerChips = {};
for (const a of ABILITIES.filter(a => a.durationMs)) {
  const chip = document.createElement('div');
  chip.className = 'ability-chip hidden';
  chip.style.setProperty('--pu-color', a.color);
  chip.title = a.name;
  chip.innerHTML = '<span class="ic"></span><span class="bar"><span></span></span>';
  chip.firstChild.textContent = a.icon;
  abilityTimersEl.appendChild(chip);
  timerChips[a.id] = { chip, fill: chip.querySelector('.bar span'), on: false };
}

function restartAnim(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;   // reinicia la animación
  el.classList.add(cls);
}

function updateEnergyUI(gained) {
  const max = ABILITY_CONFIG.maxEnergy;
  energyFillEl.style.width = `${(abil.energy / max) * 100}%`;
  energyTextEl.textContent = `${abil.energy}/${max}`;
  energyEl.classList.toggle('ready', abil.energy >= MIN_ABILITY_COST);
  energyEl.classList.toggle('full', abil.energy >= max);
  if (gained) restartAnim(energyEl, 'charging');
}

function gainEnergy(cleared) {
  if (ch) return;
  const gained = addEnergy(abil, cleared);
  if (!gained) return;
  updateEnergyUI(true);
  if (abil.energy >= ABILITY_CONFIG.maxEnergy) {
    playSound('energyFull');
    notify('⚡ Energía al máximo (Q)', '#ffd54f');
  }
}

// Chips de duración de las habilidades temporales + redibujo de los paneles que dependen de ellas.
function updateAbilityTimers() {
  for (const a of ABILITIES) {
    const t = timerChips[a.id];
    if (!t) continue;
    const left = abil.timers[a.id];
    if ((left > 0) !== t.on) {
      t.on = left > 0;
      t.chip.classList.toggle('hidden', !t.on);
      if (a.id === 'lookahead') drawLookahead();
    }
    if (t.on) t.fill.style.width = `${(left / a.durationMs) * 100}%`;
  }
}

function drawLookahead() {
  const on = abil.timers.lookahead > 0;
  lookaheadCanvas.classList.toggle('hidden', !on);
  lookaheadCtx.clearRect(0, 0, lookaheadCanvas.width, lookaheadCanvas.height);
  if (on) queue.forEach((p, i) => drawPieceIn(lookaheadCtx, p, 12, i));
}

function drawHold() {
  holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  holdCanvas.classList.toggle('inactive', abil.holdUsed);   // atenuado mientras esté bloqueado
  if (abil.held != null) drawPieceIn(holdCtx, makePiece(abil.held), 18, 0);
}

// Estado previo a una colocación, para «Deshacer».
function takeSnapshot() {
  return {
    board: board.map(row => [...row]), score, lines, level, dropInterval,
    scoreState: { ...scoreState }, type: current.type, holdUsed: abil.holdUsed,
    energyBefore: abil.energy, energyGain: 0, runMaxCombo,
  };
}

function doHold() {
  if (ch || gameOver || paused || aiming) return;
  const color = '#81c784';
  if (abil.holdUsed) { notify('Hold ya usado con esta pieza', color); return; }
  const type = current.type;
  if (abil.held == null) {
    abil.held = type;
    spawn();
  } else {
    const p = makePiece(abil.held);
    if (collide(p.shape, p.x, p.y)) { notify('No hay espacio para la reserva', color); return; }
    abil.held = type;
    current = p;
    lastWasRotation = false;
  }
  abil.holdUsed = true;
  playSound('ability');
  drawHold();
  drawNext();
  holdCanvas.classList.remove('swap');
  void holdCanvas.offsetWidth;            // reinicia la animación
  holdCanvas.classList.add('swap');
}

// Efectos puntuales; devolver false cancela la activación (no se gasta energía).
const ABILITY_EFFECTS = {
  lookahead: () => true,
  slow: () => true,
  swap() {
    let p;
    do { p = randomPiece(); } while (p.type === current.type);
    p.x = Math.max(0, Math.min(current.x, COLS - p.shape[0].length));
    for (let y = current.y; y >= current.y - p.shape.length; y--) {   // sube la pieza si no cabe
      if (!collide(p.shape, p.x, y)) {
        p.y = y; current = p; lastWasRotation = false;
        return true;
      }
    }
    notify('No hay espacio para intercambiar', ABILITY_BY_ID.swap.color);
    return false;
  },
  undo() {
    const s = abil.snapshot;
    board = s.board; score = s.score; lines = s.lines; level = s.level;
    dropInterval = s.dropInterval; scoreState = s.scoreState;
    runMaxCombo = s.runMaxCombo;
    abil.holdUsed = s.holdUsed;
    abil.energy = Math.max(0, abil.energy - s.energyGain);   // la energía de esa jugada también se revierte
    queue.unshift(next); queue.pop();                        // la pieza actual vuelve a ser la siguiente
    next = makePiece(current.type);
    current = makePiece(s.type);
    abil.snapshot = null;
    abil.undoneThisPiece = true;
    lastWasRotation = false; lockFlash = 0; dropAccum = 0;
    const m = Math.max(1, Math.min(scoreState.chain, SCORING_CONFIG.comboCap));
    comboEl.textContent = `x${m}`;
    comboEl.classList.toggle('active', m >= 2);
    b2bEl.classList.toggle('hidden', !scoreState.b2b);
    updateHUD(); drawNext(); drawHold();
    return true;
  },
};

function selectAbility(id) {
  const def = ABILITY_BY_ID[id];
  const why = canActivate(abil, id, { aiming, gameOver });
  if (why) {
    notify(why, def.color);
    restartAnim(energyEl, 'denied');
    playSound('lock');
    return;
  }
  if (ABILITY_EFFECTS[id]() === false) return;
  spendAbility(abil, id);
  updateEnergyUI();
  updateAbilityTimers();
  notify(`${def.icon} ${def.name}`, def.color);
  floatText(def.name, def.color, 0, 24);
  effects.push({ kind: 'frame', color: def.color, t: 0, dur: 600 });
  playSound('ability');
  closeAbilityMenu();
}

function renderAbilityMenu() {
  abilityMenuEl.replaceChildren();
  const title = document.createElement('div');
  title.className = 'am-title';
  title.textContent = `HABILIDADES · ⚡ ${abil.energy}/${ABILITY_CONFIG.maxEnergy}`;
  abilityMenuEl.appendChild(title);
  for (const a of ABILITIES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ability-item';
    b.classList.toggle('locked', abil.energy < a.cost);
    b.style.setProperty('--pu-color', a.color);
    for (const [cls, text] of [['ic', a.icon], ['nm', a.name], ['ds', a.desc], ['co', `⚡${a.cost}`], ['ky', a.key]]) {
      const s = document.createElement('span');
      s.className = cls;
      s.textContent = text;
      b.appendChild(s);
    }
    b.addEventListener('click', () => { b.blur(); selectAbility(a.id); });
    abilityMenuEl.appendChild(b);
  }
  const hint = document.createElement('div');
  hint.className = 'am-hint';
  hint.textContent = 'Q / Esc cierra · el juego está en pausa';
  abilityMenuEl.appendChild(hint);
}

// El menú pausa la partida mientras está abierto (no hay caída accidental ni conflicto con el bucle).
function openAbilityMenu() {
  if (ch || gameOver || onStart || paused || menuOpen || abilMenuOpen) return;
  if (aiming) { notify('Termina de apuntar el power-up', '#ffffff'); return; }
  abilMenuOpen = true;
  paused = true;
  cancelAnimationFrame(animId);
  renderAbilityMenu();
  abilityMenuEl.classList.remove('hidden');
}

function closeAbilityMenu() {
  if (!abilMenuOpen) return;
  abilMenuOpen = false;
  abilityMenuEl.classList.add('hidden');
  paused = false;
  lastTime = performance.now();
  loop(lastTime);
}

function handleAbilityMenuKey(e) {
  if (e.code === 'KeyQ' || e.code === 'Escape') { e.preventDefault(); closeAbilityMenu(); return; }
  const m = /^Digit([1-9])$/.exec(e.code);
  const def = m && ABILITIES.find(a => a.key === Number(m[1]));
  if (def) selectAbility(def.id);
}

energyEl.addEventListener('click', () => {
  energyEl.blur();
  if (abilMenuOpen) closeAbilityMenu(); else openAbilityMenu();
});


// ---- Puntuación avanzada: HUD, efectos y sonido (los cálculos están en scoring.js) ----

function resetComboHUD() {
  comboEl.textContent = 'x1';
  comboEl.classList.remove('active');
  b2bEl.classList.add('hidden');
}

function popCombo() {
  comboEl.classList.remove('pop');
  void comboEl.offsetWidth;   // reinicia la animación
  comboEl.classList.add('pop');
}

function floatText(text, color, row, size = 26) {
  effects.push({ kind: 'text', text, color, size, x: COLS * BLOCK / 2, y: 200 + row * 34, t: 0, dur: 1500 });
}

function confetti(n) {
  const colors = ['#e57373', '#ffd54f', '#81c784', '#4dd0e1', '#ba68c8', '#ffb74d'];
  for (let i = 0; i < n; i++)
    effects.push({ kind: 'particle', x: Math.random() * COLS * BLOCK, y: -10, vx: (Math.random() - 0.5) * 0.15,
      vy: 0.1 + Math.random() * 0.25, size: 3 + Math.random() * 4, color: colors[i % colors.length],
      t: -Math.random() * 400, dur: 1400 + Math.random() * 600 });
}

// Único punto donde un resultado de puntuación se convierte en feedback.
function onScoreEvent(ev) {
  comboEl.textContent = `x${ev.multiplier}`;
  comboEl.classList.toggle('active', ev.multiplier >= 2);
  b2bEl.classList.toggle('hidden', !ev.b2bActive);
  if (ev.cleared) runMaxCombo = Math.max(runMaxCombo, ev.multiplier);

  if (!ev.cleared) {
    if (ev.tspin !== 'none') { floatText(ev.title, '#b388ff', 0); playSound('tspin'); }
    else playSound('lock');
    return;
  }

  let row = 0;
  floatText(ev.title, ev.tspin !== 'none' ? '#b388ff' : '#ffffff', row++, 30);
  if (ev.b2bApplied) floatText('BACK-TO-BACK', '#ffd54f', row++, 22);
  if (ev.multiplier >= 2) floatText(`COMBO x${ev.multiplier}`, '#4dd0e1', row++, 22);
  if (ev.perfect) floatText('PERFECT CLEAR!', '#ffd54f', row++, 30);
  floatText(`+${ev.points.toLocaleString()}`, '#81c784', row, 20);

  playSound(`clear${Math.min(ev.cleared, 4)}`);
  if (ev.multiplier >= 2) { popCombo(); playSound('combo', { pitch: 1 + 0.08 * (ev.multiplier - 2) }); }
  if (ev.tspin !== 'none') {
    playSound('tspin');
    effects.push({ kind: 'flash', color: '179,136,255', t: 0, dur: 600 });
    for (let i = 0; i < 3; i++)
      effects.push({ kind: 'ring', x: COLS * BLOCK / 2, y: ROWS * BLOCK / 2, maxR: 220, color: '#b388ff', t: -i * 120, dur: 600 });
  }
  if (ev.b2bApplied) {
    playSound('b2b');
    effects.push({ kind: 'frame', color: '#ffd54f', t: 0, dur: 1200 });
  }
  if (ev.perfect) {
    playSound('perfect');
    effects.push({ kind: 'flash', color: '255,213,79', t: 0, dur: 900 });
    confetti(80);
    shakeLeft = 500;
  }
}

// ---- Sonido: volumen y silencio ----
function syncSoundUI() {
  const { volume, muted } = AudioManager.settings;
  volumeEl.value = String(Math.round(volume * 100));
  muteBtn.textContent = muted || volume === 0 ? '🔇' : '🔊';
  muteBtn.setAttribute('aria-pressed', String(muted));
}

function toggleMute() {
  AudioManager.toggleMute();
  syncSoundUI();
}

volumeEl.addEventListener('input', () => { AudioManager.unlock(); AudioManager.setVolume(volumeEl.value / 100); syncSoundUI(); });
volumeEl.addEventListener('change', () => volumeEl.blur());   // las flechas no deben mover el slider
muteBtn.addEventListener('click', () => { AudioManager.unlock(); toggleMute(); muteBtn.blur(); });
document.addEventListener('pointerdown', () => AudioManager.unlock());
syncSoundUI();

resumeBtn.addEventListener('click', () => { resumeBtn.blur(); if (paused) togglePause(); });
restartBtn.addEventListener('click', () => ch ? startChallenge(ch.def.id, ch.lvlIdx) : init());

// ---- Tema claro/oscuro (oscuro por defecto) ----
const themeToggle = document.getElementById('theme-toggle');
const themeText = document.getElementById('theme-text');

function applyTheme(theme) {
  const light = theme === 'light';
  if (light) document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  themeToggle.setAttribute('aria-checked', String(light));
  themeText.textContent = light ? 'Claro' : 'Oscuro';
  // redibujar aunque esté en pausa o game over
  draw();
  drawNext();
}

let savedTheme = null;
try { savedTheme = localStorage.getItem('theme'); } catch (e) {}
themeToggle.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('theme', next); } catch (e) {}
  applyTheme(next);
  themeToggle.blur(); // evita que Espacio vuelva a activar el botón
});


// ---- Modo Desafío (el catálogo y las estadísticas viven en challenges.js) ----
const tabClassic = document.getElementById('tab-classic');
const tabChallenge = document.getElementById('tab-challenge');
const menuEl = document.getElementById('challenge-menu');
const wrapperEl = document.getElementById('game-wrapper');
const chHudEl = document.getElementById('challenge-hud');
const chBadgeEl = document.getElementById('challenge-badge');
const nextLevelBtn = document.getElementById('next-level-btn');
const menuBtn = document.getElementById('menu-btn');
let menuOpen = false;

// API que reciben los hooks de los desafíos: el único acceso que tienen al estado del juego.
const chApi = {
  setBoard(rows) {
    board = rows.map(row => [...row].map(ch => ch === 'X' ? GARBAGE : 0));
    return board;
  },
  countBoard: b => b.reduce((n, row) => n + row.filter(v => v === GARBAGE).length, 0),
  // sube el tablero una fila y añade basura con un hueco; false si ya no cabe (derrota)
  addGarbageRow() {
    if (board[0].some(Boolean)) return false;
    const hole = Math.floor(Math.random() * COLS);
    board.shift();
    board.push(Array.from({ length: COLS }, (_, c) => c === hole ? 0 : GARBAGE));
    while (collide(current.shape, current.x, current.y) && current.y > -current.shape.length) current.y--;
    return !collide(current.shape, current.x, current.y);
  },
};

// Llama a un hook opcional del desafío activo; fuera del modo desafío devuelve `fallback`.
function chHook(name, fallback) {
  const fn = ch && ch.def[name];
  return fn ? fn(ch.st, ch.lvl) : fallback;
}

function chOnLock(cleared) {
  if (ch) ch.def.onLock?.(ch.st, { cleared, lines, board }, ch.lvl, chApi);
}

// true si el desafío terminó (victoria o derrota)
function checkChallenge() {
  if (gameOver) return true;
  const s = ch.def.status(ch.st, ch.lvl);
  if (s === 'playing') return false;
  finishChallenge(s);
  return true;
}

function updateChallengeHUD() {
  if (!ch) return;
  const p = ch.def.progress(ch.st, ch.lvl);
  document.getElementById('ch-text').textContent = p.text;
  document.getElementById('ch-bar-fill').style.width = `${p.ratio * 100}%`;
  const timerEl = document.getElementById('ch-timer');
  timerEl.textContent = p.timer || '';
  timerEl.classList.toggle('low', !!p.timer && ch.def.id === 'timeattack' && ch.st.left < 15000);
  const badge = ch.def.badge?.(ch.st, ch.lvl);
  chBadgeEl.textContent = badge || '';
  chBadgeEl.classList.toggle('hidden', !badge);
  document.getElementById('rot-hint').textContent = chHook('rotateDir', 1) < 0 ? 'rotar ↺ (inverso)' : 'rotar';
}

function finishChallenge(result) {
  if (gameOver) return;
  gameOver = true;
  cancelAnimationFrame(animId);
  const won = result === 'win';
  const res = ch.def.result?.(ch.st, ch.lvl);
  ChallengeStats.record(ch.def.id, ch.lvlIdx, won, res);
  updateChallengeHUD();
  playSound(won ? 'perfect' : 'gameover');
  overlay.classList.toggle('win', won);
  overlayTitle.textContent = won ? '¡VICTORIA!' : 'DERROTA';
  overlayScore.textContent = [ch.def.name + ' · ' + ch.lvl.label, res && res.text].filter(Boolean).join(' — ');
  resumeBtn.classList.add('hidden');
  restartBtn.textContent = 'Reiniciar desafío';
  nextLevelBtn.classList.toggle('hidden', !(won && ch.def.levels[ch.lvlIdx + 1]));
  menuBtn.classList.remove('hidden');
  overlay.classList.remove('hidden');
  draw();
}

function startChallenge(id, lvlIdx) {
  const def = CHALLENGES.find(c => c.id === id);
  if (!def || !def.levels[lvlIdx]) return;
  mode = 'challenge';
  ch = { def, lvl: def.levels[lvlIdx], lvlIdx, st: null };
  document.body.classList.add('mode-challenge');
  showMenu(false);
  resetRun();
  ch.st = def.setup ? def.setup(ch.lvl, chApi) : {};
  // el tablero pudo cambiar en setup: reubica la pieza si hace falta
  while (collide(current.shape, current.x, current.y) && current.y > -current.shape.length) current.y--;
  chHudEl.classList.remove('hidden');
  document.getElementById('ch-name').textContent = `${def.icon} ${def.name}`.toUpperCase();
  document.getElementById('ch-level').textContent = `Nivel ${lvlIdx + 1}: ${ch.lvl.label}`;
  updateChallengeHUD();
}

function showMenu(open) {
  menuOpen = open;
  menuEl.classList.toggle('hidden', !open);
  wrapperEl.classList.toggle('hidden', open);
  tabChallenge.classList.toggle('active', open || !!ch);
  tabClassic.classList.toggle('active', !open && !ch);
  if (open) {
    commitPendingRecord();   // salir del game over sin guardar también registra la puntuación
    // sin esto, cerrar el menú de habilidades reanudaría (y podría registrar) la partida oculta
    abilMenuOpen = false;
    abilityMenuEl.classList.add('hidden');
    cancelAnimationFrame(animId);
    if (ch) paused = true;
    renderMenu();
  }
}

function renderMenu() {
  menuEl.replaceChildren();
  for (const def of CHALLENGES) {
    const card = document.createElement('div');
    card.className = 'ch-card';
    card.innerHTML = '<h3></h3><p></p>';
    card.firstChild.textContent = `${def.icon} ${def.name}`;
    card.lastChild.textContent = def.desc;
    def.levels.forEach((lvl, i) => {
      const st = ChallengeStats.get(def.id, i);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ch-level-btn' + (st.wins ? ' won' : '');
      const open = ChallengeStats.unlocked(def.id, i);
      b.disabled = !open;
      const t = document.createElement('span');
      t.textContent = `${open ? '' : '🔒 '}Nivel ${i + 1}: ${lvl.label}`;
      const sm = document.createElement('small');
      sm.textContent = st.attempts ? `${st.wins}/${st.attempts} victorias${st.bestText ? ' · ' + st.bestText : ''}` : 'Sin intentos';
      b.append(t, sm);
      b.addEventListener('click', () => { b.blur(); startChallenge(def.id, i); });
      card.appendChild(b);
    });
    menuEl.appendChild(card);
  }
}

tabClassic.addEventListener('click', () => {
  tabClassic.blur();
  chHudEl.classList.add('hidden');
  chBadgeEl.classList.add('hidden');
  document.getElementById('rot-hint').textContent = 'rotar';
  showMenu(false);
  showStartScreen();
  tabClassic.classList.add('active');
  tabChallenge.classList.remove('active');
});
tabChallenge.addEventListener('click', () => { tabChallenge.blur(); showMenu(true); });
nextLevelBtn.addEventListener('click', () => { nextLevelBtn.blur(); startChallenge(ch.def.id, ch.lvlIdx + 1); });
menuBtn.addEventListener('click', () => { menuBtn.blur(); showMenu(true); });


// ---- Records locales (lógica y persistencia en records.js; solo Modo Clásico) ----
const startScreenEl = document.getElementById('start-screen');
const startRecordsEl = document.getElementById('start-records');
const playBtn = document.getElementById('play-btn');
const overRecordsBlockEl = document.getElementById('over-records-block');
const overRecordsEl = document.getElementById('over-records');
const recordMsgEl = document.getElementById('record-msg');
const recordFormEl = document.getElementById('record-form');
const recordNameEl = document.getElementById('record-name');
const recordStore = createRecordStore();
let pendingRecord = null;   // { score, lines, combo } que entra en el top y aún no se ha guardado
// El foco se retrasa para que las teclas que aún se estaban pulsando al perder no se escriban en el nombre.
const NAME_FOCUS_DELAY_MS = 600;

function textEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const formatCombo = combo => combo ? `x${combo}` : '—';

// Tabla, estadísticas y reset (con confirmación en la propia página). Los nombres van con textContent.
function renderRecords(container, records, highlight = -1) {
  const table = textEl('table', 'records-table');
  const headRow = table.createTHead().insertRow();
  for (const title of ['#', 'Nombre', 'Puntos', 'Líneas', 'Combo']) headRow.appendChild(textEl('th', '', title));
  const body = table.createTBody();
  for (let i = 0; i < RECORDS_CONFIG.maxEntries; i++) {
    const entry = records.top[i];
    const row = body.insertRow();
    row.classList.toggle('highlight', i === highlight);
    const cells = entry
      ? [i + 1, entry.name, entry.score.toLocaleString(), entry.lines, formatCombo(entry.combo)]
      : [i + 1, '—', '—', '—', '—'];
    for (const value of cells) row.appendChild(textEl('td', '', value));
  }

  const stats = textEl('p', 'records-stats');
  stats.append(
    textEl('span', '', `Mejor combo: ${formatCombo(records.bestCombo)}`),
    textEl('span', '', `Máx. líneas: ${records.bestLines}`),
  );

  const resetBtn = textEl('button', 'records-btn', 'Borrar records');
  resetBtn.type = 'button';
  resetBtn.disabled = !records.top.length && !records.bestCombo && !records.bestLines;

  const confirmBox = textEl('div', 'records-confirm hidden');
  const yesBtn = textEl('button', 'records-btn danger', 'Sí, borrar');
  const noBtn = textEl('button', 'records-btn', 'Cancelar');
  yesBtn.type = noBtn.type = 'button';
  confirmBox.append(textEl('span', '', '¿Borrar todos los records?'), yesBtn, noBtn);

  const askReset = asking => {
    resetBtn.classList.toggle('hidden', asking);
    confirmBox.classList.toggle('hidden', !asking);
  };
  resetBtn.addEventListener('click', () => { resetBtn.blur(); askReset(true); });
  noBtn.addEventListener('click', () => { noBtn.blur(); askReset(false); });
  yesBtn.addEventListener('click', () => { yesBtn.blur(); resetRecords(); });

  container.replaceChildren(table, stats, resetBtn, confirmBox);
}

// Se llama una vez desde endGame(), con la puntuación ya definitiva.
function showGameOverRecords() {
  const run = { score, lines, combo: runMaxCombo };
  const records = updateBests(recordStore.load(), run);
  recordStore.save(records);
  const preview = addEntry(records, { ...run, name: '¿Tu nombre?' });
  const enters = preview.index >= 0;
  pendingRecord = enters ? run : null;

  recordMsgEl.textContent = enters ? `★ ¡Entras en el top! Puesto #${preview.index + 1}` : '';
  recordMsgEl.classList.toggle('hidden', !enters);
  recordFormEl.classList.toggle('hidden', !enters);
  recordNameEl.value = '';
  renderRecords(overRecordsEl, enters ? preview.records : records, preview.index);
  overlayScore.classList.toggle('new-record', enters);
  overRecordsBlockEl.classList.remove('hidden');
  overlay.classList.add('with-records');
  if (enters) setTimeout(() => {
    if (pendingRecord === run) recordNameEl.focus({ preventScroll: true });
  }, NAME_FOCUS_DELAY_MS);
}

// Guarda la puntuación pendiente con el nombre escrito (vacío = "Anónimo"). Sin pendiente no hace nada.
function commitPendingRecord() {
  if (!pendingRecord) return;
  const result = addEntry(recordStore.load(), { ...pendingRecord, name: recordNameEl.value });
  pendingRecord = null;
  recordStore.save(result.records);
  recordNameEl.blur();
  recordFormEl.classList.add('hidden');
  recordMsgEl.textContent = result.index >= 0
    ? `★ Guardado en el puesto #${result.index + 1}`
    : 'La puntuación ya no entra en el top';
  renderRecords(overRecordsEl, result.records, result.index);
}

function resetRecords() {
  pendingRecord = null;   // la tabla debe quedar vacía: la partida recién terminada tampoco se guarda
  recordStore.reset();
  recordMsgEl.classList.add('hidden');
  recordFormEl.classList.add('hidden');
  overlayScore.classList.remove('new-record');
  renderRecords(startRecordsEl, recordStore.load());
  renderRecords(overRecordsEl, recordStore.load());
}

// Cierra la pantalla de inicio y los records del game over (lo usa toda partida nueva).
function leaveRecordScreens() {
  commitPendingRecord();
  onStart = false;
  startScreenEl.classList.add('hidden');
  overRecordsBlockEl.classList.add('hidden');
  overlayScore.classList.remove('new-record');
  overlay.classList.remove('with-records');
}

// Pantalla de inicio del Modo Clásico: la partida no arranca hasta pulsar «Jugar».
function showStartScreen() {
  mode = 'classic'; ch = null;
  document.body.classList.remove('mode-challenge');
  resetRun();                       // deja tablero y panel a cero...
  cancelAnimationFrame(animId);     // ...pero sin partida: ni caída ni piezas
  onStart = true;
  current = next = null;
  draw();
  drawNext();
  renderRecords(startRecordsEl, recordStore.load());
  startScreenEl.classList.remove('hidden');
}

playBtn.addEventListener('click', () => { playBtn.blur(); init(); });
recordFormEl.addEventListener('submit', e => { e.preventDefault(); commitPendingRecord(); });
// la autorrepetición de una tecla de juego mantenida no escribe ni envía (borrar y mover el cursor sí)
recordNameEl.addEventListener('keydown', e => {
  if (e.repeat && !/^(Backspace|Delete|Arrow)/.test(e.key)) e.preventDefault();
});
window.addEventListener('pagehide', commitPendingRecord);   // cerrar o recargar tampoco pierde el record


showStartScreen();
applyTheme(savedTheme === 'light' ? 'light' : 'dark');
