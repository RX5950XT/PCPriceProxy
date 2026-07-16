import { Hono } from 'hono';
import { ProductRepository } from '../../storage/product-repository.js';
import type { ApiResponse } from '../../shared/types.js';

export const healthRoutes = new Hono();

healthRoutes.get('/health', (c) => {
  const repo = new ProductRepository();
  const sources = repo.getSourceStatus();
  // totalProducts = 各來源爬取列（含跨店重複 SKU）；UI 顯示用 totalMatchGroups
  const totalProducts = sources.reduce((sum, s) => sum + s.productCount, 0);
  const totalMatchGroups = repo.getMatchGroupCount();

  const response: ApiResponse<{
    status: string;
    uptime: number;
    totalProducts: number;
    totalMatchGroups: number;
    sources: typeof sources;
  }> = {
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
      totalProducts,
      totalMatchGroups,
      sources,
    },
  };
  return c.json(response);
});
