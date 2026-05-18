import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { JobPhase, SubtitleSegment } from '@/types/subtitle'
import { runTranscription } from '@/services/transcription'
import { useAsrSettingsStore } from '@/stores/asrSettings'
import { extractAudioFromVideo } from '@/services/audioExtract'
import { translateSegments } from '@/services/translate'
import { isVideoFile } from '@/utils/media'
import { MAX_UPLOAD_MB } from '@/constants/upload'
import { parseTimeline, TimelineParseError, isTimelineFile } from '@/utils/parseTimeline'
import { extractTimedUnits } from '@/utils/whisperxUnits'
import {
  mapAsrToTimeline,
  mapAsrToConcatSlots,
  countUnmappedRows,
} from '@/utils/mapAsrToTimeline'
import { buildConcatenatedTimelineAudio } from '@/services/timelineConcatAudio'
import type { SourceLanguageOption } from '@/constants/subtitle'
import {
  DEFAULT_ALIGN_OUTPUT,
  DEFAULT_BATCH_SIZE,
  DEFAULT_TEMPERATURE,
  DEFAULT_VAD_OFFSET,
  DEFAULT_VAD_ONSET,
} from '@/constants/transcribe'
import {
  DEFAULT_CLIP_GAP_SEC,
  DEFAULT_CLIP_PADDING_SEC,
  DEFAULT_MAP_PADDING_SEC,
  type TimedAsrFillMode,
} from '@/constants/timedAsr'
import type { TimedAsrHandoffPayload } from '@/stores/autoTiming'

const UI_KEY = 'ytbt:timed-asr-ui'

interface TimedAsrUiDraft {
  sourceLanguage: SourceLanguageOption
  autoExtractAudio: boolean
  fillMode: TimedAsrFillMode
  mapPaddingSec: number
  clipPaddingSec: number
  clipGapSec: number
  vadOnset: number
  vadOffset: number
  alignOutput: boolean
  batchSize: number
  temperature: number
}

function loadUi(): Partial<TimedAsrUiDraft> {
  try {
    const raw = localStorage.getItem(UI_KEY)
    return raw ? (JSON.parse(raw) as Partial<TimedAsrUiDraft>) : {}
  } catch {
    return {}
  }
}

function saveUi(draft: TimedAsrUiDraft) {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(draft))
  } catch {
    /* ignore */
  }
}

export const useTimedAsrStore = defineStore('timedAsr', () => {
  const saved = loadUi()

  const videoFile = ref<File | null>(null)
  const videoUrl = ref<string | null>(null)
  const srtFile = ref<File | null>(null)
  const srtFileName = ref('')
  const segments = ref<SubtitleSegment[]>([])
  const detectedLanguage = ref('')
  const phase = ref<JobPhase>('idle')
  const statusMessage = ref('')
  const uploadProgress = ref(0)
  const extractProgress = ref(0)
  const errorMessage = ref('')

  const sourceLanguage = ref<SourceLanguageOption>(saved.sourceLanguage ?? 'auto')
  const autoExtractAudio = ref(saved.autoExtractAudio ?? true)
  const fillMode = ref<TimedAsrFillMode>(saved.fillMode ?? 'concat')
  const mapPaddingSec = ref(saved.mapPaddingSec ?? DEFAULT_MAP_PADDING_SEC)
  const clipPaddingSec = ref(saved.clipPaddingSec ?? DEFAULT_CLIP_PADDING_SEC)
  const clipGapSec = ref(saved.clipGapSec ?? DEFAULT_CLIP_GAP_SEC)
  const vadOnset = ref(saved.vadOnset ?? DEFAULT_VAD_ONSET)
  const vadOffset = ref(saved.vadOffset ?? DEFAULT_VAD_OFFSET)
  const alignOutput = ref(saved.alignOutput ?? DEFAULT_ALIGN_OUTPUT)
  const batchSize = ref(saved.batchSize ?? DEFAULT_BATCH_SIZE)
  const temperature = ref(saved.temperature ?? DEFAULT_TEMPERATURE)

  const activeSegmentId = ref<string | null>(null)

  const asrSettings = useAsrSettingsStore()

  const configWarning = computed(() => asrSettings.configWarning)

  const isBusy = computed(() =>
    ['extracting', 'uploading', 'transcribing'].includes(phase.value),
  )

  const canFill = computed(
    () =>
      !!videoFile.value &&
      segments.value.length > 0 &&
      asrSettings.canTranscribe &&
      !isBusy.value,
  )

  const canTranslate = computed(
    () =>
      segments.value.some((s) => s.text.trim()) &&
      phase.value !== 'translating' &&
      phase.value !== 'uploading',
  )

  function persistUi() {
    saveUi({
      sourceLanguage: sourceLanguage.value,
      autoExtractAudio: autoExtractAudio.value,
      fillMode: fillMode.value,
      mapPaddingSec: mapPaddingSec.value,
      clipPaddingSec: clipPaddingSec.value,
      clipGapSec: clipGapSec.value,
      vadOnset: vadOnset.value,
      vadOffset: vadOffset.value,
      alignOutput: alignOutput.value,
      batchSize: batchSize.value,
      temperature: temperature.value,
    })
  }

  function setVideo(file: File) {
    if (videoUrl.value) URL.revokeObjectURL(videoUrl.value)
    videoFile.value = file
    videoUrl.value = URL.createObjectURL(file)
    errorMessage.value = ''
    const kind = isVideoFile(file) ? '视频' : '音频'
    statusMessage.value = `已加载${kind}：${file.name}`
  }

  function clearVideo() {
    if (videoUrl.value) URL.revokeObjectURL(videoUrl.value)
    videoFile.value = null
    videoUrl.value = null
  }

  async function setTimelineFile(file: File) {
    if (!isTimelineFile(file)) {
      errorMessage.value = '请上传 .srt 或 .ass 字幕文件'
      throw new TimelineParseError(errorMessage.value)
    }
    const text = await file.text()
    try {
      const parsed = parseTimeline(text, file.name)
      segments.value = parsed
      srtFile.value = file
      srtFileName.value = file.name
      errorMessage.value = ''
      const empty = parsed.filter((s) => !s.text.trim()).length
      const fmt = file.name.toLowerCase().endsWith('.ass') || file.name.toLowerCase().endsWith('.ssa') ? 'ASS' : 'SRT'
      statusMessage.value = `已导入${fmt}时间轴：${file.name}（${parsed.length} 行${empty === parsed.length ? '，待填词' : ''}）`
    } catch (e) {
      if (e instanceof TimelineParseError) {
        errorMessage.value = e.message
      } else {
        errorMessage.value = e instanceof Error ? e.message : String(e)
      }
      throw e
    }
  }

  function clearSrt() {
    srtFile.value = null
    srtFileName.value = ''
    segments.value = []
  }

  function clearSession() {
    clearVideo()
    clearSrt()
    segments.value = []
    detectedLanguage.value = ''
    phase.value = 'idle'
    activeSegmentId.value = null
    statusMessage.value = '已清空'
    errorMessage.value = ''
  }

  function applyHandoff(payload: TimedAsrHandoffPayload) {
    segments.value = payload.segments.map((s) => ({
      ...s,
      text: '',
      translatedText: undefined,
      status: 'pending' as const,
    }))
    sourceLanguage.value = payload.sourceLanguage
    srtFileName.value = payload.mediaFileName
      ? `${payload.mediaFileName.replace(/\.[^.]+$/, '')}.auto-axis.srt`
      : 'auto-axis.srt'
    srtFile.value = null
    phase.value = 'idle'
    errorMessage.value = ''
    statusMessage.value = `已载入空轴 ${segments.value.length} 行（来自自动打轴）`
    persistUi()
  }

  async function resolveUploadFile(source: File): Promise<File> {
    if (!autoExtractAudio.value || !isVideoFile(source)) {
      return source
    }

    phase.value = 'extracting'
    extractProgress.value = 0
    statusMessage.value = '正在本机从视频提取音轨…'

    const audioFile = await extractAudioFromVideo(source, (p) => {
      extractProgress.value =
        p.phase === 'loading' ? Math.max(5, Math.round(p.percent * 0.2)) : 20 + Math.round(p.percent * 0.8)
    })

    statusMessage.value = `音轨已提取（${(audioFile.size / 1024 / 1024).toFixed(1)} MB），准备上传…`
    return audioFile
  }

  async function startFillFromAsr() {
    if (!videoFile.value || !segments.value.length) return

    if (!asrSettings.canTranscribe) {
      errorMessage.value = asrSettings.configWarning
      return
    }

    const sizeMb = videoFile.value.size / 1024 / 1024
    if (sizeMb > MAX_UPLOAD_MB && !(autoExtractAudio.value && isVideoFile(videoFile.value))) {
      errorMessage.value = `文件约 ${sizeMb.toFixed(0)} MB，超过建议上限 ${MAX_UPLOAD_MB} MB。可开启「视频抽音轨」。`
      return
    }

    persistUi()
    errorMessage.value = ''
    uploadProgress.value = 0

    const timelineSnapshot = segments.value.map((s) => ({
      ...s,
      text: '',
      translatedText: undefined,
      status: 'pending' as const,
    }))

    try {
      const audioFile = await resolveUploadFile(videoFile.value)

      let uploadFile = audioFile
      let concatSlots: Awaited<ReturnType<typeof buildConcatenatedTimelineAudio>>['slots'] | null =
        null

      if (fillMode.value === 'concat') {
        phase.value = 'extracting'
        extractProgress.value = 0
        statusMessage.value = `正在按 ${timelineSnapshot.length} 行时间轴切音并拼接…`

        const built = await buildConcatenatedTimelineAudio(audioFile, timelineSnapshot, {
          clipPaddingSec: clipPaddingSec.value,
          gapSec: clipGapSec.value,
          onProgress: (p) => {
            if (p.phase === 'clips') {
              extractProgress.value = Math.round((p.done / p.total) * 100)
              statusMessage.value = `切音拼接 ${p.done}/${p.total}…`
            } else if (p.phase === 'merge') {
              statusMessage.value = '正在合并拼接音轨…'
            }
          },
        })
        uploadFile = built.file
        concatSlots = built.slots
        statusMessage.value = `拼接完成（约 ${(uploadFile.size / 1024 / 1024).toFixed(1)} MB），准备上传…`
      }

      phase.value = asrSettings.isDeepgram ? 'transcribing' : 'uploading'
      statusMessage.value = asrSettings.isDeepgram
        ? `正在上传并转写（${asrSettings.activeProviderLabel}）…`
        : '正在上传音频到 Replicate…'

      const transcribeResult = await runTranscription({
        file: uploadFile,
        sourceLanguage: sourceLanguage.value,
        onUploadProgress: (p) => {
          uploadProgress.value = p
          if (asrSettings.isWhisperX && p >= 100) {
            phase.value = 'transcribing'
            statusMessage.value =
              fillMode.value === 'concat'
                ? '正在转写拼接音轨…'
                : '正在全片转写（WhisperX）…'
          }
        },
        whisperx: {
          alignOutput: alignOutput.value,
          diarization: false,
          vadOnset: fillMode.value === 'concat' ? 0.5 : vadOnset.value,
          vadOffset: fillMode.value === 'concat' ? 0.363 : vadOffset.value,
          batchSize: batchSize.value,
          temperature: temperature.value,
          language: sourceLanguage.value === 'auto' ? undefined : sourceLanguage.value,
        },
      })

      detectedLanguage.value = transcribeResult.detectedLanguage
      const units = extractTimedUnits(transcribeResult.segmentsRaw)
      if (!units.length) {
        throw new Error('转写结果中未找到带时间戳的文本单元')
      }

      const joiner =
        sourceLanguage.value === 'ja' ||
        (sourceLanguage.value === 'auto' && detectedLanguage.value.startsWith('ja'))
          ? ''
          : ' '

      if (fillMode.value === 'concat' && concatSlots) {
        segments.value = mapAsrToConcatSlots(timelineSnapshot, concatSlots, units, joiner)
      } else {
        segments.value = mapAsrToTimeline(timelineSnapshot, units, {
          paddingSec: mapPaddingSec.value,
          joiner,
        })
      }

      const empty = countUnmappedRows(segments.value)
      const modeLabel = fillMode.value === 'concat' ? '切音拼接' : '全片映射'
      phase.value = 'transcribed'
      statusMessage.value = `填词完成（${transcribeResult.providerLabel} · ${modeLabel}）：${segments.value.length} 行，${empty} 行未识别（语言 ${detectedLanguage.value || '未知'}）`
    } catch (e) {
      phase.value = 'error'
      segments.value = timelineSnapshot
      errorMessage.value = e instanceof Error ? e.message : String(e)
      statusMessage.value = '填词失败'
    }
  }

  async function startTranslate() {
    if (!segments.value.some((s) => s.text.trim())) return
    phase.value = 'translating'
    statusMessage.value = '正在翻译为中文…'
    errorMessage.value = ''

    try {
      await translateSegments(segments.value, (done, total) => {
        statusMessage.value = `翻译进度 ${done}/${total}`
      })
      phase.value = 'done'
      statusMessage.value = '翻译完成'
    } catch (e) {
      phase.value = 'transcribed'
      errorMessage.value = e instanceof Error ? e.message : String(e)
      statusMessage.value = '翻译失败'
    }
  }

  function setActiveByTime(time: number) {
    const list = segments.value
    if (!list.length) {
      activeSegmentId.value = null
      return
    }
    let seg = list.find((s) => time >= s.start && time < s.end)
    if (!seg && time >= list[list.length - 1]!.start) {
      seg = list[list.length - 1]
    }
    activeSegmentId.value = seg?.id ?? null
  }

  function seekToSegment(id: string) {
    activeSegmentId.value = id
  }

  return {
    videoFile,
    videoUrl,
    srtFile,
    srtFileName,
    segments,
    detectedLanguage,
    phase,
    statusMessage,
    uploadProgress,
    extractProgress,
    errorMessage,
    sourceLanguage,
    autoExtractAudio,
    fillMode,
    mapPaddingSec,
    clipPaddingSec,
    clipGapSec,
    vadOnset,
    vadOffset,
    alignOutput,
    batchSize,
    temperature,
    activeSegmentId,
    configWarning,
    isBusy,
    canFill,
    canTranslate,
    persistUi,
    setVideo,
    clearVideo,
    setTimelineFile,
    clearSrt,
    clearSession,
    applyHandoff,
    startFillFromAsr,
    startTranslate,
    setActiveByTime,
    seekToSegment,
  }
})
