import React, { useState } from 'react';
import Avatar from '../../atoms/Avatar';
import { ConnectionCandidateDTO } from '../../../types/api';

// Wire values are a local guess (WENT_WELL/NEUTRAL/TENSE) — the real
// ConnectionOutcomeForm/endpoint is being built by a different agent in a
// different worktree and isn't in this codebase yet. Whatever parent wires
// onLogOutcome up to that endpoint owns translating/renaming these if the
// landed contract differs; this component never calls anything itself.
export type ConnectionOutcome = 'WENT_WELL' | 'NEUTRAL' | 'TENSE';

const OUTCOME_OPTIONS: { value: ConnectionOutcome; label: string; color: string }[] = [
  { value: 'WENT_WELL', label: 'Went well', color: '#46D39A' },
  { value: 'NEUTRAL', label: 'Neutral', color: '#F5B544' },
  { value: 'TENSE', label: 'Tense', color: '#F4676E' },
];

interface GroupConnectionsNudgeProps {
  groupName: string;
  /** From GET /meetings/{meetingId}/connection-candidates after a successful complete. */
  candidates: ConnectionCandidateDTO[];
  /**
   * Stub — no save happens here. The real save (a Connection outcome
   * endpoint) is being built in parallel elsewhere; a parent component wires
   * this once that lands. This component only renders the tap targets and
   * locally marks a pair as handled so it doesn't nag twice in the same pass.
   */
  onLogOutcome: (friend1Id: number, friend2Id: number, outcome: ConnectionOutcome) => void;
  /** Skip-all, or finishing after every pair is handled — either way closes back to the caller. */
  onClose: () => void;
}

const pairKey = (a: number, b: number) => `${a}-${b}`;

// Shown right after GroupBatchLogModal's /complete succeeds. Scoped narrow on
// purpose (Decisions Log): only present-attendee pairs that already have a
// tracked Connection, never the full combinatorial pair set, and never
// creates a new Connection mid-flow — a few taps or one skip, not a form.
const GroupConnectionsNudge: React.FC<GroupConnectionsNudgeProps> = ({ groupName, candidates, onLogOutcome, onClose }) => {
  const [logged, setLogged] = useState<Set<string>>(new Set());

  const handleTap = (pair: ConnectionCandidateDTO, outcome: ConnectionOutcome) => {
    onLogOutcome(pair.friend1Id, pair.friend2Id, outcome);
    setLogged((prev) => new Set(prev).add(pairKey(pair.friend1Id, pair.friend2Id)));
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
            {remaining.map((pair) => (
              <div key={pairKey(pair.friend1Id, pair.friend2Id)} className="border border-white/10 rounded-lg p-3.5">
                <div className="flex items-center gap-2 mb-3">
                  <Avatar id={pair.friend1Id} name={pair.friend1Name} size={24} />
                  <span className="text-[13px] font-semibold text-text-emphasis">{pair.friend1Name}</span>
                  <span className="text-text-faint">×</span>
                  <Avatar id={pair.friend2Id} name={pair.friend2Name} size={24} />
                  <span className="text-[13px] font-semibold text-text-emphasis">{pair.friend2Name}</span>
                </div>
                <div className="flex gap-2">
                  {OUTCOME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleTap(pair, opt.value)}
                      className="flex-1 py-2 rounded-input font-bold text-xs border transition-colors hover:brightness-125"
                      style={{ borderColor: `${opt.color}55`, background: `${opt.color}15`, color: opt.color }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
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
