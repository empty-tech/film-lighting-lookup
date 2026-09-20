import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DB_PATH = path.join(__dirname, '..', '..', 'db', 'lights.db');
export const SCHEMA_PATH = path.join(__dirname, '..', '..', 'db', 'schema.sql');
export const PHOTOS_DIR = path.join(__dirname, '..', '..', 'photos');
export const PWA_DATA_PATH = path.join(__dirname, '..', '..', 'pwa', 'data.json');
export const PWA_PHOTOS_DIR = path.join(__dirname, '..', '..', 'pwa', 'photos');

export function openDb() {
    const db = new Database(DB_PATH);
    db.pragma('foreign_keys = ON');
    return db;
}
