const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = process.env.DATABASE_URL;
let sql = null;

if (DATABASE_URL) {
  try { sql = neon(DATABASE_URL); } catch (e) {}
}

async function ensureTables() {
  if (!sql) return;
  try {
    await sql`CREATE TABLE IF NOT EXISTS app_state (id TEXT PRIMARY KEY, json_data JSONB NOT NULL, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)`;
    await sql`CREATE TABLE IF NOT EXISTS workouts (date TEXT PRIMARY KEY, day_num INT, sets_json JSONB NOT NULL, volume NUMERIC DEFAULT 0, completed_sets INT DEFAULT 0, notes TEXT, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)`;
    await sql`CREATE TABLE IF NOT EXISTS measurements (id TEXT PRIMARY KEY, date TEXT NOT NULL, weight NUMERIC, waist NUMERIC, hips NUMERIC, notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)`;
    await sql`CREATE TABLE IF NOT EXISTS habits (date TEXT PRIMARY KEY, water INT DEFAULT 0, steps INT DEFAULT 0, sleep NUMERIC DEFAULT 7.5, meals_json JSONB, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)`;
  } catch (e) {}
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  await ensureTables();

  if (req.method === 'GET') {
    if (sql) {
      try {
        const rows = await sql`SELECT json_data FROM app_state WHERE id = 'main'`;
        if (rows && rows.length > 0 && rows[0].json_data) {
          return res.status(200).json(rows[0].json_data);
        }
      } catch (e) {}
    }
    return res.status(200).json({ days: {}, body: [], prs: {}, customEx: {} });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
