import React, { useState } from 'react';
import Input from '../../atoms/Input';
import Textarea from '../../atoms/Textarea';
import { useToast } from '../../molecules/Toast';
import { createManualMeeting } from '../../../services/api/meetingService';

interface ScheduleMeetingModalProps {
  friendId: number | null;
  friendName?: string;
  onClose: () => void;
  /** Called after a successful create so the caller can refetch its meetings list. */
  onScheduled: () => void;
}

// Manual "schedule a meeting" entry point (Feature B) — MANUAL meetings have
// no create UI otherwise. Friend-page only for now: friendId is always set,
// groupId always left null (POST /meetings/manual requires exactly one).
// Modeled on QuickLogModal's overlay/card structure for visual consistency.
const ScheduleMeetingModal: React.FC<ScheduleMeetingModalProps> = ({ friendId, friendName, onClose, onScheduled }) => {
  const { showToast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (friendId === null) return null;

  const handleSave = async () => {
    if (!date) {
      setError('Pick a date.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createManualMeeting(friendId, date, note.trim() || undefined);
      showToast(friendName ? `Meeting scheduled with ${friendName}` : 'Meeting scheduled');
      onScheduled();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule this meeting.');
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
        className="w-[400px] max-w-[92vw] bg-modal border border-white/10 rounded-card p-6 shadow-modal animate-ftmodal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display font-bold text-lg text-text-primary mb-4">
          {friendName ? `Schedule a meeting with ${friendName}` : 'Schedule a meeting'}
        </h3>

        <div className="mb-4">
          <Input label="Date" name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>

        <Textarea
          label="Note (optional)"
          placeholder="What's this meeting for?"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {error && <p className="mt-3 text-sm text-bad">{error}</p>}

        <div className="flex gap-2.5 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-none px-5 py-3 rounded-input border border-white/10 text-text-emphasis font-semibold text-sm hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-input border-none bg-accent-gradient text-white font-bold text-sm shadow-button hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {saving ? 'Scheduling…' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleMeetingModal;
