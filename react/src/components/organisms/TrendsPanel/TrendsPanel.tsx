import React, { useEffect, useMemo, useState } from 'react';
import SegmentedControl from '../../molecules/SegmentedControl';
import { getFriendAnalytics } from '../../../services/api/friendService';
import { computeAnalyticsSeries } from '../../../utils/analyticsMath';
import { AnalyticsRecord } from '../../../types/api';

const RANGES = [
  { value: '1M', label: '1M', days: 30 },
  { value: '3M', label: '3M', days: 90 },
  { value: '6M', label: '6M', days: 180 },
  { value: '1Y', label: '1Y', days: 365 },
  { value: 'All', label: 'All', days: 3650 },
];

const toDateStr = (d: Date) => d.toISOString().slice(0, 10);

const toPoints = (values: number[], width = 220, height = 70): string => {
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values.map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`).join(' ');
};

interface TrendsPanelProps {
  friendId: number;
  friendName: string;
  onOpenInsights: () => void;
}

// Per-friend view of Insights (Stage 5) — reuses the exact same EMA pipeline
// (analyticsMath.ts's computeAnalyticsSeries) the old AnalyticsPage used,
// just scoped to one friend and rendered as three compact sparkline cards
// instead of one big Chart.js comparison chart.
const TrendsPanel: React.FC<TrendsPanelProps> = ({ friendId, friendName, onOpenInsights }) => {
  const [range, setRange] = useState('6M');
  const [records, setRecords] = useState<AnalyticsRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rangeDef = RANGES.find((r) => r.value === range) ?? RANGES[2];
  const endDate = useMemo(() => new Date(), []);
  const startDate = useMemo(() => {
    const d = new Date(endDate);
    d.setDate(d.getDate() - rangeDef.days);
    return d;
  }, [endDate, rangeDef.days]);

  useEffect(() => {
    let cancelled = false;
    getFriendAnalytics(friendId, toDateStr(startDate), toDateStr(endDate))
      .then((data) => { if (!cancelled) setRecords(data); })
      .catch(() => { if (!cancelled) setError('Not enough data yet'); });
    return () => { cancelled = true; };
  }, [friendId, startDate, endDate]);

  const series = records ? computeAnalyticsSeries(records, toDateStr(startDate), toDateStr(endDate)) : null;
  const hasData = (records?.length ?? 0) > 0;

  const charts = series && hasData ? [
    { label: 'Duration (hrs)', color: '#14B8A6', values: series.duration },
    { label: 'Frequency', color: '#3B82F6', values: series.frequency },
    { label: 'Intensity', color: '#EC4899', values: series.intensity },
  ] : [];

  return (
    <div>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2.5">
        <div>
          <h2 className="text-[15px] font-bold text-text-primary m-0">Trends for {friendName}</h2>
          <p className="mt-1 text-xs text-text-muted">Per-friend view of your Insights.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <SegmentedControl options={RANGES.map((r) => ({ value: r.value, label: r.label }))} value={range} onChange={setRange} />
          <button
            type="button"
            onClick={onOpenInsights}
            className="border border-white/10 bg-input text-accent-light text-xs font-semibold px-3.5 py-2 rounded-lg hover:bg-input-2 transition-colors"
          >
            Global insights →
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="text-center py-12 px-4 border border-dashed border-white/10 rounded-card">
          <div className="text-3xl opacity-50 mb-2.5">📈</div>
          <div className="text-sm text-text-muted font-semibold">{error ?? 'Not enough data yet'}</div>
          <div className="text-xs text-text-faint mt-1">Log a few chats and trends for {friendName} build up here.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {charts.map((chart) => {
            const latest = chart.values[chart.values.length - 1] ?? 0;
            return (
              <div key={chart.label} className="bg-surface border border-hairline rounded-card p-[18px]">
                <div className="text-[12.5px] font-semibold text-text-muted mb-2.5">{chart.label}</div>
                <svg viewBox="0 0 220 70" width="100%" height={70} preserveAspectRatio="none">
                  <polyline points={toPoints(chart.values)} fill="none" stroke={chart.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="font-display font-bold text-[22px] mt-2" style={{ color: chart.color }}>{latest.toFixed(1)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TrendsPanel;
