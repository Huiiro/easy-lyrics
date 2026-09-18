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
  selectAudio: () => ipcRenderer.invoke(IPC_CHANNELS.selectAudio),
  registerAudio: (path) => ipcRenderer.invoke(IPC_CHANNELS.registerAudio, path),
  saveProject: (project, path) => ipcRenderer.invoke(IPC_CHANNELS.saveProject, project, path),
  openProject: () => ipcRenderer.invoke(IPC_CHANNELS.openProject),
  autosaveProject: (project) => ipcRenderer.invoke(IPC_CHANNELS.autosaveProject, project),
  loadAutosave: () => ipcRenderer.invoke(IPC_CHANNELS.loadAutosave),
  listRecentProjects: () => ipcRenderer.invoke(IPC_CHANNELS.listRecentProjects),
  openRecentProject: (path) => ipcRenderer.invoke(IPC_CHANNELS.openRecentProject, path),
  loadLastProject: () => ipcRenderer.invoke(IPC_CHANNELS.loadLastProject),
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
  setLocale: (locale) => ipcRenderer.invoke(IPC_CHANNELS.setLocale, locale)
}

contextBridge.exposeInMainWorld('desktopApi', desktopApi)
