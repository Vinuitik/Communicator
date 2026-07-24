import React, { useMemo } from 'react';
import { Friend } from '../../../types/api';
import Avatar from '../../atoms/Avatar';

interface CalendarBoardProps {
  friends: Friend[];
  loading: boolean;
  error: string | null;
  onOpenFriend: (friend: Friend) => void;
  onLogChat: (friend: Friend) => void;
  onAddFriend: () => void;
}

interface DayColumn {
  dayName: string;
  dateLabel: string;
  friends: Friend[];
  isToday: boolean;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Sorts friends into Mon-Sun columns (current week) plus an "overdue" bucket,
// mirroring calendarView/calendar.js renderCalendar exactly (including its
// day-index math: loop index 0-6 is Mon-Sun, JS Date#getDay() is Sun-Sat).
// GET /api/friend/thisWeek has no date param — it only ever returns the
// real current week, so there's nothing to page prev/next through; see
// WeekBoardHeader for how the prev/Today/next buttons are treated.
const useWeekColumns = (friends: Friend[]) => useMemo(() => {
  const today = new Date();
  const currentDay = today.getDay();
  const mondayOffset = currentDay === 0 ? -6 : -(currentDay - 1);
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const friendsByDay = new Map<number, Friend[]>();
  for (let i = 0; i < 7; i += 1) friendsByDay.set(i, []);
  const previousFriends: Friend[] = [];

  friends.forEach((friend) => {
    if (!friend.plannedSpeakingTime) return;
    const speakingDate = new Date(friend.plannedSpeakingTime);
    if (speakingDate < monday) {
      previousFriends.push(friend);
    } else {
      friendsByDay.get(speakingDate.getDay())!.push(friend);
    }
  });

  const columns: DayColumn[] = [];
  for (let i = 0; i < 7; i += 1) {
    const columnDate = new Date(monday);
    columnDate.setDate(monday.getDate() + i);
    const dayIndex = i === 6 ? 0 : i + 1;
    columns.push({
      dayName: DAY_NAMES[dayIndex],
      dateLabel: formatDate(columnDate),
      friends: friendsByDay.get(dayIndex) ?? [],
      isToday: columnDate.toDateString() === today.toDateString(),
    });
  }

  return { previousFriends, columns };
}, [friends]);

type Category = 'birthday' | 'family' | 'work' | 'personal';

const categoryFor = (friend: Friend): Category => {
  if (friend.isBirthdayThisWeek) return 'birthday';
  const experience = friend.experience?.toLowerCase() ?? '';
  if (experience.includes('family')) return 'family';
  if (experience.includes('work')) return 'work';
  return 'personal';
};

// bg-category-* classes must appear literally somewhere for Tailwind to
// generate them — this map is that literal usage.
const CATEGORY_DOT: Record<Category, string> = {
  personal: 'bg-category-personal',
  family: 'bg-category-family',
  work: 'bg-category-work',
  birthday: 'bg-category-birthday',
};

export const CATEGORY_LEGEND: { label: string; dot: string }[] = [
  { label: 'Personal', dot: 'bg-category-personal' },
  { label: 'Family', dot: 'bg-category-family' },
  { label: 'Work', dot: 'bg-category-work' },
  { label: 'Birthday', dot: 'bg-category-birthday' },
];

// The week-column "day-column catch-up board" from the redesign handoff —
// 8 horizontally-scrollable columns (Previous/overdue + Mon-Sun), a colored
// dot per category instead of the legacy's solid-color card backgrounds,
// and a "Log chat" button on every card that opens the quick-log modal
// instead of navigating away.
const CalendarBoard: React.FC<CalendarBoardProps> = ({ friends, loading, error, onOpenFriend, onLogChat, onAddFriend }) => {
  const { previousFriends, columns } = useWeekColumns(friends);

  const friendCard = (friend: Friend) => (
    <div
      key={friend.id}
      className={`bg-surface-2 border rounded-[10px] px-2.5 py-2.5 ${
        friend.isBirthdayThisWeek ? 'border-category-birthday/50' : 'border-white/[.06]'
      }`}
    >
      <div className="cursor-pointer" onClick={() => onOpenFriend(friend)}>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-sm flex-none ${CATEGORY_DOT[categoryFor(friend)]}`} />
          <span className="font-bold text-xs leading-tight text-text-primary">
            {friend.isBirthdayThisWeek ? `🎂 ${friend.name}` : friend.name}
          </span>
        </div>
        <div className="text-[10.5px] text-text-muted mt-1">{friend.relationshipType || friend.experience || ''}</div>
      </div>
      <button
        type="button"
        onClick={() => onLogChat(friend)}
        className="mt-2.5 w-full border-none bg-accent/16 text-accent-light text-[11px] font-bold py-1.5 rounded-md hover:bg-accent/28 transition-colors"
      >
        ✓ Log chat
      </button>
    </div>
  );

  const addButton = (
    <button
      type="button"
      onClick={onAddFriend}
      className="border border-dashed border-white/[.14] bg-transparent text-text-faint text-[11px] py-2 rounded-[7px] hover:text-text-muted transition-colors"
    >
      + Add
    </button>
  );

  if (loading) {
    return <div className="text-center p-8 text-text-muted">Loading…</div>;
  }
  if (error) {
    return <div className="text-center p-8 text-bad">{error}</div>;
  }

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-2">
      <div className="flex-none w-[152px] bg-bad/5 border border-bad/40 rounded-card p-[13px]">
        <div className="pb-2.5 mb-2.5 border-b border-hairline">
          <div className="font-bold text-[12.5px] text-bad">Previous</div>
          <div className="text-[10.5px] text-text-faint mt-0.5">Overdue</div>
        </div>
        <div className="flex flex-col gap-2 min-h-[220px]">
          {previousFriends.map(friendCard)}
          {addButton}
        </div>
      </div>
      {columns.map((col) => (
        <div
          key={col.dayName}
          className={`flex-none w-[170px] border rounded-card p-[13px] ${
            col.isToday ? 'bg-accent/[.08] border-accent/40' : 'bg-surface border-white/[.06]'
          }`}
        >
          <div className="pb-2.5 mb-2.5 border-b border-hairline">
            <div className={`font-bold text-[12.5px] ${col.isToday ? 'text-accent-light' : 'text-text-emphasis'}`}>
              {col.dayName}
            </div>
            <div className="text-[10.5px] text-text-faint mt-0.5">
              {col.dateLabel}{col.isToday ? ' · today' : ''}
            </div>
          </div>
          <div className="flex flex-col gap-2 min-h-[220px]">
            {col.friends.map(friendCard)}
            {addButton}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CalendarBoard;
