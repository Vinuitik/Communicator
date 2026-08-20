import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CalendarBoard, { CATEGORY_LEGEND } from '../../organisms/CalendarBoard';
import QuickLogModal from '../../organisms/QuickLogModal';
import { Friend, MeetingDTO } from '../../../types/api';
import { getThisWeek } from '../../../services/api/meetingService';
import { ROUTES, profilePath } from '../../../utils/constants';

// "Week" — the new home (see design_handoff_friends_tracker/README.md). Was
// CalendarPage/CalendarBoard's job; HomePage inherits it since '/' already
// routed here and this keeps route churn to just adding /friends (see
// FriendsPage, which now owns what HomePage used to render).
const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<MeetingDTO[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logTarget, setLogTarget] = useState<Friend | null>(null);

  const load = useCallback(async (offset: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getThisWeek(offset);
      setMeetings(data);
    } catch {
      setError('Could not load this week’s meetings. Please try again later.');
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(weekOffset); }, [load, weekOffset]);

  const doneCount = meetings.filter((m) => m.status === 'DONE').length;
  const proposedCount = meetings.length - doneCount;

  return (
    <div className="px-[30px] py-[26px] animate-ftfade">
      <div className="flex justify-between items-end mb-4 flex-wrap gap-3">
        <div>
          <h1 className="m-0 font-display font-bold text-[26px] tracking-tight text-text-primary">This week</h1>
          <p className="mt-1 text-[13px] text-text-muted">
            {weekOffset < 0
              ? `${doneCount} completed`
              : `${proposedCount} due this week`}
          </p>
        </div>
        <div className="flex items-center gap-3.5">
          <div className="flex gap-3 text-[11.5px] text-text-muted">
            {CATEGORY_LEGEND.map((item) => (
              <span key={item.label} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-sm ${item.dot}`} />
                {item.label}
              </span>
            ))}
          </div>
          {/* GET /meetings/thisWeek?weekOffset=N now exists — arrows page
              weekOffset by ±1 and refetch. Negative offsets read as a
              history/progress log (past DONE meetings come back too, only
              CANCELLED is excluded server-side). */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setWeekOffset((o) => o - 1)}
              className="w-8 h-8 rounded-lg border border-white/10 bg-input text-text-muted hover:text-text-emphasis hover:bg-input-2 transition-colors"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="px-3 h-8 rounded-lg border border-accent/40 bg-accent/[.16] text-accent-lighter text-xs font-bold"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((o) => o + 1)}
              className="w-8 h-8 rounded-lg border border-white/10 bg-input text-text-muted hover:text-text-emphasis hover:bg-input-2 transition-colors"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <CalendarBoard
        meetings={meetings}
        loading={loading}
        error={error}
        weekOffset={weekOffset}
        onOpenFriend={(friend) => navigate(profilePath(friend.id))}
        onLogChat={(friend) => setLogTarget(friend)}
        onAddFriend={() => navigate(ROUTES.ADD_FRIEND)}
      />

      <QuickLogModal friend={logTarget} onClose={() => setLogTarget(null)} onSaved={() => load(weekOffset)} />
    </div>
  );
};

export default HomePage;
