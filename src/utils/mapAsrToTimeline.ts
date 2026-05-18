import type { SubtitleSegment } from '@/types/subtitle'
import {
  DEFAULT_MAP_PADDING_SEC,
  DEFAULT_MIN_OVERLAP_RATIO,
} from '@/constants/timedAsr'
import type { ConcatSlot } from '@/services/timelineConcatAudio'
import { type TimedUnit, overlapDuration } from '@/utils/whisperxUnits'

export interface MapAsrOptions {
  /** 搜索窗口向两侧扩展（秒），不改变行的 start/end */
  paddingSec?: number
  minOverlapRatio?: number
  /** 拼接单元时的连接符；英语等建议空格，日语可传 '' */
  joiner?: string
}

function unitOverlapWithWindow(
  unit: TimedUnit,
  rowStart: number,
  rowEnd: number,
  minRatio: number,
): number {
  const dur = overlapDuration(unit.start, unit.end, rowStart, rowEnd)
  if (dur <= 0) return 0
  const unitLen = Math.max(unit.end - unit.start, 0.001)
  if (minRatio > 0 && dur / unitLen < minRatio) return 0
  return dur
}

function joinUnits(units: TimedUnit[], joiner: string): string {
  if (!units.length) return ''
  let out = ''
  for (const u of units) {
    const t = u.text.trim()
    if (!t) continue
    if (!out) {
      out = t
      continue
    }
    const needsSpace =
      joiner === ' ' &&
      /[A-Za-z0-9]$/.test(out) &&
      /^[A-Za-z0-9]/.test(t)
    out += (needsSpace ? ' ' : joiner) + t
  }
  return out.trim()
}

/**
 * 路径 B：按轴切音拼接后的 concat 时间轴 → 填回各行
 */
export function mapAsrToConcatSlots(
  timeline: SubtitleSegment[],
  slots: ConcatSlot[],
  units: TimedUnit[],
  joiner = ' ',
): SubtitleSegment[] {
  const assignments = new Map<string, TimedUnit[]>()
  for (const slot of slots) {
    assignments.set(slot.segmentId, [])
  }

  for (const unit of units) {
    const center = (unit.start + unit.end) / 2
    const slot = slots.find((s) => center >= s.concatStart && center < s.concatEnd)
    if (slot) {
      assignments.get(slot.segmentId)!.push(unit)
    }
  }

  return timeline.map((row) => {
    const picked = assignments.get(row.id) ?? []
    picked.sort((a, b) => a.start - b.start || a.end - b.end)
    return {
      ...row,
      start: row.start,
      end: row.end,
      text: joinUnits(picked, joiner),
      status: 'pending' as const,
    }
  })
}

/**
 * 路径 A：全片听写 + 按行重叠捞字（中心点落在行内才纳入，减少串行）
 */
export function mapAsrToTimeline(
  timeline: SubtitleSegment[],
  units: TimedUnit[],
  options: MapAsrOptions = {},
): SubtitleSegment[] {
  const padding = options.paddingSec ?? DEFAULT_MAP_PADDING_SEC
  const minRatio = options.minOverlapRatio ?? DEFAULT_MIN_OVERLAP_RATIO
  const joiner = options.joiner ?? ' '

  const assignments = new Map<string, TimedUnit[]>()
  for (const row of timeline) {
    assignments.set(row.id, [])
  }

  for (const unit of units) {
    const center = (unit.start + unit.end) / 2
    for (const row of timeline) {
      const winStart = row.start - padding
      const winEnd = row.end + padding
      if (center < winStart || center >= winEnd) continue
      const ov = unitOverlapWithWindow(unit, winStart, winEnd, minRatio)
      if (ov > 0) {
        assignments.get(row.id)!.push(unit)
        break
      }
    }
  }

  return timeline.map((row) => {
    const picked = assignments.get(row.id) ?? []
    picked.sort((a, b) => a.start - b.start || a.end - b.end)
    const speakers = [...new Set(picked.map((u) => u.speaker).filter(Boolean))]
    return {
      ...row,
      start: row.start,
      end: row.end,
      text: joinUnits(picked, joiner),
      speaker: speakers.length === 1 ? speakers[0] : row.speaker,
      status: 'pending' as const,
    }
  })
}

export function countUnmappedRows(segments: SubtitleSegment[]): number {
  return segments.filter((s) => !s.text.trim()).length
}
