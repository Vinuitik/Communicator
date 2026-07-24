import React from 'react';
import { useNavigate } from 'react-router-dom';
import DropdownMenu from '../../molecules/DropdownMenu';
import { Friend } from '../../../types/api';
import { API_BASE } from '../../../services/api/config';
import { talkedPath } from '../../../utils/constants';
import {
  getDaysDiff, getGradientColor, formatDaysDiff,
  calculateIntensityScore, getIntensityGradientColor,
} from '../../../utils/friendMetrics';

interface FriendsTableProps {
  friends: Friend[];
  loading: boolean;
  error: string | null;
  onDelete: (friend: Friend) => void;
}

// Ported from the <table> in nginx/static/mainPage/index.html + the row
// rendering in index.js. Profile/Knowledge/Groups/Connections still point at
// the legacy MPA — none of those pages are ported yet. Talked now navigates
// internally to TalkedPage.
const FriendsTable: React.FC<FriendsTableProps> = ({ friends, loading, error, onDelete }) => {
  const navigate = useNavigate();
  return (
    <table className="w-full border-collapse bg-white rounded-lg shadow-sm overflow-visible">
      <thead>
        <tr>
          <th className="text-left p-4 bg-brand text-white font-medium">Name</th>
          <th className="text-left p-4 bg-brand text-white font-medium">Planned Speaking Time</th>
          <th className="text-left p-4 bg-brand text-white font-medium">Intensity Score</th>
          <th className="text-left p-4 bg-brand text-white font-medium">Date of Birth</th>
          <th className="text-left p-4 bg-brand text-white font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr><td colSpan={5} className="text-center p-8">Loading...</td></tr>
        ) : error ? (
          <tr><td colSpan={5} className="text-center p-8 text-red-600">{error}</td></tr>
        ) : friends.length === 0 ? (
          <tr><td colSpan={5} className="text-center p-8 text-gray-500">No friends found.</td></tr>
        ) : (
          friends.map((friend) => {
            const daysDiff = getDaysDiff(friend.plannedSpeakingTime);
            const intensityScore = calculateIntensityScore(friend);
            return (
              <tr key={friend.id} className="hover:bg-gray-50 border-b border-gray-100 last:border-0">
                <td className="p-4">{friend.name || 'Unknown'}</td>
                <td className="p-4 font-bold" style={{ color: getGradientColor(daysDiff) }}>
                  {formatDaysDiff(daysDiff)}
                </td>
                <td className="p-4 font-bold" style={{ color: getIntensityGradientColor(intensityScore) }}>
                  {isNaN(intensityScore) ? 'N/A' : intensityScore.toFixed(2)}
                </td>
                <td className="p-4">{friend.dateOfBirth || ''}</td>
                <td className="p-4 relative">
                  <DropdownMenu
                    items={[
                      { label: 'Talked', onClick: () => navigate(talkedPath(friend.id)) },
                      { label: 'Profile', href: `${API_BASE.FRIEND}/profile/${friend.id}` },
                      { label: 'Knowledge', href: `${API_BASE.FRIEND}/knowledge/${friend.id}` },
                      { label: 'Groups', href: API_BASE.GROUPS },
                      { label: 'Connections', href: `${API_BASE.CONNECTIONS}/${friend.id}` },
                      {
                        label: 'Delete', danger: true,
                        onClick: () => {
                          if (window.confirm(`Are you sure you want to delete ${friend.name || 'this friend'}?`)) {
                            onDelete(friend);
                          }
                        },
                      },
                    ]}
                  />
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
};

export default FriendsTable;
