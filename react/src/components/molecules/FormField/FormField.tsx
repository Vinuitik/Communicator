import React from 'react';
import Input from '../../atoms/Input';
import Select from '../../atoms/Select';
import Textarea from '../../atoms/Textarea';

type FieldType = 'text' | 'date' | 'number' | 'select' | 'textarea';
type FieldChangeEvent = React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

interface FormFieldProps {
  label: string;
  name: string;
  type?: FieldType;
  placeholder?: string;
  value: string;
  onChange: (e: FieldChangeEvent) => void;
  options?: { value: string; label: string }[]; // required when type === 'select'
  required?: boolean;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  rows?: number;
}

// Dispatches to the right atom by type so every form on the site composes
// the same field visually, instead of each page hand-rolling its own
// label+input markup (the legacy pages each did this slightly differently).
const FormField: React.FC<FormFieldProps> = ({
  label, name, type = 'text', placeholder, value, onChange, options, required, min, max, step, rows,
}) => {
  if (type === 'select') {
    return (
      <Select label={label} name={name} value={value} onChange={onChange} options={options ?? []} required={required} />
    );
  }
  if (type === 'textarea') {
    return (
      <Textarea label={label} name={name} placeholder={placeholder} value={value} onChange={onChange} required={required} rows={rows} />
    );
  }
  return (
    <Input label={label} name={name} type={type} placeholder={placeholder} value={value} onChange={onChange} required={required} min={min} max={max} step={step} />
  );
};

export default FormField;
