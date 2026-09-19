import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { access, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

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
import type { RecentProject, SaveHistoryEntry, WindowLaunchPayload } from '../shared/ipc'
import { parseProjectFile } from '../shared/project-file'
import type { LyricProject } from '../shared/models/project'
import { parseExportTemplates, type ExportTemplate } from '../shared/export'
import { parseRecentProjects, prioritizeRecentProject } from '../shared/recent-projects'
import { addSaveHistoryEntry, parseSaveHistory } from '../shared/save-history'
import {
  LYRIC_TIMELINE_PROTOCOL,
  parsePlayerSongPayload,
  payloadPathFromUrl
} from '../shared/integration'
import type { IntegrationOpenResult } from '../shared/ipc'
import enUS from '../shared/i18n/locales/en-US'
import zhCN from '../shared/i18n/locales/zh-CN'

const audioFiles = new Map<string, string>()
const dirtyWindows = new Map<number, boolean>()
const claimedAutosaves = new Map<number, string>()
const windowLaunchPayloads = new Map<number, WindowLaunchPayload>()
let saveHistoryQueue = Promise.resolve()
let pendingIntegration: IntegrationOpenResult | null = null
let menuShortcuts: Record<string, string> = {}
let currentLocale: 'zh-CN' | 'en-US' = Intl.DateTimeFormat()
  .resolvedOptions()
  .locale.toLowerCase()
  .startsWith('zh')
  ? 'zh-CN'
  : 'en-US'

const mainMessages = { 'zh-CN': zhCN, 'en-US': enUS }

function mt(key: string): string {
  return mainMessages[currentLocale][key] ?? key
}

function recentProjectsPath(): string {
  return join(app.getPath('userData'), 'recent-projects.json')
}

function exportTemplatesPath(): string {
  return join(app.getPath('userData'), 'export-presets.json')
}

function autosavesPath(): string {
  return join(app.getPath('userData'), 'autosaves')
}

function autosavePrefix(projectId: string): string {
  return createHash('sha256').update(projectId).digest('hex')
}

function autosavePath(projectId: string, windowSessionId: string): string {
  const sessionKey = createHash('sha256').update(windowSessionId).digest('hex')
  return join(autosavesPath(), `${autosavePrefix(projectId)}-${sessionKey}.lyricproj`)
}

async function clearWindowAutosave(
  projectId: string,
  windowSessionId: string,
  webContentsId: number
): Promise<void> {
  const paths = [
    autosavePath(projectId, windowSessionId),
    claimedAutosaves.get(webContentsId)
  ].filter((path): path is string => Boolean(path))
  await Promise.all(paths.map((path) => unlink(path).catch(() => undefined)))
  claimedAutosaves.delete(webContentsId)
}

function saveHistoryPath(): string {
  return join(app.getPath('userData'), 'save-history.json')
}

function saveArchivesPath(projectId: string): string {
  return join(app.getPath('userData'), 'save-archives', autosavePrefix(projectId))
}

function saveArchivePath(projectId: string, entryId: string): string {
  const entryKey = createHash('sha256').update(entryId).digest('hex')
  return join(saveArchivesPath(projectId), `${entryKey}.lyricproj`)
}

async function readSaveHistory(): Promise<SaveHistoryEntry[]> {
  try {
    return parseSaveHistory(JSON.parse(await readFile(saveHistoryPath(), 'utf8')))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      console.warn('Unable to read save history', error)
    return []
  }
}

async function recordSave(
  project: LyricProject,
  path: string,
  kind: SaveHistoryEntry['kind'] = 'manual'
): Promise<void> {
  const operation = saveHistoryQueue
    .catch(() => undefined)
    .then(async () => {
      const entry: SaveHistoryEntry = {
        id: crypto.randomUUID(),
        projectId: project.id,
        projectName: project.name,
        path,
        savedAt: Date.now(),
        archiveAvailable: true,
        kind
      }
      await mkdir(saveArchivesPath(project.id), { recursive: true })
      await atomicWrite(saveArchivePath(project.id, entry.id), project)
      const previous = await readSaveHistory()
      const next = addSaveHistoryEntry(previous, entry)
      const temporaryPath = `${saveHistoryPath()}.${crypto.randomUUID()}.tmp`
      await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
      await rename(temporaryPath, saveHistoryPath())
      const retainedIds = new Set(next.map((item) => item.id))
      await Promise.all(
        previous
          .filter((item) => item.archiveAvailable && !retainedIds.has(item.id))
          .map((item) => unlink(saveArchivePath(item.projectId, item.id)).catch(() => undefined))
      )
    })
  saveHistoryQueue = operation
  await operation
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
  for (const target of BrowserWindow.getAllWindows())
    target.webContents.send(IPC_CHANNELS.recentProjectsChanged)
}

async function forgetProject(path: string): Promise<void> {
  await writeRecentProjects((await listRecentProjects()).filter((project) => project.path !== path))
  const window = BrowserWindow.getAllWindows()[0]
  if (process.platform === 'darwin' && window) void installMacMenu(window)
  for (const target of BrowserWindow.getAllWindows())
    target.webContents.send(IPC_CHANNELS.recentProjectsChanged)
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
  const temporaryPath = `${path}.${crypto.randomUUID()}.tmp`
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

// Some Windows graphics drivers terminate Electron before the first window is
// shown. This editor does not rely on GPU rendering, so prefer a reliable
// software-rendered startup on Windows.
if (process.platform === 'win32') app.disableHardwareAcceleration()

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.ping, () => 'pong')
  ipcMain.handle(IPC_CHANNELS.appVersion, () => app.getVersion())
  ipcMain.on(IPC_CHANNELS.setShortcuts, (_event, shortcuts: Record<string, string>) => {
    menuShortcuts = { ...shortcuts }
    const window = BrowserWindow.getAllWindows()[0]
    if (process.platform === 'darwin' && window) void installMacMenu(window)
  })
  ipcMain.handle(IPC_CHANNELS.integrationTakePending, () => {
    const request = pendingIntegration
    pendingIntegration = null
    return request
  })
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
        title: mt('export_lyrics'),
        defaultPath: `${projectName || 'lyrics'}.${safeExtension}`,
        filters: [
          { name: `${safeExtension.toUpperCase()} ${mt('files')}`, extensions: [safeExtension] }
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
      title: mt('select_audio'),
      properties: ['openFile'],
      filters: [
        {
          name: mt('audio_files'),
          extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'opus']
        },
        { name: mt('all_files'), extensions: ['*'] }
      ]
    })

    const path = result.filePaths[0]
    if (result.canceled || !path) return null

    return registerAudio(path)
  })
  ipcMain.handle(IPC_CHANNELS.registerAudio, (_event, path: string) => registerAudio(path))
  ipcMain.handle(
    IPC_CHANNELS.saveProject,
    async (
      event,
      project: LyricProject,
      existingPath: string | undefined,
      windowSessionId: string
    ) => {
      let path = existingPath
      if (!path) {
        const result = await dialog.showSaveDialog({
          title: mt('save_project'),
          defaultPath: `${project.name || 'untitled_project'}.lyricproj`,
          filters: [{ name: 'Lyric Timeline 工程', extensions: ['lyricproj'] }]
        })
        path = result.filePath
      }
      if (!path) return null
      if (!path.endsWith('.lyricproj')) path += '.lyricproj'
      await atomicWrite(path, project)
      await clearWindowAutosave(project.id, windowSessionId, event.sender.id)
      await recordSave(project, path, 'manual')
      await rememberProject(path, project.name)
      return { path, project, audio: null, audioMissing: false }
    }
  )
  ipcMain.handle(IPC_CHANNELS.openProject, async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: mt('open_project'),
      properties: ['openFile'],
      filters: [{ name: 'Lyric Timeline 工程', extensions: ['lyricproj'] }]
    }
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options)
    const path = result.filePaths[0]
    if (result.canceled || !path) return null
    const project = await readProject(path)
    await rememberProject(path, project.project.name)
    return project
  })
  ipcMain.handle(
    IPC_CHANNELS.autosaveProject,
    async (_event, project: LyricProject, windowSessionId: string, projectPath?: string) => {
      await mkdir(autosavesPath(), { recursive: true })
      await atomicWrite(autosavePath(project.id, windowSessionId), project)
      await recordSave(project, projectPath ?? '', 'autosave')
    }
  )
  ipcMain.handle(IPC_CHANNELS.loadAutosave, async (event) => {
    try {
      await mkdir(autosavesPath(), { recursive: true })
      const candidates = (await readdir(autosavesPath()))
        .filter((name) => name.endsWith('.lyricproj'))
        .map((name) => join(autosavesPath(), name))
        .filter((path) => !new Set(claimedAutosaves.values()).has(path))
      const legacyPath = join(app.getPath('userData'), 'autosave.lyricproj')
      try {
        await access(legacyPath)
        if (![...claimedAutosaves.values()].includes(legacyPath)) candidates.push(legacyPath)
      } catch {
        // No legacy autosave exists.
      }
      const dated = await Promise.all(
        candidates.map(async (path) => ({ path, time: (await stat(path)).mtimeMs }))
      )
      dated.sort((left, right) => right.time - left.time)
      if (!dated[0]) return null
      const result = await readProject(dated[0].path, null)
      claimedAutosaves.set(event.sender.id, dated[0].path)
      return result
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  })
  ipcMain.handle(
    IPC_CHANNELS.clearAutosave,
    async (event, projectId: string, windowSessionId: string) =>
      clearWindowAutosave(projectId, windowSessionId, event.sender.id)
  )
  ipcMain.handle(
    IPC_CHANNELS.listSaveHistory,
    async (_event, projectId: string, projectPath?: string) =>
      (await readSaveHistory()).filter(
        (entry) =>
          entry.projectId === projectId || Boolean(projectPath && entry.path === projectPath)
      )
  )
  ipcMain.handle(IPC_CHANNELS.loadSaveHistoryEntry, async (_event, entryId: string) => {
    const entry = (await readSaveHistory()).find(
      (item) => item.id === entryId && item.archiveAvailable
    )
    if (!entry) return null
    try {
      return await readProject(saveArchivePath(entry.projectId, entryId), null)
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
  ipcMain.handle(IPC_CHANNELS.createProjectWindow, () => {
    createWindow({ type: 'new' })
  })
  ipcMain.handle(IPC_CHANNELS.openProjectInNewWindow, async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: mt('open_project'),
      properties: ['openFile'],
      filters: [{ name: 'Lyric Timeline 工程', extensions: ['lyricproj'] }]
    }
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options)
    const path = result.filePaths[0]
    if (result.canceled || !path) return false
    const project = await readProject(path)
    await rememberProject(path, project.project.name)
    createWindow({ type: 'project', result: project })
    return true
  })
  ipcMain.handle(IPC_CHANNELS.openRecentProjectInNewWindow, async (_event, path: string) => {
    const project = await openRecentProject(path)
    if (!project) return false
    createWindow({ type: 'project', result: project })
    return true
  })
  ipcMain.handle(IPC_CHANNELS.takeWindowLaunch, (event) => {
    const payload = windowLaunchPayloads.get(event.sender.id) ?? null
    windowLaunchPayloads.delete(event.sender.id)
    return payload
  })
  ipcMain.on(IPC_CHANNELS.setProjectDirty, (_event, dirty: boolean) => {
    dirtyWindows.set(_event.sender.id, dirty)
  })
  ipcMain.on(IPC_CHANNELS.confirmAppClose, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return
    dirtyWindows.set(event.sender.id, false)
    window.close()
  })
}

async function acceptIntegrationUrl(rawUrl: string): Promise<void> {
  const payloadPath = payloadPathFromUrl(rawUrl)
  if (
    !payloadPath ||
    !isAbsolute(payloadPath) ||
    resolve(dirname(payloadPath)) !== resolve(tmpdir()) ||
    !/^lyric-timeline-[\da-f-]+\.json$/iu.test(basename(payloadPath))
  )
    return
  try {
    const stat = await import('node:fs/promises').then(({ stat }) => stat(payloadPath))
    if (stat.size > 2_000_000) throw new Error('Player payload is too large')
    const payload = parsePlayerSongPayload(JSON.parse(await readFile(payloadPath, 'utf8')))
    const audio = await registerAudio(payload.audioPath)
    if (!audio) throw new Error('Player audio file is unavailable')
    const request = { payload, audio }
    const window = BrowserWindow.getAllWindows()[0]
    if (window && !window.webContents.isLoading()) {
      window.webContents.send(IPC_CHANNELS.integrationOpen, request)
      if (window.isMinimized()) window.restore()
      window.show()
      window.focus()
    } else {
      pendingIntegration = request
    }
  } catch (error) {
    console.warn('Unable to open player song', error)
  } finally {
    await unlink(payloadPath).catch(() => undefined)
  }
}

function integrationUrlFromArgs(args: string[]): string | undefined {
  return args.find((arg) => arg.startsWith(`${LYRIC_TIMELINE_PROTOCOL}://`))
}

function createWindow(launchPayload?: WindowLaunchPayload): BrowserWindow {
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
  if (launchPayload) windowLaunchPayloads.set(mainWindow.webContents.id, launchPayload)

  if (isMac) void installMacMenu(mainWindow)

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('close', (event) => {
    if (!dirtyWindows.get(mainWindow.webContents.id)) return
    event.preventDefault()
    mainWindow.webContents.send(IPC_CHANNELS.requestAppClose)
  })
  mainWindow.webContents.on('destroyed', () => {
    dirtyWindows.delete(mainWindow.webContents.id)
    claimedAutosaves.delete(mainWindow.webContents.id)
    windowLaunchPayloads.delete(mainWindow.webContents.id)
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
  return mainWindow
}

function sendMenuAction(window: BrowserWindow, action: string): void {
  const target = BrowserWindow.getFocusedWindow() ?? window
  target.webContents.send(IPC_CHANNELS.menuAction, action)
}

async function installMacMenu(window: BrowserWindow): Promise<void> {
  const recent = await listRecentProjects()
  const accelerator = (action: string): string | undefined => {
    const value = menuShortcuts[action]
    if (!value) return undefined
    return value
      .replace('Mod', 'CmdOrCtrl')
      .replace('ArrowLeft', 'Left')
      .replace('ArrowRight', 'Right')
      .replace('ArrowUp', 'Up')
      .replace('ArrowDown', 'Down')
  }
  const command = (action: string): MenuItemConstructorOptions => ({
    label: action,
    accelerator: accelerator(action),
    registerAccelerator: false,
    click: () => sendMenuAction(window, action)
  })
  const template: MenuItemConstructorOptions[] = [
    { role: 'appMenu' },
    {
      label: mt('file'),
      submenu: [
        {
          ...command('newProject'),
          label: mt('new'),
          accelerator: 'CmdOrCtrl+N',
          registerAccelerator: true
        },
        { ...command('openProject'), label: mt('open_project_dialog') },
        {
          label: mt('recent_projects'),
          submenu: recent.length
            ? recent.map((item) => ({
                label: item.name,
                click: () => sendMenuAction(window, `openRecent:${item.path}`)
              }))
            : [{ label: mt('no_recent_projects_alternate'), enabled: false }]
        },
        { type: 'separator' },
        { ...command('renameProject'), label: mt('rename_project_dialog') },
        {
          ...command('closeProject'),
          label: mt('close_project'),
          accelerator: 'CmdOrCtrl+W',
          registerAccelerator: true
        },
        { ...command('saveProject'), label: mt('save') },
        { ...command('saveHistory'), label: mt('view_save_history') },
        { type: 'separator' },
        { ...command('selectAudio'), label: mt('import_audio_dialog') },
        { ...command('importLyrics'), label: mt('import_lyrics_dialog') },
        { ...command('exportLyrics'), label: mt('export_dialog') }
      ]
    },
    {
      label: mt('edit'),
      submenu: [
        { ...command('undo'), label: mt('undo') },
        { ...command('redo'), label: mt('redo') },
        { type: 'separator' },
        { role: 'cut', label: mt('cut') },
        { role: 'copy', label: mt('copy') },
        { role: 'paste', label: mt('paste') },
        { role: 'selectAll', label: mt('select_all') },
        { type: 'separator' },
        {
          label: mt('playback_timing'),
          submenu: [
            { ...command('playPause'), label: mt('play_pause') },
            { ...command('markToken'), label: mt('mark_current_token') },
            { ...command('automaticTiming'), label: mt('auto_timing') },
            { ...command('toggleLoop'), label: mt('toggle_loop') },
            { ...command('toggleLyricsFollow'), label: mt('toggle_lyrics_follow') },
            { ...command('toggleTimelineFollow'), label: mt('toggle_timeline_follow') }
          ]
        },
        {
          label: mt('navigation_nudge'),
          submenu: [
            { ...command('previousToken'), label: mt('previous_token') },
            { ...command('nextToken'), label: mt('next_token') },
            { ...command('previousLine'), label: mt('previous_line') },
            { ...command('nextLine'), label: mt('next_line') },
            { ...command('locateToken'), label: mt('locate_selected_token') },
            { ...command('nudgeEarlierFine'), label: mt('nudge_earlier_1_ms') },
            { ...command('nudgeLaterFine'), label: mt('nudge_later_1_ms') },
            { ...command('nudgeEarlierCoarse'), label: mt('nudge_earlier_50_ms') },
            { ...command('nudgeLaterCoarse'), label: mt('nudge_later_50_ms') }
          ]
        },
        {
          label: mt('copy_token_structure'),
          submenu: [
            { ...command('copyLineTiming'), label: mt('copy_line_timing') },
            { ...command('pasteLineTiming'), label: mt('paste_line_timing') },
            { ...command('preprocessLyrics'), label: mt('lyrics_preprocessing') },
            { ...command('focusTokenSplit'), label: mt('split_token') },
            { ...command('mergePreviousToken'), label: mt('merge_previous_token') },
            { ...command('mergeNextToken'), label: mt('merge_next_token') }
          ]
        },
        {
          label: mt('timeline'),
          submenu: [
            { ...command('tokenEditMode'), label: mt('token_edit_mode') },
            { ...command('lineEditMode'), label: mt('line_edit_mode') },
            { ...command('toggleAdjacentLock'), label: mt('toggle_adjacent_lock') },
            { ...command('zoomOut'), label: mt('zoom_out') },
            { ...command('zoomIn'), label: mt('zoom_in') },
            { ...command('fitTimeline'), label: mt('fit_timeline') }
          ]
        },
        { type: 'separator' },
        {
          ...command('settings'),
          label: mt('shortcuts_settings'),
          accelerator: 'CmdOrCtrl+,',
          registerAccelerator: true
        }
      ]
    },
    { role: 'windowMenu' },
    {
      label: mt('help'),
      role: 'help',
      submenu: [{ label: `${mt('version')} ${app.getVersion()}`, enabled: false }]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) app.quit()

app.on('second-instance', (_event, argv) => {
  const url = integrationUrlFromArgs(argv)
  if (url) void acceptIntegrationUrl(url)
})
app.on('open-url', (event, url) => {
  event.preventDefault()
  void acceptIntegrationUrl(url)
})

app.whenReady().then(() => {
  if (!hasSingleInstanceLock) return
  electronApp.setAppUserModelId('com.lyric-timeline.app')
  let protocolRegistered: boolean
  if (is.dev && process.defaultApp && process.argv[1]) {
    protocolRegistered = app.setAsDefaultProtocolClient(LYRIC_TIMELINE_PROTOCOL, process.execPath, [
      resolve(process.argv[1])
    ])
  } else {
    protocolRegistered = app.setAsDefaultProtocolClient(LYRIC_TIMELINE_PROTOCOL)
  }
  if (!protocolRegistered)
    console.warn(`Unable to register ${LYRIC_TIMELINE_PROTOCOL}:// URL protocol`)
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
  const startupUrl = integrationUrlFromArgs(process.argv)
  if (startupUrl) void acceptIntegrationUrl(startupUrl)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
