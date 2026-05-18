export interface TimedUnit {
  start: number
  end: number
  text: string
  speaker?: string
}

interface WhisperXWord {
  word?: string
  start?: number
  end?: number
  speaker?: string
}

interface WhisperXSegment {
  start?: number
  end?: number
  text?: string
  speaker?: string
  words?: WhisperXWord[]
}

function overlapDuration(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
}

/** 从 WhisperX 原始 segments 提取词级单元；无词级则回退到段级 */
export function extractTimedUnits(raw: unknown): TimedUnit[] {
  const list = Array.isArray(raw) ? (raw as WhisperXSegment[]) : []
  const units: TimedUnit[] = []

  for (const seg of list) {
    if (seg.start == null || seg.end == null) continue

    const words = seg.words?.filter((w) => w.word?.trim() && w.start != null && w.end != null)
    if (words?.length) {
      for (const w of words) {
        units.push({
          start: w.start!,
          end: w.end!,
          text: w.word!.trim(),
          speaker: w.speaker ?? seg.speaker,
        })
      }
      continue
    }

    const text = seg.text?.trim()
    if (!text) continue
    units.push({
      start: seg.start,
      end: seg.end,
      text,
      speaker: seg.speaker,
    })
  }

  return units.sort((a, b) => a.start - b.start || a.end - b.end)
}

export { overlapDuration }
