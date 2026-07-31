import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../../atoms/Input';
import Select from '../../atoms/Select';
import RatingPicker, { EXPERIENCE_RATINGS } from '../../molecules/RatingPicker';
import SegmentedControl from '../../molecules/SegmentedControl';

// Mirrors RoleProperties' starter presets in application.yml (fsrs.role.desired-retention).
const ROLE_OPTIONS = [
  { value: 'Partner', label: 'Partner' },
  { value: 'Close', label: 'Close friend' },
  { value: 'Casual', label: 'Casual' },
  { value: 'Family', label: 'Family' },
];

// Ported from nginx/static/addFriendForm/addForm.html's #friendForm —
// restyled per the redesign handoff (Stage 6): "How was the last chat?"
// moves from a plain <select> to the same colored rating chips QuickLogModal
// uses, matching the mock's Great/Okay/Bad buttons exactly. Same fields,
// same submit shape — visual-only change.
export interface AddFriendFormValues {
  name: string;
  lastSpoken: string; // yyyy-mm-dd
  experience: string; // '***' | '**' | '*'
  hours: string; // parsed to float by the caller on submit
  inPerson: boolean;
  dob: string; // yyyy-mm-dd, optional
  role: string; // contact-expectation role -> desiredRetention preset (RoleProperties)
}

const INITIAL_VALUES: AddFriendFormValues = {
  name: '',
  lastSpoken: '',
  experience: EXPERIENCE_RATINGS[0].value,
  hours: '',
  inPerson: true,
  dob: '',
  role: 'Casual',
};

interface AddFriendFormProps {
  onSubmit: (values: AddFriendFormValues) => void;
  submitting?: boolean;
  cancelTo: string;
}

const AddFriendForm: React.FC<AddFriendFormProps> = ({ onSubmit, submitting, cancelTo }) => {
  const navigate = useNavigate();
  const [values, setValues] = useState<AddFriendFormValues>(INITIAL_VALUES);

  const handleChange = (field: keyof AddFriendFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <div className="bg-surface border border-hairline rounded-card p-6">
      <h1 className="m-0 mb-[18px] font-display font-bold text-[22px] text-text-primary">Add a friend</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <Input label="Name" name="name" value={values.name} onChange={handleChange('name')} placeholder="Full name" required />
        <div className="flex gap-3">
          <div className="flex-1">
            <Input label="Last time spoken" name="lastSpoken" type="date" value={values.lastSpoken} onChange={handleChange('lastSpoken')} required />
          </div>
          <div className="flex-1">
            <Input label="Birthday" name="dob" type="date" value={values.dob} onChange={handleChange('dob')} placeholder="optional" />
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-semibold text-text-muted">How was the last chat?</div>
          <RatingPicker options={EXPERIENCE_RATINGS} value={values.experience} onChange={(v) => setValues((prev) => ({ ...prev, experience: v }))} />
        </div>
        <Input label="Hours spoken" name="hours" type="number" min={0} max={24} step={0.01} value={values.hours} onChange={handleChange('hours')} required />
        <div>
          <div className="mb-1.5 text-xs font-semibold text-text-muted">How</div>
          <SegmentedControl
            options={[{ value: 'in-person', label: 'In person' }, { value: 'remote', label: 'Remote' }]}
            value={values.inPerson ? 'in-person' : 'remote'}
            onChange={(v) => setValues((prev) => ({ ...prev, inPerson: v === 'in-person' }))}
          />
        </div>
        <Select
          label="Role"
          name="role"
          options={ROLE_OPTIONS}
          value={values.role}
          onChange={(e) => setValues((prev) => ({ ...prev, role: e.target.value }))}
        />

        <button
          type="submit"
          disabled={submitting}
          className="mt-1.5 border-none bg-accent-gradient text-white font-bold text-sm py-3 rounded-input shadow-button hover:brightness-110 disabled:opacity-50 transition-all"
        >
          {submitting ? 'Saving…' : 'Save friend'}
        </button>
        <button
          type="button"
          onClick={() => navigate(cancelTo)}
          className="border-none bg-transparent text-text-muted text-[12.5px] hover:text-text-emphasis transition-colors"
        >
          Cancel
        </button>
      </form>
    </div>
  );
};

export default AddFriendForm;
