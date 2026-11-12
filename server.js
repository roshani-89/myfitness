// ==============================================================================
// IRONFIT PRO - Neon Lakebase Postgres Backend Server
// Powered by @neondatabase/serverless with zero-lag connection pooling
// ==============================================================================

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { neon } = require('@neondatabase/serverless');

const PORT = process.env.PORT || 3000;
const HTML_FILE = path.join(__dirname, 'Fit Tracker.html');
const DATABASE_URL = process.env.DATABASE_URL;

let isNeonConnected = false;
let sql = null;

if (DATABASE_URL) {
  try {
    sql = neon(DATABASE_URL);
    console.log('⚡ Initializing Neon Postgres connection to:', DATABASE_URL.split('@')[1]?.split('/')[0]);
  } catch (err) {
    console.error('Failed to initialize Neon client:', err);
  }
} else {
  console.warn('⚠️ No DATABASE_URL found in environment. Please check .env.local');
}

// Initialize Neon Postgres Tables
async function initNeonTables() {
  if (!sql) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS app_state (
        id TEXT PRIMARY KEY,
        json_data JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS workouts (
        date TEXT PRIMARY KEY,
        day_num INT,
        sets_json JSONB NOT NULL,
        volume NUMERIC DEFAULT 0,
        completed_sets INT DEFAULT 0,
        notes TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS measurements (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        weight NUMERIC,
        waist NUMERIC,
        hips NUMERIC,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS habits (
        date TEXT PRIMARY KEY,
        water INT DEFAULT 0,
        steps INT DEFAULT 0,
        sleep NUMERIC DEFAULT 7.5,
        meals_json JSONB,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    isNeonConnected = true;
    console.log('✅ Neon Postgres Tables Verified (app_state, workouts, measurements, habits)');
  } catch (err) {
    console.error('Neon table initialization failed:', err);
  }
}

// Run schema initialization
initNeonTables();

// Utility to parse JSON body
function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// CORS & JSON Helper
function sendJSON(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  try {
    // 1. Health check & DB Status
    if (pathname === '/api/status' && req.method === 'GET') {
      let workoutCount = 0;
      let measCount = 0;
      let lastUpdated = null;
      let pgVersion = 'Unknown';

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
        } catch (e) {
          console.error('Status query error:', e.message);
        }
      }

      return sendJSON(res, {
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
    }

    // 2. Get Full App State from Neon Postgres
    if (pathname === '/api/state' && req.method === 'GET') {
      if (sql) {
        try {
          const rows = await sql`SELECT json_data FROM app_state WHERE id = 'main'`;
          if (rows && rows.length > 0 && rows[0].json_data) {
            return sendJSON(res, rows[0].json_data);
          }
        } catch (e) {
          console.error('Fetch state error:', e);
        }
      }
      return sendJSON(res, { days: {}, body: [], prs: {}, customEx: {} });
    }

    // 3. Save / Sync Entire State to Neon Postgres
    if (pathname === '/api/save' && req.method === 'POST') {
      const payload = await getRequestBody(req);

      if (sql) {
        // Save complete snapshot
        await sql`
          INSERT INTO app_state (id, json_data, updated_at)
          VALUES ('main', ${JSON.stringify(payload)}, CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO UPDATE SET
            json_data = EXCLUDED.json_data,
            updated_at = CURRENT_TIMESTAMP
        `;

        // Denormalize into relational tables
        if (payload.days) {
          for (const [date, rec] of Object.entries(payload.days)) {
            let volume = 0;
            let completedSets = 0;
            if (rec.sets) {
              for (const sets of Object.values(rec.sets)) {
                for (const s of sets) {
                  if (s.done) {
                    completedSets++;
                    volume += (parseFloat(s.w) || 0) * (parseFloat(s.r) || 0);
                  }
                }
              }
            }
            const dayNum = new Date(date + 'T12:00:00').getDay();

            await sql`
              INSERT INTO workouts (date, day_num, sets_json, volume, completed_sets, updated_at)
              VALUES (${date}, ${dayNum}, ${JSON.stringify(rec.sets || {})}, ${volume}, ${completedSets}, CURRENT_TIMESTAMP)
              ON CONFLICT (date) DO UPDATE SET
                sets_json = EXCLUDED.sets_json,
                volume = EXCLUDED.volume,
                completed_sets = EXCLUDED.completed_sets,
                updated_at = CURRENT_TIMESTAMP
            `;

            await sql`
              INSERT INTO habits (date, water, steps, sleep, meals_json, updated_at)
              VALUES (${date}, ${rec.water || 0}, ${rec.steps || 0}, ${rec.sleep || 7.5}, ${JSON.stringify(rec.meals || {})}, CURRENT_TIMESTAMP)
              ON CONFLICT (date) DO UPDATE SET
                water = EXCLUDED.water,
                steps = EXCLUDED.steps,
                sleep = EXCLUDED.sleep,
                meals_json = EXCLUDED.meals_json,
                updated_at = CURRENT_TIMESTAMP
            `;
          }
        }

        if (payload.body && Array.isArray(payload.body)) {
          for (const m of payload.body) {
            await sql`
              INSERT INTO measurements (id, date, weight, waist, hips, created_at)
              VALUES (${String(m.id)}, ${m.d}, ${parseFloat(m.w) || null}, ${parseFloat(m.k) || null}, ${parseFloat(m.h) || null}, CURRENT_TIMESTAMP)
              ON CONFLICT (id) DO UPDATE SET
                date = EXCLUDED.date,
                weight = EXCLUDED.weight,
                waist = EXCLUDED.waist,
                hips = EXCLUDED.hips
            `;
          }
        }

        return sendJSON(res, { success: true, message: 'Saved to Neon Postgres database successfully' });
      } else {
        return sendJSON(res, { success: false, error: 'Database not initialized' }, 500);
      }
    }

    // 4. Export full Neon Database as JSON dump
    if (pathname === '/api/export' && req.method === 'GET') {
      if (sql) {
        const stateRows = await sql`SELECT json_data FROM app_state WHERE id = 'main'`;
        const workouts = await sql`SELECT * FROM workouts ORDER BY date DESC`;
        const measurements = await sql`SELECT * FROM measurements ORDER BY date DESC`;
        const habits = await sql`SELECT * FROM habits ORDER BY date DESC`;

        return sendJSON(res, {
          exportedAt: new Date().toISOString(),
          database: 'Neon Postgres (Lakebase)',
          projectId: process.env.NEON_PROJECT_ID || 'small-queen-86460958',
          appState: stateRows[0]?.json_data || {},
          tables: { workouts, measurements, habits }
        });
      }
      return sendJSON(res, { error: 'Database not available' }, 500);
    }

    // 5. Serve HTML Frontend
    if (pathname === '/' || pathname === '/index.html' || pathname === '/fit-tracker') {
      if (fs.existsSync(HTML_FILE)) {
        const html = fs.readFileSync(HTML_FILE, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }
    }

    // Default 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  } catch (err) {
    console.error('Server error:', err);
    sendJSON(res, { error: err.message }, 500);
  }
});

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log('\n======================================================');
  console.log('⚡  IRONFIT PRO - Neon Postgres Cloud Server is LIVE!');
  console.log('======================================================');
  console.log(`💻 Local Access    : http://localhost:${PORT}`);
  console.log(`📱 Phone Access    : http://${localIP}:${PORT}`);
  console.log(`☁️  Neon Database   : ${DATABASE_URL ? DATABASE_URL.split('@')[1]?.split('/')[0] : 'None'}`);
  console.log('======================================================\n');
});
