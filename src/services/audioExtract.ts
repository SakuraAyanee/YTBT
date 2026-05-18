import { fetchFile } from '@ffmpeg/util'
import { getSharedFFmpeg } from '@/services/ffmpegClient'
import { getFileExtension } from '@/utils/media'

export interface ExtractProgress {
  phase: 'loading' | 'extracting'
  percent: number
}

/**
 * 在浏览器内从视频提取单声道 MP3（16kHz / 64kbps），供 WhisperX 上传。
 */
export async function extractAudioFromVideo(
  videoFile: File,
  onProgress?: (p: ExtractProgress) => void,
): Promise<File> {
  onProgress?.({ phase: 'loading', percent: 0 })
  const ff = await getSharedFFmpeg()
  onProgress?.({ phase: 'loading', percent: 100 })

  const inputExt = getFileExtension(videoFile.name) || 'mp4'
  const inputName = `input.${inputExt}`
  const outputName = 'output.mp3'

  const progressHandler = ({ progress }: { progress: number }) => {
    const pct = Math.min(99, Math.round((progress ?? 0) * 100))
    onProgress?.({ phase: 'extracting', percent: pct })
  }

  ff.on('progress', progressHandler)

  try {
    await ff.writeFile(inputName, await fetchFile(videoFile))
    await ff.exec([
      '-i',
      inputName,
      '-vn',
      '-acodec',
      'libmp3lame',
      '-ab',
      '64k',
      '-ar',
      '16000',
      '-ac',
      '1',
      outputName,
    ])

    const data = await ff.readFile(outputName)
    const bytes =
      data instanceof Uint8Array ? data : new TextEncoder().encode(String(data))
    const blob = new Blob([Uint8Array.from(bytes)], { type: 'audio/mpeg' })

    const baseName = videoFile.name.replace(/\.[^.]+$/i, '')
    onProgress?.({ phase: 'extracting', percent: 100 })

    return new File([blob], `${baseName}.mp3`, { type: 'audio/mpeg' })
  } finally {
    ff.off('progress', progressHandler)
  }
}
