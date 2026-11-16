// Keyboard and mouse: which keys are held, where the mouse points (in game coordinates), which
// buttons are held, and the presses since the last frame (taken once per frame by main.js).
const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

export function createInput(canvas, toGame) {
  const keys = new Set();
  const mouse = { x: 640, y: 200, left: false, right: false };
  let pressed = [];

  window.addEventListener('keydown', (e) => {
    if (BLOCK.has(e.code)) e.preventDefault();
    if (!e.repeat) pressed.push(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.left = mouse.right = false;
  });
  const move = (e) => {
    const p = toGame(e.clientX, e.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
  };
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerdown', (e) => {
    move(e);
    if (e.button === 0) mouse.left = true;
    if (e.button === 2) mouse.right = true;
    pressed.push(`Mouse${e.button}`);
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointerup', (e) => {
    if (e.button === 0) mouse.left = false;
    if (e.button === 2) mouse.right = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    mouse,
    held: (...codes) => codes.some((c) => keys.has(c)),
    take() {
      const out = pressed;
      pressed = [];
      return out;
    },
    moveX: () => (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
    moveY: () => (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0),
  };
}
