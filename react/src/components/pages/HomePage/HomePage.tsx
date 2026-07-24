import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CalendarBoard, { CATEGORY_LEGEND } from '../../organisms/CalendarBoard';
import QuickLogModal from '../../organisms/QuickLogModal';
import { Friend } from '../../../types/api';
import { getFriendsThisWeek } from '../../../services/api/friendService';
import { getDaysDiff } from '../../../utils/friendMetrics';
import { ROUTES, profilePath } from '../../../utils/constants';

// "Week" — the new home (see design_handoff_friends_tracker/README.md). Was
// CalendarPage/CalendarBoard's job; HomePage inherits it since '/' already
// routed here and this keeps route churn to just adding /friends (see
// FriendsPage, which now owns what HomePage used to render).
const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logTarget, setLogTarget] = useState<Friend | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFriendsThisWeek();
      setFriends(data);
    } catch {
      setError('Could not load friends data. Please try again later.');
      setFriends([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const overdueCount = friends.filter((f) => getDaysDiff(f.plannedSpeakingTime) < 0).length;
  const dueCount = friends.length - overdueCount;

  return (
    <div className="px-[30px] py-[26px] animate-ftfade">
      <div className="flex justify-between items-end mb-4.5 flex-wrap gap-3">
        <div>
          <h1 className="m-0 font-display font-bold text-[26px] tracking-tight text-text-primary">This week</h1>
          <p className="mt-1 text-[13px] text-text-muted">
            {overdueCount} overdue · {dueCount} due this week
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
          {/* No date-parameterized week endpoint exists (GET /thisWeek always
              returns the real current week) — these stay visual, like the nav
              search box, rather than faking navigation to weeks with no data. */}
          <div className="flex gap-1">
            <button type="button" disabled title="Only the current week has data" className="w-8 h-8 rounded-lg border border-white/10 bg-input text-text-muted opacity-40 cursor-not-allowed">‹</button>
            <button type="button" className="px-3 h-8 rounded-lg border border-accent/40 bg-accent/[.16] text-accent-lighter text-xs font-bold">Today</button>
            <button type="button" disabled title="Only the current week has data" className="w-8 h-8 rounded-lg border border-white/10 bg-input text-text-muted opacity-40 cursor-not-allowed">›</button>
          </div>
        </div>
      </div>

      <CalendarBoard
        friends={friends}
        loading={loading}
        error={error}
        onOpenFriend={(friend) => navigate(profilePath(friend.id))}
        onLogChat={(friend) => setLogTarget(friend)}
        onAddFriend={() => navigate(ROUTES.ADD_FRIEND)}
      />

      <QuickLogModal friend={logTarget} onClose={() => setLogTarget(null)} onSaved={() => load()} />
    </div>
  );
};

export default HomePage;
