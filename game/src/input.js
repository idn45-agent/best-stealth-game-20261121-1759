// Keyboard and mouse input: WASD/arrows to move, Shift to run, C/Ctrl to sneak,
// click to throw a pebble toward the mouse, P/Esc to pause, Enter to confirm.
// The mouse also aims: moving it updates aimX/aimY in canvas pixels, and the
// renderer draws the dotted arc of the next pebble throw.
export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';

export function createInput(canvas) {
  const input = {
    up: false, down: false, left: false, right: false,
    run: false, sneak: false,
    throwPebble: false, throwX: 0, throwY: 0,
    aimX: 0, aimY: 0, aimMoved: false,
    pressed: new Set(),
  };
  const keys = new Set();

  function keyOf(event) {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }

  function sync() {
    input.up = keys.has('w') || keys.has('ArrowUp');
    input.down = keys.has('s') || keys.has('ArrowDown');
    input.left = keys.has('a') || keys.has('ArrowLeft');
    input.right = keys.has('d') || keys.has('ArrowRight');
    input.run = keys.has('Shift');
    input.sneak = keys.has('c') || keys.has('Control');
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  window.addEventListener('keydown', (event) => {
    const key = keyOf(event);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    if (!event.repeat) {
      keys.add(key);
      if (key === 'Enter' || key === ' ') input.pressed.add(ACTION_CONFIRM);
      if (key === 'p' || key === 'Escape') input.pressed.add(ACTION_PAUSE);
    }
    sync();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(keyOf(event));
    sync();
  });
  window.addEventListener('blur', () => { keys.clear(); sync(); });

  canvas.addEventListener('mousemove', (event) => {
    const point = canvasPoint(event);
    input.aimX = point.x;
    input.aimY = point.y;
    input.aimMoved = true;
  });
  canvas.addEventListener('mousedown', (event) => {
    const point = canvasPoint(event);
    input.throwX = point.x;
    input.throwY = point.y;
    input.throwPebble = true;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  return input;
}

export function takePressed(input, action) {
  if (!input.pressed.has(action)) return false;
  input.pressed.delete(action);
  return true;
}
