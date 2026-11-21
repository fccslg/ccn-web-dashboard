#!/usr/bin/env tsx
/**
 * Deploy migrations to Supabase (local or remote)
 * Usage: pnpm db:deploy [--remote]
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { glob } from 'glob';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    remote: { type: 'boolean', default: false },
    project: { type: 'string' },
  },
  strict: true,
});

const SUPABASE_URL = values.remote
  ? `https://${values.project}.supabase.co`
  : process.env.SUPABASE_URL || 'http://localhost:54321';

const SUPABASE_KEY = values.remote
  ? process.env.SUPABASE_SERVICE_ROLE_KEY
  : process.env.SUPABASE_ANON_KEY || 'local-anon-key';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (remote) or SUPABASE_ANON_KEY (local)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function deployMigrations() {
  console.log(`🚀 Deploying migrations to ${SUPABASE_URL}`);

  // Get migration files in order
  const migrationFiles = await glob('supabase/migrations/*.sql', { cwd: process.cwd() });
  migrationFiles.sort();

  if (migrationFiles.length === 0) {
    console.log('No migration files found');
    return;
  }

  for (const file of migrationFiles) {
    console.log(`\n📄 Applying: ${file}`);
    const sql = readFileSync(file, 'utf-8');

    // Split by semicolon (naive but works for our migrations)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const stmt of statements) {
      if (!stmt) continue;
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' });
        if (error) {
          // Try direct query for statements that don't work with exec_sql
          const { error: directError } = await supabase.from('_dummy').select('1').limit(0);
          // For DDL, we need to use raw SQL via PostgREST
          const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'apikey': SUPABASE_KEY,
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ query: stmt + ';' }),
          });

          if (!response.ok) {
            const errText = await response.text();
            console.error(`❌ Error in ${file}:`, errText);
            console.error('Statement:', stmt.substring(0, 100) + '...');
          } else {
            console.log(`  ✓ Applied`);
          }
        }
      } catch (err) {
        console.error(`❌ Error in ${file}:`, err);
      }
    }
  }

  console.log('\n✅ All migrations processed');
}

async function seedDatabase() {
  console.log('\n🌱 Seeding database...');
  const sql = readFileSync('supabase/seed.sql', 'utf-8');

  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  for (const stmt of statements) {
    if (!stmt) continue;
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'apikey': SUPABASE_KEY,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ query: stmt + ';' }),
      });

      if (!response.ok) {
        const errText = await response.text();
        if (!errText.includes('already exists') && !errText.includes('duplicate key')) {
          console.error(`⚠️ Seed warning:`, errText.substring(0, 200));
        }
      }
    } catch (err) {
      console.error('Seed error:', err);
    }
  }
  console.log('✅ Seeding complete');
}

async function main() {
  await deployMigrations();
  await seedDatabase();
}

main().catch(console.error);