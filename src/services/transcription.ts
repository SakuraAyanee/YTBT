import type { SourceLanguageOption } from '@/constants/subtitle'
import { useAsrSettingsStore } from '@/stores/asrSettings'
import {
  uploadFileToReplicate,
  createTranscription,
  pollPrediction,
  type TranscribeOptions,
} from '@/services/replicate'
import { transcribeAudioWithDeepgram } from '@/services/deepgram'

export interface RunTranscriptionResult {
  segmentsRaw: unknown
  detectedLanguage: string
  providerLabel: string
}

export interface RunTranscriptionParams {
  file: File
  sourceLanguage: SourceLanguageOption
  onUploadProgress?: (pct: number) => void
  whisperx: TranscribeOptions
}

export async function runTranscription(
  params: RunTranscriptionParams,
): Promise<RunTranscriptionResult> {
  const asr = useAsrSettingsStore()

  if (asr.isDeepgram) {
    const dg = asr.deepgramUi
    const { segments, detectedLanguage } = await transcribeAudioWithDeepgram(params.file, {
      language: params.sourceLanguage,
      deepgramUi: dg,
      onUploadProgress: params.onUploadProgress,
    })
    return {
      segmentsRaw: segments,
      detectedLanguage,
      providerLabel: `Deepgram ${dg.model}`,
    }
  }

  const fileUrl = await uploadFileToReplicate(params.file, params.onUploadProgress)
  const prediction = await createTranscription(fileUrl, params.whisperx)
  const final = await pollPrediction(prediction.id)

  if (final.status !== 'succeeded' || !final.output?.segments) {
    throw new Error(
      typeof final.error === 'string'
        ? final.error
        : final.error
          ? JSON.stringify(final.error)
          : 'WhisperX 转写失败',
    )
  }

  return {
    segmentsRaw: final.output.segments,
    detectedLanguage: final.output.detected_language ?? '',
    providerLabel: 'WhisperX',
  }
}
