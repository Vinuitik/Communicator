import React, { useCallback, useEffect, useState } from 'react';
import {
  getLlmSettings, setLlmMode, saveProviderKey, removeProviderKey, checkHostWrapperStatus,
  getBackupStatus, disconnectDrive, setBackupEnabled, runBackup, restoreBackup,
} from '../../../services/api/settingsService';
import { BackupStatus, HostWrapperStatus, KNOWN_PROVIDERS } from '../../../types/api';
import Button from '../../atoms/Button';

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
    state === 'up' ? 'bg-green-600' : state === 'down' ? 'bg-red-600' : 'bg-gray-300'
  }`;

const formatBytes = (n?: number): string => {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let value = n;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value.toFixed(1)} ${units[i]}`;
};

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section className="bg-white rounded-xl shadow-sm p-6 mb-5">{children}</section>
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
      window.alert(`Could not save key: ${err instanceof Error ? err.message : err}`);
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
      window.alert(`Could not remove key: ${err instanceof Error ? err.message : err}`);
    } finally {
      setProviderBusy((b) => ({ ...b, [provider]: false }));
    }
  };

  const handleDisconnectDrive = async () => {
    if (!window.confirm('Disconnect Google Drive? Nightly backups will stop until reconnected.')) return;
    try {
      await disconnectDrive();
      await loadBackupStatus();
    } catch (err) {
      window.alert(`Could not disconnect: ${err instanceof Error ? err.message : err}`);
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
      window.alert(`Could not update schedule: ${err instanceof Error ? err.message : err}`);
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
    if (!window.confirm(
      'This overwrites the current database (and media) with the latest Drive backup. This cannot be undone. Are you sure?'
    )) return;
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
    <div className="max-w-3xl mx-auto pb-16">
      <h1 className="text-2xl font-medium text-gray-800 mb-1">Settings</h1>

      <h2 className="text-xl font-medium mt-0 mb-1">AI</h2>
      <p className="text-gray-500 mb-4">Choose whether chat and knowledge summarization run on your own machine or in the cloud.</p>

      <Card>
        <h2 className="text-lg font-medium mb-3">Where the AI runs</h2>
        <div className="flex flex-col gap-3">
          {(['ollama', 'cloud'] as const).map((value) => (
            <label
              key={value}
              className={`flex gap-3 items-start p-3.5 border rounded-lg cursor-pointer transition-colors ${
                mode === value ? 'border-brand bg-brand/5' : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input
                type="radio"
                name="mode"
                value={value}
                checked={mode === value}
                onChange={() => handleModeChange(value)}
                className="mt-1 flex-shrink-0"
              />
              <div>
                <strong className="block mb-1">{value === 'ollama' ? 'Local (Ollama)' : 'Cloud'}</strong>
                <p className="text-sm text-gray-600">
                  {value === 'ollama'
                    ? 'Runs entirely on this machine. Nothing about your friends or conversations leaves the box. Slower, and quality depends on the local model.'
                    : 'Routed through a multi-provider gateway (Gemini, GitHub Models, Mistral, Groq, DeepSeek, Anthropic) with automatic failover. Faster and higher quality, but your messages and friend data are sent to whichever third-party provider handles the request.'}
                </p>
              </div>
            </label>
          ))}
        </div>
        {modeStatus.text && (
          <div className={`mt-3 text-sm ${modeStatus.variant === 'ok' ? 'text-green-700' : modeStatus.variant === 'error' ? 'text-red-600' : 'text-gray-600'}`}>
            {modeStatus.text}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-medium mb-3">Cloud gateway status</h2>
        <div className="flex items-center gap-2.5 text-sm">
          <span className={statusDotClass(hostWrapper === null ? 'unknown' : hostWrapper.reachable ? 'up' : 'down')} />
          <span>
            {hostWrapper === null
              ? 'Checking…'
              : hostWrapper.reachable
                ? `Reachable — ${configuredCount} provider(s) configured`
                : `Unreachable (${hostWrapper.error || 'unknown error'}) — cloud mode won't work until this is running`}
          </span>
        </div>
        <p className="text-gray-500 text-sm mt-2">
          Cloud mode only works while this is reachable. It runs as its own service (host-wrapper) — if it's down, start it or check{' '}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">docker compose ps host-wrapper</code>.
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-medium mb-3">Cloud provider keys</h2>
        <p className="text-gray-500 text-sm mb-3">Keys are encrypted at rest. Only used when mode is set to Cloud — leave any you don't have blank, the gateway skips providers with no key.</p>
        <div>
          {KNOWN_PROVIDERS.map((name) => {
            const configured = !!providers[name];
            const busy = !!providerBusy[name];
            return (
              <div key={name} className="flex items-center gap-2.5 py-2.5 border-b border-gray-100 last:border-b-0">
                <span className="w-28 flex-shrink-0 font-medium capitalize">{PROVIDER_LABELS[name] || name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full w-24 text-center flex-shrink-0 ${configured ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                  {configured ? 'Configured' : 'Not set'}
                </span>
                <input
                  type="password"
                  placeholder={configured ? 'Enter a new key to replace it' : 'Paste API key'}
                  value={providerInputs[name] || ''}
                  onChange={(e) => setProviderInputs((s) => ({ ...s, [name]: e.target.value }))}
                  disabled={busy}
                  className="flex-1 border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
                <button
                  type="button"
                  onClick={() => handleSaveProviderKey(name)}
                  disabled={busy}
                  className="px-3.5 py-1.5 rounded-md text-sm bg-brand text-white hover:bg-brand-dark disabled:opacity-50 flex-shrink-0"
                >
                  Save
                </button>
                {configured && (
                  <button
                    type="button"
                    onClick={() => handleRemoveProviderKey(name)}
                    disabled={busy}
                    className="px-3.5 py-1.5 rounded-md text-sm bg-white text-red-600 border border-red-600 hover:bg-red-50 disabled:opacity-50 flex-shrink-0"
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <h2 className="text-xl font-medium mt-9 mb-1 pt-3 border-t border-gray-200">Backup</h2>
      <p className="text-gray-500 mb-4">Nightly copy of your data (database + media) to Google Drive.</p>

      <Card>
        <h2 className="text-lg font-medium mb-3">Google Drive connection</h2>
        <div className="flex items-center gap-2.5 text-sm">
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
              <button type="button" onClick={handleDisconnectDrive} className="px-4 py-2 rounded-md text-sm bg-white text-gray-700 border border-gray-300 hover:bg-gray-50">
                Disconnect
              </button>
            ) : (
              <a href={`/backup/oauth/url`} className="inline-block px-4 py-2 rounded-md text-sm bg-brand text-white hover:bg-brand-dark no-underline">
                Connect Google Drive
              </a>
            )}
          </div>
        )}
      </Card>

      {backup?.clientConfigured && backup.connected && (
        <>
          <Card>
            <h2 className="text-lg font-medium mb-3">Backup schedule</h2>
            <label className="flex items-center gap-2.5 cursor-pointer text-sm">
              <input type="checkbox" checked={backup.enabled} onChange={handleToggleBackupEnabled} className="w-4.5 h-4.5" />
              <span>Nightly automatic backup</span>
            </label>
            {backupRunStatus.text && (
              <div className={`mt-3 text-sm ${backupRunStatus.variant === 'ok' ? 'text-green-700' : backupRunStatus.variant === 'error' ? 'text-red-600' : 'text-gray-600'}`}>
                {backupRunStatus.text}
              </div>
            )}
            <div className="mt-3.5">
              <Button onClick={handleRunBackup} disabled={!!backup.running}>Back up now</Button>
            </div>
            <p className="text-gray-500 text-sm mt-2">
              {backup.running
                ? `Running (${backup.phase})…`
                : backup.lastRunAt
                  ? `Last run: ${new Date(backup.lastRunAt).toLocaleString()} — ${backup.lastResult || 'unknown result'}`
                  : 'No backup has run yet.'}
            </p>
          </Card>

          <Card>
            <h2 className="text-lg font-medium mb-3">Restore from backup</h2>
            <p className="text-gray-500 text-sm mb-3">
              Restores the database (and media) from the most recent Drive backup. <strong>This overwrites current data</strong> — only needed after data loss, not routine use.
            </p>
            {restoreStatus.text && (
              <div className={`mb-3 text-sm ${restoreStatus.variant === 'ok' ? 'text-green-700' : restoreStatus.variant === 'error' ? 'text-red-600' : 'text-gray-600'}`}>
                {restoreStatus.text}
              </div>
            )}
            {backup.db && !backup.db.exists && (
              <div className="mb-3 text-sm text-gray-600">No backup found in Drive yet — run one first.</div>
            )}
            <button
              type="button"
              onClick={handleRestore}
              disabled={restoring || !!backup.running || !backup.db?.exists}
              className="px-4 py-2 rounded-md text-sm bg-white text-red-600 border border-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Restore from latest backup
            </button>
          </Card>
        </>
      )}
    </div>
  );
};

export default SettingsPage;
