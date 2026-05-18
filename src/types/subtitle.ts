export interface SubtitleWord {
  word: string
  start: number
  end: number
  score?: number
  speaker?: string
}

export interface SubtitleSegment {
  id: string
  start: number
  end: number
  text: string
  translatedText?: string
  speaker?: string
  words?: SubtitleWord[]
  status: 'pending' | 'translating' | 'done' | 'error'
}

export type JobPhase =
  | 'idle'
  | 'extracting'
  | 'uploading'
  | 'transcribing'
  | 'transcribed'
  | 'translating'
  | 'done'
  | 'error'

/** 与 JobPhase 相同，供缓存模块使用 */
export type WorkbenchPhase = JobPhase
