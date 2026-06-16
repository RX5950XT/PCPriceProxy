CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  original_price INTEGER,
  category TEXT NOT NULL,
  subcategory TEXT,
  brand TEXT,
  model TEXT,
  specs TEXT DEFAULT '{}',
  in_stock INTEGER DEFAULT 1,
  price_change TEXT,
  source TEXT NOT NULL,
  source_url TEXT,
  raw_name TEXT NOT NULL,
  scraped_at TEXT NOT NULL,
  match_group_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  price INTEGER NOT NULL,
  recorded_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scrape_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('success', 'error')),
  items_count INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_source ON products(source);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_match_group_id ON products(match_group_id);
CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded ON price_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_source ON scrape_logs(source);

CREATE TABLE IF NOT EXISTS match_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  lowest_price INTEGER NOT NULL,
  highest_price INTEGER NOT NULL,
  has_multiple_sources INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mg_category ON match_groups(category);
CREATE INDEX IF NOT EXISTS idx_mg_subcategory ON match_groups(subcategory);
CREATE INDEX IF NOT EXISTS idx_mg_brand ON match_groups(brand);
CREATE INDEX IF NOT EXISTS idx_mg_lowest_price ON match_groups(lowest_price);
CREATE INDEX IF NOT EXISTS idx_mg_updated_at ON match_groups(updated_at);
