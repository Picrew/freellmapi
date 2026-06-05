import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/page-header'
import { useI18n } from '@/lib/i18n'

type TimeRange = '24h' | '7d' | '30d'

type DailyTokenHeatmapDay = {
  date: string
  tokens: number
  requests: number
  level: 0 | 1 | 2 | 3 | 4
  future: boolean
}

type DailyTokenHeatmapData = {
  weeks: number
  maxTokens: number
  totalTokens: number
  totalRequests: number
  avgDailyTokens: number
  peakDay: DailyTokenHeatmapDay | null
  days: DailyTokenHeatmapDay[]
}

function formatTokens(n?: number): string {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatHeatmapDate(date: string, language: string): string {
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

function Stat({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-semibold tabular-nums mt-1 ${className ?? ''}`}>{value}</p>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

const axisStyle = { fontSize: 11, fill: 'var(--muted-foreground)' } as const
const gridStyle = 'var(--border)'
const primaryFill = 'var(--foreground)'
const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const heatmapLevelClasses = [
  'border-border bg-muted/40',
  'border-sky-200 bg-sky-100 dark:border-sky-950 dark:bg-sky-950/90',
  'border-sky-300 bg-sky-300 dark:border-sky-800 dark:bg-sky-800',
  'border-blue-400 bg-blue-500 dark:border-blue-700 dark:bg-blue-700',
  'border-blue-500 bg-blue-700 dark:border-blue-500 dark:bg-blue-500',
] as const

function DailyTokenHeatmap({
  data,
  language,
  t,
}: {
  data?: DailyTokenHeatmapData
  language: string
  t: (text: string) => string
}) {
  if (!data) {
    return <p className="text-sm text-muted-foreground text-center py-8">{t('Loading…')}</p>
  }

  const peakDay = data.peakDay
  const locale = language === 'zh' ? 'zh-CN' : 'en-US'

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">{t('Past 17 weeks')}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t('Less')}</span>
          {heatmapLevelClasses.map((className, level) => (
            <span
              key={level}
              className={`h-3.5 w-3.5 rounded-[3px] border ${className}`}
              aria-hidden="true"
            />
          ))}
          <span>{t('More')}</span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="overflow-x-auto rounded-md border bg-background p-3">
          <div className="grid min-w-max grid-cols-[30px_max-content] gap-2">
            <div
              className="grid gap-1"
              style={{ gridTemplateRows: 'repeat(7, 0.875rem)' }}
            >
              {weekdayLabels.map(day => (
                <span
                  key={day}
                  className="h-3.5 text-[10px] leading-[0.875rem] text-muted-foreground"
                >
                  {t(day)}
                </span>
              ))}
            </div>
            <div
              aria-label={t('Daily token usage heatmap')}
              className="grid grid-flow-col gap-1"
              style={{ gridTemplateRows: 'repeat(7, 0.875rem)', gridAutoColumns: '0.875rem' }}
            >
              {data.days.map(day => (
                <span
                  key={day.date}
                  className={`h-3.5 w-3.5 rounded-[3px] border ${heatmapLevelClasses[day.level]} ${day.future ? 'opacity-30' : ''}`}
                  title={`${formatHeatmapDate(day.date, language)} · ${formatTokens(day.tokens)} ${t('tokens')} · ${day.requests.toLocaleString(locale)} ${t('requests')}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4 border-b pb-2">
            <span className="text-muted-foreground">{t('Total tokens')}</span>
            <span className="font-medium tabular-nums">{formatTokens(data.totalTokens)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 border-b pb-2">
            <span className="text-muted-foreground">{t('Daily average')}</span>
            <span className="font-medium tabular-nums">{formatTokens(data.avgDailyTokens)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 border-b pb-2">
            <span className="text-muted-foreground">{t('Peak day')}</span>
            <span className="font-medium tabular-nums">
              {peakDay ? `${formatHeatmapDate(peakDay.date, language)} · ${formatTokens(peakDay.tokens)}` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{t('Total requests')}</span>
            <span className="font-medium tabular-nums">{data.totalRequests.toLocaleString(locale)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const { language, t } = useI18n()
  const [range, setRange] = useState<TimeRange>('7d')

  const { data: summary } = useQuery({
    queryKey: ['analytics', 'summary', range],
    queryFn: () => apiFetch<any>(`/api/analytics/summary?range=${range}`),
  })

  const { data: byPlatform = [] } = useQuery({
    queryKey: ['analytics', 'by-platform', range],
    queryFn: () => apiFetch<any[]>(`/api/analytics/by-platform?range=${range}`),
  })

  const { data: timeline = [] } = useQuery({
    queryKey: ['analytics', 'timeline', range],
    queryFn: () => apiFetch<any[]>(`/api/analytics/timeline?range=${range}`),
  })

  const { data: byModel = [] } = useQuery({
    queryKey: ['analytics', 'by-model', range],
    queryFn: () => apiFetch<any[]>(`/api/analytics/by-model?range=${range}`),
  })

  const { data: errors = [] } = useQuery({
    queryKey: ['analytics', 'errors', range],
    queryFn: () => apiFetch<any[]>(`/api/analytics/errors?range=${range}`),
  })

  const { data: errorDist } = useQuery({
    queryKey: ['analytics', 'error-distribution', range],
    queryFn: () => apiFetch<{ byCategory: any[]; byPlatform: any[]; detailed: any[] }>(`/api/analytics/error-distribution?range=${range}`),
  })

  const { data: dailyTokenHeatmap } = useQuery<DailyTokenHeatmapData>({
    queryKey: ['analytics', 'daily-token-heatmap'],
    queryFn: () => apiFetch<DailyTokenHeatmapData>('/api/analytics/daily-token-heatmap?weeks=17'),
  })

  return (
    <div>
      <PageHeader
        title={t('Analytics')}
        description={t('Request volume, latency, token usage, and failures.')}
        actions={
          <div className="flex gap-1 rounded-md border p-0.5">
            {(['24h', '7d', '30d'] as TimeRange[]).map(r => (
              <Button
                key={r}
                variant={range === r ? 'secondary' : 'ghost'}
                size="xs"
                onClick={() => setRange(r)}
              >
                {r}
              </Button>
            ))}
          </div>
        }
      />

      <div className="space-y-6">
        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Stat label={t('Requests')} value={summary?.totalRequests ?? 0} />
          <Stat label={t('Success rate')} value={`${summary?.successRate ?? 0}%`} />
          <Stat label={t('Input tokens')} value={formatTokens(summary?.totalInputTokens)} />
          <Stat label={t('Output tokens')} value={formatTokens(summary?.totalOutputTokens)} />
          <Stat label={t('Avg latency')} value={`${summary?.avgLatencyMs ?? 0} ms`} />
          <Stat label={t('Est. savings')} value={`$${summary?.estimatedCostSavings ?? '0.00'}`} />
        </div>

        <Panel title={t('Daily token heatmap')}>
          <DailyTokenHeatmap data={dailyTokenHeatmap} language={language} t={t} />
        </Panel>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel title={t('Requests by provider')}>
            {byPlatform.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('No data yet')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byPlatform} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={gridStyle} />
                  <XAxis dataKey="platform" tick={axisStyle} tickLine={false} axisLine={{ stroke: gridStyle }} />
                  <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="requests" fill={primaryFill} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <Panel title={t('Avg latency by provider')}>
            {byPlatform.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('No data yet')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byPlatform} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={gridStyle} />
                  <XAxis dataKey="platform" tick={axisStyle} tickLine={false} axisLine={{ stroke: gridStyle }} />
                  <YAxis unit="ms" tick={axisStyle} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="avgLatencyMs" name={t('Latency (ms)')} fill="var(--muted-foreground)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <div className="lg:col-span-2">
            <Panel title={t('Requests over time')}>
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t('No data yet')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={timeline} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke={gridStyle} />
                    <XAxis dataKey="timestamp" tick={axisStyle} tickLine={false} axisLine={{ stroke: gridStyle }} />
                    <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} iconType="line" />
                    <Line type="monotone" dataKey="successCount" name={t('Success')} stroke={primaryFill} strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="failureCount" name={t('Failures')} stroke="var(--destructive)" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>

          <div className="lg:col-span-2">
            <Panel title={t('Per-model breakdown')}>
              {byModel.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t('No data yet')}</p>
              ) : (
                <div className="max-h-[360px] overflow-y-auto -mx-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">{t('Model')}</TableHead>
                        <TableHead>{t('Provider')}</TableHead>
                        <TableHead className="text-right">{t('Requests')}</TableHead>
                        <TableHead className="text-right">{t('Success')}</TableHead>
                        <TableHead className="text-right">{t('Latency')}</TableHead>
                        <TableHead className="text-right">{t('In tokens')}</TableHead>
                        <TableHead className="text-right pr-4">{t('Out tokens')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byModel.map((m: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="pl-4 text-sm font-medium">{m.displayName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{m.platform}</TableCell>
                          <TableCell className="text-right tabular-nums">{m.requests}</TableCell>
                          <TableCell className="text-right tabular-nums">{m.successRate}%</TableCell>
                          <TableCell className="text-right tabular-nums">{m.avgLatencyMs} ms</TableCell>
                          <TableCell className="text-right tabular-nums">{formatTokens(m.totalInputTokens)}</TableCell>
                          <TableCell className="text-right tabular-nums pr-4">{formatTokens(m.totalOutputTokens)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Panel>
          </div>

          <Panel title={t('Errors by provider')}>
            {!errorDist?.byPlatform?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('No errors')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={errorDist.byPlatform} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={gridStyle} />
                  <XAxis dataKey="platform" tick={axisStyle} tickLine={false} axisLine={{ stroke: gridStyle }} />
                  <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="var(--destructive)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <Panel title={t('Recent errors')}>
            {errors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('No errors')}</p>
            ) : (
              <div className="max-h-[240px] overflow-y-auto -mx-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">{t('Provider')}</TableHead>
                      <TableHead>{t('Message')}</TableHead>
                      <TableHead className="text-right pr-4">{t('Time')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errors.slice(0, 20).map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="pl-4 text-xs">{e.platform}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{e.error}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground tabular-nums pr-4">
                          {new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
