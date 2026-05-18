import type { SubtitleSegment, WorkbenchPhase } from '@/types/subtitle'
import { idbDelete, idbGet, idbGetAll, idbGetAllByIndex, idbPut } from './idb'
import { serializeSegmentsForCache } from './serialize'

export { idbDelete }

export interface MediaRecord {
  fileKey: string
  blob: Blob
  name: string
  type: string
  size: number
  lastModified: number
  updatedAt: number
}

export interface TranscribeRecord {
  transcribeKey: string
  fileKey: string
  fileName: string
  segments: SubtitleSegment[]
  detectedLanguage: string
  createdAt: number
}

export interface TranslateRecord {
  translateKey: string
  transcribeKey: string
  fileKey: string
  segments: SubtitleSegment[]
  detectedLanguage: string
  createdAt: number
}

export interface LastSessionMeta {
  key: 'lastSession'
  fileKey: string
  fileName: string
  transcribeKey: string
  translateKey: string
  phase: WorkbenchPhase
  updatedAt: number
}

export async function saveMedia(fileKey: string, file: File): Promise<void> {
  await idbPut('media', {
    fileKey,
    blob: file,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    lastModified: file.lastModified,
    updatedAt: Date.now(),
  } satisfies MediaRecord)
}

export async function loadMedia(fileKey: string): Promise<File | null> {
  const row = await idbGet<MediaRecord>('media', fileKey)
  if (!row?.blob) return null
  return new File([row.blob], row.name, {
    type: row.type,
    lastModified: row.lastModified,
  })
}

export async function getLatestMedia(): Promise<MediaRecord | null> {
  const list = await idbGetAll<MediaRecord>('media')
  if (!list.length) return null
  return list.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null
}

export async function getTranscribe(transcribeKey: string): Promise<TranscribeRecord | null> {
  return (await idbGet<TranscribeRecord>('transcribe', transcribeKey)) ?? null
}

export async function putTranscribe(record: TranscribeRecord): Promise<void> {
  await idbPut('transcribe', record)
}

export async function getTranslate(translateKey: string): Promise<TranslateRecord | null> {
  return (await idbGet<TranslateRecord>('translate', translateKey)) ?? null
}

export async function putTranslate(record: TranslateRecord): Promise<void> {
  await idbPut('translate', record)
}

export async function setLastSession(meta: Omit<LastSessionMeta, 'key'>): Promise<void> {
  await idbPut('meta', { key: 'lastSession', ...meta })
}

export async function getLastSession(): Promise<LastSessionMeta | null> {
  return (await idbGet<LastSessionMeta>('meta', 'lastSession')) ?? null
}

/** 先写 meta（保证刷新可恢复），再尽力写入字幕表 */
export async function saveSessionMeta(meta: Omit<LastSessionMeta, 'key'>): Promise<void> {
  await setLastSession(meta)
}

export async function saveSegmentRecords(
  translateKey: string,
  transcribeKey: string,
  fileKey: string,
  segments: SubtitleSegment[],
  detectedLanguage: string,
  phase: WorkbenchPhase,
  fileName: string,
): Promise<void> {
  const slim = serializeSegmentsForCache(segments)
  const now = Date.now()

  try {
    if (phase === 'done' || slim.some((s) => s.translatedText)) {
      await putTranslate({
        translateKey,
        transcribeKey,
        fileKey,
        segments: slim,
        detectedLanguage,
        createdAt: now,
      })
    } else if (slim.length) {
      await putTranscribe({
        transcribeKey,
        fileKey,
        fileName,
        segments: slim,
        detectedLanguage,
        createdAt: now,
      })
    }
  } catch (err) {
    console.warn('[YTBT] 字幕写入 IndexedDB 失败（meta 已保存，可恢复视频）', err)
    throw err
  }
}

export async function saveSegmentsProgress(
  translateKey: string,
  transcribeKey: string,
  fileKey: string,
  segments: SubtitleSegment[],
  detectedLanguage: string,
  phase: WorkbenchPhase,
  fileName: string,
): Promise<void> {
  const now = Date.now()
  await saveSessionMeta({
    fileKey,
    fileName,
    transcribeKey,
    translateKey,
    phase,
    updatedAt: now,
  })
  if (segments.length) {
    await saveSegmentRecords(
      translateKey,
      transcribeKey,
      fileKey,
      segments,
      detectedLanguage,
      phase,
      fileName,
    )
  }
}

export async function rebuildLastSessionFromStores(): Promise<LastSessionMeta | null> {
  const media = await getLatestMedia()
  if (!media) return null

  const transcribes = await idbGetAllByIndex<TranscribeRecord>(
    'transcribe',
    'fileKey',
    media.fileKey,
  )
  const allTranslates = await idbGetAll<TranslateRecord>('translate')
  const translates = allTranslates.filter((t) => t.fileKey === media.fileKey)

  const latestTr = transcribes.sort((a, b) => b.createdAt - a.createdAt)[0]
  const latestTrans = translates.sort((a, b) => b.createdAt - a.createdAt)[0]

  const transcribeKey =
    latestTr?.transcribeKey ?? latestTrans?.transcribeKey ?? `${media.fileKey}::t::unknown`
  const translateKey =
    latestTrans?.translateKey ?? `${transcribeKey}::tr::unknown`

  const meta: LastSessionMeta = {
    key: 'lastSession',
    fileKey: media.fileKey,
    fileName: media.name,
    transcribeKey,
    translateKey,
    phase: latestTrans ? 'done' : latestTr ? 'transcribed' : 'idle',
    updatedAt: media.updatedAt,
  }

  await setLastSession(meta)
  return meta
}
