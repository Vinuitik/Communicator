import React, { useCallback, useEffect, useState } from 'react';
import {
  getLlmSettings, setLlmMode, saveProviderKey, removeProviderKey, checkHostWrapperStatus,
  getBackupStatus, disconnectDrive, setBackupEnabled, runBackup, restoreBackup,
} from '../../../services/api/settingsService';
import { BackupStatus, HostWrapperStatus, KNOWN_PROVIDERS } from '../../../types/api';
import ConfirmDialog from '../../molecules/ConfirmDialog';
import { useToast } from '../../molecules/Toast';

const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Gemini',
  github: 'GitHub Models',
  mistral: 'Mistral',
  groq: 'Groq',
  deepseek: 'DeepSeek',
  anthropic: 'Anthropic',
};

const statusDotClass = (state: 'unknown' | 'up' | 'down') =>
  `w-2.5 h-2.5 rounded-full flex-shrink-0 inline-block ${
    state === 'up' ? 'bg-good' : state === 'down' ? 'bg-bad' : 'bg-text-faintest'
  }`;

const statusTextClass = (variant?: 'ok' | 'error') =>
  variant === 'ok' ? 'text-good' : variant === 'error' ? 'text-bad' : 'text-text-muted';

const formatBytes = (n?: number): string => {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let value = n;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value.toFixed(1)} ${units[i]}`;
};

const dangerButtonClasses =
  'px-4 py-2 rounded-input text-sm font-semibold bg-bad/[.12] text-bad border border-bad/40 hover:bg-bad/[.2] disabled:opacity-50 transition-colors';
const ghostButtonClasses =
  'px-4 py-2 rounded-input text-sm font-semibold bg-input-2 text-text-emphasis border border-white/10 hover:bg-input disabled:opacity-50 transition-colors';
const primaryButtonClasses =
  'px-4 py-2 rounded-input text-sm font-bold bg-accent-gradient text-white shadow-button-sm hover:brightness-110 disabled:opacity-50 transition-all';

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="bg-surface border border-hairline rounded-card p-5 mb-4">
    <h2 className="text-[15px] font-bold text-text-primary m-0 mb-3.5">{title}</h2>
    {children}
  </section>
);

// Ported from nginx/static/settings/settings.js — two independent backend
// services behind one page, matching the legacy layout exactly:
// - AI mode/provider keys: ai_agent's /settings/llm (settingsService.getLlmSettings
//   et al.) — see PROTO.md "LLM settings" for how that service already works.
// - Google Drive backup/restore: the `backup` Java service at /backup/**
//   (BackupController) — nightly cron + manual run/restore.
// Neither backend needed changes; both already fully implement what this
// page calls, the legacy page was simply the only UI for them.
const SettingsPage: React.FC = () => {
  const { showToast } = useToast();
  const [mode, setModeState] = useState<'ollama' | 'cloud' | null>(null);
  const [modeStatus, setModeStatus] = useState<{ text: string; variant?: 'ok' | 'error' }>({ text: '' });
  const [providers, setProviders] = useState<Record<string, boolean>>({});
  const [providerInputs, setProviderInputs] = useState<Record<string, string>>({});
  const [providerBusy, setProviderBusy] = useState<Record<string, boolean>>({});
  const [hostWrapper, setHostWrapper] = useState<HostWrapperStatus | null>(null);

  const [backup, setBackup] = useState<BackupStatus | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupRunStatus, setBackupRunStatus] = useState<{ text: string; variant?: 'ok' | 'error' }>({ text: '' });
  const [restoreStatus, setRestoreStatus] = useState<{ text: string; variant?: 'ok' | 'error' }>({ text: '' });
  const [restoring, setRestoring] = useState(false);
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);

  const loadLlmSettings = useCallback(async () => {
    try {
      const data = await getLlmSettings();
      setModeState(data.mode);
      setProviders(data.providers);
    } catch (err) {
      setModeStatus({ text: `Could not load settings: ${err instanceof Error ? err.message : err}`, variant: 'error' });
    }
  }, []);

  useEffect(() => { loadLlmSettings(); }, [loadLlmSettings]);
  useEffect(() => { checkHostWrapperStatus().then(setHostWrapper); }, []);

  const loadBackupStatus = useCallback(async () => {
    try {
      setBackup(await getBackupStatus());
      setBackupError(null);
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => { loadBackupStatus(); }, [loadBackupStatus]);

  const handleModeChange = async (value: 'ollama' | 'cloud') => {
    setModeState(value);
    setModeStatus({ text: 'Saving…' });
    try {
      await setLlmMode(value);
      setModeStatus({ text: `Mode set to ${value}.`, variant: 'ok' });
    } catch (err) {
      setModeStatus({ text: `Could not switch mode: ${err instanceof Error ? err.message : err}`, variant: 'error' });
    }
  };

  const handleSaveProviderKey = async (provider: string) => {
    const apiKey = (providerInputs[provider] || '').trim();
    if (!apiKey) return;
    setProviderBusy((b) => ({ ...b, [provider]: true }));
    try {
      await saveProviderKey(provider, apiKey);
      setProviderInputs((s) => ({ ...s, [provider]: '' }));
      await loadLlmSettings();
    } catch (err) {
      showToast(`Could not save key: ${err instanceof Error ? err.message : err}`, 'error');
    } finally {
      setProviderBusy((b) => ({ ...b, [provider]: false }));
    }
  };

  const handleRemoveProviderKey = async (provider: string) => {
    setProviderBusy((b) => ({ ...b, [provider]: true }));
    try {
      await removeProviderKey(provider);
      await loadLlmSettings();
    } catch (err) {
      showToast(`Could not remove key: ${err instanceof Error ? err.message : err}`, 'error');
    } finally {
      setProviderBusy((b) => ({ ...b, [provider]: false }));
    }
  };

  const handleDisconnectDrive = async () => {
    setConfirmDisconnectOpen(false);
    try {
      await disconnectDrive();
      await loadBackupStatus();
    } catch (err) {
      showToast(`Could not disconnect: ${err instanceof Error ? err.message : err}`, 'error');
    }
  };

  const handleToggleBackupEnabled = async () => {
    if (!backup) return;
    const next = !backup.enabled;
    setBackup({ ...backup, enabled: next });
    try {
      await setBackupEnabled(next);
    } catch (err) {
      setBackup({ ...backup, enabled: !next });
      showToast(`Could not update schedule: ${err instanceof Error ? err.message : err}`, 'error');
    }
  };

  const handleRunBackup = async () => {
    setBackupRunStatus({ text: 'Starting…' });
    try {
      const result = await runBackup();
      setBackupRunStatus(result.started
        ? { text: 'Backup started.', variant: 'ok' }
        : { text: result.reason || 'A backup is already running.' });
    } catch (err) {
      setBackupRunStatus({ text: `Could not start backup: ${err instanceof Error ? err.message : err}`, variant: 'error' });
    }
    setTimeout(loadBackupStatus, 2000);
  };

  const handleRestore = async () => {
    setConfirmRestoreOpen(false);
    setRestoring(true);
    setRestoreStatus({ text: 'Restoring…' });
    try {
      const result = await restoreBackup();
      setRestoreStatus(result.started
        ? { text: 'Restore started — a restart of the app services is recommended once it finishes.', variant: 'ok' }
        : { text: result.reason || 'A backup/restore is already running.' });
    } catch (err) {
      setRestoreStatus({ text: `Could not start restore: ${err instanceof Error ? err.message : err}`, variant: 'error' });
    } finally {
      setRestoring(false);
    }
    setTimeout(loadBackupStatus, 2000);
  };

  const configuredCount = hostWrapper?.providers
    ? Object.values(hostWrapper.providers).filter((p) => p.configured).length
    : 0;

  return (
    <div className="animate-ftfade max-w-[680px] mx-auto px-[30px] py-6 pb-16">
      <h1 className="m-0 mb-[18px] font-display font-bold text-[26px] tracking-tight text-text-primary">Settings</h1>

      <Card title="Where the AI runs">
        <p className="text-xs text-text-muted mb-3.5 -mt-2">Choose whether chat and knowledge summarization run on your own machine or in the cloud.</p>
        <div className="flex flex-col gap-2.5">
          {(['ollama', 'cloud'] as const).map((value) => (
            <label
              key={value}
              className={`flex gap-3 items-start p-3.5 border rounded-[11px] cursor-pointer transition-colors ${
                mode === value ? 'border-accent bg-accent/10' : 'border-white/10 hover:border-white/20'
              }`}
            >
              <input
                type="radio"
                name="mode"
                value={value}
                checked={mode === value}
                onChange={() => handleModeChange(value)}
                className="mt-1 flex-shrink-0 accent-accent"
              />
              <div>
                <strong className="block mb-0.5 text-[13.5px] text-text-primary">{value === 'ollama' ? 'Local (Ollama)' : 'Cloud'}</strong>
                <p className="text-xs text-text-muted">
                  {value === 'ollama'
                    ? 'Runs entirely on this machine. Nothing about your friends or conversations leaves the box. Slower, and quality depends on the local model.'
                    : 'Routed through a multi-provider gateway (Gemini, GitHub Models, Mistral, Groq, DeepSeek, Anthropic) with automatic failover. Faster and higher quality, but your messages and friend data are sent to whichever third-party provider handles the request.'}
                </p>
              </div>
            </label>
          ))}
        </div>
        {modeStatus.text && (
          <div className={`mt-3 text-sm ${statusTextClass(modeStatus.variant)}`}>{modeStatus.text}</div>
        )}
      </Card>

      <Card title="Cloud gateway status">
        <div className="flex items-center gap-2.5 text-sm text-text-secondary">
          <span className={statusDotClass(hostWrapper === null ? 'unknown' : hostWrapper.reachable ? 'up' : 'down')} />
          <span>
            {hostWrapper === null
              ? 'Checking…'
              : hostWrapper.reachable
                ? `Reachable — ${configuredCount} provider(s) configured`
                : `Unreachable (${hostWrapper.error || 'unknown error'}) — cloud mode won't work until this is running`}
          </span>
        </div>
        <p className="text-text-faint text-xs mt-2">
          Cloud mode only works while this is reachable. It runs as its own service (host-wrapper) — if it's down, start it or check{' '}
          <code className="bg-input-2 text-text-secondary px-1.5 py-0.5 rounded text-[11px]">docker compose ps host-wrapper</code>.
        </p>
      </Card>

      <Card title="Cloud provider keys">
        <p className="text-xs text-text-muted mb-3.5 -mt-2">Keys are encrypted at rest. Only used when mode is set to Cloud — leave any you don't have blank, the gateway skips providers with no key.</p>
        <div>
          {KNOWN_PROVIDERS.map((name) => {
            const configured = !!providers[name];
            const busy = !!providerBusy[name];
            return (
              <div key={name} className="flex items-center gap-2.5 py-2.5 border-b border-hairline last:border-b-0">
                <span className="w-28 flex-shrink-0 font-semibold text-[13px] text-text-primary capitalize">{PROVIDER_LABELS[name] || name}</span>
                <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-pill w-24 text-center flex-shrink-0 ${configured ? 'text-good bg-good/[.14]' : 'text-text-faint bg-white/[.06]'}`}>
                  {configured ? 'Configured' : 'Not set'}
                </span>
                <input
                  type="password"
                  placeholder={configured ? 'Enter a new key to replace it' : 'Paste API key'}
                  value={providerInputs[name] || ''}
                  onChange={(e) => setProviderInputs((s) => ({ ...s, [name]: e.target.value }))}
                  disabled={busy}
                  className="flex-1 bg-input border border-white/10 rounded-input px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60"
                />
                <button
                  type="button"
                  onClick={() => handleSaveProviderKey(name)}
                  disabled={busy}
                  className={`${primaryButtonClasses} flex-shrink-0`}
                >
                  Save
                </button>
                {configured && (
                  <button
                    type="button"
                    onClick={() => handleRemoveProviderKey(name)}
                    disabled={busy}
                    className={`${dangerButtonClasses} flex-shrink-0`}
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <h2 className="font-display font-bold text-[19px] text-text-primary mt-9 mb-1 pt-4 border-t border-hairline">Backup</h2>
      <p className="text-text-muted text-[13px] mb-4">Nightly copy of your data (database + media) to Google Drive.</p>

      <Card title="Google Drive connection">
        <div className="flex items-center gap-2.5 text-sm text-text-secondary">
          <span className={statusDotClass(backup === null ? 'unknown' : backup.connected ? 'up' : 'down')} />
          <span>
            {backupError
              ? `Could not check: ${backupError}`
              : backup === null
                ? 'Checking…'
                : !backup.clientConfigured
                  ? "Not available — Google OAuth client isn't configured on the server (GOOGLE_OAUTH_CLIENT_ID/SECRET)"
                  : !backup.connected
                    ? 'Not connected — nothing is being backed up'
                    : `Connected${backup.accountEmail ? ' as ' + backup.accountEmail : ''}${
                        backup.quota ? ` — ${formatBytes(backup.quota.usage)} / ${backup.quota.limit ? formatBytes(backup.quota.limit) : 'unlimited'} used` : ''
                      }`}
          </span>
        </div>
        {backup && backup.clientConfigured && (
          <div className="flex gap-2.5 mt-3.5">
            {backup.connected ? (
              <button type="button" onClick={() => setConfirmDisconnectOpen(true)} className={ghostButtonClasses}>
                Disconnect
              </button>
            ) : (
              <a href={`/backup/oauth/url`} className={`${primaryButtonClasses} inline-block no-underline`}>
                Connect Google Drive
              </a>
            )}
          </div>
        )}
      </Card>

      {backup?.clientConfigured && backup.connected && (
        <>
          <Card title="Backup schedule">
            <label className="flex items-center gap-2.5 cursor-pointer text-sm text-text-secondary">
              <input type="checkbox" checked={backup.enabled} onChange={handleToggleBackupEnabled} className="w-4 h-4 accent-accent" />
              <span>Nightly automatic backup</span>
            </label>
            {backupRunStatus.text && (
              <div className={`mt-3 text-sm ${statusTextClass(backupRunStatus.variant)}`}>
                {backupRunStatus.text}
              </div>
            )}
            <div className="mt-3.5">
              <button type="button" onClick={handleRunBackup} disabled={!!backup.running} className={primaryButtonClasses}>Back up now</button>
            </div>
            <p className="text-text-faint text-xs mt-2">
              {backup.running
                ? `Running (${backup.phase})…`
                : backup.lastRunAt
                  ? `Last run: ${new Date(backup.lastRunAt).toLocaleString()} — ${backup.lastResult || 'unknown result'}`
                  : 'No backup has run yet.'}
            </p>
          </Card>

          <Card title="Restore from backup">
            <p className="text-text-muted text-xs mb-3 -mt-2">
              Restores the database (and media) from the most recent Drive backup. <strong className="text-text-secondary">This overwrites current data</strong> — only needed after data loss, not routine use.
            </p>
            {restoreStatus.text && (
              <div className={`mb-3 text-sm ${statusTextClass(restoreStatus.variant)}`}>
                {restoreStatus.text}
              </div>
            )}
            {backup.db && !backup.db.exists && (
              <div className="mb-3 text-xs text-text-faint">No backup found in Drive yet — run one first.</div>
            )}
            <button
              type="button"
              onClick={() => setConfirmRestoreOpen(true)}
              disabled={restoring || !!backup.running || !backup.db?.exists}
              className={dangerButtonClasses}
            >
              Restore from latest backup
            </button>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={confirmDisconnectOpen}
        title="Disconnect Google Drive?"
        message="Nightly backups will stop until reconnected."
        confirmLabel="Disconnect"
        danger
        onConfirm={handleDisconnectDrive}
        onCancel={() => setConfirmDisconnectOpen(false)}
      />
      <ConfirmDialog
        open={confirmRestoreOpen}
        title="Restore from latest backup?"
        message="This overwrites the current database (and media) with the latest Drive backup. This cannot be undone."
        confirmLabel="Restore"
        danger
        onConfirm={handleRestore}
        onCancel={() => setConfirmRestoreOpen(false)}
      />
    </div>
  );
};

export default SettingsPage;
