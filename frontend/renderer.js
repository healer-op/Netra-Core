const actionBtn      = document.getElementById('netra-action-btn');
const statusLabel    = document.getElementById('status-label');
const serverSelect   = document.getElementById('server-select');
const queryCount     = document.getElementById('query-count');
const pingVal        = document.getElementById('ping-val');
const closeBtn       = document.getElementById('close-btn');
const logsContainer  = document.getElementById('logs-container');
const statusDot      = document.getElementById('status-dot');
const pulseRing      = document.getElementById('pulse-ring');
const liveDot        = document.getElementById('live-dot');
const footerStatus   = document.getElementById('footer-status');
const logCountEl     = document.getElementById('log-count');

// Speedtest elements
const speedtestTrigger  = document.getElementById('speedtest-trigger');
const speedtestOverlay  = document.getElementById('speedtest-overlay');
const speedtestClose    = document.getElementById('speedtest-close');
const stRunBtn          = document.getElementById('st-run-btn');
const stRunning         = document.getElementById('st-running');
const stResult          = document.getElementById('st-result');
const stRunningLabel    = document.getElementById('st-running-label');
const stDlVal           = document.getElementById('st-dl-val');
const stUlVal           = document.getElementById('st-ul-val');
const stError           = document.getElementById('st-error');
const stDlMain          = document.getElementById('st-dl-main');
const stUlMain          = document.getElementById('st-ul-main');

let isNetraActive = false;
let totalLogs = 0;
let speedtestRunning = false;

// ─────────────────────────────────────────────
//  LOGGING
// ─────────────────────────────────────────────
function addLog(message, type = 'normal') {
    const entry = document.createElement('div');
    entry.className = `log-line ${type}`;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

    let iconHtml = '';
    if (message.includes('→')) {
        const domain = message.split('→')[0].trim();
        iconHtml = `<div class="log-icon"><img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" onerror="this.style.display='none'"></div>`;
    } else if (message.includes('Resolving:')) {
        const domain = message.split('Resolving:')[1].trim();
        iconHtml = `<div class="log-icon"><img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" onerror="this.style.display='none'"></div>`;
    } else if (type === 'system') {
        iconHtml = `<div class="log-icon"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>`;
    } else if (type === 'red') {
        iconHtml = `<div class="log-icon"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>`;
    } else {
        iconHtml = `<div class="log-icon"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/></svg></div>`;
    }

    entry.innerHTML = `${iconHtml}<div class="log-content">${message}</div><div class="log-time">${time}</div>`;
    logsContainer.prepend(entry);
    totalLogs++;
    logCountEl.textContent = `${totalLogs} entr${totalLogs === 1 ? 'y' : 'ies'}`;
    if (logsContainer.children.length > 60) logsContainer.removeChild(logsContainer.lastChild);
}

// ─────────────────────────────────────────────
//  SPEEDTEST OVERLAY
// ─────────────────────────────────────────────
async function runMainSpeedtest() {
    if (speedtestRunning) return;
    speedtestRunning = true;

    // Show loading state on main UI
    stDlMain.innerHTML = '<span class="loading-dots">...</span> <em>Mbps</em>';
    stUlMain.innerHTML = '<span class="loading-dots">...</span> <em>Mbps</em>';

    try {
        const result = await window.api.runSpeedtest();
        if (result.success) {
            stDlMain.innerHTML = `${result.download.toFixed(1)} <em>Mbps</em>`;
            stUlMain.innerHTML = `${result.upload.toFixed(1)} <em>Mbps</em>`;
            stDlVal.textContent = result.download.toFixed(1);
            stUlVal.textContent = result.upload.toFixed(1);
            addLog(`Speed test auto-result — DL: ${result.download} Mbps | UL: ${result.upload} Mbps`, 'system');
        } else {
            stDlMain.innerHTML = `-- <em>ERR</em>`;
            stUlMain.innerHTML = `-- <em>ERR</em>`;
            addLog(`Auto speed test failed: ${result.error}`, 'red');
        }
    } catch (err) {
        stDlMain.innerHTML = `-- <em>FATAL</em>`;
        stUlMain.innerHTML = `-- <em>FATAL</em>`;
        addLog(`Auto speed test fatal: ${err.message}`, 'red');
    } finally {
        speedtestRunning = false;
    }
}

speedtestTrigger.addEventListener('click', () => {
    speedtestOverlay.classList.remove('hidden');
    // If no results yet, auto-trigger a run
    if (stDlVal.textContent === '--' && !speedtestRunning) {
        stRunBtn.click();
    }
});

speedtestClose.addEventListener('click', () => {
    if (speedtestRunning) return; // don't close mid-test
    speedtestOverlay.classList.add('hidden');
});

stRunBtn.addEventListener('click', async () => {
    if (speedtestRunning) return;
    speedtestRunning = true;

    // Show running state
    stResult.classList.add('hidden');
    stRunning.classList.remove('hidden');
    stError.classList.add('hidden');
    stRunBtn.disabled = true;
    stRunningLabel.textContent = 'MEASURING DOWNLOAD...';

    // Update main UI to show we're testing
    stDlMain.innerHTML = '<span class="loading-dots">...</span> <em>Mbps</em>';
    stUlMain.innerHTML = '<span class="loading-dots">...</span> <em>Mbps</em>';

    addLog('Speed test started', 'system');

    // Simulate label progression
    const phases = [
        { label: 'MEASURING DOWNLOAD...', delay: 0 },
        { label: 'MEASURING UPLOAD...', delay: 5000 },
        { label: 'FINALIZING...', delay: 9000 },
    ];
    const phaseTimers = phases.map(p => setTimeout(() => {
        stRunningLabel.textContent = p.label;
    }, p.delay));

    try {
        const result = await window.api.runSpeedtest();

        // Clear phase timers
        phaseTimers.forEach(t => clearTimeout(t));

        // Show results
        stRunning.classList.add('hidden');
        stResult.classList.remove('hidden');

        if (result.success) {
            stDlVal.textContent = result.download.toFixed(1);
            stUlVal.textContent = result.upload.toFixed(1);
            stDlMain.innerHTML = `${result.download.toFixed(1)} <em>Mbps</em>`;
            stUlMain.innerHTML = `${result.upload.toFixed(1)} <em>Mbps</em>`;
            addLog(`Speed test — DL: ${result.download} Mbps | UL: ${result.upload} Mbps`, 'system');
        } else {
            stDlVal.textContent = '--';
            stUlVal.textContent = '--';
            stDlMain.innerHTML = `-- <em>ERR</em>`;
            stUlMain.innerHTML = `-- <em>ERR</em>`;
            stError.textContent = `ERROR: ${result.error}`;
            stError.classList.remove('hidden');
            addLog(`Speed test failed: ${result.error}`, 'red');
        }
    } catch (err) {
        phaseTimers.forEach(t => clearTimeout(t));
        stRunning.classList.add('hidden');
        stResult.classList.remove('hidden');
        stDlVal.textContent = '--';
        stUlVal.textContent = '--';
        stDlMain.innerHTML = `-- <em>FATAL</em>`;
        stUlMain.innerHTML = `-- <em>FATAL</em>`;
        stError.textContent = `FATAL: ${err.message}`;
        stError.classList.remove('hidden');
        addLog(`Speed test fatal: ${err.message}`, 'red');
    } finally {
        speedtestRunning = false;
        stRunBtn.disabled = false;
    }
});

// ─────────────────────────────────────────────
//  MAIN TOGGLE
// ─────────────────────────────────────────────
closeBtn.addEventListener('click', () => window.api.quitApp());

serverSelect.addEventListener('change', async () => {
    const name = serverSelect.options[serverSelect.selectedIndex].text;
    addLog(`Provider: ${name}`, 'system');
    await window.api.updateDohUrl(serverSelect.value);
});

actionBtn.addEventListener('click', async () => {
    if (actionBtn.classList.contains('loading')) return;
    const nextState = !isNetraActive;

    actionBtn.classList.add('loading');
    statusLabel.innerText = nextState ? 'CONNECTING..' : 'STOPPING..';
    serverSelect.disabled = true;

    try {
        const result = await window.api.toggleNetra(nextState);
        if (result.success) {
            isNetraActive = nextState;
            updateStatus(isNetraActive);
            addLog(isNetraActive ? 'SECURE TUNNEL ACTIVE' : 'SECURE TUNNEL STOPPED', 'system');
        } else {
            addLog(`ERROR: ${result.error}`, 'red');
            updateStatus(isNetraActive);
        }
    } catch (err) {
        addLog(`FATAL: ${err.message}`, 'red');
        updateStatus(isNetraActive);
    } finally {
        actionBtn.classList.remove('loading');
        if (!isNetraActive) serverSelect.disabled = false;
    }
});

function updateStatus(isActive) {
    if (isActive) {
        statusLabel.innerText = 'PROTECTED';
        actionBtn.classList.add('active');
        statusDot.classList.add('active');
        pulseRing.classList.add('active');
        liveDot.classList.add('active');
        footerStatus.textContent = 'ONLINE';
        footerStatus.classList.add('active');
        serverSelect.disabled = true;
    } else {
        statusLabel.innerText = 'READY';
        actionBtn.classList.remove('active');
        statusDot.classList.remove('active');
        pulseRing.classList.remove('active');
        liveDot.classList.remove('active');
        footerStatus.textContent = 'OFFLINE';
        footerStatus.classList.remove('active');
        serverSelect.disabled = false;
    }
}

// ─────────────────────────────────────────────
//  IPC LISTENERS
// ─────────────────────────────────────────────
window.api.onStatsUpdate((stats) => {
    queryCount.innerText = stats.queries;
});

window.api.onNewLog((message) => addLog(message));

window.api.onSpeedUpdate((data) => {
    if (data.download > 0) {
        stDlMain.innerHTML = `${data.download.toFixed(1)} <em>Mbps</em>`;
        stDlVal.textContent = data.download.toFixed(1);
    }
    if (data.upload > 0) {
        stUlMain.innerHTML = `${data.upload.toFixed(1)} <em>Mbps</em>`;
        stUlVal.textContent = data.upload.toFixed(1);
    }
});

window.api.onMetricsUpdate((metrics) => {
    pingVal.innerHTML       = metrics.ping > 0 ? `${Math.round(metrics.ping)} <em>ms</em>` : `-- <em>ms</em>`;
});

// AUTO-RUN ON STARTUP
setTimeout(() => {
    runMainSpeedtest();
}, 2000);