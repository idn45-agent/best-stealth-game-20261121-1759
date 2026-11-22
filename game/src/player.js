// The thief: movement, sneaking, running, noise and pebble throws.
//
// Speeds are a trade-off the player feels every step: sneak is slow and
// nearly invisible, walk is the default, run is fast and loud enough for
// every guard nearby to hear. A thrown pebble lands with a ring of noise
// that pulls guards away from their patrol — the thief's only tool besides
// patience. Pebbles are limited, and a throw has a short cooldown so the
// player aims each one instead of spamming.
import {
  NOISE_PEBBLE_RADIUS, NOISE_RUN_RADIUS, PEBBLE_COOLDOWN, PEBBLE_COUNT,
  PLAYER_RUN_SPEED, PLAYER_SNEAK_SPEED, PLAYER_SPEED,
} from './config.js';
import { isBush, moveCircle } from './level.js';

export function createPlayer(start) {
  return {
    x: start.x,
    y: start.y,
    angle: 0,
    sneaking: false,
    running: false,
    moving: false,
    hidden: false,
    pebbles: PEBBLE_COUNT,
    throwCooldown: 0,
    aimX: start.x,
    aimY: start.y,
    stepPhase: 0,
    stepAcc: 0,
  };
}

export function updatePlayer(player, input, grid, dt, world) {
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  player.moving = len > 0;
  player.sneaking = Boolean(input.sneak) && !input.run;
  player.running = Boolean(input.run) && len > 0;
  player.hidden = isBush(grid, player.x, player.y);
  player.throwCooldown = Math.max(0, player.throwCooldown - dt);
  // The mouse aims the next pebble; the renderer draws the dotted arc.
  if (input.aimX !== undefined) {
    player.aimX = input.aimX;
    player.aimY = input.aimY;
  }
  if (len > 0) {
    mx /= len;
    my /= len;
    const speed = player.running ? PLAYER_RUN_SPEED : player.sneaking ? PLAYER_SNEAK_SPEED : PLAYER_SPEED;
    const moved = moveCircle(grid, player.x, player.y, mx * speed * dt, my * speed * dt, 11);
    player.x = moved.x;
    player.y = moved.y;
    player.angle = Math.atan2(my, mx);
    player.stepPhase += (speed * dt / 24) * Math.PI;
    player.stepAcc += speed * dt;
    if (player.stepAcc > 46) {
      player.stepAcc = 0;
      world.events.push({ type: 'step', x: player.x, y: player.y, loud: player.running });
    }
    // Running is loud: a short-lived ring of noise follows the thief.
    if (player.running) world.noise = { x: player.x, y: player.y, radius: NOISE_RUN_RADIUS, ttl: 0.12 };
  }
  if (input.throwPebble && player.pebbles > 0 && player.throwCooldown <= 0) {
    player.pebbles -= 1;
    player.throwCooldown = PEBBLE_COOLDOWN;
    world.pebbles.push({ x: player.x, y: player.y, tx: input.throwX, ty: input.throwY, t: 0 });
    world.events.push({ type: 'throw', x: player.x, y: player.y });
    input.throwPebble = false;
  } else if (input.throwPebble) {
    // Out of pebbles, or still on cooldown: swallow the click, never queue it.
    input.throwPebble = false;
  }
}

/** Fly the pebbles in the air; a landed pebble rings out and draws guards. */
export function updatePebbles(world, dt) {
  for (const pebble of world.pebbles) {
    pebble.t += dt * 2.4;
    if (pebble.t >= 1) {
      pebble.landed = true;
      world.noise = { x: pebble.tx, y: pebble.ty, radius: NOISE_PEBBLE_RADIUS, ttl: 0.5 };
      world.events.push({ type: 'pebble-land', x: pebble.tx, y: pebble.ty });
    }
  }
  world.pebbles = world.pebbles.filter((p) => !p.landed);
}
