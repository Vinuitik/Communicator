import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getShortFriendList } from '../../../services/api/friendService';
import { ShortFriend } from '../../../types/api';

export interface CreateConnectionFormValues {
  friend1Id: number;
  friend2Id: number;
  description: string;
}

interface CreateConnectionFormProps {
  onSubmit: (values: CreateConnectionFormValues) => void;
  submitting?: boolean;
  cancelTo: string;
}

const CreateConnectionForm: React.FC<CreateConnectionFormProps> = ({ onSubmit, submitting, cancelTo }) => {
  const navigate = useNavigate();
  const [friends, setFriends] = useState<ShortFriend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friend1Id, setFriend1Id] = useState<string>('');
  const [friend2Id, setFriend2Id] = useState<string>('');
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setFriends(await getShortFriendList());
      } finally {
        setFriendsLoading(false);
      }
    })();
  }, []);

  const error = !touched ? null
    : !friend1Id || !friend2Id ? 'Pick two friends.'
    : friend1Id === friend2Id ? 'Pick two different friends.'
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!friend1Id || !friend2Id || friend1Id === friend2Id) return;
    onSubmit({ friend1Id: Number(friend1Id), friend2Id: Number(friend2Id), description: description.trim() });
  };

  const selectClasses = (hasError: boolean) =>
    `w-full bg-input border rounded-input px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors ${
      hasError ? 'border-bad/60' : 'border-white/10 focus:border-accent/60'
    }`;

  return (
    <div className="bg-surface border border-hairline rounded-card p-6">
      <h1 className="m-0 mb-[18px] font-display font-bold text-[22px] text-text-primary">New connection</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="friend1" className="mb-1 text-xs font-semibold text-text-muted">First friend</label>
          <select
            id="friend1" value={friend1Id}
            onChange={(e) => setFriend1Id(e.target.value)}
            disabled={friendsLoading}
            className={selectClasses(!!error)}
          >
            <option value="">{friendsLoading ? 'Loading…' : 'Select a friend'}</option>
            {friends.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="friend2" className="mb-1 text-xs font-semibold text-text-muted">Second friend</label>
          <select
            id="friend2" value={friend2Id}
            onChange={(e) => setFriend2Id(e.target.value)}
            disabled={friendsLoading}
            className={selectClasses(!!error)}
          >
            <option value="">{friendsLoading ? 'Loading…' : 'Select a friend'}</option>
            {friends.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        {error && <div className="text-xs text-bad">{error}</div>}

        <div className="flex flex-col gap-1">
          <label htmlFor="description" className="mb-1 text-xs font-semibold text-text-muted">How do they know each other? (optional)</label>
          <textarea
            id="description" value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. College roommates"
            rows={3}
            className="w-full bg-input border border-white/10 rounded-input px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60 transition-colors resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 w-full border-none bg-accent-gradient text-white font-bold text-sm py-3 rounded-input shadow-button hover:brightness-110 disabled:opacity-50 transition-all"
        >
          {submitting ? 'Creating…' : 'Create connection'}
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

export default CreateConnectionForm;
