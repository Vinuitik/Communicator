import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chart, ChartConfiguration } from 'chart.js/auto';
import Avatar from '../../atoms/Avatar';
import SegmentedControl from '../../molecules/SegmentedControl';
import { useToast } from '../../molecules/Toast';
import { getShortFriendList, getFriendsCount, getFriendsThisWeek, getFriendAnalytics } from '../../../services/api/friendService';
import { ShortFriend, Friend, AnalyticsRecord } from '../../../types/api';
import { computeAnalyticsSeries, ANALYTICS_RANGES } from '../../../utils/analyticsMath';
import { calculateIntensityScore, getDaysDiff, getGradientColor, formatDaysDiff } from '../../../utils/friendMetrics';
import { avatarColor } from '../../../utils/avatar';
import { profilePath } from '../../../utils/constants';

type Metric = 'duration' | 'frequency' | 'intensity';

const METRICS: { value: Metric; label: string }[] = [
  { value: 'duration', label: 'Duration' },
  { value: 'frequency', label: 'Frequency' },
  { value: 'intensity', label: 'Intensity' },
];

const toDateStr = (d: Date) => d.toISOString().slice(0, 10);

// The redesign handoff's multi-line comparison (SVG mockup) rendered for
// real with Chart.js — same library the pre-redesign AnalyticsPage used,
// just one chart with N datasets (one per compared friend) instead of three
// single-friend charts.
const CompareChart: React.FC<{ labels: string[]; datasets: { label: string; color: string; data: number[] }[] }> = ({ labels, datasets }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();
    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels,
        datasets: datasets.map((d) => ({
          label: d.label, data: d.data, borderColor: d.color, tension: 0.15, fill: false, pointRadius: 0, borderWidth: 2.5,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#9A93A8' } },
          x: { grid: { display: false }, ticks: { color: '#6B6478', maxTicksLimit: 8 } },
        },
      },
    };
    chartRef.current = new Chart(canvasRef.current, config);
    return () => chartRef.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(labels), JSON.stringify(datasets)]);

  return <canvas ref={canvasRef} height={220} />;
};

// Renamed from AnalyticsPage per the redesign handoff (README backlog: "Stats"
// -> "Insights"). KPI strip + Needs-attention reuse the same cheap calls the
// Week/Friends pages already use (shortList/count/thisWeek — no new backend).
// "Talked this month" has no aggregate endpoint (FriendDTO/ShortFriendDTO
// carry EMA summaries, not raw per-day records), so it's computed for real
// from one getFriendAnalytics call per friend scoped to the current month —
// fine at this app's personal-CRM scale (dozens of friends, one page load),
// not something that'd survive at SaaS scale. The AI analysis panel stays a
// designed placeholder — confirmed no cross-friend AI backend exists yet.
const InsightsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [shortList, setShortList] = useState<ShortFriend[]>([]);
  const [totalFriends, setTotalFriends] = useState(0);
  const [overdueFriends, setOverdueFriends] = useState<Friend[]>([]);
  const [talkedThisMonth, setTalkedThisMonth] = useState<number | null>(null);

  const [metric, setMetric] = useState<Metric>('intensity');
  const [range, setRange] = useState('6M');
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [compareSeries, setCompareSeries] = useState<Record<number, AnalyticsRecord[]>>({});
  const [addOpen, setAddOpen] = useState(false);

  const rangeDef = ANALYTICS_RANGES.find((r) => r.value === range) ?? ANALYTICS_RANGES[2];
  const endDate = useMemo(() => new Date(), []);
  const startDate = useMemo(() => {
    const d = new Date(endDate);
    d.setDate(d.getDate() - rangeDef.days);
    return d;
  }, [endDate, rangeDef.days]);

  useEffect(() => {
    Promise.all([getShortFriendList(), getFriendsCount(), getFriendsThisWeek()])
      .then(([short, count, week]) => {
        setShortList(short);
        setTotalFriends(count);
        setOverdueFriends([...week].filter((f) => getDaysDiff(f.plannedSpeakingTime) < 0)
          .sort((a, b) => getDaysDiff(a.plannedSpeakingTime) - getDaysDiff(b.plannedSpeakingTime)));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (shortList.length === 0) return;
    const now = new Date();
    const monthStart = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
    const monthEnd = toDateStr(now);
    let cancelled = false;
    Promise.all(shortList.map((f) => getFriendAnalytics(f.id, monthStart, monthEnd).catch(() => [] as AnalyticsRecord[])))
      .then((lists) => { if (!cancelled) setTalkedThisMonth(lists.reduce((sum, l) => sum + l.length, 0)); });
    return () => { cancelled = true; };
  }, [shortList]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(compareIds.map((id) =>
      getFriendAnalytics(id, toDateStr(startDate), toDateStr(endDate))
        .then((records) => [id, records] as const)
        .catch(() => [id, []] as const),
    )).then((pairs) => { if (!cancelled) setCompareSeries(Object.fromEntries(pairs)); });
    return () => { cancelled = true; };
  }, [compareIds, startDate, endDate]);

  const avgIntensity = useMemo(() => {
    const scores = shortList.map(calculateIntensityScore).filter((s) => s > 0);
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  }, [shortList]);

  const nameById = useMemo(() => Object.fromEntries(shortList.map((f) => [f.id, f.name])), [shortList]);

  const chart = useMemo(() => {
    if (compareIds.length === 0) return null;
    const start = toDateStr(startDate);
    const end = toDateStr(endDate);
    let labels: string[] = [];
    const datasets = compareIds.map((id) => {
      const series = computeAnalyticsSeries(compareSeries[id] ?? [], start, end);
      labels = series.labels;
      return { label: nameById[id] ?? `#${id}`, color: avatarColor(id), data: series[metric] };
    });
    return { labels, datasets };
  }, [compareIds, compareSeries, metric, startDate, endDate, nameById]);

  const candidateFriends = shortList.filter((f) => !compareIds.includes(f.id));
  const addCompare = (id: number) => { setCompareIds((prev) => [...prev, id]); setAddOpen(false); };
  const removeCompare = (id: number) => setCompareIds((prev) => prev.filter((c) => c !== id));

  const metricLabel = METRICS.find((m) => m.value === metric)?.label ?? metric;
  const rangeLabel = ANALYTICS_RANGES.find((r) => r.value === range)?.label ?? range;

  return (
    <div className="animate-ftfade max-w-[1100px] mx-auto px-[30px] py-6">
      <div className="flex justify-between items-start mb-[18px] gap-3 flex-wrap">
        <div>
          <h1 className="m-0 font-display font-bold text-[26px] tracking-tight text-text-primary">Insights</h1>
          <p className="mt-[5px] mb-0 text-text-muted text-[13px]">Query, compare and analyse your relationship data.</p>
        </div>
        <button
          type="button"
          onClick={() => showToast('Cross-friend AI analysis ships in a later pass')}
          style={{ padding: '10px 16px' }}
          className="flex items-center gap-1.5 border-none bg-accent-gradient text-white font-bold text-[13px] rounded-[10px] shadow-button hover:brightness-110 transition-all"
        >
          <span>✦</span> Ask AI to analyse
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-4">
        <div className="bg-surface border border-hairline rounded-card p-4">
          <div className="text-[11.5px] text-text-muted">Total friends</div>
          <div className="font-display font-bold text-[26px] mt-1 text-text-primary">{totalFriends}</div>
        </div>
        <div className="bg-surface border border-hairline rounded-card p-4">
          <div className="text-[11.5px] text-text-muted">Overdue</div>
          <div className="font-display font-bold text-[26px] mt-1 text-bad">{overdueFriends.length}</div>
        </div>
        <div className="bg-surface border border-hairline rounded-card p-4">
          <div className="text-[11.5px] text-text-muted">Avg intensity</div>
          <div className="font-display font-bold text-[26px] mt-1 text-good">{avgIntensity > 0 ? avgIntensity.toFixed(1) : '—'}</div>
        </div>
        <div className="bg-surface border border-hairline rounded-card p-4">
          <div className="text-[11.5px] text-text-muted">Talked this month</div>
          <div className="font-display font-bold text-[26px] mt-1 text-text-primary">{talkedThisMonth ?? '…'}</div>
        </div>
      </div>

      <div className="bg-surface border border-hairline rounded-card p-4 mb-4 flex flex-wrap gap-4 items-center">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] font-bold tracking-[.06em] text-text-faint">METRIC</span>
          <SegmentedControl options={METRICS} value={metric} onChange={(v) => setMetric(v as Metric)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] font-bold tracking-[.06em] text-text-faint">FRIENDS (COMPARE)</span>
          <div className="flex gap-1.5 items-center flex-wrap">
            {compareIds.map((id) => (
              <span key={id} className="flex items-center gap-1.5 bg-input border rounded-lg px-2.5 py-1.5 text-[12.5px]" style={{ borderColor: `${avatarColor(id)}59` }}>
                <span className="w-2 h-2 rounded-full flex-none" style={{ background: avatarColor(id) }} />
                {nameById[id] ?? `#${id}`}
                <button type="button" onClick={() => removeCompare(id)} className="text-text-faint hover:text-bad transition-colors">✕</button>
              </span>
            ))}
            <div className="relative">
              <button
                type="button"
                onClick={() => setAddOpen((v) => !v)}
                className="border border-dashed border-white/[.16] bg-transparent text-text-muted rounded-lg px-2.5 py-1.5 text-[12.5px] hover:text-text-emphasis transition-colors"
              >
                + Add
              </button>
              {addOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAddOpen(false)} />
                  <div className="absolute left-0 top-full mt-1.5 w-48 max-h-64 overflow-y-auto bg-modal border border-white/10 rounded-lg shadow-modal z-20 py-1">
                    {candidateFriends.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-text-faint">No more friends to add.</div>
                    ) : (
                      candidateFriends.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => addCompare(f.id)}
                          className="block w-full text-left px-3 py-2 text-[12.5px] text-text-secondary hover:bg-input transition-colors"
                        >
                          {f.name}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 lg:ml-auto">
          <span className="text-[10.5px] font-bold tracking-[.06em] text-text-faint">TIMELINE</span>
          <SegmentedControl options={ANALYTICS_RANGES.map((r) => ({ value: r.value, label: r.label }))} value={range} onChange={setRange} />
        </div>
      </div>

      <div className="bg-surface border border-hairline rounded-card p-5 mb-4">
        <div className="flex justify-between items-center mb-3.5 flex-wrap gap-2">
          <h2 className="text-[15px] font-bold text-text-primary m-0">{metricLabel} over {rangeLabel}</h2>
          {chart && (
            <div className="flex gap-3.5 text-[11.5px]">
              {chart.datasets.map((d) => (
                <span key={d.label} className="flex items-center gap-1.5 text-text-secondary">
                  <span className="w-3.5 h-[3px] rounded-sm" style={{ background: d.color }} />
                  {d.label}
                </span>
              ))}
            </div>
          )}
        </div>
        {chart ? (
          <div style={{ height: 220 }}>
            <CompareChart labels={chart.labels} datasets={chart.datasets} />
          </div>
        ) : (
          <div className="text-center py-12 px-4 border border-dashed border-white/10 rounded-card">
            <div className="text-3xl opacity-50 mb-2.5">📊</div>
            <div className="text-sm text-text-muted font-semibold">No friends selected</div>
            <div className="text-xs text-text-faint mt-1">Hit <b className="text-accent-light">+ Add</b> above to compare friends.</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface border border-hairline rounded-card p-5">
          <h2 className="text-[15px] font-bold text-text-primary mb-3">Needs attention</h2>
          {overdueFriends.length === 0 ? (
            <div className="text-center py-6 px-3 border border-dashed border-white/10 rounded-card">
              <div className="text-[22px] opacity-50 mb-1.5">✨</div>
              <div className="text-xs text-text-muted font-semibold">Nobody's overdue right now.</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {overdueFriends.map((friend) => {
                const days = getDaysDiff(friend.plannedSpeakingTime);
                return (
                  <div
                    key={friend.id}
                    onClick={() => navigate(profilePath(friend.id))}
                    className="flex items-center gap-2.5 px-3 py-2.5 bg-surface-2 rounded-lg cursor-pointer hover:bg-input transition-colors"
                  >
                    <Avatar id={friend.id} name={friend.name} size={30} />
                    <span className="flex-1 text-[13px] font-semibold text-text-primary">{friend.name}</span>
                    <span className="text-[12px] font-bold" style={{ color: getGradientColor(days) }}>{formatDaysDiff(days)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-hero-grad border border-accent/25 rounded-card p-5 flex flex-col">
          <h2 className="text-[15px] font-bold text-text-primary mb-1.5 flex items-center gap-2">
            <span className="text-accent-light">✦</span> AI analysis
            <span className="text-[10px] font-bold text-soon bg-soon/[.14] px-2 py-0.5 rounded-pill ml-auto">PLANNED</span>
          </h2>
          <p className="mb-3.5 text-xs text-text-muted">
            Ask in plain language — "who am I drifting from?", "compare {shortList[0]?.name ?? 'Diego'} and {shortList[1]?.name ?? 'Marcus'} this year".
          </p>
          <div className="flex flex-col gap-2">
            <div className="px-3 py-2.5 bg-surface-2 rounded-lg text-xs text-text-secondary">Who am I at risk of losing touch with?</div>
            <div className="px-3 py-2.5 bg-surface-2 rounded-lg text-xs text-text-secondary">Which friendships are getting stronger?</div>
          </div>
          <div className="mt-auto flex gap-2.5 pt-4">
            <div className="flex-1 bg-input border border-white/10 rounded-input px-3 py-2.5 text-text-faint text-[12.5px]">Ask anything…</div>
            <button type="button" disabled className="border-none bg-accent-gradient text-white font-bold px-3.5 rounded-input opacity-50 cursor-not-allowed">→</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsightsPage;
