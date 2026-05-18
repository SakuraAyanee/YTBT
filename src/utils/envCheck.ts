const PLACEHOLDERS = new Set(['', 'r8_xxx', 'your_token_here', 'sk-xxx'])

export function isReplicateTokenConfigured(): boolean {
  const token = import.meta.env.VITE_REPLICATE_API_TOKEN?.trim()
  return !!token && !PLACEHOLDERS.has(token)
}

export function isLlmApiKeyConfigured(): boolean {
  const key = (import.meta.env.VITE_LLM_API_KEY || import.meta.env.VITE_OPENAI_API_KEY)?.trim()
  return !!key && !PLACEHOLDERS.has(key) && key !== '你的JieKou密钥'
}

export function replicateTokenHint(): string {
  if (isReplicateTokenConfigured()) return ''
  return '未配置有效的 VITE_REPLICATE_API_TOKEN，请在 .env.local 填写后重启 dev 服务'
}

export function isDeepgramTokenConfigured(): boolean {
  const token = import.meta.env.VITE_DEEPGRAM_API_KEY?.trim()
  return !!token && !PLACEHOLDERS.has(token) && token !== '你的Deepgram密钥'
}

export function deepgramTokenHint(): string {
  if (isDeepgramTokenConfigured()) return ''
  return '未配置有效的 VITE_DEEPGRAM_API_KEY，请在 .env.local 填写后重启 dev 服务（见 https://console.deepgram.com ）'
}
