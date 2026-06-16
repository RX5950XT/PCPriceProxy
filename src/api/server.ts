import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { productRoutes } from './routes/products.js';
import { categoryRoutes } from './routes/categories.js';
import { compareRoutes } from './routes/compare.js';
import { sourceRoutes } from './routes/sources.js';
import { healthRoutes } from './routes/health.js';
import { rateLimiter } from './middleware/rate-limiter.js';
import type { ApiResponse } from '../shared/types.js';
import { AppError } from '../shared/errors.js';
import { DASHBOARD_HTML } from './dashboard.js';

export function createApp() {
  const app = new Hono();

  // Global middleware
  app.use('*', cors());
  app.use('*', logger());
  app.use('/api/*', rateLimiter(100, 60_000)); // 100 req/min

  // Routes
  app.route('/api/v1/products', productRoutes);
  app.route('/api/v1/categories', categoryRoutes);
  app.route('/api/v1/compare', compareRoutes);
  app.route('/api/v1/sources', sourceRoutes);
  app.route('/api/v1', healthRoutes);

  // Root route: serve frontend Dashboard
  app.get('/', (c) => c.html(DASHBOARD_HTML));

  // Global error handler
  app.onError((err, c) => {
    console.error('[API Error]', err);

    if (err instanceof AppError) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        error: err.message,
      };
      return c.json(response, err.statusCode as any);
    }

    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: 'Internal server error',
    };
    return c.json(response, 500);
  });

  // 404 handler
  app.notFound((c) => {
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: `Route not found: ${c.req.method} ${c.req.path}`,
    };
    return c.json(response, 404);
  });

  return app;
}
