// Astera FP-series tubes (Titan, Helios, Hyperion): control panel + menus.
//
// Sources, all under emulators/astera/titan-tube/:
//   manual-v1-2020-08-26.pdf      "FP1 Titan Tube Technical Reference Manual V1";
//                                 section numbers in `src` refer to it.
//   quickguide-v2-2022-08-11.pdf  printed quick guide, V2.
//   screens/*.jpg                 photos of a real Titan Tube's screen.
// Where the photos disagree with the manual, the photos win (newer firmware).
// Anything in none of them is marked `guess` with what was assumed. Helios and
// Hyperion reuse the Titan tree; see emulators/SOURCES.md.

import { menu, choice, number, readout, digitsEditor, confirm, action, editor, screen, pad } from '../engine/nodes.js';
import { GEL_TYPES, gelsFor } from './gels.js';

const M = (s) => `Titan manual ${s}`;
const QG = (s) => `Titan quick guide V2 ${s}`;
const PH = (file) => `Titan photo (screens/${file})`;

// §7.13.1 Predefined Colors (BLACK is in the table but not the §9 diagram).
const PRESETS = [
  'RED', 'ORANGE', 'YELLOW', 'GREEN', 'CYAN', 'BLUE', 'VIOLET', 'PINK', 'BLACK',
  '2700K', '3200K', '4000K', '5500K', '6500K',
];
const titleCase = (s) => s.charAt(0) + s.slice(1).toLowerCase();

// §7.18.1 Predefined Programs, names as in the §9 diagram.
const PROGRAMS = [
  'ONE COLOR STATIC', 'TWO COLOR STATIC', 'THREE COLOR STATIC', 'FOUR COLOR STATIC',
  'ONE COLOR FADE', 'TWO COLOR FADE', 'THREE COLOR FADE', 'FOUR COLOR FADE',
  'SIMPLE RUNNING', 'DOUBLE RUNNING', 'TWO COLOR RUNNING', 'FLAG RUNNING',
  'DOUBLE FLAG RUNNING', 'SPIRAL FOUR COLORS', 'SPIRAL TWO COLORS', 'RAINBOW', 'FIRE',
];

// §7.12 Input Select, in the order the text describes them.
const INPUTS = ['AUTO', 'STANDALONE', 'APP CONTROL', 'Wired DMX', 'ART3 DMX', 'CRMX wirel. DMX'];

// Standalone SPEED runs 0:0.09 … 9:10.00 (m:ss.cc) per §9; the steps between
// are a guess.
const SPEEDS = [
  0.09, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 7.5, 10, 15,
  20, 30, 45, 60, 90, 120, 180, 240, 300, 420, 550,
];
const fmtSpeed = (sec) => `${Math.floor(sec / 60)}:${(sec % 60).toFixed(2)}`;

const MODELS = {
  titan: { name: 'Titan Tube', mark: 'TITAN', pixels: [1, 4, 8, 16], derived: false },
  helios: { name: 'Helios Tube', mark: 'HELIOS', pixels: [1, 2, 4, 8], derived: true },
  hyperion: { name: 'Hyperion Tube', mark: 'HYPERION', pixels: [1, 4, 8, 16], derived: true },
};

function defaults() {
  return {
    power: 'off',
    blueMode: false,
    inputSelect: 'AUTO',
    latched: null, // source AUTO has latched onto since power-up
    dmxAddress: 1,
    pixels: 1,
    dmxProfile: 'RGB S',
    strobe: 'OFF',
    dimmerCurve: 'STANDARD', // §7.15 default
    dmxFail: 'HOLD',
    runtime: 5, // §6: "By default, it is set to 5h"
    acFail: 'NO ACTION',
    staticColor: { kind: 'preset', name: 'RED', index: 0, rgb: [255, 255, 255] },
    standalone: {
      program: 'ONE COLOR STATIC',
      intensity: 100,
      speed: 1,
      fade: 100,
      colors: ['RED', 'GREEN', 'BLUE', '3200K'].map((name) => ({ kind: 'preset', name, index: 0, rgb: [255, 255, 255] })),
      setAddress: 1,
      setSize: 1,
      posInSet: 1,
      group: 1,
    },
    // What the light is showing after the colour-palette button was used.
    colorSource: 'standalone', // standalone | hsi | preset | gel
    hsi: { cct: 5500, green: 0, hue: 0, sat: 0 },
    quickPreset: 'RED',
    gel: { type: 'LEE Tungsten', idx: 0 },
    turned: 'OFF', // TURN BY 180
    brightness: 100,
    ax1Compat: 'DISABLED',
    // Not reset by RESET SETTINGS (§7.22):
    radioPin: '0000',
    crmxPaired: false,
    // Simulated hardware readouts:
    battery: 69,
    onAC: false,
    hours: 1,
  };
}

// STATIC COLOR tree (§7.13). Used for the main-menu entry and for the four
// standalone palette colours (§9: "see above STATIC COLOR").
function staticColorTree({ label, title, at, onEnter }) {
  const index = number({
    label: 'INDEX COLOR', title: 'Index color:', min: 0, max: 255,
    get: (s) => at(s).index,
    set: (s, v) => Object.assign(at(s), { kind: 'index', index: v }),
    src: M('§7.13, §9'),
    guess: 'Screen title "Index color:" is assumed; the manual only shows the 0–255 range.',
  });
  const rgbPart = (i, name) => number({
    label: name, title: `${titleCase(name)}:`, min: 0, max: 255,
    get: (s) => at(s).rgb[i],
    set: (s, v) => { at(s).kind = 'rgb'; at(s).rgb[i] = v; },
    src: M('§9'),
    guess: 'Screen title is assumed.',
  });
  const custom = menu({
    label: 'CUSTOM COLOR', title: 'Custom Color:',
    items: [rgbPart(0, 'RED'), rgbPart(1, 'GREEN'), rgbPart(2, 'BLUE')],
    src: M('§7.13, §9'),
  });
  return choice({
    label, title,
    options: [...PRESETS.map((p) => ({ label: p, value: p })), index, custom],
    get: (s) => (at(s).kind === 'preset' ? at(s).name : null),
    set: (s, v) => Object.assign(at(s), { kind: 'preset', name: v }),
    onEnter,
    src: M('§7.13'),
    guess: 'Colours apply as you scroll; ENTER or MENU go back (the §9 diagram shows both returning).',
  });
}

export function asteraFp(modelKey) {
  const model = MODELS[modelKey];

  const inputSelect = choice({
    label: 'INPUT SELECT',
    options: INPUTS.map((v) => ({ label: v, value: v })),
    get: (s) => s.inputSelect,
    set: (s, v) => {
      s.inputSelect = v;
      s.latched = null; // §7.12: changing it manually clears the latch
    },
    src: M('§7.12'),
    guess: 'Entry order follows the text; the older §9 diagram lists AUTO, CRMX, Astera wirel. DMX, XLR DMX, REMOTE CONTROL, STANDALONE.',
  });

  const staticColor = staticColorTree({
    label: 'STATIC COLOR', title: 'Static Color:',
    at: (s) => s.staticColor,
    // §7.13: entering clears standalone settings and latches STANDALONE.
    onEnter: (ctx) => ctx.update((s) => {
      s.standalone = defaults().standalone;
      s.latched = 'STANDALONE';
      s.colorSource = 'preset';
    }),
  });

  const dmxAddress = number({
    label: 'DMX ADDRESS', min: 1, max: 512,
    get: (s) => s.dmxAddress, set: (s, v) => { s.dmxAddress = v; },
    src: M('§7.11, §9'),
    guess: 'Screen title "DMX ADDRESS" is assumed.',
  });

  const listChoice = (label, title, values, key, src, guess) => choice({
    label, title,
    options: values.map((v) => ({ label: String(v), value: v })),
    get: (s) => s[key], set: (s, v) => { s[key] = v; }, src, guess,
  });

  const dmxSettings = menu({
    label: 'DMX SETTINGS', title: 'DMX Settings:',
    items: [
      listChoice('PIXELS', 'Pixels:', model.pixels, 'pixels', M('§7.14'),
        model.derived ? `Pixel counts for the ${model.name} are a guess; the Titan has 1/4/8/16.` : 'Screen title assumed.'),
      listChoice('DMX PROFILE', 'DMX Profile:',
        ['RGB S', 'RGBW S', 'RGBAW S', 'RGB CCT DIM IND S', 'EFFECT MODE FIX', 'EFFECT MODE RGB'],
        'dmxProfile', M('§7.14, §9 (as "DMX TABLE")'),
        'Only the profiles drawn in the §9 diagram; newer firmware has more.'),
      listChoice('STROBE', 'Strobe:', ['ON', 'OFF'], 'strobe', M('§7.14, §9'),
        '§8.15.2 mentions single/multiple strobe; the panel diagram only shows ON/OFF.'),
      listChoice('DIMMER CURVE', 'Curve:', ['FAST', 'STANDARD', 'HALOGEN', 'THEATER', 'TV'], 'dimmerCurve', M('§7.15')),
      listChoice('DMX FAIL', 'DMX FAIL', ['HOLD', 'EMERGENCY LIGHT', 'BLACKOUT', 'STANDALONE'], 'dmxFail', M('§7.20, §9')),
    ],
    src: M('§7.14'),
  });

  const unpair = action({
    label: 'UNPAIR CRMX',
    run: (ctx) => {
      ctx.update((s) => { s.crmxPaired = false; });
      ctx.flash(['UNPAIR CRMX', 'DONE']);
    },
    src: M('§7.17'),
    guess: 'The manual says "go to UNPAIR CRMX and press enter"; the confirmation text "DONE" is invented.',
  });

  // Both are in the main menu on the photographed Titan but not in the 2020
  // manual; what they do inside is not documented.
  const turnBy180 = listChoice('TURN BY 180', 'TURN BY 180', ['OFF', 'ON'], 'turned', PH('menu-05-turn-by-180.jpg'),
    'The menu entry is real. Assumed to be an OFF/ON setting that flips the tube end-for-end (pixel order); the screens inside are invented.');

  const unbondBluetooth = action({
    label: 'UNBOND BLUETOOTH',
    run: (ctx) => ctx.flash(['UNBOND BLUETOOTH', 'DONE']),
    src: PH('menu-06-unbond-bluetooth.jpg'),
    guess: 'The menu entry is real. That ENTER unbonds straight away and shows "DONE" is invented.',
  });

  const runtime = number({
    label: 'RUNTIME', min: 1, max: 20, format: (v) => `${v}h`,
    get: (s) => s.runtime, set: (s, v) => { s.runtime = v; },
    src: M('§7.16'),
  });

  const sa = (s) => s.standalone;
  const pct = (v) => `${v}%`;
  const standalone = menu({
    label: 'STANDALONE', title: 'Standalone:',
    items: [
      choice({
        label: 'PROGRAM', title: 'Program:', options: PROGRAMS.map((p) => ({ label: p, value: p })),
        get: (s) => sa(s).program, set: (s, v) => { sa(s).program = v; },
        src: M('§7.18.1'), guess: 'Screen title assumed. Long names (e.g. DOUBLE FLAG RUNNING) are cut at 16 characters.',
      }),
      number({ label: 'INTENSITY', title: 'Intensity:', min: 0, max: 100, format: pct, get: (s) => sa(s).intensity, set: (s, v) => { sa(s).intensity = v; }, src: M('§7.18, §9') }),
      number({ label: 'SPEED', title: 'Speed:', values: SPEEDS, format: fmtSpeed, get: (s) => sa(s).speed, set: (s, v) => { sa(s).speed = v; }, src: M('§9'), guess: 'Range is from the manual; the step sizes are a guess.' }),
      number({ label: 'FADE', title: 'Fade:', min: 0, max: 100, format: pct, get: (s) => sa(s).fade, set: (s, v) => { sa(s).fade = v; }, src: M('§7.18, §9') }),
      ...[0, 1, 2, 3].map((i) => staticColorTree({ label: `COLOR C${i + 1}`, title: `Color C${i + 1}:`, at: (s) => sa(s).colors[i] })),
      number({ label: 'SET ADDRESS', title: 'Set address:', min: 0, max: 255, get: (s) => sa(s).setAddress, set: (s, v) => { sa(s).setAddress = v; }, src: M('§9') }),
      number({ label: 'SET SIZE', title: 'Set size:', min: 1, max: 32, get: (s) => sa(s).setSize, set: (s, v) => { sa(s).setSize = v; }, src: M('§9') }),
      number({ label: 'POS IN SET', title: 'Pos in set:', min: 1, max: 32, get: (s) => sa(s).posInSet, set: (s, v) => { sa(s).posInSet = v; }, src: M('§9') }),
      number({ label: 'GROUP ADDRESS', title: 'Group address:', min: 1, max: 4, get: (s) => sa(s).group, set: (s, v) => { sa(s).group = v; }, src: M('§9') }),
    ],
    src: M('§7.18, §9'),
  });

  const acFail = listChoice('AC FAILURE', 'AC FAILURE', ['NO ACTION', 'BLACKOUT', 'EMERGENCY LIGHT'], 'acFail', M('§7.19'));

  const info = menu({
    label: 'INFO', showValues: true,
    items: [
      readout({
        label: 'Radio PIN:', value: (s) => s.radioPin, src: M('§7.21'),
        edit: digitsEditor({ label: 'Radio PIN', title: 'Radio PIN:', get: (s) => s.radioPin, set: (s, v) => { s.radioPin = v; }, src: M('§7.21') }),
      }),
      choice({
        label: 'AX1 Compatibility', options: ['ENABLED', 'DISABLED'].map((v) => ({ label: v, value: v })),
        get: (s) => s.ax1Compat, set: (s, v) => { s.ax1Compat = v; }, src: M('§7.21'),
        guess: 'The title is 17 characters, so it is cut at 16. How it is toggled (ENTER, then +/-) is assumed.',
      }),
      readout({ label: 'Serial number:', value: () => '018-04213 4357', src: M('§7.21'), guess: 'Placeholder serial.' }),
      readout({ label: 'Firmware version', value: () => '5.2.20.U HW001', src: M('§7.21'), guess: 'Version string copied from the manual example.' }),
      readout({ label: 'Power-on hours:', value: (s) => `${pad(s.hours, 5)}h`, src: M('§7.21') }),
      readout({ label: 'RF link:', value: () => '-36.0dBm -0.0ppm', src: M('§7.21'), guess: 'Manual example value; the real light shows live signal data.' }),
      readout({ label: 'CRMX Version:', value: () => 'V1.0.5.0', src: M('§7.21') }),
      readout({ label: 'Battery state:', value: (s) => `${s.battery}%`, src: M('§7.21') }),
      readout({ label: 'Battery Cycles:', value: () => '003', src: M('§7.21') }),
      readout({ label: 'Calibration:', value: () => '2015-04-20-0001', src: M('§7.21') }),
    ],
    src: M('§7.21'),
  });

  const reset = confirm({
    label: 'RESET SETTINGS',
    onYes: (ctx) => {
      // Quick guide §7: "RESET to unlink CRMX. Sets Input Select to AUTO and
      // runtime to 5h." (The 2020 manual said CRMX pairing survives a reset.)
      ctx.update((s) => {
        const keep = { power: s.power, radioPin: s.radioPin, battery: s.battery, onAC: s.onAC, hours: s.hours };
        Object.assign(s, defaults(), keep);
      });
      ctx.home();
    },
    src: `${M('§7.22, §9')}, ${QG('§7')}`,
    guess: 'Which of NO/YES is selected first, and that +/- switch between them, is assumed.',
  });

  const mainMenu = menu({
    label: 'Main menu', title: 'Main menu:', exitAtEnds: true, icons: true,
    items: [inputSelect, staticColor, dmxAddress, dmxSettings, turnBy180, unbondBluetooth, unpair, runtime, standalone, acFail, info, reset],
    src: `${M('§7.11, §9')}; order checked against ${PH('menu-*.jpg')}`,
  });

  // §7.10 Status screen.
  const activeSource = (s) => (s.inputSelect === 'AUTO' ? s.latched : s.inputSelect);
  const statusLine1 = (s) => {
    switch (activeSource(s)) {
      case null: return 'INPUT: DETECTING';
      case 'STANDALONE': return 'STANDALONE';
      case 'APP CONTROL': return 'APP CONTROL';
      case 'CRMX wirel. DMX': return 'CRMX: NO LINK';
      case 'ART3 DMX': return 'ART3: NO LINK';
      case 'Wired DMX': return 'XLR-DMX: NO LINK';
      default: return '';
    }
  };
  const home = {
    kind: 'home', label: 'Status screen', icons: true,
    src: `${M('§7.10')}, ${PH('status-crmx-no-link.jpg')}`,
    guess: 'No transmitter or app is simulated, so DMX inputs show NO LINK. "CRMX: NO LINK" is from a photo; "XLR-DMX: NO LINK", "ART3: NO LINK" and "INPUT: DETECTING" are assumed. The photo shows no second line; the manual\'s "SET:001 DMX:001" line may only appear with a signal.',
    render: (ctx) => screen([statusLine1(ctx.state), ''], { icons: true }),
    press(btn, ctx) {
      // §7.8 / §9: MENU or + enters the main menu at its first entry,
      // − at its last (RESET SETTINGS), ENTER jumps to DMX ADDRESS.
      if (btn === 'menu' || btn === 'plus') ctx.push(mainMenu, { cursor: 0 });
      else if (btn === 'minus') ctx.push(mainMenu, { cursor: mainMenu.items.length - 1 });
      else if (btn === 'enter') ctx.push(mainMenu, { cursor: mainMenu.items.indexOf(dmxAddress) });
    },
  };

  // §7.23 Colour palette button: HSI → static colour → gel, cycling.
  const toStandalone = (s, source) => {
    s.inputSelect = 'STANDALONE';
    s.latched = null;
    s.colorSource = source;
  };
  const hsiPage = editor({
    label: 'Palette: CCT / Hue / Sat',
    onShow: (ctx) => ctx.update((s) => toStandalone(s, 'hsi')),
    lines: [
      { text: (s) => `CCT : ${s.hsi.cct} K`, field: { min: 1750, max: 20000, step: 50, get: (s) => s.hsi.cct, set: (s, v) => { s.hsi.cct = v; } } },
      { text: (s) => `Green : ${s.hsi.green.toFixed(2)}`, field: { min: -1, max: 1, step: 0.01, get: (s) => s.hsi.green, set: (s, v) => { s.hsi.green = v; } } },
      { text: (s) => `Hue : ${s.hsi.hue}`, field: { min: 0, max: 360, step: 1, wrap: true, get: (s) => s.hsi.hue, set: (s, v) => { s.hsi.hue = v; } } },
      { text: (s) => `Sat : ${s.hsi.sat}%`, field: { min: 0, max: 100, step: 1, get: (s) => s.hsi.sat, set: (s, v) => { s.hsi.sat = v; } } },
    ],
    src: `${M('§7.23')}, ${PH('palette-1-hsi-cct.jpg')}`,
    guess: 'Layout, inverse selection bar and the 5500 K default are from photos. CCT steps of 50 K, a green range of ±1.00 in 0.01 steps and hue wrapping at 360 are assumed. A fourth palette press is assumed to loop back here.',
  });
  const presetPage = editor({
    label: 'Palette: static color',
    size: 'big',
    onShow: (ctx) => ctx.update((s) => toStandalone(s, 'preset')),
    lines: [
      { text: () => 'Static Color:' },
      { text: (s) => titleCase(s.quickPreset), field: { options: () => PRESETS, get: (s) => s.quickPreset, set: (s, v) => { s.quickPreset = v; } } },
    ],
    src: `${M('§7.23')}, ${PH('palette-2-static-color.jpg')}`,
  });
  const gelPage = editor({
    label: 'Palette: color gel',
    onShow: (ctx) => ctx.update((s) => toStandalone(s, 'gel')),
    lines: [
      { text: (s) => s.gel.type, field: { options: () => GEL_TYPES, get: (s) => s.gel.type, set: (s, v) => { s.gel.type = v; s.gel.idx = Math.min(s.gel.idx, gelsFor(v).length - 1); } } },
      { text: (s) => `#${gelsFor(s.gel.type)[s.gel.idx][0]}`, field: { options: (s) => gelsFor(s.gel.type).map((_, i) => i), get: (s) => s.gel.idx, set: (s, v) => { s.gel.idx = v; } } },
      { text: (s) => gelsFor(s.gel.type)[s.gel.idx][1] },
    ],
    src: `${M('§7.23')}, ${PH('palette-3-gel-lee-tungsten.jpg')}`,
    guess: 'Layout ("LEE Tungsten" / "#002" / "Rose Pink") is from a photo. The gel list is incomplete (the manual refers to a list on page 55 that isn\'t included), and the other gel-type names are assumed.',
  });

  // §7.24 Brightness button.
  const brightnessPage = editor({
    label: 'Brightness / Runtime',
    size: 'big',
    onShow: (ctx) => ctx.update((s) => { s.inputSelect = 'STANDALONE'; s.latched = null; }),
    lines: [
      { text: (s) => `Brightness: ${s.brightness}%`, field: { min: 0, max: 100, step: 1, get: (s) => s.brightness, set: (s, v) => { s.brightness = v; } } },
      { text: (s) => `Runtime : ${s.runtime}h`, field: { min: 1, max: 20, step: 1, get: (s) => s.runtime, set: (s, v) => { s.runtime = v; } } },
    ],
    src: `${M('§7.24')}, ${PH('brightness-runtime.jpg')}`,
    guess: '"Runtime : 3h" is from a photo. The brightness line wasn\'t readable; the manual\'s screens read "Brigntness", probably a typo, so the emulator shows "Brightness:" (without the space so 100% fits in 16 characters).',
  });

  // §7.23/7.24: the buttons do nothing unless INPUT SELECT is AUTO or STANDALONE.
  const paletteAllowed = (s) => s.inputSelect === 'AUTO' || s.inputSelect === 'STANDALONE';

  return {
    id: `astera-${modelKey}`,
    name: `Astera ${model.name}`,
    family: 'astera-fp',
    derivedNote: model.derived
      ? `Menus copied from the Titan Tube manual. Not yet checked against a real ${model.name}.`
      : null,
    panel: {
      mark: model.mark,
      buttons: [
        { id: 'power', label: 'Power', icon: 'power', holdMs: 3000 },
        { id: 'menu', label: 'MENU' },
        { id: 'minus', label: '−', aria: 'Minus', repeat: true },
        { id: 'plus', label: '+', aria: 'Plus', repeat: true },
        { id: 'enter', label: 'ENTER' },
        { id: 'palette', label: 'Color palette', icon: 'palette' },
        { id: 'brightness', label: 'Brightness', icon: 'sun' },
      ],
      hints: {
        off: 'Hold the power button for 3 seconds to turn the light on.',
        on: 'Tap power to turn off. Hold power for 3 seconds for Blue Mode (app pairing).',
      },
    },
    idleMs: 3 * 60 * 1000, // §7.10: back to status after three minutes
    initialState: defaults,
    home,
    shortcuts: {
      palette: { pages: [hsiPage, presetPage, gelPage], allowed: paletteAllowed },
      brightness: { pages: [brightnessPage], allowed: paletteAllowed },
    },
    powerOn(s) {
      // The AUTO latch and the STATIC COLOR latch last until the next power-up.
      s.latched = null;
      s.blueMode = false;
    },
    powerOff(s) {
      s.blueMode = false;
    },
    powerHoldWhileOn(s) {
      s.blueMode = true; // §7.9
    },
    // The photographed Titan shows only "NN%" and a battery at the top right.
    iconsFor: (s) => ({ battery: s.battery, onAC: s.onAC, tag: '' }),
  };
}
