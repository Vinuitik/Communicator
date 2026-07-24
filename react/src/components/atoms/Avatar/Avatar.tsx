import React from 'react';
import { avatarColor, initials } from '../../../utils/avatar';

interface AvatarProps {
  id: number;
  name: string;
  size?: number;
  rounded?: 'avatar' | 'avatar-lg';
  className?: string;
}

// Colored initials tile — the fallback half of the handoff's empty-state
// rule ("show the photo if present, else a colored initials tile"). Photo
// rendering is handled by callers that have photo data (Profile hero).
// Tailwind's class scanner needs literal class strings (not interpolated
// ones) to generate the right CSS, hence the explicit branch instead of a
// template literal.
const Avatar: React.FC<AvatarProps> = ({ id, name, size = 36, rounded = 'avatar', className }) => (
  <span
    className={`flex-none flex items-center justify-center font-display font-bold text-white ${
      rounded === 'avatar-lg' ? 'rounded-avatar-lg' : 'rounded-avatar'
    } ${className ?? ''}`}
    style={{ width: size, height: size, background: avatarColor(id), fontSize: Math.max(11, size * 0.34) }}
  >
    {initials(name)}
  </span>
);

export default Avatar;
