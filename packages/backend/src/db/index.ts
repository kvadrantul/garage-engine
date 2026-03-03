// Database connection using Drizzle + SQLite

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@garage-engine/shared/schema';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../../../database.sqlite');

// Create SQLite connection
const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

// Create Drizzle instance
export const db = drizzle(sqlite, { schema });

// Export schema for convenience
export { schema };

// Initialize database tables
export function initializeDatabase() {
  // Create tables if they don't exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      definition TEXT NOT NULL,
      settings TEXT,
      active INTEGER DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS executions (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      trigger_type TEXT NOT NULL,
      trigger_data TEXT,
      error TEXT,
      started_at INTEGER,
      finished_at INTEGER,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS execution_nodes (
      id TEXT PRIMARY KEY,
      execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
      node_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      input_data TEXT,
      output_data TEXT,
      error TEXT,
      started_at INTEGER,
      finished_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS credentials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      data BLOB NOT NULL,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      node_id TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      method TEXT DEFAULT 'POST',
      active INTEGER DEFAULT 1,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS hitl_requests (
      id TEXT PRIMARY KEY,
      execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
      node_id TEXT NOT NULL,
      type TEXT NOT NULL,
      request_data TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      response_data TEXT,
      responded_at INTEGER,
      expires_at INTEGER,
      created_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_executions_workflow_id ON executions(workflow_id);
    CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
    CREATE INDEX IF NOT EXISTS idx_execution_nodes_execution_id ON execution_nodes(execution_id);
    CREATE INDEX IF NOT EXISTS idx_webhooks_path ON webhooks(path);
    CREATE INDEX IF NOT EXISTS idx_hitl_requests_execution_id ON hitl_requests(execution_id);
    CREATE INDEX IF NOT EXISTS idx_hitl_requests_status ON hitl_requests(status);

    CREATE TABLE IF NOT EXISTS custom_nodes (
      id TEXT PRIMARY KEY,
      manifest TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      is_builtin INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    );
  `);

  console.log('Database initialized');
}
