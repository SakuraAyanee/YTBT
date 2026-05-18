<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import TimedAsrToolbar from '@/components/TimedAsrToolbar.vue'
import TimedAsrDropZone from '@/components/TimedAsrDropZone.vue'
import VideoPlayer from '@/components/VideoPlayer.vue'
import SubtitleTable from '@/components/SubtitleTable.vue'
import { useTimedAsrStore } from '@/stores/timedAsr'
import { readTimedAsrHandoff } from '@/stores/autoTiming'

const store = useTimedAsrStore()
const route = useRoute()
const playerRef = ref<InstanceType<typeof VideoPlayer> | null>(null)

onMounted(() => {
  if (route.query.from !== 'auto-timing') return
  const payload = readTimedAsrHandoff()
  if (!payload?.segments?.length) return
  store.applyHandoff(payload)
  ElMessage.success(
    `已载入自动打轴 ${payload.segments.length} 行，请重新选择同一媒体文件后点「按轴填词」`,
  )
})

function onSeek(id: string) {
  store.seekToSegment(id)
  playerRef.value?.seekTo(id)
}
</script>

<template>
  <el-container class="workbench">
    <el-header height="auto" class="header">
      <TimedAsrToolbar />
    </el-header>
    <el-main class="main">
      <el-alert
        v-if="store.configWarning"
        type="warning"
        :title="store.configWarning"
        show-icon
        :closable="false"
        class="alert"
      />
      <el-alert
        v-if="store.errorMessage"
        type="error"
        :title="store.errorMessage"
        show-icon
        closable
        class="alert"
        @close="store.errorMessage = ''"
      />
      <el-alert
        v-else-if="store.statusMessage"
        type="info"
        :title="store.statusMessage"
        show-icon
        class="alert"
      />
      <el-progress
        v-if="store.phase === 'extracting'"
        :percentage="store.extractProgress"
        :stroke-width="6"
        status="success"
        class="progress"
      />
      <el-progress
        v-else-if="store.phase === 'uploading'"
        :percentage="store.uploadProgress"
        :stroke-width="6"
        class="progress"
      />
      <div class="content">
        <section class="left">
          <TimedAsrDropZone />
          <VideoPlayer
            ref="playerRef"
            :video-url="store.videoUrl"
            :video-file="store.videoFile"
            :segments="store.segments"
            :active-segment-id="store.activeSegmentId"
            :on-time-update="store.setActiveByTime"
            :on-seek-segment="store.seekToSegment"
          />
        </section>
        <section class="right">
          <SubtitleTable
            :segments="store.segments"
            :active-segment-id="store.activeSegmentId"
            empty-text="导入 SRT 时间轴后显示；填词完成后可翻译"
            @seek="onSeek"
          />
        </section>
      </div>
    </el-main>
  </el-container>
</template>

<style scoped lang="scss">
.workbench {
  height: calc(100vh - 41px);
  background: var(--el-bg-color-page);
}

.header {
  padding: 0;
}

.main {
  display: flex;
  flex-direction: column;
  padding: 12px 16px;
  overflow: hidden;
}

.alert {
  margin-bottom: 8px;
  flex-shrink: 0;
}

.progress {
  margin-bottom: 8px;
  flex-shrink: 0;
}

.content {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  min-height: 0;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
}

.left {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.right {
  min-height: 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
  background: var(--el-bg-color);
}
</style>
