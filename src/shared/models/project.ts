export interface LyricToken {
  id: string
  text: string
  start: number | null
  end: number | null
}

export interface LyricLine {
  id: string
  text: string
  tokens: LyricToken[]
}

export interface AudioSource {
  path: string
  name: string
  duration: number | null
}

export interface ProjectMetadata {
  title: string
  artist: string
  album: string
}

export interface ProjectSettings {
  timingOffsetMs: number
  tokenizer: 'char' | 'word' | 'smart'
}

export interface LyricProject {
  version: 1
  id: string
  name: string
  audio: AudioSource | null
  metadata: ProjectMetadata
  lines: LyricLine[]
  settings: ProjectSettings
  createdAt: number
  updatedAt: number
}

export function createEmptyProject(now = Date.now()): LyricProject {
  return {
    version: 1,
    id: crypto.randomUUID(),
    name: 'Untitled Project',
    audio: null,
    metadata: { title: '', artist: '', album: '' },
    lines: [],
    settings: { timingOffsetMs: 0, tokenizer: 'smart' },
    createdAt: now,
    updatedAt: now
  }
}
