import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../../atoms/Avatar';
import { getConnections } from '../../../services/api/connectionService';
import { getShortFriendList } from '../../../services/api/friendService';
import { Connection, ShortFriend } from '../../../types/api';
import { ROUTES, connectionDetailsPath } from '../../../utils/constants';

// Connections are pairwise relationship links between two friends — "how do
// these two people know each other" — same knowledge/permission tracking as
// Groups, but the owner is an unordered pair instead of a single friend.
const ConnectionsPage: React.FC = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [friendsById, setFriendsById] = useState<Record<number, ShortFriend>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [conns, friends] = await Promise.all([getConnections(), getShortFriendList()]);
      setConnections(conns);
      setFriendsById(Object.fromEntries(friends.map((f) => [f.id, f])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connections.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const nameOf = (friendId: number) => friendsById[friendId]?.name ?? `Friend #${friendId}`;

  return (
    <div className="animate-ftfade max-w-[1040px] mx-auto px-[30px] py-6">
      <div className="flex justify-between items-center mb-[18px] gap-3 flex-wrap">
        <div>
          <h1 className="m-0 font-display font-bold text-[26px] tracking-tight text-text-primary">Connections</h1>
          <p className="mt-[5px] mb-0 text-text-muted text-[13px]">How your friends know each other</p>
        </div>
        <Link
          to={ROUTES.CREATE_CONNECTION}
          style={{ padding: '9px 15px' }}
          className="border-none bg-accent-gradient text-white font-bold text-[13px] rounded-[10px] shadow-button hover:brightness-110 transition-all"
        >
          + New connection
        </Link>
      </div>

      {loading ? (
        <div className="text-center p-16 text-text-muted">Loading…</div>
      ) : error ? (
        <div className="text-center p-16 text-bad">{error}</div>
      ) : connections.length === 0 ? (
        <div className="text-center bg-surface border border-hairline rounded-card p-10">
          <h2 className="text-lg text-text-primary mb-2">No connections yet</h2>
          <p className="text-text-muted text-sm mb-5">Link two friends who know each other.</p>
          <Link
            to={ROUTES.CREATE_CONNECTION}
            className="inline-block px-4 py-2.5 rounded-input bg-accent-gradient text-white font-bold text-sm shadow-button-sm hover:brightness-110 transition-all"
          >
            Create your first connection
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {connections.map((c) => (
            <Link
              key={`${c.id.friend1Id}-${c.id.friend2Id}`}
              to={connectionDetailsPath(c.id.friend1Id, c.id.friend2Id)}
              className="flex items-center gap-3 px-3.5 py-3 bg-surface border border-hairline rounded-card hover:bg-surface-2 transition-colors"
            >
              <div className="flex items-center -space-x-2">
                <Avatar id={c.id.friend1Id} name={nameOf(c.id.friend1Id)} size={32} />
                <Avatar id={c.id.friend2Id} name={nameOf(c.id.friend2Id)} size={32} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold text-text-secondary truncate">
                  {nameOf(c.id.friend1Id)} ↔ {nameOf(c.id.friend2Id)}
                </div>
                {c.description && (
                  <div className="text-[12px] text-text-muted truncate">{c.description}</div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConnectionsPage;
