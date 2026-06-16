import { Hono } from 'hono';
import { ProductRepository } from '../../storage/product-repository.js';
import type { ApiResponse } from '../../shared/types.js';

export const healthRoutes = new Hono();

healthRoutes.get('/health', (c) => {
  const repo = new ProductRepository();
  const sources = repo.getSourceStatus();
  const totalProducts = sources.reduce((sum, s) => sum + s.productCount, 0);

  const response: ApiResponse<{
    status: string;
    uptime: number;
    totalProducts: number;
    sources: typeof sources;
  }> = {
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
      totalProducts,
      sources,
    },
  };
  return c.json(response);
});
