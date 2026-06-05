import { beforeAll, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { initDb, getDb } from '../../db/index.js';
import { buildDailyTokenHeatmap } from '../../routes/analytics.js';

let db: Database.Database;

describe('Analytics API helpers', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = '0'.repeat(64);
    initDb(':memory:');
    db = getDb();

    db.prepare(`
      INSERT INTO requests (platform, model_id, status, input_tokens, output_tokens, latency_ms, created_at)
      VALUES
        ('nvidia', 'moonshotai/kimi-k2.6', 'success', 1200, 800, 1000, '2026-06-04T10:00:00.000Z'),
        ('groq', 'compound-mini', 'error', 300, 100, 250, '2026-05-25T08:00:00.000Z')
    `).run();
  });

  it('builds a complete daily token heatmap with empty and future days', () => {
    const heatmap = buildDailyTokenHeatmap(db, 2, new Date('2026-06-05T12:00:00.000Z'));

    expect(heatmap.startDate).toBe('2026-05-25');
    expect(heatmap.endDate).toBe('2026-06-07');
    expect(heatmap.days).toHaveLength(14);
    expect(heatmap.totalTokens).toBe(2400);
    expect(heatmap.totalRequests).toBe(2);
    expect(heatmap.maxTokens).toBe(2000);

    const firstDay = heatmap.days[0];
    expect(firstDay).toMatchObject({
      date: '2026-05-25',
      tokens: 400,
      requests: 1,
      level: 1,
      future: false,
    });

    const peakDay = heatmap.days.find(day => day.date === '2026-06-04');
    expect(peakDay).toMatchObject({
      tokens: 2000,
      requests: 1,
      level: 4,
      future: false,
    });

    const emptyDay = heatmap.days.find(day => day.date === '2026-05-26');
    expect(emptyDay).toMatchObject({
      tokens: 0,
      requests: 0,
      level: 0,
      future: false,
    });

    const futureDay = heatmap.days.find(day => day.date === '2026-06-07');
    expect(futureDay).toMatchObject({
      tokens: 0,
      requests: 0,
      level: 0,
      future: true,
    });
  });
});
