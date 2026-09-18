import type { LyricLine } from '@shared/models/project'

/**
 * Reattaches whitespace and punctuation omitted by the timing tokenizer.
 * Each untimed fragment follows the previous spoken token where possible, so
 * the rendered pieces still concatenate to the exact source lyric.
 */
export function lyricTokenDisplayTexts(line: LyricLine): string[] {
  if (line.tokens.length === 0) return []
  const result: string[] = []
  let cursor = 0

  line.tokens.forEach((token, index) => {
    const tokenStart = line.text.indexOf(token.text, cursor)
    if (tokenStart < 0) {
      result.push(token.text)
      return
    }

    const tokenEnd = tokenStart + token.text.length
    const nextToken = line.tokens[index + 1]
    const nextStart = nextToken ? line.text.indexOf(nextToken.text, tokenEnd) : line.text.length
    const displayEnd = nextStart >= tokenEnd ? nextStart : tokenEnd
    result.push(line.text.slice(cursor, displayEnd))
    cursor = displayEnd
  })

  if (cursor < line.text.length) result[result.length - 1] += line.text.slice(cursor)
  return result
}
