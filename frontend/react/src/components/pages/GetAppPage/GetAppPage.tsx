import React, { useEffect, useState } from 'react';
import { onInstallChange, promptInstall, isIOS, isFirefox, isMobile, InstallState } from '../../../pwa/installPrompt';
import { onUpdateAvailable, checkForUpdate, applyUpdate } from '../../../pwa/registerSW';

// Desktop installer for the browser extension. Absolute paths, not routed through
// react-router — nginx serves them straight off disk (see nginx/nginx.conf's
// /downloads/ and /ext/ locations).
// Chrome/Edge/Brave: unsigned zip, loaded via "Load unpacked" (extension/package.sh).
const EXTENSION_ZIP = '/downloads/communicator-extension.zip';
// Firefox: signed .xpi, installs directly on click — no dev-mode dance (Mozilla
// requires signing for a persistent install; see extension/deploy-extension.sh).
// "latest" is a stable alias so this link survives every version bump.
const EXTENSION_XPI = '/ext/communicator-extension-latest.xpi';

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
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => onInstallChange(setInstall), []);
  useEffect(() => onUpdateAvailable(() => setUpdateAvailable(true)), []);

  async function install() {
    const outcome = await promptInstall();
    setMsg(outcome === 'accepted' ? 'Installing… check your taskbar / home screen.' : '');
  }

  async function handleCheckForUpdate() {
    setChecking(true);
    await checkForUpdate();
    // Downloading + installing (registerSW.ts's 'installed' statechange, which
    // flips updateAvailable) happens asynchronously after this resolves — give it
    // a beat before re-enabling the button. This only downloads; the update still
    // waits for an explicit applyUpdate() click, same as if it were caught passively.
    setTimeout(() => setChecking(false), 1500);
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
          ) : isIOS() ? (
            <p className="text-text-faint text-xs">
              On <strong className="text-text-secondary">iPhone/iPad</strong>, open this page in{' '}
              <strong className="text-text-secondary">Safari</strong>, tap the{' '}
              <strong className="text-text-secondary">Share</strong> icon (square with an arrow),
              then <strong className="text-text-secondary">Add to Home Screen</strong>. iOS doesn't
              support installing from Chrome or any other browser — it must be Safari.
            </p>
          ) : (
            <p className="text-text-faint text-xs">
              In <strong className="text-text-secondary">Chrome or Edge</strong>, use the install
              icon in the address bar (a monitor with a ↓), or the ⋮ menu → "Install this site as
              an app". On <strong className="text-text-secondary">Android</strong>, use the ⋮ menu
              → "Install app" / "Add to Home screen". <strong className="text-text-secondary">
              Firefox and Safari</strong> desktop don't support installing web apps.
            </p>
          )}
          {msg && <p className="text-accent-light text-xs mt-2">{msg}</p>}
        </Card>

        {!isMobile() && (
          <Card badge={isFirefox() ? 'Firefox' : 'Chrome / Edge / Brave'} title="Browser extension">
            <p className="text-text-muted text-sm mb-3">
              Right-click any selected text, link, or image while browsing and add it straight to a
              friend's profile — no copy-paste, no tab-switching.
            </p>
            {isFirefox() ? (
              <>
                <a className={primaryButtonClasses} href={EXTENSION_XPI}>Install extension</a>
                <p className="text-text-faint text-xs mt-2">
                  Signed and installs directly — Firefox will show its own "Add extension?" prompt,
                  no unzipping or developer mode needed. Updates automatically after that.
                </p>
              </>
            ) : (
              <>
                <a className={primaryButtonClasses} href={EXTENSION_ZIP} download>Download extension</a>
                <p className="text-text-faint text-xs mt-2">
                  Unpacked, not on the Chrome Web Store. After unzipping: go to{' '}
                  <code className="text-accent-light">chrome://extensions</code>, enable{' '}
                  <strong className="text-text-secondary">Developer mode</strong>, then{' '}
                  <strong className="text-text-secondary">Load unpacked</strong> and pick the
                  unzipped folder. On <strong className="text-text-secondary">Firefox</strong>,
                  reopen this page in Firefox for a direct, signed install instead.
                </p>
              </>
            )}
          </Card>
        )}

        <Card badge="Installed app" title="Keep it updated">
          <p className="text-text-muted text-sm mb-3">
            New versions download in the background but never apply themselves — you're always
            in control of when the app actually switches over. A pulsing refresh icon appears in
            the nav once one's ready to install; click it (or the button below) whenever suits you.
          </p>
          {updateAvailable ? (
            <button className={primaryButtonClasses} onClick={applyUpdate}>Refresh to update</button>
          ) : (
            <button
              className="inline-block px-4 py-2 rounded-input text-sm font-bold bg-input border border-white/10 text-text-secondary hover:text-text-emphasis disabled:opacity-50 transition-colors"
              onClick={handleCheckForUpdate}
              disabled={checking}
            >
              {checking ? 'Checking…' : 'Check for updates'}
            </button>
          )}
        </Card>
      </div>
    </div>
  );
};

export default GetAppPage;
