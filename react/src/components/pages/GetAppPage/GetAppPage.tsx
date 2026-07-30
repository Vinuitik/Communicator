import React, { useEffect, useState } from 'react';
import { onInstallChange, promptInstall, InstallState } from '../../../pwa/installPrompt';

// Desktop installer for the browser extension. Absolute path, not routed through
// react-router — nginx serves it straight off disk (see nginx/nginx.conf's
// /downloads/ location + extension/package.sh, which builds this zip).
const EXTENSION_ZIP = '/downloads/communicator-extension.zip';

const primaryButtonClasses =
  'inline-block px-4 py-2 rounded-input text-sm font-bold bg-accent-gradient text-white shadow-button-sm hover:brightness-110 disabled:opacity-50 transition-all';

const Card: React.FC<{ badge: string; title: string; children: React.ReactNode }> = ({ badge, title, children }) => (
  <section className="bg-surface border border-hairline rounded-card p-5 flex-1 min-w-[260px]">
    <span className="inline-block text-xs font-bold text-accent-light bg-accent/16 rounded-full px-2.5 py-1 mb-3">
      {badge}
    </span>
    <h2 className="text-[15px] font-bold text-text-primary m-0 mb-2">{title}</h2>
    {children}
  </section>
);

const GetAppPage: React.FC = () => {
  const [{ canInstall, installed }, setInstall] = useState<InstallState>({ canInstall: false, installed: false });
  const [msg, setMsg] = useState('');

  useEffect(() => onInstallChange(setInstall), []);

  async function install() {
    const outcome = await promptInstall();
    setMsg(outcome === 'accepted' ? 'Installing… check your taskbar / home screen.' : '');
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-text-primary m-0 mb-2">Get the app</h1>
      <p className="text-text-secondary text-sm mb-6">
        Install Communicator as its own app, and add the browser extension for quick-capturing
        things you find while browsing.
      </p>

      <div className="flex gap-4 flex-wrap mb-6">
        <Card badge="Any device" title="Install as app">
          <p className="text-text-muted text-sm mb-3">
            Adds Communicator to your home screen / taskbar as a standalone app — its own window,
            no browser chrome.
          </p>
          {installed ? (
            <div className="text-good text-sm font-semibold">✓ Already installed on this device</div>
          ) : canInstall ? (
            <button className={primaryButtonClasses} onClick={install}>Install app</button>
          ) : (
            <p className="text-text-faint text-xs">
              In <strong className="text-text-secondary">Chrome or Edge</strong>, use the install
              icon in the address bar (a monitor with a ↓), or the ⋮ menu → "Install this site as
              an app". <strong className="text-text-secondary">Firefox and Safari</strong> desktop
              don't support installing web apps.
            </p>
          )}
          {msg && <p className="text-accent-light text-xs mt-2">{msg}</p>}
        </Card>

        <Card badge="Chrome / Edge / Brave" title="Browser extension">
          <p className="text-text-muted text-sm mb-3">
            Right-click any selected text, link, or image while browsing and add it straight to a
            friend's profile — no copy-paste, no tab-switching.
          </p>
          <a className={primaryButtonClasses} href={EXTENSION_ZIP} download>Download extension</a>
          <p className="text-text-faint text-xs mt-2">
            Unpacked, not on the Chrome Web Store. After unzipping: go to{' '}
            <code className="text-accent-light">chrome://extensions</code>, enable{' '}
            <strong className="text-text-secondary">Developer mode</strong>, then{' '}
            <strong className="text-text-secondary">Load unpacked</strong> and pick the unzipped
            folder.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default GetAppPage;
