// Flags light_photos rows whose photo_path doesn't exist under photos/.
// Exits non-zero if any are found, so it can gate the build step.
import fs from 'node:fs';
import path from 'node:path';
import { openDb, PHOTOS_DIR } from './lib/db.js';

function main() {
    const db = openDb();
    const rows = db
        .prepare(
            `SELECT lp.photo_path, l.model, b.name AS brand
             FROM light_photos lp
             JOIN lights l ON l.light_id = lp.light_id
             JOIN brands b ON b.brand_id = l.brand_id`
        )
        .all();
    db.close();

    const missing = rows.filter((r) => !fs.existsSync(path.join(PHOTOS_DIR, r.photo_path)));

    if (missing.length === 0) {
        console.log(`OK — all ${rows.length} photo_path entries resolve to files in photos/.`);
        return;
    }

    console.error(`${missing.length} of ${rows.length} photo_path entries point at missing files:\n`);
    for (const m of missing) {
        console.error(`  ${m.brand} ${m.model}: ${m.photo_path}`);
    }
    process.exitCode = 1;
}

main();
