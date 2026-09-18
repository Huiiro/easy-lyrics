import type { LyricProject } from './models/project'
import type { ExportTemplate } from './export'
import type { PlayerSongPayload } from './integration'

export const IPC_CHANNELS = {
  ping: 'app:ping',
  selectAudio: 'audio:select',
  registerAudio: 'audio:register',
  saveProject: 'project:save',
  openProject: 'project:open',
  autosaveProject: 'project:autosave',
  loadAutosave: 'project:load-autosave',
  listRecentProjects: 'project:list-recent',
  openRecentProject: 'project:open-recent',
  loadLastProject: 'project:load-last',
  setProjectDirty: 'project:set-dirty',
  requestAppClose: 'app:request-close',
  confirmAppClose: 'app:confirm-close',
  exportLyrics: 'lyrics:export',
  loadExportTemplates: 'export-templates:load',
  saveExportTemplates: 'export-templates:save',
  setLocale: 'app:set-locale',
  menuAction: 'menu:action',
  integrationTakePending: 'integration:take-pending',
  integrationOpen: 'integration:open'
} as const

export interface AudioFileSelection {
  path: string
  name: string
  url: string
}

export interface DesktopApi {
  platform:
    | 'aix'
    | 'android'
    | 'darwin'
    | 'freebsd'
    | 'haiku'
    | 'linux'
    | 'openbsd'
    | 'sunos'
    | 'win32'
    | 'cygwin'
    | 'netbsd'
  onMenuAction: (listener: (action: string) => void) => () => void
  ping: () => Promise<string>
  selectAudio: () => Promise<AudioFileSelection | null>
  registerAudio: (path: string) => Promise<AudioFileSelection | null>
  saveProject: (project: LyricProject, path?: string) => Promise<ProjectFileResult | null>
  openProject: () => Promise<ProjectFileResult | null>
  autosaveProject: (project: LyricProject) => Promise<void>
  loadAutosave: () => Promise<ProjectFileResult | null>
  listRecentProjects: () => Promise<RecentProject[]>
  openRecentProject: (path: string) => Promise<ProjectFileResult | null>
  loadLastProject: () => Promise<ProjectFileResult | null>
  setProjectDirty: (dirty: boolean) => void
  onAppCloseRequested: (listener: () => void) => () => void
  confirmAppClose: () => void
  exportLyrics: (content: string, extension: string, projectName: string) => Promise<string | null>
  loadExportTemplates: () => Promise<ExportTemplate[]>
  saveExportTemplates: (templates: ExportTemplate[]) => Promise<void>
  setLocale: (locale: 'zh-CN' | 'en-US') => Promise<void>
  takePendingIntegration: () => Promise<IntegrationOpenResult | null>
  onIntegrationOpen: (listener: (request: IntegrationOpenResult) => void) => () => void
}

export interface IntegrationOpenResult {
  payload: PlayerSongPayload
  audio: AudioFileSelection
}

export interface RecentProject {
  path: string
  name: string
  lastOpenedAt: number
}

export interface ProjectFileResult {
  path: string | null
  project: LyricProject
  audio: AudioFileSelection | null
  audioMissing: boolean
}
