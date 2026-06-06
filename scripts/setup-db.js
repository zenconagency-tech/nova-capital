/**
 * scripts/setup-db.js
 *
 * Applies the SQL schema to your Supabase project using the PostgREST
 * management API (or prints instructions to do it manually).
 *
 * Usage:
 *   1. Make sure .env has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set.
 *   2. Run:  npm run db:setup
 *
 * Note: Supabase does not expose a "run arbitrary SQL" endpoint on its REST API.
 * The cleanest path is to open the SQL editor at
 *   https://app.supabase.com/project/<ref>/sql
 * and paste src/db/schema.sql.
 *
 * This script will detect that and prompt you. If you'd rather run it
 * automatically, set PG_CONN_STRING in .env and we'll apply the SQL
 * using the `pg` driver.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'src', 'db', 'schema.sql');
const sql = fs.readFileSync(schemaPath, 'utf8');

(async () => {
  if (process.env.PG_CONN_STRING) {
    let pg;
    try {
      pg = require('pg');
    } catch (_) {
      console.error(
        'PG_CONN_STRING is set but the `pg` package is not installed.\n' +
        'Run `npm install pg` to enable auto-applied schema migration.'
      );
      process.exit(1);
    }
    const client = new pg.Client({ connectionString: process.env.PG_CONN_STRING });
    await client.connect();
    console.log('[setup] applying schema.sql to your Postgres database...');
    await client.query(sql);
    await client.end();
    console.log('[setup] ✓ schema applied');
    return;
  }

  console.log('\n=== Nova Capital — Database setup ===\n');
  console.log('No PG_CONN_STRING detected. To provision Supabase:');
  console.log('  1. Create a project at https://app.supabase.com');
  console.log('  2. Open the SQL editor:');
  console.log('       https://app.supabase.com/project/_/sql/new');
  console.log('  3. Paste the contents of src/db/schema.sql and run it.\n');
  console.log('Alternatively, add PG_CONN_STRING to .env (a connection string');
  console.log('from Supabase Settings → Database → Connection string) and rerun');
  console.log('`npm run db:setup` to apply the schema automatically.\n');

  // Best-effort: detect project ref from SUPABASE_URL
  const ref = (process.env.SUPABASE_URL || '').match(/https:\/\/([^.]+)\.supabase\.co/);
  if (ref) {
    console.log(`Detected Supabase project: ${ref[1]}`);
    console.log(`Open:  https://app.supabase.com/project/${ref[1]}/sql/new`);
  }
})();
