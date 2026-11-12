// Which fixtures have an emulator. Keys are `${brand}|${model}` exactly as in
// db/seed.csv / data.json, so the fixture app can look them up directly.

import { asteraFp } from './astera-fp.js';

const REGISTRY = {
  'Astera|Titan Tube': () => asteraFp('titan'),
  'Astera|Helios Tube': () => asteraFp('helios'),
  'Astera|Hyperion Tube': () => asteraFp('hyperion'),
};

const keyOf = (light) => `${light.brand}|${light.model}`;

export const hasEmulator = (light) => keyOf(light) in REGISTRY;

// Returns a fresh fixture definition (each emulator gets its own state).
export const getEmulator = (light) => REGISTRY[keyOf(light)]?.() ?? null;
