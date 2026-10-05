import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;

export const isDbConfigured = Boolean(databaseUrl && databaseUrl.startsWith('postgres'));

// Neon SQL client using neon HTTP driver
const sql = databaseUrl && databaseUrl.startsWith('postgres') ? neon(databaseUrl) : null;

// Drizzle instance initialized with Neon HTTP client and schema
export const db = sql ? drizzle(sql, { schema }) : null;
