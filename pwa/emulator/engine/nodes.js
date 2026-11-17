// Menu node types for the control-panel emulator.
//
// A fixture's menu is a tree of these nodes. The emulator keeps a stack of
// frames ({ node, cursor, ... }); the top frame's node receives button presses
// and renders the screen. Nodes never touch the DOM; render() returns a plain
// screen description (see screen()).
//
// Every node can carry:
//   label – how it's named in a parent menu / the "?" overlay
//   src   – where the behaviour comes from (e.g. "Titan manual §7.12")
//   guess – set when the behaviour is NOT documented and was inferred; the
//           text says what was assumed, so it can be checked on a real light.
//
// ctx (provided by the emulator): { state, update(fn), push(node, init),
// pop(), home(), flash(lines) }.

export const WIDTH = 16;

export const pad = (n, w = 3) => String(n).padStart(w, '0');

const line = (l) => (typeof l === 'string' ? { text: l } : l);

// size 'big' = two large lines (status / menus); 'small' = four lines
// (palette screens). icons = show the battery / input icon row.
// scroll = "<list id>#<index>" for screens that step through a list; when only
// the index changes, the painter slides the text like the real OLED does.
export function screen(lines, { size = 'big', icons = false, scroll } = {}) {
  const scr = { size, icons, lines: lines.map(line) };
  if (scroll) scr.scroll = scroll;
  return scr;
}

const wrapIndex = (i, n) => ((i % n) + n) % n;
const isNode = (x) => x && typeof x.press === 'function';

// A list of entries; +/- move between them, ENTER opens, MENU goes back.
// exitAtEnds: moving past either end returns to the parent (the Astera main
// menu is a loop that passes through the status screen).
// showValues: render "<entry label> / <entry value>" (INFO style) instead of
// "<title> / <entry label>".
export function menu({ label, title = label, items, exitAtEnds = false, showValues = false, icons = false, src, guess }) {
  const node = {
    kind: 'menu', label, title, items, icons, src, guess,
    render(ctx, f) {
      const it = items[f.cursor];
      const lines = showValues ? [it.label, it.valueText ? it.valueText(ctx.state) : ''] : [title, it.label];
      return screen(lines, { icons, scroll: `${label}#${f.cursor}` });
    },
    press(btn, ctx, f) {
      const n = items.length;
      if (btn === 'plus' || btn === 'minus') {
        const d = btn === 'plus' ? 1 : -1;
        if (exitAtEnds && f.cursor + d >= n) return ctx.pop();
        if (exitAtEnds && f.cursor + d < 0) return ctx.pop();
        f.cursor = wrapIndex(f.cursor + d, n);
      } else if (btn === 'menu') {
        ctx.pop();
      } else if (btn === 'enter') {
        const it = items[f.cursor];
        if (it.activate) it.activate(ctx);
        else if (isNode(it)) ctx.push(it);
      }
    },
    // The entry under the cursor, for the "?" overlay.
    focus: (f) => items[f.cursor],
  };
  return node;
}

// Pick one value from a list. Values apply as you scroll (the light changes
// live); ENTER or MENU go back. An option may instead be a node (e.g. INDEX
// COLOR inside STATIC COLOR) — ENTER opens it.
export function choice({ label, title = label, options, get, set, onEnter, src, guess }) {
  const opts = (state) => (typeof options === 'function' ? options(state) : options);
  const labelOf = (o) => o.label ?? String(o.value);
  const node = {
    kind: 'choice', label, title, src, guess,
    init(ctx, f) {
      if (onEnter) onEnter(ctx);
      const v = get(ctx.state);
      const i = opts(ctx.state).findIndex((o) => !isNode(o) && o.value === v);
      f.cursor = Math.max(0, i);
    },
    render(ctx, f) {
      return screen([title, labelOf(opts(ctx.state)[f.cursor])], { scroll: `${label}#${f.cursor}` });
    },
    press(btn, ctx, f) {
      const o = opts(ctx.state);
      if (btn === 'plus' || btn === 'minus') {
        f.cursor = wrapIndex(f.cursor + (btn === 'plus' ? 1 : -1), o.length);
        const x = o[f.cursor];
        if (!isNode(x)) ctx.update((s) => set(s, x.value));
      } else if (btn === 'enter') {
        const x = o[f.cursor];
        if (isNode(x)) ctx.push(x);
        else ctx.pop();
      } else if (btn === 'menu') {
        ctx.pop();
      }
    },
    valueText(state) {
      const v = get(state);
      const o = opts(state).find((x) => !isNode(x) && x.value === v);
      return o ? labelOf(o) : '';
    },
  };
  return node;
}

// A number with +/- steps. Either min/max/step, or a fixed list of `values`.
export function number({ label, title = label, get, set, min, max, step = 1, values, format = String, wrap = false, src, guess }) {
  const next = (v, d) => {
    if (values) {
      let i = values.indexOf(v);
      if (i < 0) i = values.findIndex((x) => x >= v);
      i = wrap ? wrapIndex(i + d, values.length) : Math.min(values.length - 1, Math.max(0, i + d));
      return values[i];
    }
    let n = Math.round((v + d * step) * 1000) / 1000;
    if (n > max) n = wrap ? min : max;
    if (n < min) n = wrap ? max : min;
    return n;
  };
  return {
    kind: 'number', label, title, src, guess,
    render: (ctx) => screen([title, format(get(ctx.state))]),
    press(btn, ctx) {
      if (btn === 'plus' || btn === 'minus') {
        const v = next(get(ctx.state), btn === 'plus' ? 1 : -1);
        ctx.update((s) => set(s, v));
      } else if (btn === 'enter' || btn === 'menu') {
        ctx.pop();
      }
    },
    valueText: (state) => format(get(state)),
  };
}

// A read-only line in an INFO-style menu. ENTER goes back (or opens `edit`).
export function readout({ label, value, edit, src, guess }) {
  return {
    kind: 'readout', label, src, guess,
    valueText: value,
    activate: (ctx) => (edit ? ctx.push(edit) : ctx.pop()),
  };
}

// Multi-digit code editor: +/- change the digit, MENU moves to the next
// digit, ENTER saves.
export function digitsEditor({ label, title = label, digits = 4, get, set, src, guess }) {
  return {
    kind: 'digits', label, title, src, guess,
    init(ctx, f) {
      f.draft = get(ctx.state).padStart(digits, '0').split('').map(Number);
      f.digit = 0;
    },
    render(ctx, f) {
      return screen([title, { text: f.draft.join(''), caret: f.digit }]);
    },
    press(btn, ctx, f) {
      if (btn === 'plus' || btn === 'minus') {
        f.draft[f.digit] = wrapIndex(f.draft[f.digit] + (btn === 'plus' ? 1 : -1), 10);
      } else if (btn === 'menu') {
        f.digit = (f.digit + 1) % digits;
      } else if (btn === 'enter') {
        const code = f.draft.join('');
        ctx.update((s) => set(s, code));
        ctx.pop();
      }
    },
  };
}

// "ARE YOU SURE?  NO YES". +/- pick, ENTER confirms, MENU backs out.
export function confirm({ label, question = 'ARE YOU SURE?', onYes, src, guess }) {
  return {
    kind: 'confirm', label, src, guess,
    init(ctx, f) { f.yes = false; },
    render(ctx, f) {
      return screen([question, { text: 'NO YES', caret: f.yes ? [3, 6] : [0, 2] }]);
    },
    press(btn, ctx, f) {
      if (btn === 'plus' || btn === 'minus') f.yes = !f.yes;
      else if (btn === 'menu') ctx.pop();
      else if (btn === 'enter') {
        if (f.yes) onYes(ctx);
        else ctx.pop();
      }
    },
  };
}

// A menu entry that does something when ENTER is pressed.
export function action({ label, run, src, guess }) {
  return { kind: 'action', label, src, guess, activate: run };
}

// A full-screen editor with several lines, some editable (the Astera colour
// palette and brightness screens). ENTER jumps between editable lines, +/-
// edit the selected one, MENU returns to the status screen. The selected line
// is drawn in inverse video.
//
// lines: [{ text: (state) => string, field?: { get, set, min, max, step,
//   options?: (state) => values[] , wrap? } }]
export function editor({ label, lines, size = 'small', onShow, src, guess }) {
  const editable = lines.map((l, i) => (l.field ? i : -1)).filter((i) => i >= 0);
  const stepField = (fld, state, d) => {
    const v = fld.get(state);
    if (fld.options) {
      const opts = fld.options(state);
      const i = opts.indexOf(v);
      return opts[wrapIndex(i + d, opts.length)];
    }
    let n = Math.round((v + d * (fld.step ?? 1)) * 1000) / 1000;
    if (n > fld.max) n = fld.wrap ? fld.min : fld.max;
    if (n < fld.min) n = fld.wrap ? fld.max : fld.min;
    return n;
  };
  return {
    kind: 'editor', label, src, guess,
    init(ctx, f) {
      f.sel = 0;
      if (onShow) onShow(ctx);
    },
    render(ctx, f) {
      const sel = editable[f.sel];
      return screen(lines.map((l, i) => ({ text: l.text(ctx.state), selected: i === sel })), { size });
    },
    press(btn, ctx, f) {
      if (btn === 'enter') {
        f.sel = (f.sel + 1) % editable.length;
      } else if (btn === 'plus' || btn === 'minus') {
        const fld = lines[editable[f.sel]].field;
        const v = stepField(fld, ctx.state, btn === 'plus' ? 1 : -1);
        ctx.update((s) => fld.set(s, v));
      } else if (btn === 'menu') {
        ctx.home();
      }
    },
  };
}
