import type { SourceLanguageOption } from '@/constants/subtitle'
import type { DeepgramUiOptions } from '@/constants/deepgram'
import { DEFAULT_DEEPGRAM_UI } from '@/constants/deepgram'
import { parseDeepgramResponse } from '@/utils/deepgramParser'

const API = '/deepgram/v1'

export interface DeepgramTranscribeOptions {
  model?: string
  language?: SourceLanguageOption
  deepgramUi?: DeepgramUiOptions
  onUploadProgress?: (pct: number) => void
}

function mimeForFile(file: File): string {
  if (file.type) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    flac: 'audio/flac',
    ogg: 'audio/ogg',
    webm: 'audio/webm',
    mp4: 'video/mp4',
  }
  return map[ext ?? ''] ?? 'audio/mpeg'
}

function resolveDeepgramUi(partial?: DeepgramUiOptions): DeepgramUiOptions {
  return {
    model: partial?.model ?? DEFAULT_DEEPGRAM_UI.model,
    smartFormat: partial?.smartFormat ?? DEFAULT_DEEPGRAM_UI.smartFormat,
    punctuate: partial?.punctuate ?? DEFAULT_DEEPGRAM_UI.punctuate,
    fillerWords: partial?.fillerWords ?? DEFAULT_DEEPGRAM_UI.fillerWords,
    utteranceSplitSec: partial?.utteranceSplitSec ?? DEFAULT_DEEPGRAM_UI.utteranceSplitSec,
  }
}

function buildListenQuery(options: DeepgramTranscribeOptions): string {
  const ui = resolveDeepgramUi(options.deepgramUi)
  const params = new URLSearchParams({
    model: options.model ?? ui.model,
    utterances: 'true',
    utt_split: String(ui.utteranceSplitSec),
  })

  if (ui.smartFormat) {
    params.set('smart_format', 'true')
  }
  if (ui.punctuate) {
    params.set('punctuate', 'true')
  }
  if (ui.fillerWords) {
    params.set('filler_words', 'true')
  }

  const lang = options.language
  if (lang && lang !== 'auto') {
    params.set('language', lang)
  } else {
    params.set('detect_language', 'true')
  }

  return params.toString()
}

function parseApiError(status: number, body: string): string {
  if (status === 401) {
    return 'Deepgram 认证失败 (401)：请检查 .env.local 中的 VITE_DEEPGRAM_API_KEY'
  }
  try {
    const json = JSON.parse(body) as { err_msg?: string; error?: string; message?: string }
    return json.err_msg || json.error || json.message || body
  } catch {
    return body || `Deepgram 请求失败 (${status})`
  }
}

/**
 * 预录转写
 * @see https://developers.deepgram.com/reference/speech-to-text/listen-pre-recorded
 */
export async function transcribeAudioWithDeepgram(
  file: File,
  options: DeepgramTranscribeOptions = {},
): Promise<{ segments: unknown[]; detectedLanguage: string }> {
  const query = buildListenQuery(options)
  const url = `${API}/listen?${query}`
  const contentType = mimeForFile(file)
  const body = await file.arrayBuffer()
  const languageHint = options.language && options.language !== 'auto' ? options.language : undefined

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.setRequestHeader('Content-Type', contentType)

    if (options.onUploadProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          options.onUploadProgress!(Math.round((e.loaded / e.total) * 100))
        }
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText) as Parameters<typeof parseDeepgramResponse>[0]
          const parsed = parseDeepgramResponse(json, languageHint)
          if (!parsed.segments.length) {
            reject(new Error('Deepgram 未返回带时间戳的字幕片段，请检查音频或语言设置'))
            return
          }
          resolve(parsed)
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)))
        }
        return
      }
      reject(new Error(parseApiError(xhr.status, xhr.responseText)))
    }

    xhr.onerror = () => reject(new Error('Deepgram 网络请求失败'))
    xhr.send(body)
  })
}
