import React, { useEffect, useState } from 'react';
import Avatar from '../../atoms/Avatar';
import Input from '../../atoms/Input';
import RatingPicker, { EXPERIENCE_RATINGS } from '../../molecules/RatingPicker';
import SegmentedControl from '../../molecules/SegmentedControl';
import { getMeetingAttendees, completeGroupMeeting } from '../../../services/api/groupMeetingService';
import { AttendeeDTO, AttendeeLog, MeetingDTO } from '../../../types/api';

interface GroupBatchLogModalProps {
  meetingId: number;
  groupName: string;
  onClose: () => void;
  /** Called after a successful /complete so the caller can show the Connections nudge. */
  onComplete: (meeting: MeetingDTO) => void;
}

interface GradeState {
  hours: string;
  experience: string;
  inPerson: boolean;
}

// Same defaults QuickLogModal uses for a 1:1 log.
const defaultGrade = (): GradeState => ({ hours: '1', experience: '***', inPerson: true });

// Two-step batch log for a Group meeting: step 1 toggles presence (all
// members pre-filled present, per MeetingAttendee rows created by POST
// /meetings/manual); step 2 grades each still-present attendee with the same
// duration/experience/in-person fields QuickLogModal uses for a 1:1 log.
// Absent members stay in the payload (present:false, ungraded) rather than
// being dropped — see AttendeeLog's doc comment in types/api.ts.
const GroupBatchLogModal: React.FC<GroupBatchLogModalProps> = ({ meetingId, groupName, onClose, onComplete }) => {
  const [step, setStep] = useState<'presence' | 'grade'>('presence');
  const [attendees, setAttendees] = useState<AttendeeDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [presentIds, setPresentIds] = useState<Set<number>>(new Set());
  const [grades, setGrades] = useState<Record<number, GradeState>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await getMeetingAttendees(meetingId);
        if (cancelled) return;
        setAttendees(data);
        setPresentIds(new Set(data.filter((a) => a.present).map((a) => a.friendId)));
      } catch {
        if (!cancelled) setLoadError("Could not load this meeting's attendees.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [meetingId]);

  const togglePresent = (friendId: number) => {
    setPresentIds((prev) => {
      const next = new Set(prev);
      if (next.has(friendId)) next.delete(friendId); else next.add(friendId);
      return next;
    });
  };

  const presentAttendees = attendees.filter((a) => presentIds.has(a.friendId));

  const goToGrading = () => {
    setGrades((prev) => {
      const next = { ...prev };
      presentAttendees.forEach((a) => {
        if (!next[a.friendId]) next[a.friendId] = defaultGrade();
      });
      return next;
    });
    setStep('grade');
  };

  const updateGrade = (friendId: number, patch: Partial<GradeState>) => {
    setGrades((prev) => ({ ...prev, [friendId]: { ...(prev[friendId] ?? defaultGrade()), ...patch } }));
  };

  const handleComplete = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const attendeeLogs: AttendeeLog[] = attendees.map((a) => {
        if (presentIds.has(a.friendId)) {
          const grade = grades[a.friendId] ?? defaultGrade();
          return {
            friendId: a.friendId,
            present: true,
            durationHours: parseFloat(grade.hours) || 0,
            experience: grade.experience,
            inPerson: grade.inPerson,
          };
        }
        return { friendId: a.friendId, present: false };
      });
      const meeting = await completeGroupMeeting(meetingId, { attendees: attendeeLogs });
      onComplete(meeting);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to log this meeting.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-ftfade"
      onClick={onClose}
    >
      <div
        className="w-[460px] max-w-[92vw] max-h-[85vh] flex flex-col bg-modal border border-white/10 rounded-card p-6 shadow-modal animate-ftmodal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-5">
          <div>
            <div className="text-xs text-text-muted">Log this meeting</div>
            <div className="font-display font-bold text-lg text-text-primary">{groupName}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto w-8 h-8 rounded-lg border-none bg-input-2 text-text-muted cursor-pointer hover:text-text-emphasis transition-colors"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="text-center p-8 text-text-muted text-sm">Loading…</div>
        ) : loadError ? (
          <div className="text-center p-8 text-bad text-sm">{loadError}</div>
        ) : attendees.length === 0 ? (
          <div className="text-center p-8 text-text-muted text-sm">This group has no members yet.</div>
        ) : step === 'presence' ? (
          <>
            <div className="text-xs text-text-secondary mb-2">Who was there?</div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 mb-4">
              {attendees.map((a) => (
                <label
                  key={a.friendId}
                  className="flex items-center gap-3 px-3.5 py-2.5 bg-surface-2 rounded-lg cursor-pointer hover:bg-input transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={presentIds.has(a.friendId)}
                    onChange={() => togglePresent(a.friendId)}
                    className="accent-accent"
                  />
                  <Avatar id={a.friendId} name={a.friendName} size={28} />
                  <span className="flex-1 text-[13px] text-text-secondary">{a.friendName}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="flex-none px-5 py-3 rounded-input border border-white/10 text-text-emphasis font-semibold text-sm hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={goToGrading}
                disabled={presentIds.size === 0}
                className="flex-1 py-3 rounded-input border-none bg-accent-gradient text-white font-bold text-sm shadow-button hover:brightness-110 disabled:opacity-50 transition-all"
              >
                Continue{presentIds.size ? ` (${presentIds.size})` : ''}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-xs text-text-secondary mb-2">How did it go with each person?</div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-4 mb-4">
              {presentAttendees.map((a) => {
                const grade = grades[a.friendId] ?? defaultGrade();
                return (
                  <div key={a.friendId} className="border border-white/10 rounded-lg p-3.5">
                    <div className="flex items-center gap-2.5 mb-3">
                      <Avatar id={a.friendId} name={a.friendName} size={26} />
                      <span className="text-[13px] font-semibold text-text-emphasis">{a.friendName}</span>
                    </div>
                    <RatingPicker
                      options={EXPERIENCE_RATINGS}
                      value={grade.experience}
                      onChange={(v) => updateGrade(a.friendId, { experience: v })}
                      className="mb-3"
                    />
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <Input
                          label="Hours"
                          type="number"
                          min={0}
                          step={0.25}
                          value={grade.hours}
                          onChange={(e) => updateGrade(a.friendId, { hours: e.target.value })}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="mb-1.5 text-xs font-semibold text-text-muted">How</div>
                        <SegmentedControl
                          options={[{ value: 'in-person', label: 'In person' }, { value: 'remote', label: 'Remote' }]}
                          value={grade.inPerson ? 'in-person' : 'remote'}
                          onChange={(v) => updateGrade(a.friendId, { inPerson: v === 'in-person' })}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {saveError && <p className="mb-3 text-sm text-bad">{saveError}</p>}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setStep('presence')}
                className="flex-none px-5 py-3 rounded-input border border-white/10 text-text-emphasis font-semibold text-sm hover:bg-white/5 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleComplete}
                disabled={saving}
                className="flex-1 py-3 rounded-input border-none bg-accent-gradient text-white font-bold text-sm shadow-button hover:brightness-110 disabled:opacity-50 transition-all"
              >
                {saving ? 'Saving…' : 'Complete meeting'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GroupBatchLogModal;
