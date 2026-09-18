import { basename, join } from 'node:path'
import { access, readFile, rename, unlink, writeFile } from 'node:fs/promises'

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  protocol,
  shell,
  type MenuItemConstructorOptions
} from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'

import { createAudioResponse } from './audio-response'
import { IPC_CHANNELS } from '../shared/ipc'
import type { RecentProject } from '../shared/ipc'
import { parseProjectFile } from '../shared/project-file'
import type { LyricProject } from '../shared/models/project'
import { parseExportTemplates, type ExportTemplate } from '../shared/export'
import { parseRecentProjects, prioritizeRecentProject } from '../shared/recent-projects'

const audioFiles = new Map<string, string>()
let projectDirty = false
let currentLocale: 'zh-CN' | 'en-US' = Intl.DateTimeFormat()
  .resolvedOptions()
  .locale.toLowerCase()
  .startsWith('zh')
  ? 'zh-CN'
  : 'en-US'

const mainEnglish: Record<string, string> = {
  导出歌词: 'Export Lyrics',
  文件: 'File',
  音频文件: 'Audio Files',
  所有文件: 'All Files',
  选择音频: 'Select Audio',
  保存工程: 'Save Project',
  打开工程: 'Open Project',
  未保存的修改: 'Unsaved Changes',
  '当前工程有未保存的修改。': 'The current project has unsaved changes.',
  '自动恢复副本已保留，但建议先保存工程。':
    'An autosave is available, but saving the project is recommended.',
  取消关闭: 'Cancel',
  仍然关闭: 'Close Anyway',
  新建: 'New',
  '打开项目…': 'Open Project…',
  最近项目: 'Recent Projects',
  暂无最近项目: 'No Recent Projects',
  '重命名项目…': 'Rename Project…',
  关闭项目: 'Close Project',
  保存: 'Save',
  查看保存记录: 'View Save History',
  '导入歌曲…': 'Import Audio…',
  '导入歌词…': 'Import Lyrics…',
  '导出…': 'Export…',
  编辑: 'Edit',
  撤销: 'Undo',
  重做: 'Redo',
  播放与打轴: 'Playback & Timing',
  '播放 / 暂停': 'Play / Pause',
  '记录当前 Token': 'Mark Current Token',
  智能打轴: 'Auto Timing',
  '切换 Loop': 'Toggle Loop',
  切换歌词跟随: 'Toggle Lyrics Follow',
  切换时间轴跟随: 'Toggle Timeline Follow',
  导航与微调: 'Navigation & Nudge',
  '上一个 Token': 'Previous Token',
  '下一个 Token': 'Next Token',
  上一句: 'Previous Line',
  下一句: 'Next Line',
  '定位选中 Token': 'Locate Selected Token',
  '向前微调 1 ms': 'Nudge Earlier 1 ms',
  '向后微调 1 ms': 'Nudge Later 1 ms',
  '向前微调 50 ms': 'Nudge Earlier 50 ms',
  '向后微调 50 ms': 'Nudge Later 50 ms',
  '复制与 Token 结构': 'Copy & Token Structure',
  复制整句时间: 'Copy Line Timing',
  粘贴整句时间: 'Paste Line Timing',
  '拆分 Token': 'Split Token',
  '合并前一个 Token': 'Merge Previous Token',
  '合并下一个 Token': 'Merge Next Token',
  时间轴: 'Timeline',
  'Token 编辑模式': 'Token Edit Mode',
  整句编辑模式: 'Line Edit Mode',
  切换相邻锁定: 'Toggle Adjacent Lock',
  缩小时间轴: 'Zoom Out',
  放大时间轴: 'Zoom In',
  适合时间轴: 'Fit Timeline',
  '快捷键与设置…': 'Shortcuts & Settings…',
  文件后缀: 'Files'
}

function mt(value: string): string {
  return currentLocale === 'en-US' ? (mainEnglish[value] ?? value) : value
}

function recentProjectsPath(): string {
  return join(app.getPath('userData'), 'recent-projects.json')
}

function exportTemplatesPath(): string {
  return join(app.getPath('userData'), 'export-presets.json')
}

async function writeRecentProjects(projects: RecentProject[]): Promise<void> {
  await writeFile(
    recentProjectsPath(),
    `${JSON.stringify(projects.slice(0, 10), null, 2)}\n`,
    'utf8'
  )
}

async function listRecentProjects(): Promise<RecentProject[]> {
  let stored: unknown
  try {
    stored = JSON.parse(await readFile(recentProjectsPath(), 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    await writeRecentProjects([])
    return []
  }
  const valid: RecentProject[] = []
  const parsed = parseRecentProjects(stored)
  for (const item of parsed) {
    try {
      await access(item.path)
      valid.push(item as RecentProject)
    } catch {
      // Deleted and moved projects are pruned from the menu.
    }
  }
  if (!Array.isArray(stored) || valid.length !== stored.length) await writeRecentProjects(valid)
  return valid.slice(0, 10)
}

async function rememberProject(path: string, name: string): Promise<void> {
  const projects = await listRecentProjects()
  await writeRecentProjects(
    prioritizeRecentProject(projects, {
      path,
      name: name.trim() || basename(path, '.lyricproj'),
      lastOpenedAt: Date.now()
    })
  )
  const window = BrowserWindow.getAllWindows()[0]
  if (process.platform === 'darwin' && window) void installMacMenu(window)
}

async function forgetProject(path: string): Promise<void> {
  await writeRecentProjects((await listRecentProjects()).filter((project) => project.path !== path))
  const window = BrowserWindow.getAllWindows()[0]
  if (process.platform === 'darwin' && window) void installMacMenu(window)
}

async function openRecentProject(path: string) {
  const recent = await listRecentProjects()
  if (!recent.some((project) => project.path === path)) return null
  try {
    const result = await readProject(path)
    await rememberProject(path, result.project.name)
    return result
  } catch {
    await forgetProject(path)
    return null
  }
}

async function registerAudio(
  path: string
): Promise<{ path: string; name: string; url: string } | null> {
  try {
    await access(path)
  } catch {
    return null
  }
  const id = crypto.randomUUID()
  audioFiles.set(id, path)
  return { path, name: basename(path), url: `lyric-audio://media/${id}` }
}

async function readProject(path: string, exposedPath: string | null = path) {
  const project = parseProjectFile(JSON.parse(await readFile(path, 'utf8')))
  const audio = project.audio ? await registerAudio(project.audio.path) : null
  return { path: exposedPath, project, audio, audioMissing: Boolean(project.audio && !audio) }
}

async function atomicWrite(path: string, project: LyricProject): Promise<void> {
  const validated = parseProjectFile(project)
  const temporaryPath = `${path}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, path)
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'lyric-audio',
    privileges: {
      secure: true,
      standard: true,
      stream: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
])

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.ping, () => 'pong')
  ipcMain.handle(IPC_CHANNELS.setLocale, async (_event, locale: 'zh-CN' | 'en-US') => {
    if (locale !== 'zh-CN' && locale !== 'en-US') return
    currentLocale = locale
    const window = BrowserWindow.getAllWindows()[0]
    if (process.platform === 'darwin' && window) await installMacMenu(window)
  })
  ipcMain.handle(IPC_CHANNELS.loadExportTemplates, async () => {
    try {
      return parseExportTemplates(JSON.parse(await readFile(exportTemplatesPath(), 'utf8')))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        console.warn('Unable to read export presets', error)
      return parseExportTemplates(null)
    }
  })
  ipcMain.handle(IPC_CHANNELS.saveExportTemplates, async (_event, value: ExportTemplate[]) => {
    const templates = parseExportTemplates(value)
    const path = exportTemplatesPath()
    const temporaryPath = `${path}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(templates, null, 2)}\n`, 'utf8')
    await rename(temporaryPath, path)
  })
  ipcMain.handle(
    IPC_CHANNELS.exportLyrics,
    async (_event, content: string, extension: string, projectName: string) => {
      const safeExtension = extension.replace(/[^a-zA-Z0-9]/g, '') || 'txt'
      const result = await dialog.showSaveDialog({
        title: mt('导出歌词'),
        defaultPath: `${projectName || 'lyrics'}.${safeExtension}`,
        filters: [
          { name: `${safeExtension.toUpperCase()} ${mt('文件后缀')}`, extensions: [safeExtension] }
        ]
      })
      if (!result.filePath) return null
      const path = result.filePath.endsWith(`.${safeExtension}`)
        ? result.filePath
        : `${result.filePath}.${safeExtension}`
      await writeFile(path, content, 'utf8')
      return path
    }
  )
  ipcMain.handle(IPC_CHANNELS.selectAudio, async () => {
    const result = await dialog.showOpenDialog({
      title: mt('选择音频'),
      properties: ['openFile'],
      filters: [
        { name: mt('音频文件'), extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'opus'] },
        { name: mt('所有文件'), extensions: ['*'] }
      ]
    })

    const path = result.filePaths[0]
    if (result.canceled || !path) return null

    return registerAudio(path)
  })
  ipcMain.handle(IPC_CHANNELS.registerAudio, (_event, path: string) => registerAudio(path))
  ipcMain.handle(
    IPC_CHANNELS.saveProject,
    async (_event, project: LyricProject, existingPath?: string) => {
      let path = existingPath
      if (!path) {
        const result = await dialog.showSaveDialog({
          title: mt('保存工程'),
          defaultPath: `${project.name || 'Untitled Project'}.lyricproj`,
          filters: [{ name: 'Lyric Timeline 工程', extensions: ['lyricproj'] }]
        })
        path = result.filePath
      }
      if (!path) return null
      if (!path.endsWith('.lyricproj')) path += '.lyricproj'
      await atomicWrite(path, project)
      await unlink(join(app.getPath('userData'), 'autosave.lyricproj')).catch(() => undefined)
      await rememberProject(path, project.name)
      return { path, project, audio: null, audioMissing: false }
    }
  )
  ipcMain.handle(IPC_CHANNELS.openProject, async () => {
    const result = await dialog.showOpenDialog({
      title: mt('打开工程'),
      properties: ['openFile'],
      filters: [{ name: 'Lyric Timeline 工程', extensions: ['lyricproj'] }]
    })
    const path = result.filePaths[0]
    if (result.canceled || !path) return null
    const project = await readProject(path)
    await rememberProject(path, project.project.name)
    return project
  })
  ipcMain.handle(IPC_CHANNELS.autosaveProject, async (_event, project: LyricProject) => {
    await atomicWrite(join(app.getPath('userData'), 'autosave.lyricproj'), project)
  })
  ipcMain.handle(IPC_CHANNELS.loadAutosave, async () => {
    const path = join(app.getPath('userData'), 'autosave.lyricproj')
    try {
      return await readProject(path, null)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  })
  ipcMain.handle(IPC_CHANNELS.listRecentProjects, () => listRecentProjects())
  ipcMain.handle(IPC_CHANNELS.openRecentProject, (_event, path: string) => openRecentProject(path))
  ipcMain.handle(IPC_CHANNELS.loadLastProject, async () => {
    const [latest] = await listRecentProjects()
    return latest ? openRecentProject(latest.path) : null
  })
  ipcMain.on(IPC_CHANNELS.setProjectDirty, (_event, dirty: boolean) => {
    projectDirty = dirty
  })
  ipcMain.on(IPC_CHANNELS.confirmAppClose, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return
    projectDirty = false
    window.close()
  })
}

function createWindow(): void {
  const isMac = process.platform === 'darwin'
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Lyric Timeline',
    backgroundColor: '#101318',
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    ...(isMac ? { trafficLightPosition: { x: 14, y: 17 } } : {}),
    ...(isMac ? {} : { titleBarOverlay: { color: '#101318', symbolColor: '#aeb8c1', height: 46 } }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isMac) void installMacMenu(mainWindow)

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('close', (event) => {
    if (!projectDirty) return
    event.preventDefault()
    mainWindow.webContents.send(IPC_CHANNELS.requestAppClose)
  })
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

function sendMenuAction(window: BrowserWindow, action: string): void {
  window.webContents.send(IPC_CHANNELS.menuAction, action)
}

async function installMacMenu(window: BrowserWindow): Promise<void> {
  const recent = await listRecentProjects()
  const command = (action: string): MenuItemConstructorOptions => ({
    label: action,
    click: () => sendMenuAction(window, action)
  })
  const template: MenuItemConstructorOptions[] = [
    { role: 'appMenu' },
    {
      label: mt('文件'),
      submenu: [
        { ...command('newProject'), label: mt('新建'), accelerator: 'CmdOrCtrl+N' },
        { ...command('openProject'), label: mt('打开项目…'), accelerator: 'CmdOrCtrl+O' },
        {
          label: mt('最近项目'),
          submenu: recent.length
            ? recent.map((item) => ({
                label: item.name,
                click: () => sendMenuAction(window, `openRecent:${item.path}`)
              }))
            : [{ label: mt('暂无最近项目'), enabled: false }]
        },
        { type: 'separator' },
        { ...command('renameProject'), label: mt('重命名项目…') },
        { ...command('closeProject'), label: mt('关闭项目'), accelerator: 'CmdOrCtrl+W' },
        { ...command('saveProject'), label: mt('保存'), accelerator: 'CmdOrCtrl+S' },
        { ...command('saveHistory'), label: mt('查看保存记录') },
        { type: 'separator' },
        { ...command('selectAudio'), label: mt('导入歌曲…'), accelerator: 'CmdOrCtrl+Shift+O' },
        { ...command('importLyrics'), label: mt('导入歌词…'), accelerator: 'CmdOrCtrl+I' },
        { ...command('exportLyrics'), label: mt('导出…'), accelerator: 'CmdOrCtrl+E' }
      ]
    },
    {
      label: mt('编辑'),
      submenu: [
        { ...command('undo'), label: mt('撤销'), accelerator: 'CmdOrCtrl+Z' },
        { ...command('redo'), label: mt('重做'), accelerator: 'CmdOrCtrl+Shift+Z' },
        { type: 'separator' },
        {
          label: mt('播放与打轴'),
          submenu: [
            { ...command('playPause'), label: mt('播放 / 暂停') },
            { ...command('markToken'), label: mt('记录当前 Token') },
            { ...command('automaticTiming'), label: mt('智能打轴') },
            { ...command('toggleLoop'), label: mt('切换 Loop') },
            { ...command('toggleLyricsFollow'), label: mt('切换歌词跟随') },
            { ...command('toggleTimelineFollow'), label: mt('切换时间轴跟随') }
          ]
        },
        {
          label: mt('导航与微调'),
          submenu: [
            { ...command('previousToken'), label: mt('上一个 Token') },
            { ...command('nextToken'), label: mt('下一个 Token') },
            { ...command('previousLine'), label: mt('上一句') },
            { ...command('nextLine'), label: mt('下一句') },
            { ...command('locateToken'), label: mt('定位选中 Token') },
            { ...command('nudgeEarlierFine'), label: mt('向前微调 1 ms') },
            { ...command('nudgeLaterFine'), label: mt('向后微调 1 ms') },
            { ...command('nudgeEarlierCoarse'), label: mt('向前微调 50 ms') },
            { ...command('nudgeLaterCoarse'), label: mt('向后微调 50 ms') }
          ]
        },
        {
          label: mt('复制与 Token 结构'),
          submenu: [
            { ...command('copyLineTiming'), label: mt('复制整句时间') },
            { ...command('pasteLineTiming'), label: mt('粘贴整句时间') },
            { ...command('focusTokenSplit'), label: mt('拆分 Token') },
            { ...command('mergePreviousToken'), label: mt('合并前一个 Token') },
            { ...command('mergeNextToken'), label: mt('合并下一个 Token') }
          ]
        },
        {
          label: mt('时间轴'),
          submenu: [
            { ...command('tokenEditMode'), label: mt('Token 编辑模式') },
            { ...command('lineEditMode'), label: mt('整句编辑模式') },
            { ...command('toggleAdjacentLock'), label: mt('切换相邻锁定') },
            { ...command('zoomOut'), label: mt('缩小时间轴') },
            { ...command('zoomIn'), label: mt('放大时间轴') },
            { ...command('fitTimeline'), label: mt('适合时间轴') }
          ]
        },
        { type: 'separator' },
        { ...command('settings'), label: mt('快捷键与设置…'), accelerator: 'CmdOrCtrl+,' }
      ]
    },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.lyric-timeline.app')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  protocol.handle('lyric-audio', async (request) => {
    const url = new URL(request.url)
    const path = url.hostname === 'media' ? audioFiles.get(url.pathname.slice(1)) : undefined
    if (!path) return new Response(null, { status: 404 })

    try {
      return await createAudioResponse(path, request.headers.get('range'))
    } catch {
      return new Response(null, { status: 404 })
    }
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
