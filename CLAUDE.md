# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JavaScript Tetris using HTML5 Canvas. No dependencies, no `package.json`, no build step, no test suite, no linter. The README is in Spanish.

## Running

Open `index.html` directly, or serve statically (e.g. `python3 -m http.server 8000`) and visit `http://localhost:8000`.

## Architecture

Files: `challenges.js` (Modo Desafío: catálogo + `ChallengeStats`), `powerups.js` (pure power-up catalog/logic), `abilities.js` (pure charge-ability catalog/rules), `scoring.js` (pure scoring), `records.js` (local high scores), `audio.js` (sound), all loaded before `game.js`; `index.html` (DOM + two canvases: `#board` 300×600 and the next-piece preview), `style.css` (dark/retro theme), and `game.js` (all logic, ~300 lines).

Key points in `game.js`:
- Board is a `ROWS × COLS` matrix; cells hold `0` (empty), a color index 1–7 (standard pieces), `8` (wildcard) or 9–13 (special pieces: +, U, Y, 1×1, hollow 3×3). `PIECES`/`COLORS` are indexed by that value; `MAX_CELL` in `powerups.js` must match. Special-piece odds live in `SPECIAL_CONFIG`; a Tetris swaps `next` for the 1×1.
- Pieces are square matrices; rotation is transpose + row reverse (`rotateCW`), with wall kicks of ±1/±2 columns in `tryRotate`.
- The loop (`loop`) uses `requestAnimationFrame`, accumulating elapsed time against `dropInterval`. Fall speed is `max(100, 1000 − (level − 1) × 90)` ms; level rises every 10 lines.
- Scoring lives entirely in `scoring.js` (`SCORING_CONFIG`, `scoreLock`, `detectTSpin`, `scoreDrop`): line/T-Spin tables × level, combo multiplies the move total, Back-to-Back ×1.5, Perfect Clear bonus. `lockPiece()` calls `detectTSpin` before `merge()`, then `scoreLock`, then `onScoreEvent` (HUD/effects/sound). `lastWasRotation` must be reset by every successful translation. Power-up line clears use `scoreClearOnly` (no combo/B2B).
- Sound: `audio.js` synthesizes `SOUNDS` with WebAudio; the context is created on the first user gesture; volume/mute persist in `localStorage('sound')`.
- `spawn()` moves `next` to `current`; if the new piece collides immediately, `endGame()` fires.

## Power-ups

Catalog `POWERUPS` + `POWERUP_CONFIG` (trigger every N lines, chance, weights) live in `powerups.js`. To add one, add an entry `{id, name, icon, color, weight, target, apply(board, target) → {board, cells, durationMs?}}`; optionally add a visual in `EFFECT_SPAWNERS` (`game.js`, keyed by id). Board changes go through `applySafely` (clone + validation). Index `8` (`WILD`) is the rainbow wildcard cell. Freeze counts down with loop `dt`, so pause respects it. `grantPowerUp('bomb')` works from the console for testing.

## Habilidades cargables

`abilities.js` has `ABILITY_CONFIG`, the `ABILITIES` catalog (`{id, name, icon, color, cost, key, durationMs?, desc}`) and pure rules (`addEnergy`, `canActivate` = all anti-conflict checks, `spendAbility`, `tickAbilities`). `game.js` (section "Habilidades cargables") holds the glue: `ABILITY_EFFECTS[id]()` (return `false` to cancel without spending), energy bar, menu (`Q`, pauses the game), timer chips, Hold is a base mechanic (`doHold`, keys in `HOLD_KEYS`: C/Shift; one use per piece via `abil.holdUsed`, reset in `lockPiece`; panel HOLD dims while locked). Energy comes from `clearLines` → `gainEnergy`. `queue` holds the 5 pieces after `next`; `spawn()` shifts from it. `lockPiece` stores `abil.snapshot` for Undo. Classic mode only (`classic-only` panels, `ch` guards). Test from console: `abil.energy = 100`.

## Modo Desafío

Catálogo `CHALLENGES` en `challenges.js`. Para añadir un desafío basta una entrada `{id, name, icon, desc, levels[], setup, onTick, onLock, status, progress, result, rotateDir?, hideLocked?, badge?}` (hooks documentados al inicio del archivo); `game.js` no cambia. `game.js` solo tiene el pegamento (`startChallenge`, `checkChallenge`, `finishChallenge`, `chApi`, menú). En modo desafío los power-ups están desactivados y las estadísticas van aparte en `localStorage('challengeStats')`. Color `14` (`GARBAGE`) = basura/bloques fijos; `MAX_CELL` lo incluye.

## Records locales

`records.js` has the pure logic (`addEntry`, `rankFor`, `updateBests`, `sanitizeRecords`) and `createRecordStore` (`localStorage('records')`, tolerates corrupt JSON and unavailable storage); it exports via `module.exports` for Node. `game.js` (section "Records locales") holds the DOM glue. Classic mode only; only finished games (game over) are recorded, bests included. `showStartScreen()` is the boot state and the target of the Clásico tab: `onStart` is true, `current`/`next` are `null` (so `draw`/`drawNext` must tolerate it) and game input is ignored until «Jugar» calls `init()`. `endGame()` is the single recording point and runs once per game, so score/lines must be final before calling it. A qualifying score stays in `pendingRecord` until `commitPendingRecord()` (Guardar, any new game, start screen, challenge menu, `pagehide`). The keydown handler ignores events from text inputs.

## Gotchas

- `COLS`, `ROWS`, `BLOCK` in `game.js` must stay consistent with the `width`/`height` attributes of `<canvas id="board">` in `index.html` (`COLS × BLOCK` by `ROWS × BLOCK`).
