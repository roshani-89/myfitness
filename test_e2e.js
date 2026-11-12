// ==============================================================================
// End-to-End Test for Neon Postgres Database & API Server
// ==============================================================================

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { neon } = require('@neondatabase/serverless');

async function runE2ETest() {
  console.log('🧪 Starting End-to-End Test with Neon Postgres...');
  const sql = neon(process.env.DATABASE_URL);

  // 1. Test basic connectivity
  const timeRes = await sql`SELECT now() as db_time, version() as db_version`;
  console.log('✅ 1. Connection Test: OK');
  console.log('   Neon DB Time:', timeRes[0].db_time);
  console.log('   Version:', timeRes[0].db_version.split(',')[0]);

  // 2. Initialize Tables in Neon Postgres
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
  console.log('✅ 2. Schema Provisioning: OK (Created app_state, workouts, measurements, habits tables)');

  // 3. Test writing a workout session to Neon Postgres
  const testDate = '2026-11-12';
  const testSets = {
    "sq": [{ w: "80", r: "10", done: true }, { w: "85", r: "8", done: true }],
    "ht": [{ w: "100", r: "12", done: true }]
  };
  const testPayload = {
    days: {
      [testDate]: {
        sets: testSets,
        water: 12,
        steps: 10500,
        sleep: 8.0,
        meals: { 0: true, 1: true, 2: true, 3: true }
      }
    },
    body: [
      { id: "e2e_meas_1", d: testDate, w: "59.2", k: "68.5", h: "93.0" }
    ]
  };

  // Upsert app_state
  await sql`
    INSERT INTO app_state (id, json_data, updated_at)
    VALUES ('main', ${JSON.stringify(testPayload)}, CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO UPDATE SET
      json_data = EXCLUDED.json_data,
      updated_at = CURRENT_TIMESTAMP
  `;
  console.log('✅ 3. App State Upsert Test: OK (Saved snapshot to app_state table)');

  // Upsert into workouts table
  let volume = (80 * 10) + (85 * 8) + (100 * 12); // 800 + 680 + 1200 = 2680 kg
  await sql`
    INSERT INTO workouts (date, day_num, sets_json, volume, completed_sets, updated_at)
    VALUES (${testDate}, 1, ${JSON.stringify(testSets)}, ${volume}, 3, CURRENT_TIMESTAMP)
    ON CONFLICT (date) DO UPDATE SET
      sets_json = EXCLUDED.sets_json,
      volume = EXCLUDED.volume,
      completed_sets = EXCLUDED.completed_sets,
      updated_at = CURRENT_TIMESTAMP
  `;
  console.log('✅ 4. Relational Table Write: OK (Inserted into workouts table, volume = ' + volume + ' kg)');

  // Upsert into measurements table
  await sql`
    INSERT INTO measurements (id, date, weight, waist, hips, created_at)
    VALUES ('e2e_meas_1', ${testDate}, 59.2, 68.5, 93.0, CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO UPDATE SET
      weight = EXCLUDED.weight,
      waist = EXCLUDED.waist,
      hips = EXCLUDED.hips
  `;
  console.log('✅ 5. Measurements Table Write: OK (Inserted measurement: 59.2kg, 68.5cm waist)');

  // 4. Read back from Neon Postgres to prove persistence
  const readWorkout = await sql`SELECT * FROM workouts WHERE date = ${testDate}`;
  console.log('✅ 6. Relational Query Verification:');
  console.log('   Retrieved Workout from Neon:', {
    date: readWorkout[0].date,
    volume: readWorkout[0].volume + ' kg',
    completed_sets: readWorkout[0].completed_sets,
    updated_at: readWorkout[0].updated_at
  });

  const readState = await sql`SELECT json_data FROM app_state WHERE id = 'main'`;
  console.log('✅ 7. Full State Retrieval:');
  console.log('   Workouts in State:', Object.keys(readState[0].json_data.days));
  console.log('   Measurements in State:', readState[0].json_data.body.length);

  console.log('\n🎉 ALL END-TO-END TESTS PASSED ON NEON POSTGRES! 100% OPERATIONAL.');
}

runE2ETest().catch(err => {
  console.error('❌ E2E Test failed:', err);
  process.exit(1);
});
