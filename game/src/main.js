// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. The game moves between
// five screens: title, play, paused, game over and win.
//
// ?seed=N fixes the level layout. ?shot=cover|patrol|alarm|win (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { LEVELS } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAUGHT, EVENT_GAME_OVER, EVENT_LEVEL_CLEAR, EVENT_WIN, STEP, stepWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput, takePressed } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const hudLevel = document.getElementById('hud-level');
const hudLoot = document.getElementById('hud-loot');
const hudLives = document.getElementById('hud-lives');
const hudPebbles = document.getElementById('hud-pebbles');
const hudGoal = document.getElementById('hud-goal');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function announce(message) {
  status.textContent = message;
}

function playEventSounds() {
  for (const event of world.events) {
    if (event.type === 'step') audio.step(event.loud);
    if (event.type === 'guard-step') audio.guardStep();
    if (event.type === 'coin') audio.coin();
    if (event.type === 'relic') audio.relic();
    if (event.type === 'alarm') audio.alarm();
    if (event.type === 'caught') audio.caught();
    if (event.type === 'throw') audio.pebble();
    if (event.type === 'pebble-land') audio.land();
    if (event.type === 'exit') audio.exit();
  }
}

function updateHud(screen) {
  const level = LEVELS[world.levelIndex];
  hudLevel.textContent = level.name;
  hudLoot.textContent = `Loot ${world.loot}`;
  hudLives.textContent = `♥`.repeat(world.lives) + `♡`.repeat(Math.max(0, 3 - world.lives));
  hudPebbles.textContent = `Pebbles ${world.player.pebbles}`;
  hudGoal.textContent = world.relic.taken ? 'Reach the green EXIT' : 'Steal the MOON OPAL';
  document.getElementById('hud-alert').textContent = world.guards.some((g) => g.state === 'alarm')
    ? 'ALARM'
    : world.guards.some((g) => g.state === 'suspicious' || g.state === 'investigate') ? 'SUSPICIOUS' : 'UNSEEN';
  document.getElementById('hud-alert').style.color = world.guards.some((g) => g.state === 'alarm')
    ? '#ff5040'
    : world.guards.some((g) => g.state === 'suspicious') ? '#ffb020' : '#7dffb0';
}

function runShot(name) {
  const scene = stageShot(name, world, stepWorld);
  let painted = 0;
  function paint() {
    updateHud(SCREEN_PLAY);
    renderer.draw(world, scene.screen, { loot: world.loot }, world.time);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let levelToast = 0;

  function startGame() {
    world.reset();
    screen = SCREEN_PLAY;
    announce(`Playing. ${world.lives} lives. Steal the Moon Opal.`);
  }

  function frame(now) {
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    audio.unlock();
    if (takePressed(input, ACTION_PAUSE) && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED)) {
      screen = screen === SCREEN_PLAY ? SCREEN_PAUSED : SCREEN_PLAY;
      announce(screen === SCREEN_PAUSED ? 'Paused.' : 'Playing.');
    }
    if (screen === SCREEN_TITLE && takePressed(input, ACTION_CONFIRM)) startGame();
    if ((screen === SCREEN_OVER || screen === SCREEN_WIN) && takePressed(input, ACTION_CONFIRM)) startGame();
    if (screen === SCREEN_PLAY) {
      accumulator += elapsed;
      while (accumulator >= STEP) {
        const result = stepWorld(world, input, STEP);
        playEventSounds();
        if (result & EVENT_WIN) {
          screen = SCREEN_WIN;
          audio.win();
          announce(`You stole the Moon Opal from every hall. Loot ${world.loot}.`);
        } else if (result & EVENT_GAME_OVER) {
          screen = SCREEN_OVER;
          announce(`Caught. Game over. Loot ${world.loot}.`);
        } else if (result & EVENT_LEVEL_CLEAR) {
          levelToast = 2.5;
          audio.exit();
          announce(`Hall cleared. ${LEVELS[world.levelIndex].name}.`);
        } else if (result & EVENT_CAUGHT) {
          announce(`Caught! ${world.lives} lives left.`);
        }
        accumulator -= STEP;
      }
      if (levelToast > 0) levelToast -= elapsed;
    }
    updateHud(screen);
    renderer.draw(world, screen, { loot: world.loot }, world.time);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
