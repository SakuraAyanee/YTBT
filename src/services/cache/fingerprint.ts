import {
  SEGMENT_LOGIC_VERSION,
  MAX_SEGMENT_DURATION_SEC,
  MIN_CHARS_BEFORE_PUNCT_SPLIT,
  MIN_SEGMENT_CHARS_CJK,
  MIN_SEGMENT_CHARS_LATIN,
  type SourceLanguageOption,
} from '@/constants/subtitle'
import type { AsrProvider } from '@/constants/asr'
import type { DeepgramUiOptions } from '@/constants/deepgram'
import {
  TARGET_TRANSLATE_LANG,
  TRANSLATE_PROMPT_VERSION,
  WHISPERX_VERSION,
  DEEPGRAM_MODEL,
} from '@/constants/cache'

const HEAD_BYTES = 4 * 1024 * 1024

export interface TranscribeFingerprintInput {
  asrProvider: AsrProvider
  deepgramUi?: DeepgramUiOptions
  alignOutput: boolean
  diarization: boolean
  autoExtractAudio: boolean
  vadOnset: number
  vadOffset: number
  batchSize: number
  temperature: number
  initialPrompt: string
  minSpeakers: number | null
  maxSpeakers: number | null
  maxSegmentCharsCjk: number
  sourceLanguage: SourceLanguageOption
}

export async function computeFileKey(file: File): Promise<string> {
  const head = file.slice(0, Math.min(file.size, HEAD_BYTES))
  const headBuf = await head.arrayBuffer()
  const meta = new TextEncoder().encode(`${file.size}:${file.lastModified}`)
  const combined = new Uint8Array(headBuf.byteLength + meta.length)
  combined.set(new Uint8Array(headBuf), 0)
  combined.set(meta, headBuf.byteLength)
  const digest = await crypto.subtle.digest('SHA-256', combined)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function stableStringify(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort()
  return JSON.stringify(keys.map((k) => [k, obj[k]]))
}

export function buildTranscribeFingerprint(input: TranscribeFingerprintInput): string {
  const maxLatin = Math.round(
    input.maxSegmentCharsCjk * (48 / 26),
  )
  return stableStringify({
    asr: input.asrProvider,
    deepgramModel: input.asrProvider === 'deepgram' ? DEEPGRAM_MODEL : '',
    deepgramUi: input.asrProvider === 'deepgram' ? input.deepgramUi : '',
    whisperx: input.asrProvider === 'whisperx' ? WHISPERX_VERSION : '',
    segmentLogic: SEGMENT_LOGIC_VERSION,
    maxCjk: input.maxSegmentCharsCjk,
    maxLatin,
    maxDur: MAX_SEGMENT_DURATION_SEC,
    minPunct: MIN_CHARS_BEFORE_PUNCT_SPLIT,
    minCjk: MIN_SEGMENT_CHARS_CJK,
    minLatin: MIN_SEGMENT_CHARS_LATIN,
    align: input.alignOutput,
    diarization: input.diarization,
    extract: input.autoExtractAudio,
    vadOnset: input.vadOnset,
    vadOffset: input.vadOffset,
    batchSize: input.batchSize,
    temperature: input.temperature,
    initialPrompt: input.initialPrompt,
    minSpeakers: input.minSpeakers,
    maxSpeakers: input.maxSpeakers,
    language: input.sourceLanguage,
  })
}

export function buildTranslateFingerprint(): string {
  const model = import.meta.env.VITE_LLM_MODEL || import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini'
  return stableStringify({
    model,
    target: TARGET_TRANSLATE_LANG,
    prompt: TRANSLATE_PROMPT_VERSION,
  })
}

export function buildTranscribeKey(fileKey: string, transcribeFp: string): string {
  return `${fileKey}::t::${hashShort(transcribeFp)}`
}

export function buildTranslateKey(transcribeKey: string, translateFp: string): string {
  return `${transcribeKey}::tr::${hashShort(translateFp)}`
}

function hashShort(text: string): string {
  let h = 0
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(16)
}
