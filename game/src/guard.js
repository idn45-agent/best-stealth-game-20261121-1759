// Guard AI: patrol waypoints, suspicion, alarm chase, noise investigation
// and the search that follows a near miss.
//
// A guard's day, in order:
//   calm        — walk the waypoint loop, pausing to look around.
//   suspicious  — glimpsed the thief: walk to where they were last seen,
//                 look around, then go back to patrol. This is the near
//                 miss: the alarm rises, the run does not end.
//   alarm       — meter hit 100: chase the last seen spot, calling nearby
//                 watchmen over. Lose the thief for a few seconds and the
//                 guard drops to investigate, then patrols again.
//   investigate — heard a pebble or a run: walk to the noise and look.
//
// The meter (0–100) is the guard's memory of the thief. It fills while the
// thief is inside the vision cone and drains fast once they break away, so
// slipping out of sight is always a real recovery.
import {
  DETECT_BASE, DETECT_DECAY, DETECT_FAR, FOOTSTEP_SPACING, FOOTSTEP_TTL,
  GUARD_ALERT_RADIUS, GUARD_CHASE_MEMORY, GUARD_CHASE_SPEED, GUARD_SEARCH_TIME,
  GUARD_SPEED, GUARD_VIEW_HALF_ANGLE, GUARD_VIEW_RANGE, SUSPICIOUS_AT, TILE,
} from './config.js';
import { hasLineOfSight, isBush, isShadow, moveCircle, nearestWalkable, tileCenter } from './level.js';

export const GUARD_CALM = 'calm';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_ALARM = 'alarm';
export const GUARD_INVESTIGATE = 'investigate';

export function createGuard(def) {
  const waypoints = def.waypoints.map(([tx, ty]) => tileCenter(tx, ty));
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
    warned: false,
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
  // Footsteps: a soft tread the thief can hear — and, through the fading
  // rings the renderer draws, see — so a patrol is never a surprise.
  guard.stepAcc += step;
  if (guard.stepAcc > FOOTSTEP_SPACING) {
    guard.stepAcc = 0;
    if (world && world.player && Math.hypot(guard.x - world.player.x, guard.y - world.player.y) < 250) {
      world.events.push({ type: 'guard-step', x: guard.x, y: guard.y });
      if (world.footsteps) world.footsteps.push({ x: guard.x, y: guard.y, ttl: FOOTSTEP_TTL });
    }
  }
  return dist <= step + 1;
}

/** Point this guard at the nearest waypoint and resume the loop from there. */
function resumePatrol(guard) {
  let best = 0;
  let bestDist = Infinity;
  guard.waypoints.forEach((point, index) => {
    const d = Math.hypot(point.x - guard.x, point.y - guard.y);
    if (d < bestDist) { bestDist = d; best = index; }
  });
  guard.waypointIndex = best;
  guard.state = GUARD_CALM;
  guard.meter = 0;
  guard.investigate = null;
  guard.lastSeen = null;
  guard.warned = false;
  guard.pause = 0.6;
}

/** A guard that just raised the alarm calls every calm watchman nearby over. */
function callForHelp(guard, world) {
  for (const other of world.guards) {
    if (other === guard || other.state !== GUARD_CALM) continue;
    if (Math.hypot(other.x - guard.x, other.y - guard.y) > GUARD_ALERT_RADIUS) continue;
    other.state = GUARD_SUSPICIOUS;
    other.meter = Math.max(other.meter, SUSPICIOUS_AT);
    other.lastSeen = guard.lastSeen ? { ...guard.lastSeen } : { x: guard.x, y: guard.y };
    other.investigateTimer = GUARD_SEARCH_TIME;
  }
}

export function updateGuard(guard, dt, world) {
  const { grid, player } = world;
  const rate = guardSeesPlayer(guard, player, grid);
  if (rate > 0) {
    guard.meter = Math.min(100, guard.meter + rate * dt);
    guard.lastSeen = { x: player.x, y: player.y };
    // First glimpse past the suspicious line: a near miss the player can feel.
    if (!guard.warned && guard.meter >= SUSPICIOUS_AT && guard.state === GUARD_CALM) {
      guard.warned = true;
      world.stats.nearMiss += 1;
      world.events.push({ type: 'near-miss', x: player.x, y: player.y });
    }
    if (guard.meter >= 100 && guard.state !== GUARD_ALARM) {
      guard.state = GUARD_ALARM;
      guard.chaseTimer = GUARD_CHASE_MEMORY;
      world.stats.alarms += 1;
      world.events.push({ type: 'alarm', x: guard.x, y: guard.y });
      callForHelp(guard, world);
    } else if (guard.meter >= SUSPICIOUS_AT && guard.state === GUARD_CALM) {
      guard.state = GUARD_SUSPICIOUS;
      guard.investigateTimer = GUARD_SEARCH_TIME;
    }
  } else {
    guard.meter = Math.max(0, guard.meter - DETECT_DECAY * dt);
    if (guard.meter < 10) guard.warned = false;
  }

  if (guard.state === GUARD_ALARM) {
    const seen = guard.lastSeen ?? { x: player.x, y: player.y };
    if (rate > 0) guard.chaseTimer = GUARD_CHASE_MEMORY;
    else guard.chaseTimer -= dt;
    walkToward(guard, grid, seen.x, seen.y, GUARD_CHASE_SPEED, dt, world);
    if (guard.chaseTimer <= 0) {
      // Lost the thief: search the last seen spot, then give up and patrol.
      guard.state = GUARD_INVESTIGATE;
      guard.investigate = { x: seen.x, y: seen.y };
      guard.investigateTimer = 3;
      guard.meter = 40;
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
      if (guard.investigateTimer <= 0) resumePatrol(guard);
    }
    return;
  }

  if (guard.state === GUARD_SUSPICIOUS) {
    // A near miss sends the guard to check where the thief was glimpsed.
    if (guard.lastSeen) {
      if (walkToward(guard, grid, guard.lastSeen.x, guard.lastSeen.y, GUARD_SPEED * 1.1, dt, world)) {
        guard.investigateTimer -= dt;
        turnToward(guard, guard.angle + 1.1 * dt, dt);
        if (guard.investigateTimer <= 0) resumePatrol(guard);
      }
    } else {
      turnToward(guard, angleToward(guard, guard.x + 40, guard.y), dt);
    }
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

export { nearestWalkable };
