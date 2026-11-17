// Paints a screen description (from emulator.render()) into the OLED element.

import { WIDTH } from './nodes.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

function lineEl(l) {
  const text = l.text.slice(0, WIDTH);
  // The selected line of an editor is shown in inverse video, full width.
  const d = el('div', l.selected ? 'emu-line is-selected' : 'emu-line');
  if (l.caret == null) {
    d.textContent = text || ' ';
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

// "Main menu#3" -> ['Main menu', 3]
const splitScroll = (key) => {
  const i = key.lastIndexOf('#');
  return [key.slice(0, i), Number(key.slice(i + 1))];
};

// Which way the text should slide in, or null for no animation. Only when
// stepping through the same list (the real OLED scrolls between entries).
function slideDirection(prevKey, nextKey) {
  if (!prevKey || !nextKey || prevKey === nextKey) return null;
  const [pList, pIdx] = splitScroll(prevKey);
  const [nList, nIdx] = splitScroll(nextKey);
  if (pList !== nList) return null;
  return nIdx > pIdx ? 'up' : 'down';
}

export function paintScreen(oled, scr) {
  const dir = scr.off ? null : slideDirection(oled.dataset.scroll, scr.scroll);
  if (scr.scroll && !scr.off) oled.dataset.scroll = scr.scroll;
  else delete oled.dataset.scroll;

  oled.className = `emu-oled emu-oled--${scr.size}${scr.off ? ' is-off' : ''}`;
  oled.replaceChildren();
  if (scr.off) return;
  if (scr.iconState) oled.append(iconRow(scr.iconState));
  const box = el('div', 'emu-lines');
  for (const l of scr.lines) box.append(lineEl(l));
  if (dir) box.classList.add(`emu-slide-${dir}`);
  oled.append(box);
}
