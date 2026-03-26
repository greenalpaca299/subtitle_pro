import { app, BrowserWindow, ipcMain, desktopCapturer, screen } from 'electron'
import path from 'node:path'

// 彻底禁用不稳定的 WGC 和 放大镜捕获特性，强制使用最稳定的传统 GDI 捕获
app.commandLine.appendSwitch('disable-features', 'WGCWindowCapture,MagnifierHostWindowCapturer,WindowOcclusion')

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null
let overlayWin: BrowserWindow | null

ipcMain.handle('get-sources', async () => {
  console.log('Fetching sources...')
  const options: any = {
    types: ['window', 'screen'],
    thumbnailSize: { width: 300, height: 168 },
    fetchWindowIcons: false,
    audio: true // 尝试请求音频
  }

  try {
    let sources = await desktopCapturer.getSources(options)
    
    // 如果带音频请求返回空，尝试不带音频请求作为降级方案
    if (sources.length === 0) {
      console.log('No sources with audio, retrying without audio...')
      delete options.audio
      sources = await desktopCapturer.getSources(options)
    }

    console.log(`Found ${sources.length} sources`)
    
    return sources
      .filter(s => {
        // 允许所有屏幕显示
        if (s.id.startsWith('screen:')) return true
        // 过滤掉明显的系统小组件，但保留大部分窗口
        const name = s.name.toLowerCase()
        if (s.name.trim() === '' || name === 'msedge' || name === 'chrome' || name === '任务栏' || name === 'taskbar') return false
        return true
      })
      .map(s => ({
        id: s.id,
        name: s.name || (s.id.startsWith('screen:') ? `Screen ${s.id.split(':')[1]}` : 'Unknown Window'),
        thumbnail: s.thumbnail.toDataURL(),
        isScreen: s.id.startsWith('screen:')
      }))
  } catch (err) {
    console.error('Critical error in get-sources:', err)
    return []
  }
})

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 850,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(process.env.DIST, 'index.html'))
  }
}

function createOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  overlayWin = new BrowserWindow({
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
    backgroundColor: '#00000000', 
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  overlayWin.setIgnoreMouseEvents(true)
  overlayWin.setAlwaysOnTop(true, 'screen-saver')
  overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (process.env.VITE_DEV_SERVER_URL) {
    overlayWin.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/overlay`)
  } else {
    overlayWin.loadFile(path.join(process.env.DIST, 'index.html'), { hash: 'overlay' })
  }
}

ipcMain.on('set-overlay-lock', (event, lock) => {
  if (overlayWin) {
    overlayWin.setIgnoreMouseEvents(lock)
    overlayWin.webContents.send('toggle-drag-mode', !lock)
  }
})

ipcMain.on('recenter-overlay', () => {
  if (overlayWin) {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.workAreaSize
    overlayWin.setPosition(Math.floor((width - 900) / 2), height - 200)
    overlayWin.show()
  }
})

app.whenReady().then(() => {
  createWindow()
  createOverlayWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.on('update-subtitles', (event, text) => {
  if (overlayWin) overlayWin.webContents.send('subtitle-data', text)
})
