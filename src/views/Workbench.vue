<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppToolbar from '@/components/AppToolbar.vue'
import VideoDropZone from '@/components/VideoDropZone.vue'
import VideoPlayer from '@/components/VideoPlayer.vue'
import SubtitleTable from '@/components/SubtitleTable.vue'
import { useWorkbenchStore } from '@/stores/workbench'

const store = useWorkbenchStore()
const playerRef = ref<InstanceType<typeof VideoPlayer> | null>(null)
const restoring = ref(true)

function onSeek(id: string) {
  store.seekToSegment(id)
  playerRef.value?.seekTo(id)
}

onMounted(async () => {
  try {
    await store.bootstrap()
  } finally {
    restoring.value = false
  }
})
</script>

<template>
  <el-container class="workbench">
    <el-header height="auto" class="header">
      <AppToolbar />
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
        v-if="restoring"
        type="info"
        title="正在从本地草稿恢复…"
        show-icon
        :closable="false"
        class="alert"
      />
      <el-alert
        v-else-if="store.draftRestored && store.statusMessage"
        type="success"
        :title="store.statusMessage"
        show-icon
        class="alert"
      />
      <el-alert
        v-else-if="store.statusMessage && !store.errorMessage"
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
          <VideoDropZone />
          <VideoPlayer ref="playerRef" />
        </section>
        <section class="right">
          <SubtitleTable @seek="onSeek" />
        </section>
      </div>
    </el-main>
  </el-container>
</template>

<style scoped lang="scss">
.workbench {
  height: 100vh;
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
