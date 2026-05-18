/** 转为 WhisperX 兼容结构，供 parseWhisperXSegments / extractTimedUnits 复用 */

import { joinTokensForLanguage, normalizeCjkTranscript } from '@/utils/cjkText'

export interface DeepgramWord {
  word: string
  start: number
  end: number
  confidence?: number
}

export interface DeepgramUtterance {
  start: number
  end: number
  transcript: string
  confidence?: number
  words?: DeepgramWord[]
  speaker?: number
}

interface DeepgramListenResponse {
  metadata?: { language?: string }
  results?: {
    channels?: Array<{
      detected_language?: string
      alternatives?: Array<{
        transcript?: string
        words?: DeepgramWord[]
      }>
    }>
    utterances?: DeepgramUtterance[]
  }
}

function formatSegmentText(raw: string): string {
  return normalizeCjkTranscript(raw)
}

export function parseDeepgramResponse(
  raw: DeepgramListenResponse,
  languageHint?: string,
): {
  segments: unknown[]
  detectedLanguage: string
} {
  const detected =
    raw.results?.channels?.[0]?.detected_language ||
    raw.metadata?.language ||
    languageHint ||
    ''

  const lang = detected || languageHint || ''

  const utterances = raw.results?.utterances
  if (utterances?.length) {
    const segments = utterances
      .filter((u) => u.transcript?.trim() && u.end > u.start)
      .map((u) => {
        const fromWords = u.words?.length
          ? joinTokensForLanguage(
              u.words.map((w) => w.word),
              lang,
            )
          : ''
        const text = formatSegmentText(fromWords || u.transcript.trim())
        return {
          start: u.start,
          end: u.end,
          text,
          speaker:
            u.speaker != null ? `SPEAKER_${String(u.speaker).padStart(2, '0')}` : undefined,
          words: u.words?.map((w) => ({
            word: w.word,
            start: w.start,
            end: w.end,
            score: w.confidence,
          })),
        }
      })
      .filter((s) => s.text)
    return { segments, detectedLanguage: detected }
  }

  const alt = raw.results?.channels?.[0]?.alternatives?.[0]
  if (alt?.words?.length) {
    const joined = joinTokensForLanguage(
      alt.words.map((w) => w.word),
      lang,
    )
    const text = formatSegmentText(alt.transcript?.trim() || joined)
    const start = alt.words[0]!.start
    const end = alt.words[alt.words.length - 1]!.end
    return {
      segments: [
        {
          start,
          end,
          text,
          words: alt.words.map((w) => ({
            word: w.word,
            start: w.start,
            end: w.end,
            score: w.confidence,
          })),
        },
      ],
      detectedLanguage: detected,
    }
  }

  return { segments: [], detectedLanguage: detected }
}
