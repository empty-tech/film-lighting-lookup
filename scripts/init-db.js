// Creates db/lights.db from db/schema.sql. Safe to re-run — statements are
// idempotent (CREATE TABLE/INDEX IF NOT EXISTS).
import fs from 'node:fs';
import { openDb, SCHEMA_PATH } from './lib/db.js';

const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
const db = openDb();
db.exec(schema);
db.close();

console.log('Initialized db/lights.db');
