// Canvas renderer: top-down night museum, vision cones raycast against walls,
// cover, shadows, the relic, the exit, and every screen overlay.
import { COLS, ROWS, TILE, VIEW_HEIGHT, VIEW_WIDTH, GUARD_VIEW_HALF_ANGLE, GUARD_VIEW_RANGE } from './config.js';
import { TILE_BUSH, TILE_CASE, TILE_SHADOW, TILE_WALL, isSolid } from './level.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const CONE_COLORS = {
  calm: 'rgba(255, 214, 90, 0.20)',
  suspicious: 'rgba(255, 150, 40, 0.30)',
  alarm: 'rgba(255, 60, 50, 0.36)',
  investigate: 'rgba(255, 190, 60, 0.26)',
};

function rayLength(grid, x, y, angle) {
  for (let d = 8; d <= GUARD_VIEW_RANGE; d += 8) {
    if (isSolid(grid, x + Math.cos(angle) * d, y + Math.sin(angle) * d)) return d - 4;
  }
  return GUARD_VIEW_RANGE;
}

function drawCone(ctx, grid, guard) {
  const rays = 44;
  const start = guard.angle - GUARD_VIEW_HALF_ANGLE;
  const end = guard.angle + GUARD_VIEW_HALF_ANGLE;
  const base = CONE_COLORS[guard.state] ?? CONE_COLORS.calm;
  const gradient = ctx.createRadialGradient(guard.x, guard.y, 8, guard.x, guard.y, GUARD_VIEW_RANGE);
  gradient.addColorStop(0, base.replace(/[\d.]+\)$/, '0.42)'));
  gradient.addColorStop(0.7, base);
  gradient.addColorStop(1, base.replace(/[\d.]+\)$/, '0.06)'));
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  for (let i = 0; i <= rays; i += 1) {
    const angle = start + ((end - start) * i) / rays;
    const len = rayLength(grid, guard.x, guard.y, angle);
    ctx.lineTo(guard.x + Math.cos(angle) * len, guard.y + Math.sin(angle) * len);
  }
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 235, 150, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawGuard(ctx, guard) {
  const bob = Math.sin(guard.stepPhase) * 1.5;
  ctx.save();
  ctx.translate(guard.x, guard.y + bob * 0.3);
  // Body: watchman in a bright steel-blue coat with a brass lantern.
  ctx.fillStyle = '#3f66a8';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#bcd2ff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#d9a441';
  ctx.beginPath();
  ctx.arc(Math.cos(guard.angle) * 8, Math.sin(guard.angle) * 8, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e8ecf5';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(guard.angle) * 15, Math.sin(guard.angle) * 15);
  ctx.stroke();
  ctx.restore();
  // State mark and detection meter.
  const mark = guard.state === 'alarm' ? '!' : guard.state === 'suspicious' || guard.state === 'investigate' ? '?' : '';
  if (mark) {
    ctx.fillStyle = guard.state === 'alarm' ? '#ff5040' : '#ffb020';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(mark, guard.x, guard.y - 20);
  }
  if (guard.meter > 2) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(guard.x - 16, guard.y - 32, 32, 5);
    ctx.fillStyle = guard.meter >= 100 ? '#ff5040' : '#ffcf3f';
    ctx.fillRect(guard.x - 15, guard.y - 31, 30 * (guard.meter / 100), 3);
  }
}

function drawPlayer(ctx, player, grid, time) {
  const hidden = grid && (Math.floor(player.x / TILE) >= 0)
    && (['B'].includes((grid[Math.floor(player.y / TILE)] ?? [])[Math.floor(player.x / TILE)] ?? '.'));
  const bob = player.moving ? Math.sin(player.stepPhase) * 1.5 : 0;
  ctx.save();
  ctx.translate(player.x, player.y + bob * 0.3);
  ctx.globalAlpha = hidden ? 0.55 : 1;
  // Cloak: a hooded thief in bright teal, rimmed so they read at a glance.
  ctx.fillStyle = '#14b89a';
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(11, 10);
  ctx.lineTo(-11, 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d8fff4';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#f2e6c9';
  ctx.beginPath();
  ctx.arc(0, -3, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#14b89a';
  ctx.beginPath();
  ctx.arc(0, -4, 6.5, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Sneak / run hint ring.
  if (player.sneaking) {
    ctx.strokeStyle = 'rgba(120, 220, 190, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 17, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (player.running) {
    ctx.strokeStyle = 'rgba(255, 200, 90, 0.5)';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 15 + Math.sin(time * 10) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function createRenderer(canvas) {
  canvas.width = VIEW_WIDTH;
  canvas.height = VIEW_HEIGHT;
  const ctx = canvas.getContext('2d');

  function drawFloor(grid) {
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const cell = grid[y][x];
        const px = x * TILE;
        const py = y * TILE;
        if (cell === TILE_WALL) {
          ctx.fillStyle = '#232a3d';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = '#39415c';
          ctx.fillRect(px, py, TILE, 5);
          continue;
        }
        ctx.fillStyle = (x + y) % 2 === 0 ? '#2e2a24' : '#2a2620';
        ctx.fillRect(px, py, TILE, TILE);
        if (cell === TILE_SHADOW) {
          ctx.fillStyle = 'rgba(8, 10, 26, 0.55)';
          ctx.fillRect(px, py, TILE, TILE);
        }
        if (cell === TILE_BUSH) {
          ctx.fillStyle = '#1d4a2c';
          ctx.beginPath();
          ctx.arc(px + 10, py + 12, 10, 0, Math.PI * 2);
          ctx.arc(px + 22, py + 10, 11, 0, Math.PI * 2);
          ctx.arc(px + 16, py + 22, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#2c6b3f';
          ctx.beginPath();
          ctx.arc(px + 12, py + 10, 5, 0, Math.PI * 2);
          ctx.arc(px + 22, py + 20, 5, 0, Math.PI * 2);
          ctx.fill();
        }
        if (cell === TILE_CASE) {
          ctx.fillStyle = '#5a3d1e';
          ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
          ctx.fillStyle = '#8a6a35';
          ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
          ctx.fillStyle = 'rgba(180, 220, 255, 0.25)';
          ctx.fillRect(px + 6, py + 6, TILE - 12, 5);
        }
      }
    }
  }

  function drawExit(world, time) {
    const { exit, relic } = world;
    const pulse = 0.5 + Math.sin(time * 3) * 0.2;
    ctx.save();
    ctx.translate(exit.x, exit.y);
    ctx.fillStyle = relic.taken ? `rgba(60, 220, 130, ${0.75 + pulse * 0.25})` : 'rgba(90, 110, 90, 0.8)';
    ctx.fillRect(-14, -14, 28, 28);
    ctx.fillStyle = '#0d2b18';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(relic.taken ? 'EXIT' : 'EXIT', 0, 1);
    ctx.strokeStyle = relic.taken ? '#7dffb0' : '#5a6a5a';
    ctx.lineWidth = 2;
    ctx.strokeRect(-14, -14, 28, 28);
    ctx.restore();
    if (!relic.taken) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('locked — take the relic first', exit.x, exit.y - 26);
    }
  }

  function drawRelic(world, time) {
    const { relic } = world;
    if (relic.taken) return;
    const glow = 0.5 + Math.sin(time * 4) * 0.25;
    ctx.save();
    ctx.translate(relic.x, relic.y);
    ctx.fillStyle = `rgba(150, 200, 255, ${glow * 0.5})`;
    ctx.beginPath();
    ctx.arc(0, 0, 20 + glow * 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#bcd8ff';
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(8, 0);
    ctx.lineTo(0, 11);
    ctx.lineTo(-8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-2, -3, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#cfe4ff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MOON OPAL', relic.x, relic.y - 26);
  }

  function drawLoot(world) {
    for (const coin of world.levelLoot) {
      if (coin.taken) continue;
      ctx.fillStyle = '#e8b93c';
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff0b0';
      ctx.beginPath();
      ctx.arc(coin.x - 1.5, coin.y - 1.5, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPebbles(world) {
    for (const pebble of world.pebbles) {
      const x = pebble.x + (pebble.tx - pebble.x) * pebble.t;
      const y = pebble.y + (pebble.ty - pebble.y) * pebble.t - Math.sin(pebble.t * Math.PI) * 26;
      ctx.fillStyle = '#c9c9c9';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (world.noise) {
      ctx.strokeStyle = 'rgba(255, 220, 120, 0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(world.noise.x, world.noise.y, world.noise.radius * (1 - world.noise.ttl), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function overlay(text, sub, color) {
    ctx.fillStyle = 'rgba(5, 8, 18, 0.72)';
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.fillStyle = color ?? '#f2e6c9';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 10);
    if (sub) {
      ctx.fillStyle = '#cfd6e4';
      ctx.font = '17px sans-serif';
      ctx.fillText(sub, VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 28);
    }
  }

  function draw(world, screen, stats, time) {
    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    drawFloor(world.grid);
    for (const guard of world.guards) drawCone(ctx, world.grid, guard);
    drawExit(world, time);
    drawRelic(world, time);
    drawLoot(world);
    drawPebbles(world);
    for (const guard of world.guards) drawGuard(ctx, guard);
    drawPlayer(ctx, world.player, world.grid, time);
    if (world.caughtFlash > 0) {
      ctx.fillStyle = `rgba(255, 40, 30, ${world.caughtFlash * 0.35})`;
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    }
    const alarmed = world.guards.some((g) => g.state === 'alarm');
    if (alarmed && screen === SCREEN_PLAY) {
      ctx.fillStyle = '#ff5040';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SPOTTED — RUN!', VIEW_WIDTH / 2, 24);
    }
    if (screen === SCREEN_TITLE) {
      overlay('LUMEN HEIST', 'A quiet thief. Five watchmen. One Moon Opal.', '#ffe9a8');
      ctx.fillStyle = '#cfd6e4';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('WASD / arrows — move      Shift — run (loud)      C — sneak', VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 66);
      ctx.fillText('Click — throw a pebble to distract      P — pause', VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 92);
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('Press Enter to begin', VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 130);
    }
    if (screen === SCREEN_PAUSED) overlay('PAUSED', 'Press P to keep sneaking', '#cfd6e4');
    if (screen === SCREEN_OVER) overlay('CAUGHT', `The watchmen found you. Loot ${stats.loot} · Press Enter to try again`, '#ff8a7a');
    if (screen === SCREEN_WIN) overlay('THE MOON OPAL IS YOURS', `All three halls cleared · Loot ${stats.loot} · Press Enter to play again`, '#ffe9a8');
  }

  return { draw };
}
