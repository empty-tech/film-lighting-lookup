// Builds a fixture's faceplate and turns pointer / keyboard input into
// emulator presses. Timing lives here: hold-to-activate (e.g. power) and
// auto-repeat for +/- while held.

const ICONS = {
  power: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 6.3a8 8 0 1 0 9 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M12 3v9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  palette: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.6-.9 1.2-1.7-.5-1 .1-2.3 1.4-2.3H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10Z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="7.5" cy="11" r="1.4" fill="currentColor"/><circle cx="10" cy="7" r="1.4" fill="currentColor"/><circle cx="14.5" cy="7" r="1.4" fill="currentColor"/><circle cx="8" cy="15.5" r="1.4" fill="currentColor"/></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><g stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></g></svg>',
};

const KEYMAP = {
  ArrowUp: 'plus', ArrowRight: 'plus', '+': 'plus', '=': 'plus',
  ArrowDown: 'minus', ArrowLeft: 'minus', '-': 'minus',
  Enter: 'enter',
  m: 'menu', M: 'menu', Backspace: 'menu',
  c: 'palette', C: 'palette',
  b: 'brightness', B: 'brightness',
  p: 'power', P: 'power',
};

const REPEAT_DELAY = 450;
const REPEAT_SLOW = 110;
const REPEAT_FAST = 35; // after a second of holding, so 1–512 is quick

export function buildPanel(def) {
  const root = document.createElement('div');
  root.className = `emu emu--${def.family}`;

  const plate = document.createElement('div');
  plate.className = 'emu-plate';

  const ir = document.createElement('span');
  ir.className = 'emu-ir';
  ir.setAttribute('aria-hidden', 'true');

  const bezel = document.createElement('div');
  bezel.className = 'emu-bezel';
  const oled = document.createElement('div');
  oled.className = 'emu-oled';
  oled.setAttribute('role', 'img');
  bezel.append(oled);

  const mark = document.createElement('span');
  mark.className = 'emu-mark';
  mark.textContent = def.panel.mark;

  plate.append(ir, bezel, mark);

  const buttons = new Map();
  for (const b of def.panel.buttons) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `emu-btn emu-btn--${b.id}`;
    btn.dataset.btn = b.id;
    btn.setAttribute('aria-label', b.aria ?? b.label);
    if (b.icon) btn.innerHTML = ICONS[b.icon];
    else btn.textContent = b.label;
    if (b.holdMs) btn.style.setProperty('--hold-ms', `${b.holdMs}ms`);
    plate.append(btn);
    buttons.set(b.id, { el: btn, cfg: b });
  }

  root.append(plate);
  return { root, oled, buttons };
}

// Wires one logical button (pointer or key) to press/hold handlers.
// Returns { down, up, cancel }.
function buttonDriver(cfg, el, handlers) {
  let holdTimer = null;
  let repeatTimer = null;
  let active = false;
  let held = false;

  const clear = () => {
    clearTimeout(holdTimer);
    clearTimeout(repeatTimer);
    el.classList.remove('is-pressed', 'is-holding');
  };

  return {
    down() {
      if (active) return;
      active = true;
      held = false;
      el.classList.add('is-pressed');
      if (cfg.holdMs) {
        el.classList.add('is-holding');
        holdTimer = setTimeout(() => {
          held = true;
          el.classList.remove('is-holding');
          handlers.hold(cfg.id);
        }, cfg.holdMs);
        return;
      }
      handlers.press(cfg.id);
      if (cfg.repeat) {
        const started = Date.now();
        const tick = () => {
          handlers.press(cfg.id);
          repeatTimer = setTimeout(tick, Date.now() - started > 1000 + REPEAT_DELAY ? REPEAT_FAST : REPEAT_SLOW);
        };
        repeatTimer = setTimeout(tick, REPEAT_DELAY);
      }
    },
    up() {
      if (!active) return;
      active = false;
      clear();
      if (cfg.holdMs && !held) handlers.press(cfg.id);
    },
    cancel() {
      active = false;
      clear();
    },
  };
}

export function attachInput({ root, buttons }, handlers) {
  const drivers = new Map();
  const cleanups = [];

  for (const [id, { el, cfg }] of buttons) {
    const d = buttonDriver(cfg, el, handlers);
    drivers.set(id, d);
    const onDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      d.down();
    };
    const onUp = () => d.up();
    const onCancel = () => d.cancel();
    // Keyboard activation of the focused button (Space / Enter on the button).
    const onKey = (e) => {
      if (e.key !== ' ') return;
      e.preventDefault();
      e.stopPropagation();
      if (e.type === 'keydown' && !e.repeat) d.down();
      if (e.type === 'keyup') d.up();
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('keydown', onKey);
    el.addEventListener('keyup', onKey);
    cleanups.push(() => {
      d.cancel();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('keydown', onKey);
      el.removeEventListener('keyup', onKey);
    });
  }

  // Whole-page shortcuts while the emulator is open.
  // Leave keys alone while typing, and for the page's own buttons/links
  // (Enter on "Back" should go back, not press ENTER on the light).
  const typing = (t) => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  const foreignControl = (t) => t && (t.tagName === 'SUMMARY' || (/^(BUTTON|A)$/.test(t.tagName) && !root.contains(t)));
  const onDocKey = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    if ((e.key === 'Enter' || e.key === ' ') && foreignControl(e.target)) return;
    const id = KEYMAP[e.key];
    const d = id && drivers.get(id);
    if (!d) return;
    e.preventDefault();
    const { cfg } = buttons.get(id);
    if (e.type === 'keydown') {
      // Let the browser's key repeat drive +/- so held arrows scroll.
      if (e.repeat && !cfg.holdMs) handlers.press(id);
      else if (!e.repeat) {
        if (cfg.repeat) handlers.press(id);
        else d.down();
      }
    } else if (!cfg.repeat) {
      d.up();
    }
  };
  document.addEventListener('keydown', onDocKey);
  document.addEventListener('keyup', onDocKey);
  cleanups.push(() => {
    document.removeEventListener('keydown', onDocKey);
    document.removeEventListener('keyup', onDocKey);
  });

  return () => cleanups.forEach((fn) => fn());
}
