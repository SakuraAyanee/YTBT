import type { SubtitleSegment } from '@/types/subtitle'

/** JieKou 等中转站上的模型名，需在控制台确认是否支持 */
const MODEL =
  import.meta.env.VITE_LLM_MODEL ||
  import.meta.env.VITE_OPENAI_MODEL ||
  'gpt-4o-mini'

const BATCH_SIZE = 20

/**
 * OpenAI 兼容 Chat Completions（常规模式，非 streaming）
 * 完整 URL（经 Vite 代理）：{VITE_LLM_API_BASE_URL}/v1/chat/completions
 */
const CHAT_COMPLETIONS_PATH = '/openai/v1/chat/completions'

const SYSTEM_PROMPT = `你是专业字幕翻译。将用户提供的 JSON 数组中的 text 字段翻译为简体中文口语化字幕。

要求：
- 译文自然、口语化，适合屏幕阅读
- 删除语气词、填充词（如嗯、啊、呃、那个、you know、um 等）
- 不要审查或替换脏话，如实翻译
- 保持原意；每条已是短字幕句，译文也请保持简短，一般不超过 18 个汉字或一行屏幕宽度
- 若原文含说话人标记可忽略，只翻译 text 内容

严格只返回 JSON 对象，格式：{"items":[{"id":"seg-1","translatedText":"..."}]}，id 与输入一致，不要 markdown 包裹。`

interface TranslateItem {
  id: string
  text: string
}

async function translateBatch(items: TranslateItem[]): Promise<Record<string, string>> {
  const res = await fetch(CHAT_COMPLETIONS_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            instruction: '翻译以下字幕条目',
            items,
          }),
        },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || '翻译 API 请求失败')
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
    error?: { message?: string }
  }

  if (data.error?.message) {
    throw new Error(data.error.message)
  }

  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('翻译返回为空')

  const parsed = JSON.parse(content) as
    | { items?: { id: string; translatedText: string }[] }
    | { id: string; translatedText: string }[]

  const list = Array.isArray(parsed) ? parsed : parsed.items ?? []
  const map: Record<string, string> = {}
  for (const row of list) {
    if (row.id && row.translatedText != null) {
      map[row.id] = row.translatedText
    }
  }
  return map
}

export async function translateSegments(
  segments: SubtitleSegment[],
  onBatchDone?: (done: number, total: number) => void,
): Promise<void> {
  const pending = segments.filter((s) => s.status !== 'done' || !s.translatedText)
  const total = pending.length
  let done = 0

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const chunk = pending.slice(i, i + BATCH_SIZE)
    chunk.forEach((s) => {
      s.status = 'translating'
    })

    const items = chunk.map((s) => ({ id: s.id, text: s.text }))
    const map = await translateBatch(items)

    for (const seg of chunk) {
      seg.translatedText = map[seg.id] ?? seg.translatedText ?? ''
      seg.status = map[seg.id] ? 'done' : 'error'
    }

    done += chunk.length
    onBatchDone?.(done, total)
  }
}
