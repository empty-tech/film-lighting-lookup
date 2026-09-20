// Exports lights.db to pwa/data.json — the dataset the PWA loads and caches
// for fully offline, client-side search. Run after db changes and after
// photos:resize (so pwa/photos/ matches what data.json references).
import fs from 'node:fs';
import { openDb, PWA_DATA_PATH } from './lib/db.js';

function main() {
    const db = openDb();

    const lights = db
        .prepare(
            `SELECT l.light_id, b.name AS brand, t.name AS type, l.model, l.wattage, l.power_unit
             FROM lights l
             JOIN brands b ON b.brand_id = l.brand_id
             JOIN light_types t ON t.type_id = l.type_id
             ORDER BY b.name, l.model`
        )
        .all();

    const photosByLight = new Map();
    for (const p of db
        .prepare('SELECT light_id, photo_path, caption, is_primary FROM light_photos ORDER BY is_primary DESC, photo_path')
        .all()) {
        if (!photosByLight.has(p.light_id)) photosByLight.set(p.light_id, []);
        photosByLight.get(p.light_id).push({
            path: `photos/${p.photo_path}`,
            caption: p.caption,
            isPrimary: !!p.is_primary,
        });
    }

    const nicknamesByLight = new Map();
    for (const n of db.prepare('SELECT light_id, nickname FROM light_nicknames ORDER BY nickname').all()) {
        if (!nicknamesByLight.has(n.light_id)) nicknamesByLight.set(n.light_id, []);
        nicknamesByLight.get(n.light_id).push(n.nickname);
    }

    const data = {
        generatedAt: new Date().toISOString(),
        brands: [...new Set(lights.map((l) => l.brand))].sort(),
        types: [...new Set(lights.map((l) => l.type))].sort(),
        lights: lights.map((l) => {
            const photos = photosByLight.get(l.light_id) || [];
            const primary = photos.find((p) => p.isPrimary) || photos[0] || null;
            return {
                id: l.light_id,
                brand: l.brand,
                model: l.model,
                type: l.type,
                wattage: l.wattage,
                powerUnit: l.power_unit,
                needsBallast: l.power_unit !== 'none',
                primaryPhoto: primary ? primary.path : null,
                photos,
                nicknames: nicknamesByLight.get(l.light_id) || [],
            };
        }),
    };

    db.close();
    fs.writeFileSync(PWA_DATA_PATH, JSON.stringify(data));
    console.log(`Wrote ${PWA_DATA_PATH} — ${data.lights.length} fixtures, ${photosByLight.size} with photos.`);
}

main();
