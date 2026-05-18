import { MAX_SRT_LINES } from '@/constants/timedAsr'

export class TimelineParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TimelineParseError'
  }
}

/** @deprecated 使用 TimelineParseError */
export const SrtParseError = TimelineParseError

export function normalizeSubtitleText(raw: string): string {
  return raw
    .replace(/\{[^}]*\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\\N/gi, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\h/g, ' ')
    .trim()
}

export function isPlaceholderText(text: string): boolean {
  if (!text) return true
  return /^[-–—.\s…]+$/.test(text)
}

export function assertLineLimit(count: number, formatLabel: string): void {
  if (count > MAX_SRT_LINES) {
    throw new TimelineParseError(
      `字幕行数 ${count} 超过上限 ${MAX_SRT_LINES}，请先在 Aegisub 中合并或拆分`,
    )
  }
  if (count === 0) {
    throw new TimelineParseError(`未能从 ${formatLabel} 解析出有效字幕行，请检查格式`)
  }
}
