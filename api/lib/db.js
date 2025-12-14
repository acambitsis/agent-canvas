/**
 * Neon Postgres database helper
 * Provides connection and query utilities
 */

import { neon, Pool } from '@neondatabase/serverless';

let sql = null;
let pool = null;

/**
 * Initialize database connection
 */
function getDb() {
  if (!sql) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    sql = neon(connectionString);
  }
  return sql;
}

/**
 * Get connection pool for transactions
 */
function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

/**
 * Execute a query and return results
 */
export async function query(text, params = []) {
  const db = getDb();
  return await db(text, params);
}

/**
 * Execute a query and return first row
 */
export async function queryOne(text, params = []) {
  const results = await query(text, params);
  return results[0] || null;
}

/**
 * Execute a query and return all rows
 */
export async function queryAll(text, params = []) {
  return await query(text, params);
}

/**
 * Execute queries within a transaction with proper isolation
 * Uses WebSocket-based Pool client with BEGIN/COMMIT/ROLLBACK
 */
export async function transaction(callback) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

