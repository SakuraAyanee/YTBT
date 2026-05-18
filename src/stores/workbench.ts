import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { JobPhase, SubtitleSegment } from '@/types/subtitle'
import { runTranscription } from '@/services/transcription'
import { useAsrSettingsStore } from '@/stores/asrSettings'
import { extractAudioFromVideo } from '@/services/audioExtract'
import { parseWhisperXSegments } from '@/utils/whisperxParser'
import { translateSegments } from '@/services/translate'
import { isVideoFile } from '@/utils/media'
import { MAX_UPLOAD_MB } from '@/constants/upload'
import {
  buildDraftKeys,
  clearWorkbenchDraft,
  computeFileKey,
  loadWorkbenchDraft,
  persistWorkbenchDraft,
  type DraftKeys,
} from '@/services/cache/draft'
import { loadUiDraft, saveUiDraft, type UiDraft } from '@/services/cache/uiDraft'
import {
  DEFAULT_MAX_SEGMENT_CHARS_CJK,
  type SourceLanguageOption,
} from '@/constants/subtitle'
import { setSubtitleSplitLimits } from '@/utils/subtitleSplitLimits'
import {
  DEFAULT_ALIGN_OUTPUT,
  DEFAULT_BATCH_SIZE,
  DEFAULT_TEMPERATURE,
  DEFAULT_VAD_OFFSET,
  DEFAULT_VAD_ONSET,
} from '@/constants/transcribe'

export const useWorkbenchStore = defineStore('workbench', () => {
  const videoFile = ref<File | null>(null)
  const videoUrl = ref<string | null>(null)
  const segments = ref<SubtitleSegment[]>([])
  const detectedLanguage = ref<string>('')
  const phase = ref<JobPhase>('idle')
  const statusMessage = ref('')
  const uploadProgress = ref(0)
  const extractProgress = ref(0)
  const errorMessage = ref('')

  const draftKeys = ref<DraftKeys | null>(null)
  const draftRestored = ref(false)
  const bootstrapDone = ref(false)

  const autoExtractAudio = ref(true)
  const enableDiarization = ref(true)
  const maxSegmentCharsCjk = ref(DEFAULT_MAX_SEGMENT_CHARS_CJK)
  const sourceLanguage = ref<SourceLanguageOption>('auto')
  const vadOnset = ref(DEFAULT_VAD_ONSET)
  const vadOffset = ref(DEFAULT_VAD_OFFSET)
  const alignOutput = ref(DEFAULT_ALIGN_OUTPUT)
  const batchSize = ref(DEFAULT_BATCH_SIZE)
  const temperature = ref(DEFAULT_TEMPERATURE)
  const initialPrompt = ref('')
  const minSpeakers = ref<number | null>(null)
  const maxSpeakers = ref<number | null>(null)
  const huggingfaceToken = ref(import.meta.env.VITE_HUGGINGFACE_TOKEN ?? '')

  const activeSegmentId = ref<string | null>(null)

  let persistTimer: ReturnType<typeof setTimeout> | null = null

  const asrSettings = useAsrSettingsStore()

  const configWarning = computed(() => asrSettings.configWarning)

  const isBusy = computed(() =>
    ['extracting', 'uploading', 'transcribing'].includes(phase.value),
  )

  const canTranscribe = computed(
    () => !!videoFile.value && asrSettings.canTranscribe && !isBusy.value,
  )
  const canTranslate = computed(
    () => segments.value.length > 0 && phase.value !== 'translating' && phase.value !== 'uploading',
  )

  function syncSubtitleSplitLimits() {
    setSubtitleSplitLimits({ maxCharsCjk: maxSegmentCharsCjk.value })
  }

  function uiDraftSnapshot(): UiDraft {
    return {
      autoExtractAudio: autoExtractAudio.value,
      enableDiarization: enableDiarization.value,
      maxSegmentCharsCjk: maxSegmentCharsCjk.value,
      sourceLanguage: sourceLanguage.value,
      vadOnset: vadOnset.value,
      vadOffset: vadOffset.value,
      alignOutput: alignOutput.value,
      batchSize: batchSize.value,
      temperature: temperature.value,
      initialPrompt: initialPrompt.value,
      minSpeakers: minSpeakers.value,
      maxSpeakers: maxSpeakers.value,
    }
  }

  function applyUiDraftFields(ui: Partial<UiDraft>) {
    if (ui.autoExtractAudio != null) autoExtractAudio.value = ui.autoExtractAudio
    if (ui.enableDiarization != null) enableDiarization.value = ui.enableDiarization
    if (ui.maxSegmentCharsCjk != null) maxSegmentCharsCjk.value = ui.maxSegmentCharsCjk
    if (ui.sourceLanguage != null) sourceLanguage.value = ui.sourceLanguage
    if (ui.vadOnset != null) vadOnset.value = ui.vadOnset
    if (ui.vadOffset != null) vadOffset.value = ui.vadOffset
    if (ui.alignOutput != null) alignOutput.value = ui.alignOutput
    if (ui.batchSize != null) batchSize.value = ui.batchSize
    if (ui.temperature != null) temperature.value = ui.temperature
    if (ui.initialPrompt != null) initialPrompt.value = ui.initialPrompt
    if (ui.minSpeakers !== undefined) minSpeakers.value = ui.minSpeakers
    if (ui.maxSpeakers !== undefined) maxSpeakers.value = ui.maxSpeakers
    syncSubtitleSplitLimits()
  }

  function transcribeFingerprintInput() {
    return {
      asrProvider: asrSettings.provider,
      deepgramUi: asrSettings.isDeepgram ? { ...asrSettings.deepgramUi } : undefined,
      alignOutput: alignOutput.value,
      diarization: enableDiarization.value,
      autoExtractAudio: autoExtractAudio.value,
      vadOnset: vadOnset.value,
      vadOffset: vadOffset.value,
      batchSize: batchSize.value,
      temperature: temperature.value,
      initialPrompt: initialPrompt.value.trim(),
      minSpeakers: minSpeakers.value,
      maxSpeakers: maxSpeakers.value,
      maxSegmentCharsCjk: maxSegmentCharsCjk.value,
      sourceLanguage: sourceLanguage.value,
    }
  }

  async function refreshDraftKeys(file: File) {
    const fileKey = await computeFileKey(file)
    draftKeys.value = buildDraftKeys(fileKey, transcribeFingerprintInput())
  }

  function schedulePersistDraft() {
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      void persistDraftNow()
    }, 600)
  }

  async function persistDraftNow() {
    if (!videoFile.value || !draftKeys.value) return
    try {
      await persistWorkbenchDraft({
        file: videoFile.value,
        keys: draftKeys.value,
        segments: segments.value,
        detectedLanguage: detectedLanguage.value,
        phase: phase.value,
        ui: uiDraftSnapshot(),
      })
    } catch (err) {
      console.warn('[YTBT] 草稿保存失败', err)
    }
  }

  function applyUiDraft() {
    const ui = loadUiDraft()
    if (!ui) {
      syncSubtitleSplitLimits()
      return
    }
    applyUiDraftFields(ui)
  }

  function mountVideoFile(file: File) {
    if (videoUrl.value) URL.revokeObjectURL(videoUrl.value)
    videoFile.value = file
    videoUrl.value = URL.createObjectURL(file)
  }

  function setVideo(file: File) {
    if (videoUrl.value) URL.revokeObjectURL(videoUrl.value)
    videoFile.value = file
    videoUrl.value = URL.createObjectURL(file)
    segments.value = []
    detectedLanguage.value = ''
    phase.value = 'idle'
    activeSegmentId.value = null
    extractProgress.value = 0
    errorMessage.value = ''
    draftRestored.value = false

    void refreshDraftKeys(file).then(() => {
      void persistDraftNow()
    })

    const kind = isVideoFile(file) ? '视频' : '音频'
    statusMessage.value = `已加载${kind}：${file.name}（${(file.size / 1024 / 1024).toFixed(1)} MB）`
  }

  function clearVideo() {
    if (videoUrl.value) URL.revokeObjectURL(videoUrl.value)
    videoFile.value = null
    videoUrl.value = null
    segments.value = []
    detectedLanguage.value = ''
    phase.value = 'idle'
    activeSegmentId.value = null
    extractProgress.value = 0
    draftKeys.value = null
    draftRestored.value = false
  }

  async function clearLocalDraft() {
    await clearWorkbenchDraft(draftKeys.value)
    clearVideo()
    statusMessage.value = '已清除本地草稿'
  }

  async function bootstrap() {
    if (bootstrapDone.value) return
    bootstrapDone.value = true
    applyUiDraft()

    const draft = await loadWorkbenchDraft()
    if (!draft) return

    mountVideoFile(draft.file)
    draftKeys.value = draft.keys
    segments.value = draft.segments
    detectedLanguage.value = draft.detectedLanguage
    phase.value = draft.phase
    draftRestored.value = true

    if (draft.ui) {
      applyUiDraftFields(draft.ui)
    }

    const kind = isVideoFile(draft.file) ? '视频' : '音频'
    if (draft.partial) {
      statusMessage.value = `已恢复视频：${draft.fileName}（${kind}）。字幕缓存未找到，请重新转写（无需再上传视频）。`
    } else {
      const translated = draft.segments.some((s) => s.translatedText)
      statusMessage.value = `已从本地草稿恢复：${draft.fileName}（${kind}，${draft.segments.length} 句${translated ? '，含译文' : ''}）`
    }
  }

  async function resolveUploadFile(source: File): Promise<File> {
    const shouldExtract = autoExtractAudio.value && isVideoFile(source)

    if (!shouldExtract) {
      return source
    }

    phase.value = 'extracting'
    extractProgress.value = 0
    statusMessage.value = '正在本机从视频提取音轨（首次需加载 ffmpeg，约数十秒）…'

    const audioFile = await extractAudioFromVideo(source, (p) => {
      extractProgress.value =
        p.phase === 'loading' ? Math.max(5, Math.round(p.percent * 0.2)) : 20 + Math.round(p.percent * 0.8)
      if (p.phase === 'loading') {
        statusMessage.value = '正在加载 ffmpeg 引擎…'
      } else {
        statusMessage.value = `正在提取音轨… ${p.percent}%`
      }
    })

    const origMb = source.size / 1024 / 1024
    const audioMb = audioFile.size / 1024 / 1024
    statusMessage.value = `音轨已提取：${audioMb.toFixed(1)} MB（原视频 ${origMb.toFixed(1)} MB），准备上传…`

    return audioFile
  }

  async function startTranscribe() {
    if (!videoFile.value) return

    if (!asrSettings.canTranscribe) {
      errorMessage.value = asrSettings.configWarning
      return
    }

    const sizeMb = videoFile.value.size / 1024 / 1024
    if (sizeMb > MAX_UPLOAD_MB && !(autoExtractAudio.value && isVideoFile(videoFile.value))) {
      errorMessage.value = `文件约 ${sizeMb.toFixed(0)} MB，超过建议上限 ${MAX_UPLOAD_MB} MB。可开启「视频抽音轨」或压缩后再试。`
    }

    if (
      asrSettings.isWhisperX &&
      enableDiarization.value &&
      !huggingfaceToken.value.trim()
    ) {
      errorMessage.value =
        '已开启说话人分离，请在顶栏填写 HuggingFace Token（需在 HF 接受 pyannote 用户协议）'
      return
    }

    await refreshDraftKeys(videoFile.value)

    errorMessage.value = ''
    uploadProgress.value = 0

    try {
      const uploadFile = await resolveUploadFile(videoFile.value)

      phase.value = asrSettings.isDeepgram ? 'transcribing' : 'uploading'
      statusMessage.value = asrSettings.isDeepgram
        ? `正在上传并转写（${asrSettings.activeProviderLabel}）…`
        : `正在上传${uploadFile.type.startsWith('audio/') ? '音频' : '媒体'}到 Replicate…`

      syncSubtitleSplitLimits()

      const fp = transcribeFingerprintInput()
      const result = await runTranscription({
        file: uploadFile,
        sourceLanguage: sourceLanguage.value,
        onUploadProgress: (p) => {
          uploadProgress.value = p
          if (asrSettings.isWhisperX && p >= 100) {
            phase.value = 'transcribing'
            statusMessage.value = '上传完成，正在转写（WhisperX）…'
          }
        },
        whisperx: {
          alignOutput: fp.alignOutput,
          diarization: fp.diarization,
          huggingfaceToken: huggingfaceToken.value.trim() || undefined,
          vadOnset: fp.vadOnset,
          vadOffset: fp.vadOffset,
          batchSize: fp.batchSize,
          temperature: fp.temperature,
          initialPrompt: fp.initialPrompt || undefined,
          minSpeakers: fp.minSpeakers ?? undefined,
          maxSpeakers: fp.maxSpeakers ?? undefined,
          language: sourceLanguage.value === 'auto' ? undefined : sourceLanguage.value,
        },
      })

      segments.value = parseWhisperXSegments(result.segmentsRaw)
      detectedLanguage.value = result.detectedLanguage
      phase.value = 'transcribed'
      statusMessage.value = `转写完成（${result.providerLabel}）：${segments.value.length} 句，语言 ${detectedLanguage.value || '未知'}`
      await persistDraftNow()
    } catch (e) {
      phase.value = 'error'
      errorMessage.value = e instanceof Error ? e.message : String(e)
      statusMessage.value = '转写失败'
    }
  }

  async function startTranslate() {
    if (!segments.value.length) return
    phase.value = 'translating'
    statusMessage.value = '正在翻译为中文…'
    errorMessage.value = ''

    try {
      await translateSegments(segments.value, (done, total) => {
        statusMessage.value = `翻译进度 ${done}/${total}`
        schedulePersistDraft()
      })
      phase.value = 'done'
      statusMessage.value = '翻译完成'
      await persistDraftNow()
    } catch (e) {
      phase.value = 'transcribed'
      errorMessage.value = e instanceof Error ? e.message : String(e)
      statusMessage.value = '翻译失败'
      await persistDraftNow()
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

  watch(
    [
      autoExtractAudio,
      enableDiarization,
      maxSegmentCharsCjk,
      sourceLanguage,
      vadOnset,
      vadOffset,
      alignOutput,
      batchSize,
      temperature,
      initialPrompt,
      minSpeakers,
      maxSpeakers,
    ],
    () => {
      syncSubtitleSplitLimits()
      saveUiDraft(uiDraftSnapshot())
      if (videoFile.value) {
        void refreshDraftKeys(videoFile.value)
      }
    },
  )

  watch(
    () => [segments.value, phase.value, detectedLanguage.value] as const,
    () => schedulePersistDraft(),
    { deep: true },
  )

  return {
    videoFile,
    videoUrl,
    segments,
    detectedLanguage,
    phase,
    statusMessage,
    uploadProgress,
    extractProgress,
    errorMessage,
    autoExtractAudio,
    enableDiarization,
    maxSegmentCharsCjk,
    sourceLanguage,
    vadOnset,
    vadOffset,
    alignOutput,
    batchSize,
    temperature,
    initialPrompt,
    minSpeakers,
    maxSpeakers,
    huggingfaceToken,
    activeSegmentId,
    draftRestored,
    configWarning,
    canTranscribe,
    canTranslate,
    setVideo,
    clearVideo,
    clearLocalDraft,
    bootstrap,
    startTranscribe,
    startTranslate,
    setActiveByTime,
    seekToSegment,
  }
})
