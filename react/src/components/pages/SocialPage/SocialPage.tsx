import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getFriend, getFriendSocials, createFriendSocial, updateFriendSocial, deleteFriendSocial,
} from '../../../services/api/friendService';
import { Social, SocialPayload } from '../../../types/api';
import { PLATFORM_ICONS, PLATFORM_OPTIONS, urlHelpText, validateSocialUrl } from '../../../utils/socialFormat';
import { API_BASE } from '../../../services/api/config';
import Select from '../../atoms/Select';
import Input from '../../atoms/Input';
import Button from '../../atoms/Button';
import { buttonClasses } from '../../atoms/Button';

const PLATFORM_SELECT_OPTIONS = [
  { value: '', label: 'Select Platform' },
  ...PLATFORM_OPTIONS.map((p) => ({ value: p, label: `${PLATFORM_ICONS[p]} ${p}` })),
];

interface FormState {
  platform: string;
  url: string;
  displayName: string;
}

const emptyForm: FormState = { platform: '', url: '', displayName: '' };

// Ported from nginx/static/social/social.html + its modules/ directory —
// manages one friend's social/contact links (Instagram, phone, email, etc).
// Only reachable from profile.js's socialLinks module (`/social?friendId=X`)
// — not linked from anywhere else in the legacy app, and not linked from
// anywhere in the SPA yet either since ProfilePage isn't ported. Repointed
// to a path param (friendSocialPath) for consistency with every other
// per-entity SPA route; will become reachable through the UI once
// ProfilePage's social-links module is ported and links here.
//
// SocialController's full CRUD already existed — no backend changes needed.
// See friendService.ts's social functions for a real bug this port found
// (and deliberately did NOT "fix"): the legacy JS's request body carried a
// capital "URL" key that the backend actually ignores (it reads lowercase
// "url"), so the platform-specific auto-formatting (mailto:/https:// prefix)
// never applied in production. This port matches that real behavior.
//
// Edit is inline-in-row rather than the legacy's modal overlay — same
// "behavior preserved, presentation simplified" tradeoff as CreateGroupPage's
// button-color unification. Delete uses window.confirm instead of the
// legacy's custom confirm modal, matching every other delete flow already in
// this SPA (HomePage, GroupsPage, GroupDetailsPage).
const SocialPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const friendId = Number(id);

  const [friendName, setFriendName] = useState<string | null>(null);
  const [socials, setSocials] = useState<Social[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    getFriend(friendId).then((f) => setFriendName(f.name)).catch(() => setFriendName(null));
  }, [friendId]);

  const loadSocials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSocials(await getFriendSocials(friendId));
    } catch {
      setError('Failed to load social media links');
    } finally {
      setLoading(false);
    }
  }, [friendId]);

  useEffect(() => { loadSocials(); }, [loadSocials]);

  const profileHref = `${API_BASE.FRIEND}/profile/${friendId}`;
  const { help, placeholder } = urlHelpText(form.platform);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.platform) {
      setFormError('Platform is required');
      return;
    }
    const urlError = validateSocialUrl(form.url, form.platform);
    if (urlError) {
      setFormError(urlError);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const payload: SocialPayload = { platform: form.platform, url: form.url.trim(), displayName: form.displayName.trim() || undefined };
      await createFriendSocial(friendId, payload);
      setForm(emptyForm);
      await loadSocials();
    } catch {
      setFormError('Failed to create social media link');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (social: Social) => {
    setEditingId(social.id);
    setEditForm({ platform: social.platform, url: social.url, displayName: social.displayName || '' });
    setEditError(null);
  };

  const handleUpdate = async (socialId: number) => {
    const urlError = validateSocialUrl(editForm.url, editForm.platform);
    if (!editForm.platform || urlError) {
      setEditError(urlError || 'Platform is required');
      return;
    }
    try {
      const payload: SocialPayload = { platform: editForm.platform, url: editForm.url.trim(), displayName: editForm.displayName.trim() || undefined };
      await updateFriendSocial(socialId, payload);
      setEditingId(null);
      await loadSocials();
    } catch {
      setEditError('Failed to update social media link');
    }
  };

  const handleDelete = async (socialId: number) => {
    if (!window.confirm('Are you sure you want to delete this social media link?')) return;
    try {
      await deleteFriendSocial(socialId);
      await loadSocials();
    } catch {
      window.alert('Failed to delete social media link');
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <div className="flex items-center gap-4 mb-6">
        <a href={profileHref} className={buttonClasses}>← Back to Profile</a>
        <div>
          <h1 className="text-2xl font-medium text-gray-800">Manage Social Media</h1>
          <p className="text-gray-500 text-sm">{friendName ? `Managing social media for ${friendName}` : `Managing social media for friend #${friendId}`}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">Add New Social Media</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Select
            label="Platform"
            value={form.platform}
            onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
            options={PLATFORM_SELECT_OPTIONS}
            required
          />
          <div>
            <Input
              label="URL / Contact"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder={placeholder}
              required
            />
            <p className="text-xs text-gray-500 mt-1">{help}</p>
          </div>
          <Input
            label="Display Name (optional)"
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            placeholder="e.g., @username or Display Name"
          />
          {formError && <div className="text-red-600 text-sm">{formError}</div>}
          <div className="flex gap-3 justify-end">
            <a href={profileHref} className="px-5 py-2.5 text-base text-gray-700 border border-gray-300 rounded text-center hover:bg-gray-50">Cancel</a>
            <Button type="submit" disabled={submitting}>{submitting ? 'Adding...' : 'Add Social Media'}</Button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-medium mb-4">Existing Social Media</h2>
        {loading ? (
          <div className="text-center text-gray-500 p-6">Loading social media links...</div>
        ) : error ? (
          <div className="text-center text-red-600 p-6">{error}</div>
        ) : socials.length === 0 ? (
          <div className="text-center text-gray-500 p-6">
            <div className="text-3xl mb-2">📱</div>
            <div>No social media links yet</div>
            <div className="text-sm">Add social media links to keep track of how to reach this friend</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {socials.map((social) => (
              <div key={social.id} className="border border-gray-200 rounded-lg p-3.5">
                {editingId === social.id ? (
                  <div className="flex flex-col gap-3">
                    <Select
                      value={editForm.platform}
                      onChange={(e) => setEditForm((f) => ({ ...f, platform: e.target.value }))}
                      options={PLATFORM_OPTIONS.map((p) => ({ value: p, label: `${PLATFORM_ICONS[p]} ${p}` }))}
                    />
                    <Input value={editForm.url} onChange={(e) => setEditForm((f) => ({ ...f, url: e.target.value }))} />
                    <Input value={editForm.displayName} onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))} placeholder="Display name (optional)" />
                    {editError && <div className="text-red-600 text-sm">{editError}</div>}
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setEditingId(null)} className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                      <button type="button" onClick={() => handleUpdate(social.id)} className="px-4 py-1.5 text-sm bg-brand text-white rounded hover:bg-brand-dark">Update</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl flex-shrink-0">{PLATFORM_ICONS[social.platform] || '🔗'}</span>
                      <div className="min-w-0">
                        <div className="font-medium">{social.platform}</div>
                        {social.displayName && <div className="text-sm text-gray-600">{social.displayName}</div>}
                        <a href={social.url} target="_blank" rel="noreferrer" className="text-sm text-brand truncate block hover:underline">{social.url}</a>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button type="button" onClick={() => startEdit(social)} title="Edit" className="p-2 rounded hover:bg-gray-100">✏️</button>
                      <button type="button" onClick={() => handleDelete(social.id)} title="Delete" className="p-2 rounded hover:bg-gray-100">🗑️</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialPage;
