import React, { useEffect, useRef, useState } from 'react';
import { Chart, ChartConfiguration } from 'chart.js/auto';
import { getShortFriendList, getFriendAnalytics } from '../../../services/api/friendService';
import { AnalyticsRecord, ShortFriend } from '../../../types/api';
import { computeAnalyticsSeries } from '../../../utils/analyticsMath';
import Select from '../../atoms/Select';
import Input from '../../atoms/Input';
import Button from '../../atoms/Button';

// A canvas that (re)draws a Chart.js line chart whenever labels/data change —
// factored out only because this page needs the identical pattern three
// times (duration/frequency/intensity), not because it's meant to be reused
// elsewhere yet.
const LineChart: React.FC<{ label: string; color: string; labels: string[]; data: number[]; suggestedMax: number }> = ({
  label, color, labels, data, suggestedMax,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();
    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: { labels, datasets: [{ label, data, borderColor: color, tension: 0.1, fill: false }] },
      options: { responsive: true, scales: { y: { beginAtZero: true, suggestedMax } } },
    };
    chartRef.current = new Chart(canvasRef.current, config);
    return () => chartRef.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, color, JSON.stringify(labels), JSON.stringify(data), suggestedMax]);

  return <canvas ref={canvasRef} />;
};

// Ported from nginx/static/analytics/analytics.html + analytics.js —
// reached via the legacy "Stats" nav link (nginx.conf `location = /stats`
// serves analytics.html directly; no other legacy page links here). Friend
// selection and date range are entirely client-driven — there's no :id in
// the route, matching the legacy page's own <select>-based navigation.
//
// FriendController.getShortList (`/shortList`) and
// FriendAnalyticsController.getAnalyticsList (`/analyticsList`) already
// existed and match the legacy JS's calls exactly — no backend changes
// needed. The EMA smoothing math is ported byte-for-byte into
// utils/analyticsMath.ts rather than re-derived.
//
// "Add Data" is wired to an alert, same honest-stub treatment as
// CalendarBoard's "+ Add Context" — the legacy button had no click handler
// at all (dead), this at least tells the user why nothing happens.
const AnalyticsPage: React.FC = () => {
  const [friends, setFriends] = useState<ShortFriend[]>([]);
  const [friendId, setFriendId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [records, setRecords] = useState<AnalyticsRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getShortFriendList()
      .then((list) => setFriends([...list].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setError('Could not load the friend list.'));
  }, []);

  const handleApplyFilters = async () => {
    if (!friendId || !startDate || !endDate) {
      window.alert('Please fill in all fields.');
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      window.alert('End date must be after start date.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRecords(await getFriendAnalytics(Number(friendId), startDate, endDate));
    } catch {
      setError('Could not load analytics for this friend.');
    } finally {
      setLoading(false);
    }
  };

  const series = records && startDate && endDate ? computeAnalyticsSeries(records, startDate, endDate) : null;
  const maxOf = (arr: number[], floor: number) => Math.max(floor, ...arr, 0);

  return (
    <div className="max-w-6xl mx-auto pb-16">
      <h1 className="text-3xl font-medium text-brand text-center mb-1">Friendship Analytics</h1>
      <p className="text-gray-600 text-center mb-8">Visualizing the key factors of friendship: Duration, Frequency, and Intensity</p>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 flex flex-wrap items-end gap-6 justify-between">
        <Select
          label="Select Friend:"
          value={friendId}
          onChange={(e) => setFriendId(e.target.value)}
          options={[{ value: '', label: 'Select a Friend' }, ...friends.map((f) => ({ value: String(f.id), label: f.name }))]}
        />
        <div className="flex gap-4">
          <Input label="Start Date:" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="End Date:" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <Button onClick={handleApplyFilters} disabled={loading}>{loading ? 'Loading...' : 'Apply Filters'}</Button>
      </div>

      {error && <div className="text-red-600 text-center mb-4">{error}</div>}

      {series && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          <div className="bg-gray-50 rounded-xl shadow-sm p-5 text-center">
            <h3 className="font-medium mb-3">Duration (Hours)</h3>
            <LineChart label="Duration (Hours)" color="rgb(75, 192, 192)" labels={series.labels} data={series.duration} suggestedMax={maxOf(series.duration, 2)} />
          </div>
          <div className="bg-gray-50 rounded-xl shadow-sm p-5 text-center">
            <h3 className="font-medium mb-3">Frequency (Talks)</h3>
            <LineChart label="Frequency (Talks)" color="rgb(54, 162, 235)" labels={series.labels} data={series.frequency} suggestedMax={maxOf(series.frequency, 2)} />
          </div>
          <div className="bg-gray-50 rounded-xl shadow-sm p-5 text-center">
            <h3 className="font-medium mb-3">Intensity (Stars)</h3>
            <LineChart label="Intensity (Stars)" color="rgb(255, 99, 132)" labels={series.labels} data={series.intensity} suggestedMax={maxOf(series.intensity, 3)} />
          </div>
        </div>
      )}

      {records && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <h3 className="text-lg font-medium mb-3">Friendship Data</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-brand text-white">
                <th className="text-left p-2.5">Analytics Id</th>
                <th className="text-left p-2.5">Date</th>
                <th className="text-left p-2.5">Duration (Hours)</th>
                <th className="text-left p-2.5">Intensity (Stars)</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="p-2.5">{r.id}</td>
                  <td className="p-2.5">{r.date}</td>
                  <td className="p-2.5">{r.hours}</td>
                  <td className="p-2.5">{r.experience}</td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr><td colSpan={4} className="p-4 text-center text-gray-500">No data in this range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-center">
        <Button onClick={() => window.alert('Add Data functionality will be implemented in the future')}>Add Data</Button>
      </div>
    </div>
  );
};

export default AnalyticsPage;
