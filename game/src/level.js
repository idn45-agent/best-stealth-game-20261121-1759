// The tile grid: parsing, movement collision, line of sight and small
// helpers the AI and the screenshot autopilot share.
//
// Coordinates come in two flavours: tile coordinates (integers, 0..COLS-1 and
// 0..ROWS-1) and pixel coordinates (the canvas). A tile's centre is
// tileCenter(tx, ty); a pixel position's tile is Math.floor(p / TILE).
import { COLS, ROWS, TILE } from './config.js';

export const TILE_WALL = '#';
export const TILE_CASE = 'C';
export const TILE_BUSH = 'B';
export const TILE_SHADOW = 's';

/** Turn a level definition's rows into a grid plus the placed objects. */
export function parseLevel(def) {
  const grid = def.map.map((row) => row.split(''));
  let start = null;
  let relic = null;
  let exit = null;
  const loot = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = grid[y][x];
      if (cell === 'P') { start = tileCenter(x, y); grid[y][x] = '.'; }
      if (cell === 'R') { relic = { ...tileCenter(x, y), taken: false }; grid[y][x] = '.'; }
      if (cell === 'X') { exit = tileCenter(x, y); grid[y][x] = '.'; }
      if (cell === 'L') { loot.push({ ...tileCenter(x, y), taken: false }); grid[y][x] = '.'; }
    }
  }
  return { grid, start, relic, exit, loot };
}

/** Pixel centre of tile (tx, ty). */
export function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

/** True when (tx, ty) names a tile inside the level. */
export function inBounds(tx, ty) {
  return tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS;
}

/** The tile character under a pixel position; outside the level is a wall. */
export function tileAt(grid, px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (!inBounds(tx, ty)) return TILE_WALL;
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

/** Walkable means a thief or a guard may stand there: floor, bush or shadow. */
export function isWalkable(grid, tx, ty) {
  if (!inBounds(tx, ty)) return false;
  const cell = grid[ty][tx];
  return cell !== TILE_WALL && cell !== TILE_CASE;
}

/**
 * The closest walkable tile to (tx, ty), searching outward in rings.
 * Guards use it to get back on patrol after a search ends off-route.
 */
export function nearestWalkable(grid, tx, ty) {
  if (isWalkable(grid, tx, ty)) return { tx, ty };
  for (let r = 1; r <= 6; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (isWalkable(grid, tx + dx, ty + dy)) return { tx: tx + dx, ty: ty + dy };
      }
    }
  }
  return { tx, ty };
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
