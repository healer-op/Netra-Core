const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    toggleNetra:    (active) => ipcRenderer.invoke('toggle-netra', active),
    updateDohUrl:   (url)    => ipcRenderer.invoke('update-doh-url', url),
    runSpeedtest:   ()       => ipcRenderer.invoke('run-speedtest'),
    quitApp:        ()       => ipcRenderer.send('quit-app'),

    onStatsUpdate:   (cb) => ipcRenderer.on('stats-update',   (_, data) => cb(data)),
    onNewLog:        (cb) => ipcRenderer.on('new-log',        (_, msg)  => cb(msg)),
    onMetricsUpdate: (cb) => ipcRenderer.on('metrics-update', (_, data) => cb(data)),
    onSpeedUpdate:   (cb) => ipcRenderer.on('st-live-update', (_, data) => cb(data)),
});