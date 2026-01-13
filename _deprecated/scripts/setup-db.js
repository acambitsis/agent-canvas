/**
 * Setup database schema
 * Runs the schema.sql file against the Neon database
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Error: DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sql = neon(dbUrl);

async function main() {
  console.log('Setting up database schema...');
  
  try {
    // Read schema file
    const schemaPath = join(__dirname, '..', 'db', 'schema.sql');
    let schema = readFileSync(schemaPath, 'utf8');
    
    // Remove comments
    schema = schema.replace(/--.*$/gm, '');
    
    // Split by semicolons, but handle $$ function delimiters
    const statements = [];
    let current = '';
    let inFunction = false;
    
    // Better approach: split by semicolons but handle $$ delimiters
    let i = 0;
    while (i < schema.length) {
      const char = schema[i];
      const nextChar = schema[i + 1];
      
      // Check for $$ delimiter
      if (char === '$' && nextChar === '$') {
        inFunction = !inFunction;
        current += char + nextChar;
        i += 2;
        continue;
      }
      
      current += char;
      
      // If we hit a semicolon and we're not in a function, it's a statement end
      if (char === ';' && !inFunction) {
        const stmt = current.trim();
        if (stmt && stmt.length > 5 && !stmt.startsWith('--')) {
          statements.push(stmt);
        }
        current = '';
      }
      
      i++;
    }
    
    // Add any remaining statement
    if (current.trim() && current.trim().length > 5) {
      statements.push(current.trim());
    }
    
    // Add any remaining statement
    if (current.trim() && current.trim().length > 5) {
      statements.push(current.trim());
    }
    
    console.log(`Found ${statements.length} SQL statements to execute\n`);
    
    // Execute statements in order
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await sql(statement);
        const preview = statement.substring(0, 60).replace(/\s+/g, ' ');
        console.log(`✓ [${i+1}/${statements.length}] ${preview}...`);
      } catch (err) {
        // Ignore "already exists" errors for IF NOT EXISTS statements
        if (err.message && (
          err.message.includes('already exists') ||
          err.message.includes('duplicate key') ||
          (err.message.includes('relation') && err.message.includes('already'))
        )) {
          const preview = statement.substring(0, 60).replace(/\s+/g, ' ');
          console.log(`⚠ [${i+1}/${statements.length}] Skipped (exists): ${preview}...`);
        } else {
          console.error(`✗ [${i+1}/${statements.length}] Error: ${err.message}`);
          const preview = statement.substring(0, 100).replace(/\s+/g, ' ');
          console.error(`  ${preview}...`);
          // Continue with other statements
        }
      }
    }
    
    console.log('\n✓ Database schema setup complete!');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();

