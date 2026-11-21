#!/usr/bin/env node
/**
 * Apply migrations to remote Supabase via REST API
 */

import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://hntbgypndjyksgjbgjtj.supabase.co';
const SERVICE_KEY = 'sb_secret_dDIbB DEp2HgL9CYdRLwAFA_57VcgouA';

async function applyMigration(file) {
  const sql = fs.readFileSync(file, 'utf-8');
  console.log('\n📄 Applying:', path.basename(file));

  // Split statements more carefully - handle $$ blocks and function definitions
  const statements = splitSqlStatements(sql);

  for (const stmt of statements) {
    if (!stmt || stmt.trim().startsWith('--')) continue;

    try {
      const response = await fetch(SUPABASE_URL + '/rest/v1/rpc/exec_sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ sql: stmt.trim() + ';' }),
      });

      if (!response.ok) {
        const err = await response.text();
        // Check if it's a "already exists" error which is fine
        if (err.includes('already exists') || err.includes('duplicate key') || err.includes('duplicate object')) {
          console.log(`  ⊙ Skipped (exists): ${stmt.trim().substring(0, 60)}...`);
        } else {
          console.error(`  ❌ Error: ${err.substring(0, 200)}`);
          console.error(`     Statement: ${stmt.trim().substring(0, 100)}...`);
        }
      } else {
        console.log(`  ✓ Applied`);
      }
    } catch (err) {
      console.error(`  ❌ Exception: ${err.message}`);
    }
  }
}

// More robust SQL splitting that handles $$ blocks
function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1] || '';

    // Handle dollar-quoted strings ($$ or $tag$)
    if (!inSingleQuote && !inDoubleQuote && char === '$' && nextChar === '$') {
      if (!inDollarQuote) {
        inDollarQuote = true;
        dollarTag = '$$';
        current += '$$';
        i++;
      } else if (dollarTag === '$$') {
        inDollarQuote = false;
        dollarTag = '';
        current += '$$';
        i++;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === '$' && /[a-zA-Z0-9_]/.test(nextChar)) {
      // Potential tagged dollar quote start
      let tagEnd = sql.indexOf('$', i + 1);
      if (tagEnd > i) {
        const tag = sql.substring(i, tagEnd + 1);
        if (!inDollarQuote && sql.startsWith(tag + '$', tagEnd + 1)) {
          // This is complex, simplify: just track $$ pairs
        }
      }
    }

    // Simple approach: track $$ pairs
    if (!inSingleQuote && !inDoubleQuote && char === '$' && nextChar === '$') {
      if (!inDollarQuote) {
        inDollarQuote = true;
        current += '$$';
        i++;
      } else {
        inDollarQuote = false;
        current += '$$';
        i++;
      }
      continue;
    }

    // Handle single quotes
    if (!inDollarQuote && !inDoubleQuote && char === "'" && nextChar !== "'") {
      inSingleQuote = !inSingleQuote;
    } else if (!inDollarQuote && !inDoubleQuote && char === "'" && nextChar === "'") {
      // Escaped single quote
      i++;
    }

    // Handle double quotes
    if (!inDollarQuote && !inSingleQuote && char === '"') {
      inDoubleQuote = !inDoubleQuote;
    }

    current += char;

    // Statement ends with semicolon when not in quotes
    if (char === ';' && !inDollarQuote && !inSingleQuote && !inDoubleQuote) {
      statements.push(current);
      current = '';
    }
  }

  if (current.trim()) {
    statements.push(current);
  }

  return statements.map(s => s.trim()).filter(s => s);
}

async function main() {
  const migrationsDir = 'supabase/migrations';
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .map(f => path.join(migrationsDir, f));

  console.log('🚀 Applying migrations to remote Supabase...');
  console.log(`   Project: hntbgypndjyksgjbgjtj.supabase.co`);
  console.log(`   Migrations: ${files.length} files`);

  for (const file of files) {
    await applyMigration(file);
  }

  // Also apply seed
  console.log('\n🌱 Applying seed data...');
  await applyMigration('supabase/seed.sql');

  console.log('\n✅ All done!');
}

main().catch(console.error);