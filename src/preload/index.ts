import { contextBridge, ipcRenderer } from 'electron'

import type { DesktopApi } from '../shared/ipc'
import { IPC_CHANNELS } from '../shared/ipc'

const desktopApi: DesktopApi = {
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.ping) as Promise<string>
}

contextBridge.exposeInMainWorld('desktopApi', desktopApi)
