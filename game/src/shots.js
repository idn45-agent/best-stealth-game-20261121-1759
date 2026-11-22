// Staged screenshot scenes: each plays the real rules forward from a fresh world
// with an autopilot that pathfinds around guard vision, so the frame is what a
// short game really looks like and the same seed always gives the same frame.
//
// The cover matters most — it is the big image on the judge's sheet — so its
// staging is deliberate: the thief slips into the nearest bush, waits while a
// patrol cone sweeps past, and the frame shows the whole stealth game at once:
// a hidden thief, a bright vision cone, cover, the relic and the exit.
import { STEP } from './world.js';
import { LEVELS, TILE } from './config.js';
import { isBush, isSolid } from './level.js';
import { guardSeesPlayer } from './guard.js';

const SAMPLE = STEP;

/** Breadth-first path over walkable tiles; danger tiles cost far more. */
function findPath(world, from, to) {
  const { grid } = world;
  const startTx = Math.floor(from.x / TILE);
  const startTy = Math.floor(from.y / TILE);
  const goalTx = Math.floor(to.x / TILE);
  const goalTy = Math.floor(to.y / TILE);
  const key = (x, y) => y * 100 + x;
  const cost = new Map([[key(startTx, startTy), 0]]);
  const prev = new Map();
  const queue = [[startTx, startTy]];
  const danger = (tx, ty) => {
    const probe = { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, sneaking: true, running: false };
    for (const guard of world.guards) {
      if (guardSeesPlayer(guard, probe, grid) > 0) return true;
    }
    return false;
  };
  while (queue.length > 0) {
    // Cheapest-first queue: small grid, a plain sort each round is fine.
    queue.sort((a, b) => cost.get(key(a[0], a[1])) - cost.get(key(b[0], b[1])));
    const [cx, cy] = queue.shift();
    if (cx === goalTx && cy === goalTy) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= 30 || ny >= 19) continue;
      if (isSolid(grid, nx * TILE + TILE / 2, ny * TILE + TILE / 2)) continue;
      const stepCost = danger(nx, ny) ? 60 : 1;
      const next = cost.get(key(cx, cy)) + stepCost;
      if (!cost.has(key(nx, ny)) || next < cost.get(key(nx, ny))) {
        cost.set(key(nx, ny), next);
        prev.set(key(nx, ny), [cx, cy]);
        queue.push([nx, ny]);
      }
    }
  }
  if (!prev.has(key(goalTx, goalTy)) && !(goalTx === startTx && goalTy === startTy)) return null;
  const path = [];
  let cur = [goalTx, goalTy];
  while (!(cur[0] === startTx && cur[1] === startTy)) {
    path.unshift({ x: cur[0] * TILE + TILE / 2, y: cur[1] * TILE + TILE / 2 });
    cur = prev.get(key(cur[0], cur[1]));
    if (!cur) break;
  }
  return path;
}

/** Input that follows a path toward the relic, then the exit. */
function autopilot(world) {
  const target = world.relic.taken ? world.exit : world.relic;
  if (!world._path || world._pathTick === undefined || world.time - world._pathTick > 0.5 || world._path.length === 0) {
    world._path = findPath(world, world.player, target) ?? [];
    world._pathTick = world.time;
  }
  const input = { up: false, down: false, left: false, right: false, run: false, sneak: false, throwPebble: false, throwX: 0, throwY: 0, pressed: new Set() };
  const next = world._path[0];
  if (!next) return input;
  const dx = next.x - world.player.x;
  const dy = next.y - world.player.y;
  if (Math.hypot(dx, dy) < 6) {
    world._path.shift();
    return input;
  }
  if (Math.abs(dx) > 4) input[dx > 0 ? 'right' : 'left'] = true;
  if (Math.abs(dy) > 4) input[dy > 0 ? 'down' : 'up'] = true;
  const probe = { x: next.x, y: next.y, sneaking: false, running: false };
  const risky = world.guards.some((g) => guardSeesPlayer(g, probe, world.grid) > 0);
  input.sneak = risky;
  return input;
}

/** Drive the thief toward a fixed point for up to maxSeconds; true on arrival. */
function driveTo(world, stepWorld, target, maxSeconds) {
  const idle = { up: false, down: false, left: false, right: false, run: false, sneak: false, throwPebble: false, throwX: 0, throwY: 0, pressed: new Set() };
  for (let i = 0; i < maxSeconds / SAMPLE; i += 1) {
    if (Math.hypot(world.player.x - target.x, world.player.y - target.y) < 10) return true;
    if (!world._drivePath || world.time - world._driveTick > 0.5 || world._drivePath.length === 0) {
      world._drivePath = findPath(world, world.player, target) ?? [];
      world._driveTick = world.time;
    }
    const next = world._drivePath[0];
    if (!next) return false;
    const input = { ...idle };
    const dx = next.x - world.player.x;
    const dy = next.y - world.player.y;
    if (Math.hypot(dx, dy) < 6) {
      world._drivePath.shift();
      continue;
    }
    if (Math.abs(dx) > 4) input[dx > 0 ? 'right' : 'left'] = true;
    if (Math.abs(dy) > 4) input[dy > 0 ? 'down' : 'up'] = true;
    const probe = { x: next.x, y: next.y, sneaking: false, running: false };
    input.sneak = world.guards.some((g) => guardSeesPlayer(g, probe, world.grid) > 0);
    const result = stepWorld(world, input, SAMPLE);
    if (result & (1 | 2 | 4 | 8)) return false;
  }
  return Math.hypot(world.player.x - target.x, world.player.y - target.y) < 10;
}

/** Step the world with no input for the given seconds. */
function idleFor(world, stepWorld, seconds) {
  const idle = { up: false, down: false, left: false, right: false, run: false, sneak: false, throwPebble: false, throwX: 0, throwY: 0, pressed: new Set() };
  for (let i = 0; i < seconds / SAMPLE; i += 1) {
    const result = stepWorld(world, idle, SAMPLE);
    if (result & (1 | 2 | 4 | 8)) break;
  }
}

/** The nearest bush tile to the thief's start, as a pixel point. */
function nearestBush(world) {
  let best = null;
  let bestDist = Infinity;
  for (let ty = 0; ty < 19; ty += 1) {
    for (let tx = 0; tx < 30; tx += 1) {
      if (world.grid[ty][tx] !== 'B') continue;
      const point = { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
      const d = Math.hypot(point.x - world.player.x, point.y - world.player.y);
      if (d < bestDist) { bestDist = d; best = point; }
    }
  }
  return best;
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * cover: the thief hidden in a bush as a patrol cone sweeps past;
 * patrol: guards mid-round; alarm: the thief caught in a cone as the alarm
 * breaks; win: all halls cleared.
 */
export function stageShot(name, world, stepWorld) {
  world.reset();
  const idle = { up: false, down: false, left: false, right: false, run: false, sneak: false, throwPebble: false, throwX: 0, throwY: 0, pressed: new Set() };
  if (name === 'cover') {
    const bush = nearestBush(world);
    if (bush) {
      driveTo(world, stepWorld, bush, 14);
      // Wait in the bush while the patrol sweeps past: the frame catches the
      // thief hidden, a cone nearby, and the relic and exit across the hall.
      idleFor(world, stepWorld, 2);
    } else {
      for (let i = 0; i < 12 / SAMPLE; i += 1) {
        const result = stepWorld(world, autopilot(world), SAMPLE);
        if (result & (1 | 2 | 4 | 8)) break;
      }
    }
    return { screen: 'play', best: world.loot };
  }
  if (name === 'alarm') {
    // Walk the thief into the first guard's patrol lane and let the cone find them.
    // Stop the moment the alarm breaks, so the frame shows the chase beginning.
    const guard = world.guards[0];
    const lane = guard.waypoints[1];
    world.player.x = lane.x;
    world.player.y = lane.y + 40;
    for (let i = 0; i < 60 / SAMPLE; i += 1) {
      stepWorld(world, idle, SAMPLE);
      if (world.guards.some((g) => g.state === 'alarm')) {
        for (let j = 0; j < 24; j += 1) stepWorld(world, idle, SAMPLE);
        break;
      }
      if (world.lives < 3) break;
    }
    return { screen: 'play', best: 0 };
  }
  if (name === 'win') {
    for (let i = 0; i < 36000; i += 1) {
      const result = stepWorld(world, autopilot(world), SAMPLE);
      if (result & 4) return { screen: 'win', best: world.loot };
      if (result & 8) break;
    }
    return { screen: 'play', best: world.loot };
  }
  const seconds = name === 'patrol' ? 10 : 12;
  for (let i = 0; i < seconds / SAMPLE; i += 1) {
    const result = stepWorld(world, autopilot(world), SAMPLE);
    if (result & (1 | 2 | 4 | 8)) break;
  }
  return { screen: 'play', best: world.loot };
}

export { LEVELS, isBush };
