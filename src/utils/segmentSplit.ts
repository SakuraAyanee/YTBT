import type { SubtitleSegment, SubtitleWord } from '@/types/subtitle'
import {
  MAX_SEGMENT_DURATION_SEC,
  MIN_CHARS_BEFORE_PUNCT_SPLIT,
  MIN_SEGMENT_CHARS_CJK,
  MIN_SEGMENT_CHARS_LATIN,
} from '@/constants/subtitle'
import { getSubtitleSplitLimits } from '@/utils/subtitleSplitLimits'

const CJK_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff66-\uff9f]/
const STRONG_PUNCT_RE = /[。！？.!?…]["」』)]*$/
const WEAK_PUNCT_RE = /[、，,;；]["」』)]*$/

function visibleLen(text: string): number {
  return [...text.replace(/\s/g, '')].length
}

function isCjkText(text: string): boolean {
  const len = visibleLen(text)
  if (!len) return false
  return [...text.replace(/\s/g, '')].filter((c) => CJK_RE.test(c)).length / len > 0.35
}

function maxCharsFor(text: string): number {
  const limits = getSubtitleSplitLimits()
  return isCjkText(text) ? limits.maxCharsCjk : limits.maxCharsLatin
}

function minCharsFor(text: string): number {
  return isCjkText(text) ? MIN_SEGMENT_CHARS_CJK : MIN_SEGMENT_CHARS_LATIN
}

function joinWords(words: SubtitleWord[]): string {
  if (!words.length) return ''
  let text = words[0].word
  for (let i = 1; i < words.length; i++) {
    const prev = words[i - 1].word
    const cur = words[i].word
    const needSpace =
      /\s$/.test(prev) ||
      /^\s/.test(cur) ||
      (!CJK_RE.test(prev.slice(-1)) && !CJK_RE.test(cur[0]))
    text += needSpace ? cur.trimStart() : cur
  }
  return text.trim()
}

function segmentFromWords(
  words: SubtitleWord[],
  speaker?: string,
  status: SubtitleSegment['status'] = 'pending',
): SubtitleSegment {
  return {
    id: '',
    start: words[0].start,
    end: words[words.length - 1].end,
    text: joinWords(words),
    speaker: speaker ?? words.find((w) => w.speaker)?.speaker,
    words: [...words],
    status,
  }
}

/** 在标点处切分文本，返回各段 [startIdx, endIdx) 字符索引 */
function findTextBreakRanges(text: string, maxChars: number): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = []
  let start = 0

  const pushRange = (end: number) => {
    if (end > start) ranges.push({ start, end })
    start = end
  }

  let i = 0
  while (i < text.length) {
    const slice = text.slice(start, i + 1)
    const len = visibleLen(slice)
    const atStrong = STRONG_PUNCT_RE.test(slice)
    const atWeak = WEAK_PUNCT_RE.test(slice)

    if (atStrong && len >= MIN_CHARS_BEFORE_PUNCT_SPLIT) {
      pushRange(i + 1)
      i++
      continue
    }

    if (len > maxChars) {
      if (atWeak && len >= minCharsFor(text)) {
        pushRange(i + 1)
        i++
        continue
      }
      if (len > Math.floor(maxChars * 1.35)) {
        pushRange(i)
        continue
      }
    }

    i++
  }

  if (start < text.length) pushRange(text.length)
  return ranges.length ? ranges : [{ start: 0, end: text.length }]
}

/** 按 joinWords 后的字符区间切出 words */
function wordsForCharRange(words: SubtitleWord[], start: number, end: number): SubtitleWord[] {
  const picked: SubtitleWord[] = []

  for (let i = 0; i < words.length; i++) {
    const prevLen = i > 0 ? joinWords(words.slice(0, i)).length : 0
    const uptoLen = joinWords(words.slice(0, i + 1)).length
    if (uptoLen > start && prevLen < end) {
      picked.push(words[i])
    }
  }

  return picked.length ? picked : words
}

function splitSegmentByWords(seg: SubtitleSegment, maxChars: number): SubtitleSegment[] {
  const words = seg.words
  if (!words?.length) return splitSegmentByText(seg, maxChars)

  const fullText = joinWords(words)
  if (
    visibleLen(fullText) <= maxChars &&
    seg.end - seg.start <= MAX_SEGMENT_DURATION_SEC
  ) {
    return [seg]
  }

  const ranges = findTextBreakRanges(fullText, maxChars)
  const out: SubtitleSegment[] = []

  for (const { start, end } of ranges) {
    const chunkWords = wordsForCharRange(words, start, end)
    if (!chunkWords.length) continue
    const piece = segmentFromWords(chunkWords, seg.speaker, seg.status)
    if (piece.text.trim()) out.push(piece)
  }

  return out.length ? out : [seg]
}

function splitSegmentByText(seg: SubtitleSegment, maxChars: number): SubtitleSegment[] {
  const text = seg.text.trim()
  if (visibleLen(text) <= maxChars && seg.end - seg.start <= MAX_SEGMENT_DURATION_SEC) {
    return [seg]
  }

  const ranges = findTextBreakRanges(text, maxChars)
  if (ranges.length === 1 && visibleLen(text) > maxChars) {
    return splitByWordGroups(seg, maxChars)
  }

  const duration = seg.end - seg.start
  const totalLen = visibleLen(text) || 1
  let cursor = seg.start
  const out: SubtitleSegment[] = []

  for (const { start, end } of ranges) {
    const part = text.slice(start, end).trim()
    if (!part) continue
    const partLen = visibleLen(part)
    const sliceDur = (partLen / totalLen) * duration
    const endTime = Math.min(seg.end, cursor + sliceDur)
    out.push({
      id: '',
      start: cursor,
      end: endTime,
      text: part,
      speaker: seg.speaker,
      status: seg.status,
    })
    cursor = endTime
  }

  if (out.length) out[out.length - 1].end = seg.end
  return out.length ? out : [seg]
}

/** 无词级时间戳时按字数分组，保证每组至少 minChars（避免单字） */
function splitByWordGroups(seg: SubtitleSegment, maxChars: number): SubtitleSegment[] {
  const text = seg.text.trim()
  const minLen = minCharsFor(text)
  const chars = [...text]
  const groups: string[] = []
  let buf = ''

  for (const c of chars) {
    const trial = buf + c
    if (visibleLen(trial) > maxChars && visibleLen(buf) >= minLen) {
      groups.push(buf)
      buf = c
    } else {
      buf = trial
    }
  }
  if (buf) groups.push(buf)

  const duration = seg.end - seg.start
  const totalLen = visibleLen(text) || 1
  let cursor = seg.start

  return groups.map((part, idx) => {
    const partLen = visibleLen(part)
    const sliceDur = (partLen / totalLen) * duration
    const end =
      idx === groups.length - 1 ? seg.end : Math.min(seg.end, cursor + sliceDur)
    const piece: SubtitleSegment = {
      id: '',
      start: cursor,
      end,
      text: part,
      speaker: seg.speaker,
      status: seg.status,
    }
    cursor = end
    return piece
  })
}

function mergeTwo(a: SubtitleSegment, b: SubtitleSegment): SubtitleSegment {
  const cjk = isCjkText(a.text + b.text)
  const gap = cjk ? '' : ' '
  const text = `${a.text}${gap}${b.text}`.trim()
  const words = [...(a.words ?? []), ...(b.words ?? [])]
  return {
    id: '',
    start: a.start,
    end: b.end,
    text,
    speaker: a.speaker ?? b.speaker,
    words: words.length ? words : undefined,
    status: a.status,
  }
}

function mergeShortSegments(segments: SubtitleSegment[]): SubtitleSegment[] {
  if (segments.length < 2) return segments

  const merged: SubtitleSegment[] = []
  let cur = segments[0]

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i]
    const minLen = minCharsFor(cur.text)
    const maxLen = maxCharsFor(cur.text + next.text)
    const combined = mergeTwo(cur, next)
    const curLen = visibleLen(cur.text)
    const nextLen = visibleLen(next.text)
    const combinedLen = visibleLen(combined.text)

    const tooShort =
      curLen < minLen ||
      nextLen < minLen ||
      curLen <= 1 ||
      nextLen <= 1

    if (tooShort && combinedLen <= maxLen) {
      cur = combined
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
    id: `seg-${i + 1}`,
    status: 'pending' as const,
  }))
}

/**
 * 将过长 segment 拆成字幕友好短句：优先句末/逗号标点，避免单字行，并合并过短片段。
 */
export function splitLongSegments(segments: SubtitleSegment[]): SubtitleSegment[] {
  const expanded: SubtitleSegment[] = []

  for (const seg of segments) {
    const maxChars = maxCharsFor(seg.text)
    const tooLong =
      visibleLen(seg.text) > maxChars || seg.end - seg.start > MAX_SEGMENT_DURATION_SEC

    if (!tooLong) {
      expanded.push(seg)
      continue
    }

    const pieces = seg.words?.length
      ? splitSegmentByWords(seg, maxChars)
      : splitSegmentByText(seg, maxChars)

    expanded.push(...pieces)
  }

  return reassignIds(mergeShortSegments(expanded))
}
