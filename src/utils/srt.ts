import type { SubtitleSegment } from '@/types/subtitle'
import { formatSrtTime } from './time'

function lineText(seg: SubtitleSegment, mode: 'source' | 'translated' | 'bilingual'): string {
  const src = seg.speaker ? `[${seg.speaker}] ${seg.text}` : seg.text
  if (mode === 'source') return src
  const tr = seg.translatedText ?? ''
  if (mode === 'translated') {
    return seg.speaker && tr ? `[${seg.speaker}] ${tr}` : tr
  }
  if (!tr) return src
  return `${src}\n${tr}`
}

/** 导出空轴（仅时间，供 Aegisub / 轴先导填词） */
export function segmentsToEmptySrt(segments: SubtitleSegment[]): string {
  return segments
    .map((seg, i) => {
      return `${i + 1}\n${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}\n\n`
    })
    .join('\n')
}

export function segmentsToSrt(
  segments: SubtitleSegment[],
  mode: 'source' | 'translated' | 'bilingual' = 'bilingual',
): string {
  return segments
    .map((seg, i) => {
      const text = lineText(seg, mode)
      if (!text.trim()) return ''
      return `${i + 1}\n${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}\n${text}\n`
    })
    .filter(Boolean)
    .join('\n')
}

export function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
