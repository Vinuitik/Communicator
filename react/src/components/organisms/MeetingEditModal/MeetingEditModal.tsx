import React, { useEffect, useMemo, useState } from 'react';
import Avatar from '../../atoms/Avatar';
import Input from '../../atoms/Input';
import ConfirmDialog from '../../molecules/ConfirmDialog';
import { getShortFriendList } from '../../../services/api/friendService';
import { updateMeeting, cancelMeeting, previewGroupMatch } from '../../../services/api/meetingService';
import {
  GroupMatchDTO, MeetingDTO, MeetingType, ShortFriend, UpdateMeetingRequest,
} from '../../../types/api';
import { deriveMeetingType, isValidAttendance } from '../../../utils/meetingType';

interface MeetingEditModalProps {
  /** null closes the modal — same controlled-by-caller pattern as ScheduleMeetingModal. */
  meeting: MeetingDTO | null;
  onClose: () => void;
  /** Called after a successful PATCH /meetings/{id} save. */
  onSaved: (meeting: MeetingDTO) => void;
  /** Called after a successful PATCH /meetings/{id}/cancel. */
  onCancelled: (meeting: MeetingDTO) => void;
}

type GroupOverrideMode = 'auto' | 'existing' | 'new';

const TYPE_BADGE: Record<MeetingType, { label: string; className: string }> = {
  FRIEND: { label: 'Friend', className: 'bg-category-personal/15 text-category-personal border-category-personal/40' },
  GROUP: { label: 'Group', className: 'bg-category-family/15 text-category-family border-category-family/40' },
  CONNECTION: { label: 'Connection', className: 'bg-category-work/15 text-category-work border-category-work/40' },
};

// "HH:mm:ss" (Java LocalTime) <-> "HH:mm" (<input type="time">).
const toInputTime = (time: string | null): string => (time ? time.slice(0, 5) : '');
const toWireTime = (time: string): string | null => (time ? `${time}:00` : null);

const GROUP_MATCH_DEBOUNCE_MS = 350;

// The one unified edit/reschedule/cancel surface for a Meeting (PATCH
// /meetings/{id}, PATCH /meetings/{id}/cancel) — replaces the old "pick
// Friend/Group/Connection explicitly" model. Type is DERIVED client-side
// (mirrors MeetingTypeDeriver) from the attendee list + selfAttending as the
// user edits, purely for the live badge; the server re-derives it for real on
// save, which is the value actually persisted.
const MeetingEditModal: React.FC<MeetingEditModalProps> = ({ meeting, onClose, onSaved, onCancelled }) => {
  const [friends, setFriends] = useState<ShortFriend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsError, setFriendsError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selfAttending, setSelfAttending] = useState(true);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');

  const [matches, setMatches] = useState<GroupMatchDTO[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [groupOverrideMode, setGroupOverrideMode] = useState<GroupOverrideMode>('auto');
  const [overrideGroupId, setOverrideGroupId] = useState<number | null>(null);
  const [newGroupName, setNewGroupName] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Re-initialize local form state every time a different meeting is opened
  // (or the modal re-opens for the same one after a save elsewhere).
  useEffect(() => {
    if (!meeting) return;
    setSelectedIds(new Set(meeting.attendees.map((a) => a.friendId)));
    setSelfAttending(meeting.selfAttending);
    setDate(meeting.date);
    setTime(toInputTime(meeting.time));
    setLocation(meeting.location ?? '');
    setGroupOverrideMode('auto');
    setOverrideGroupId(null);
    setNewGroupName('');
    setMatches([]);
    setSaveError(null);
    setShowCancelConfirm(false);
  }, [meeting]);

  useEffect(() => {
    if (!meeting) return;
    let cancelledEffect = false;
    (async () => {
      setFriendsLoading(true);
      setFriendsError(null);
      try {
        const list = await getShortFriendList();
        if (!cancelledEffect) setFriends(list);
      } catch {
        if (!cancelledEffect) setFriendsError('Could not load your friends list.');
      } finally {
        if (!cancelledEffect) setFriendsLoading(false);
      }
    })();
    return () => { cancelledEffect = true; };
  }, [meeting]);

  const derivedType = useMemo(
    () => deriveMeetingType(selfAttending, selectedIds.size),
    [selfAttending, selectedIds],
  );
  const attendanceValid = isValidAttendance(selfAttending, selectedIds.size);

  // Debounced group-match preview — only meaningful once the current
  // attendee set would derive to GROUP. Clears the override back to auto
  // whenever the attendee set changes so a stale groupId/newGroupName from a
  // previous edit doesn't silently ride along on save.
  useEffect(() => {
    if (!meeting || derivedType !== 'GROUP') {
      setMatches([]);
      setMatchLoading(false);
      return undefined;
    }
    setGroupOverrideMode('auto');
    setOverrideGroupId(null);
    setNewGroupName('');
    setMatchLoading(true);
    const ids = Array.from(selectedIds);
    const timer = setTimeout(async () => {
      try {
        const result = await previewGroupMatch(ids);
        setMatches(result);
      } catch {
        setMatches([]);
      } finally {
        setMatchLoading(false);
      }
    }, GROUP_MATCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // selectedIds is read via `ids` above; re-running on its identity change
    // (a new Set each toggle) is exactly the debounce trigger we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting, derivedType, selectedIds]);

  if (!meeting) return null;

  const toggleFriend = (friendId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(friendId)) next.delete(friendId); else next.add(friendId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!attendanceValid) {
      setSaveError(selfAttending
        ? 'Add at least one other attendee.'
        : "A meeting you're not attending needs at least 2 attendees.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload: UpdateMeetingRequest = {
        date,
        time: toWireTime(time),
        location: location.trim() || null,
        attendeeFriendIds: Array.from(selectedIds),
        selfAttending,
        groupId: groupOverrideMode === 'existing' ? overrideGroupId : null,
        newGroupName: groupOverrideMode === 'new' ? (newGroupName.trim() || null) : null,
      };
      const updated = await updateMeeting(meeting.id, payload);
      onSaved(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmCancel = async () => {
    setCancelling(true);
    try {
      const cancelled = await cancelMeeting(meeting.id);
      onCancelled(cancelled);
    } catch (err) {
      setShowCancelConfirm(false);
      setSaveError(err instanceof Error ? err.message : 'Failed to cancel this meeting.');
    } finally {
      setCancelling(false);
    }
  };

  const badge = TYPE_BADGE[derivedType];
  const bestMatch = matches[0] ?? null;

  // ConfirmDialog is a sibling of the overlay (not nested inside it) so a
  // click on its own backdrop doesn't bubble up through this modal's
  // onClick={onClose} and close both dialogs at once.
  return (
    <>
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-ftfade"
      onClick={onClose}
    >
      <div
        className="w-[440px] max-w-[92vw] max-h-[88vh] flex flex-col bg-modal border border-white/10 rounded-card p-6 shadow-modal animate-ftmodal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <h3 className="font-display font-bold text-lg text-text-primary m-0">Edit meeting</h3>
          <span
            data-testid="derived-type-badge"
            className={`ml-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${badge.className}`}
          >
            {badge.label}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto w-8 h-8 rounded-lg border-none bg-input-2 text-text-muted cursor-pointer hover:text-text-emphasis transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-4">
          <label className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={selfAttending}
              onChange={(e) => setSelfAttending(e.target.checked)}
              className="accent-accent"
            />
            <span className="text-[13px] text-text-secondary">I'm attending</span>
          </label>

          <div>
            <div className="mb-1.5 text-xs font-semibold text-text-muted">Attendees</div>
            {friendsError ? (
              <div className="text-sm text-bad">{friendsError}</div>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-[190px] overflow-y-auto">
                {friendsLoading ? (
                  <div className="text-center p-4 text-text-muted text-sm">Loading…</div>
                ) : (
                  friends.map((f) => (
                    <label
                      key={f.id}
                      className="flex items-center gap-3 px-3.5 py-2 bg-surface-2 rounded-lg cursor-pointer hover:bg-input transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(f.id)}
                        onChange={() => toggleFriend(f.id)}
                        className="accent-accent"
                      />
                      <Avatar id={f.id} name={f.name} size={26} />
                      <span className="flex-1 text-[13px] text-text-secondary">{f.name}</span>
                    </label>
                  ))
                )}
              </div>
            )}
            {!attendanceValid && (
              <p className="mt-1.5 text-xs text-bad">
                {selfAttending ? 'Add at least one other attendee.' : "Needs at least 2 attendees if you're not attending."}
              </p>
            )}
          </div>

          {derivedType === 'GROUP' && (
            <div className="border border-white/10 rounded-lg p-3.5">
              <div className="text-xs font-semibold text-text-muted mb-2">Group match</div>
              {matchLoading ? (
                <div className="text-[13px] text-text-muted">Checking for a matching group…</div>
              ) : (
                <>
                  {groupOverrideMode === 'auto' && (
                    bestMatch ? (
                      <div className="text-[13px] text-text-secondary">
                        Matched: <span className="font-semibold text-text-emphasis">{bestMatch.groupName}</span>
                        <span className="text-text-faint"> ({Math.round(bestMatch.score * 100)}% overlap)</span>
                      </div>
                    ) : (
                      <div className="text-[13px] text-text-muted">No matching group — will save unlinked.</div>
                    )
                  )}
                  {groupOverrideMode === 'existing' && (
                    <select
                      value={overrideGroupId ?? ''}
                      onChange={(e) => setOverrideGroupId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full bg-input border border-white/10 rounded-input px-3 py-2 text-sm text-text-primary"
                    >
                      <option value="">Select a group…</option>
                      {matches.map((m) => (
                        <option key={m.groupId} value={m.groupId}>{m.groupName}</option>
                      ))}
                    </select>
                  )}
                  {groupOverrideMode === 'new' && (
                    <Input
                      placeholder="New group name"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                    />
                  )}
                  <div className="flex gap-3 mt-2.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setGroupOverrideMode('auto')}
                      className={`border-none bg-transparent ${groupOverrideMode === 'auto' ? 'text-accent-light font-bold' : 'text-text-muted'}`}
                    >
                      Auto-match
                    </button>
                    {matches.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setGroupOverrideMode('existing')}
                        className={`border-none bg-transparent ${groupOverrideMode === 'existing' ? 'text-accent-light font-bold' : 'text-text-muted'}`}
                      >
                        Pick existing
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setGroupOverrideMode('new')}
                      className={`border-none bg-transparent ${groupOverrideMode === 'new' ? 'text-accent-light font-bold' : 'text-text-muted'}`}
                    >
                      Create new
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <Input label="Time (optional)" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <Input
            label="Location (optional)"
            placeholder="e.g. Blue Bottle on 5th"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />

          {saveError && <p className="text-sm text-bad">{saveError}</p>}
        </div>

        <div className="flex gap-2.5 mt-5">
          <button
            type="button"
            onClick={() => setShowCancelConfirm(true)}
            className="flex-none px-4 py-3 rounded-input border border-bad/40 bg-bad/10 text-bad font-semibold text-sm hover:bg-bad/20 transition-colors"
          >
            Cancel meeting
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-none px-4 py-3 rounded-input border border-white/10 text-text-emphasis font-semibold text-sm hover:bg-white/5 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !attendanceValid}
            className="flex-1 py-3 rounded-input border-none bg-accent-gradient text-white font-bold text-sm shadow-button hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>

    <ConfirmDialog
      open={showCancelConfirm}
      title="Cancel this meeting?"
      message="This marks it cancelled — it stays in history but drops off the week board. This cannot be undone."
      confirmLabel={cancelling ? 'Cancelling…' : 'Cancel meeting'}
      danger
      onConfirm={handleConfirmCancel}
      onCancel={() => setShowCancelConfirm(false)}
    />
    </>
  );
};

export default MeetingEditModal;
