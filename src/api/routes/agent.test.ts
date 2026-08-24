import { describe, expect, it } from 'vitest';
import { createApp } from '../server.js';

describe('Agent API', () => {
  it('GET /api/v1/agent/schema 回精簡契約', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/agent/schema');
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: { currency: string; sources: string[] } };
    expect(body.ok).toBe(true);
    expect(body.data.currency).toBe('TWD');
    expect(body.data.sources).toContain('coolpc');
  });
});
