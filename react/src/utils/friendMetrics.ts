import { Friend } from '../types/api';

// Ported from nginx/static/mainPage/index.js — drives the friends-list
// "days until due" and "intensity score" red→yellow→green cell coloring.

export const getDaysDiff = (plannedDateStr?: string | null): number => {
    if (!plannedDateStr) return NaN;
    const today = new Date();
    const plannedDate = new Date(plannedDateStr);
    if (isNaN(plannedDate.getTime())) return NaN;
    today.setHours(0, 0, 0, 0);
    plannedDate.setHours(0, 0, 0, 0);
    return Math.floor((plannedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const interpolateRedYellowGreen = (percent: number): string => {
    if (percent < 0.5) {
        const ratio = percent / 0.5;
        return `rgb(${192 + (255 - 192) * ratio}, ${57 + (226 - 57) * ratio}, ${43 + (31 - 43) * ratio})`;
    }
    const ratio = (percent - 0.5) / 0.5;
    return `rgb(${255 + (46 - 255) * ratio}, ${226 + (204 - 226) * ratio}, ${31 + (64 - 31) * ratio})`;
};

export const getGradientColor = (daysDiff: number): string => {
    if (isNaN(daysDiff)) return '#999';
    const min = -7, max = 7;
    const clamped = Math.max(min, Math.min(max, daysDiff));
    return interpolateRedYellowGreen((clamped - min) / (max - min));
};

export const getIntensityGradientColor = (intensityScore: number): string => {
    if (isNaN(intensityScore)) return '#999';
    const min = 0, max = 10;
    const clamped = Math.max(min, Math.min(max, intensityScore));
    return interpolateRedYellowGreen(clamped / max);
};

export const calculateIntensityScore = (friend: Friend): number => {
    return (friend.averageFrequency || 0) + (friend.averageDuration || 0) + (friend.averageExcitement || 0);
};

export const formatDaysDiff = (daysDiff: number): string => {
    if (isNaN(daysDiff)) return 'No Date';
    if (daysDiff === 0) return 'Today';
    return daysDiff > 0 ? `+${daysDiff} days` : `${daysDiff} days`;
};
