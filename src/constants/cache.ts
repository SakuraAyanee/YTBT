export const TRANSLATE_PROMPT_VERSION = 1
export const TARGET_TRANSLATE_LANG = 'zh'

export const WHISPERX_VERSION =
  import.meta.env.VITE_WHISPERX_VERSION ||
  'victor-upmeet/whisperx:655845d6190ef70573c669245f245892cd039df4b880a1e3a65852c09252f5cc'

export const DEEPGRAM_MODEL =
  import.meta.env.VITE_DEEPGRAM_MODEL?.trim() || 'nova-2'
