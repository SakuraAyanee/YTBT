<script setup lang="ts">
import { useTimedAsrStore } from '@/stores/timedAsr'
import { useAsrSettingsStore } from '@/stores/asrSettings'
import { segmentsToSrt, downloadText } from '@/utils/srt'
import { SOURCE_LANGUAGE_OPTIONS } from '@/constants/subtitle'
import {
  VAD_ONSET_MIN,
  VAD_ONSET_MAX,
  VAD_OFFSET_MIN,
  VAD_OFFSET_MAX,
} from '@/constants/transcribe'
import { TIMED_ASR_FILL_MODE_OPTIONS } from '@/constants/timedAsr'
import { ElMessage } from 'element-plus'

const store = useTimedAsrStore()
const asr = useAsrSettingsStore()

function exportSrt(mode: 'source' | 'translated' | 'bilingual') {
  if (!store.segments.length) {
    ElMessage.warning('暂无字幕可导出')
    return
  }
  const base =
    store.srtFileName.replace(/\.[^.]+$/, '') ||
    store.videoFile?.name.replace(/\.[^.]+$/, '') ||
    'subtitle'
  const suffix = mode === 'bilingual' ? 'zh-en' : mode === 'translated' ? 'zh' : 'source'
  downloadText(`${base}.${suffix}.srt`, segmentsToSrt(store.segments, mode))
  ElMessage.success('已导出')
}

function onSettingsChange() {
  store.persistUi()
}
</script>

<template>
  <div class="toolbar">
    <div class="toolbar-main">
      <div class="brand">轴先导填词</div>
      <p class="hint">
        推荐「按轴切音拼接」：每行字幕单独切音再拼成一条上传，填词更准；「全片映射」适合行数少或对比测试
      </p>
      <div class="actions">
        <el-button
          type="primary"
          :loading="store.isBusy"
          :disabled="!store.canFill"
          @click="store.startFillFromAsr()"
        >
          {{ asr.isDeepgram ? 'Nova-2 按轴填词' : '按时间轴填词' }}
        </el-button>
        <el-button
          type="success"
          :loading="store.phase === 'translating'"
          :disabled="!store.canTranslate"
          @click="store.startTranslate()"
        >
          翻译为中文
        </el-button>
        <el-button plain @click="store.clearSession()">清空</el-button>
        <el-dropdown trigger="click">
          <el-button>导出 SRT</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="exportSrt('bilingual')">双语</el-dropdown-item>
              <el-dropdown-item @click="exportSrt('translated')">仅中文</el-dropdown-item>
              <el-dropdown-item @click="exportSrt('source')">仅原文</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <div class="toolbar-settings">
      <span class="setting-label">填词模式</span>
      <el-select
        v-model="store.fillMode"
        size="small"
        style="width: 180px"
        @change="onSettingsChange"
      >
        <el-option
          v-for="opt in TIMED_ASR_FILL_MODE_OPTIONS"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
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
      <template v-if="store.fillMode === 'concat'">
        <span class="setting-label" title="每行切音向两侧扩展">切音 padding(s)</span>
        <el-input-number
          v-model="store.clipPaddingSec"
          :min="0"
          :max="0.5"
          :step="0.01"
          :precision="2"
          size="small"
          controls-position="right"
          style="width: 110px"
          @change="onSettingsChange"
        />
        <span class="setting-label">行间静音(s)</span>
        <el-input-number
          v-model="store.clipGapSec"
          :min="0.1"
          :max="1"
          :step="0.05"
          :precision="2"
          size="small"
          controls-position="right"
          style="width: 100px"
          @change="onSettingsChange"
        />
      </template>
      <template v-else>
        <span class="setting-label" title="全片映射搜索窗口">映射 padding(s)</span>
        <el-input-number
          v-model="store.mapPaddingSec"
          :min="0"
          :max="0.5"
          :step="0.01"
          :precision="2"
          size="small"
          controls-position="right"
          style="width: 110px"
          @change="onSettingsChange"
        />
      </template>
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
      <el-checkbox v-model="store.alignOutput" label="词级对齐" @change="onSettingsChange" />
      </template>
    </div>
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
</style>
