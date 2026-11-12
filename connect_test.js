// Verify Neon connection
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
sql`SELECT version(), now()`
  .then(res => {
    console.log('✅ Connected to Neon. Postgres version:', res[0].version);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Neon connection failed:', err);
    process.exit(1);
  });
