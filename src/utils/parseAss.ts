import type { SubtitleSegment } from '@/types/subtitle'
import {
  TimelineParseError,
  assertLineLimit,
  isPlaceholderText,
  normalizeSubtitleText,
} from '@/utils/subtitleParseShared'

/** ASS/SSA：H:MM:SS.cc（百分之一秒） */
const ASS_TIME = /^(\d+):(\d{2}):(\d{2})\.(\d{2,3})$/

function parseAssTime(raw: string): number | null {
  const s = raw.trim()
  const match = ASS_TIME.exec(s)
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  const sec = Number(match[3])
  let frac = match[4]!
  if (frac.length === 2) {
    return h * 3600 + m * 60 + sec + Number(frac) / 100
  }
  return h * 3600 + m * 60 + sec + Number(frac.padEnd(3, '0').slice(0, 3)) / 1000
}

/** Dialogue: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text */
const DIALOGUE_PREFIX = /^Dialogue:\s*/i

function parseDialogueLine(line: string): { start: number; end: number; text: string } | null {
  const body = line.replace(DIALOGUE_PREFIX, '')
  const parts: string[] = []
  let rest = body
  for (let i = 0; i < 9; i++) {
    const comma = rest.indexOf(',')
    if (comma === -1) return null
    parts.push(rest.slice(0, comma).trim())
    rest = rest.slice(comma + 1)
  }
  const textRaw = rest.trim()
  const start = parseAssTime(parts[1]!)
  const end = parseAssTime(parts[2]!)
  if (start == null || end == null || end <= start) return null

  const text = normalizeSubtitleText(textRaw)
  return { start, end, text: isPlaceholderText(text) ? '' : text }
}

export function parseAss(content: string): SubtitleSegment[] {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  if (!normalized.trim()) {
    throw new TimelineParseError('ASS 文件为空')
  }

  const segments: SubtitleSegment[] = []

  for (const line of normalized.split('\n')) {
    const trimmed = line.trim()
    if (!DIALOGUE_PREFIX.test(trimmed)) continue

    const parsed = parseDialogueLine(trimmed)
    if (!parsed) continue

    segments.push({
      id: `seg-${segments.length + 1}`,
      start: parsed.start,
      end: parsed.end,
      text: parsed.text,
      status: 'pending',
    })
  }

  assertLineLimit(segments.length, 'ASS')
  return segments
}
