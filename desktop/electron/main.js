// Thin Electron shell for Communicator.
//
// This process does NOT bundle or serve any local copy of the React app.
// It opens exactly one BrowserWindow pointed at the live production URL,
// so every launch always gets whatever is currently deployed. There is no
// "update available" flow here (unlike the PWA's registerSW.ts) because
// there's nothing cached to be stale — see FLOWS.md.

const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

const PROD_URL = 'https://communicator.work/app/';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: 'Communicator',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Any attempt to open a new window/tab: same-origin navigations should
  // just happen in the existing window (deny the popup, let will-navigate
  // handle it if needed); cross-origin links should open in the user's
  // default browser instead of spawning a new Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    let target;
    try {
      target = new URL(url);
    } catch {
      return { action: 'deny' };
    }

    if (target.hostname === 'communicator.work') {
      // Same-origin popup request — deny creating a second window. Note:
      // the Drive OAuth flow is a same-tab <a href> navigation, not a
      // popup, so it never reaches this handler at all.
      return { action: 'deny' };
    }

    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Belt-and-suspenders for in-page navigations (e.g. a target="_blank"
  // link that Electron routes through will-navigate instead of
  // window.open): only block navigating the main window itself away to a
  // different origin; same-origin navigation (including the OAuth
  // redirect flow) must pass through untouched.
  win.webContents.on('will-navigate', (event, url) => {
    let target;
    try {
      target = new URL(url);
    } catch {
      return;
    }
    if (target.hostname !== 'communicator.work') {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.loadURL(PROD_URL);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
