const VIDEO_EXTENSIONS = new Set([
  'mp4',
  'mkv',
  'webm',
  'mov',
  'avi',
  'flv',
  'wmv',
  'm4v',
])

const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg', 'opus', 'wma'])

export function getFileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

export function isVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) return true
  return VIDEO_EXTENSIONS.has(getFileExtension(file.name))
}

export function isAudioFile(file: File): boolean {
  if (file.type.startsWith('audio/')) return true
  return AUDIO_EXTENSIONS.has(getFileExtension(file.name))
}
