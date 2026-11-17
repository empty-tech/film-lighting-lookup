// Button-sequence tests for the Astera FP-series emulator. Each test presses
// buttons the way you would on the light and checks what the screen shows.
// When a real light disagrees with the emulator, fix the fixture data and
// add a case here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmulator } from '../../pwa/emulator/engine/emulator.js';
import { asteraFp } from '../../pwa/emulator/fixtures/astera-fp.js';
import { hasEmulator, getEmulator } from '../../pwa/emulator/fixtures/index.js';

const lines = (emu) => emu.render().lines.map((l) => l.text);

function titanOn() {
  const emu = createEmulator(asteraFp('titan'));
  emu.hold('power');
  return emu;
}

// Press a sequence like 'menu plus plus enter plus*5'.
function run(emu, seq) {
  for (const tok of seq.split(/\s+/).filter(Boolean)) {
    const [btn, n = '1'] = tok.split('*');
    for (let i = 0; i < Number(n); i++) emu.press(btn);
  }
}

test('screen is dark until power is held', () => {
  const emu = createEmulator(asteraFp('titan'));
  assert.equal(emu.render().off, true);
  emu.press('power'); // a short press does not turn it on
  assert.equal(emu.render().off, true);
  emu.press('menu');
  assert.equal(emu.render().off, true);
  emu.hold('power');
  assert.deepEqual(lines(emu), ['INPUT: DETECTING', '']);
});

test('short power press turns the light off', () => {
  const emu = titanOn();
  run(emu, 'menu plus');
  emu.press('power');
  assert.equal(emu.render().off, true);
  emu.hold('power');
  assert.deepEqual(lines(emu), ['INPUT: DETECTING', ''], 'boots back to the status screen');
});

test('holding power while on enters Blue Mode', () => {
  const emu = titanOn();
  emu.hold('power');
  assert.equal(emu.state.blueMode, true);
  assert.equal(emu.state.power, 'on');
});

test('main menu cycles through all entries and back to the status screen', () => {
  const emu = titanOn();
  emu.press('menu');
  const seen = [];
  for (let i = 0; i < 12; i++) {
    seen.push(lines(emu)[1]);
    emu.press('plus');
  }
  // Order as photographed on a Titan (emulators/astera/titan-tube/screens/).
  assert.deepEqual(seen, [
    'INPUT SELECT', 'STATIC COLOR', 'DMX ADDRESS', 'DMX SETTINGS', 'TURN BY 180',
    'UNBOND BLUETOOTH', 'UNPAIR CRMX', 'RUNTIME', 'STANDALONE', 'AC FAILURE', 'INFO',
    'RESET SETTINGS',
  ]);
  assert.equal(lines(emu)[0], 'INPUT: DETECTING', '+ past the last entry returns to status');
});

test('from the status screen: − opens RESET SETTINGS, ENTER opens DMX ADDRESS', () => {
  const emu = titanOn();
  emu.press('minus');
  assert.deepEqual(lines(emu), ['Main menu:', 'RESET SETTINGS']);
  emu.press('menu');
  emu.press('enter');
  assert.deepEqual(lines(emu), ['Main menu:', 'DMX ADDRESS']);
});

test('main menu screens show the battery icon row', () => {
  const emu = titanOn();
  assert.equal(emu.render().iconState.battery, 69);
  emu.press('menu');
  assert.ok(emu.render().iconState);
});

test('set DMX address 1 → 5, clamps at 1 and 512', () => {
  const emu = titanOn();
  run(emu, 'enter enter');
  assert.deepEqual(lines(emu), ['DMX ADDRESS', '1']);
  run(emu, 'minus plus*4');
  assert.deepEqual(lines(emu), ['DMX ADDRESS', '5']);
  run(emu, 'plus*600');
  assert.equal(lines(emu)[1], '512');
  run(emu, 'enter menu');
  assert.equal(emu.state.dmxAddress, 512);
  assert.deepEqual(lines(emu), ['INPUT: DETECTING', '']);
});

test('input select: choosing STANDALONE updates the status screen', () => {
  const emu = titanOn();
  run(emu, 'menu enter');
  assert.deepEqual(lines(emu), ['INPUT SELECT', 'AUTO']);
  run(emu, 'plus');
  assert.deepEqual(lines(emu), ['INPUT SELECT', 'STANDALONE']);
  run(emu, 'enter menu');
  assert.equal(lines(emu)[0], 'STANDALONE');
});

test('static color: entering latches STANDALONE, presets scroll, INDEX COLOR opens 0–255', () => {
  const emu = titanOn();
  run(emu, 'menu plus enter');
  assert.deepEqual(lines(emu), ['Static Color:', 'RED']);
  assert.equal(emu.state.latched, 'STANDALONE');
  run(emu, 'plus*13');
  assert.equal(lines(emu)[1], '6500K');
  run(emu, 'plus enter');
  assert.deepEqual(lines(emu), ['Index color:', '0']);
  run(emu, 'minus');
  assert.equal(lines(emu)[1], '0', 'clamps at 0');
});

test('DMX settings → dimmer curve', () => {
  const emu = titanOn();
  run(emu, 'menu plus*3 enter');
  assert.deepEqual(lines(emu), ['DMX Settings:', 'PIXELS']);
  run(emu, 'plus*3 enter');
  assert.deepEqual(lines(emu), ['Curve:', 'STANDARD']);
  run(emu, 'plus');
  assert.equal(emu.state.dimmerCurve, 'HALOGEN');
});

test('runtime runs 1h–20h, default 5h', () => {
  const emu = titanOn();
  run(emu, 'menu plus*7 enter');
  assert.deepEqual(lines(emu), ['RUNTIME', '5h']);
  run(emu, 'plus*30');
  assert.equal(lines(emu)[1], '20h');
});

test('info: radio PIN edit with +/- and MENU to move digits', () => {
  const emu = titanOn();
  run(emu, 'minus minus enter');
  assert.deepEqual(lines(emu), ['Radio PIN:', '0000']);
  run(emu, 'enter plus menu plus*2 menu menu minus enter');
  assert.equal(emu.state.radioPin, '1209');
  assert.deepEqual(lines(emu), ['Radio PIN:', '1209']);
  run(emu, 'plus');
  assert.equal(lines(emu)[0].slice(0, 16), 'AX1 Compatibilit');
});

test('reset settings: NO backs out, YES resets, keeps the radio PIN, unlinks CRMX', () => {
  const emu = titanOn();
  emu.state.crmxPaired = true; // no transmitter is simulated, so pair by hand
  run(emu, 'enter enter plus*9 enter menu'); // DMX 10
  run(emu, 'minus minus enter enter plus enter'); // PIN 1000
  run(emu, 'menu menu');
  assert.equal(emu.state.dmxAddress, 10);
  run(emu, 'minus enter');
  assert.deepEqual(lines(emu), ['ARE YOU SURE?', 'NO YES']);
  run(emu, 'enter');
  assert.equal(emu.state.dmxAddress, 10, 'NO keeps settings');
  run(emu, 'enter plus enter');
  assert.equal(emu.state.dmxAddress, 1);
  assert.equal(emu.state.radioPin, '1000');
  assert.equal(emu.state.crmxPaired, false, 'quick guide V2: RESET unlinks CRMX');
  assert.equal(lines(emu)[0], 'INPUT: DETECTING');
});

test('color palette button cycles HSI → static color → gel', () => {
  const emu = titanOn();
  emu.press('palette');
  let scr = emu.render();
  assert.equal(scr.size, 'small');
  assert.deepEqual(lines(emu), ['CCT : 5500 K', 'Green : 0.00', 'Hue : 0', 'Sat : 0%']);
  assert.equal(scr.lines[0].selected, true);
  assert.equal(scr.lines[1].selected, false);
  assert.equal(emu.state.inputSelect, 'STANDALONE');
  run(emu, 'plus*2 enter enter enter plus*25');
  assert.deepEqual(lines(emu), ['CCT : 5600 K', 'Green : 0.00', 'Hue : 0', 'Sat : 25%']);
  emu.press('palette');
  assert.deepEqual(lines(emu), ['Static Color:', 'Red']);
  emu.press('palette');
  assert.deepEqual(lines(emu), ['LEE Tungsten', '#002', 'Rose Pink']);
  assert.equal(emu.render().lines[0].selected, true);
  run(emu, 'enter plus');
  assert.equal(lines(emu)[1], '#003');
  emu.press('menu');
  assert.equal(lines(emu)[0], 'STANDALONE');
});

test('palette button does nothing when INPUT SELECT is a DMX source', () => {
  const emu = titanOn();
  run(emu, 'menu enter plus*3 enter menu'); // Wired DMX
  assert.equal(lines(emu)[0], 'XLR-DMX: NO LINK');
  emu.press('palette');
  assert.equal(lines(emu)[0], 'XLR-DMX: NO LINK');
});

test('brightness button: brightness then runtime', () => {
  const emu = titanOn();
  emu.press('brightness');
  assert.deepEqual(lines(emu), ['Brightness: 100%', 'Runtime : 5h']);
  run(emu, 'minus*40 enter plus*3');
  assert.deepEqual(lines(emu), ['Brightness: 60%', 'Runtime : 8h']);
});

test('unpair CRMX shows a message that the next key dismisses', () => {
  const emu = titanOn();
  run(emu, 'menu plus*6 enter');
  assert.deepEqual(lines(emu), ['UNPAIR CRMX', 'DONE']);
  emu.press('plus');
  assert.deepEqual(lines(emu), ['Main menu:', 'UNPAIR CRMX']);
});

test('idle timeout returns to the status screen', () => {
  const emu = titanOn();
  run(emu, 'menu plus*3 enter');
  emu.idle();
  assert.deepEqual(lines(emu), ['INPUT: DETECTING', '']);
});

test('TURN BY 180 is an OFF/ON setting; UNBOND BLUETOOTH shows a message', () => {
  const emu = titanOn();
  run(emu, 'menu plus*4 enter');
  assert.deepEqual(lines(emu), ['TURN BY 180', 'OFF']);
  run(emu, 'plus');
  assert.equal(emu.state.turned, 'ON');
  run(emu, 'enter plus enter');
  assert.deepEqual(lines(emu), ['UNBOND BLUETOOTH', 'DONE']);
});

test('menus carry a scroll key so the screen can slide between entries', () => {
  const emu = titanOn();
  emu.press('menu');
  assert.equal(emu.render().scroll, 'Main menu#0');
  emu.press('plus');
  assert.equal(emu.render().scroll, 'Main menu#1');
  assert.equal(emu.render().size, 'big');
});

test('where() reports the menu path and sources', () => {
  const emu = titanOn();
  run(emu, 'menu plus*3 enter plus*3');
  const w = emu.where();
  assert.deepEqual(w.path, ['Main menu', 'DMX SETTINGS', 'DIMMER CURVE']);
  assert.match(w.node.src, /§7\.15/);
});

test('registry matches fixture names in the database', () => {
  for (const model of ['Titan Tube', 'Helios Tube', 'Hyperion Tube']) {
    assert.ok(hasEmulator({ brand: 'Astera', model }), model);
  }
  assert.equal(hasEmulator({ brand: 'ARRI', model: 'SkyPanel S60-C' }), false);
  const helios = createEmulator(getEmulator({ brand: 'Astera', model: 'Helios Tube' }));
  helios.hold('power');
  run(helios, 'menu plus*3 enter enter');
  assert.deepEqual(lines(helios), ['Pixels:', '1']);
});
