export const IPC_CHANNELS = {
  ping: 'app:ping'
} as const

export interface DesktopApi {
  ping: () => Promise<string>
}
