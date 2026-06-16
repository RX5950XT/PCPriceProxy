import { getDatabase, closeDatabase } from '../storage/database.js';

async function main() {
  const db = getDatabase();
  
  console.log('=== Category Counts ===');
  const categories = db.prepare(`
    SELECT category, count(*) as count 
    FROM products 
    GROUP BY category 
    ORDER BY count DESC
  `).all() as any[];
  console.table(categories);

  console.log('\n=== Subcategories for CPU ===');
  const cpuSubs = db.prepare(`
    SELECT subcategory, count(*) as count 
    FROM products 
    WHERE category = 'cpu'
    GROUP BY subcategory 
    ORDER BY count DESC
    LIMIT 15
  `).all() as any[];
  console.table(cpuSubs);

  console.log('\n=== Subcategories for GPU ===');
  const gpuSubs = db.prepare(`
    SELECT subcategory, count(*) as count 
    FROM products 
    WHERE category = 'gpu'
    GROUP BY subcategory 
    ORDER BY count DESC
    LIMIT 15
  `).all() as any[];
  console.table(gpuSubs);

  console.log('\n=== Subcategories for SSD ===');
  const ssdSubs = db.prepare(`
    SELECT subcategory, count(*) as count 
    FROM products 
    WHERE category = 'ssd'
    GROUP BY subcategory 
    ORDER BY count DESC
    LIMIT 15
  `).all() as any[];
  console.table(ssdSubs);

  console.log('\n=== Check if CPU contains Cases (機殼) ===');
  const casesInCpu = db.prepare(`
    SELECT name, source, subcategory 
    FROM products 
    WHERE category = 'cpu' AND (name LIKE '%機殼%' OR name LIKE '%case%' OR name LIKE '%chassis%')
    LIMIT 10
  `).all() as any[];
  console.table(casesInCpu);

  console.log('\n=== Check if GPU contains Brackets (支架) ===');
  const bracketsInGpu = db.prepare(`
    SELECT name, source, subcategory 
    FROM products 
    WHERE category = 'gpu' AND (name LIKE '%支撐架%' OR name LIKE '%千斤頂%' OR name LIKE '%延長線%')
    LIMIT 10
  `).all() as any[];
  console.table(bracketsInGpu);

  console.log('\n=== Uncategorized GPUs ===');
  const uncategorizedGpus = db.prepare(`
    SELECT name, source, subcategory 
    FROM products 
    WHERE category = 'gpu' AND subcategory LIKE '其他系列%'
    LIMIT 30
  `).all() as any[];
  console.table(uncategorizedGpus);

  closeDatabase();
}

main().catch(console.error);
