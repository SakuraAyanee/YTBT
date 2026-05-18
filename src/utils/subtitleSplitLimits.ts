import {
  DEFAULT_MAX_SEGMENT_CHARS_CJK,
  DEFAULT_MAX_SEGMENT_CHARS_LATIN,
} from '@/constants/subtitle'

export interface SubtitleSplitLimits {
  maxCharsCjk: number
  maxCharsLatin: number
}

const state: SubtitleSplitLimits = {
  maxCharsCjk: DEFAULT_MAX_SEGMENT_CHARS_CJK,
  maxCharsLatin: DEFAULT_MAX_SEGMENT_CHARS_LATIN,
}

export function setSubtitleSplitLimits(partial: Partial<SubtitleSplitLimits>) {
  if (partial.maxCharsCjk != null) {
    state.maxCharsCjk = partial.maxCharsCjk
    state.maxCharsLatin = Math.round(partial.maxCharsCjk * (DEFAULT_MAX_SEGMENT_CHARS_LATIN / DEFAULT_MAX_SEGMENT_CHARS_CJK))
  }
  if (partial.maxCharsLatin != null) {
    state.maxCharsLatin = partial.maxCharsLatin
  }
}

export function getSubtitleSplitLimits(): SubtitleSplitLimits {
  return { ...state }
}
