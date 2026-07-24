import React from 'react';
import DropdownMenu from '../../molecules/DropdownMenu';
import { Group } from '../../../types/api';
import { API_BASE } from '../../../services/api/config';

interface GroupsTableProps {
  groups: Group[];
  knowledgeCounts: Record<string, number>;
  permissionCounts: Record<string, number>;
  loading: boolean;
  error: string | null;
  onDelete: (group: Group) => void;
}

// Ported from group/.../templates/groups/allGroups.html + groupsView.js.
// Clicking a row (outside the actions cell) navigates to group details,
// same as legacy. Profile/Knowledge/Social still point at the legacy MPA —
// none of those destination pages are ported yet. The "Social" link target
// (/group/social/{id}) is copied as-is from the legacy template; nginx has
// no /group/ route today, so it's a pre-existing dead link there too, not
// something introduced by this port.
const GroupsTable: React.FC<GroupsTableProps> = ({
  groups, knowledgeCounts, permissionCounts, loading, error, onDelete,
}) => {
  const goToDetails = (groupId: number) => {
    window.location.href = `${API_BASE.GROUPS}/${groupId}`;
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
                    { label: 'Profile', href: `${API_BASE.GROUPS}/${group.id}` },
                    { label: 'Knowledge', href: `${API_BASE.GROUPS}/${group.id}/knowledge` },
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
