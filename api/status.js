const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = process.env.DATABASE_URL;
let sql = null;

if (DATABASE_URL) {
  try { sql = neon(DATABASE_URL); } catch (e) {}
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  let workoutCount = 0, measCount = 0, lastUpdated = null, pgVersion = 'Unknown';

  if (sql) {
    try {
      const verRes = await sql`SELECT version(), now()`;
      pgVersion = verRes[0]?.version || pgVersion;
      const wRes = await sql`SELECT COUNT(*)::int as count FROM workouts`;
      workoutCount = wRes[0]?.count || 0;
      const mRes = await sql`SELECT COUNT(*)::int as count FROM measurements`;
      measCount = mRes[0]?.count || 0;
      const sRes = await sql`SELECT updated_at FROM app_state WHERE id = 'main'`;
      lastUpdated = sRes[0]?.updated_at || null;
    } catch (e) {}
  }

  return res.status(200).json({
    status: 'online',
    database: 'Neon Postgres (Lakebase)',
    provider: 'Neon Cloud (@neondatabase/serverless)',
    host: DATABASE_URL ? DATABASE_URL.split('@')[1]?.split('/')[0] : 'None',
    projectId: process.env.NEON_PROJECT_ID || 'small-queen-86460958',
    branch: 'production',
    postgresVersion: pgVersion,
    workoutsLogged: workoutCount,
    measurementsLogged: measCount,
    lastUpdated: lastUpdated
  });
};
