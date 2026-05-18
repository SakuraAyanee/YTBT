import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

const CORE_VERSION = '0.12.6'
const CORE_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`

let ffmpeg: FFmpeg | null = null
let loadPromise: Promise<FFmpeg> | null = null

export async function getSharedFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg?.loaded) return ffmpeg

  if (!loadPromise) {
    loadPromise = (async () => {
      const instance = new FFmpeg()
      await instance.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      ffmpeg = instance
      return instance
    })()
  }

  return loadPromise
}
