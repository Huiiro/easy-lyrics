export const IPC_CHANNELS = {
  ping: 'app:ping',
  selectAudio: 'audio:select'
} as const

export interface AudioFileSelection {
  path: string
  name: string
  url: string
}

export interface DesktopApi {
  ping: () => Promise<string>
  selectAudio: () => Promise<AudioFileSelection | null>
}
