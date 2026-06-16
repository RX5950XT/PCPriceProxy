import { Hono } from 'hono';
import { ProductRepository } from '../../storage/product-repository.js';
import type { ApiResponse } from '../../shared/types.js';

export const categoryRoutes = new Hono();

categoryRoutes.get('/', (c) => {
  const repo = new ProductRepository();
  const categories = repo.getCategories();

  const response: ApiResponse<{ category: string; count: number }[]> = {
    success: true,
    data: categories,
    metadata: {
      total: categories.length,
      page: 1,
      limit: categories.length,
    },
  };
  return c.json(response);
});

categoryRoutes.get('/:id', (c) => {
  const repo = new ProductRepository();
  const category = c.req.param('id');

  const result = repo.findAll({
    category,
    sort: c.req.query('sort') as any,
    page: c.req.query('page') ? Number(c.req.query('page')) : 1,
    limit: c.req.query('limit') ? Number(c.req.query('limit')) : 50,
  });

  const response: ApiResponse<typeof result.products> = {
    success: true,
    data: result.products,
    metadata: {
      total: result.total,
      page: Number(c.req.query('page') ?? 1),
      limit: Number(c.req.query('limit') ?? 50),
    },
  };
  return c.json(response);
});

categoryRoutes.get('/:category/subcategories', (c) => {
  const repo = new ProductRepository();
  const category = c.req.param('category');
  const subcategories = repo.getSubcategories(category);

  return c.json({
    success: true,
    data: subcategories,
  });
});

categoryRoutes.get('/:category/brands', (c) => {
  const repo = new ProductRepository();
  const category = c.req.param('category');
  const subcategory = c.req.query('subcategory');
  const brands = repo.getBrands(category, subcategory);

  return c.json({
    success: true,
    data: brands,
  });
});
