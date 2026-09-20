// CSV bulk-loader for lights.
//
// Usage: node scripts/load-csv.js <path/to/file.csv>
//
// Expected columns (header row required): brand,model,type,wattage,power_unit
//   - wattage accepts set shorthand: "4k", "1.2k", "800", "800w"
//   - power_unit must be one of: none, ballast, external driver
//   - brands and light_types are created automatically if they don't exist
//   - existing (brand, model) rows are updated in place (upsert), so this
//     script is safe to re-run against an updated CSV
//
// Optional column: nicknames — semicolon-separated slang/crew names for the
// fixture, e.g. "Mickey;Molewatt". If the column is present, a row's
// nicknames fully replace whatever's currently stored for that light (empty
// cell clears them). If the column is absent entirely, existing nicknames
// are left untouched.
import fs from 'node:fs';
import { openDb } from './lib/db.js';
import { parseWattage } from './lib/wattage.js';

const VALID_POWER_UNITS = new Set(['none', 'ballast', 'external driver']);

function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
    if (lines.length === 0) return { header: [], rows: [] };

    const parseLine = (line) => {
        const fields = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (inQuotes) {
                if (c === '"') {
                    if (line[i + 1] === '"') {
                        cur += '"';
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    cur += c;
                }
            } else if (c === '"') {
                inQuotes = true;
            } else if (c === ',') {
                fields.push(cur);
                cur = '';
            } else {
                cur += c;
            }
        }
        fields.push(cur);
        return fields.map((f) => f.trim());
    };

    const header = parseLine(lines[0]).map((h) => h.toLowerCase());
    const rows = lines.slice(1).map(parseLine);
    return { header, rows };
}

function main() {
    const csvPath = process.argv[2];
    if (!csvPath) {
        console.error('Usage: node scripts/load-csv.js <path/to/file.csv>');
        process.exit(1);
    }

    const text = fs.readFileSync(csvPath, 'utf8');
    const { header, rows } = parseCsv(text);

    const required = ['brand', 'model', 'type', 'wattage', 'power_unit'];
    for (const col of required) {
        if (!header.includes(col)) {
            console.error(`CSV is missing required column: ${col}`);
            process.exit(1);
        }
    }
    const idx = Object.fromEntries(required.map((col) => [col, header.indexOf(col)]));
    const hasNicknames = header.includes('nicknames');
    if (hasNicknames) idx.nicknames = header.indexOf('nicknames');

    const db = openDb();

    const getBrandId = db.prepare('SELECT brand_id FROM brands WHERE name = ?');
    const insertBrand = db.prepare('INSERT INTO brands (name) VALUES (?)');
    const getTypeId = db.prepare('SELECT type_id FROM light_types WHERE name = ?');
    const insertType = db.prepare('INSERT INTO light_types (name) VALUES (?)');
    const upsertLight = db.prepare(`
        INSERT INTO lights (brand_id, type_id, model, wattage, power_unit)
        VALUES (@brand_id, @type_id, @model, @wattage, @power_unit)
        ON CONFLICT (brand_id, model) DO UPDATE SET
            type_id = excluded.type_id,
            wattage = excluded.wattage,
            power_unit = excluded.power_unit
    `);
    const getLightId = db.prepare('SELECT light_id FROM lights WHERE brand_id = ? AND model = ?');
    const deleteNicknames = db.prepare('DELETE FROM light_nicknames WHERE light_id = ?');
    const insertNickname = db.prepare('INSERT OR IGNORE INTO light_nicknames (light_id, nickname) VALUES (?, ?)');

    const brandCache = new Map();
    const typeCache = new Map();

    function resolveBrandId(name) {
        if (brandCache.has(name)) return brandCache.get(name);
        let row = getBrandId.get(name);
        if (!row) {
            const info = insertBrand.run(name);
            brandCache.set(name, info.lastInsertRowid);
            return info.lastInsertRowid;
        }
        brandCache.set(name, row.brand_id);
        return row.brand_id;
    }

    function resolveTypeId(name) {
        if (typeCache.has(name)) return typeCache.get(name);
        let row = getTypeId.get(name);
        if (!row) {
            const info = insertType.run(name);
            typeCache.set(name, info.lastInsertRowid);
            return info.lastInsertRowid;
        }
        typeCache.set(name, row.type_id);
        return row.type_id;
    }

    let inserted = 0;
    let errors = 0;

    const loadAll = db.transaction((rows) => {
        rows.forEach((fields, i) => {
            const lineNo = i + 2; // header is line 1
            const brand = fields[idx.brand];
            const model = fields[idx.model];
            const type = fields[idx.type];
            const powerUnit = fields[idx.power_unit].toLowerCase();
            const wattageRaw = fields[idx.wattage];

            if (!brand || !model || !type) {
                console.error(`Line ${lineNo}: missing brand/model/type, skipping`);
                errors++;
                return;
            }
            if (!VALID_POWER_UNITS.has(powerUnit)) {
                console.error(
                    `Line ${lineNo}: invalid power_unit "${powerUnit}" (must be none/ballast/external driver), skipping`
                );
                errors++;
                return;
            }

            let wattage;
            try {
                wattage = parseWattage(wattageRaw);
            } catch (e) {
                console.error(`Line ${lineNo}: ${e.message}, skipping`);
                errors++;
                return;
            }
            if (wattage === null) {
                console.error(`Line ${lineNo}: missing wattage, skipping`);
                errors++;
                return;
            }

            const brandId = resolveBrandId(brand);
            const typeId = resolveTypeId(type);

            upsertLight.run({
                brand_id: brandId,
                type_id: typeId,
                model,
                wattage,
                power_unit: powerUnit,
            });
            // last_insert_rowid() isn't updated when ON CONFLICT DO UPDATE
            // takes the update path, so look the id up by its unique key.
            const lightId = getLightId.get(brandId, model).light_id;

            if (hasNicknames) {
                const raw = fields[idx.nicknames] || '';
                const nicknames = [...new Set(raw.split(';').map((n) => n.trim()).filter(Boolean))];
                deleteNicknames.run(lightId);
                for (const nickname of nicknames) {
                    insertNickname.run(lightId, nickname);
                }
            }

            inserted++;
        });
    });

    loadAll(rows);
    db.close();

    console.log(`Loaded ${inserted} fixture(s) from ${csvPath}${errors ? `, ${errors} row(s) skipped` : ''}`);
    if (errors > 0) process.exitCode = 1;
}

main();
