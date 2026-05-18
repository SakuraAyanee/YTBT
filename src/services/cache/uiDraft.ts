import type { SourceLanguageOption } from '@/constants/subtitle'
import {
  DEFAULT_ALIGN_OUTPUT,
  DEFAULT_BATCH_SIZE,
  DEFAULT_TEMPERATURE,
  DEFAULT_VAD_OFFSET,
  DEFAULT_VAD_ONSET,
} from '@/constants/transcribe'

const UI_KEY = 'ytbt:ui'

export interface UiDraft {
  autoExtractAudio: boolean
  enableDiarization: boolean
  maxSegmentCharsCjk: number
  sourceLanguage: SourceLanguageOption
  vadOnset: number
  vadOffset: number
  alignOutput: boolean
  batchSize: number
  temperature: number
  initialPrompt: string
  minSpeakers: number | null
  maxSpeakers: number | null
}

export function saveUiDraft(draft: UiDraft): void {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(draft))
  } catch {
    /* 配额满时忽略 */
  }
}

export function loadUiDraft(): UiDraft | null {
  try {
    const raw = localStorage.getItem(UI_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<UiDraft>
    if (typeof parsed.autoExtractAudio !== 'boolean') return null
    return {
      autoExtractAudio: parsed.autoExtractAudio,
      enableDiarization: parsed.enableDiarization ?? true,
      maxSegmentCharsCjk: parsed.maxSegmentCharsCjk ?? 26,
      sourceLanguage: parsed.sourceLanguage ?? 'auto',
      vadOnset: parsed.vadOnset ?? DEFAULT_VAD_ONSET,
      vadOffset: parsed.vadOffset ?? DEFAULT_VAD_OFFSET,
      alignOutput: parsed.alignOutput ?? DEFAULT_ALIGN_OUTPUT,
      batchSize: parsed.batchSize ?? DEFAULT_BATCH_SIZE,
      temperature: parsed.temperature ?? DEFAULT_TEMPERATURE,
      initialPrompt: parsed.initialPrompt ?? '',
      minSpeakers: parsed.minSpeakers ?? null,
      maxSpeakers: parsed.maxSpeakers ?? null,
    }
  } catch {
    return null
  }
}

export function clearUiDraft(): void {
  localStorage.removeItem(UI_KEY)
}
