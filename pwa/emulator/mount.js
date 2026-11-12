// mountEmulator(container, def) puts a working control panel into
// `container`. It doesn't touch the URL or anything outside the container
// (apart from document key listeners, removed on destroy()).
//
// emu.subscribe(fn) reports every state change — that's the hook for the
// future "what the light is doing" preview.

import { createEmulator } from './engine/emulator.js';
import { buildPanel, attachInput } from './engine/panel.js';
import { paintScreen } from './engine/screen.js';

const FLASH_MS = 1500;

export function mountEmulator(container, def) {
  const emu = createEmulator(def);
  const panel = buildPanel(def);

  const hint = document.createElement('p');
  hint.className = 'emu-hint';

  const keys = document.createElement('p');
  keys.className = 'emu-keys';
  keys.textContent = 'Keyboard: ← → or − + to scroll · Enter · M = Menu · C = palette · B = brightness · hold P = power';

  // "Where am I?" — the menu path and where that behaviour comes from.
  const help = document.createElement('details');
  help.className = 'emu-help';
  const summary = document.createElement('summary');
  summary.textContent = 'Where am I? / Is this accurate?';
  const helpBody = document.createElement('div');
  help.append(summary, helpBody);

  panel.root.append(hint, keys, help);
  container.append(panel.root);

  let idleTimer = null;
  let flashTimer = null;

  const paintHelp = () => {
    const { path, node } = emu.where();
    helpBody.replaceChildren();
    const add = (cls, text) => {
      const p = document.createElement('p');
      p.className = cls;
      p.textContent = text;
      helpBody.append(p);
    };
    add('emu-help-path', emu.state.power === 'on' ? (path.length ? path.join(' › ') : 'Status screen') : 'Light is off');
    if (node.src) add('emu-help-src', `Source: ${node.src}`);
    if (node.guess) add('emu-help-guess', `Not confirmed: ${node.guess}`);
    if (def.derivedNote) add('emu-help-guess', def.derivedNote);
  };

  const paint = () => {
    paintScreen(panel.oled, emu.render());
    hint.textContent = emu.state.power === 'on' ? def.panel.hints.on : def.panel.hints.off;
    if (emu.state.blueMode) hint.textContent = 'Blue Mode: the light flickers blue, ready to pair with the AsteraApp.';
    panel.oled.setAttribute('aria-label', [...panel.oled.querySelectorAll('.emu-line')].map((l) => l.textContent).join(' / ') || 'Screen off');
    paintHelp();
  };

  const afterInput = () => {
    clearTimeout(idleTimer);
    if (def.idleMs) idleTimer = setTimeout(() => emu.idle(), def.idleMs);
    clearTimeout(flashTimer);
    if (emu.hasFlash()) flashTimer = setTimeout(() => emu.clearFlash(), FLASH_MS);
    paint();
  };

  const unsubscribe = emu.subscribe(paint);
  const detachInput = attachInput(panel, {
    press: (id) => {
      emu.press(id);
      afterInput();
    },
    hold: (id) => {
      emu.hold(id);
      afterInput();
    },
  });

  paint();

  return {
    emu,
    destroy() {
      clearTimeout(idleTimer);
      clearTimeout(flashTimer);
      detachInput();
      unsubscribe();
      panel.root.remove();
    },
  };
}
