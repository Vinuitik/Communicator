import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FriendsTable from '../../organisms/FriendsTable';
import QuickLogModal from '../../organisms/QuickLogModal';
import Pagination from '../../molecules/Pagination';
import { Friend } from '../../../types/api';
import { getFriendsPage, getFriendsCount, getFriendsThisWeek } from '../../../services/api/friendService';
import { getDaysDiff } from '../../../utils/friendMetrics';
import { DEFAULTS, profilePath } from '../../../utils/constants';

type Filter = 'all' | 'overdue' | 'week';

// The full sortable Friends table (was HomePage's job pre-redesign — see
// HomePage, which now owns the Week board instead). "Overdue"/"This week"
// chips reuse GET /thisWeek (already fetches the full due-soon set) and
// filter client-side by days-until-due — no new endpoint needed. "All"
// keeps the original paginated flow.
const FriendsPage: React.FC = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [allFriends, setAllFriends] = useState<Friend[]>([]);
  const [weekFriends, setWeekFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logTarget, setLogTarget] = useState<Friend | null>(null);

  // Loaded once, independent of `filter` — powers both the Overdue/This-week
  // chip counts and their filtered content.
  useEffect(() => {
    getFriendsThisWeek().then(setWeekFriends).catch(() => setWeekFriends([]));
  }, []);

  const loadAll = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFriendsPage(targetPage - 1, DEFAULTS.PAGE_SIZE);
      try {
        const count = await getFriendsCount();
        setTotalCount(count);
        setTotalPages(Math.max(1, Math.ceil(count / DEFAULTS.PAGE_SIZE)));
      } catch {
        setTotalCount(data.length);
        setTotalPages(Math.max(1, Math.ceil(data.length / DEFAULTS.PAGE_SIZE)));
      }
      setAllFriends(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load friends.');
      setAllFriends([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (filter === 'all') loadAll(page);
  }, [filter, page, loadAll]);

  const overdueFriends = useMemo(
    () => weekFriends.filter((f) => getDaysDiff(f.plannedSpeakingTime) < 0),
    [weekFriends],
  );
  const dueThisWeekFriends = useMemo(
    () => weekFriends.filter((f) => getDaysDiff(f.plannedSpeakingTime) >= 0),
    [weekFriends],
  );

  const sortByUrgency = (list: Friend[]) =>
    [...list].sort((a, b) => getDaysDiff(a.plannedSpeakingTime) - getDaysDiff(b.plannedSpeakingTime));

  const visibleFriends = filter === 'all' ? sortByUrgency(allFriends)
    : filter === 'overdue' ? sortByUrgency(overdueFriends)
    : sortByUrgency(dueThisWeekFriends);

  const chips: { key: Filter; label: string; count: number | null }[] = [
    { key: 'all', label: 'All', count: filter === 'all' ? totalCount : null },
    { key: 'overdue', label: 'Overdue', count: overdueFriends.length },
    { key: 'week', label: 'This week', count: dueThisWeekFriends.length },
  ];

  const handleOpenFriend = (friend: Friend) => navigate(profilePath(friend.id));
  const handleSaved = () => {
    getFriendsThisWeek().then(setWeekFriends).catch(() => {});
    if (filter === 'all') loadAll(page);
  };

  return (
    <div className="px-[30px] py-[26px] max-w-[1100px] mx-auto animate-ftfade">
      <div className="flex justify-between items-center mb-4.5 flex-wrap gap-3">
        <div>
          <h1 className="m-0 font-display font-bold text-[26px] tracking-tight text-text-primary">All friends</h1>
          <p className="mt-1 text-[13px] text-text-muted">
            {totalCount || allFriends.length} people · sorted by who needs attention
          </p>
        </div>
        <div className="flex gap-1.5">
          {chips.map((chip) => {
            const active = filter === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => { setFilter(chip.key); setPage(1); }}
                className={`px-3.5 py-2 rounded-lg border text-[12.5px] transition-colors ${
                  active
                    ? 'border-white/[.12] bg-input text-text-emphasis font-semibold'
                    : 'border-white/[.06] bg-transparent text-text-muted hover:text-text-emphasis'
                }`}
              >
                {chip.label}{chip.count !== null ? ` ${chip.count}` : ''}
              </button>
            );
          })}
        </div>
      </div>

      <FriendsTable
        friends={visibleFriends}
        loading={filter === 'all' ? loading : false}
        error={filter === 'all' ? error : null}
        onOpenFriend={handleOpenFriend}
        onLogChat={setLogTarget}
      />

      {filter === 'all' && (
        <Pagination
          infoText={`Showing ${totalCount === 0 ? 0 : (page - 1) * DEFAULTS.PAGE_SIZE + 1}-${Math.min(page * DEFAULTS.PAGE_SIZE, totalCount)} of ${totalCount} friends`}
          currentPage={page}
          totalPages={totalPages}
          showControls
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          onGoToPage={(p) => setPage(p)}
        />
      )}

      <QuickLogModal friend={logTarget} onClose={() => setLogTarget(null)} onSaved={handleSaved} />
    </div>
  );
};

export default FriendsPage;
