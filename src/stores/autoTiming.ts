import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import router from '@/router'
import type { JobPhase, SubtitleSegment } from '@/types/subtitle'
import { runTranscription } from '@/services/transcription'
import { useAsrSettingsStore } from '@/stores/asrSettings'
import { extractAudioFromVideo } from '@/services/audioExtract'
import { extractTimedUnits } from '@/utils/whisperxUnits'
import { buildTimelineFromUnits } from '@/utils/buildTimelineFromUnits'
import { isVideoFile } from '@/utils/media'
import { MAX_UPLOAD_MB } from '@/constants/upload'
import type { SourceLanguageOption } from '@/constants/subtitle'
import {
  DEFAULT_ALIGN_OUTPUT,
  DEFAULT_BATCH_SIZE,
  DEFAULT_TEMPERATURE,
  DEFAULT_VAD_OFFSET,
  DEFAULT_VAD_ONSET,
} from '@/constants/transcribe'
import {
  AUTO_TIMING_UI_KEY,
  DEFAULT_AUTO_TIMING_MAX_CHARS,
  DEFAULT_END_PADDING_SEC,
  DEFAULT_GAP_THRESHOLD_SEC,
  DEFAULT_MAX_LINE_DURATION_SEC,
  DEFAULT_MIN_CHARS_PER_LINE,
  TIMED_ASR_HANDOFF_KEY,
} from '@/constants/autoTiming'
import { segmentsToEmptySrt, segmentsToSrt, downloadText } from '@/utils/srt'

interface AutoTimingUiDraft {
  sourceLanguage: SourceLanguageOption
  autoExtractAudio: boolean
  maxCharsPerLine: number
  gapThresholdSec: number
  maxLineDurationSec: number
  minCharsPerLine: number
  endPaddingSec: number
  keepAsrTextInTable: boolean
  vadOnset: number
  vadOffset: number
  alignOutput: boolean
  batchSize: number
  temperature: number
}

export interface TimedAsrHandoffPayload {
  segments: SubtitleSegment[]
  sourceLanguage: SourceLanguageOption
  mediaFileName: string
}

function loadUi(): Partial<AutoTimingUiDraft> {
  try {
    const raw = localStorage.getItem(AUTO_TIMING_UI_KEY)
    return raw ? (JSON.parse(raw) as Partial<AutoTimingUiDraft>) : {}
  } catch {
    return {}
  }
}

function saveUi(draft: AutoTimingUiDraft) {
  try {
    localStorage.setItem(AUTO_TIMING_UI_KEY, JSON.stringify(draft))
  } catch {
    /* ignore */
  }
}

export function readTimedAsrHandoff(): TimedAsrHandoffPayload | null {
  try {
    const raw = sessionStorage.getItem(TIMED_ASR_HANDOFF_KEY)
    if (!raw) return null
    sessionStorage.removeItem(TIMED_ASR_HANDOFF_KEY)
    return JSON.parse(raw) as TimedAsrHandoffPayload
  } catch {
    return null
  }
}

export const useAutoTimingStore = defineStore('autoTiming', () => {
  const saved = loadUi()

  const videoFile = ref<File | null>(null)
  const videoUrl = ref<string | null>(null)
  const segments = ref<SubtitleSegment[]>([])
  /** 打轴前的 ASR 单元（调参后本地重算轴，无需重新上传） */
  const asrUnits = ref<ReturnType<typeof extractTimedUnits>>([])
  const detectedLanguage = ref('')
  const phase = ref<JobPhase>('idle')
  const statusMessage = ref('')
  const uploadProgress = ref(0)
  const extractProgress = ref(0)
  const errorMessage = ref('')

  const sourceLanguage = ref<SourceLanguageOption>(saved.sourceLanguage ?? 'ja')
  const autoExtractAudio = ref(saved.autoExtractAudio ?? true)
  const maxCharsPerLine = ref(saved.maxCharsPerLine ?? DEFAULT_AUTO_TIMING_MAX_CHARS)
  const gapThresholdSec = ref(saved.gapThresholdSec ?? DEFAULT_GAP_THRESHOLD_SEC)
  const maxLineDurationSec = ref(saved.maxLineDurationSec ?? DEFAULT_MAX_LINE_DURATION_SEC)
  const minCharsPerLine = ref(saved.minCharsPerLine ?? DEFAULT_MIN_CHARS_PER_LINE)
  const endPaddingSec = ref(saved.endPaddingSec ?? DEFAULT_END_PADDING_SEC)
  const keepAsrTextInTable = ref(saved.keepAsrTextInTable ?? true)
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

  const canAutoTime = computed(
    () => !!videoFile.value && asrSettings.canTranscribe && !isBusy.value,
  )

  const canRebuild = computed(() => asrUnits.value.length > 0 && !isBusy.value)

  const joiner = computed(() => {
    const lang = sourceLanguage.value === 'auto' ? detectedLanguage.value : sourceLanguage.value
    return lang.startsWith('ja') || lang.startsWith('zh') || lang.startsWith('ko') ? '' : ' '
  })

  function persistUi() {
    saveUi({
      sourceLanguage: sourceLanguage.value,
      autoExtractAudio: autoExtractAudio.value,
      maxCharsPerLine: maxCharsPerLine.value,
      gapThresholdSec: gapThresholdSec.value,
      maxLineDurationSec: maxLineDurationSec.value,
      minCharsPerLine: minCharsPerLine.value,
      endPaddingSec: endPaddingSec.value,
      keepAsrTextInTable: keepAsrTextInTable.value,
      vadOnset: vadOnset.value,
      vadOffset: vadOffset.value,
      alignOutput: alignOutput.value,
      batchSize: batchSize.value,
      temperature: temperature.value,
    })
  }

  function applyTimelineFromUnits() {
    const built = buildTimelineFromUnits(asrUnits.value, {
      maxCharsPerLine: maxCharsPerLine.value,
      gapThresholdSec: gapThresholdSec.value,
      maxLineDurationSec: maxLineDurationSec.value,
      minCharsPerLine: minCharsPerLine.value,
      endPaddingSec: endPaddingSec.value,
      joiner: joiner.value,
    })
    if (!keepAsrTextInTable.value) {
      segments.value = built.map((s) => ({ ...s, text: '' }))
    } else {
      segments.value = built
    }
    return built.length
  }

  function setVideo(file: File) {
    if (videoUrl.value) URL.revokeObjectURL(videoUrl.value)
    videoFile.value = file
    videoUrl.value = URL.createObjectURL(file)
    asrUnits.value = []
    segments.value = []
    detectedLanguage.value = ''
    errorMessage.value = ''
    const kind = isVideoFile(file) ? '视频' : '音频'
    statusMessage.value = `已加载${kind}：${file.name}`
  }

  function clearVideo() {
    if (videoUrl.value) URL.revokeObjectURL(videoUrl.value)
    videoFile.value = null
    videoUrl.value = null
    asrUnits.value = []
    segments.value = []
  }

  function clearSession() {
    clearVideo()
    detectedLanguage.value = ''
    phase.value = 'idle'
    activeSegmentId.value = null
    statusMessage.value = '已清空'
    errorMessage.value = ''
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

  async function startAutoTiming() {
    if (!videoFile.value) return

    if (!asrSettings.canTranscribe) {
      errorMessage.value = asrSettings.configWarning
      return
    }

    if (!alignOutput.value && asrSettings.isWhisperX) {
      errorMessage.value = '自动打轴需要词级时间戳，请开启「词级对齐 align_output」'
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
    asrUnits.value = []
    segments.value = []

    try {
      const audioFile = await resolveUploadFile(videoFile.value)

      phase.value = asrSettings.isDeepgram ? 'transcribing' : 'uploading'
      statusMessage.value = asrSettings.isDeepgram
        ? `正在上传并转写（${asrSettings.activeProviderLabel}）…`
        : '正在上传音频到 Replicate…'

      const transcribeResult = await runTranscription({
        file: audioFile,
        sourceLanguage: sourceLanguage.value,
        onUploadProgress: (p) => {
          uploadProgress.value = p
          if (asrSettings.isWhisperX && p >= 100) {
            phase.value = 'transcribing'
            statusMessage.value = '正在全片转写（需词级对齐）…'
          }
        },
        whisperx: {
          alignOutput: alignOutput.value,
          diarization: false,
          vadOnset: vadOnset.value,
          vadOffset: vadOffset.value,
          batchSize: batchSize.value,
          temperature: temperature.value,
          language: sourceLanguage.value === 'auto' ? undefined : sourceLanguage.value,
        },
      })

      detectedLanguage.value = transcribeResult.detectedLanguage
      const units = extractTimedUnits(transcribeResult.segmentsRaw)
      if (!units.length) {
        throw new Error(
          '转写结果中未找到带时间戳的单元。WhisperX 请开启词级对齐；Deepgram 请使用 utterances。',
        )
      }

      asrUnits.value = units
      const lineCount = applyTimelineFromUnits()

      phase.value = 'transcribed'
      const wordLevel = units.some((u, i) => i === 0 || u.end - u.start < 8)
      statusMessage.value =
        `自动打轴完成（${transcribeResult.providerLabel}）：${lineCount} 行，` +
        `${units.length} 个时间单元；每行≤${maxCharsPerLine.value} 字` +
        (wordLevel ? '' : '（提示：未检测到词级时间戳，轴精度可能下降）')
    } catch (e) {
      phase.value = 'error'
      errorMessage.value = e instanceof Error ? e.message : String(e)
      statusMessage.value = '自动打轴失败'
    }
  }

  function rebuildTimeline() {
    if (!asrUnits.value.length) return
    persistUi()
    const n = applyTimelineFromUnits()
    statusMessage.value = `已按当前参数重算时间轴：${n} 行`
  }

  function exportEmptySrt() {
    const empty = segments.value.map((s) => ({ ...s, text: '' }))
    return segmentsToEmptySrt(empty)
  }

  function downloadEmptySrt() {
    if (!segments.value.length) return false
    const base = videoFile.value?.name.replace(/\.[^.]+$/, '') ?? 'timeline'
    downloadText(`${base}.empty-axis.srt`, exportEmptySrt())
    return true
  }

  function downloadReferenceSrt() {
    if (!segments.value.length) return false
    const base = videoFile.value?.name.replace(/\.[^.]+$/, '') ?? 'timeline'
    downloadText(`${base}.axis-reference.srt`, segmentsToSrt(segments.value, 'source'))
    return true
  }

  function handoffToTimedAsr() {
    if (!segments.value.length) return
    const payload: TimedAsrHandoffPayload = {
      segments: segments.value.map((s) => ({
        ...s,
        text: '',
        translatedText: undefined,
        status: 'pending',
      })),
      sourceLanguage: sourceLanguage.value,
      mediaFileName: videoFile.value?.name ?? '',
    }
    sessionStorage.setItem(TIMED_ASR_HANDOFF_KEY, JSON.stringify(payload))
    void router.push({ path: '/timed-asr', query: { from: 'auto-timing' } })
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
    segments,
    asrUnits,
    detectedLanguage,
    phase,
    statusMessage,
    uploadProgress,
    extractProgress,
    errorMessage,
    sourceLanguage,
    autoExtractAudio,
    maxCharsPerLine,
    gapThresholdSec,
    maxLineDurationSec,
    minCharsPerLine,
    endPaddingSec,
    keepAsrTextInTable,
    vadOnset,
    vadOffset,
    alignOutput,
    batchSize,
    temperature,
    activeSegmentId,
    configWarning,
    isBusy,
    canAutoTime,
    canRebuild,
    persistUi,
    setVideo,
    clearVideo,
    clearSession,
    startAutoTiming,
    rebuildTimeline,
    exportEmptySrt,
    downloadEmptySrt,
    downloadReferenceSrt,
    handoffToTimedAsr,
    setActiveByTime,
    seekToSegment,
  }
})
