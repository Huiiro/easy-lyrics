import { contextBridge, ipcRenderer } from 'electron'

import type { DesktopApi } from '../shared/ipc'
import { IPC_CHANNELS } from '../shared/ipc'

const desktopApi: DesktopApi = {
  platform: process.platform,
  onMenuAction: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, action: string): void => listener(action)
    ipcRenderer.on(IPC_CHANNELS.menuAction, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.menuAction, handler)
  },
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.ping) as Promise<string>,
  getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.appVersion),
  selectAudio: () => ipcRenderer.invoke(IPC_CHANNELS.selectAudio),
  registerAudio: (path) => ipcRenderer.invoke(IPC_CHANNELS.registerAudio, path),
  saveProject: (project, path, windowSessionId) =>
    ipcRenderer.invoke(IPC_CHANNELS.saveProject, project, path, windowSessionId),
  openProject: () => ipcRenderer.invoke(IPC_CHANNELS.openProject),
  autosaveProject: (project, windowSessionId, projectPath) =>
    ipcRenderer.invoke(IPC_CHANNELS.autosaveProject, project, windowSessionId, projectPath),
  loadAutosave: () => ipcRenderer.invoke(IPC_CHANNELS.loadAutosave),
  clearAutosave: (projectId, windowSessionId) =>
    ipcRenderer.invoke(IPC_CHANNELS.clearAutosave, projectId, windowSessionId),
  listSaveHistory: (projectId, projectPath) =>
    ipcRenderer.invoke(IPC_CHANNELS.listSaveHistory, projectId, projectPath),
  loadSaveHistoryEntry: (entryId) => ipcRenderer.invoke(IPC_CHANNELS.loadSaveHistoryEntry, entryId),
  listRecentProjects: () => ipcRenderer.invoke(IPC_CHANNELS.listRecentProjects),
  openRecentProject: (path) => ipcRenderer.invoke(IPC_CHANNELS.openRecentProject, path),
  loadLastProject: () => ipcRenderer.invoke(IPC_CHANNELS.loadLastProject),
  createProjectWindow: () => ipcRenderer.invoke(IPC_CHANNELS.createProjectWindow),
  openProjectInNewWindow: () => ipcRenderer.invoke(IPC_CHANNELS.openProjectInNewWindow),
  openRecentProjectInNewWindow: (path) =>
    ipcRenderer.invoke(IPC_CHANNELS.openRecentProjectInNewWindow, path),
  takeWindowLaunch: () => ipcRenderer.invoke(IPC_CHANNELS.takeWindowLaunch),
  onRecentProjectsChanged: (listener) => {
    const handler = (): void => listener()
    ipcRenderer.on(IPC_CHANNELS.recentProjectsChanged, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.recentProjectsChanged, handler)
  },
  setProjectDirty: (dirty) => ipcRenderer.send(IPC_CHANNELS.setProjectDirty, dirty),
  onAppCloseRequested: (listener) => {
    const handler = (): void => listener()
    ipcRenderer.on(IPC_CHANNELS.requestAppClose, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.requestAppClose, handler)
  },
  confirmAppClose: () => ipcRenderer.send(IPC_CHANNELS.confirmAppClose),
  exportLyrics: (content, extension, projectName) =>
    ipcRenderer.invoke(IPC_CHANNELS.exportLyrics, content, extension, projectName),
  loadExportTemplates: () => ipcRenderer.invoke(IPC_CHANNELS.loadExportTemplates),
  saveExportTemplates: (templates) =>
    ipcRenderer.invoke(IPC_CHANNELS.saveExportTemplates, templates),
  setLocale: (locale) => ipcRenderer.invoke(IPC_CHANNELS.setLocale, locale),
  setShortcuts: (shortcuts) => ipcRenderer.send(IPC_CHANNELS.setShortcuts, shortcuts),
  takePendingIntegration: () => ipcRenderer.invoke(IPC_CHANNELS.integrationTakePending),
  onIntegrationOpen: (listener) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      request: Parameters<typeof listener>[0]
    ): void => listener(request)
    ipcRenderer.on(IPC_CHANNELS.integrationOpen, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.integrationOpen, handler)
  }
}

contextBridge.exposeInMainWorld('desktopApi', desktopApi)
