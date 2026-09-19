import type { SaveHistoryEntry } from './ipc'

export function parseSaveHistory(value: unknown): SaveHistoryEntry[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof item.id !== 'string' ||
      typeof item.projectId !== 'string' ||
      typeof item.projectName !== 'string' ||
      typeof item.path !== 'string' ||
      typeof item.savedAt !== 'number' ||
      !Number.isFinite(item.savedAt)
    ) {
      return []
    }
    return [
      {
        id: item.id,
        projectId: item.projectId,
        projectName: item.projectName,
        path: item.path,
        savedAt: item.savedAt,
        archiveAvailable: item.archiveAvailable === true,
        kind: item.kind === 'autosave' ? 'autosave' : 'manual'
      }
    ]
  })
}

export function addSaveHistoryEntry(
  entries: SaveHistoryEntry[],
  entry: SaveHistoryEntry,
  maximum = 500
): SaveHistoryEntry[] {
  return [entry, ...entries].sort((left, right) => right.savedAt - left.savedAt).slice(0, maximum)
}
