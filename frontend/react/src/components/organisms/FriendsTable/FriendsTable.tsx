import React from 'react';
import Avatar from '../../atoms/Avatar';
import ProgressBar from '../../atoms/ProgressBar';
import { Friend } from '../../../types/api';
import {
  getDaysDiff, getGradientColor, formatDaysDiff,
  calculateIntensityScore, getIntensityGradientColor,
} from '../../../utils/friendMetrics';

interface FriendsTableProps {
  friends: Friend[];
  loading: boolean;
  error: string | null;
  onOpenFriend: (friend: Friend) => void;
  onLogChat: (friend: Friend) => void;
}

// Card-wrapped dark table from the redesign handoff. Row click -> Profile,
// "Log chat" opens the quick-log modal. The old triple-dot dropdown
// (Talked/Profile/Knowledge/Groups/Connections/Delete) is gone — the
// Profile hub (Stage 3) is now the single entry point for everything it
// used to fan out to, and Delete moves there too (design has no delete
// affordance on this screen).
const FriendsTable: React.FC<FriendsTableProps> = ({ friends, loading, error, onOpenFriend, onLogChat }) => {
  return (
    <div className="bg-surface border border-hairline rounded-card overflow-hidden">
      <div className="grid grid-cols-[2.4fr_1.5fr_1.5fr_1fr_130px] px-5 py-3.5 text-[10.5px] font-bold tracking-[.08em] text-text-faint border-b border-hairline">
        <div>NAME</div>
        <div>NEXT CATCH-UP</div>
        <div>INTENSITY</div>
        <div>BIRTHDAY</div>
        <div />
      </div>
      {loading ? (
        <div className="text-center p-8 text-text-muted">Loading…</div>
      ) : error ? (
        <div className="text-center p-8 text-bad">{error}</div>
      ) : friends.length === 0 ? (
        <div className="text-center p-8 text-text-muted">No friends found.</div>
      ) : (
        friends.map((friend) => {
          const daysDiff = getDaysDiff(friend.plannedSpeakingTime);
          const intensityScore = calculateIntensityScore(friend);
          const hasIntensity = !isNaN(intensityScore) && intensityScore > 0;
          return (
            <div
              key={friend.id}
              onClick={() => onOpenFriend(friend)}
              className="grid grid-cols-[2.4fr_1.5fr_1.5fr_1fr_130px] items-center px-5 py-3.5 border-b border-white/[.04] last:border-0 cursor-pointer hover:bg-white/[.03] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar id={friend.id} name={friend.name} />
                <div>
                  <div className="font-semibold text-sm text-text-primary">{friend.name || 'Unknown'}</div>
                  <div className="text-[11.5px] text-text-faint">{friend.relationshipType || '—'}</div>
                </div>
              </div>
              <div className="font-bold text-[13px]" style={{ color: getGradientColor(daysDiff) }}>
                {formatDaysDiff(daysDiff)}
              </div>
              <div className="flex items-center gap-2.5">
                {hasIntensity ? (
                  <>
                    <ProgressBar
                      percent={intensityScore * 10}
                      color={getIntensityGradientColor(intensityScore)}
                      className="w-16 flex-none"
                    />
                    <span className="font-bold text-[12.5px]" style={{ color: getIntensityGradientColor(intensityScore) }}>
                      {intensityScore.toFixed(1)}
                    </span>
                  </>
                ) : (
                  <span className="font-bold text-[12.5px] text-text-faintest">—</span>
                )}
              </div>
              <div className={`text-[12.5px] ${friend.dateOfBirth ? 'text-text-muted' : 'text-text-faintest'}`}>
                {friend.dateOfBirth || '—'}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onLogChat(friend); }}
                  className="border border-accent/35 bg-accent/[.14] text-accent-light text-[11.5px] font-bold px-3 py-1.5 rounded-lg hover:bg-accent/[.26] transition-colors"
                >
                  Log chat
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default FriendsTable;
