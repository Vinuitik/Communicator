// Deterministic per-friend avatar color + initials — no photo data is cheap
// to fetch in bulk (list endpoints don't return one), so every list/board
// view (Week board, Friends table, Insights "Needs attention", quick-log
// modal header) uses a colored initials tile keyed off the friend's id.
const PALETTE = ['#8B5CF6', '#3B82F6', '#EC4899', '#14B8A6', '#F59E0B', '#10B981', '#A78BFA', '#F472B6'];

export const avatarColor = (id: number): string => PALETTE[Math.abs(id) % PALETTE.length];

export const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};
