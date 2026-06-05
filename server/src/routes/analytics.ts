import { Router } from 'express';
import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import { getDb } from '../db/index.js';

export const analyticsRouter = Router();

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_HEATMAP_WEEKS = 17;
const MAX_HEATMAP_WEEKS = 53;
const MIN_HEATMAP_YEAR = 2000;
const MAX_HEATMAP_YEAR = 2100;

interface DailyTokenAggregateRow {
  day: string;
  tokens: number | null;
  requests: number;
}

interface DailyTokenHeatmapDay {
  date: string;
  tokens: number;
  requests: number;
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
  outsideYear: boolean;
  current: boolean;
  isoWeek: number;
}

type HeatmapPeriod = { mode: 'weeks'; weeks: number } | { mode: 'year'; year: number };

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function parseHeatmapWeeks(value: unknown): number {
  if (typeof value !== 'string') return DEFAULT_HEATMAP_WEEKS;
  const weeks = Number.parseInt(value, 10);
  if (!Number.isFinite(weeks)) return DEFAULT_HEATMAP_WEEKS;
  return Math.min(Math.max(weeks, 1), MAX_HEATMAP_WEEKS);
}

function parseHeatmapYear(value: unknown, now = new Date()): number | null {
  if (typeof value !== 'string') return null;
  const year = Number.parseInt(value, 10);
  if (!Number.isFinite(year)) return null;
  const currentYear = now.getUTCFullYear();
  return Math.min(Math.max(year || currentYear, MIN_HEATMAP_YEAR), MAX_HEATMAP_YEAR);
}

function getIsoWeekInfo(date: Date): { year: number; week: number } {
  const target = startOfUtcDay(date);
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);

  const year = target.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((target.getTime() - yearStart.getTime()) / MS_PER_DAY) + 1) / 7);

  return { year, week };
}

function getRollingHeatmapWindow(weeks: number, now = new Date()) {
  const today = startOfUtcDay(now);
  const daysSinceMonday = (today.getUTCDay() + 6) % 7;
  const startOfCurrentWeek = addUtcDays(today, -daysSinceMonday);
  const start = addUtcDays(startOfCurrentWeek, -(weeks - 1) * 7);
  const end = addUtcDays(start, weeks * 7 - 1);

  return { start, end, today, year: null };
}

function getYearHeatmapWindow(year: number, now = new Date()) {
  const today = startOfUtcDay(now);
  const firstDay = new Date(Date.UTC(year, 0, 1));
  const lastDay = new Date(Date.UTC(year, 11, 31));
  const firstDayOffset = (firstDay.getUTCDay() + 6) % 7;
  const lastDayOffset = 6 - ((lastDay.getUTCDay() + 6) % 7);
  const start = addUtcDays(firstDay, -firstDayOffset);
  const end = addUtcDays(lastDay, lastDayOffset);

  return { start, end, today, year };
}

export function buildDailyTokenHeatmap(db: Database.Database, period: HeatmapPeriod, now = new Date()) {
  const window = period.mode === 'year'
    ? getYearHeatmapWindow(period.year, now)
    : getRollingHeatmapWindow(period.weeks, now);
  const { start, end, today } = window;
  const startDate = toDateKey(start);
  const endDate = toDateKey(end);
  const todayDate = toDateKey(today);
  const currentIsoWeek = getIsoWeekInfo(today);
  const dayCount = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;

  const rows = db.prepare(`
    SELECT
      date(created_at) as day,
      SUM(input_tokens + output_tokens) as tokens,
      COUNT(*) as requests
    FROM requests
    WHERE date(created_at) >= ? AND date(created_at) <= ?
    GROUP BY date(created_at)
    ORDER BY day ASC
  `).all(startDate, endDate) as DailyTokenAggregateRow[];

  const byDay = new Map(rows.map(row => [
    row.day,
    {
      tokens: row.tokens ?? 0,
      requests: row.requests,
    },
  ]));

  const rawDays = Array.from({ length: dayCount }, (_, index) => {
    const cellDate = addUtcDays(start, index);
    const date = toDateKey(cellDate);
    const outsideYear = period.mode === 'year' ? !date.startsWith(`${period.year}-`) : false;
    const usage = date <= todayDate && !outsideYear ? byDay.get(date) : undefined;
    const isoWeek = getIsoWeekInfo(cellDate).week;

    return {
      date,
      tokens: usage?.tokens ?? 0,
      requests: usage?.requests ?? 0,
      future: date > todayDate,
      outsideYear,
      current: date === todayDate,
      isoWeek,
    };
  });

  const inScopeDays = rawDays.filter(day => !day.outsideYear);
  const maxTokens = inScopeDays.reduce((max, day) => Math.max(max, day.tokens), 0);
  const days = rawDays.map<DailyTokenHeatmapDay>(day => {
    const level = day.tokens <= 0 || maxTokens <= 0
      ? 0
      : Math.min(4, Math.max(1, Math.ceil((day.tokens / maxTokens) * 4))) as 1 | 2 | 3 | 4;

    return { ...day, level };
  });

  const elapsedDays = days.filter(day => !day.future && !day.outsideYear);
  const totalTokens = elapsedDays.reduce((sum, day) => sum + day.tokens, 0);
  const totalRequests = elapsedDays.reduce((sum, day) => sum + day.requests, 0);
  const avgDailyTokens = elapsedDays.length > 0 ? Math.round(totalTokens / elapsedDays.length) : 0;
  const peakDay = maxTokens > 0
    ? elapsedDays.reduce<DailyTokenHeatmapDay | null>(
      (peak, day) => (!peak || day.tokens > peak.tokens ? day : peak),
      null,
    )
    : null;

  return {
    mode: period.mode,
    weeks: Math.ceil(days.length / 7),
    year: period.mode === 'year' ? period.year : null,
    currentYear: currentIsoWeek.year,
    currentWeek: currentIsoWeek.week,
    startDate,
    endDate,
    todayDate,
    maxTokens,
    totalTokens,
    totalRequests,
    avgDailyTokens,
    peakDay,
    days,
  };
}

// Map range to a JS-computed ISO timestamp passed as a bind parameter,
// so the SQL string never includes user-controlled fragments.
function getSinceTimestamp(range: string): string {
  const now = Date.now();
  switch (range) {
    case '24h':
      return new Date(now - 24 * 60 * 60 * 1000).toISOString();
    case '30d':
      return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    case '7d':
    default:
      return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  }
}

// Summary stats
analyticsRouter.get('/summary', (req: Request, res: Response) => {
  const range = (req.query.range as string) ?? '7d';
  const since = getSinceTimestamp(range);
  const db = getDb();

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_requests,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
      SUM(input_tokens) as total_input_tokens,
      SUM(output_tokens) as total_output_tokens,
      AVG(latency_ms) as avg_latency_ms
    FROM requests
    WHERE created_at >= ?
  `).get(since) as any;

  const totalRequests = stats.total_requests ?? 0;
  const successRate = totalRequests > 0 ? (stats.success_count / totalRequests) * 100 : 0;
  const totalTokens = (stats.total_input_tokens ?? 0) + (stats.total_output_tokens ?? 0);

  // Estimate cost savings: average ~$3/M input + $15/M output tokens (GPT-4o pricing)
  const inputCost = ((stats.total_input_tokens ?? 0) / 1_000_000) * 3;
  const outputCost = ((stats.total_output_tokens ?? 0) / 1_000_000) * 15;

  res.json({
    totalRequests,
    successRate: Math.round(successRate * 10) / 10,
    totalInputTokens: stats.total_input_tokens ?? 0,
    totalOutputTokens: stats.total_output_tokens ?? 0,
    avgLatencyMs: Math.round(stats.avg_latency_ms ?? 0),
    estimatedCostSavings: Math.round((inputCost + outputCost) * 100) / 100,
  });
});

// Stats grouped by model
analyticsRouter.get('/by-model', (req: Request, res: Response) => {
  const range = (req.query.range as string) ?? '7d';
  const since = getSinceTimestamp(range);
  const db = getDb();

  const rows = db.prepare(`
    SELECT
      r.platform,
      r.model_id,
      m.display_name,
      COUNT(*) as requests,
      SUM(CASE WHEN r.status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate,
      AVG(r.latency_ms) as avg_latency_ms,
      SUM(r.input_tokens) as total_input_tokens,
      SUM(r.output_tokens) as total_output_tokens
    FROM requests r
    LEFT JOIN models m ON m.platform = r.platform AND m.model_id = r.model_id
    WHERE r.created_at >= ?
    GROUP BY r.platform, r.model_id
    ORDER BY requests DESC
  `).all(since) as any[];

  res.json(rows.map(r => ({
    platform: r.platform,
    modelId: r.model_id,
    displayName: r.display_name ?? r.model_id,
    requests: r.requests,
    successRate: Math.round(r.success_rate * 10) / 10,
    avgLatencyMs: Math.round(r.avg_latency_ms),
    totalInputTokens: r.total_input_tokens ?? 0,
    totalOutputTokens: r.total_output_tokens ?? 0,
  })));
});

// Stats grouped by platform
analyticsRouter.get('/by-platform', (req: Request, res: Response) => {
  const range = (req.query.range as string) ?? '7d';
  const since = getSinceTimestamp(range);
  const db = getDb();

  const rows = db.prepare(`
    SELECT
      platform,
      COUNT(*) as requests,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate,
      AVG(latency_ms) as avg_latency_ms,
      SUM(input_tokens) as total_input_tokens,
      SUM(output_tokens) as total_output_tokens
    FROM requests
    WHERE created_at >= ?
    GROUP BY platform
    ORDER BY requests DESC
  `).all(since) as any[];

  res.json(rows.map(r => ({
    platform: r.platform,
    requests: r.requests,
    successRate: Math.round(r.success_rate * 10) / 10,
    avgLatencyMs: Math.round(r.avg_latency_ms),
    totalInputTokens: r.total_input_tokens ?? 0,
    totalOutputTokens: r.total_output_tokens ?? 0,
  })));
});

// Timeline data
analyticsRouter.get('/timeline', (req: Request, res: Response) => {
  const range = (req.query.range as string) ?? '7d';
  const interval = (req.query.interval as string) ?? (range === '24h' ? 'hour' : 'day');
  const since = getSinceTimestamp(range);
  const db = getDb();

  // dateFormat is a hardcoded whitelist — never user-controlled.
  const dateFormat = interval === 'hour' ? '%Y-%m-%dT%H:00:00' : '%Y-%m-%d';

  const rows = db.prepare(`
    SELECT
      strftime('${dateFormat}', created_at) as timestamp,
      COUNT(*) as requests,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failure_count
    FROM requests
    WHERE created_at >= ?
    GROUP BY strftime('${dateFormat}', created_at)
    ORDER BY timestamp ASC
  `).all(since) as any[];

  res.json(rows.map(r => ({
    timestamp: r.timestamp,
    requests: r.requests,
    successCount: r.success_count,
    failureCount: r.failure_count,
  })));
});

// Daily token heatmap for the dashboard usage overview.
analyticsRouter.get('/daily-token-heatmap', (req: Request, res: Response) => {
  const year = parseHeatmapYear(req.query.year);
  if (year !== null) {
    res.json(buildDailyTokenHeatmap(getDb(), { mode: 'year', year }));
    return;
  }

  const weeks = parseHeatmapWeeks(req.query.weeks);
  res.json(buildDailyTokenHeatmap(getDb(), { mode: 'weeks', weeks }));
});

// Error distribution (grouped by error type and platform)
analyticsRouter.get('/error-distribution', (req: Request, res: Response) => {
  const range = (req.query.range as string) ?? '7d';
  const since = getSinceTimestamp(range);
  const db = getDb();

  // Group errors by category (extract the key part of the error message)
  const rows = db.prepare(`
    SELECT
      platform,
      model_id,
      CASE
        WHEN error LIKE '%429%' OR error LIKE '%rate limit%' OR error LIKE '%too many%' OR error LIKE '%quota%' THEN 'Rate Limited (429)'
        WHEN error LIKE '%401%' OR error LIKE '%unauthorized%' OR error LIKE '%invalid.*key%' THEN 'Auth Error (401)'
        WHEN error LIKE '%403%' OR error LIKE '%forbidden%' THEN 'Forbidden (403)'
        WHEN error LIKE '%404%' OR error LIKE '%not found%' THEN 'Not Found (404)'
        WHEN error LIKE '%timeout%' OR error LIKE '%ETIMEDOUT%' OR error LIKE '%ECONNREFUSED%' THEN 'Timeout/Connection'
        WHEN error LIKE '%500%' OR error LIKE '%internal server%' THEN 'Server Error (500)'
        WHEN error LIKE '%503%' OR error LIKE '%unavailable%' THEN 'Unavailable (503)'
        ELSE 'Other'
      END as error_category,
      COUNT(*) as count
    FROM requests
    WHERE status = 'error' AND created_at >= ?
    GROUP BY platform, error_category
    ORDER BY count DESC
  `).all(since) as any[];

  // Also get totals by category
  const byCategory = db.prepare(`
    SELECT
      CASE
        WHEN error LIKE '%429%' OR error LIKE '%rate limit%' OR error LIKE '%too many%' OR error LIKE '%quota%' THEN 'Rate Limited (429)'
        WHEN error LIKE '%401%' OR error LIKE '%unauthorized%' OR error LIKE '%invalid.*key%' THEN 'Auth Error (401)'
        WHEN error LIKE '%403%' OR error LIKE '%forbidden%' THEN 'Forbidden (403)'
        WHEN error LIKE '%404%' OR error LIKE '%not found%' THEN 'Not Found (404)'
        WHEN error LIKE '%timeout%' OR error LIKE '%ETIMEDOUT%' OR error LIKE '%ECONNREFUSED%' THEN 'Timeout/Connection'
        WHEN error LIKE '%500%' OR error LIKE '%internal server%' THEN 'Server Error (500)'
        WHEN error LIKE '%503%' OR error LIKE '%unavailable%' THEN 'Unavailable (503)'
        ELSE 'Other'
      END as category,
      COUNT(*) as count
    FROM requests
    WHERE status = 'error' AND created_at >= ?
    GROUP BY category
    ORDER BY count DESC
  `).all(since) as any[];

  // Errors by platform
  const byPlatform = db.prepare(`
    SELECT platform, COUNT(*) as count
    FROM requests
    WHERE status = 'error' AND created_at >= ?
    GROUP BY platform
    ORDER BY count DESC
  `).all(since) as any[];

  res.json({
    byCategory,
    byPlatform,
    detailed: rows,
  });
});

// Recent errors
analyticsRouter.get('/errors', (req: Request, res: Response) => {
  const range = (req.query.range as string) ?? '7d';
  const since = getSinceTimestamp(range);
  const db = getDb();

  const rows = db.prepare(`
    SELECT id, platform, model_id, error, latency_ms, created_at
    FROM requests
    WHERE status = 'error' AND created_at >= ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(since) as any[];

  res.json(rows.map(r => ({
    id: r.id,
    platform: r.platform,
    modelId: r.model_id,
    error: r.error,
    latencyMs: r.latency_ms,
    createdAt: r.created_at,
  })));
});
