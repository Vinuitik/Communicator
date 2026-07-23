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
