import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { database } from '../server/database.js';

const file = await readFile(new URL('../migrations/001_workspace.sql', import.meta.url), 'utf8');
const sql = database();
await sql.transaction(file.split(';').map(statement => statement.trim()).filter(Boolean).map(statement => sql.query(statement)));
console.log('Etsy çalışma alanı veritabanı hazır.');
