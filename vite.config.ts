import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

/** JieKou AI 默认基址，与 OpenAI Chat Completions 路径兼容 */
const DEFAULT_LLM_BASE = 'https://api.jiekou.ai/openai'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const replicateToken = env.VITE_REPLICATE_API_TOKEN || env.REPLICATE_API_TOKEN
  const llmApiKey = env.VITE_LLM_API_KEY || env.VITE_OPENAI_API_KEY
  const llmBaseUrl = (env.VITE_LLM_API_BASE_URL || DEFAULT_LLM_BASE).replace(/\/$/, '')
  const deepgramKey = env.VITE_DEEPGRAM_API_KEY

  if (!replicateToken || replicateToken === 'r8_xxx') {
    console.warn(
      '\n[YTBT] 未检测到有效的 VITE_REPLICATE_API_TOKEN，WhisperX 上传将返回 401。\n' +
        '请在 .env.local 填写后重启 npm run dev。\n',
    )
  }

  return {
    plugins: [vue()],
    optimizeDeps: {
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/replicate': {
          target: 'https://api.replicate.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/replicate/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              if (!replicateToken) return
              // Files API 文档部分示例使用 Token 前缀，其余端点用 Bearer
              const isFiles = req.url?.startsWith('/v1/files')
              const scheme = isFiles ? 'Token' : 'Bearer'
              proxyReq.setHeader('Authorization', `${scheme} ${replicateToken}`)
            })
          },
        },
        // /openai/v1/chat/completions → {LLM_BASE}/v1/chat/completions
        // 例：https://api.jiekou.ai/openai/v1/chat/completions
        '/deepgram': {
          target: 'https://api.deepgram.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/deepgram/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (deepgramKey) {
                proxyReq.setHeader('Authorization', `Token ${deepgramKey}`)
              }
            })
          },
        },
        '/openai': {
          target: llmBaseUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/openai/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (llmApiKey) {
                proxyReq.setHeader('Authorization', `Bearer ${llmApiKey}`)
              }
            })
          },
        },
      },
    },
  }
})
