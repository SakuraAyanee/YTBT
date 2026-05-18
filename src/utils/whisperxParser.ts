import type { SubtitleSegment, SubtitleWord } from '@/types/subtitle'
import { splitLongSegments } from '@/utils/segmentSplit'

interface WhisperXWord {
  word?: string
  start?: number
  end?: number
  score?: number
  speaker?: string
}

interface WhisperXSegment {
  start?: number
  end?: number
  text?: string
  speaker?: string
  words?: WhisperXWord[]
}

function normalizeWords(words?: WhisperXWord[]): SubtitleWord[] | undefined {
  if (!words?.length) return undefined
  return words
    .filter((w) => w.word && w.start != null && w.end != null)
    .map((w) => ({
      word: w.word!.trim(),
      start: w.start!,
      end: w.end!,
      score: w.score,
      speaker: w.speaker,
    }))
}

function inferSpeaker(seg: WhisperXSegment): string | undefined {
  if (seg.speaker) return seg.speaker
  const fromWords = seg.words?.find((w) => w.speaker)?.speaker
  return fromWords
}

export function parseWhisperXSegments(raw: unknown): SubtitleSegment[] {
  const list = Array.isArray(raw) ? (raw as WhisperXSegment[]) : []
  const mapped = list
    .filter((seg) => seg.text?.trim() && seg.start != null && seg.end != null)
    .map((seg, index) => {
      const text = seg.text!.trim()
      const speaker = inferSpeaker(seg)
      return {
        id: `seg-${index + 1}`,
        start: seg.start!,
        end: seg.end!,
        text,
        speaker,
        words: normalizeWords(seg.words),
        status: 'pending' as const,
      }
    })

  return splitLongSegments(mapped)
}
