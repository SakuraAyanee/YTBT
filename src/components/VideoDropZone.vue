<script setup lang="ts">
import { ref } from 'vue'
import { UploadFilled } from '@element-plus/icons-vue'
import { useWorkbenchStore } from '@/stores/workbench'

const store = useWorkbenchStore()
const dragOver = ref(false)

const ACCEPT = 'video/*,audio/*,.mp4,.mkv,.webm,.mov,.mp3,.wav,.m4a,.flac'

function pickFile(file: File) {
  if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    const ok = ['mp4', 'mkv', 'webm', 'mov', 'mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg']
    if (!ext || !ok.includes(ext)) return
  }
  store.setVideo(file)
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) pickFile(file)
}

function onUploadChange(uploadFile: { raw?: File }) {
  if (uploadFile.raw) pickFile(uploadFile.raw)
}
</script>

<template>
  <div
    class="drop-zone"
    :class="{ 'is-over': dragOver, 'has-video': !!store.videoUrl }"
    @dragover.prevent="dragOver = true"
    @dragleave.prevent="dragOver = false"
    @drop="onDrop"
  >
    <template v-if="!store.videoUrl">
      <el-icon :size="48" color="var(--el-color-primary)"><UploadFilled /></el-icon>
      <p class="title">拖拽视频或音频到此处</p>
      <p class="hint">视频将自动抽取音轨后上传（更小、更快）；纯音频直接上传</p>
      <el-upload
        :auto-upload="false"
        :show-file-list="false"
        :accept="ACCEPT"
        @change="onUploadChange"
      >
        <el-button type="primary">选择文件</el-button>
      </el-upload>
    </template>
    <template v-else>
      <p class="title">{{ store.videoFile?.name }}</p>
      <el-button size="small" @click="store.clearVideo()">更换文件</el-button>
    </template>
  </div>
</template>

<style scoped lang="scss">
.drop-zone {
  border: 2px dashed var(--el-border-color);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  transition: border-color 0.2s, background 0.2s;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;

  &.is-over {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }

  &.has-video {
    min-height: 64px;
  }

  .title {
    margin: 0;
    font-weight: 600;
  }

  .hint {
    margin: 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}
</style>
