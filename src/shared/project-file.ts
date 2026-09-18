import type { LyricProject, TokenizerMode } from './models/project'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNullableTime(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0)
}

export function parseProjectFile(value: unknown): LyricProject {
  if (!isRecord(value)) throw new Error('工程文件不是有效的 JSON 对象')
  if (value.version !== 1) {
    throw new Error(`不支持的工程版本：${String(value.version)}（当前支持 v1）`)
  }
  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.createdAt !== 'number' ||
    typeof value.updatedAt !== 'number' ||
    !isRecord(value.metadata) ||
    typeof value.metadata.title !== 'string' ||
    typeof value.metadata.artist !== 'string' ||
    typeof value.metadata.album !== 'string' ||
    !isRecord(value.settings) ||
    typeof value.settings.timingOffsetMs !== 'number' ||
    !['char', 'word', 'smart'].includes(value.settings.tokenizer as TokenizerMode) ||
    !Array.isArray(value.lines)
  ) {
    throw new Error('工程文件缺少必要字段或字段类型错误')
  }
  if (
    value.audio !== null &&
    (!isRecord(value.audio) ||
      typeof value.audio.path !== 'string' ||
      typeof value.audio.name !== 'string' ||
      !isNullableTime(value.audio.duration))
  ) {
    throw new Error('工程中的音频信息无效')
  }
  for (const line of value.lines) {
    if (
      !isRecord(line) ||
      typeof line.id !== 'string' ||
      typeof line.text !== 'string' ||
      !Array.isArray(line.tokens)
    ) {
      throw new Error('工程中的歌词行无效')
    }
    for (const token of line.tokens) {
      if (
        !isRecord(token) ||
        typeof token.id !== 'string' ||
        typeof token.text !== 'string' ||
        !isNullableTime(token.start) ||
        !isNullableTime(token.end) ||
        (token.start !== null && token.end !== null && token.start > token.end)
      ) {
        throw new Error('工程中的 Token 时间无效')
      }
    }
  }
  return structuredClone(value) as unknown as LyricProject
}
