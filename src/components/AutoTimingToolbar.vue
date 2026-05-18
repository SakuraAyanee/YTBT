<script setup lang="ts">
import { useAutoTimingStore } from '@/stores/autoTiming'
import { useAsrSettingsStore } from '@/stores/asrSettings'
import { SOURCE_LANGUAGE_OPTIONS } from '@/constants/subtitle'
import {
  VAD_ONSET_MIN,
  VAD_ONSET_MAX,
  VAD_OFFSET_MIN,
  VAD_OFFSET_MAX,
} from '@/constants/transcribe'
import {
  DEFAULT_AUTO_TIMING_MAX_CHARS,
  DEFAULT_GAP_THRESHOLD_SEC,
} from '@/constants/autoTiming'
import { ElMessage } from 'element-plus'

const store = useAutoTimingStore()
const asr = useAsrSettingsStore()

function onExportEmpty() {
  if (!store.downloadEmptySrt()) {
    ElMessage.warning('请先完成自动打轴')
    return
  }
  ElMessage.success('已导出空轴 SRT')
}

function onExportRef() {
  if (!store.downloadReferenceSrt()) {
    ElMessage.warning('请先完成自动打轴')
    return
  }
  ElMessage.success('已导出对照稿 SRT')
}

function onHandoff() {
  if (!store.segments.length) {
    ElMessage.warning('请先完成自动打轴')
    return
  }
  store.handoffToTimedAsr()
}

function onSettingsChange() {
  store.persistUi()
  if (store.asrUnits.length) {
    store.rebuildTimeline()
  }
}
</script>

<template>
  <div class="toolbar">
    <div class="toolbar-main">
      <div class="brand">自动打轴</div>
      <p class="hint">
        词级转写 → 按停顿与每行字数生成时间轴；默认实况模式每行≤18 字。导出空轴后到「轴先导填词」填日文。
      </p>
      <div class="actions">
        <el-button
          type="primary"
          :loading="store.isBusy"
          :disabled="!store.canAutoTime"
          @click="store.startAutoTiming()"
        >
          {{ asr.isDeepgram ? 'Nova 自动打轴' : 'WhisperX 自动打轴' }}
        </el-button>
        <el-button :disabled="!store.canRebuild" @click="store.rebuildTimeline()">
          重算时间轴
        </el-button>
        <el-button plain @click="store.clearSession()">清空</el-button>
        <el-dropdown trigger="click">
          <el-button :disabled="!store.segments.length">导出 SRT</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="onExportEmpty">空轴（填词用）</el-dropdown-item>
              <el-dropdown-item @click="onExportRef">对照稿（含识别字）</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button type="success" plain :disabled="!store.segments.length" @click="onHandoff">
          带到轴先导填词
        </el-button>
      </div>
    </div>

    <div class="toolbar-settings">
      <span class="setting-label">源语言</span>
      <el-select
        v-model="store.sourceLanguage"
        size="small"
        style="width: 120px"
        @change="onSettingsChange"
      >
        <el-option
          v-for="opt in SOURCE_LANGUAGE_OPTIONS"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
      <el-checkbox v-model="store.autoExtractAudio" label="视频抽音轨" @change="onSettingsChange" />
      <span class="setting-label">每行字数≤</span>
      <el-input-number
        v-model="store.maxCharsPerLine"
        :min="8"
        :max="40"
        :step="1"
        size="small"
        controls-position="right"
        style="width: 88px"
        @change="onSettingsChange"
      />
      <span class="setting-label">词间停顿(s)</span>
      <el-input-number
        v-model="store.gapThresholdSec"
        :min="0.15"
        :max="0.8"
        :step="0.02"
        :precision="2"
        size="small"
        controls-position="right"
        style="width: 100px"
        @change="onSettingsChange"
      />
      <span class="setting-label">最长行(s)</span>
      <el-input-number
        v-model="store.maxLineDurationSec"
        :min="3"
        :max="12"
        :step="0.5"
        :precision="1"
        size="small"
        controls-position="right"
        style="width: 88px"
        @change="onSettingsChange"
      />
      <el-checkbox v-model="store.keepAsrTextInTable" label="表格显示识别稿" @change="onSettingsChange" />
      <template v-if="asr.isWhisperX">
        <span class="setting-label">VAD onset</span>
        <el-input-number
          v-model="store.vadOnset"
          :min="VAD_ONSET_MIN"
          :max="VAD_ONSET_MAX"
          :step="0.05"
          :precision="2"
          size="small"
          controls-position="right"
          style="width: 100px"
          @change="onSettingsChange"
        />
        <span class="setting-label">VAD offset</span>
        <el-input-number
          v-model="store.vadOffset"
          :min="VAD_OFFSET_MIN"
          :max="VAD_OFFSET_MAX"
          :step="0.05"
          :precision="2"
          size="small"
          controls-position="right"
          style="width: 100px"
          @change="onSettingsChange"
        />
        <el-checkbox v-model="store.alignOutput" label="词级对齐（必选）" @change="onSettingsChange" />
      </template>
    </div>
    <p class="preset-hint">
      实况预设：每行 {{ DEFAULT_AUTO_TIMING_MAX_CHARS }} 字、停顿 {{ DEFAULT_GAP_THRESHOLD_SEC }}s；快嘴主播可略减小停顿或略增字数。
    </p>
  </div>
</template>

<style scoped lang="scss">
.toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

.toolbar-main {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.brand {
  font-weight: 700;
  font-size: 16px;
}

.hint {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  flex: 1;
  min-width: 200px;
}

.actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.toolbar-settings {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding-top: 4px;
  border-top: 1px solid var(--el-border-color-extra-light);
}

.setting-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.preset-hint {
  margin: 0;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
