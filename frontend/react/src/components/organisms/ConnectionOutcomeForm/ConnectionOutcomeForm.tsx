import React, { useState } from 'react';
import Textarea from '../../atoms/Textarea';
import SegmentedControl from '../../molecules/SegmentedControl';
import { logConnectionMeeting } from '../../../services/api/connectionMeetingService';
import { ConnectionOutcome } from '../../../types/api';

const OUTCOME_OPTIONS: { value: ConnectionOutcome; label: string }[] = [
  { value: 'WENT_WELL', label: 'Went well' },
  { value: 'NEUTRAL', label: 'Neutral' },
  { value: 'TENSE', label: 'Tense' },
];

const today = () => new Date().toISOString().slice(0, 10);

interface ConnectionOutcomeFormProps {
  friend1Id: number;
  friend2Id: number;
  /** Called after a successful save, so the caller can refetch/close/toast. */
  onSaved: () => void;
  onCancel?: () => void;
}

// Lighter-weight than QuickLogModal/the Group batch-log form — Connections are a
// fixed friend1/friend2 pair (no roster to batch), and you weren't there to log
// duration/quality; this just records date + outcome + optional note (Decisions
// Log / Feature B: "CONNECTION meetings use a distinct lighter log form"). Saved
// as an already-DONE Meeting, no FSRS scheduling side effect. Not wired into a
// page yet — ready to be imported from the Group→Connections nudge.
const ConnectionOutcomeForm: React.FC<ConnectionOutcomeFormProps> = ({ friend1Id, friend2Id, onSaved, onCancel }) => {
  const [date, setDate] = useState(today());
  const [outcome, setOutcome] = useState<ConnectionOutcome>('WENT_WELL');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await logConnectionMeeting({
        friend1Id,
        friend2Id,
        date,
        outcome,
        note: note.trim() ? note.trim() : undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log this meeting.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface border border-hairline rounded-card p-6 flex flex-col gap-4">
      <h2 className="m-0 font-display font-bold text-lg text-text-primary">Log a connection meeting</h2>

      <div className="flex flex-col gap-1">
        <label htmlFor="connection-meeting-date" className="mb-1 text-xs font-semibold text-text-muted">Date</label>
        <input
          id="connection-meeting-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-input border border-white/10 rounded-input px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60"
        />
      </div>

      <div>
        <div className="mb-1.5 text-xs font-semibold text-text-muted">How did it go?</div>
        <SegmentedControl options={OUTCOME_OPTIONS} value={outcome} onChange={(v) => setOutcome(v as ConnectionOutcome)} />
      </div>

      <Textarea
        label="Anything to remember? (optional, adds to knowledge)"
        placeholder="Add a fact or note…"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {error && <p className="m-0 text-sm text-bad">{error}</p>}

      <div className="flex gap-2.5">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-none px-5 py-3 rounded-input border border-white/10 text-text-emphasis font-semibold text-sm hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-3 rounded-input border-none bg-accent-gradient text-white font-bold text-sm shadow-button hover:brightness-110 disabled:opacity-50 transition-all"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default ConnectionOutcomeForm;
