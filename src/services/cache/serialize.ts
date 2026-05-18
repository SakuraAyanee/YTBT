import type { SubtitleSegment } from '@/types/subtitle'

/** 写入 IndexedDB 时去掉词级数组，减小体积并避免序列化失败 */
export function serializeSegmentsForCache(segments: SubtitleSegment[]): SubtitleSegment[] {
  return segments.map((s) => ({
    id: s.id,
    start: s.start,
    end: s.end,
    text: s.text,
    translatedText: s.translatedText,
    speaker: s.speaker,
    status: s.status,
  }))
}
