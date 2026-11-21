// Game state: levels, win/lose, detection, loot and the fixed-step update.
import { LEVELS, LIVES } from './config.js';
import { createGuard } from './guard.js';
import { parseLevel } from './level.js';
import { createPlayer, updatePebbles, updatePlayer } from './player.js';
import { updateGuard } from './guard.js';

export const STEP = 1 / 60;
export const EVENT_CAUGHT = 1;
export const EVENT_LEVEL_CLEAR = 2;
export const EVENT_WIN = 4;
export const EVENT_GAME_OVER = 8;

export function createWorld(random) {
  const world = {
    random,
    levelIndex: 0,
    lives: LIVES,
    loot: 0,
    time: 0,
    noise: null,
    pebbles: [],
    events: [],
    guards: [],
    player: null,
    grid: null,
    relic: null,
    exit: null,
    levelLoot: [],
    caughtFlash: 0,
    loadLevel(index) {
      const def = LEVELS[index];
      const parsed = parseLevel(def);
      this.grid = parsed.grid;
      this.relic = parsed.relic;
      this.exit = parsed.exit;
      this.levelLoot = parsed.loot;
      this.player = createPlayer(parsed.start);
      this.guards = def.guards.map(createGuard);
      this.pebbles = [];
      this.noise = null;
      this.caughtFlash = 0;
    },
    reset() {
      this.levelIndex = 0;
      this.lives = LIVES;
      this.loot = 0;
      this.time = 0;
      this.loadLevel(0);
    },
  };
  world.reset();
  return world;
}

function nearestGuardDistance(world) {
  let best = Infinity;
  for (const guard of world.guards) {
    best = Math.min(best, Math.hypot(guard.x - world.player.x, guard.y - world.player.y));
  }
  return best;
}

export function stepWorld(world, input, dt) {
  let result = 0;
  world.time += dt;
  world.events.length = 0;
  updatePlayer(world.player, input, world.grid, dt, world);
  updatePebbles(world, dt);
  for (const guard of world.guards) updateGuard(guard, dt, world);
  if (world.noise) {
    world.noise.ttl -= dt;
    if (world.noise.ttl <= 0) world.noise = null;
  }

  // Loot pickup.
  for (const coin of world.levelLoot) {
    if (!coin.taken && Math.hypot(coin.x - world.player.x, coin.y - world.player.y) < 22) {
      coin.taken = true;
      world.loot += 1;
      world.events.push({ type: 'coin', x: coin.x, y: coin.y });
    }
  }
  // Relic pickup.
  if (!world.relic.taken && Math.hypot(world.relic.x - world.player.x, world.relic.y - world.player.y) < 24) {
    world.relic.taken = true;
    world.loot += 5;
    world.events.push({ type: 'relic', x: world.relic.x, y: world.relic.y });
  }
  // Exit, only once the relic is taken.
  if (world.relic.taken && Math.hypot(world.exit.x - world.player.x, world.exit.y - world.player.y) < 24) {
    world.events.push({ type: 'exit', x: world.exit.x, y: world.exit.y });
    if (world.levelIndex + 1 >= LEVELS.length) return EVENT_WIN;
    world.levelIndex += 1;
    world.loadLevel(world.levelIndex);
    return EVENT_LEVEL_CLEAR;
  }
  // Caught: an alarmed guard reaches the thief.
  for (const guard of world.guards) {
    if (guard.state === 'alarm' && Math.hypot(guard.x - world.player.x, guard.y - world.player.y) < 20) {
      world.lives -= 1;
      world.caughtFlash = 1;
      world.events.push({ type: 'caught', x: world.player.x, y: world.player.y });
      if (world.lives <= 0) return EVENT_GAME_OVER;
      world.loadLevel(world.levelIndex);
      return EVENT_CAUGHT;
    }
  }
  world.caughtFlash = Math.max(0, world.caughtFlash - dt * 2);
  world.danger = nearestGuardDistance(world);
  return result;
}
