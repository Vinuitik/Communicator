import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import GroupsTable from '../../organisms/GroupsTable';
import { getGroups } from '../../../services/api/groupService';
import { getGroupFriends } from '../../../services/api/friendService';
import { Group } from '../../../types/api';
import { ROUTES } from '../../../utils/constants';

// Ported from group/.../templates/groups/allGroups.html + groupsView.js —
// restyled per the redesign handoff (README backlog item 5): "N people" used
// to be a static "Coming Soon" because friend<->group membership had no UI
// wired up. GroupMemberController's list endpoint already existed server-side
// (confirmed via repo grep), so real counts are one extra fetch per group
// rather than a placeholder.
const GroupsPage: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [knowledgeCounts, setKnowledgeCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getGroups();
      setGroups(data.groups);
      setKnowledgeCounts(data.knowledgeCounts);
      const counts = await Promise.all(
        data.groups.map((g) => getGroupFriends(g.id).then((friends) => friends.length).catch(() => 0)),
      );
      setMemberCounts(Object.fromEntries(data.groups.map((g, i) => [g.id, counts[i]])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load groups.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="animate-ftfade max-w-[1040px] mx-auto px-[30px] py-6">
      <div className="flex justify-between items-center mb-[18px] gap-3 flex-wrap">
        <div>
          <h1 className="m-0 font-display font-bold text-[26px] tracking-tight text-text-primary">Groups</h1>
          <p className="mt-[5px] mb-0 text-text-muted text-[13px]">Circles of people you keep track of together</p>
        </div>
        <Link
          to={ROUTES.CREATE_GROUP}
          style={{ padding: '9px 15px' }}
          className="border-none bg-accent-gradient text-white font-bold text-[13px] rounded-[10px] shadow-button hover:brightness-110 transition-all"
        >
          + New group
        </Link>
      </div>

      {!loading && !error && groups.length === 0 ? (
        <div className="text-center bg-surface border border-hairline rounded-card p-10">
          <h2 className="text-lg text-text-primary mb-2">No groups yet</h2>
          <p className="text-text-muted text-sm mb-5">Start organizing your friends into circles.</p>
          <Link
            to={ROUTES.CREATE_GROUP}
            className="inline-block px-4 py-2.5 rounded-input bg-accent-gradient text-white font-bold text-sm shadow-button-sm hover:brightness-110 transition-all"
          >
            Create your first group
          </Link>
        </div>
      ) : (
        <GroupsTable groups={groups} memberCounts={memberCounts} knowledgeCounts={knowledgeCounts} loading={loading} error={error} />
      )}
    </div>
  );
};

export default GroupsPage;
