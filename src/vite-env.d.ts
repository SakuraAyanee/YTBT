/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REPLICATE_API_TOKEN: string
  readonly VITE_WHISPERX_VERSION: string
  readonly VITE_LLM_API_BASE_URL: string
  readonly VITE_LLM_API_KEY: string
  readonly VITE_LLM_MODEL: string
  readonly VITE_HUGGINGFACE_TOKEN: string
  readonly VITE_MAX_UPLOAD_MB: string
  /** @deprecated 使用 VITE_LLM_API_KEY */
  readonly VITE_OPENAI_API_KEY: string
  /** @deprecated 使用 VITE_LLM_MODEL */
  readonly VITE_OPENAI_MODEL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
