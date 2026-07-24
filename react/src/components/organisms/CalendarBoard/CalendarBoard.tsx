import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Friend } from '../../../types/api';
import { API_BASE } from '../../../services/api/config';
import { ROUTES } from '../../../utils/constants';

interface CalendarBoardProps {
  friends: Friend[];
  loading: boolean;
  error: string | null;
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

const categoryFor = (friend: Friend): 'birthday' | 'family' | 'work' | 'personal' => {
  if (friend.isBirthdayThisWeek) return 'birthday';
  const experience = friend.experience?.toLowerCase() ?? '';
  if (experience.includes('family')) return 'family';
  if (experience.includes('work')) return 'work';
  return 'personal';
};

const CATEGORY_CLASSES: Record<ReturnType<typeof categoryFor>, string> = {
  personal: 'bg-[#2ecc71]',
  family: 'bg-[#9b59b6]',
  work: 'bg-[#f39c12]',
  birthday: 'bg-gradient-to-br from-[#ff6b6b] to-[#ffd93d] border-2 border-[#ff4757] animate-birthday-pulse',
};

// Ported from calendarView/calendar.html + calendar.js. Renders the current
// week (Mon-Sun) plus a "Previous"/overdue column, exactly as the legacy
// page does client-side from GET /api/friend/thisWeek.
const CalendarBoard: React.FC<CalendarBoardProps> = ({ friends, loading, error }) => {
  const navigate = useNavigate();
  const { previousFriends, columns } = useWeekColumns(friends);

  const goToFriend = (friend: Friend) => {
    window.location.href = `${API_BASE.FRIEND}/talked/${friend.id}`;
  };

  const friendBox = (friend: Friend) => (
    <div
      key={friend.id}
      className={`text-white p-2.5 rounded mb-2.5 cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-md ${CATEGORY_CLASSES[categoryFor(friend)]}`}
      onClick={() => goToFriend(friend)}
    >
      <div className="font-bold">{friend.isBirthdayThisWeek ? `🎂 ${friend.name}` : friend.name}</div>
      <div className="text-xs mt-1 opacity-90">{friend.experience || ''}</div>
    </div>
  );

  if (loading) {
    return <div className="bg-white rounded-lg shadow-sm p-8 text-center">Loading...</div>;
  }
  if (error) {
    return <div className="bg-white rounded-lg shadow-sm p-8 text-center text-red-600">{error}</div>;
  }

  return (
    <div className="flex w-full overflow-x-auto bg-white rounded-lg shadow-sm">
      <div className="min-w-[120px] p-4 bg-gray-50 border-r border-gray-100">
        <div className="text-center pb-2.5 border-b-2 border-[#3498db] mb-4">
          <div className="font-bold text-[#2c3e50]">Previous</div>
          <div className="text-xs text-[#7f8c8d] mt-1">Overdue</div>
        </div>
        {previousFriends.map(friendBox)}
        <div
          className="text-center p-2.5 mt-4 rounded bg-[#ecf0f1] text-[#7f8c8d] cursor-pointer hover:bg-[#d6dbdf]"
          onClick={() => window.alert('Add context functionality will be implemented in the future')}
        >
          + Add Context
        </div>
      </div>
      {columns.map((column) => (
        <div
          key={column.dayName}
          className={`flex-1 min-w-[120px] p-4 border-r border-gray-100 last:border-0 ${column.isToday ? 'bg-[#fff9e6] border-2 border-[#f39c12]' : ''}`}
        >
          <div className={`text-center pb-2.5 border-b-2 mb-4 ${column.isToday ? 'border-[#f39c12]' : 'border-[#3498db]'}`}>
            <div className={`font-bold ${column.isToday ? 'text-[#f39c12]' : 'text-[#2c3e50]'}`}>{column.dayName}</div>
            <div className="text-xs text-[#7f8c8d] mt-1">{column.dateLabel}</div>
          </div>
          {column.friends.map(friendBox)}
          <div
            className="text-center p-2.5 mt-4 rounded bg-[#ecf0f1] text-[#7f8c8d] cursor-pointer hover:bg-[#d6dbdf]"
            onClick={() => navigate(ROUTES.ADD_FRIEND)}
          >
            + Add Friend
          </div>
        </div>
      ))}
    </div>
  );
};

export default CalendarBoard;
