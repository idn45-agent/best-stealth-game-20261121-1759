// The tile grid: parsing, movement collision and line of sight.
import { COLS, ROWS, TILE } from './config.js';

export const TILE_WALL = '#';
export const TILE_CASE = 'C';
export const TILE_BUSH = 'B';
export const TILE_SHADOW = 's';

export function parseLevel(def) {
  const grid = def.map.map((row) => row.split(''));
  let start = null;
  let relic = null;
  let exit = null;
  const loot = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = grid[y][x];
      if (cell === 'P') { start = { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 }; grid[y][x] = '.'; }
      if (cell === 'R') { relic = { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, taken: false }; grid[y][x] = '.'; }
      if (cell === 'X') { exit = { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 }; grid[y][x] = '.'; }
      if (cell === 'L') { loot.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, taken: false }); grid[y][x] = '.'; }
    }
  }
  return { grid, start, relic, exit, loot };
}

export function tileAt(grid, px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return TILE_WALL;
  return grid[ty][tx];
}

export function isSolid(grid, px, py) {
  const cell = tileAt(grid, px, py);
  return cell === TILE_WALL || cell === TILE_CASE;
}

export function isBush(grid, px, py) {
  return tileAt(grid, px, py) === TILE_BUSH;
}

export function isShadow(grid, px, py) {
  return tileAt(grid, px, py) === TILE_SHADOW;
}

/** True when no wall or case stands between the two points. */
export function hasLineOfSight(grid, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 7));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (isSolid(grid, x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

/** Move a circle against solid tiles, sliding along walls. Returns the new position. */
export function moveCircle(grid, x, y, dx, dy, radius) {
  let nx = x;
  let ny = y;
  const nxCandidate = x + dx;
  if (!isSolid(grid, nxCandidate + Math.sign(dx) * radius, y - radius * 0.7)
    && !isSolid(grid, nxCandidate + Math.sign(dx) * radius, y + radius * 0.7)
    && !isSolid(grid, nxCandidate + Math.sign(dx) * radius, y)) nx = nxCandidate;
  const nyCandidate = y + dy;
  if (!isSolid(grid, nx - radius * 0.7, nyCandidate + Math.sign(dy) * radius)
    && !isSolid(grid, nx + radius * 0.7, nyCandidate + Math.sign(dy) * radius)
    && !isSolid(grid, nx, nyCandidate + Math.sign(dy) * radius)) ny = nyCandidate;
  return { x: nx, y: ny };
}
