import type { JobPhase, SubtitleSegment } from '@/types/subtitle'
import {
  buildTranscribeFingerprint,
  buildTranscribeKey,
  buildTranslateFingerprint,
  buildTranslateKey,
  computeFileKey,
  type TranscribeFingerprintInput,
} from './fingerprint'
import {
  getLastSession,
  getTranslate,
  getTranscribe,
  loadMedia,
  rebuildLastSessionFromStores,
  saveMedia,
  saveSegmentRecords,
  saveSessionMeta,
  idbDelete,
} from './subtitleCache'
import { loadUiDraft, saveUiDraft, clearUiDraft, type UiDraft } from './uiDraft'

export interface DraftKeys {
  fileKey: string
  transcribeKey: string
  translateKey: string
}

export function buildDraftKeys(
  fileKey: string,
  transcribeInput: TranscribeFingerprintInput,
): DraftKeys {
  const transcribeFp = buildTranscribeFingerprint(transcribeInput)
  const transcribeKey = buildTranscribeKey(fileKey, transcribeFp)
  const translateKey = buildTranslateKey(transcribeKey, buildTranslateFingerprint())
  return { fileKey, transcribeKey, translateKey }
}

export async function persistWorkbenchDraft(params: {
  file: File
  keys: DraftKeys
  segments: SubtitleSegment[]
  detectedLanguage: string
  phase: JobPhase
  ui: UiDraft
}): Promise<void> {
  const { file, keys, segments, detectedLanguage, phase, ui } = params

  await saveMedia(keys.fileKey, file)

  await saveSessionMeta({
    fileKey: keys.fileKey,
    fileName: file.name,
    transcribeKey: keys.transcribeKey,
    translateKey: keys.translateKey,
    phase,
    updatedAt: Date.now(),
  })

  if (segments.length) {
    try {
      await saveSegmentRecords(
        keys.translateKey,
        keys.transcribeKey,
        keys.fileKey,
        segments,
        detectedLanguage,
        phase,
        file.name,
      )
    } catch (err) {
      console.warn('[YTBT] 字幕缓存写入失败（视频与 meta 已保存）', err)
    }
  }

  saveUiDraft(ui)
}

export interface RestoredDraft {
  file: File
  keys: DraftKeys
  segments: SubtitleSegment[]
  detectedLanguage: string
  phase: JobPhase
  fileName: string
  ui: ReturnType<typeof loadUiDraft>
  partial?: boolean
}

const NON_RESUMABLE: JobPhase[] = ['extracting', 'uploading', 'transcribing', 'translating']

async function resolveMeta() {
  let meta = await getLastSession()
  if (!meta) {
    meta = await rebuildLastSessionFromStores()
  }
  return meta
}

export async function loadWorkbenchDraft(): Promise<RestoredDraft | null> {
  const meta = await resolveMeta()
  if (!meta) return null

  const file = await loadMedia(meta.fileKey)
  if (!file) return null

  let segments: SubtitleSegment[] = []
  let detectedLanguage = ''
  let partial = false

  const translated = await getTranslate(meta.translateKey)
  if (translated?.segments?.length) {
    segments = translated.segments
    detectedLanguage = translated.detectedLanguage
  } else {
    const transcribed = await getTranscribe(meta.transcribeKey)
    if (transcribed?.segments?.length) {
      segments = transcribed.segments
      detectedLanguage = transcribed.detectedLanguage
    } else {
      partial = true
    }
  }

  let phase = meta.phase
  if (NON_RESUMABLE.includes(phase)) {
    phase = segments.some((s) => s.translatedText) ? 'done' : 'transcribed'
  }
  if (partial && segments.length === 0) {
    phase = 'idle'
  }

  return {
    file,
    keys: {
      fileKey: meta.fileKey,
      transcribeKey: meta.transcribeKey,
      translateKey: meta.translateKey,
    },
    segments,
    detectedLanguage,
    phase,
    fileName: meta.fileName,
    ui: loadUiDraft(),
    partial,
  }
}

export async function clearWorkbenchDraft(keys: DraftKeys | null): Promise<void> {
  clearUiDraft()
  if (!keys) {
    await idbDelete('meta', 'lastSession')
    return
  }
  await Promise.all([
    idbDelete('meta', 'lastSession'),
    idbDelete('media', keys.fileKey),
    idbDelete('transcribe', keys.transcribeKey),
    idbDelete('translate', keys.translateKey),
  ])
}

export { computeFileKey }
