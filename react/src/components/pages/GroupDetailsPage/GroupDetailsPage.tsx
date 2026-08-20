import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Avatar from '../../atoms/Avatar';
import KnowledgeCrudPanel from '../../organisms/KnowledgeCrudPanel';
import ConfirmDialog from '../../molecules/ConfirmDialog';
import { useToast } from '../../molecules/Toast';
import GroupBatchLogModal from '../../organisms/GroupBatchLogModal';
import GroupConnectionsNudge, { ConnectionOutcome } from '../../organisms/GroupConnectionsNudge';
import {
  getGroup, getGroupKnowledge, addGroupKnowledge, deleteGroupKnowledge,
  getGroupPermissions, addGroupPermission, deleteGroupPermission, deleteGroup,
} from '../../../services/api/groupService';
import { getGroupFriends, addFriendsToGroup, removeFriendFromGroup, getShortFriendList } from '../../../services/api/friendService';
import { getGroupMeetings, createManualMeeting, getConnectionCandidates } from '../../../services/api/groupMeetingService';
import { logConnectionMeeting } from '../../../services/api/connectionMeetingService';
import { Group, KnowledgeCrudItem, Friend, ShortFriend, MeetingDTO, ConnectionCandidateDTO } from '../../../types/api';
import { ROUTES, profilePath } from '../../../utils/constants';
import { avatarColor } from '../../../utils/avatar';

// Ported from group/.../templates/groups/groupDetails.html — restyled per the
// redesign handoff (dark tokens, color-tile header). "People in this group"
// used to be a static "Coming Soon" placeholder (the handoff's mockup even
// marks it PLANNED) — but GroupMemberController's list+add endpoints already
// existed server-side and were simply never called from any UI (confirmed via
// repo grep, same finding that unlocked ProfilePage's Groups panel in Stage
// 3), so this wires real membership instead of shipping another placeholder.
// Membership is now full CRUD: add via modal below, remove via each row's ×.
const GroupDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const groupId = Number(id);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [group, setGroup] = useState<Group | null>(null);
  const [groupLoading, setGroupLoading] = useState(true);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const [members, setMembers] = useState<Friend[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [knowledge, setKnowledge] = useState<KnowledgeCrudItem[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(true);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);

  const [permissions, setPermissions] = useState<KnowledgeCrudItem[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [candidates, setCandidates] = useState<ShortFriend[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [removeTarget, setRemoveTarget] = useState<Friend | null>(null);
  const [removingMember, setRemovingMember] = useState(false);

  // "Log this meeting" flow — batch-log -> Connections nudge, per
  // SCHEDULING_MEETINGS_PLAN.md Feature B. meetingStage tracks which overlay
  // (if any) is showing; activeMeetingId is set once a PROPOSED meeting
  // exists (an already-pending one, or one freshly created via
  // POST /meetings/manual).
  const [meetingStage, setMeetingStage] = useState<'closed' | 'batchLog' | 'nudge'>('closed');
  const [activeMeetingId, setActiveMeetingId] = useState<number | null>(null);
  const [startingMeeting, setStartingMeeting] = useState(false);
  const [nudgeCandidates, setNudgeCandidates] = useState<ConnectionCandidateDTO[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setGroupLoading(true);
      setGroupError(null);
      try {
        const data = await getGroup(groupId);
        if (!cancelled) setGroup(data);
      } catch {
        if (!cancelled) setGroupError('Could not load this group. Please try again later.');
      } finally {
        if (!cancelled) setGroupLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [groupId]);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    setMembersError(null);
    try {
      setMembers(await getGroupFriends(groupId));
    } catch {
      setMembersError('Could not load people in this group.');
    } finally {
      setMembersLoading(false);
    }
  }, [groupId]);

  const loadKnowledge = useCallback(async () => {
    setKnowledgeLoading(true);
    setKnowledgeError(null);
    try {
      setKnowledge(await getGroupKnowledge(groupId));
    } catch {
      setKnowledgeError('Could not load notes.');
    } finally {
      setKnowledgeLoading(false);
    }
  }, [groupId]);

  const loadPermissions = useCallback(async () => {
    setPermissionsLoading(true);
    setPermissionsError(null);
    try {
      setPermissions(await getGroupPermissions(groupId));
    } catch {
      setPermissionsError('Could not load settings.');
    } finally {
      setPermissionsLoading(false);
    }
  }, [groupId]);

  useEffect(() => { loadMembers(); }, [loadMembers]);
  useEffect(() => { loadKnowledge(); }, [loadKnowledge]);
  useEffect(() => { loadPermissions(); }, [loadPermissions]);

  const handleDeleteGroup = async () => {
    if (!group) return;
    setConfirmDeleteOpen(false);
    setDeletingGroup(true);
    try {
      await deleteGroup(groupId);
      navigate(ROUTES.GROUPS);
    } catch {
      showToast('Failed to delete group. Please try again.', 'error');
      setDeletingGroup(false);
    }
  };

  const openAddModal = async () => {
    setAddOpen(true);
    setAddError(null);
    setSelectedIds(new Set());
    setCandidatesLoading(true);
    try {
      const all = await getShortFriendList();
      const memberIds = new Set(members.map((m) => m.id));
      setCandidates(all.filter((f) => !memberIds.has(f.id)));
    } catch {
      setAddError('Could not load your friends list.');
    } finally {
      setCandidatesLoading(false);
    }
  };

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAddPeople = async () => {
    if (selectedIds.size === 0) return;
    setAddSubmitting(true);
    setAddError(null);
    try {
      await addFriendsToGroup(groupId, Array.from(selectedIds));
      setAddOpen(false);
      showToast(`Added ${selectedIds.size} ${selectedIds.size === 1 ? 'person' : 'people'} to ${group?.name}`);
      await loadMembers();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add people.');
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeTarget) return;
    setRemovingMember(true);
    try {
      await removeFriendFromGroup(groupId, removeTarget.id);
      showToast(`Removed ${removeTarget.name} from ${group?.name}`);
      setRemoveTarget(null);
      await loadMembers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove person.', 'error');
    } finally {
      setRemovingMember(false);
    }
  };

  // POST /meetings/manual has no dedupe of its own — callers check for an
  // existing PROPOSED group meeting (e.g. auto-scheduled) first, per
  // MeetingController's contract, so this never creates a duplicate.
  const handleLogMeeting = async () => {
    setStartingMeeting(true);
    try {
      const existing = await getGroupMeetings(groupId);
      const pending = existing.find((m) => m.status === 'PROPOSED');
      const meeting = pending ?? await createManualMeeting({
        groupId,
        date: new Date().toISOString().slice(0, 10),
        note: null,
      });
      setActiveMeetingId(meeting.id);
      setMeetingStage('batchLog');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to start logging this meeting.', 'error');
    } finally {
      setStartingMeeting(false);
    }
  };

  const handleBatchLogComplete = async (meeting: MeetingDTO) => {
    try {
      const candidates = await getConnectionCandidates(meeting.id);
      if (candidates.length > 0) {
        setNudgeCandidates(candidates);
        setMeetingStage('nudge');
        return;
      }
    } catch {
      // Candidates are a bonus nudge, not the point of the flow — a failure
      // here shouldn't make a successfully-completed meeting look broken.
    }
    setMeetingStage('closed');
    setActiveMeetingId(null);
    showToast(`Logged the meeting for ${group?.name}`);
  };

  const handleCloseMeetingFlow = () => {
    setMeetingStage('closed');
    setActiveMeetingId(null);
    setNudgeCandidates([]);
  };

  // GroupConnectionsNudge's own ConnectionOutcome values (WENT_WELL/NEUTRAL/TENSE)
  // already match ConnectionMeetingRequest.outcome 1:1, no translation needed.
  const handleLogConnectionOutcome = async (friend1Id: number, friend2Id: number, outcome: ConnectionOutcome) => {
    try {
      await logConnectionMeeting({
        friend1Id,
        friend2Id,
        date: new Date().toISOString().slice(0, 10),
        outcome,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to log that connection outcome.', 'error');
    }
  };

  const permissionTag = (value: number): { label: string; color: string } => (
    value >= 3 ? { label: 'High', color: '#46D39A' } : { label: 'Medium', color: '#F5B544' }
  );

  if (groupLoading) {
    return <div className="text-center p-16 text-text-muted">Loading…</div>;
  }
  if (groupError || !group) {
    return <div className="text-center p-16 text-bad">{groupError}</div>;
  }

  return (
    <div className="animate-ftfade max-w-[720px] mx-auto px-[30px] py-6 flex flex-col gap-4">
      <button type="button" onClick={() => navigate(ROUTES.GROUPS)} className="self-start border-none bg-transparent text-text-muted text-[12.5px] hover:text-text-emphasis transition-colors">
        ← Groups
      </button>

      <div className="flex items-center gap-4 bg-surface border border-hairline rounded-card p-5">
        <div className="w-[52px] h-[52px] rounded-[14px] flex-none" style={{ background: avatarColor(groupId) }} />
        <div className="flex-1">
          <h1 className="m-0 font-display font-bold text-[22px] text-text-primary">{group.name}</h1>
          <div className="text-text-muted text-[12.5px] mt-[3px]">{members.length} people · {knowledge.length} notes</div>
        </div>
        <button
          type="button"
          onClick={handleLogMeeting}
          disabled={startingMeeting}
          className="border-none bg-accent-gradient text-white font-bold text-[12.5px] px-[15px] py-2.5 rounded-input shadow-button-sm hover:brightness-110 disabled:opacity-50 transition-all"
        >
          {startingMeeting ? 'Starting…' : 'Log this meeting'}
        </button>
        <button
          type="button"
          onClick={() => setConfirmDeleteOpen(true)}
          disabled={deletingGroup}
          className="border border-bad/40 bg-bad/[.12] text-bad font-semibold text-[12.5px] px-[15px] py-2.5 rounded-input hover:bg-bad/[.2] disabled:opacity-50 transition-colors"
        >
          {deletingGroup ? 'Deleting…' : 'Delete group'}
        </button>
      </div>

      <div className="bg-surface border border-hairline rounded-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-bold text-text-primary m-0">People in this group</h2>
          <button
            type="button"
            onClick={openAddModal}
            className="border border-white/10 bg-input-2 text-accent-light text-xs font-semibold px-3 py-1.5 rounded-[7px] hover:bg-input transition-colors"
          >
            + Add people
          </button>
        </div>
        {membersLoading ? (
          <div className="text-center p-4 text-text-muted text-sm">Loading…</div>
        ) : membersError ? (
          <div className="text-center p-4 text-bad text-sm">{membersError}</div>
        ) : members.length === 0 ? (
          <div className="text-center py-6 px-3 border border-dashed border-white/10 rounded-card">
            <div className="text-[22px] opacity-50 mb-1.5">👥</div>
            <div className="text-xs text-text-muted font-semibold">No one in this group yet</div>
            <div className="text-[11px] text-text-faint mt-1">Hit <b className="text-accent-light">+ Add people</b> to bring friends in.</div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {members.map((friend) => (
              <div
                key={friend.id}
                onClick={() => navigate(profilePath(friend.id))}
                className="flex items-center gap-3 px-3.5 py-2.5 bg-surface-2 rounded-lg cursor-pointer hover:bg-input transition-colors"
              >
                <Avatar id={friend.id} name={friend.name} size={30} />
                <span className="flex-1 text-[13px] text-text-secondary">{friend.name}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setRemoveTarget(friend); }}
                  aria-label={`Remove ${friend.name} from group`}
                  className="w-6 h-6 flex items-center justify-center rounded-md border-none bg-transparent text-text-faint hover:text-bad hover:bg-bad/[.12] transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <KnowledgeCrudPanel
        title="Group notes"
        factLabel="Note"
        importanceLabel="Importance"
        addButtonLabel="Add Note"
        items={knowledge}
        loading={knowledgeLoading}
        error={knowledgeError}
        onAdd={async (fact, importance) => { await addGroupKnowledge(groupId, fact, importance); await loadKnowledge(); }}
        onDelete={async (knowledgeId) => { await deleteGroupKnowledge(knowledgeId); await loadKnowledge(); }}
      />

      <KnowledgeCrudPanel
        title="Settings & permissions"
        factLabel="Setting"
        importanceLabel="Priority"
        addButtonLabel="Add Setting"
        items={permissions}
        loading={permissionsLoading}
        error={permissionsError}
        importanceFormat={permissionTag}
        onAdd={async (fact, importance) => { await addGroupPermission(groupId, fact, importance); await loadPermissions(); }}
        onDelete={async (permissionId) => { await deleteGroupPermission(permissionId); await loadPermissions(); }}
      />

      {addOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-ftfade" onClick={() => setAddOpen(false)}>
          <div className="w-[400px] max-w-[92vw] max-h-[80vh] flex flex-col bg-modal border border-white/10 rounded-card p-6 shadow-modal animate-ftmodal" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-lg text-text-primary m-0 mb-4">Add people to {group.name}</h3>
            {addError && <p className="mb-3 text-sm text-bad">{addError}</p>}
            <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 mb-4">
              {candidatesLoading ? (
                <div className="text-center p-4 text-text-muted text-sm">Loading…</div>
              ) : candidates.length === 0 ? (
                <div className="text-center p-4 text-text-muted text-sm">Everyone is already in this group.</div>
              ) : (
                candidates.map((friend) => (
                  <label
                    key={friend.id}
                    className="flex items-center gap-3 px-3.5 py-2.5 bg-surface-2 rounded-lg cursor-pointer hover:bg-input transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(friend.id)}
                      onChange={() => toggleSelected(friend.id)}
                      className="accent-accent"
                    />
                    <Avatar id={friend.id} name={friend.name} size={28} />
                    <span className="flex-1 text-[13px] text-text-secondary">{friend.name}</span>
                  </label>
                ))
              )}
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="flex-1 py-2.5 rounded-input border border-white/10 text-text-emphasis font-semibold text-sm hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddPeople}
                disabled={addSubmitting || selectedIds.size === 0}
                className="flex-1 py-2.5 rounded-input border-none bg-accent-gradient text-white font-bold text-sm shadow-button-sm hover:brightness-110 disabled:opacity-50 transition-all"
              >
                {addSubmitting ? 'Adding…' : `Add${selectedIds.size ? ` (${selectedIds.size})` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={`Delete "${group.name}"?`}
        message="This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={handleDeleteGroup}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        title={`Remove ${removeTarget?.name} from ${group.name}?`}
        message="They can be added back later."
        confirmLabel={removingMember ? 'Removing…' : 'Remove'}
        danger
        onConfirm={handleRemoveMember}
        onCancel={() => setRemoveTarget(null)}
      />

      {meetingStage === 'batchLog' && activeMeetingId !== null && (
        <GroupBatchLogModal
          meetingId={activeMeetingId}
          groupName={group.name}
          onClose={handleCloseMeetingFlow}
          onComplete={handleBatchLogComplete}
        />
      )}

      {meetingStage === 'nudge' && (
        <GroupConnectionsNudge
          groupName={group.name}
          candidates={nudgeCandidates}
          onLogOutcome={handleLogConnectionOutcome}
          onClose={handleCloseMeetingFlow}
        />
      )}
    </div>
  );
};

export default GroupDetailsPage;
