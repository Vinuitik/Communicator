import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const MIN_LENGTH = 2;
const MAX_LENGTH = 100;
const INVALID_CHARS = /[<>"'&]/;

const validateName = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return 'Group name is required.';
  if (trimmed.length < MIN_LENGTH) return `Group name must be at least ${MIN_LENGTH} characters long.`;
  if (trimmed.length > MAX_LENGTH) return `Group name must not exceed ${MAX_LENGTH} characters.`;
  if (INVALID_CHARS.test(trimmed)) return 'Group name contains invalid characters.';
  return null;
};

export interface CreateGroupFormValues {
  name: string;
}

interface CreateGroupFormProps {
  onSubmit: (values: CreateGroupFormValues) => void;
  submitting?: boolean;
  cancelTo: string;
}

// Ported from nginx/static/createGroup/createGroup.html's #createGroupForm
// (validateName, addCharacterCounter in createGroup.js) — restyled per the
// redesign handoff (Stage 6): same validation/counter, dark-token card.
const CreateGroupForm: React.FC<CreateGroupFormProps> = ({ onSubmit, submitting, cancelTo }) => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);

  const error = touched ? validateName(name) : null;
  const remaining = MAX_LENGTH - name.length;
  const counterClass = remaining < 10 ? 'text-bad' : remaining < 50 ? 'text-soon' : 'text-text-faint';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (validateName(name)) return;
    onSubmit({ name: name.trim() });
  };

  return (
    <div className="bg-surface border border-hairline rounded-card p-6">
      <h1 className="m-0 mb-[18px] font-display font-bold text-[22px] text-text-primary">New group</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-1">
        <label htmlFor="name" className="mb-1.5 text-xs font-semibold text-text-muted">Group name</label>
        <input
          id="name" name="name" value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="e.g. College Friends"
          className={`w-full bg-input border rounded-input px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors ${
            error ? 'border-bad/60' : touched ? 'border-good/60' : 'border-white/10 focus:border-accent/60'
          }`}
        />
        <div className={`mt-1.5 text-xs text-right ${counterClass}`}>{name.length}/{MAX_LENGTH} characters</div>
        {error && <div className="text-xs text-bad">{error}</div>}
        {!error && touched && <div className="text-xs text-good">Group name looks good!</div>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-4 w-full border-none bg-accent-gradient text-white font-bold text-sm py-3 rounded-input shadow-button hover:brightness-110 disabled:opacity-50 transition-all"
        >
          {submitting ? 'Creating…' : 'Create group'}
        </button>
        <button
          type="button"
          onClick={() => navigate(cancelTo)}
          className="mt-1 border-none bg-transparent text-text-muted text-[12.5px] hover:text-text-emphasis transition-colors"
        >
          Cancel
        </button>
      </form>
    </div>
  );
};

export default CreateGroupForm;
