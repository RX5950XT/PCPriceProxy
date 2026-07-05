import { Hono } from 'hono';
import { ProductRepository } from '../../storage/product-repository.js';
import type { ApiResponse, ProductCategory } from '../../shared/types.js';
import { CATEGORY_META } from '../../shared/constants.js';

export const categoryRoutes = new Hono();

interface CategoryListItem {
  category: string;
  label: string;
  icon: string;
  order: number;
  count: number;
}

categoryRoutes.get('/', (c) => {
  const repo = new ProductRepository();
  const categories = repo.getCategories();

  // 以 CATEGORY_META 充實顯示資訊（中文名 / 圖示 / 排序），讓前端側欄完全資料驅動。
  const enriched: CategoryListItem[] = categories
    .map(({ category, count }) => {
      const meta = CATEGORY_META[category as ProductCategory];
      return {
        category,
        label: meta?.label ?? category,
        icon: meta?.icon ?? '📦',
        order: meta?.order ?? 98,
        count,
      };
    })
    .sort((a, b) => a.order - b.order);

  const response: ApiResponse<CategoryListItem[]> = {
    success: true,
    data: enriched,
    metadata: {
      total: enriched.length,
      page: 1,
      limit: enriched.length,
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
