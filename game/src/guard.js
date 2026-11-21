// Guard AI: patrol waypoints, suspicion, alarm chase and noise investigation.
import {
  DETECT_BASE, DETECT_DECAY, DETECT_FAR, GUARD_CHASE_SPEED, GUARD_SPEED,
  GUARD_VIEW_HALF_ANGLE, GUARD_VIEW_RANGE, SUSPICIOUS_AT, TILE,
} from './config.js';
import { hasLineOfSight, isBush, isShadow, moveCircle } from './level.js';

export const GUARD_CALM = 'calm';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_ALARM = 'alarm';
export const GUARD_INVESTIGATE = 'investigate';

export function createGuard(def) {
  const waypoints = def.waypoints.map(([tx, ty]) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }));
  return {
    x: def.x * TILE + TILE / 2,
    y: def.y * TILE + TILE / 2,
    angle: 0,
    waypoints,
    waypointIndex: 1 % waypoints.length,
    pause: 0,
    state: GUARD_CALM,
    meter: 0,
    target: null,
    investigate: null,
    investigateTimer: 0,
    chaseTimer: 0,
    lastSeen: null,
    stepPhase: 0,
    stepAcc: 0,
  };
}

/** Can this guard see the player right now? Returns a detection rate per second, or 0. */
export function guardSeesPlayer(guard, player, grid) {
  if (isBush(grid, player.x, player.y)) return 0;
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > GUARD_VIEW_RANGE) return 0;
  let diff = Math.atan2(dy, dx) - guard.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > GUARD_VIEW_HALF_ANGLE) return 0;
  if (!hasLineOfSight(grid, guard.x, guard.y, player.x, player.y)) return 0;
  let rate = DETECT_FAR + (DETECT_BASE - DETECT_FAR) * (1 - dist / GUARD_VIEW_RANGE);
  if (isShadow(grid, player.x, player.y)) rate *= 0.35;
  if (player.sneaking) rate *= 0.5;
  if (player.running) rate *= 1.6;
  return rate;
}

function angleToward(guard, tx, ty) {
  return Math.atan2(ty - guard.y, tx - guard.x);
}

function turnToward(guard, targetAngle, dt) {
  let diff = targetAngle - guard.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = 5.2 * dt;
  guard.angle += Math.max(-turn, Math.min(turn, diff));
}

function walkToward(guard, grid, tx, ty, speed, dt, world) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  const moved = moveCircle(grid, guard.x, guard.y, (dx / dist) * step, (dy / dist) * step, 11);
  guard.x = moved.x;
  guard.y = moved.y;
  turnToward(guard, Math.atan2(dy, dx), dt);
  guard.stepPhase += (step / 26) * Math.PI;
  // Footsteps: a soft tread only when the guard walks near the thief, so the
  // player can hear a patrol coming without seeing it.
  guard.stepAcc += step;
  if (guard.stepAcc > 46) {
    guard.stepAcc = 0;
    if (world && world.player && Math.hypot(guard.x - world.player.x, guard.y - world.player.y) < 250) {
      world.events.push({ type: 'guard-step', x: guard.x, y: guard.y });
    }
  }
  return dist <= step + 1;
}

export function updateGuard(guard, dt, world) {
  const { grid, player } = world;
  const rate = guardSeesPlayer(guard, player, grid);
  if (rate > 0) {
    guard.meter = Math.min(100, guard.meter + rate * dt);
    guard.lastSeen = { x: player.x, y: player.y };
    if (guard.meter >= 100 && guard.state !== GUARD_ALARM) {
      guard.state = GUARD_ALARM;
      guard.chaseTimer = 4;
      world.events.push({ type: 'alarm', x: guard.x, y: guard.y });
    } else if (guard.meter >= SUSPICIOUS_AT && guard.state === GUARD_CALM) {
      guard.state = GUARD_SUSPICIOUS;
    }
  } else {
    guard.meter = Math.max(0, guard.meter - DETECT_DECAY * dt);
    if (guard.state === GUARD_SUSPICIOUS && guard.meter < SUSPICIOUS_AT - 12) guard.state = GUARD_CALM;
  }

  if (guard.state === GUARD_ALARM) {
    const seen = guard.lastSeen ?? { x: player.x, y: player.y };
    if (rate > 0) guard.chaseTimer = 4;
    else guard.chaseTimer -= dt;
    walkToward(guard, grid, seen.x, seen.y, GUARD_CHASE_SPEED, dt, world);
    if (guard.chaseTimer <= 0) {
      guard.state = GUARD_CALM;
      guard.meter = 40;
      guard.investigate = { x: seen.x, y: seen.y };
      guard.investigateTimer = 3;
    }
    return;
  }

  if (world.noise && guard.state !== GUARD_INVESTIGATE) {
    const d = Math.hypot(world.noise.x - guard.x, world.noise.y - guard.y);
    if (d < world.noise.radius) {
      guard.state = GUARD_INVESTIGATE;
      guard.investigate = { x: world.noise.x, y: world.noise.y };
      guard.investigateTimer = 4;
    }
  }

  if (guard.state === GUARD_INVESTIGATE && guard.investigate) {
    if (walkToward(guard, grid, guard.investigate.x, guard.investigate.y, GUARD_SPEED * 1.35, dt, world)) {
      guard.investigateTimer -= dt;
      turnToward(guard, guard.angle + 1.4 * dt, dt);
      if (guard.investigateTimer <= 0) {
        guard.state = GUARD_CALM;
        guard.investigate = null;
      }
    }
    return;
  }

  if (guard.state === GUARD_SUSPICIOUS) {
    if (guard.lastSeen) turnToward(guard, angleToward(guard, guard.lastSeen.x, guard.lastSeen.y), dt);
    return;
  }

  // Patrol: walk to the next waypoint, pause and look around.
  const target = guard.waypoints[guard.waypointIndex];
  if (guard.pause > 0) {
    guard.pause -= dt;
    turnToward(guard, guard.angle + 0.9 * dt, dt);
    return;
  }
  if (walkToward(guard, grid, target.x, target.y, GUARD_SPEED, dt, world)) {
    guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
    guard.pause = 1.1;
  }
}
