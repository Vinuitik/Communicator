import { AnalyticsRecord } from '../types/api';

// Ported 1:1 from nginx/static/analytics/analytics.js's updateCharts() data
// pipeline — same per-day bucketing, same asymmetric EMA (fast on days with
// new data, slow decay on days without), same alpha-per-experience-level
// tables. The magic alpha values aren't derived from anything documented in
// the legacy code either; kept exactly as-is rather than re-tuned.
const NEW_DATA_ALPHA: Record<string, number> = { '***': 0.6, '**': 0.7, '*': 0.8 };
const DECAY_ALPHA: Record<string, number> = { '***': 0.07, '**': 0.2, '*': 0.57 };

const emaWithAlphaArray = (arr: number[], alphaArr: number[]): number[] => {
  const ema: number[] = [];
  let previous = arr[0];
  for (let i = 0; i < arr.length; i++) {
    previous = alphaArr[i] * arr[i] + (1 - alphaArr[i]) * previous;
    ema.push(previous);
  }
  return ema;
};

export interface AnalyticsSeries {
  labels: string[];
  duration: number[];
  frequency: number[];
  intensity: number[];
}

// startDate/endDate are yyyy-MM-dd (the <input type="date"> value shape).
export const computeAnalyticsSeries = (
  data: AnalyticsRecord[],
  startDate: string,
  endDate: string
): AnalyticsSeries => {
  const filtered = data.filter((item) => {
    const d = new Date(item.date);
    return d >= new Date(startDate) && d <= new Date(endDate);
  });

  const totalDurationByDate: Record<string, number> = {};
  const frequencyByDate: Record<string, number> = {};
  const lastIntensityByDate: Record<string, number> = {};
  const feedbackByDate: Record<string, AnalyticsRecord> = {};

  filtered.forEach((item) => {
    const date = item.date;
    totalDurationByDate[date] = (totalDurationByDate[date] || 0) + item.hours;
    frequencyByDate[date] = (frequencyByDate[date] || 0) + 1;
    lastIntensityByDate[date] = item.experience === '*' ? 1 : item.experience === '**' ? 2 : 3;
    feedbackByDate[date] = item;
  });

  const allDates: string[] = [];
  const dateCounts: Record<string, number> = {};
  const intensityCounts: Record<string, number> = {};
  const durationCounts: Record<string, number> = {};
  const alphaArray: number[] = [];

  let currentDate = new Date(startDate);
  const endDateObj = new Date(endDate);
  let lastExperience = '*';

  while (currentDate <= endDateObj) {
    const dateString = currentDate.toISOString().split('T')[0];
    dateCounts[dateString] = frequencyByDate[dateString] || 0;
    intensityCounts[dateString] = lastIntensityByDate[dateString] || 0;
    durationCounts[dateString] = totalDurationByDate[dateString] || 0;

    const feedback = feedbackByDate[dateString];
    let alpha: number;
    if (feedback) {
      lastExperience = feedback.experience;
      alpha = NEW_DATA_ALPHA[feedback.experience];
    } else {
      alpha = DECAY_ALPHA[lastExperience];
    }
    alphaArray.push(alpha);
    allDates.push(dateString);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const frequencyData = allDates.map((date) => dateCounts[date]);
  const intensityData = allDates.map((date) => intensityCounts[date]);
  const durationData = allDates.map((date) => durationCounts[date]);

  return {
    labels: allDates,
    frequency: emaWithAlphaArray(frequencyData, alphaArray),
    intensity: emaWithAlphaArray(intensityData, alphaArray),
    duration: emaWithAlphaArray(durationData, alphaArray),
  };
};
