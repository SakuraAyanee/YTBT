<script setup lang="ts">
import { useWorkbenchStore } from '@/stores/workbench'
import { useAsrSettingsStore } from '@/stores/asrSettings'
import { segmentsToSrt, downloadText } from '@/utils/srt'
import { SOURCE_LANGUAGE_OPTIONS } from '@/constants/subtitle'
import {
  VAD_ONSET_MIN,
  VAD_ONSET_MAX,
  VAD_OFFSET_MIN,
  VAD_OFFSET_MAX,
  BATCH_SIZE_MIN,
  BATCH_SIZE_MAX,
  TEMPERATURE_MIN,
  TEMPERATURE_MAX,
} from '@/constants/transcribe'
import { ElMessage } from 'element-plus'

const store = useWorkbenchStore()
const asr = useAsrSettingsStore()

function exportSrt(mode: 'source' | 'translated' | 'bilingual') {
  if (!store.segments.length) {
    ElMessage.warning('暂无字幕可导出')
    return
  }
  const base = store.videoFile?.name.replace(/\.[^.]+$/, '') ?? 'subtitle'
  const suffix = mode === 'bilingual' ? 'zh-en' : mode === 'translated' ? 'zh' : 'source'
  downloadText(`${base}.${suffix}.srt`, segmentsToSrt(store.segments, mode))
  ElMessage.success('已导出')
}
</script>

<template>
  <div class="toolbar">
    <div class="toolbar-main">
      <div class="brand">YTBT · 视频字幕翻译</div>
      <div class="actions">
        <el-button
          type="primary"
          :loading="store.phase === 'extracting' || store.phase === 'uploading' || store.phase === 'transcribing'"
          :disabled="!store.canTranscribe"
          @click="store.startTranscribe()"
        >
          {{ asr.transcribeButtonLabel }}
        </el-button>
        <el-button
          type="success"
          :loading="store.phase === 'translating'"
          :disabled="!store.canTranslate"
          @click="store.startTranslate()"
        >
          翻译为中文
        </el-button>
        <el-button plain @click="store.clearLocalDraft()">清除草稿</el-button>
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
      <span class="setting-label">每行字数</span>
      <el-input-number
        v-model="store.maxSegmentCharsCjk"
        :min="12"
        :max="42"
        :step="1"
        size="small"
        controls-position="right"
        style="width: 110px"
      />
      <span class="setting-label">源语言</span>
      <el-select v-model="store.sourceLanguage" size="small" style="width: 120px">
        <el-option
          v-for="opt in SOURCE_LANGUAGE_OPTIONS"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
      <el-checkbox v-model="store.autoExtractAudio" label="视频抽音轨" />
      <el-checkbox
        v-model="store.enableDiarization"
        label="说话人分离"
        :disabled="asr.isDeepgram"
      />
      <el-input
        v-if="asr.isWhisperX"
        v-model="store.huggingfaceToken"
        placeholder="HuggingFace Token（分离时必填）"
        clearable
        size="small"
        style="width: 200px"
        show-password
      />
    </div>

    <div v-if="asr.isWhisperX" class="toolbar-settings toolbar-whisperx">
      <span class="setting-group">WhisperX / VAD</span>
      <span class="setting-label" title="越低越敏感，易产生更多短句">VAD onset</span>
      <el-input-number
        v-model="store.vadOnset"
        :min="VAD_ONSET_MIN"
        :max="VAD_ONSET_MAX"
        :step="0.05"
        :precision="2"
        size="small"
        controls-position="right"
        style="width: 110px"
      />
      <span class="setting-label" title="越低断句越快">VAD offset</span>
      <el-input-number
        v-model="store.vadOffset"
        :min="VAD_OFFSET_MIN"
        :max="VAD_OFFSET_MAX"
        :step="0.05"
        :precision="2"
        size="small"
        controls-position="right"
        style="width: 110px"
      />
      <span class="setting-label">Batch</span>
      <el-input-number
        v-model="store.batchSize"
        :min="BATCH_SIZE_MIN"
        :max="BATCH_SIZE_MAX"
        :step="8"
        size="small"
        controls-position="right"
        style="width: 100px"
      />
      <span class="setting-label">Temperature</span>
      <el-input-number
        v-model="store.temperature"
        :min="TEMPERATURE_MIN"
        :max="TEMPERATURE_MAX"
        :step="0.1"
        :precision="1"
        size="small"
        controls-position="right"
        style="width: 100px"
      />
      <el-checkbox v-model="store.alignOutput" label="词级对齐" />
      <span class="setting-label">提示词</span>
      <el-input
        v-model="store.initialPrompt"
        placeholder="initial_prompt（可选）"
        clearable
        size="small"
        style="width: 160px"
      />
      <template v-if="store.enableDiarization">
        <span class="setting-label">最少说话人</span>
        <el-input-number
          :model-value="store.minSpeakers ?? undefined"
          :min="1"
          :max="20"
          size="small"
          controls-position="right"
          style="width: 90px"
          @update:model-value="(v: number | undefined) => (store.minSpeakers = v ?? null)"
        />
        <span class="setting-label">最多说话人</span>
        <el-input-number
          :model-value="store.maxSpeakers ?? undefined"
          :min="1"
          :max="20"
          size="small"
          controls-position="right"
          style="width: 90px"
          @update:model-value="(v: number | undefined) => (store.maxSpeakers = v ?? null)"
        />
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
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.brand {
  font-weight: 700;
  font-size: 16px;
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

.toolbar-whisperx {
  padding-top: 8px;
}

.setting-group {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  margin-right: 4px;
}

.setting-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
</style>
