import React, { useState } from 'react';
import Avatar from '../../atoms/Avatar';
import { ConnectionCandidateDTO, ConnectionOutcome } from '../../../types/api';
import { logConnectionMeeting } from '../../../services/api/connectionMeetingService';

export type { ConnectionOutcome };

const OUTCOME_OPTIONS: { value: ConnectionOutcome; label: string; color: string }[] = [
  { value: 'WENT_WELL', label: 'Went well', color: '#46D39A' },
  { value: 'NEUTRAL', label: 'Neutral', color: '#F5B544' },
  { value: 'TENSE', label: 'Tense', color: '#F4676E' },
];

const today = () => new Date().toISOString().slice(0, 10);

interface GroupConnectionsNudgeProps {
  groupName: string;
  /** From GET /meetings/{meetingId}/connection-candidates after a successful complete. */
  candidates: ConnectionCandidateDTO[];
  /**
   * Optional post-save notification (e.g. for a toast) — the save itself
   * (POST /meetings/connection via logConnectionMeeting, same endpoint
   * ConnectionOutcomeForm uses, note field included) happens inside this
   * component now. Called once per pair, after that pair's save succeeds.
   */
  onLogged?: (friend1Id: number, friend2Id: number, outcome: ConnectionOutcome) => void;
  /** Skip-all, or finishing after every pair is handled — either way closes back to the caller. */
  onClose: () => void;
}

const pairKey = (a: number, b: number) => `${a}-${b}`;

// Shown right after GroupBatchLogModal's /complete succeeds. Scoped narrow on
// purpose (Decisions Log): only present-attendee pairs that already have a
// tracked Connection, never the full combinatorial pair set, and never
// creates a new Connection mid-flow — a few taps (each with an optional note)
// or one skip, not a full form.
const GroupConnectionsNudge: React.FC<GroupConnectionsNudgeProps> = ({ groupName, candidates, onLogged, onClose }) => {
  const [logged, setLogged] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleTap = async (pair: ConnectionCandidateDTO, outcome: ConnectionOutcome) => {
    const key = pairKey(pair.friend1Id, pair.friend2Id);
    setSaving((prev) => new Set(prev).add(key));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    try {
      const note = notes[key]?.trim();
      await logConnectionMeeting({
        friend1Id: pair.friend1Id,
        friend2Id: pair.friend2Id,
        date: today(),
        outcome,
        note: note || undefined,
      });
      setLogged((prev) => new Set(prev).add(key));
      onLogged?.(pair.friend1Id, pair.friend2Id, outcome);
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [key]: err instanceof Error ? err.message : 'Failed to log that connection outcome.',
      }));
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const remaining = candidates.filter((c) => !logged.has(pairKey(c.friend1Id, c.friend2Id)));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-ftfade"
      onClick={onClose}
    >
      <div
        className="w-[440px] max-w-[92vw] max-h-[85vh] flex flex-col bg-modal border border-white/10 rounded-card p-6 shadow-modal animate-ftmodal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5">
          <div className="text-xs text-text-muted">After {groupName}</div>
          <div className="font-display font-bold text-lg text-text-primary">How did people get along?</div>
        </div>

        {remaining.length === 0 ? (
          <div className="text-center py-6 text-sm text-text-muted">
            {logged.size > 0 ? 'All caught up.' : 'No tracked connections among who showed up.'}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 mb-5">
            {remaining.map((pair) => {
              const key = pairKey(pair.friend1Id, pair.friend2Id);
              const isSaving = saving.has(key);
              return (
                <div key={key} className="border border-white/10 rounded-lg p-3.5">
                  <div className="flex items-center gap-2 mb-3">
                    <Avatar id={pair.friend1Id} name={pair.friend1Name} size={24} />
                    <span className="text-[13px] font-semibold text-text-emphasis">{pair.friend1Name}</span>
                    <span className="text-text-faint">×</span>
                    <Avatar id={pair.friend2Id} name={pair.friend2Name} size={24} />
                    <span className="text-[13px] font-semibold text-text-emphasis">{pair.friend2Name}</span>
                  </div>
                  <input
                    type="text"
                    value={notes[key] ?? ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder="Note (optional)"
                    disabled={isSaving}
                    aria-label={`Note for ${pair.friend1Name} × ${pair.friend2Name}`}
                    className="w-full mb-2.5 bg-input border border-white/10 rounded-input px-3 py-2 text-[12.5px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60 disabled:opacity-50"
                  />
                  {errors[key] && <p className="m-0 mb-2 text-[11.5px] text-bad">{errors[key]}</p>}
                  <div className="flex gap-2">
                    {OUTCOME_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleTap(pair, opt.value)}
                        disabled={isSaving}
                        className="flex-1 py-2 rounded-input font-bold text-xs border transition-colors hover:brightness-125 disabled:opacity-50"
                        style={{ borderColor: `${opt.color}55`, background: `${opt.color}15`, color: opt.color }}
                      >
                        {isSaving ? '…' : opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-input border border-white/10 text-text-emphasis font-semibold text-sm hover:bg-white/5 transition-colors"
        >
          {remaining.length === 0 ? 'Done' : 'Skip all'}
        </button>
      </div>
    </div>
  );
};

export default GroupConnectionsNudge;
