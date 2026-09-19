import type { LyricLine, LyricToken, TokenizerMode } from '@shared/models/project'

export interface Tokenizer {
  tokenize(text: string): string[]
}

const spokenCharacterPattern = /[\p{L}\p{M}\p{N}]/u
const boundaryPunctuationPattern = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu
const karaokeCharacterPattern = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u
const japaneseContinuationPattern = /^[ぁぃぅぇぉゃゅょゎァィゥェォャュョヮヵヶー]$/u
const lrcTimestampPattern = /\[(\d+):([0-5]?\d)(?:[.:](\d{1,3}))?\]/gu
const lrcMetadataPattern = /^\[(?:ar|al|ti|au|by|offset|re|ve|length):.*\]$/iu

export interface ParsedLyricSourceLine {
  text: string
  start: number | null
}

function timestampToSeconds(minutes: string, seconds: string, fraction = ''): number {
  const fractionSeconds = fraction ? Number(fraction) / 10 ** fraction.length : 0
  return Number(minutes) * 60 + Number(seconds) + fractionSeconds
}

export function segmentGraphemes(text: string): string[] {
  return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (item) =>
    item.segment
  )
}

function splitKaraokeSegment(segment: string): string[] {
  const graphemes = segmentGraphemes(segment)
  if (!graphemes.some((item) => karaokeCharacterPattern.test(item))) return [segment]

  const tokens: string[] = []
  let buffered = ''
  const flush = (): void => {
    if (buffered) tokens.push(buffered)
    buffered = ''
  }
  for (const grapheme of graphemes) {
    if (karaokeCharacterPattern.test(grapheme)) {
      flush()
      if (japaneseContinuationPattern.test(grapheme) && tokens.length) {
        tokens[tokens.length - 1] += grapheme
      } else {
        tokens.push(grapheme)
      }
    } else if (spokenCharacterPattern.test(grapheme)) {
      buffered += grapheme
    } else {
      flush()
    }
  }
  flush()
  return tokens
}

export function parseLyricSource(source: string): ParsedLyricSourceLine[] {
  return source
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .flatMap((rawLine): ParsedLyricSourceLine[] => {
      const line = rawLine.trim().replace(/^\uFEFF/u, '')
      if (!line || lrcMetadataPattern.test(line)) return []

      const starts = Array.from(line.matchAll(lrcTimestampPattern), (match) =>
        timestampToSeconds(match[1] ?? '0', match[2] ?? '0', match[3])
      )
      const text = line.replace(lrcTimestampPattern, '').trim()
      if (!text) return []
      if (starts.length === 0) return [{ text, start: null }]
      return starts.map((start) => ({ text, start }))
    })
}

export const charTokenizer: Tokenizer = {
  tokenize(text) {
    return segmentGraphemes(text).filter((character) => spokenCharacterPattern.test(character))
  }
}

export const wordTokenizer: Tokenizer = {
  tokenize(text) {
    return text
      .trim()
      .split(/\s+/u)
      .map((token) => token.replace(boundaryPunctuationPattern, ''))
      .filter(Boolean)
  }
}

export const smartTokenizer: Tokenizer = {
  tokenize(text) {
    const segments = new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text)
    return Array.from(segments).flatMap((segment) =>
      segment.isWordLike ? splitKaraokeSegment(segment.segment) : []
    )
  }
}

const tokenizers: Record<TokenizerMode, Tokenizer> = {
  char: charTokenizer,
  word: wordTokenizer,
  smart: smartTokenizer
}

export function tokenizeLine(text: string, mode: TokenizerMode): string[] {
  return tokenizers[mode].tokenize(text)
}

export function createLyricLines(
  source: string,
  mode: TokenizerMode,
  createId: () => string = () => crypto.randomUUID()
): LyricLine[] {
  return parseLyricSource(source)
    .map(({ text, start }): LyricLine | null => {
      const tokenTexts = tokenizeLine(text, mode)
      if (tokenTexts.length === 0) return null

      const tokens: LyricToken[] = tokenTexts.map((tokenText, index) => ({
        id: createId(),
        text: tokenText,
        start: index === 0 ? start : null,
        end: null
      }))

      return { id: createId(), text, tokens }
    })
    .filter((line): line is LyricLine => line !== null)
}

export function lyricLinesToSource(lines: LyricLine[]): string {
  return lines
    .map((line) => {
      const start = line.tokens.find((token) => token.start !== null)?.start ?? null
      if (start === null) return line.text
      const milliseconds = Math.round(start * 1000)
      const minutes = Math.floor(milliseconds / 60_000)
      const seconds = Math.floor((milliseconds % 60_000) / 1000)
      const fraction = milliseconds % 1000
      return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(fraction).padStart(3, '0')}]${line.text}`
    })
    .join('\n')
}
