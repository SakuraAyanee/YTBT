/** Deepgram 预录 /listen 可选模型（见 Models & Languages 文档） */
export const DEEPGRAM_MODEL_OPTIONS = [
  { label: 'nova-2', value: 'nova-2' },
  { label: 'nova-3', value: 'nova-3' },
  { label: 'nova-2-general', value: 'nova-2-general' },
] as const

export const DEFAULT_DEEPGRAM_UI = {
  model: import.meta.env.VITE_DEEPGRAM_MODEL?.trim() || 'nova-2',
  /** 日语字幕建议关闭：易在词间插入空格 */
  smartFormat: false,
  punctuate: true,
  fillerWords: false,
  /** utterances 分段静音阈值（秒），越小断句越碎 */
  utteranceSplitSec: 0.8,
} as const

export interface DeepgramUiOptions {
  model: string
  smartFormat: boolean
  punctuate: boolean
  fillerWords: boolean
  utteranceSplitSec: number
}
