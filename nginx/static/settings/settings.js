const API_BASE = '/api/ai/settings/llm';
const PROVIDER_LABELS = {
    gemini: 'Gemini',
    github: 'GitHub Models',
    mistral: 'Mistral',
    groq: 'Groq',
    deepseek: 'DeepSeek',
    anthropic: 'Anthropic',
};

const modeRadios = document.querySelectorAll('input[name="mode"]');
const modeSaveStatus = document.getElementById('mode-save-status');
const hostWrapperDot = document.getElementById('host-wrapper-dot');
const hostWrapperText = document.getElementById('host-wrapper-text');
const providerList = document.getElementById('provider-list');

async function loadSettings() {
    try {
        const res = await fetch(API_BASE);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        modeRadios.forEach((radio) => {
            radio.checked = radio.value === data.mode;
        });

        renderProviders(data.providers);
    } catch (err) {
        modeSaveStatus.textContent = `Could not load settings: ${err.message}`;
        modeSaveStatus.className = 'save-status error';
    }
}

function renderProviders(providers) {
    providerList.innerHTML = '';
    for (const [name, configured] of Object.entries(providers)) {
        const row = document.createElement('div');
        row.className = 'provider-row';
        row.innerHTML = `
            <span class="provider-name">${PROVIDER_LABELS[name] || name}</span>
            <span class="provider-badge ${configured ? 'configured' : 'not-configured'}">
                ${configured ? 'Configured' : 'Not set'}
            </span>
            <input type="password" placeholder="${configured ? 'Enter a new key to replace it' : 'Paste API key'}" />
            <button class="save-btn">Save</button>
            <button class="remove-btn" ${configured ? '' : 'disabled'}>Remove</button>
        `;

        const input = row.querySelector('input');
        const saveBtn = row.querySelector('.save-btn');
        const removeBtn = row.querySelector('.remove-btn');

        saveBtn.addEventListener('click', () => saveProviderKey(name, input, row));
        removeBtn.addEventListener('click', () => removeProviderKey(name, row));

        providerList.appendChild(row);
    }
}

async function saveProviderKey(provider, input, row) {
    const apiKey = input.value.trim();
    if (!apiKey) return;

    try {
        const res = await fetch(`${API_BASE}/providers/${provider}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: apiKey }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.detail || `HTTP ${res.status}`);
        }
        input.value = '';
        await loadSettings();
    } catch (err) {
        alert(`Could not save key: ${err.message}`);
    }
}

async function removeProviderKey(provider, row) {
    try {
        const res = await fetch(`${API_BASE}/providers/${provider}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await loadSettings();
    } catch (err) {
        alert(`Could not remove key: ${err.message}`);
    }
}

async function setMode(mode) {
    modeSaveStatus.textContent = 'Saving…';
    modeSaveStatus.className = 'save-status';
    try {
        const res = await fetch(`${API_BASE}/mode`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        modeSaveStatus.textContent = `Mode set to ${mode}.`;
        modeSaveStatus.className = 'save-status ok';
    } catch (err) {
        modeSaveStatus.textContent = `Could not switch mode: ${err.message}`;
        modeSaveStatus.className = 'save-status error';
    }
}

async function checkHostWrapperStatus() {
    try {
        const res = await fetch(`${API_BASE}/host-wrapper-status`);
        const data = await res.json();
        if (data.reachable) {
            hostWrapperDot.className = 'status-dot status-up';
            const configuredCount = Object.values(data.providers || {})
                .filter((p) => p.configured).length;
            hostWrapperText.textContent = `Reachable — ${configuredCount} provider(s) configured`;
        } else {
            hostWrapperDot.className = 'status-dot status-down';
            hostWrapperText.textContent = `Unreachable (${data.error || 'unknown error'}) — cloud mode won't work until this is running`;
        }
    } catch (err) {
        hostWrapperDot.className = 'status-dot status-down';
        hostWrapperText.textContent = `Could not check: ${err.message}`;
    }
}

modeRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
        if (radio.checked) setMode(radio.value);
    });
});

loadSettings();
checkHostWrapperStatus();

// ── Backup (Google Drive) ──────────────────────────────────────────────────

const BACKUP_BASE = '/backup';
const driveDot = document.getElementById('drive-dot');
const driveText = document.getElementById('drive-text');
const driveActions = document.getElementById('drive-actions');
const backupControlsCard = document.getElementById('backup-controls-card');
const restoreCard = document.getElementById('restore-card');
const backupEnabledToggle = document.getElementById('backup-enabled-toggle');
const runBackupBtn = document.getElementById('run-backup-btn');
const backupRunStatus = document.getElementById('backup-run-status');
const lastRunHint = document.getElementById('last-run-hint');
const restoreBtn = document.getElementById('restore-btn');
const restoreStatus = document.getElementById('restore-status');

async function loadBackupStatus() {
    try {
        const res = await fetch(`${BACKUP_BASE}/status`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        renderBackupStatus(data);
    } catch (err) {
        driveDot.className = 'status-dot status-down';
        driveText.textContent = `Could not check: ${err.message}`;
    }
}

function renderBackupStatus(data) {
    driveActions.innerHTML = '';

    if (!data.clientConfigured) {
        driveDot.className = 'status-dot status-down';
        driveText.textContent = 'Not available — Google OAuth client isn\'t configured on the server (GOOGLE_OAUTH_CLIENT_ID/SECRET)';
        backupControlsCard.style.display = 'none';
        restoreCard.style.display = 'none';
        return;
    }

    if (!data.connected) {
        driveDot.className = 'status-dot status-down';
        driveText.textContent = 'Not connected — nothing is being backed up';
        const connectBtn = document.createElement('a');
        connectBtn.href = `${BACKUP_BASE}/oauth/url`;
        connectBtn.className = 'btn-primary';
        connectBtn.textContent = 'Connect Google Drive';
        connectBtn.style.textDecoration = 'none';
        connectBtn.style.display = 'inline-block';
        driveActions.appendChild(connectBtn);
        backupControlsCard.style.display = 'none';
        restoreCard.style.display = 'none';
        return;
    }

    driveDot.className = 'status-dot status-up';
    driveText.textContent = `Connected${data.accountEmail ? ' as ' + data.accountEmail : ''}`;
    if (data.quota) {
        const used = formatBytes(data.quota.usage);
        const total = data.quota.limit ? formatBytes(data.quota.limit) : 'unlimited';
        driveText.textContent += ` — ${used} / ${total} used`;
    }

    const disconnectBtn = document.createElement('button');
    disconnectBtn.className = 'btn-secondary';
    disconnectBtn.textContent = 'Disconnect';
    disconnectBtn.addEventListener('click', disconnectDrive);
    driveActions.appendChild(disconnectBtn);

    backupControlsCard.style.display = '';
    restoreCard.style.display = '';

    backupEnabledToggle.checked = !!data.enabled;

    const parts = [];
    if (data.running) parts.push(`Running (${data.phase})…`);
    else if (data.lastRunAt) parts.push(`Last run: ${new Date(data.lastRunAt).toLocaleString()} — ${data.lastResult || 'unknown result'}`);
    else parts.push('No backup has run yet.');
    lastRunHint.textContent = parts.join(' ');

    runBackupBtn.disabled = !!data.running;
    restoreBtn.disabled = !!data.running || !(data.db && data.db.exists);
    if (data.db && !data.db.exists) {
        restoreStatus.textContent = 'No backup found in Drive yet — run one first.';
        restoreStatus.className = 'save-status';
    }
}

function formatBytes(n) {
    n = Number(n);
    if (!n) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(1)} ${units[i]}`;
}

async function disconnectDrive() {
    if (!confirm('Disconnect Google Drive? Nightly backups will stop until reconnected.')) return;
    try {
        const res = await fetch(`${BACKUP_BASE}/disconnect`, { method: 'POST' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await loadBackupStatus();
    } catch (err) {
        alert(`Could not disconnect: ${err.message}`);
    }
}

backupEnabledToggle.addEventListener('change', async () => {
    const value = backupEnabledToggle.checked;
    try {
        const res = await fetch(`${BACKUP_BASE}/enabled?value=${value}`, { method: 'POST' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
        backupEnabledToggle.checked = !value;
        alert(`Could not update schedule: ${err.message}`);
    }
});

runBackupBtn.addEventListener('click', async () => {
    backupRunStatus.textContent = 'Starting…';
    backupRunStatus.className = 'save-status';
    try {
        const res = await fetch(`${BACKUP_BASE}/run`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) {
            backupRunStatus.textContent = 'A backup is already running.';
        } else if (!res.ok) {
            throw new Error(data.reason || `HTTP ${res.status}`);
        } else {
            backupRunStatus.textContent = 'Backup started.';
            backupRunStatus.className = 'save-status ok';
        }
        setTimeout(loadBackupStatus, 2000);
    } catch (err) {
        backupRunStatus.textContent = `Could not start backup: ${err.message}`;
        backupRunStatus.className = 'save-status error';
    }
});

restoreBtn.addEventListener('click', async () => {
    if (!confirm(
        'This overwrites the current database (and media) with the latest Drive backup. ' +
        'This cannot be undone. Are you sure?'
    )) return;

    restoreStatus.textContent = 'Restoring…';
    restoreStatus.className = 'save-status';
    try {
        const res = await fetch(`${BACKUP_BASE}/restore?force=true`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) {
            restoreStatus.textContent = 'A backup/restore is already running.';
        } else if (!res.ok) {
            throw new Error(data.reason || `HTTP ${res.status}`);
        } else {
            restoreStatus.textContent = 'Restore started — a restart of the app services is recommended once it finishes.';
            restoreStatus.className = 'save-status ok';
        }
        setTimeout(loadBackupStatus, 2000);
    } catch (err) {
        restoreStatus.textContent = `Could not start restore: ${err.message}`;
        restoreStatus.className = 'save-status error';
    }
});

loadBackupStatus();
