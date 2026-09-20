// Scans photos/ and (re)populates light_photos from filenames.
//
// Filename convention: <brand-model-slug>-<view>.jpg (or .jpeg/.png/.webp)
//   e.g. photos/arri-m40-front.jpg, photos/mole-richardson-tener-tenner-10k-side.jpg
//
// Matching is done by longest-prefix match against every light's
// slugify(brand)-slugify(model) so hyphens inside brand/model names (e.g.
// "Mole-Richardson") don't create ambiguity. The remainder after the light's
// slug becomes the "view" and is used as the caption.
//
// This script treats photos/ as the source of truth for light_photos: it
// clears and rebuilds the table from what's on disk each run, so it's safe
// to re-run after adding/removing photo files. The first "front" view for a
// light is marked primary; failing that, the alphabetically-first view.
import fs from 'node:fs';
import path from 'node:path';
import { openDb, PHOTOS_DIR } from './lib/db.js';
import { slugify } from './lib/slug.js';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function captionFromView(view) {
    if (!view) return null;
    const words = view.split('-').filter(Boolean);
    if (words.length === 0) return null;
    return words.map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

function main() {
    if (!fs.existsSync(PHOTOS_DIR)) {
        console.error(`Photos directory not found: ${PHOTOS_DIR}`);
        process.exit(1);
    }

    const db = openDb();

    const lights = db
        .prepare(
            `SELECT l.light_id, b.name AS brand, l.model
             FROM lights l JOIN brands b ON b.brand_id = l.brand_id`
        )
        .all()
        .map((l) => ({ ...l, slug: `${slugify(l.brand)}-${slugify(l.model)}` }));

    // Longest slug first so a more specific match wins over a shorter prefix
    // (e.g. "arri-650-plus" before "arri-650").
    lights.sort((a, b) => b.slug.length - a.slug.length);

    const files = fs
        .readdirSync(PHOTOS_DIR)
        .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
        .sort();

    const matches = []; // { light_id, photo_path, caption, view }
    const unmatched = [];

    for (const file of files) {
        const ext = path.extname(file);
        const base = path.basename(file, ext).toLowerCase();

        const light = lights.find((l) => base === l.slug || base.startsWith(l.slug + '-'));
        if (!light) {
            unmatched.push(file);
            continue;
        }

        const view = base === light.slug ? '' : base.slice(light.slug.length + 1);
        matches.push({
            light_id: light.light_id,
            photo_path: file,
            caption: captionFromView(view),
            view,
        });
    }

    // Pick one primary per light: prefer a view containing "front", else the
    // alphabetically-first file for that light.
    const byLight = new Map();
    for (const m of matches) {
        if (!byLight.has(m.light_id)) byLight.set(m.light_id, []);
        byLight.get(m.light_id).push(m);
    }
    const primaryPhotoPaths = new Set();
    for (const group of byLight.values()) {
        const front = group.find((m) => m.view.includes('front'));
        const chosen = front || group[0];
        primaryPhotoPaths.add(chosen.photo_path);
    }

    const rebuild = db.transaction(() => {
        db.prepare('DELETE FROM light_photos').run();
        const insert = db.prepare(`
            INSERT INTO light_photos (light_id, photo_path, caption, is_primary)
            VALUES (@light_id, @photo_path, @caption, @is_primary)
        `);
        for (const m of matches) {
            insert.run({
                light_id: m.light_id,
                photo_path: m.photo_path,
                caption: m.caption,
                is_primary: primaryPhotoPaths.has(m.photo_path) ? 1 : 0,
            });
        }
    });
    rebuild(matches);
    db.close();

    console.log(`Matched ${matches.length} photo(s) across ${byLight.size} fixture(s).`);
    if (unmatched.length) {
        console.log(`\n${unmatched.length} file(s) did not match any brand-model in the database:`);
        for (const f of unmatched) console.log(`  ${f}`);
    }
}

main();
