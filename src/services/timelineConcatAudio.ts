import { fetchFile } from '@ffmpeg/util'
import type { SubtitleSegment } from '@/types/subtitle'
import { getSharedFFmpeg } from '@/services/ffmpegClient'
import { getFileExtension } from '@/utils/media'
import {
  DEFAULT_CLIP_GAP_SEC,
  DEFAULT_CLIP_PADDING_SEC,
  MIN_CLIP_DURATION_SEC,
} from '@/constants/timedAsr'

export interface ConcatSlot {
  segmentId: string
  concatStart: number
  concatEnd: number
}

export interface BuildConcatResult {
  file: File
  slots: ConcatSlot[]
}

export interface BuildConcatProgress {
  phase: 'prepare' | 'clips' | 'merge'
  done: number
  total: number
}

/**
 * 按字幕行切音并拼接（行间静音），供单次 WhisperX；映射用 concat 时间轴。
 */
export async function buildConcatenatedTimelineAudio(
  audioFile: File,
  timeline: SubtitleSegment[],
  options: {
    clipPaddingSec?: number
    gapSec?: number
    onProgress?: (p: BuildConcatProgress) => void
  } = {},
): Promise<BuildConcatResult> {
  const pad = options.clipPaddingSec ?? DEFAULT_CLIP_PADDING_SEC
  const gap = options.gapSec ?? DEFAULT_CLIP_GAP_SEC
  const total = timeline.length

  options.onProgress?.({ phase: 'prepare', done: 0, total })

  const ff = await getSharedFFmpeg()
  const ext = getFileExtension(audioFile.name) || 'mp3'
  const inputName = `timeline_src.${ext}`

  await ff.writeFile(inputName, await fetchFile(audioFile))

  await ff.exec([
    '-f',
    'lavfi',
    '-i',
    'anullsrc=r=16000:cl=mono',
    '-t',
    String(gap),
    '-acodec',
    'libmp3lame',
    '-ab',
    '64k',
    '-ar',
    '16000',
    'gap.mp3',
  ])

  const slots: ConcatSlot[] = []
  const concatLines: string[] = []
  let cursor = 0

  for (let i = 0; i < timeline.length; i++) {
    const row = timeline[i]!
    const ss = Math.max(0, row.start - pad)
    const clipEnd = row.end + pad
    let dur = Math.max(MIN_CLIP_DURATION_SEC, clipEnd - ss)

    const clipName = `clip_${String(i).padStart(4, '0')}.mp3`
    await ff.exec([
      '-ss',
      String(ss),
      '-i',
      inputName,
      '-t',
      String(dur),
      '-acodec',
      'libmp3lame',
      '-ab',
      '64k',
      '-ar',
      '16000',
      '-ac',
      '1',
      clipName,
    ])

    slots.push({
      segmentId: row.id,
      concatStart: cursor,
      concatEnd: cursor + dur,
    })
    cursor += dur

    concatLines.push(`file '${clipName}'`)
    if (i < timeline.length - 1) {
      concatLines.push(`file 'gap.mp3'`)
      cursor += gap
    }

    options.onProgress?.({ phase: 'clips', done: i + 1, total })
  }

  await ff.writeFile('concat_list.txt', concatLines.join('\n'))

  options.onProgress?.({ phase: 'merge', done: total, total })

  await ff.exec([
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    'concat_list.txt',
    '-acodec',
    'libmp3lame',
    '-ab',
    '64k',
    '-ar',
    '16000',
    '-ac',
    '1',
    'timeline_concat.mp3',
  ])

  const data = await ff.readFile('timeline_concat.mp3')
  const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data))
  const blob = new Blob([Uint8Array.from(bytes)], { type: 'audio/mpeg' })
  const base = audioFile.name.replace(/\.[^.]+$/i, '')
  const file = new File([blob], `${base}.timeline.mp3`, { type: 'audio/mpeg' })

  return { file, slots }
}
