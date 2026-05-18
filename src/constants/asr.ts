export type AsrProvider = 'whisperx' | 'deepgram'

export const ASR_PROVIDER_OPTIONS = [
  {
    value: 'whisperx' as const,
    label: 'WhisperX',
    description: 'Replicate · 支持说话人分离、VAD 等',
  },
  {
    value: 'deepgram' as const,
    label: 'Deepgram Nova-2',
    description: 'api.deepgram.com · 预录转写，词级时间戳',
  },
]

/** @deprecated 使用 constants/deepgram.ts */
export { DEFAULT_DEEPGRAM_UI } from '@/constants/deepgram'
