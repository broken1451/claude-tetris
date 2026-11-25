'use strict';

// Sistema de habilidades cargables: lógica pura (sin DOM). El pegamento y el render viven en game.js.
// Para añadir una habilidad: entrada en ABILITIES {id, name, icon, color, cost, key, durationMs?, desc}
// y un caso en `ABILITY_EFFECTS` (game.js). Las reglas anti-conflicto están en `canActivate`.

const ABILITY_CONFIG = {
  maxEnergy: 100,
  energyByLines: [0, 8, 16, 24, 40],   // energía ganada según líneas limpiadas de una vez (1–4)
  slowFactor: 2.5,                      // multiplica el intervalo de caída durante «Tiempo lento»
  lookaheadCount: 5,
};

const ABILITIES = [
  { id: 'lookahead', name: 'Visión anticipada', icon: '🔮', color: '#ba68c8', cost: 30, key: 1, durationMs: 20000, desc: 'Revela las siguientes 5 piezas' },
  { id: 'swap',      name: 'Intercambio',       icon: '🔀', color: '#ffb74d', cost: 25, key: 2, desc: 'Cambia la pieza actual por otra' },
  { id: 'slow',      name: 'Tiempo lento',      icon: '🐢', color: '#4fc3f7', cost: 40, key: 3, durationMs: 10000, desc: 'Caída más lenta durante 10 s' },
  { id: 'undo',      name: 'Deshacer',          icon: '⏪', color: '#ef5350', cost: 50, key: 4, desc: 'Revierte la última colocación' },
];

const ABILITY_BY_ID = Object.fromEntries(ABILITIES.map(a => [a.id, a]));

function createAbilityState() {
  return {
    energy: 0,
    timers: { lookahead: 0, slow: 0 },   // ms restantes de las habilidades temporales
    held: null,            // tipo de pieza guardada en HOLD (siempre disponible)
    holdUsed: false,       // ya se usó Hold con la pieza actual (se libera al aparecer la siguiente)
    snapshot: null,        // estado previo a la última colocación (lo gestiona game.js)
    undoneThisPiece: false,
  };
}

// Suma energía por líneas limpiadas; devuelve la energía realmente ganada.
function addEnergy(state, cleared) {
  const gain = ABILITY_CONFIG.energyByLines[Math.min(cleared, 4)] || 0;
  const before = state.energy;
  state.energy = Math.min(ABILITY_CONFIG.maxEnergy, state.energy + gain);
  return state.energy - before;
}

// null si se puede activar; si no, el motivo (texto para mostrar al jugador).
// ctx: { aiming, gameOver } — estado del juego que la lógica pura no conoce.
function canActivate(state, id, ctx) {
  const def = ABILITY_BY_ID[id];
  if (!def) return 'Habilidad desconocida';
  if (ctx.gameOver) return 'Partida terminada';
  if (state.energy < def.cost) return 'Energía insuficiente';
  if (ctx.aiming) return 'Termina de apuntar el power-up';
  if (def.durationMs && state.timers[id] > 0) return `${def.name} ya está activa`;
  if (id === 'undo' && !state.snapshot) return 'Nada que deshacer';
  if (id === 'swap' && state.undoneThisPiece) return 'No se puede tras Deshacer';
  return null;
}

// Descuenta la energía y arranca el temporizador si la habilidad es temporal.
function spendAbility(state, id) {
  const def = ABILITY_BY_ID[id];
  state.energy = Math.max(0, state.energy - def.cost);
  if (def.durationMs) state.timers[id] = def.durationMs;
}

function tickAbilities(state, dt) {
  for (const k of Object.keys(state.timers)) state.timers[k] = Math.max(0, state.timers[k] - dt);
}

if (typeof module !== 'undefined') {
  module.exports = { ABILITY_CONFIG, ABILITIES, ABILITY_BY_ID, createAbilityState, addEnergy, canActivate, spendAbility, tickAbilities };
}
