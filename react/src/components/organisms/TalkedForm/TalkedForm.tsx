import React, { useState } from 'react';
import FormField from '../../molecules/FormField';

// Ported from nginx/static/updateForm/talkedForm.html's #friendForm — the
// same 5-field #friendForm as AddFriendForm, minus "Last Time Spoken" (the
// legacy JS always sends today's date for this one, not a user-editable
// field) and pre-populated from the existing friend instead of starting blank.
//
// Repurposed for the redesign as the Profile hub's "Edit details" surface
// (see ProfilePage) — quick-log now owns the common "log a chat" case
// (QuickLogModal), so this component's job narrows to editing a friend's
// core fields. Rendered inside a modal now, hence onCancel instead of the
// old cancelTo route Link.
export interface TalkedFormValues {
  name: string;
  experience: string; // '***' | '**' | '*'
  hours: string; // parsed to float by the caller on submit
  dob: string; // yyyy-mm-dd, optional
}

const EXPERIENCE_OPTIONS = [
  { value: '***', label: 'Great!' },
  { value: '**', label: 'Okay' },
  { value: '*', label: 'Bad' },
];

interface TalkedFormProps {
  initialValues: TalkedFormValues;
  onSubmit: (values: TalkedFormValues) => void;
  submitting?: boolean;
  onCancel: () => void;
}

const TalkedForm: React.FC<TalkedFormProps> = ({ initialValues, onSubmit, submitting, onCancel }) => {
  const [values, setValues] = useState<TalkedFormValues>(initialValues);

  const handleChange = (field: keyof TalkedFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField
        label="Name" name="name" value={values.name} onChange={handleChange('name')}
        placeholder="Enter full name" required
      />
      <FormField
        label="Experience" name="experience" type="select" options={EXPERIENCE_OPTIONS}
        value={values.experience} onChange={handleChange('experience')} required
      />
      <FormField
        label="Hours Spoken" name="hours" type="number" min={0} max={24} step={0.01}
        value={values.hours} onChange={handleChange('hours')} required
      />
      <FormField
        label="Date of Birth" name="dob" type="date"
        value={values.dob} onChange={handleChange('dob')}
      />
      <div className="flex gap-2.5 mt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-none px-5 py-3 rounded-input border border-white/10 text-text-emphasis font-semibold text-sm hover:bg-white/5 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 py-3 rounded-input border-none bg-accent-gradient text-white font-bold text-sm shadow-button hover:brightness-110 disabled:opacity-50 transition-all"
        >
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
};

export default TalkedForm;
