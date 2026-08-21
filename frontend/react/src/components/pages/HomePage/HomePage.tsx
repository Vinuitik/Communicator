import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CalendarBoard, { CATEGORY_LEGEND } from '../../organisms/CalendarBoard';
import QuickLogModal from '../../organisms/QuickLogModal';
import GroupBatchLogModal from '../../organisms/GroupBatchLogModal';
import GroupConnectionsNudge from '../../organisms/GroupConnectionsNudge';
import ConnectionOutcomeForm from '../../organisms/ConnectionOutcomeForm';
import MeetingEditModal from '../../organisms/MeetingEditModal';
import { useToast } from '../../molecules/Toast';
import { Friend, MeetingDTO, ConnectionCandidateDTO } from '../../../types/api';
import { getThisWeek, updateMeeting } from '../../../services/api/meetingService';
import { getConnectionCandidates } from '../../../services/api/groupMeetingService';
import { ROUTES, profilePath, connectionDetailsPath } from '../../../utils/constants';

// "Week" — the new home (see design_handoff_friends_tracker/README.md). Was
// CalendarPage/CalendarBoard's job; HomePage inherits it since '/' already
// routed here and this keeps route churn to just adding /friends (see
// FriendsPage, which now owns what HomePage used to render).
const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [meetings, setMeetings] = useState<MeetingDTO[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logTarget, setLogTarget] = useState<Friend | null>(null);

  // Group card click -> batch-log modal -> (if any tracked-connection pairs
  // were present) the Connections nudge, same two-stage flow GroupDetailsPage
  // uses for its own "Log this meeting" button.
  const [groupMeetingStage, setGroupMeetingStage] = useState<'closed' | 'batchLog' | 'nudge'>('closed');
  const [groupMeetingTarget, setGroupMeetingTarget] = useState<MeetingDTO | null>(null);
  const [nudgeCandidates, setNudgeCandidates] = useState<ConnectionCandidateDTO[]>([]);

  // Connection card click -> lighter one-step outcome form (no presence/
  // batch step — Connections are a fixed pair, see ConnectionOutcomeForm).
  const [connectionMeetingTarget, setConnectionMeetingTarget] = useState<MeetingDTO | null>(null);

  // Pencil icon on a PROPOSED card -> MeetingEditModal (edit/reschedule/
  // cancel — a different action from the three "log what happened" flows
  // above, which only apply to a meeting that already occurred).
  const [editTarget, setEditTarget] = useState<MeetingDTO | null>(null);

  const load = useCallback(async (offset: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getThisWeek(offset);
      setMeetings(data);
    } catch {
      setError('Could not load this week’s meetings. Please try again later.');
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(weekOffset); }, [load, weekOffset]);

  const handleBatchLogComplete = async (meeting: MeetingDTO) => {
    try {
      const candidates = await getConnectionCandidates(meeting.id);
      if (candidates.length > 0) {
        setNudgeCandidates(candidates);
        setGroupMeetingStage('nudge');
        return;
      }
    } catch {
      // Candidates are a bonus nudge, not the point of the flow — a failure
      // here shouldn't make a successfully-completed meeting look broken.
    }
    setGroupMeetingStage('closed');
    setGroupMeetingTarget(null);
    showToast(`Logged the meeting for ${meeting.groupName ?? 'the group'}`);
    load(weekOffset);
  };

  const handleCloseGroupFlow = () => {
    setGroupMeetingStage('closed');
    setGroupMeetingTarget(null);
    setNudgeCandidates([]);
    load(weekOffset);
  };

  // Drag-and-drop reschedule (CalendarBoard, day-columns only — no
  // time-of-day drag). PATCH /meetings/{id} is a full replace, so every
  // other field is resent unchanged off the dragged meeting's current DTO,
  // only `date` differs.
  const handleDropOnDate = async (meeting: MeetingDTO, newDate: string) => {
    try {
      await updateMeeting(meeting.id, {
        date: newDate,
        time: meeting.time,
        location: meeting.location,
        attendeeFriendIds: meeting.attendees.map((a) => a.friendId),
        selfAttending: meeting.selfAttending,
      });
      load(weekOffset);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reschedule this meeting.', 'error');
    }
  };

  const doneCount = meetings.filter((m) => m.status === 'DONE').length;
  const proposedCount = meetings.length - doneCount;

  return (
    <div className="px-[30px] py-[26px] animate-ftfade">
      <div className="flex justify-between items-end mb-4 flex-wrap gap-3">
        <div>
          <h1 className="m-0 font-display font-bold text-[26px] tracking-tight text-text-primary">This week</h1>
          <p className="mt-1 text-[13px] text-text-muted">
            {weekOffset < 0
              ? `${doneCount} completed`
              : `${proposedCount} due this week`}
          </p>
        </div>
        <div className="flex items-center gap-3.5">
          <div className="flex gap-3 text-[11.5px] text-text-muted">
            {CATEGORY_LEGEND.map((item) => (
              <span key={item.label} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-sm ${item.dot}`} />
                {item.label}
              </span>
            ))}
          </div>
          {/* GET /meetings/thisWeek?weekOffset=N now exists — arrows page
              weekOffset by ±1 and refetch. Negative offsets read as a
              history/progress log (past DONE meetings come back too, only
              CANCELLED is excluded server-side). */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setWeekOffset((o) => o - 1)}
              className="w-8 h-8 rounded-lg border border-white/10 bg-input text-text-muted hover:text-text-emphasis hover:bg-input-2 transition-colors"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="px-3 h-8 rounded-lg border border-accent/40 bg-accent/[.16] text-accent-lighter text-xs font-bold"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((o) => o + 1)}
              className="w-8 h-8 rounded-lg border border-white/10 bg-input text-text-muted hover:text-text-emphasis hover:bg-input-2 transition-colors"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <CalendarBoard
        meetings={meetings}
        loading={loading}
        error={error}
        weekOffset={weekOffset}
        onOpenFriend={(friend) => navigate(profilePath(friend.id))}
        onLogChat={(friend) => setLogTarget(friend)}
        onAddFriend={() => navigate(ROUTES.ADD_FRIEND)}
        onGroupMeetingClick={(meeting) => { setGroupMeetingTarget(meeting); setGroupMeetingStage('batchLog'); }}
        onConnectionMeetingClick={(meeting) => setConnectionMeetingTarget(meeting)}
        onViewConnection={(meeting) => navigate(connectionDetailsPath(
          meeting.connectionFriend1Id as number, meeting.connectionFriend2Id as number,
        ))}
        onEditMeeting={(meeting) => setEditTarget(meeting)}
        onDropOnDate={handleDropOnDate}
      />

      <QuickLogModal friend={logTarget} onClose={() => setLogTarget(null)} onSaved={() => load(weekOffset)} />

      <MeetingEditModal
        meeting={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => { setEditTarget(null); showToast('Meeting updated'); load(weekOffset); }}
        onCancelled={() => { setEditTarget(null); showToast('Meeting cancelled'); load(weekOffset); }}
      />

      {groupMeetingStage === 'batchLog' && groupMeetingTarget && (
        <GroupBatchLogModal
          meetingId={groupMeetingTarget.id}
          groupName={groupMeetingTarget.groupName ?? 'Group'}
          onClose={handleCloseGroupFlow}
          onComplete={handleBatchLogComplete}
        />
      )}

      {groupMeetingStage === 'nudge' && groupMeetingTarget && (
        <GroupConnectionsNudge
          groupName={groupMeetingTarget.groupName ?? 'Group'}
          candidates={nudgeCandidates}
          onLogged={() => showToast('Logged that connection outcome')}
          onClose={handleCloseGroupFlow}
        />
      )}

      {connectionMeetingTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-ftfade"
          onClick={() => setConnectionMeetingTarget(null)}
        >
          <div className="w-[440px] max-w-[92vw]" onClick={(e) => e.stopPropagation()}>
            <ConnectionOutcomeForm
              friend1Id={connectionMeetingTarget.connectionFriend1Id as number}
              friend2Id={connectionMeetingTarget.connectionFriend2Id as number}
              onSaved={() => { setConnectionMeetingTarget(null); load(weekOffset); }}
              onCancel={() => setConnectionMeetingTarget(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
