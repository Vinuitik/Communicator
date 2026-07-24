import React, { useCallback, useEffect, useState } from 'react';
import FriendsTable from '../../organisms/FriendsTable';
import Pagination from '../../molecules/Pagination';
import Button from '../../atoms/Button';
import { Friend } from '../../../types/api';
import { getFriendsPage, getFriendsCount, getFriendsThisWeek, removeFriend } from '../../../services/api/friendService';
import { DEFAULTS } from '../../../utils/constants';

type Mode = 'allFriends' | 'thisWeek';

// Ported from nginx/static/mainPage/index.html + index.js. "All Friends" and
// "This Week" are an in-page mode toggle in the legacy code (intercepted
// clicks on what look like nav links) — kept as page-local tabs here rather
// than duplicating them into the site-wide NavigationBar, which only makes
// sense once per page.
const HomePage: React.FC = () => {
  const [mode, setMode] = useState<Mode>('allFriends');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (targetMode: Mode, targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      let data: Friend[];
      if (targetMode === 'allFriends') {
        data = await getFriendsPage(targetPage - 1, DEFAULTS.PAGE_SIZE);
        try {
          const count = await getFriendsCount();
          setTotalCount(count);
          setTotalPages(Math.max(1, Math.ceil(count / DEFAULTS.PAGE_SIZE)));
        } catch {
          setTotalCount(data.length);
          setTotalPages(Math.max(1, Math.ceil(data.length / DEFAULTS.PAGE_SIZE)));
        }
      } else {
        data = await getFriendsThisWeek();
        setTotalCount(data.length);
        setTotalPages(1);
      }
      data.sort((a, b) => a.name.localeCompare(b.name));
      setFriends(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load friends.');
      setFriends([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(mode, page);
  }, [mode, page, load]);

  const handleModeChange = (nextMode: Mode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setPage(1);
  };

  const handleDelete = async (friend: Friend) => {
    try {
      await removeFriend(friend.id);
      await load(mode, page);
    } catch {
      window.alert('Failed to delete friend. Please try again.');
    }
  };

  const startItem = totalCount === 0 ? 0 : (page - 1) * DEFAULTS.PAGE_SIZE + 1;
  const endItem = Math.min(page * DEFAULTS.PAGE_SIZE, totalCount);
  const infoText = mode === 'allFriends'
    ? `Showing ${startItem}-${endItem} of ${totalCount} friends`
    : `Showing ${totalCount} friends`;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-medium text-gray-800 text-center mb-2">Friends Tracker</h1>
      <div className="flex justify-center gap-2 mb-2">
        <Button type="button" onClick={() => handleModeChange('allFriends')} className={mode !== 'allFriends' ? 'opacity-60' : ''}>
          All Friends
        </Button>
        <Button type="button" onClick={() => handleModeChange('thisWeek')} className={mode !== 'thisWeek' ? 'opacity-60' : ''}>
          This Week
        </Button>
      </div>
      <FriendsTable friends={friends} loading={loading} error={error} onDelete={handleDelete} />
      <Pagination
        infoText={infoText}
        currentPage={page}
        totalPages={totalPages}
        showControls={mode === 'allFriends'}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        onGoToPage={(p) => setPage(p)}
      />
    </div>
  );
};

export default HomePage;
