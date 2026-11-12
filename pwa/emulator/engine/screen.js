// Paints a screen description (from emulator.render()) into the OLED element.

import { WIDTH } from './nodes.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

function lineEl(l) {
  let text = l.text.slice(0, WIDTH);
  // The manuals mark the line being edited with a run of underscores.
  if (l.fill) text = text.padEnd(WIDTH, '_');
  const d = el('div', 'emu-line');
  if (l.caret == null) {
    d.textContent = text || ' ';
  } else {
    const [a, b] = Array.isArray(l.caret) ? l.caret : [l.caret, l.caret + 1];
    d.append(text.slice(0, a), el('span', 'emu-caret', text.slice(a, b)), text.slice(b));
  }
  return d;
}

function iconRow({ battery, onAC, tag }) {
  const row = el('div', 'emu-icons');
  const left = el('span', 'emu-icon-tag');
  if (tag) left.append(el('span', 'emu-antenna'), tag);
  const right = el('span', 'emu-icon-batt');
  right.append(`${battery}%`);
  const batt = el('span', 'emu-batt');
  batt.style.setProperty('--level', `${battery}%`);
  right.append(batt);
  if (onAC) right.append(el('span', 'emu-plug'));
  row.append(left, right);
  return row;
}

export function paintScreen(oled, scr) {
  oled.className = `emu-oled emu-oled--${scr.size}${scr.off ? ' is-off' : ''}`;
  oled.replaceChildren();
  if (scr.off) return;
  if (scr.iconState) oled.append(iconRow(scr.iconState));
  const box = el('div', 'emu-lines');
  for (const l of scr.lines) box.append(lineEl(l));
  oled.append(box);
}
