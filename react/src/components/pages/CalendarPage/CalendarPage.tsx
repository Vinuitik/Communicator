import React, { useEffect, useState } from 'react';
import CalendarBoard from '../../organisms/CalendarBoard';
import { Friend } from '../../../types/api';
import { getFriendsThisWeek } from '../../../services/api/friendService';

// Ported from nginx/static/calendarView/calendar.html + calendar.js.
const CalendarPage: React.FC = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getFriendsThisWeek();
        if (!cancelled) setFriends(data);
      } catch {
        if (!cancelled) setError('Could not load friends data. Please try again later.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <header className="text-center mb-2">
        <h1 className="text-3xl font-medium text-[#2c3e50] mb-2">Friend Relationship Management</h1>
        <div className="text-[#7f8c8d]">Keep track of your social connections</div>
      </header>
      <CalendarBoard friends={friends} loading={loading} error={error} />
    </div>
  );
};

export default CalendarPage;
