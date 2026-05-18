import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { AsrProvider } from '@/constants/asr'
import {
  DEFAULT_DEEPGRAM_UI,
  type DeepgramUiOptions,
} from '@/constants/deepgram'
import {
  isReplicateTokenConfigured,
  isDeepgramTokenConfigured,
  replicateTokenHint,
  deepgramTokenHint,
} from '@/utils/envCheck'

const PROVIDER_KEY = 'ytbt:asr-provider'
const DEEPGRAM_UI_KEY = 'ytbt:deepgram-ui'

function loadProvider(): AsrProvider {
  try {
    const raw = localStorage.getItem(PROVIDER_KEY)
    if (raw === 'whisperx' || raw === 'deepgram') return raw
  } catch {
    /* ignore */
  }
  return 'whisperx'
}

function loadDeepgramUi(): DeepgramUiOptions {
  try {
    const raw = localStorage.getItem(DEEPGRAM_UI_KEY)
    if (!raw) return { ...DEFAULT_DEEPGRAM_UI }
    const p = JSON.parse(raw) as Partial<DeepgramUiOptions>
    return {
      model: p.model ?? DEFAULT_DEEPGRAM_UI.model,
      smartFormat: p.smartFormat ?? DEFAULT_DEEPGRAM_UI.smartFormat,
      punctuate: p.punctuate ?? DEFAULT_DEEPGRAM_UI.punctuate,
      fillerWords: p.fillerWords ?? DEFAULT_DEEPGRAM_UI.fillerWords,
      utteranceSplitSec: p.utteranceSplitSec ?? DEFAULT_DEEPGRAM_UI.utteranceSplitSec,
    }
  } catch {
    return { ...DEFAULT_DEEPGRAM_UI }
  }
}

export const useAsrSettingsStore = defineStore('asrSettings', () => {
  const provider = ref<AsrProvider>(loadProvider())
  const deepgramUi = ref<DeepgramUiOptions>(loadDeepgramUi())

  const isWhisperX = computed(() => provider.value === 'whisperx')
  const isDeepgram = computed(() => provider.value === 'deepgram')

  const activeProviderLabel = computed(() =>
    provider.value === 'deepgram'
      ? `Deepgram ${deepgramUi.value.model}`
      : 'WhisperX',
  )

  const transcribeButtonLabel = computed(() =>
    provider.value === 'deepgram'
      ? `${deepgramUi.value.model} 转写`
      : 'WhisperX 转写',
  )

  const configWarning = computed(() => {
    if (isWhisperX.value && !isReplicateTokenConfigured()) {
      return replicateTokenHint()
    }
    if (isDeepgram.value && !isDeepgramTokenConfigured()) {
      return deepgramTokenHint()
    }
    return ''
  })

  const canTranscribe = computed(() => {
    if (isWhisperX.value) return isReplicateTokenConfigured()
    return isDeepgramTokenConfigured()
  })

  function persistDeepgramUi() {
    try {
      localStorage.setItem(DEEPGRAM_UI_KEY, JSON.stringify(deepgramUi.value))
    } catch {
      /* ignore */
    }
  }

  watch(
    deepgramUi,
    () => {
      persistDeepgramUi()
    },
    { deep: true },
  )

  watch(provider, (v) => {
    try {
      localStorage.setItem(PROVIDER_KEY, v)
    } catch {
      /* ignore */
    }
  })

  return {
    provider,
    deepgramUi,
    isWhisperX,
    isDeepgram,
    activeProviderLabel,
    transcribeButtonLabel,
    configWarning,
    canTranscribe,
    persistDeepgramUi,
  }
})
