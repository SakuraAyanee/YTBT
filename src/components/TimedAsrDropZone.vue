<script setup lang="ts">
import { ref } from 'vue'
import { UploadFilled, Document } from '@element-plus/icons-vue'
import { useTimedAsrStore } from '@/stores/timedAsr'
import { isTimelineFile } from '@/utils/parseTimeline'
import { ElMessage } from 'element-plus'

const store = useTimedAsrStore()
const mediaDrag = ref(false)
const timelineDrag = ref(false)

const MEDIA_ACCEPT = 'video/*,audio/*,.mp4,.mkv,.webm,.mov,.mp3,.wav,.m4a,.flac'
const TIMELINE_ACCEPT = '.srt,.ass,.ssa,text/plain'

function pickMedia(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const okExt = ['mp4', 'mkv', 'webm', 'mov', 'mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg']
  if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
    if (!ext || !okExt.includes(ext)) return
  }
  store.setVideo(file)
}

async function pickTimeline(file: File) {
  if (!isTimelineFile(file)) {
    ElMessage.warning('请上传 .srt 或 .ass 文件')
    return
  }
  try {
    await store.setTimelineFile(file)
  } catch {
    /* store 已设置 errorMessage */
  }
}

function onMediaDrop(e: DragEvent) {
  e.preventDefault()
  mediaDrag.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) pickMedia(file)
}

function onTimelineDrop(e: DragEvent) {
  e.preventDefault()
  timelineDrag.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) void pickTimeline(file)
}
</script>

<template>
  <div class="drop-row">
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

    <div
      class="drop-zone"
      :class="{ 'is-over': timelineDrag, compact: !!store.srtFileName }"
      @dragover.prevent="timelineDrag = true"
      @dragleave.prevent="timelineDrag = false"
      @drop="onTimelineDrop"
    >
      <template v-if="!store.srtFileName">
        <el-icon :size="40" color="var(--el-color-success)"><Document /></el-icon>
        <p class="title">拖拽空轴 SRT / ASS</p>
        <p class="hint">Aegisub 导出 .ass 或 .srt，仅时间轴即可</p>
        <el-upload
          :auto-upload="false"
          :show-file-list="false"
          :accept="TIMELINE_ACCEPT"
          @change="(f: { raw?: File }) => f.raw && pickTimeline(f.raw)"
        >
          <el-button type="success" size="small">选择字幕</el-button>
        </el-upload>
      </template>
      <template v-else>
        <p class="title">{{ store.srtFileName }}</p>
        <p class="hint">{{ store.segments.length }} 行</p>
        <el-button size="small" @click="store.clearSrt()">更换</el-button>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.drop-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
}

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
  min-height: 140px;
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
