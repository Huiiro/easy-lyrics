import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'

import { IPC_CHANNELS } from '../shared/ipc'

const audioFiles = new Map<string, string>()

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'lyric-audio',
    privileges: { secure: true, standard: true, stream: true, supportFetchAPI: true }
  }
])

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.ping, () => 'pong')
  ipcMain.handle(IPC_CHANNELS.selectAudio, async () => {
    const result = await dialog.showOpenDialog({
      title: '选择音频',
      properties: ['openFile'],
      filters: [
        { name: '音频文件', extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'opus'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })

    const path = result.filePaths[0]
    if (result.canceled || !path) return null

    const id = crypto.randomUUID()
    audioFiles.set(id, path)

    return {
      path,
      name: basename(path),
      url: `lyric-audio://media/${id}`
    }
  })
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Lyric Timeline',
    backgroundColor: '#101318',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.lyric-timeline.app')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  protocol.handle('lyric-audio', (request) => {
    const url = new URL(request.url)
    const path = url.hostname === 'media' ? audioFiles.get(url.pathname.slice(1)) : undefined
    return path ? net.fetch(pathToFileURL(path).toString()) : new Response(null, { status: 404 })
  })

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
