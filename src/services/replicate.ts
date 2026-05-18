const API = '/replicate/v1'

/**
 * 非官方模型必须用 POST /v1/predictions + version，不能用 /models/{owner}/{name}/predictions
 * @see https://replicate.com/docs/reference/http#predictions.create
 * Latest: https://replicate.com/victor-upmeet/whisperx/versions/655845d6...
 */
const WHISPERX_VERSION =
  import.meta.env.VITE_WHISPERX_VERSION ||
  'victor-upmeet/whisperx:655845d6190ef70573c669245f245892cd039df4b880a1e3a65852c09252f5cc'

export interface TranscribeOptions {
  language?: string | null
  alignOutput?: boolean
  diarization?: boolean
  huggingfaceToken?: string
  /** VAD 更敏感可产生更多短段（API 默认 0.5） */
  vadOnset?: number
  /** 更短静音即断句（API 默认 0.363） */
  vadOffset?: number
  batchSize?: number
  temperature?: number
  initialPrompt?: string
  minSpeakers?: number
  maxSpeakers?: number
}

export interface PredictionResponse {
  id: string
  status: string
  output?: {
    segments?: unknown
    detected_language?: string
  }
  error?: string | null
  logs?: string
}

function parseApiError(status: number, body: string): string {
  const lower = body.toLowerCase()
  if (
    status === 413 ||
    lower.includes('file too large') ||
    lower.includes('too large') ||
    lower.includes('entity too large')
  ) {
    return (
      '文件过大，Replicate 拒绝上传。可尝试：本机用 ffmpeg 只提取音频（mp3/m4a）、降低分辨率/码率，' +
      '或换用 whisperx-a40-large 模型；超大文件需先传到对象存储再以 URL 传入（见文档说明）。'
    )
  }
  if (status === 404) {
    return (
      'Replicate 接口或模型版本未找到 (404)。请确认 VITE_WHISPERX_VERSION 是否正确，' +
      '或在 replicate.com/victor-upmeet/whisperx/versions 复制最新版本 ID。'
    )
  }
  if (status === 401) {
    return (
      'Replicate 认证失败 (401)：请检查 .env.local 中的 VITE_REPLICATE_API_TOKEN 是否为有效密钥（r8_ 开头），' +
      '保存后重启 npm run dev。'
    )
  }
  try {
    const json = JSON.parse(body) as { detail?: string; title?: string }
    if (json.detail) return json.detail
    if (json.title) return json.title
  } catch {
    /* 非 JSON */
  }
  return body || `请求失败 (${status})`
}

async function replicateJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, init)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(parseApiError(res.status, body))
  }
  return res.json() as Promise<T>
}

export async function uploadFileToReplicate(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const form = new FormData()
  form.append('content', file, file.name)
  form.append('filename', file.name)
  if (file.type) {
    form.append('type', file.type)
  }

  onProgress?.(0)

  const res = await fetch(`${API}/files`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(parseApiError(res.status, body))
  }

  const data = (await res.json()) as { urls?: { get?: string } }
  const url = data.urls?.get
  if (!url) throw new Error('上传成功但未返回文件 URL')
  onProgress?.(100)
  return url
}

export async function createTranscription(
  audioUrl: string,
  options: TranscribeOptions = {},
): Promise<PredictionResponse> {
  const input: Record<string, unknown> = {
    audio_file: audioUrl,
    align_output: options.alignOutput ?? true,
    diarization: options.diarization ?? true,
    task: 'transcribe',
    vad_onset: options.vadOnset ?? 0.45,
    vad_offset: options.vadOffset ?? 0.28,
    batch_size: options.batchSize ?? 64,
    temperature: options.temperature ?? 0,
  }

  // 自动检测语言：不传 language（API 不接受 null，见 whisperx/api schema）
  if (options.language) {
    input.language = options.language
  }

  const prompt = options.initialPrompt?.trim()
  if (prompt) {
    input.initial_prompt = prompt
  }

  if (options.diarization && options.huggingfaceToken) {
    input.huggingface_access_token = options.huggingfaceToken
  }

  if (options.diarization) {
    if (options.minSpeakers != null && options.minSpeakers > 0) {
      input.min_speakers = options.minSpeakers
    }
    if (options.maxSpeakers != null && options.maxSpeakers > 0) {
      input.max_speakers = options.maxSpeakers
    }
  }

  return replicateJson<PredictionResponse>('/predictions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: WHISPERX_VERSION,
      input,
    }),
  })
}

export async function getPrediction(id: string): Promise<PredictionResponse> {
  return replicateJson<PredictionResponse>(`/predictions/${id}`)
}

export async function pollPrediction(
  id: string,
  onTick?: (p: PredictionResponse) => void,
  intervalMs = 2000,
): Promise<PredictionResponse> {
  for (;;) {
    const p = await getPrediction(id)
    onTick?.(p)
    if (p.status === 'succeeded' || p.status === 'failed' || p.status === 'canceled') {
      return p
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}
