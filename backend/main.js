const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { exec, execSync } = require('child_process');
const si = require('systeminformation');
const { autoUpdater } = require('electron-updater');
const NetraProxy = require('./proxy');

let mainWindow;
let metricsInterval;
let dnsWasSet = false;

// Auto-updater configuration
autoUpdater.autoDownload = true;
autoUpdater.allowPrerelease = false;

function initAutoUpdater() {
    autoUpdater.on('checking-for-update', () => {
        if (mainWindow) mainWindow.webContents.send('new-log', 'Checking for updates...');
    });

    autoUpdater.on('update-available', (info) => {
        if (mainWindow) mainWindow.webContents.send('new-log', `Update v${info.version} available. Downloading...`);
    });

    autoUpdater.on('update-not-available', () => {
        if (mainWindow) mainWindow.webContents.send('new-log', 'System is up to date.');
    });

    autoUpdater.on('error', (err) => {
        if (mainWindow) mainWindow.webContents.send('new-log', `Update error: ${err.message}`);
    });

    autoUpdater.on('update-downloaded', (info) => {
        dialog.showMessageBox({
            type: 'info',
            title: 'Update Ready',
            message: `Version ${info.version} has been downloaded and is ready to install.`,
            buttons: ['Restart Now', 'Later']
        }).then((result) => {
            if (result.response === 0) {
                autoUpdater.quitAndInstall();
            }
        });
    });

    autoUpdater.checkForUpdatesAndNotify();
}

let proxy = new NetraProxy({
    onStatsUpdate: (stats) => {
        if (mainWindow) mainWindow.webContents.send('stats-update', stats);
    },
    onLog: (message) => {
        if (mainWindow) mainWindow.webContents.send('new-log', message);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
//  CRASH-SAFE DNS RESTORE
//  Uses execSync so it runs synchronously even inside process.exit()
// ─────────────────────────────────────────────────────────────────────────────
function restoreDNSSync() {
    if (!dnsWasSet) return;
    try {
        if (process.platform === 'win32') {
            const stdout = execSync('netsh interface show interface', { timeout: 5000 }).toString();
            const interfaces = stdout.split('\n')
                .filter(l => l.includes('Connected'))
                .map(l => l.split('Dedicated').pop().trim())
                .filter(Boolean);

            for (const name of interfaces) {
                try { execSync(`netsh interface ipv4 set dnsservers name="${name}" source=dhcp`, { timeout: 3000 }); } catch (e) {}
                try { execSync(`netsh interface ipv6 set dnsservers name="${name}" source=dhcp`, { timeout: 3000 }); } catch (e) {}
            }
            execSync('ipconfig /flushdns', { timeout: 3000 });
        } else if (process.platform === 'darwin') {
            const stdout = execSync('networksetup -listallnetworkservices').toString();
            const services = stdout.split('\n').filter(s => s && !s.includes('*'));
            for (const s of services) {
                try { execSync(`networksetup -setdnsservers "${s}" Empty`); } catch (e) {}
            }
        } else if (process.platform === 'linux') {
            const stdout = execSync('ip -o link show | awk -F": " \'{print $2}\'').toString();
            const ifaces = stdout.split('\n').filter(i => i && i !== 'lo');
            for (const i of ifaces) {
                try { execSync(`resolvectl revert ${i} || nmcli device modify ${i} ipv4.dns ""`); } catch (e) {}
            }
        }
        dnsWasSet = false;
    } catch (e) {
        process.stderr.write(`[Netra] DNS restore failed on exit: ${e.message}\n`);
    }
}

// Hook every possible exit path — crash, kill, ctrl+c, unhandled errors
process.on('exit',              ()    => restoreDNSSync());
process.on('SIGINT',            ()    => { restoreDNSSync(); process.exit(0); });
process.on('SIGTERM',           ()    => { restoreDNSSync(); process.exit(0); });
process.on('uncaughtException', (err) => {
    process.stderr.write(`[Netra] Uncaught: ${err.message}\n`);
    restoreDNSSync();
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    process.stderr.write(`[Netra] Unhandled rejection: ${reason}\n`);
});

// ─────────────────────────────────────────────────────────────────────────────
//  WINDOW
// ─────────────────────────────────────────────────────────────────────────────
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 420,
        height: 700,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        frame: false,
        backgroundColor: '#080808',
        show: false
    });

    mainWindow.loadFile(path.join(__dirname, '../frontend/index.html'));
    mainWindow.once('ready-to-show', () => mainWindow.show());
    startMetrics();
}

// ─────────────────────────────────────────────────────────────────────────────
//  LIVE METRICS  (real-time interface bytes/sec)
// ─────────────────────────────────────────────────────────────────────────────
async function startMetrics() {
    await si.networkStats(); // prime

    metricsInterval = setInterval(async () => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        try {
            let ping = 0;
            try {
                const { hostname } = new URL(proxy.dohUrl);
                const p = await si.inetLatency(hostname);
                ping = p > 0 ? p : 0;
            } catch (e) {}

            mainWindow.webContents.send('metrics-update', { ping });
        } catch (e) {}
    }, 2000);
}

// ─────────────────────────────────────────────────────────────────────────────
//  SPEED TEST
//
//  Both endpoints are Cloudflare's public speed test infrastructure.
//  speed.cloudflare.com is their own benchmarking tool — no API key,
//  no account, explicitly designed for repeated automated testing,
//  no rate limiting documented or observed.
//
//  Download: GET  https://speed.cloudflare.com/__down?bytes=N
//  Upload:   POST https://speed.cloudflare.com/__up
//
//  We run 3 download samples (1MB, 5MB, 10MB) and average them for accuracy.
//  Upload uses a 3MB payload — large enough to measure fairly on fast connections.
// ─────────────────────────────────────────────────────────────────────────────
async function cfFetch(url, options = {}) {
    const { default: fetch } = await import('node-fetch');
    return fetch(url, options);
}

async function measureDownload(bytes) {
    const url = `https://speed.cloudflare.com/__down?bytes=${bytes}`;
    const t = Date.now();
    const res = await cfFetch(url, { headers: { 'Cache-Control': 'no-cache' } });
    const buf = await res.arrayBuffer();
    const secs = (Date.now() - t) / 1000;
    return (buf.byteLength * 8) / secs / 1_000_000; // Mbps
}

async function measureUpload(bytes) {
    const body = Buffer.alloc(bytes, 0x41); // fill with 'A'
    const t = Date.now();
    await cfFetch('https://speed.cloudflare.com/__up', {
        method: 'POST',
        body,
        headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(bytes)
        }
    });
    const secs = (Date.now() - t) / 1000;
    return (bytes * 8) / secs / 1_000_000; // Mbps
}

ipcMain.handle('run-speedtest', async (event) => {
    try {
        const sendUpdate = (dl, ul) => {
            event.sender.send('st-live-update', { download: dl, upload: ul });
        };

        // Warm up
        await cfFetch('https://speed.cloudflare.com/__down?bytes=100000').then(r => r.arrayBuffer()).catch(() => {});

        let downloadMbps = 0;
        let uploadMbps = 0;

        // Download samples
        const dlS = [1_000_000, 5_000_000, 10_000_000];
        let dlSum = 0;
        for (let i = 0; i < dlS.length; i++) {
            const res = await measureDownload(dlS[i]);
            dlSum += res;
            downloadMbps = parseFloat((dlSum / (i + 1)).toFixed(2));
            sendUpdate(downloadMbps, 0);
        }

        // Upload samples
        const ulS = [2_000_000, 3_000_000];
        let ulSum = 0;
        for (let i = 0; i < ulS.length; i++) {
            const res = await measureUpload(ulS[i]);
            ulSum += res;
            uploadMbps = parseFloat((ulSum / (i + 1)).toFixed(2));
            sendUpdate(downloadMbps, uploadMbps);
        }

        return { success: true, download: downloadMbps, upload: uploadMbps };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// ─────────────────────────────────────────────────────────────────────────────
//  APP LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
    createWindow();
    initAutoUpdater();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// before-quit lets us await async cleanup before the process dies
app.on('before-quit', async (e) => {
    e.preventDefault();
    try {
        if (metricsInterval) clearInterval(metricsInterval);
        await stopNetra();
    } catch (err) {}
    app.exit(0);
});

app.on('window-all-closed', () => app.quit());

ipcMain.on('quit-app', () => app.quit());

ipcMain.handle('update-doh-url', (_, url) => {
    proxy.setDohUrl(url);
    return { success: true };
});

ipcMain.handle('toggle-netra', async (_, active) => {
    return active ? startNetra() : stopNetra();
});

// ─────────────────────────────────────────────────────────────────────────────
//  DNS MANAGEMENT (Cross-Platform)
// ─────────────────────────────────────────────────────────────────────────────
async function startNetra() {
    try {
        await proxy.start();
        await setSystemDNS('127.0.0.1');
        dnsWasSet = true;
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function stopNetra() {
    try {
        if (proxy) await proxy.stop();
        await restoreSystemDNS();
        dnsWasSet = false;
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function setSystemDNS(dns) {
    if (process.platform === 'win32') {
        return setWindowsDNS(dns);
    } else if (process.platform === 'darwin') {
        return setMacDNS(dns);
    } else if (process.platform === 'linux') {
        return setLinuxDNS(dns);
    }
}

async function restoreSystemDNS() {
    if (process.platform === 'win32') {
        return restoreWindowsDNS();
    } else if (process.platform === 'darwin') {
        return restoreMacDNS();
    } else if (process.platform === 'linux') {
        return restoreLinuxDNS();
    }
}

// --- Windows ---
async function setWindowsDNS(dns) {
    return new Promise((resolve, reject) => {
        exec('netsh interface show interface', (err, stdout) => {
            if (err) return reject(err);
            const ifaces = parseInterfaces(stdout);
            const next = (i) => {
                if (i >= ifaces.length) { exec('ipconfig /flushdns', () => resolve()); return; }
                exec([
                    `netsh interface ipv4 set dnsservers name="${ifaces[i]}" source=static address=${dns} validate=no`,
                    `netsh interface ipv6 set dnsservers name="${ifaces[i]}" source=static address=::1 validate=no`
                ].join(' && '), () => next(i + 1));
            };
            next(0);
        });
    });
}

async function restoreWindowsDNS() {
    return new Promise((resolve) => {
        exec('netsh interface show interface', (err, stdout) => {
            if (err) return resolve();
            const ifaces = parseInterfaces(stdout);
            const next = (i) => {
                if (i >= ifaces.length) { exec('ipconfig /flushdns', () => resolve()); return; }
                exec([
                    `netsh interface ipv4 set dnsservers name="${ifaces[i]}" source=dhcp`,
                    `netsh interface ipv6 set dnsservers name="${ifaces[i]}" source=dhcp`
                ].join(' && '), () => next(i + 1));
            };
            next(0);
        });
    });
}

// --- macOS ---
async function setMacDNS(dns) {
    return new Promise((resolve) => {
        exec('networksetup -listallnetworkservices', (err, stdout) => {
            const services = (stdout || '').split('\n').filter(s => s && !s.includes('*'));
            const next = (i) => {
                if (i >= services.length) return resolve();
                exec(`networksetup -setdnsservers "${services[i]}" ${dns}`, () => next(i + 1));
            };
            next(0);
        });
    });
}

async function restoreMacDNS() {
    return new Promise((resolve) => {
        exec('networksetup -listallnetworkservices', (err, stdout) => {
            const services = (stdout || '').split('\n').filter(s => s && !s.includes('*'));
            const next = (i) => {
                if (i >= services.length) return resolve();
                exec(`networksetup -setdnsservers "${services[i]}" Empty`, () => next(i + 1));
            };
            next(0);
        });
    });
}

// --- Linux ---
async function setLinuxDNS(dns) {
    return new Promise((resolve) => {
        exec('ip -o link show | awk -F": " \'{print $2}\'', (err, stdout) => {
            const ifaces = (stdout || '').split('\n').filter(i => i && i !== 'lo');
            const next = (i) => {
                if (i >= ifaces.length) return resolve();
                exec(`resolvectl dns ${ifaces[i]} ${dns} || nmcli device modify ${ifaces[i]} ipv4.dns "${dns}"`, () => next(i + 1));
            };
            next(0);
        });
    });
}

async function restoreLinuxDNS() {
    return new Promise((resolve) => {
        exec('ip -o link show | awk -F": " \'{print $2}\'', (err, stdout) => {
            const ifaces = (stdout || '').split('\n').filter(i => i && i !== 'lo');
            const next = (i) => {
                if (i >= ifaces.length) return resolve();
                exec(`resolvectl revert ${ifaces[i]} || nmcli device modify ${ifaces[i]} ipv4.dns ""`, () => next(i + 1));
            };
            next(0);
        });
    });
}

function parseInterfaces(stdout) {
    return (stdout || '').split('\n')
        .filter(l => l.includes('Connected'))
        .map(l => l.split('Dedicated').pop().trim())
        .filter(Boolean);
}