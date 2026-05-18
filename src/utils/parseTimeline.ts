import type { SubtitleSegment } from '@/types/subtitle'
import { parseAss } from '@/utils/parseAss'
import { parseSrt } from '@/utils/parseSrt'
import { TimelineParseError } from '@/utils/subtitleParseShared'

export { TimelineParseError, SrtParseError } from '@/utils/subtitleParseShared'

const TIMELINE_EXT = new Set(['srt', 'ass', 'ssa'])

export function isTimelineFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return TIMELINE_EXT.has(ext)
}

export function parseTimeline(content: string, fileName: string): SubtitleSegment[] {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'ass' || ext === 'ssa') {
    return parseAss(content)
  }
  if (ext === 'srt') {
    return parseSrt(content)
  }
  throw new TimelineParseError('不支持的字幕格式，请使用 .srt 或 .ass（Aegisub 导出）')
}
