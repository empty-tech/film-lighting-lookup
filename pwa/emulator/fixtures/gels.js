// Gel lists for the Astera colour-palette "Color Gel" screen.
//
// The Titan manual says the full list is on "page 55", which isn't in the
// 50-page V1 manual we have. These are real LEE / Rosco Cinegel numbers and
// names, but which gels the firmware actually includes (and in what order)
// is a guess until checked on a light.

export const LEE = [
  ['002', 'Rose Pink'], ['003', 'Lavender Tint'], ['004', 'Med Bastard Amber'],
  ['007', 'Pale Yellow'], ['008', 'Dark Salmon'], ['009', 'Pale Amber Gold'],
  ['010', 'Medium Yellow'], ['013', 'Straw Tint'], ['015', 'Deep Straw'],
  ['017', 'Surprise Peach'], ['019', 'Fire'], ['020', 'Medium Amber'],
  ['021', 'Gold Amber'], ['022', 'Dark Amber'], ['024', 'Scarlet'],
  ['026', 'Bright Red'], ['027', 'Medium Red'], ['035', 'Light Pink'],
  ['036', 'Medium Pink'], ['046', 'Dark Magenta'], ['048', 'Rose Purple'],
  ['049', 'Medium Purple'], ['052', 'Light Lavender'], ['058', 'Lavender'],
  ['061', 'Mist Blue'], ['063', 'Pale Blue'], ['068', 'Sky Blue'],
  ['071', 'Tokyo Blue'], ['079', 'Just Blue'], ['085', 'Deeper Blue'],
  ['088', 'Lime Green'], ['089', 'Moss Green'], ['090', 'Dk Yellow Green'],
  ['101', 'Yellow'], ['102', 'Light Amber'], ['104', 'Deep Amber'],
  ['105', 'Orange'], ['106', 'Primary Red'], ['110', 'Middle Rose'],
  ['113', 'Magenta'], ['115', 'Peacock Blue'], ['116', 'Med Blue-Green'],
  ['117', 'Steel Blue'], ['118', 'Light Blue'], ['119', 'Dark Blue'],
  ['120', 'Deep Blue'], ['121', 'LEE Green'], ['124', 'Dark Green'],
  ['126', 'Mauve'], ['128', 'Bright Pink'], ['132', 'Medium Blue'],
  ['134', 'Golden Amber'], ['135', 'Deep Golden Amber'], ['136', 'Pale Lavender'],
  ['137', 'Special Lavender'], ['138', 'Pale Green'], ['139', 'Primary Green'],
  ['141', 'Bright Blue'], ['147', 'Apricot'], ['148', 'Bright Rose'],
  ['151', 'Gold Tint'], ['152', 'Pale Gold'], ['154', 'Pale Rose'],
  ['158', 'Deep Orange'], ['162', 'Bastard Amber'], ['179', 'Chrome Orange'],
  ['180', 'Dark Lavender'], ['181', 'Congo Blue'], ['201', 'Full CT Blue'],
  ['202', 'Half CT Blue'], ['203', 'Quarter CT Blue'], ['204', 'Full CT Orange'],
  ['205', 'Half CT Orange'], ['206', 'Quarter CT Orange'], ['218', 'Eighth CT Blue'],
  ['223', 'Eighth CT Orange'], ['244', 'LEE Plus Green'], ['245', 'Half Plus Green'],
  ['246', 'Qtr Plus Green'], ['247', 'LEE Minus Green'], ['248', 'Half Minus Green'],
  ['249', 'Qtr Minus Green'],
];

export const ROSCO = [
  ['3202', 'Full Blue CTB'], ['3203', '3/4 Blue CTB'], ['3204', '1/2 Blue CTB'],
  ['3206', '1/3 Blue CTB'], ['3208', '1/4 Blue CTB'], ['3216', '1/8 Blue CTB'],
  ['3407', 'Full CTO'], ['3408', '1/2 CTO'], ['3409', '1/4 CTO'],
  ['3410', '1/8 CTO'], ['3304', 'Tough Plusgreen'], ['3315', '1/2 Plusgreen'],
  ['3316', '1/4 Plusgreen'], ['3308', 'Tough Minusgreen'], ['3313', '1/2 Minusgreen'],
  ['3314', '1/4 Minusgreen'],
];

export const GEL_TYPES = ['Lee Daylight', 'Lee Tungsten', 'Rosco Daylight', 'Rosco Tungsten'];

export const gelsFor = (type) => (type.startsWith('Lee') ? LEE : ROSCO);
