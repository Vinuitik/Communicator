import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Button, { buttonClasses } from '../../atoms/Button';

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
// (validateName, addCharacterCounter in createGroup.js).
const CreateGroupForm: React.FC<CreateGroupFormProps> = ({ onSubmit, submitting, cancelTo }) => {
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);

  const error = touched ? validateName(name) : null;
  const remaining = MAX_LENGTH - name.length;
  const counterClass = remaining < 10 ? 'text-red-600' : remaining < 50 ? 'text-amber-600' : 'text-gray-500';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (validateName(name)) return;
    onSubmit({ name: name.trim() });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="font-medium text-gray-800">Group Name *</label>
          <input
            id="name" name="name" value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="e.g., Work Colleagues, Family, College Friends"
            className={`border-2 rounded-lg p-3 text-base focus:outline-none transition-colors ${
              error ? 'border-red-500' : touched ? 'border-green-500' : 'border-gray-200 focus:border-brand'
            }`}
          />
          <div className="text-sm text-gray-500 italic">Enter a name that helps you categorize relationships</div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          {!error && touched && <div className="text-sm text-green-600">Group name looks good!</div>}
          <div className={`text-sm text-right ${counterClass}`}>{name.length}/{MAX_LENGTH} characters</div>
        </div>
        <div className="flex justify-center gap-4">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating Group...' : 'Create Group'}
          </Button>
          <Link to={cancelTo} className={buttonClasses}>Cancel</Link>
        </div>
      </form>
    </div>
  );
};

export default CreateGroupForm;
