let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("electronAPI", {
	updateSubtitles: (text) => electron.ipcRenderer.send("update-subtitles", text),
	onSubtitleData: (callback) => {
		electron.ipcRenderer.on("subtitle-data", (_event, value) => callback(value));
	},
	getSources: () => electron.ipcRenderer.invoke("get-sources"),
	setOverlayLock: (lock) => electron.ipcRenderer.send("set-overlay-lock", lock),
	onToggleDragMode: (callback) => {
		electron.ipcRenderer.on("toggle-drag-mode", (_event, value) => callback(value));
	},
	recenterOverlay: () => electron.ipcRenderer.send("recenter-overlay")
});
//#endregion
