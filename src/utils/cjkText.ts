const CJK =
  /[\u3040-\u309f\u30a0-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff66-\uff9d]/

/** 是否主要为 CJK 文本（用于拼接/去空格） */
export function isMostlyCjkText(text: string): boolean {
  const cjk = (text.match(CJK) || []).length
  const latin = (text.match(/[A-Za-z]/g) || []).length
  return cjk > 0 && cjk >= latin
}

/**
 * Deepgram 日语等常在词级 token 间带空格；合并为字幕文本时去掉 CJK 之间的空格。
 */
export function normalizeCjkTranscript(text: string): string {
  let s = text.trim()
  if (!s) return s
  if (!isMostlyCjkText(s)) return s

  s = s.replace(/([\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff])\s+(?=[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff])/g, '$1')
  s = s.replace(/([、。！？，．…])\s+/g, '$1')
  return s.trim()
}

export function joinTokensForLanguage(tokens: string[], language?: string): string {
  const filtered = tokens.map((t) => t.trim()).filter(Boolean)
  if (!filtered.length) return ''
  const sample = filtered.join('')
  const noSpace =
    language === 'ja' ||
    language === 'zh' ||
    language === 'ko' ||
    isMostlyCjkText(sample)
  return noSpace ? filtered.join('') : filtered.join(' ')
}
