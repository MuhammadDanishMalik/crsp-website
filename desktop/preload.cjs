const { contextBridge, ipcRenderer } = require("electron");

// The POS pages see crspDesktop (silent printing). The first-run setup screen uses crspSetup.
contextBridge.exposeInMainWorld("crspDesktop", { print: (html, paperMm, heightMm) => ipcRenderer.invoke("print", html, paperMm, heightMm) });
if (location.protocol === "file:") contextBridge.exposeInMainWorld("crspSetup", { download: (url, key) => ipcRenderer.invoke("setup", url, key), folder: (change) => ipcRenderer.invoke("folder", change), demo: () => ipcRenderer.invoke("demo"), hasKey: () => ipcRenderer.invoke("hasKey") });
