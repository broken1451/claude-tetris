'use strict';

// Modo Desafío: catálogo de desafíos (lógica pura, sin DOM).
// Para añadir uno basta con una entrada nueva en CHALLENGES; game.js no cambia.
//
// Entrada: { id, name, icon, desc, levels: [{ label, ...parámetros }], ...hooks }
// Hooks (todos opcionales salvo status/progress):
//   setup(lvl, api)         → estado inicial `st`; puede preparar el tablero con api.setBoard(...)
//   onTick(st, dt, lvl, api)→ cada frame (dt en ms; respeta pausa)
//   onLock(st, ev, lvl, api)→ tras bloquear una pieza; ev = { cleared, lines, board }
//   status(st, lvl)         → 'playing' | 'win' | 'lose'
//   progress(st, lvl)       → { text, ratio 0..1, timer? }
//   rotateDir(st, lvl)      → 1 (horario) | -1 (antihorario); por defecto 1
//   hideLocked(st, lvl)     → true oculta las piezas ya apoyadas
//   badge(st, lvl)          → texto de aviso permanente (opcional)
//   result(st, lvl)         → { value, text } resultado a guardar/mostrar (mayor value = mejor)
// api: { setBoard(rows) → tablero con 'X' como bloque GARBAGE, addGarbageRow() → false si pierde, countBoard(board) → nº de bloques GARBAGE }

const GARBAGE = 14;   // índice de color de las líneas de basura (debe ser ≤ MAX_CELL)

const fmtTime = ms => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const clamp01 = x => Math.max(0, Math.min(1, x));

// Desafíos "limpia N líneas" comparten lógica de conteo.
const lineGoal = (st, lvl) => st.lines >= lvl.target;
const countLines = (st, ev) => { st.lines += ev.cleared; };

const CHALLENGES = [
  {
    id: 'timeattack', name: 'Contrarreloj', icon: '⏱️',
    desc: 'Elimina las líneas antes de que se acabe el tiempo.',
    levels: [
      { label: '40 líneas · 2:00', target: 40, timeMs: 120000 },
      { label: '40 líneas · 1:30', target: 40, timeMs: 90000 },
      { label: '50 líneas · 1:30', target: 50, timeMs: 90000 },
    ],
    setup: lvl => ({ lines: 0, left: lvl.timeMs, elapsed: 0 }),
    onTick(st, dt) { st.left -= dt; st.elapsed += dt; },
    onLock: countLines,
    status: (st, lvl) => lineGoal(st, lvl) ? 'win' : st.left <= 0 ? 'lose' : 'playing',
    progress: (st, lvl) => ({
      text: `${Math.min(st.lines, lvl.target)} / ${lvl.target} líneas`,
      ratio: clamp01(st.lines / lvl.target), timer: fmtTime(st.left),
    }),
    result: st => ({ value: -st.elapsed, text: `Tiempo: ${fmtTime(st.elapsed)}` }),
  },

  {
    id: 'survival', name: 'Supervivencia', icon: '🧱',
    desc: 'Cada pocos segundos sube una línea de basura. Aguanta el mayor tiempo posible.',
    levels: [
      { label: 'Basura cada 10 s · aguanta 2:00', garbageMs: 10000, surviveMs: 120000 },
      { label: 'Basura cada 8 s · aguanta 2:30', garbageMs: 8000, surviveMs: 150000 },
      { label: 'Basura cada 6 s · aguanta 3:00', garbageMs: 6000, surviveMs: 180000 },
    ],
    setup: lvl => ({ t: 0, acc: 0, lost: false, lines: 0 }),
    onTick(st, dt, lvl, api) {
      st.t += dt;
      st.acc += dt;
      while (st.acc >= lvl.garbageMs) {
        st.acc -= lvl.garbageMs;
        if (!api.addGarbageRow()) { st.lost = true; break; }
      }
    },
    onLock: countLines,
    status: (st, lvl) => st.lost ? 'lose' : st.t >= lvl.surviveMs ? 'win' : 'playing',
    progress: (st, lvl) => ({
      text: `Sobrevives ${fmtTime(st.t)} / ${fmtTime(lvl.surviveMs)} · próxima basura ${Math.ceil((lvl.garbageMs - st.acc) / 1000)} s`,
      ratio: clamp01(st.t / lvl.surviveMs), timer: fmtTime(lvl.surviveMs - st.t),
    }),
    result: st => ({ value: st.t, text: `Sobreviviste: ${fmtTime(st.t)}` }),
    // la derrota normal (tablero lleno) también cuenta; game.js llama a result() en ambos casos
  },

  {
    id: 'preset', name: 'Tablero preconfigurado', icon: '🧩',
    desc: 'Empiezas con bloques fijos. Elimina todos para superar el escenario.',
    levels: [
      { label: 'Escenario 1 · Pirámide', layout: [
        '..........', '..........', '..........', '..........', '..........', '..........',
        '..........', '..........', '..........', '..........', '..........', '..........',
        '..........', '..........', '....XX....', '...XXXX...', '..XXXXXX..', '.XXXXXXXX.', 'XXXXXXXXX.', 'XXXXXXXX.X'] },
      { label: 'Escenario 2 · Columnas', layout: [
        '..........', '..........', '..........', '..........', '..........', '..........',
        '..........', '..........', '..........', '..........', '..........', '..........',
        'X..X..X..X', 'X..X..X..X', 'XX.XX.XX.X', 'XX.XX.XX.X', 'XXXXX.XXXX', 'XXXXX.XXXX', 'X.XXXXXXXX', 'XXXX.XXXXX'] },
      { label: 'Escenario 3 · Tablero de ajedrez', layout: [
        '..........', '..........', '..........', '..........', '..........', '..........',
        '..........', '..........', '..........', '..........', '..........', '..........',
        '.X.X.X.X.X', 'X.X.X.X.X.', '.X.X.X.X.X', 'X.X.X.X.X.', 'XXXXX.XXXX', 'XXXX.XXXXX', 'XXXXXX.XXX', 'XXX.XXXXXX'] },
    ],
    setup(lvl, api) {
      const board = api.setBoard(lvl.layout);
      return { lines: 0, initial: api.countBoard(board), left: api.countBoard(board) };
    },
    // `left` = bloques del escenario (color GARBAGE) que siguen en el tablero; las piezas del jugador usan otros colores
    onLock(st, ev, lvl, api) { st.lines += ev.cleared; st.left = api.countBoard(ev.board); },
    status: st => st.left === 0 ? 'win' : 'playing',
    progress: st => ({
      text: `${st.left} bloques restantes`, ratio: clamp01(1 - st.left / st.initial),
    }),
    result: st => ({ value: -st.lines, text: `Líneas: ${st.lines}` }),
  },

  {
    id: 'invisible', name: 'Piezas invisibles', icon: '👻',
    desc: 'Las piezas desaparecen al tocar el suelo. Memoriza el tablero.',
    levels: [
      { label: 'Elimina 10 líneas', target: 10 },
      { label: 'Elimina 15 líneas', target: 15 },
      { label: 'Elimina 20 líneas', target: 20 },
    ],
    setup: () => ({ lines: 0, locks: 0 }),
    onLock(st, ev) { st.lines += ev.cleared; st.locks++; },
    hideLocked: () => true,
    badge: () => '👻 PIEZAS INVISIBLES · guíate por la sombra y las líneas',
    status: (st, lvl) => lineGoal(st, lvl) ? 'win' : 'playing',
    progress: (st, lvl) => ({
      text: `${Math.min(st.lines, lvl.target)} / ${lvl.target} líneas · ${st.locks} piezas`,
      ratio: clamp01(st.lines / lvl.target),
    }),
    result: st => ({ value: -st.locks, text: `Piezas usadas: ${st.locks}` }),
  },

  {
    id: 'reverse', name: 'Rotación inversa', icon: '🔄',
    desc: 'En niveles avanzados el sentido de giro se invierte.',
    levels: [
      { label: 'Nivel 1 · giro normal · 10 líneas', target: 10, reverse: false },
      { label: 'Nivel 2 · giro invertido · 10 líneas', target: 10, reverse: true },
      { label: 'Nivel 3 · giro invertido · 20 líneas', target: 20, reverse: true },
    ],
    setup: () => ({ lines: 0, locks: 0 }),
    onLock(st, ev) { st.lines += ev.cleared; st.locks++; },
    rotateDir: (st, lvl) => lvl.reverse ? -1 : 1,
    badge: (st, lvl) => lvl.reverse ? '↺ ROTACIÓN INVERSA · ↑ gira en sentido antihorario' : '↻ Giro normal (↑ horario)',
    status: (st, lvl) => lineGoal(st, lvl) ? 'win' : 'playing',
    progress: (st, lvl) => ({
      text: `${Math.min(st.lines, lvl.target)} / ${lvl.target} líneas`, ratio: clamp01(st.lines / lvl.target),
    }),
    result: st => ({ value: -st.locks, text: `Piezas usadas: ${st.locks}` }),
  },
];

// ---- Estadísticas del modo desafío (independientes del clásico) ----
// { [id]: { [lvlIdx]: { attempts, wins, bestValue, bestText } } }
const ChallengeStats = (() => {
  const KEY = 'challengeStats';
  let data = {};
  try { data = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { data = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} };
  const get = (id, i) => (data[id] && data[id][i]) || { attempts: 0, wins: 0, bestValue: null, bestText: '' };
  return {
    get,
    // nivel i desbloqueado si es el 0 o el anterior se ganó al menos una vez
    unlocked: (id, i) => i === 0 || get(id, i - 1).wins > 0,
    record(id, i, won, res) {
      const s = get(id, i);
      s.attempts++;
      if (won) s.wins++;
      // en supervivencia/derrota también se guarda el mejor intento; en el resto solo victorias
      const keepBest = won || id === 'survival';
      if (res && keepBest && (s.bestValue === null || res.value > s.bestValue)) { s.bestValue = res.value; s.bestText = res.text; }
      (data[id] = data[id] || {})[i] = s;
      save();
    },
    reset() { data = {}; save(); },
  };
})();

if (typeof module !== 'undefined') module.exports = { CHALLENGES, ChallengeStats, GARBAGE, fmtTime };
