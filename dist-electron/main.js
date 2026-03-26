//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
let electron = require("electron");
let node_path = require("node:path");
node_path = __toESM(node_path);
//#region electron/main.ts
electron.app.commandLine.appendSwitch("disable-features", "WGCWindowCapture,MagnifierHostWindowCapturer,WindowOcclusion");
process.env.DIST = node_path.default.join(__dirname, "../dist");
process.env.VITE_PUBLIC = electron.app.isPackaged ? process.env.DIST : node_path.default.join(process.env.DIST, "../public");
var win;
var overlayWin;
electron.ipcMain.handle("get-sources", async () => {
	console.log("Fetching sources...");
	const options = {
		types: ["window", "screen"],
		thumbnailSize: {
			width: 300,
			height: 168
		},
		fetchWindowIcons: false,
		audio: true
	};
	try {
		let sources = await electron.desktopCapturer.getSources(options);
		if (sources.length === 0) {
			console.log("No sources with audio, retrying without audio...");
			delete options.audio;
			sources = await electron.desktopCapturer.getSources(options);
		}
		console.log(`Found ${sources.length} sources`);
		return sources.filter((s) => {
			if (s.id.startsWith("screen:")) return true;
			const name = s.name.toLowerCase();
			if (s.name.trim() === "" || name === "msedge" || name === "chrome" || name === "任务栏" || name === "taskbar") return false;
			return true;
		}).map((s) => ({
			id: s.id,
			name: s.name || (s.id.startsWith("screen:") ? `Screen ${s.id.split(":")[1]}` : "Unknown Window"),
			thumbnail: s.thumbnail.toDataURL(),
			isScreen: s.id.startsWith("screen:")
		}));
	} catch (err) {
		console.error("Critical error in get-sources:", err);
		return [];
	}
});
function createWindow() {
	win = new electron.BrowserWindow({
		width: 1100,
		height: 850,
		backgroundColor: "#ffffff",
		webPreferences: {
			preload: node_path.default.join(__dirname, "preload.js"),
			backgroundThrottling: false,
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	if (process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL);
	else win.loadFile(node_path.default.join(process.env.DIST, "index.html"));
}
function createOverlayWindow() {
	const { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;
	overlayWin = new electron.BrowserWindow({
		width: 900,
		height: 280,
		x: Math.floor((width - 900) / 2),
		y: height - 320,
		transparent: true,
		frame: false,
		alwaysOnTop: true,
		skipTaskbar: true,
		resizable: false,
		hasShadow: false,
		backgroundColor: "#00000000",
		webPreferences: { preload: node_path.default.join(__dirname, "preload.js") }
	});
	overlayWin.setIgnoreMouseEvents(true);
	overlayWin.setAlwaysOnTop(true, "screen-saver");
	overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
	if (process.env.VITE_DEV_SERVER_URL) overlayWin.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/overlay`);
	else overlayWin.loadFile(node_path.default.join(process.env.DIST, "index.html"), { hash: "overlay" });
}
electron.ipcMain.on("set-overlay-lock", (event, lock) => {
	if (overlayWin) {
		overlayWin.setIgnoreMouseEvents(lock);
		overlayWin.webContents.send("toggle-drag-mode", !lock);
	}
});
electron.ipcMain.on("recenter-overlay", () => {
	if (overlayWin) {
		const { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;
		overlayWin.setPosition(Math.floor((width - 900) / 2), height - 200);
		overlayWin.show();
	}
});
electron.app.whenReady().then(() => {
	createWindow();
	createOverlayWindow();
});
electron.app.on("window-all-closed", () => {
	if (process.platform !== "darwin") electron.app.quit();
});
electron.ipcMain.on("update-subtitles", (event, text) => {
	if (overlayWin) overlayWin.webContents.send("subtitle-data", text);
});
//#endregion
