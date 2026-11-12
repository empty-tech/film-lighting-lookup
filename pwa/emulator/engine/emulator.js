// Emulator core: fixture state + menu navigation. No DOM, no timers, so it
// can be driven from tests. The panel (panel.js) turns pointer/keyboard input
// into press(btn) / hold(btn) calls and handles timing.
//
// A fixture definition provides:
//   initialState()          – the light's state after a factory reset
//   home                    – the status-screen node (bottom of the stack)
//   shortcuts               – { [btn]: { pages: [node…], allowed?(state) } };
//                             pressing the button cycles through the pages
//   powerOn(state), powerOff(state), powerHoldWhileOn(state) – optional hooks
//   iconsFor(state)         – what the status icon row shows

export function createEmulator(def) {
  let state = def.initialState();
  const listeners = new Set();
  let stack;
  let flashLines = null;

  const notify = () => listeners.forEach((fn) => fn(state));

  const ctx = {
    get state() {
      return state;
    },
    update(fn) {
      const next = structuredClone(state);
      fn(next);
      state = next;
      notify();
    },
    push(node, init = {}) {
      const f = { node, cursor: 0 };
      if (node.init) node.init(ctx, f);
      Object.assign(f, init);
      stack.push(f);
    },
    pop() {
      if (stack.length > 1) stack.pop();
    },
    home() {
      stack.length = 1;
    },
    flash(lines) {
      flashLines = lines;
    },
  };

  const resetStack = () => {
    stack = [{ node: def.home, cursor: 0 }];
  };
  resetStack();

  const top = () => stack[stack.length - 1];
  const isOn = () => state.power === 'on';

  function shortcut(btn) {
    const sc = def.shortcuts[btn];
    if (sc.allowed && !sc.allowed(state)) return;
    const i = sc.pages.indexOf(top().node);
    const nextPage = sc.pages[(i + 1) % sc.pages.length];
    ctx.home();
    ctx.push(nextPage);
  }

  function press(btn) {
    if (btn === 'power') {
      if (isOn()) {
        ctx.update((s) => {
          s.power = 'off';
          def.powerOff?.(s);
        });
        flashLines = null;
        resetStack();
      }
      return;
    }
    if (!isOn()) return;
    if (flashLines) {
      flashLines = null; // any key dismisses a message
      return;
    }
    if (def.shortcuts?.[btn]) shortcut(btn);
    else top().node.press(btn, ctx, top());
    notify();
  }

  function hold(btn) {
    if (btn !== 'power') return press(btn);
    if (!isOn()) {
      ctx.update((s) => {
        s.power = 'on';
        def.powerOn?.(s);
      });
      resetStack();
    } else if (def.powerHoldWhileOn) {
      ctx.update((s) => def.powerHoldWhileOn(s));
    }
  }

  // No key pressed for a while: back to the status screen.
  function idle() {
    if (stack.length > 1 || flashLines) {
      flashLines = null;
      ctx.home();
      notify();
    }
  }

  function clearFlash() {
    if (flashLines) {
      flashLines = null;
      notify();
    }
  }

  function render() {
    if (!isOn()) return { off: true, size: 'big', icons: false, lines: [] };
    let scr;
    if (flashLines) scr = { size: 'big', icons: false, lines: flashLines.map((t) => ({ text: t })) };
    else scr = top().node.render(ctx, top());
    if (scr.icons && def.iconsFor) scr.iconState = def.iconsFor(state);
    return scr;
  }

  // For the "?" overlay: the path of open menus and the entry in focus.
  function where() {
    const frames = stack.slice(1);
    const t = top();
    const focus = t.node.focus ? t.node.focus(t) : t.node;
    const path = frames.map((f) => f.node.label).filter(Boolean);
    if (focus !== t.node && focus.label) path.push(focus.label);
    return { path, node: focus, flashing: Boolean(flashLines) };
  }

  return {
    press,
    hold,
    idle,
    clearFlash,
    render,
    where,
    get state() {
      return state;
    },
    hasFlash: () => Boolean(flashLines),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
