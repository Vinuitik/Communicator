import React from 'react';
import { useNavigate } from 'react-router-dom';
import DropdownMenu from '../../molecules/DropdownMenu';
import { Group } from '../../../types/api';
import { groupDetailsPath } from '../../../utils/constants';

interface GroupsTableProps {
  groups: Group[];
  knowledgeCounts: Record<string, number>;
  permissionCounts: Record<string, number>;
  loading: boolean;
  error: string | null;
  onDelete: (group: Group) => void;
}

// Ported from group/.../templates/groups/allGroups.html + groupsView.js
// (both since deleted — see nginx/PROTO.md's cutover note; this component
// is the only place their behavior still lives). Clicking a row (outside the
// actions cell) navigates to group details. Legacy actually navigated both
// the row-click and "Profile" link straight to the JSON API endpoint
// (GROUPS_BASE + '/' + id — a raw fetch URL, not a page) — groupDetails.html
// was dead code with no route ever rendering it, so there was no real page
// to link to. Now that GroupDetailsPage is real, both flip to it via
// groupDetailsPath() — "Knowledge" does too, since groupKnowledge.html's
// functionality was deliberately folded into GroupDetailsPage's "Notes"
// panel rather than given its own page (see GroupDetailsPage/FactsPage
// notes in PROTO.md). "Social" still points at a dead link
// (`/group/social/{id}`) — that was already broken in the legacy template
// (no matching nginx route ever existed, even before the MPA was removed)
// and there's no group-social feature anywhere to link it to instead.
const GroupsTable: React.FC<GroupsTableProps> = ({
  groups, knowledgeCounts, permissionCounts, loading, error, onDelete,
}) => {
  const navigate = useNavigate();
  const goToDetails = (groupId: number) => {
    navigate(groupDetailsPath(groupId));
  };

  return (
    <table className="w-full border-collapse bg-white rounded-lg shadow-sm overflow-visible">
      <thead>
        <tr>
          <th className="text-left p-4 bg-brand text-white font-medium">Group Name</th>
          <th className="text-left p-4 bg-brand text-white font-medium">Contacts</th>
          <th className="text-left p-4 bg-brand text-white font-medium">Notes</th>
          <th className="text-left p-4 bg-brand text-white font-medium">Settings</th>
          <th className="text-left p-4 bg-brand text-white font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr><td colSpan={5} className="text-center p-8">Loading...</td></tr>
        ) : error ? (
          <tr><td colSpan={5} className="text-center p-8 text-red-600">{error}</td></tr>
        ) : (
          groups.map((group) => (
            <tr
              key={group.id}
              className="hover:bg-gray-50 border-b border-gray-100 last:border-0 cursor-pointer"
              title="Click to view group details"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('.actions-cell')) return;
                goToDetails(group.id);
              }}
            >
              <td className="p-4"><span className="text-brand font-medium">{group.name}</span></td>
              <td className="p-4">
                <span className="font-semibold text-brand">0</span>
                <span className="block text-xs italic text-gray-400">Coming Soon</span>
              </td>
              <td className="p-4"><span className="font-semibold text-brand">{knowledgeCounts[group.id] ?? 0}</span></td>
              <td className="p-4"><span className="font-semibold text-brand">{permissionCounts[group.id] ?? 0}</span></td>
              <td className="p-4 relative actions-cell">
                <DropdownMenu
                  items={[
                    { label: 'Profile', onClick: () => navigate(groupDetailsPath(group.id)) },
                    { label: 'Knowledge', onClick: () => navigate(groupDetailsPath(group.id)) },
                    { label: 'Social', href: `/group/social/${group.id}` },
                    {
                      label: 'Delete', danger: true,
                      onClick: () => {
                        if (window.confirm(
                          'Are you sure you want to delete this group?\n\n' +
                          'This action will permanently delete:\n' +
                          '• The group and all its information\n' +
                          '• All associated knowledge items\n' +
                          '• All group permissions\n\n' +
                          'This action cannot be undone.',
                        )) {
                          onDelete(group);
                        }
                      },
                    },
                  ]}
                />
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
};

export default GroupsTable;
