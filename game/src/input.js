// Keyboard and mouse, read fresh every frame. Movement is WASD or arrows;
// the mouse aims, holding the left button (or Space) fires, Shift or right
// button dashes, Q fires a nova blast, P pauses, M mutes, R restarts.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;
export const ACTION_NOVA = 16;
export const ACTION_DASH = 32;

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const digitPressed = new Set();
  let mouseX = 640;
  let mouseY = 360;
  let mouseDown = false;
  let mousePressed = false;
  let dashQueued = false;

  function keyName(event) {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    const key = keyName(event);
    if (!event.repeat) {
      pressed.add(key);
      // Draft digits get their own edge queue: takeActions() spends `pressed`
      // before the upgrade screen reads it, and a quick tap must not be lost.
      if (key === '1' || key === '2' || key === '3') digitPressed.add(key);
    }
    keys.add(key);
  });
  window.addEventListener('keyup', (event) => keys.delete(keyName(event)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = ((event.clientX - rect.left) / rect.width) * 1280;
    mouseY = ((event.clientY - rect.top) / rect.height) * 720;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) { mouseDown = true; mousePressed = true; }
    if (event.button === 2) dashQueued = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function direction() {
    let x = 0;
    let y = 0;
    if (keys.has('a') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('d') || keys.has('ArrowRight')) x += 1;
    if (keys.has('w') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('s') || keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  }

  function takeActions() {
    let actions = 0;
    if (pressed.has(' ') || pressed.has('Enter') || mousePressed) actions |= ACTION_CONFIRM;
    if (pressed.has('p') || pressed.has('Escape')) actions |= ACTION_PAUSE;
    if (pressed.has('r')) actions |= ACTION_RESTART;
    if (pressed.has('m')) actions |= ACTION_MUTE;
    if (pressed.has('q')) actions |= ACTION_NOVA;
    if (pressed.has('Shift') || dashQueued) actions |= ACTION_DASH;
    pressed.clear();
    mousePressed = false;
    dashQueued = false;
    return actions;
  }

  // Digit keys are read from their own edge queue, consumed on read.
  function takeUpgradeChoice() {
    if (digitPressed.has('1')) { digitPressed.clear(); return 0; }
    if (digitPressed.has('2')) { digitPressed.clear(); return 1; }
    if (digitPressed.has('3')) { digitPressed.clear(); return 2; }
    return -1;
  }

  return {
    direction,
    takeActions,
    takeUpgradeChoice,
    firing() { return mouseDown || keys.has(' '); },
    aim() { return { x: mouseX, y: mouseY }; },
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    clearPressed() { pressed.clear(); mousePressed = false; dashQueued = false; },
  };
}
