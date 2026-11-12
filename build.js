// ==============================================================================
// Build and Validation Script for Neon Deployment
// ==============================================================================

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const fs = require('fs');
const { neon } = require('@neondatabase/serverless');

console.log('🚀 Running IRONFIT PRO Build Verification...');

// 1. Verify files exist
const requiredFiles = ['Fit Tracker.html', 'server.js', 'package.json', 'neon.ts'];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error(`❌ Missing required file: ${file}`);
    process.exit(1);
  }
}
console.log('✅ Required project files present.');

// 2. Validate HTML & JavaScript syntax
const html = fs.readFileSync('Fit Tracker.html', 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  console.error('❌ Could not find script in Fit Tracker.html');
  process.exit(1);
}
new Function(scriptMatch[1]);
console.log('✅ Fit Tracker.html frontend JavaScript syntax valid.');

const serverCode = fs.readFileSync('server.js', 'utf8');
new Function(serverCode);
console.log('✅ server.js backend code syntax valid.');

// 3. Validate Neon Postgres Connection
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set in environment or .env.local');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
sql`SELECT version(), now()`
  .then(res => {
    console.log('✅ Neon Postgres database connection verified!');
    console.log(`   Connected to: ${process.env.DATABASE_URL.split('@')[1]?.split('/')[0]}`);
    console.log(`   Postgres version: ${res[0].version.split(',')[0]}`);
    console.log('🎉 Build verification successful! Ready to run.');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Failed to connect to Neon Postgres:', err);
    process.exit(1);
  });
