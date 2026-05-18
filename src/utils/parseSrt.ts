import type { SubtitleSegment } from '@/types/subtitle'
import {
  TimelineParseError,
  assertLineLimit,
  isPlaceholderText,
  normalizeSubtitleText,
} from '@/utils/subtitleParseShared'

export { TimelineParseError, SrtParseError } from '@/utils/subtitleParseShared'

const TIME_LINE =
  /^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/

function parseTime(h: string, m: string, s: string, frac: string): number {
  const ms = frac.length === 3 ? Number(frac) : Number(frac.padEnd(3, '0'))
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + ms / 1000
}

export function parseSrt(content: string): SubtitleSegment[] {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim()
  if (!normalized) {
    throw new TimelineParseError('SRT 文件为空')
  }

  const blocks = normalized.split(/\n\s*\n/)
  const segments: SubtitleSegment[] = []

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trimEnd())
      .filter((l, i, arr) => !(i === arr.length - 1 && l === ''))
    if (!lines.length) continue

    let cursor = 0
    if (/^\d+$/.test(lines[0]!) && lines.length >= 2) {
      cursor = 1
    }

    const timeLine = lines[cursor]
    if (!timeLine) continue

    const match = TIME_LINE.exec(timeLine)
    if (!match) continue

    const start = parseTime(match[1]!, match[2]!, match[3]!, match[4]!)
    const end = parseTime(match[5]!, match[6]!, match[7]!, match[8]!)
    if (end <= start) continue

    const rawText = normalizeSubtitleText(lines.slice(cursor + 1).join('\n'))
    const text = isPlaceholderText(rawText) ? '' : rawText

    segments.push({
      id: `seg-${segments.length + 1}`,
      start,
      end,
      text,
      status: 'pending',
    })
  }

  assertLineLimit(segments.length, 'SRT')
  return segments
}
