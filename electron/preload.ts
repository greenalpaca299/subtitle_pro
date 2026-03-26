import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  updateSubtitles: (text: string) => ipcRenderer.send('update-subtitles', text),
  onSubtitleData: (callback: (text: string) => void) => {
    ipcRenderer.on('subtitle-data', (_event, value) => callback(value))
  },
  getSources: () => ipcRenderer.invoke('get-sources'),
  setOverlayLock: (lock: boolean) => ipcRenderer.send('set-overlay-lock', lock),
  onToggleDragMode: (callback: (isDrag: boolean) => void) => {
    ipcRenderer.on('toggle-drag-mode', (_event, value) => callback(value))
  },
  recenterOverlay: () => ipcRenderer.send('recenter-overlay'),
})
