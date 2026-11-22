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
import { isBush, isShadow, isSolid } from './level.js';
import { guardSeesPlayer } from './guard.js';

const SAMPLE = STEP;

/** Breadth-first path over walkable tiles; danger tiles cost far more.
 * Shadow and bush tiles are cheap — the autopilot prefers cover — and a
 * loot coin on a safe tile is worth a small detour, so the run reads as a
 * heist, not a sprint to the relic. */
function findPath(world, from, to) {
  const { grid } = world;
  const startTx = Math.floor(from.x / TILE);
  const startTy = Math.floor(from.y / TILE);
  const goalTx = Math.floor(to.x / TILE);
  const goalTy = Math.floor(to.y / TILE);
  const key = (x, y) => y * 100 + x;
  const lootTiles = new Set(
    world.levelLoot.filter((coin) => !coin.taken).map((coin) => key(Math.floor(coin.x / TILE), Math.floor(coin.y / TILE))),
  );
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
      let stepCost = 1;
      if (danger(nx, ny)) stepCost = 60;
      else {
        if (isShadow(grid, nx * TILE + TILE / 2, ny * TILE + TILE / 2) || isBush(grid, nx * TILE + TILE / 2, ny * TILE + TILE / 2)) stepCost = 0.6;
        if (lootTiles.has(key(nx, ny))) stepCost = 0.3;
      }
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

/** Input that follows a path toward the relic, then the exit.
 * Patience is part of the route: when the next step is inside a guard's
 * cone right now, the thief waits for the patrol to pass instead of
 * walking into it, and gives up waiting after a couple of seconds. */
function autopilot(world) {
  const target = world.relic.taken ? world.exit : world.relic;
  if (!world._path || world._pathTick === undefined || world.time - world._pathTick > 0.5 || world._path.length === 0) {
    world._path = findPath(world, world.player, target) ?? [];
    world._pathTick = world.time;
  }
  const input = { up: false, down: false, left: false, right: false, run: false, sneak: false, throwPebble: false, throwX: 0, throwY: 0, pressed: new Set() };
  const next = world._path[0];
  if (!next) return input;
  const probe = { x: next.x, y: next.y, sneaking: false, running: false };
  const risky = world.guards.some((g) => guardSeesPlayer(g, probe, world.grid) > 0);
  if (risky) {
    if (world._waitSince === undefined) world._waitSince = world.time;
    if (world.time - world._waitSince < 2.5) {
      input.sneak = true;
      return input;
    }
  } else {
    world._waitSince = undefined;
  }
  const dx = next.x - world.player.x;
  const dy = next.y - world.player.y;
  if (Math.hypot(dx, dy) < 6) {
    world._path.shift();
    return input;
  }
  if (Math.abs(dx) > 4) input[dx > 0 ? 'right' : 'left'] = true;
  if (Math.abs(dy) > 4) input[dy > 0 ? 'down' : 'up'] = true;
  // Sneak only when it matters — the next step is risky, or a cone is on
  // the thief right now. Walking at full speed everywhere else keeps the
  // run moving; sneaking near every guard halved the pace for nothing.
  const me = { x: world.player.x, y: world.player.y, sneaking: false, running: false };
  input.sneak = risky || world.guards.some((g) => guardSeesPlayer(g, me, world.grid) > 0);
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
    // Same patience as the autopilot: wait out a cone on the next step.
    const probe = { x: next.x, y: next.y, sneaking: false, running: false };
    const risky = world.guards.some((g) => guardSeesPlayer(g, probe, world.grid) > 0);
    if (risky) {
      if (world._driveWaitSince === undefined) world._driveWaitSince = world.time;
      if (world.time - world._driveWaitSince < 3) {
        const result = stepWorld(world, { ...idle, sneak: true }, SAMPLE);
        if (result & (1 | 2 | 4 | 8)) return false;
        continue;
      }
    } else {
      world._driveWaitSince = undefined;
    }
    const input = { ...idle };
    const dx = next.x - world.player.x;
    const dy = next.y - world.player.y;
    if (Math.hypot(dx, dy) < 6) {
      world._drivePath.shift();
      continue;
    }
    if (Math.abs(dx) > 4) input[dx > 0 ? 'right' : 'left'] = true;
    if (Math.abs(dy) > 4) input[dy > 0 ? 'down' : 'up'] = true;
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

/** The bush closest to any guard's patrol route: hiding there, a cone
 * sweeps past the thief instead of the frame showing an empty corner. */
function bushNearPatrol(world) {
  let best = null;
  let bestDist = Infinity;
  for (let ty = 0; ty < 19; ty += 1) {
    for (let tx = 0; tx < 30; tx += 1) {
      if (world.grid[ty][tx] !== 'B') continue;
      const point = { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
      for (const guard of world.guards) {
        for (const wp of guard.waypoints) {
          const d = Math.hypot(point.x - wp.x, point.y - wp.y);
          if (d < bestDist) { bestDist = d; best = point; }
        }
      }
    }
  }
  return best;
}

/** Wait in place until a guard's cone sweeps close to the thief, or the
 * time runs out: the cover frame catches the patrol passing the hidden
 * thief, not a quiet moment between rounds. The frame is only taken while
 * no guard stands on the relic, so its label stays readable. */
function waitForConeNear(world, stepWorld, maxSeconds) {
  const idle = { up: false, down: false, left: false, right: false, run: false, sneak: false, throwPebble: false, throwX: 0, throwY: 0, pressed: new Set() };
  for (let i = 0; i < maxSeconds / SAMPLE; i += 1) {
    const relicClear = world.guards.every((g) => Math.hypot(g.x - world.relic.x, g.y - world.relic.y) > 70);
    const near = world.guards.some((guard) => {
      const d = Math.hypot(guard.x - world.player.x, guard.y - world.player.y);
      if (d > 240) return false;
      let diff = Math.atan2(world.player.y - guard.y, world.player.x - guard.x) - guard.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      return Math.abs(diff) < 1.0;
    });
    if (near && relicClear) return;
    const result = stepWorld(world, idle, SAMPLE);
    if (result & (1 | 2 | 4 | 8)) return;
  }
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
    const bush = bushNearPatrol(world);
    if (bush) {
      driveTo(world, stepWorld, bush, 14);
      // Wait in the bush until a patrol cone sweeps past: the frame catches
      // the thief hidden, a cone nearby, and the relic and exit across the hall.
      waitForConeNear(world, stepWorld, 6);
    } else {
      for (let i = 0; i < 12 / SAMPLE; i += 1) {
        const result = stepWorld(world, autopilot(world), SAMPLE);
        if (result & (1 | 2 | 4 | 8)) break;
      }
    }
    return { screen: 'play', best: world.loot };
  }
  if (name === 'alarm') {
    // Stand the thief just below the first guard's patrol lane and let the
    // cone find them. Freeze the instant the alarm breaks — the frame then
    // shows the chase beginning (red cone, "!", SPOTTED banner) instead of
    // the catch itself, which used to reset the level before the shot.
    const guard = world.guards[0];
    const lane = guard.waypoints[1];
    for (const below of [40, 90]) {
      world.reset();
      world.player.x = lane.x;
      world.player.y = lane.y + below;
      let alarmed = false;
      for (let i = 0; i < 60 / SAMPLE; i += 1) {
        stepWorld(world, idle, SAMPLE);
        if (world.guards.some((g) => g.state === 'alarm')) { alarmed = true; break; }
        if (world.lives < 3) break;
      }
      if (alarmed && world.lives === 3) return { screen: 'play', best: 0 };
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
