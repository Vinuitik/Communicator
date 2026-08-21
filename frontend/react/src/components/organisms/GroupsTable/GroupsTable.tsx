import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Group } from '../../../types/api';
import { groupDetailsPath } from '../../../utils/constants';
import { avatarColor } from '../../../utils/avatar';

interface GroupsTableProps {
  groups: Group[];
  memberCounts: Record<string, number>;
  knowledgeCounts: Record<string, number>;
  loading: boolean;
  error: string | null;
}

// Redesign handoff's Groups screen: 3-col cards (color tile, name, N people/N
// notes) replacing the old light-theme table. Row actions (Delete, the
// always-dead "Social" link, and the legacy "Profile"/"Knowledge" duplicate
// entries that both just pointed at GroupDetailsPage) are gone — the card's
// only affordance is "click to open", matching the handoff exactly and the
// precedent Stage 2 set on FriendsTable (actions live on the detail page now).
const GroupsTable: React.FC<GroupsTableProps> = ({ groups, memberCounts, knowledgeCounts, loading, error }) => {
  const navigate = useNavigate();

  if (loading) return <div className="text-center p-8 text-text-muted">Loading…</div>;
  if (error) return <div className="text-center p-8 text-bad">{error}</div>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {groups.map((group) => (
        <div
          key={group.id}
          onClick={() => navigate(groupDetailsPath(group.id))}
          className="bg-surface border border-hairline rounded-card p-[18px] cursor-pointer hover:border-accent/40 transition-colors"
        >
          <div className="w-11 h-11 rounded-[12px] mb-3.5" style={{ background: avatarColor(group.id) }} />
          <div className="text-[15px] font-bold text-text-primary">{group.name}</div>
          <div className="flex gap-3.5 mt-2.5 text-[11.5px] text-text-muted">
            <span><b className="text-text-emphasis">{memberCounts[group.id] ?? 0}</b> people</span>
            <span><b className="text-text-emphasis">{knowledgeCounts[group.id] ?? 0}</b> notes</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GroupsTable;
