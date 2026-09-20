-- Film lighting fixture lookup — schema
-- SQLite is the source of truth (lights.db). Everything else (JSON for the
-- PWA) is derived from this at build time.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS brands (
    brand_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS light_types (
    type_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS lights (
    light_id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL REFERENCES brands(brand_id),
    type_id INTEGER NOT NULL REFERENCES light_types(type_id),
    model TEXT NOT NULL,
    wattage INTEGER NOT NULL,
    power_unit TEXT NOT NULL CHECK (power_unit IN ('none', 'ballast', 'external driver')),
    UNIQUE (brand_id, model)
);

CREATE TABLE IF NOT EXISTS light_photos (
    photo_id INTEGER PRIMARY KEY AUTOINCREMENT,
    light_id INTEGER NOT NULL REFERENCES lights(light_id) ON DELETE CASCADE,
    photo_path TEXT NOT NULL,
    caption TEXT,
    is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1))
);

-- Slang/crew names for a fixture (e.g. "Mickey", "Brute") so search finds a
-- light by what people actually call it on set, not just brand/model.
CREATE TABLE IF NOT EXISTS light_nicknames (
    nickname_id INTEGER PRIMARY KEY AUTOINCREMENT,
    light_id INTEGER NOT NULL REFERENCES lights(light_id) ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    UNIQUE (light_id, nickname)
);

CREATE INDEX IF NOT EXISTS idx_lights_brand ON lights(brand_id);
CREATE INDEX IF NOT EXISTS idx_lights_type ON lights(type_id);
CREATE INDEX IF NOT EXISTS idx_lights_wattage ON lights(wattage);
CREATE INDEX IF NOT EXISTS idx_light_photos_light ON light_photos(light_id);
CREATE INDEX IF NOT EXISTS idx_light_nicknames_light ON light_nicknames(light_id);

-- Only one primary photo per light.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_primary_photo
    ON light_photos(light_id)
    WHERE is_primary = 1;
