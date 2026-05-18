import type { SubtitleSegment } from '@/types/subtitle'
import {
  DEFAULT_AUTO_TIMING_MAX_CHARS,
  DEFAULT_END_PADDING_SEC,
  DEFAULT_GAP_THRESHOLD_SEC,
  DEFAULT_LINE_END_SNAP_MIN_GAP_SEC,
  DEFAULT_MAX_LINE_DURATION_SEC,
  DEFAULT_MIN_CHARS_PER_LINE,
  DEFAULT_MIN_LINE_DURATION_SEC,
} from '@/constants/autoTiming'
import type { TimedUnit } from '@/utils/whisperxUnits'

const STRONG_PUNCT_RE = /[。！？.!?…]["」』)]*$/
const WEAK_PUNCT_RE = /[、，,;；]["」』)]*$/
const MIN_CHARS_BEFORE_PUNCT_SPLIT = 8

export interface BuildTimelineOptions {
  maxCharsPerLine?: number
  gapThresholdSec?: number
  maxLineDurationSec?: number
  minLineDurationSec?: number
  minCharsPerLine?: number
  endPaddingSec?: number
  lineEndSnapMinGapSec?: number
  /** CJK 用 ''，英语等用 ' ' */
  joiner?: string
}

function visibleLen(text: string): number {
  return [...text.replace(/\s/g, '')].length
}

function joinUnits(units: TimedUnit[], joiner: string): string {
  if (!units.length) return ''
  let out = units[0].text.trim()
  for (let i = 1; i < units.length; i++) {
    const t = units[i].text.trim()
    if (!t) continue
    const needsSpace =
      joiner === ' ' &&
      /[A-Za-z0-9]$/.test(out) &&
      /^[A-Za-z0-9]/.test(t)
    out += (needsSpace ? ' ' : joiner) + t
  }
  return out.trim()
}

function gapBetween(a: TimedUnit, b: TimedUnit): number {
  return Math.max(0, b.start - a.end)
}

/** 按词间停顿切成「意群」 */
function splitPhrases(units: TimedUnit[], gapThreshold: number): TimedUnit[][] {
  if (!units.length) return []
  const phrases: TimedUnit[][] = [[units[0]!]]
  for (let i = 1; i < units.length; i++) {
    const prev = units[i - 1]!
    const cur = units[i]!
    if (gapBetween(prev, cur) >= gapThreshold) {
      phrases.push([cur])
    } else {
      phrases[phrases.length - 1]!.push(cur)
    }
  }
  return phrases
}

function shouldBreakAfterAccumulated(text: string, maxChars: number): boolean {
  const len = visibleLen(text)
  if (STRONG_PUNCT_RE.test(text) && len >= MIN_CHARS_BEFORE_PUNCT_SPLIT) return true
  if (WEAK_PUNCT_RE.test(text) && len >= Math.min(maxChars, 12)) return true
  return len >= maxChars
}

/** 意群内按字数与标点拆行 */
function splitPhraseIntoLines(
  phrase: TimedUnit[],
  maxChars: number,
  joiner: string,
): TimedUnit[][] {
  if (!phrase.length) return []

  const lines: TimedUnit[][] = []
  let buf: TimedUnit[] = []

  const flush = () => {
    if (buf.length) {
      lines.push(buf)
      buf = []
    }
  }

  for (const unit of phrase) {
    const trial = [...buf, unit]
    const text = joinUnits(trial, joiner)
    if (!buf.length) {
      buf = [unit]
      if (visibleLen(unit.text) > maxChars) flush()
      continue
    }

    if (shouldBreakAfterAccumulated(joinUnits(buf, joiner), maxChars)) {
      flush()
      buf = [unit]
      if (visibleLen(unit.text) > maxChars) flush()
      continue
    }

    if (visibleLen(text) > maxChars) {
      flush()
      buf = [unit]
      if (visibleLen(unit.text) > maxChars) flush()
    } else {
      buf = trial
    }
  }
  flush()
  return lines
}

function lineFromUnits(
  units: TimedUnit[],
  joiner: string,
  endPadding: number,
): SubtitleSegment {
  const speakers = [...new Set(units.map((u) => u.speaker).filter(Boolean))]
  return {
    id: '',
    start: units[0]!.start,
    end: units[units.length - 1]!.end + endPadding,
    text: joinUnits(units, joiner),
    speaker: speakers.length === 1 ? speakers[0] : undefined,
    status: 'pending',
  }
}

function snapLineEnds(
  segments: SubtitleSegment[],
  units: TimedUnit[],
  minGap: number,
  minDur: number,
): void {
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!
    const nextSeg = segments[i + 1]
    const lastUnitIdx = units.findIndex(
      (u, idx) =>
        u.end >= seg.end - 0.001 &&
        (idx === units.length - 1 || units[idx + 1]!.start > seg.end),
    )
    if (lastUnitIdx < 0 || lastUnitIdx >= units.length - 1) continue
    const gap = gapBetween(units[lastUnitIdx]!, units[lastUnitIdx + 1]!)
    if (gap < minGap) continue
    const snapEnd = (units[lastUnitIdx]!.end + units[lastUnitIdx + 1]!.start) / 2 - 0.02
    if (snapEnd > seg.start + minDur) {
      seg.end = Math.min(seg.end, snapEnd)
    }
    if (nextSeg && seg.end > nextSeg.start) {
      seg.end = nextSeg.start - 0.02
    }
  }
}

function fixOverlaps(segments: SubtitleSegment[]): void {
  for (let i = 0; i < segments.length - 1; i++) {
    const a = segments[i]!
    const b = segments[i + 1]!
    if (a.end <= b.start) continue
    const mid = (a.end + b.start) / 2
    a.end = Math.max(a.start + 0.05, mid - 0.01)
    b.start = Math.min(b.end - 0.05, mid + 0.01)
  }
}

function enforceMinDuration(segments: SubtitleSegment[], minDur: number): void {
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!
    const nextStart = segments[i + 1]?.start
    const cap = nextStart != null ? nextStart - 0.02 : seg.end + minDur
    if (seg.end - seg.start < minDur) {
      seg.end = Math.min(seg.start + minDur, cap)
    }
  }
}

function splitLongDurationLines(
  segments: SubtitleSegment[],
  maxDur: number,
  maxChars: number,
): SubtitleSegment[] {
  const out: SubtitleSegment[] = []
  for (const seg of segments) {
    if (seg.end - seg.start <= maxDur || visibleLen(seg.text) <= 1) {
      out.push(seg)
      continue
    }
    const mid = seg.start + (seg.end - seg.start) / 2
    const chars = [...seg.text]
    let splitAt = Math.floor(chars.length / 2)
    if (visibleLen(seg.text) > maxChars) {
      let acc = 0
      splitAt = chars.length
      for (let i = 0; i < chars.length; i++) {
        acc++
        if (acc >= Math.ceil(visibleLen(seg.text) / 2)) {
          splitAt = i + 1
          break
        }
      }
    }
    const t1 = seg.text.slice(0, splitAt).trim()
    const t2 = seg.text.slice(splitAt).trim()
    if (!t1 || !t2) {
      out.push(seg)
      continue
    }
    out.push(
      { ...seg, id: '', end: mid, text: t1 },
      { ...seg, id: '', start: mid, text: t2 },
    )
  }
  return out
}

function mergeShortLines(
  segments: SubtitleSegment[],
  minChars: number,
  maxChars: number,
  joiner: string,
): SubtitleSegment[] {
  if (segments.length < 2) return segments
  const merged: SubtitleSegment[] = []
  let cur = segments[0]!

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i]!
    const curLen = visibleLen(cur.text)
    const nextLen = visibleLen(next.text)
    const combinedText =
      joiner === ' '
        ? `${cur.text}${joiner}${next.text}`.trim()
        : `${cur.text}${next.text}`.trim()
    const combinedLen = visibleLen(combinedText)
    const gap = next.start - cur.end

    const tooShort =
      (curLen < minChars || nextLen < minChars) && combinedLen <= maxChars && gap < 0.35

    if (tooShort) {
      cur = {
        ...cur,
        end: next.end,
        text: combinedText,
        speaker: cur.speaker ?? next.speaker,
      }
    } else {
      merged.push(cur)
      cur = next
    }
  }
  merged.push(cur)
  return merged
}

function reassignIds(segments: SubtitleSegment[]): SubtitleSegment[] {
  return segments.map((s, i) => ({
    ...s,
    id: `axis-${i + 1}`,
    status: 'pending' as const,
  }))
}

/**
 * 从词级（或段级回退）单元生成字幕时间轴：词间停顿 → 字数上限 → 时长与重叠修正。
 */
export function buildTimelineFromUnits(
  units: TimedUnit[],
  options: BuildTimelineOptions = {},
): SubtitleSegment[] {
  if (!units.length) return []

  const maxChars = options.maxCharsPerLine ?? DEFAULT_AUTO_TIMING_MAX_CHARS
  const gapThreshold = options.gapThresholdSec ?? DEFAULT_GAP_THRESHOLD_SEC
  const maxDur = options.maxLineDurationSec ?? DEFAULT_MAX_LINE_DURATION_SEC
  const minDur = options.minLineDurationSec ?? DEFAULT_MIN_LINE_DURATION_SEC
  const minChars = options.minCharsPerLine ?? DEFAULT_MIN_CHARS_PER_LINE
  const endPadding = options.endPaddingSec ?? DEFAULT_END_PADDING_SEC
  const snapMinGap = options.lineEndSnapMinGapSec ?? DEFAULT_LINE_END_SNAP_MIN_GAP_SEC
  const joiner = options.joiner ?? ' '

  const sorted = [...units].sort((a, b) => a.start - b.start || a.end - b.end)
  const phrases = splitPhrases(sorted, gapThreshold)

  let segments: SubtitleSegment[] = []
  for (const phrase of phrases) {
    const lineGroups = splitPhraseIntoLines(phrase, maxChars, joiner)
    for (const group of lineGroups) {
      const text = joinUnits(group, joiner)
      if (!text) continue
      segments.push(lineFromUnits(group, joiner, endPadding))
    }
  }

  snapLineEnds(segments, sorted, snapMinGap, minDur)
  fixOverlaps(segments)
  enforceMinDuration(segments, minDur)
  segments = splitLongDurationLines(segments, maxDur, maxChars)
  fixOverlaps(segments)
  enforceMinDuration(segments, minDur)
  segments = mergeShortLines(segments, minChars, maxChars, joiner)
  fixOverlaps(segments)

  return reassignIds(segments)
}
