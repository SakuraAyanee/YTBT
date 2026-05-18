<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import type { SubtitleSegment } from '@/types/subtitle'
import { useWorkbenchStore } from '@/stores/workbench'
import { isAudioFile } from '@/utils/media'

const props = defineProps<{
  videoUrl?: string | null
  videoFile?: File | null
  segments?: SubtitleSegment[]
  activeSegmentId?: string | null
  onTimeUpdate?: (time: number) => void
  onSeekSegment?: (id: string) => void
}>()

const workbench = useWorkbenchStore()
const videoRef = ref<HTMLVideoElement | null>(null)
const currentSubtitle = ref('')

const resolvedUrl = computed(() => props.videoUrl ?? workbench.videoUrl)
const resolvedFile = computed(() => props.videoFile ?? workbench.videoFile)
const resolvedSegments = computed(() => props.segments ?? workbench.segments)
const resolvedActiveId = computed(() => props.activeSegmentId ?? workbench.activeSegmentId)

const isAudioOnly = computed(() => {
  const f = resolvedFile.value
  return f ? isAudioFile(f) : false
})

function onTimeUpdate() {
  const v = videoRef.value
  if (!v) return
  if (props.onTimeUpdate) {
    props.onTimeUpdate(v.currentTime)
  } else {
    workbench.setActiveByTime(v.currentTime)
  }
  const seg = resolvedSegments.value.find((s) => s.id === resolvedActiveId.value)
  currentSubtitle.value = seg ? seg.translatedText || seg.text : ''
}

function seekTo(id: string) {
  const seg = resolvedSegments.value.find((s) => s.id === id)
  if (seg && videoRef.value) {
    videoRef.value.currentTime = seg.start
    if (props.onSeekSegment) {
      props.onSeekSegment(id)
    } else {
      workbench.seekToSegment(id)
    }
  }
}

defineExpose({ seekTo })

onUnmounted(() => {
  videoRef.value?.pause()
})
</script>

<template>
  <div v-if="resolvedUrl" class="player-shell" :class="{ 'is-audio': isAudioOnly }">
    <div class="player-inner">
      <video
        ref="videoRef"
        class="video"
        :src="resolvedUrl"
        controls
        playsinline
        @timeupdate="onTimeUpdate"
      />
    </div>
    <div v-if="currentSubtitle" class="overlay">{{ currentSubtitle }}</div>
    <div v-if="isAudioOnly" class="audio-badge">音频预览</div>
  </div>
  <el-empty v-else description="请先导入视频或音频" class="player-empty" />
</template>

<style scoped lang="scss">
.player-shell {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
  overflow: hidden;

  &.is-audio {
    flex: 0 0 auto;
    min-height: unset;

    .player-inner {
      min-height: 72px;
      max-height: 96px;
    }
  }
}

.player-inner {
  flex: 1;
  min-height: 120px;
  max-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color);

  .video {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    display: block;
  }
}

.overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 48px;
  padding: 8px 16px;
  text-align: center;
  color: #fff;
  font-size: 18px;
  line-height: 1.4;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
  pointer-events: none;
}

.audio-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 2px 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-bg-color);
  border-radius: 4px;
  border: 1px solid var(--el-border-color-lighter);
  pointer-events: none;
}

.player-empty {
  flex: 1;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}
</style>
