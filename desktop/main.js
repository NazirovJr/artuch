// Artuch Staff — Electron main process.
//
// Wraps the Expo web export (`web-build/`) in a desktop window. The bundle uses
// absolute asset paths (`/_expo/...`), so file:// won't resolve them — instead
// we serve `web-build/` over a loopback HTTP server and point the window at it.
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');

const WEB_ROOT = path.join(__dirname, 'web-build');
let server = null;

function startServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) =>
      handler(req, res, {
        public: WEB_ROOT,
        // SPA: unknown client routes fall back to the app shell.
        rewrites: [{ source: '**', destination: '/index.html' }],
      }),
    );
    server.on('error', reject);
    // Port 0 → OS picks a free port; loopback only (not exposed on the network).
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

async function createWindow() {
  const port = await startServer();

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#F4EEE2',
    title: 'Artuch Staff',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // External links open in the system browser, not inside the app shell.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1')) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadURL(`http://127.0.0.1:${port}`);
}

app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') app.quit();
});
