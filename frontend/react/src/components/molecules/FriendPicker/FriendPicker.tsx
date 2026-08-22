import React, { useEffect, useState } from 'react';
import Avatar from '../../atoms/Avatar';
import { getShortFriendList } from '../../../services/api/friendService';
import { ShortFriend } from '../../../types/api';

interface FriendPickerBaseProps {
  id?: string;
  disabled?: boolean;
  className?: string;
  /** 'dropdown' = native <select> (default for single-select). 'list' = row list
   *  with checkboxes (multi) or click-to-select rows (single) — default for
   *  multi-select, also opt-in for single-select when a browsable/searchable
   *  UI is wanted instead of a <select> (e.g. ShareLandingPage's share-to-friend picker). */
  variant?: 'dropdown' | 'list';
  /** Only meaningful with variant 'list' — adds a name-filter text input above the rows. */
  searchable?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  errorMessage?: string;
}

interface SingleFriendPickerProps extends FriendPickerBaseProps {
  multiple?: false;
  value: number | null;
  onChange: (id: number | null) => void;
}

interface MultiFriendPickerProps extends FriendPickerBaseProps {
  multiple: true;
  value: number[];
  onChange: (ids: number[]) => void;
}

export type FriendPickerProps = SingleFriendPickerProps | MultiFriendPickerProps;

const rowClasses = 'flex items-center gap-3 px-3.5 py-2 rounded-lg text-left transition-colors';

// Shared friend-fetch + friend-selection UI. Owns the getShortFriendList()
// call + loading/error state so callers never re-implement that fetch —
// callers only keep the selected id(s) (controlled value/onChange, same
// shape as before: a plain number for single-select, number[] for multi).
// Extracted from CreateConnectionForm (two single-select <select>s) and
// MeetingEditModal (one multi-select checkbox list) — see FLOWS.md for the
// duplication this replaces. `variant: 'list'` + `searchable` also covers
// ShareLandingPage's upcoming share-to-friend picker (single-select, filterable).
const FriendPicker: React.FC<FriendPickerProps> = (props) => {
  const {
    id, disabled, className,
    placeholder = 'Select a friend',
    searchable = false,
    emptyMessage = 'No friends yet.',
    errorMessage = 'Could not load your friends list.',
  } = props;
  const variant = props.variant ?? (props.multiple ? 'list' : 'dropdown');

  const [friends, setFriends] = useState<ShortFriend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const list = await getShortFriendList();
        if (!cancelled) setFriends(list);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return <div className="text-xs text-bad">{errorMessage}</div>;
  }

  if (variant === 'dropdown') {
    const { value, onChange } = props as SingleFriendPickerProps;
    return (
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        disabled={disabled || loading}
        className={className}
      >
        <option value="">{loading ? 'Loading…' : placeholder}</option>
        {friends.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
    );
  }

  const visible = searchable && query.trim()
    ? friends.filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase()))
    : friends;

  return (
    <div id={id} className={className ?? ''}>
      {searchable && (
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search friends…"
          disabled={loading}
          className="w-full mb-1.5 bg-input border border-white/10 rounded-input px-3 py-2 text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60 transition-colors"
        />
      )}
      <div className="flex flex-col gap-1.5 max-h-[190px] overflow-y-auto">
        {loading ? (
          <div className="text-center p-4 text-text-muted text-sm">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="text-center p-4 text-text-muted text-sm">{emptyMessage}</div>
        ) : props.multiple ? (
          visible.map((f) => {
            const checked = props.value.includes(f.id);
            return (
              <label key={f.id} className={`${rowClasses} cursor-pointer bg-surface-2 hover:bg-input`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = checked ? props.value.filter((fid) => fid !== f.id) : [...props.value, f.id];
                    props.onChange(next);
                  }}
                  className="accent-accent"
                />
                <Avatar id={f.id} name={f.name} size={26} />
                <span className="flex-1 text-[13px] text-text-secondary">{f.name}</span>
              </label>
            );
          })
        ) : (
          visible.map((f) => {
            const selected = props.value === f.id;
            return (
              <button
                type="button"
                key={f.id}
                onClick={() => props.onChange(selected ? null : f.id)}
                className={`${rowClasses} w-full border-none ${selected ? 'bg-accent/25' : 'bg-surface-2 hover:bg-input'}`}
              >
                <Avatar id={f.id} name={f.name} size={26} />
                <span className="flex-1 text-[13px] text-text-secondary">{f.name}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default FriendPicker;
