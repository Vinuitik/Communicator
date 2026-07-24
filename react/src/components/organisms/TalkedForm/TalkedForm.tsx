import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import FormField from '../../molecules/FormField';
import Button, { buttonClasses } from '../../atoms/Button';

// Ported from nginx/static/updateForm/talkedForm.html's #friendForm — the
// same 5-field #friendForm as AddFriendForm, minus "Last Time Spoken" (the
// legacy JS always sends today's date for this one, not a user-editable
// field) and pre-populated from the existing friend instead of starting blank.
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
  cancelTo: string;
}

const TalkedForm: React.FC<TalkedFormProps> = ({ initialValues, onSubmit, submitting, cancelTo }) => {
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
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
      <h2 className="text-xl font-medium text-gray-700 mb-4">Edit Friend</h2>
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
        <div className="flex justify-end gap-2.5">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Updating...' : 'Submit'}
          </Button>
          <Link to={cancelTo} className={buttonClasses}>Cancel</Link>
        </div>
      </form>
    </div>
  );
};

export default TalkedForm;
