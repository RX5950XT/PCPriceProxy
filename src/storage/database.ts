import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';



const __dirname = dirname(fileURLToPath(import.meta.url));

let db: Database.Database | null = null;

export function getDatabase(dbPath?: string): Database.Database {
  if (db) return db;

  const resolvedPath = dbPath ?? process.env.DATABASE_PATH ?? './data/pcprice.db';
  const dir = dirname(resolvedPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initializeSchema(db);
  return db;
}

function initializeSchema(database: Database.Database): void {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  database.exec(schema);
  
  // Migrate existing databases to add match_group_id if it doesn't exist
  let hasColumn = false;
  try {
    database.prepare("SELECT match_group_id FROM products LIMIT 1").get();
    hasColumn = true;
  } catch (err) {
    try {
      console.log("[Database] Adding match_group_id column to products table...");
      database.prepare("ALTER TABLE products ADD COLUMN match_group_id TEXT").run();
      hasColumn = true;
      console.log("[Database] Migration: column added successfully.");
    } catch (migErr) {
      console.error("[Database] Migration: failed to add column:", migErr);
    }
  }

  // Create index if the column is present
  if (hasColumn) {
    try {
      database.prepare("CREATE INDEX IF NOT EXISTS idx_products_match_group ON products(match_group_id)").run();
    } catch (idxErr) {
      console.error("[Database] Migration: failed to create index:", idxErr);
    }
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
