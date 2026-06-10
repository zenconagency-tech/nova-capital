/**
 * Migration: Add application fields and approval workflow to users table.
 * Run with: node scripts/migrate-add-application-fields.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  realtime: { transport: WebSocket }
});

const migrationSQL = `
-- Add application fields to users table
alter table public.users
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists phone text,
  add column if not exists date_of_birth date,
  add column if not exists street text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip text,
  add column if not exists ssn_last4 text,
  add column if not exists employment_status text
    check (employment_status in ('employed','self_employed','unemployed','student','retired')),
  add column if not exists annual_income text
    check (annual_income in ('under_25k','25k_50k','50k_100k','100k_250k','250k_plus')),
  add column if not exists application_status text not null default 'approved'
    check (application_status in ('pending','approved','rejected')),
  add column if not exists application_submitted_at timestamptz,
  add column if not exists application_reviewed_at timestamptz,
  add column if not exists application_reviewed_by uuid references public.admin(id),
  add column if not exists rejection_reason text;

-- Create index for pending applications
create index if not exists users_application_status_idx on public.users (application_status);

-- Update existing users to have application_status = 'approved' and application_submitted_at = created_at
update public.users
set application_status = 'approved',
    application_submitted_at = created_at
where application_status is null or application_status = 'approved';

-- Add trigger for updated_at on application fields (handled by existing set_updated_at trigger)
`;

async function runMigration() {
  console.log('[migration] Starting migration: add application fields...');
  
  // We'll use the SQL query directly via rpc or execute it
  // Since we don't have a direct SQL execution, we'll use the supabase client
  // For DDL, we need to use the PostgREST API with a special approach
  // Actually, let's use the raw query via supabase.rpc if available, or just document the SQL
  
  console.log('[migration] Please run the following SQL in your Supabase SQL Editor:');
  console.log('==================================================');
  console.log(migrationSQL);
  console.log('==================================================');
  
  // Try to verify the columns exist by querying
  try {
    const { data, error } = await supabase
      .from('users')
      .select('first_name, application_status')
      .limit(1);
    
    if (error) {
      console.log('[migration] Columns may not exist yet. Error:', error.message);
      console.log('[migration] Please run the SQL above in Supabase SQL Editor.');
    } else {
      console.log('[migration] Columns appear to exist already. Migration may have been applied.');
    }
  } catch (e) {
    console.log('[migration] Verification failed:', e.message);
  }
  
  console.log('[migration] Done.');
}

runMigration().catch(console.error);