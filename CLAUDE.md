# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JavaScript Tetris using HTML5 Canvas. No dependencies, no `package.json`, no build step, no test suite, no linter. The README is in Spanish.

## Running

Open `index.html` directly, or serve statically (e.g. `python3 -m http.server 8000`) and visit `http://localhost:8000`.

## Architecture

Three files: `index.html` (DOM + two canvases: `#board` 300×600 and the next-piece preview), `style.css` (dark/retro theme), and `game.js` (all logic, ~300 lines).

Key points in `game.js`:
- Board is a `ROWS × COLS` matrix; cells hold `0` (empty) or a color index 1–7 identifying the piece.
- Pieces are square matrices; rotation is transpose + row reverse (`rotateCW`), with wall kicks of ±1/±2 columns in `tryRotate`.
- The loop (`loop`) uses `requestAnimationFrame`, accumulating elapsed time against `dropInterval`. Fall speed is `max(100, 1000 − (level − 1) × 90)` ms; level rises every 10 lines.
- Scoring: `LINE_SCORES` `[0,100,300,500,800]` × level; hard drop +2/cell, soft drop +1/row.
- `spawn()` moves `next` to `current`; if the new piece collides immediately, `endGame()` fires.

## Gotchas

- `COLS`, `ROWS`, `BLOCK` in `game.js` must stay consistent with the `width`/`height` attributes of `<canvas id="board">` in `index.html` (`COLS × BLOCK` by `ROWS × BLOCK`).
