import React, { useState } from 'react';
import Avatar from '../../atoms/Avatar';
import Input from '../../atoms/Input';
import Textarea from '../../atoms/Textarea';
import RatingPicker, { EXPERIENCE_RATINGS } from '../../molecules/RatingPicker';
import { useToast } from '../../molecules/Toast';
import { Friend, NewFriendPayload } from '../../../types/api';
import { talkedToFriend } from '../../../services/api/friendService';

interface QuickLogModalProps {
  friend: Friend | null;
  onClose: () => void;
  /** Called after a successful save so the caller can refetch/patch its list. */
  onSaved: (friendId: number) => void;
}

// Replaces the full-page /talked form for the common case (backlog: a
// lighter-weight log-a-chat flow). There's no dedicated lightweight backend
// endpoint for this (confirmed — Analytics only has experience/date/hours,
// no rating/note fields), so this still calls the existing talkedToFriend
// PUT with a minimal payload built from the friend already in hand — no
// extra GET needed. The "note" goes into knowledge, same as the full form.
const QuickLogModal: React.FC<QuickLogModalProps> = ({ friend, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [rating, setRating] = useState('***');
  const [hours, setHours] = useState('1');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!friend) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const payload: NewFriendPayload = {
        name: friend.name,
        plannedSpeakingTime: today,
        experience: rating,
        dateOfBirth: friend.dateOfBirth ?? null,
        analytics: [{ date: today, experience: rating, hours: parseFloat(hours) || 0 }],
        knowledge: note.trim() ? [{ fact: note.trim(), importance: 1 }] : [],
      };
      await talkedToFriend(friend.id, payload);
      onSaved(friend.id);
      showToast(`Logged a chat with ${friend.name} · rescheduled`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log this chat.');
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
        className="w-[440px] max-w-[92vw] bg-modal border border-white/10 rounded-card p-6 shadow-modal animate-ftmodal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-5">
          <Avatar id={friend.id} name={friend.name} size={46} />
          <div>
            <div className="text-xs text-text-muted">Log a chat with</div>
            <div className="font-display font-bold text-lg text-text-primary">{friend.name}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto w-8 h-8 rounded-lg border-none bg-input-2 text-text-muted cursor-pointer hover:text-text-emphasis transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="text-xs text-text-secondary mb-2">How did it go?</div>
        <RatingPicker options={EXPERIENCE_RATINGS} value={rating} onChange={setRating} className="mb-4" />

        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Input label="Hours spoken" type="number" min={0} step={0.25} value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
          <div className="flex-1">
            <div className="mb-1.5 text-xs font-semibold text-text-muted">When</div>
            <div className="bg-input-2 border border-white/10 rounded-input px-3.5 py-2.5 text-sm text-text-emphasis">Today</div>
          </div>
        </div>

        <Textarea
          label="Anything to remember? (adds to knowledge)"
          placeholder="Add a fact or note…"
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
            {saving ? 'Saving…' : 'Save & reschedule'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickLogModal;
