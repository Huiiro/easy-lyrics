import type { LyricLine, LyricToken, TokenizerMode } from '@shared/models/project'

export interface Tokenizer {
  tokenize(text: string): string[]
}

const spokenCharacterPattern = /[\p{L}\p{M}\p{N}]/u
const smartTokenPattern = /\p{Script=Han}|[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu
const boundaryPunctuationPattern = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu

export const charTokenizer: Tokenizer = {
  tokenize(text) {
    return Array.from(text).filter((character) => spokenCharacterPattern.test(character))
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
    return text.match(smartTokenPattern) ?? []
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
  return source
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text): LyricLine | null => {
      const tokenTexts = tokenizeLine(text, mode)
      if (tokenTexts.length === 0) return null

      const tokens: LyricToken[] = tokenTexts.map((tokenText) => ({
        id: createId(),
        text: tokenText,
        start: null,
        end: null
      }))

      return { id: createId(), text, tokens }
    })
    .filter((line): line is LyricLine => line !== null)
}
