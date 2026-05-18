/** 默认每行最大字数（CJK） */
export const DEFAULT_MAX_SEGMENT_CHARS_CJK = 26

/** 默认每行最大字数（拉丁语系，随 CJK 比例推算） */
export const DEFAULT_MAX_SEGMENT_CHARS_LATIN = 48

/** 单条字幕最长持续时间（秒） */
export const MAX_SEGMENT_DURATION_SEC = 8

/** 句末标点断句前至少已有多少字 */
export const MIN_CHARS_BEFORE_PUNCT_SPLIT = 10

/** 合并过短片段：CJK */
export const MIN_SEGMENT_CHARS_CJK = 6

/** 合并过短片段：拉丁语系 */
export const MIN_SEGMENT_CHARS_LATIN = 10

/** 字幕切分逻辑版本（变更后旧缓存自动失效） */
export const SEGMENT_LOGIC_VERSION = 3

export const SOURCE_LANGUAGE_OPTIONS = [
  { label: '自动检测', value: 'auto' },
  { label: '日语 ja', value: 'ja' },
  { label: '英语 en', value: 'en' },
  { label: '中文 zh', value: 'zh' },
  { label: '韩语 ko', value: 'ko' },
] as const

export type SourceLanguageOption = (typeof SOURCE_LANGUAGE_OPTIONS)[number]['value']
