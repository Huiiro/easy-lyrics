export interface LyricsPreprocessOptions {
  removeMetadata: boolean
  removeParentheses: boolean
  removeBraces: boolean
  customPattern: string
  customFlags: string
}

export interface LyricsPreprocessResult {
  text: string
  replacements: number
  error: string | null
}

const metadataLinePattern = /^\s*\[(?:ar|al|ti|au|by|offset|re|ve|length):.*\]\s*$/gimu

function replaceAndCount(source: string, pattern: RegExp): { text: string; count: number } {
  let count = 0
  return {
    text: source.replace(pattern, () => {
      count += 1
      return ''
    }),
    count
  }
}

function removeBalancedGroups(
  source: string,
  openingCharacters: ReadonlySet<string>,
  closingCharacters: ReadonlySet<string>
): { text: string; count: number } {
  let count = 0
  const lines = source.split('\n').map((line) => {
    let output = ''
    let pending = ''
    let depth = 0
    for (const character of line) {
      if (depth === 0) {
        if (openingCharacters.has(character)) {
          depth = 1
          pending = character
        } else {
          output += character
        }
        continue
      }

      pending += character
      if (openingCharacters.has(character)) depth += 1
      else if (closingCharacters.has(character)) {
        depth -= 1
        if (depth === 0) {
          pending = ''
          count += 1
        }
      }
    }
    // Keep malformed, unclosed annotations instead of silently deleting lyrics.
    return output + pending
  })
  return { text: lines.join('\n'), count }
}

export function preprocessLyrics(
  source: string,
  options: LyricsPreprocessOptions
): LyricsPreprocessResult {
  let text = source.replace(/\r\n?/gu, '\n')
  let replacements = 0
  const apply = (pattern: RegExp): void => {
    const result = replaceAndCount(text, pattern)
    text = result.text
    replacements += result.count
  }

  if (options.removeMetadata) apply(metadataLinePattern)
  if (options.removeParentheses) {
    const result = removeBalancedGroups(text, new Set(['(', '（']), new Set([')', '）']))
    text = result.text
    replacements += result.count
  }
  if (options.removeBraces) {
    const result = removeBalancedGroups(text, new Set(['{', '｛']), new Set(['}', '｝']))
    text = result.text
    replacements += result.count
  }

  if (options.customPattern.trim()) {
    try {
      const flags = options.customFlags.includes('g')
        ? options.customFlags
        : `${options.customFlags}g`
      apply(new RegExp(options.customPattern, flags))
    } catch (error) {
      return {
        text,
        replacements,
        error: error instanceof Error ? error.message : '无效的正则表达式'
      }
    }
  }

  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/gu, ' ').trim())
    .filter(Boolean)
    .join('\n')
  return { text, replacements, error: null }
}
