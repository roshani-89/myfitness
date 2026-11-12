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

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await ensureTables();

  const payload = req.body;

  if (sql) {
    try {
      await sql`
        INSERT INTO app_state (id, json_data, updated_at)
        VALUES ('main', ${JSON.stringify(payload)}, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          json_data = EXCLUDED.json_data,
          updated_at = CURRENT_TIMESTAMP
      `;

      if (payload.days) {
        for (const [date, rec] of Object.entries(payload.days)) {
          const dayNum = rec.dayNum || 0;
          const setsJson = JSON.stringify(rec.sets || {});
          let volume = 0, completedSets = 0;
          for (const sets of Object.values(rec.sets || {})) {
            for (const s of sets) {
              if (s.d) { completedSets++; volume += (parseFloat(s.w) || 0) * (parseInt(s.r) || 0); }
            }
          }
          await sql`
            INSERT INTO workouts (date, day_num, sets_json, volume, completed_sets, updated_at)
            VALUES (${date}, ${dayNum}, ${setsJson}, ${volume}, ${completedSets}, CURRENT_TIMESTAMP)
            ON CONFLICT (date) DO UPDATE SET
              day_num = EXCLUDED.day_num, sets_json = EXCLUDED.sets_json,
              volume = EXCLUDED.volume, completed_sets = EXCLUDED.completed_sets,
              updated_at = CURRENT_TIMESTAMP
          `;
        }
      }

      return res.status(200).json({ saved: true, engine: 'neon' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(200).json({ saved: false, engine: 'none' });
};
