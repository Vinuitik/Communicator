import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../../atoms/Avatar';
import { useToast } from '../../molecules/Toast';
import { getDeletedFriends, restoreFriend } from '../../../services/api/friendService';
import { Friend } from '../../../types/api';
import { profilePath } from '../../../utils/constants';

const RETENTION_DAYS = 7;

// Matches BinPurgeService's cutoff (deletedAt + 7 days) — display-only,
// the actual purge decision is made server-side.
const daysUntilPurge = (deletedAt: string): number => {
  const purgeAt = new Date(deletedAt).getTime() + RETENTION_DAYS * 86400000;
  return Math.max(0, Math.ceil((purgeAt - Date.now()) / 86400000));
};

const BinPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFriends(await getDeletedFriends());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the bin.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRestore = async (friend: Friend) => {
    setRestoringId(friend.id);
    try {
      await restoreFriend(friend.id);
      setFriends((prev) => prev.filter((f) => f.id !== friend.id));
      showToast(`${friend.name} restored`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to restore friend.', 'error');
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="px-[30px] py-[26px] max-w-[1100px] mx-auto animate-ftfade">
      <button type="button" onClick={() => navigate(-1)} className="border-none bg-transparent text-text-muted text-[12.5px] mb-4 hover:text-text-emphasis transition-colors">
        ← Back
      </button>

      <h1 className="m-0 font-display font-bold text-[26px] tracking-tight text-text-primary">Bin</h1>
      <p className="mt-1 mb-5 text-[13px] text-text-muted">
        Deleted friends stay here for {RETENTION_DAYS} days before they're permanently removed.
      </p>

      {loading && <div className="text-center p-16 text-text-muted">Loading…</div>}
      {!loading && error && <div className="text-center p-16 text-bad">{error}</div>}
      {!loading && !error && friends.length === 0 && (
        <div className="text-center p-16 text-text-faint">
          <div className="text-[28px] mb-2">🗑</div>
          Bin is empty.
        </div>
      )}

      {!loading && !error && friends.length > 0 && (
        <div className="flex flex-col gap-2">
          {friends.map((friend) => (
            <div key={friend.id} className="flex items-center gap-3 bg-surface border border-hairline rounded-card p-3.5">
              <Avatar id={friend.id} name={friend.name} size={40} />
              <div className="flex-1 min-w-0">
                <div
                  className="font-semibold text-[14px] text-text-primary truncate cursor-pointer hover:text-accent-light"
                  onClick={() => navigate(profilePath(friend.id))}
                >
                  {friend.name}
                </div>
                <div className="text-[11.5px] text-text-faint mt-0.5">
                  {friend.deletedAt ? `Purged in ${daysUntilPurge(friend.deletedAt)} day${daysUntilPurge(friend.deletedAt) === 1 ? '' : 's'}` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRestore(friend)}
                disabled={restoringId === friend.id}
                className="border border-white/10 bg-input text-text-emphasis font-semibold text-[12.5px] px-3.5 py-2 rounded-input hover:bg-input-2 disabled:opacity-50 transition-colors"
              >
                {restoringId === friend.id ? 'Restoring…' : '↺ Restore'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BinPage;
