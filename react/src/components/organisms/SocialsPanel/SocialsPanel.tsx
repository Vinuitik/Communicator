import React, { useCallback, useEffect, useState } from 'react';
import Select from '../../atoms/Select';
import Input from '../../atoms/Input';
import ConfirmDialog from '../../molecules/ConfirmDialog';
import { getFriendSocials, createFriendSocial, deleteFriendSocial } from '../../../services/api/friendService';
import { Social, SocialPayload } from '../../../types/api';
import { PLATFORM_ICONS, PLATFORM_OPTIONS, urlHelpText, validateSocialUrl } from '../../../utils/socialFormat';

// Social-icon tile tint (style S-C from the handoff) — only the 5 platforms
// the design defines get a specific brand color; everything else falls back
// to the accent tint so new platforms don't look broken.
const PLATFORM_TINT: Record<string, string> = {
  Instagram: '#E1306C',
  LinkedIn: '#0A66C2',
  Twitter: '#EDE9F8',
  Email: '#F5B544',
  Phone: '#46D39A',
};

interface SocialsPanelProps {
  friendId: number;
  friendName: string;
}

// Socials & contact tab — a lighter-weight rebuild of SocialPage (which
// owned a whole standalone route pre-redesign) for the Profile hub. Inline
// edit-in-row is dropped for scope (delete + re-add covers it); everything
// else (create/delete, platform validation) reuses the same
// friendService calls SocialPage used.
const SocialsPanel: React.FC<SocialsPanelProps> = ({ friendId, friendName }) => {
  const [socials, setSocials] = useState<Social[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ platform: '', url: '', displayName: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const load = useCallback(async () => {
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

  useEffect(() => { load(); }, [load]);

  const { help, placeholder } = urlHelpText(form.platform);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.platform) { setFormError('Platform is required'); return; }
    const urlError = validateSocialUrl(form.url, form.platform);
    if (urlError) { setFormError(urlError); return; }
    setSubmitting(true);
    setFormError(null);
    try {
      const payload: SocialPayload = { platform: form.platform, url: form.url.trim(), displayName: form.displayName.trim() || undefined };
      await createFriendSocial(friendId, payload);
      setForm({ platform: '', url: '', displayName: '' });
      setAdding(false);
      await load();
    } catch {
      setFormError('Failed to add this link');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    setConfirmId(null);
    try {
      await deleteFriendSocial(id);
      await load();
    } catch {
      // list just won't update — the row stays, user can retry the delete
    }
  };

  return (
    <div className="bg-surface border border-hairline rounded-card p-5 max-w-[620px]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-bold text-text-primary">Socials & contact</h2>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="border-none bg-accent-gradient text-white font-bold text-[12.5px] px-3.5 py-2 rounded-input shadow-button-sm hover:brightness-110 transition-all"
        >
          {adding ? 'Cancel' : '+ Add link'}
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="flex flex-col gap-3 mb-4 p-3.5 bg-surface-2 rounded-[10px]">
          <Select
            label="Platform" value={form.platform}
            onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
            options={[{ value: '', label: 'Select platform' }, ...PLATFORM_OPTIONS.map((p) => ({ value: p, label: `${PLATFORM_ICONS[p]} ${p}` }))]}
            required
          />
          <div>
            <Input
              label="URL / contact" value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder={placeholder} required
            />
            <p className="text-[11px] text-text-faint mt-1">{help}</p>
          </div>
          <Input
            label="Display name (optional)" value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            placeholder="e.g. @username"
          />
          {formError && <div className="text-bad text-xs">{formError}</div>}
          <button
            type="submit"
            disabled={submitting}
            className="self-start px-4 py-2 rounded-input border-none bg-accent-gradient text-white font-bold text-sm shadow-button-sm hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {submitting ? 'Adding…' : 'Add link'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-center text-text-muted py-6 text-sm">Loading…</div>
      ) : error ? (
        <div className="text-center text-bad py-6 text-sm">{error}</div>
      ) : socials.length === 0 ? (
        <div className="text-center py-11 px-4 border border-dashed border-white/10 rounded-card">
          <div className="text-2xl opacity-50 mb-2.5">🔗</div>
          <div className="text-sm text-text-muted font-semibold">No links yet</div>
          <div className="text-xs text-text-faint mt-1">Add {friendName}&apos;s socials, email or phone so they&apos;re one tap away.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {socials.map((social) => (
            <div key={social.id} className="flex items-center gap-3 px-3.5 py-2.5 border border-white/[.07] rounded-[10px] hover:border-accent/30 transition-colors">
              <span
                className="w-[34px] h-[34px] rounded-input flex items-center justify-center flex-none text-base"
                style={{ background: 'rgba(255,255,255,.04)', color: PLATFORM_TINT[social.platform] }}
              >
                {PLATFORM_ICONS[social.platform] || '🔗'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-text-primary">{social.platform}</div>
                <div className="text-[11.5px] text-text-muted truncate">{social.displayName || social.url}</div>
              </div>
              <a href={social.url} target="_blank" rel="noreferrer" className="text-text-faint hover:text-accent-light text-base">↗</a>
              <button type="button" onClick={() => setConfirmId(social.id)} className="text-text-faint hover:text-bad text-xs">✕</button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmId !== null}
        title="Delete this link?"
        confirmLabel="Delete"
        danger
        onConfirm={() => confirmId !== null && handleDelete(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
};

export default SocialsPanel;
