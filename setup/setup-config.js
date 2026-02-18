const fs = require('fs');
const path = require('path');

let CONFIG_FILE;

function init(userDataDir) {
  CONFIG_FILE = path.join(userDataDir, 'setup-config.json');
}

function isSetupComplete() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return config.setupComplete === true;
    }
  } catch {}
  return false;
}

function getConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch {}
  return null;
}

function saveConfig(data) {
  const existing = getConfig() || {};
  const merged = { ...existing, ...data, setupComplete: true, setupDate: new Date().toISOString() };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
  return merged;
}

function getDownloadsDir(defaultDir) {
  const config = getConfig();
  return config?.downloadsDir || defaultDir;
}

module.exports = { init, isSetupComplete, getConfig, saveConfig, getDownloadsDir };
