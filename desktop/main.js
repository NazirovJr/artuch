// Artuch Staff — Electron main process.
//
// Wraps the Expo web export (`web-build/`) in a desktop window. The bundle uses
// absolute asset paths (`/_expo/...`), so file:// won't resolve them — instead
// we serve `web-build/` over a loopback HTTP server and point the window at it.
const { app, BrowserWindow, shell, session } = require('electron');
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
    icon: path.join(__dirname, 'build', 'icon.png'),
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

// The renderer loads from http://127.0.0.1:<random-port> — an origin the
// backend's CORS allowlist doesn't include, so login/API responses get
// blocked by Chromium ("fetch error"). Instead of disabling webSecurity,
// inject permissive CORS headers onto responses. Safe here: the client
// authenticates via Bearer tokens (no cookies / credentials:'include'),
// so a wildcard origin is acceptable.
function enableCorsHeaderInjection() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = {};
    for (const [key, value] of Object.entries(details.responseHeaders || {})) {
      // Drop any existing CORS headers (case-insensitive) to avoid duplicates.
      if (!/^access-control-allow-(origin|methods|headers)$/i.test(key)) {
        responseHeaders[key] = value;
      }
    }
    responseHeaders['Access-Control-Allow-Origin'] = ['*'];
    responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, PUT, PATCH, DELETE, OPTIONS'];
    responseHeaders['Access-Control-Allow-Headers'] = ['Content-Type, Authorization, X-Requested-With'];
    callback({ responseHeaders });
  });
}

app.whenReady().then(() => {
  enableCorsHeaderInjection();
  createWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') app.quit();
});
