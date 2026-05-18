<script setup lang="ts">
import { ref } from 'vue'
import { UploadFilled } from '@element-plus/icons-vue'
import { useAutoTimingStore } from '@/stores/autoTiming'

const store = useAutoTimingStore()
const mediaDrag = ref(false)

const MEDIA_ACCEPT = 'video/*,audio/*,.mp4,.mkv,.webm,.mov,.mp3,.wav,.m4a,.flac'

function pickMedia(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const okExt = ['mp4', 'mkv', 'webm', 'mov', 'mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg']
  if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
    if (!ext || !okExt.includes(ext)) return
  }
  store.setVideo(file)
}

function onMediaDrop(e: DragEvent) {
  e.preventDefault()
  mediaDrag.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) pickMedia(file)
}
</script>

<template>
  <div
    class="drop-zone"
    :class="{ 'is-over': mediaDrag, compact: !!store.videoUrl }"
    @dragover.prevent="mediaDrag = true"
    @dragleave.prevent="mediaDrag = false"
    @drop="onMediaDrop"
  >
    <template v-if="!store.videoUrl">
      <el-icon :size="40" color="var(--el-color-primary)"><UploadFilled /></el-icon>
      <p class="title">拖拽视频 / 音频</p>
      <p class="hint">将据此生成字幕时间轴（默认每行≤18 字）</p>
      <el-upload
        :auto-upload="false"
        :show-file-list="false"
        :accept="MEDIA_ACCEPT"
        @change="(f: { raw?: File }) => f.raw && pickMedia(f.raw)"
      >
        <el-button type="primary" size="small">选择媒体</el-button>
      </el-upload>
    </template>
    <template v-else>
      <p class="title">{{ store.videoFile?.name }}</p>
      <el-button size="small" @click="store.clearVideo()">更换</el-button>
    </template>
  </div>
</template>

<style scoped lang="scss">
.drop-zone {
  border: 2px dashed var(--el-border-color);
  border-radius: 12px;
  padding: 20px 16px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 120px;
  transition: border-color 0.2s, background 0.2s;

  &.compact {
    min-height: 72px;
  }

  &.is-over {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }

  .title {
    margin: 0;
    font-weight: 600;
    font-size: 14px;
  }

  .hint {
    margin: 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}
</style>
