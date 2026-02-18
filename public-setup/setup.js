// ── Setup Wizard Logic ────────────────────────────────────────────────────────

const TOTAL_STEPS = 6;
let currentStep = 0;
let defaults = {};
let chromeReady = false;
let passwordSet = false;
let discordConfigured = false;
let downloadsDir = '';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const stepsIndicator = document.getElementById('steps-indicator');
const btnNext = document.getElementById('btn-next');
const btnBack = document.getElementById('btn-back');
const btnClose = document.getElementById('btn-close');

// ── Initialize ────────────────────────────────────────────────────────────────
async function init() {
  // Build step dots
  for (let i = 0; i < TOTAL_STEPS; i++) {
    const dot = document.createElement('div');
    dot.className = 'step-dot' + (i === 0 ? ' active' : '');
    dot.dataset.step = i;
    stepsIndicator.appendChild(dot);
  }

  // Load defaults
  try {
    defaults = await window.setupAPI.getDefaults();
    downloadsDir = defaults.downloadsDir || '';
    document.getElementById('downloads-dir').value = downloadsDir;

    if (defaults.chromeFound) {
      chromeReady = true;
    }
  } catch (err) {
    console.error('Failed to load defaults:', err);
  }

  // Event listeners
  btnNext.addEventListener('click', nextStep);
  btnBack.addEventListener('click', prevStep);
  btnClose.addEventListener('click', () => window.close());

  // Directory picker
  document.getElementById('btn-pick-dir').addEventListener('click', async () => {
    const dir = await window.setupAPI.pickDirectory();
    if (dir) {
      downloadsDir = dir;
      document.getElementById('downloads-dir').value = dir;
    }
  });

  // Password toggles
  setupPasswordToggle('toggle-pw', 'password');
  setupPasswordToggle('toggle-pw-confirm', 'password-confirm');

  // Discord toggle
  document.getElementById('discord-toggle').addEventListener('change', (e) => {
    document.getElementById('discord-url-group').style.display = e.target.checked ? 'block' : 'none';
  });

  // Chrome download button
  document.getElementById('btn-download-chrome').addEventListener('click', startChromeDownload);

  // Chrome progress listener
  window.setupAPI.onChromeProgress((data) => {
    const fill = document.getElementById('chrome-progress-fill');
    const pct = document.getElementById('chrome-progress-pct');
    const size = document.getElementById('chrome-progress-size');

    fill.style.width = data.percent + '%';
    pct.textContent = data.percent + '%';

    if (data.totalBytes > 0) {
      const dlMB = (data.downloadedBytes / (1024 * 1024)).toFixed(1);
      const totalMB = (data.totalBytes / (1024 * 1024)).toFixed(1);
      size.textContent = dlMB + ' / ' + totalMB + ' MB';
    }
  });

  updateUI();
}

// ── Password toggle ──────────────────────────────────────────────────────────
function setupPasswordToggle(btnId, inputId) {
  const btn = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  btn.addEventListener('click', () => {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.textContent = isPassword ? '\u{1F440}' : '\u{1F441}';
  });
}

// ── Chrome Download ──────────────────────────────────────────────────────────
async function startChromeDownload() {
  const btn = document.getElementById('btn-download-chrome');
  const progress = document.getElementById('chrome-progress');
  const needed = document.getElementById('chrome-needed');
  const done = document.getElementById('chrome-done');
  const errorEl = document.getElementById('chrome-error');

  btn.classList.add('hidden');
  needed.classList.add('hidden');
  done.classList.add('hidden');
  errorEl.classList.add('hidden');
  progress.classList.remove('hidden');

  try {
    const result = await window.setupAPI.downloadChrome();
    progress.classList.add('hidden');

    if (result.success) {
      chromeReady = true;
      done.classList.remove('hidden');
      if (result.skipped) {
        done.querySelector('strong').textContent = 'Chrome already available';
        done.querySelector('span').textContent = 'No download was needed.';
      }
      updateUI();
    } else {
      errorEl.classList.remove('hidden');
      document.getElementById('chrome-error-msg').textContent = result.error || 'Download failed.';
      btn.textContent = 'Retry';
      btn.classList.remove('hidden');
    }
  } catch (err) {
    progress.classList.add('hidden');
    errorEl.classList.remove('hidden');
    document.getElementById('chrome-error-msg').textContent = err.message || 'Download failed.';
    btn.textContent = 'Retry';
    btn.classList.remove('hidden');
  }
}

// ── Step Validation ──────────────────────────────────────────────────────────
function validateCurrentStep() {
  if (currentStep === 2) {
    // Password validation
    const pw = document.getElementById('password').value;
    const pwConfirm = document.getElementById('password-confirm').value;
    const errorEl = document.getElementById('password-error');

    if (pw.length < 4) {
      errorEl.textContent = 'Password must be at least 4 characters.';
      errorEl.classList.add('show');
      document.getElementById('password').classList.add('error');
      return false;
    }
    if (pw !== pwConfirm) {
      errorEl.textContent = 'Passwords do not match.';
      errorEl.classList.add('show');
      document.getElementById('password-confirm').classList.add('error');
      return false;
    }

    errorEl.classList.remove('show');
    document.getElementById('password').classList.remove('error');
    document.getElementById('password-confirm').classList.remove('error');
    return true;
  }

  if (currentStep === 4) {
    return chromeReady;
  }

  return true;
}

// ── Step Actions (async work on leaving a step) ──────────────────────────────
async function onStepLeave(step) {
  if (step === 2 && !passwordSet) {
    const pw = document.getElementById('password').value;
    try {
      await window.setupAPI.setPassword(pw);
      passwordSet = true;
    } catch (err) {
      const errorEl = document.getElementById('password-error');
      errorEl.textContent = 'Failed to set password: ' + (err.message || 'Unknown error');
      errorEl.classList.add('show');
      throw err;
    }
  }

  if (step === 3) {
    const enabled = document.getElementById('discord-toggle').checked;
    const url = document.getElementById('discord-url').value.trim();
    if (enabled && url) {
      try {
        await window.setupAPI.setDiscord(url);
        discordConfigured = true;
      } catch {}
    }
  }
}

// ── Summary Builder (safe DOM methods) ───────────────────────────────────────
function buildSummaryItem(label, value) {
  const li = document.createElement('li');
  li.className = 'summary-item';

  const check = document.createElement('span');
  check.className = 'summary-check';
  check.textContent = '\u2713';

  const labelEl = document.createElement('span');
  labelEl.className = 'summary-label';
  labelEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className = 'summary-value';
  valueEl.textContent = value;

  li.appendChild(check);
  li.appendChild(labelEl);
  li.appendChild(valueEl);
  return li;
}

// ── Step Enter ───────────────────────────────────────────────────────────────
function onStepEnter(step) {
  if (step === 4) {
    if (defaults.chromeFound || chromeReady) {
      document.getElementById('chrome-found').style.display = 'flex';
      document.getElementById('chrome-download-section').style.display = 'none';
      chromeReady = true;
    } else {
      document.getElementById('chrome-found').style.display = 'none';
      document.getElementById('chrome-download-section').style.display = 'block';
    }
  }

  if (step === 5) {
    const list = document.getElementById('summary-list');
    while (list.firstChild) list.removeChild(list.firstChild);

    list.appendChild(buildSummaryItem('Downloads', downloadsDir));
    list.appendChild(buildSummaryItem('Password', 'Set'));
    list.appendChild(buildSummaryItem('Discord', discordConfigured ? 'Enabled' : 'Skipped'));
    list.appendChild(buildSummaryItem('Browser', chromeReady ? 'Ready' : 'Not configured'));
  }
}

// ── Navigation ───────────────────────────────────────────────────────────────
async function nextStep() {
  if (!validateCurrentStep()) return;

  try {
    btnNext.disabled = true;
    await onStepLeave(currentStep);
  } catch {
    btnNext.disabled = false;
    return;
  }

  if (currentStep === TOTAL_STEPS - 1) {
    btnNext.disabled = true;
    btnNext.textContent = 'Launching...';
    await window.setupAPI.complete({
      downloadsDir,
      discordEnabled: discordConfigured,
    });
    return;
  }

  currentStep++;
  onStepEnter(currentStep);
  updateUI();
  btnNext.disabled = false;
}

function prevStep() {
  if (currentStep > 0) {
    currentStep--;
    updateUI();
  }
}

// ── UI Update ────────────────────────────────────────────────────────────────
function updateUI() {
  // Pages
  document.querySelectorAll('.step-page').forEach((page) => {
    page.classList.toggle('active', parseInt(page.dataset.step) === currentStep);
  });

  // Dots
  document.querySelectorAll('.step-dot').forEach((dot) => {
    const s = parseInt(dot.dataset.step);
    dot.className = 'step-dot';
    if (s === currentStep) dot.classList.add('active');
    else if (s < currentStep) dot.classList.add('done');
  });

  // Back button
  if (currentStep > 0 && currentStep < TOTAL_STEPS - 1) {
    btnBack.classList.remove('hidden');
  } else {
    btnBack.classList.add('hidden');
  }

  // Next button
  if (currentStep === 0) {
    btnNext.textContent = 'Get Started';
    btnNext.className = 'btn btn-primary';
  } else if (currentStep === TOTAL_STEPS - 1) {
    btnNext.textContent = 'Launch WebHere';
    btnNext.className = 'btn btn-primary btn-launch';
  } else if (currentStep === 4) {
    btnNext.textContent = 'Next';
    btnNext.className = 'btn btn-primary';
    btnNext.disabled = !chromeReady;
  } else {
    btnNext.textContent = 'Next';
    btnNext.className = 'btn btn-primary';
  }
}

// ── Start ────────────────────────────────────────────────────────────────────
init();
