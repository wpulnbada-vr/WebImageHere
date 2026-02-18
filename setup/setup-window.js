const { BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * Creates the setup wizard window and returns a Promise
 * that resolves when setup is complete.
 */
function createSetupWindow({ userDataDir, defaultDownloadsDir, chromeCacheDir, findChrome }) {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 700,
      height: 520,
      resizable: false,
      maximizable: false,
      fullscreenable: false,
      frame: false,
      transparent: false,
      show: false,
      icon: path.join(__dirname, '..', 'build', 'icon.png'),
      webPreferences: {
        preload: path.join(__dirname, 'setup-preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    win.setMenuBarVisibility(false);

    // State
    let chosenDownloadsDir = defaultDownloadsDir;
    let chromeFound = false;
    let chromePath = null;

    // Check if Chrome already exists
    try {
      const existing = findChrome(chromeCacheDir);
      if (existing) {
        chromeFound = true;
        chromePath = existing;
      }
    } catch {}

    // ── IPC Handlers ──────────────────────────────────────────────────────────

    const handlers = {
      'setup:get-defaults': async () => {
        return {
          downloadsDir: defaultDownloadsDir,
          chromeFound,
          platform: process.platform,
        };
      },

      'setup:pick-directory': async () => {
        const result = await dialog.showOpenDialog(win, {
          title: 'Choose Downloads Directory',
          defaultPath: chosenDownloadsDir,
          properties: ['openDirectory', 'createDirectory'],
        });
        if (!result.canceled && result.filePaths.length > 0) {
          chosenDownloadsDir = result.filePaths[0];
          return chosenDownloadsDir;
        }
        return null;
      },

      'setup:set-password': async (_event, password) => {
        const Auth = require('../server/auth');
        Auth.init(userDataDir);
        await Auth.createAdmin(password);
        return true;
      },

      'setup:set-discord': async (_event, webhookUrl) => {
        const Monitor = require('../server/monitor');
        Monitor.init(userDataDir, chosenDownloadsDir);
        const config = Monitor.loadConfig();
        config.discord.webhookUrl = webhookUrl;
        config.discord.enabled = true;
        Monitor.saveConfig(config);
        return true;
      },

      'setup:download-chrome': async () => {
        if (chromeFound && chromePath) {
          return { success: true, path: chromePath, skipped: true };
        }

        try {
          const { install, Browser, detectBrowserPlatform, resolveBuildId } = require('@puppeteer/browsers');
          const platform = detectBrowserPlatform();
          const buildId = await resolveBuildId(Browser.CHROME, platform, 'stable');

          const result = await install({
            browser: Browser.CHROME,
            buildId,
            cacheDir: chromeCacheDir,
            downloadProgressCallback: (downloadedBytes, totalBytes) => {
              if (win && !win.isDestroyed()) {
                win.webContents.send('setup:chrome-progress', {
                  downloadedBytes,
                  totalBytes,
                  percent: totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0,
                });
              }
            },
          });

          chromePath = result.executablePath;
          chromeFound = true;
          return { success: true, path: result.executablePath };
        } catch (err) {
          // Try system Chrome as fallback
          try {
            const fallback = findChrome();
            if (fallback) {
              chromePath = fallback;
              chromeFound = true;
              return { success: true, path: fallback, fallback: true };
            }
          } catch {}
          return { success: false, error: err.message };
        }
      },

      'setup:complete': async (_event, config) => {
        const SetupConfig = require('./setup-config');
        SetupConfig.init(userDataDir);
        SetupConfig.saveConfig({
          downloadsDir: chosenDownloadsDir,
          chromeDownloaded: chromeFound,
          discordEnabled: config?.discordEnabled || false,
          ...config,
        });

        // Cleanup handlers
        for (const channel of Object.keys(handlers)) {
          ipcMain.removeHandler(channel);
        }

        win.close();
        resolve({
          downloadsDir: chosenDownloadsDir,
          chromePath,
        });
      },
    };

    // Register all handlers
    for (const [channel, handler] of Object.entries(handlers)) {
      ipcMain.handle(channel, handler);
    }

    // Load the setup UI
    const setupHtml = path.join(__dirname, '..', 'public-setup', 'index.html');
    win.loadFile(setupHtml);

    win.once('ready-to-show', () => {
      win.show();
    });

    // If user closes the window without completing setup, quit
    win.on('closed', () => {
      for (const channel of Object.keys(handlers)) {
        try { ipcMain.removeHandler(channel); } catch {}
      }
      // If not resolved yet (user closed without completing), resolve with null
      resolve(null);
    });
  });
}

module.exports = { createSetupWindow };
