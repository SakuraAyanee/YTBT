<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import { useAsrSettingsStore } from '@/stores/asrSettings'
import { ASR_PROVIDER_OPTIONS } from '@/constants/asr'
import { DEEPGRAM_MODEL_OPTIONS } from '@/constants/deepgram'

const route = useRoute()
const active = computed(() => route.path)
const asr = useAsrSettingsStore()
</script>

<template>
  <nav class="app-nav">
    <div class="nav-row">
      <div class="nav-links">
        <router-link to="/" class="nav-link" :class="{ active: active === '/' }">
          视频转写
        </router-link>
        <router-link
          to="/auto-timing"
          class="nav-link"
          :class="{ active: active.startsWith('/auto-timing') }"
        >
          自动打轴
        </router-link>
        <router-link to="/timed-asr" class="nav-link" :class="{ active: active.startsWith('/timed-asr') }">
          轴先导填词
        </router-link>
      </div>
      <div class="nav-asr">
        <span class="asr-label">转写模型</span>
        <el-select v-model="asr.provider" size="small" style="width: 200px">
          <el-option
            v-for="opt in ASR_PROVIDER_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          >
            <span>{{ opt.label }}</span>
            <span class="option-desc">{{ opt.description }}</span>
          </el-option>
        </el-select>
        <a
          v-if="asr.isDeepgram"
          class="asr-doc"
          href="https://developers.deepgram.com/reference/speech-to-text/listen-pre-recorded"
          target="_blank"
          rel="noopener noreferrer"
        >
          API 参数说明
        </a>
      </div>
    </div>

    <div v-if="asr.isDeepgram" class="nav-deepgram">
      <span class="dg-label">Nova 选项</span>
      <el-select v-model="asr.deepgramUi.model" size="small" style="width: 120px">
        <el-option
          v-for="m in DEEPGRAM_MODEL_OPTIONS"
          :key="m.value"
          :label="m.label"
          :value="m.value"
        />
      </el-select>
      <el-checkbox v-model="asr.deepgramUi.punctuate" size="small">标点 punctuate</el-checkbox>
      <el-checkbox v-model="asr.deepgramUi.smartFormat" size="small">
        Smart Format
        <el-tooltip content="日语字幕建议关闭，否则词间易出现多余空格" placement="top">
          <span class="hint-icon">?</span>
        </el-tooltip>
      </el-checkbox>
      <el-checkbox v-model="asr.deepgramUi.fillerWords" size="small">语气词 filler_words</el-checkbox>
      <span class="dg-label">断句 utt_split(s)</span>
      <el-input-number
        v-model="asr.deepgramUi.utteranceSplitSec"
        :min="0.3"
        :max="2"
        :step="0.1"
        :precision="1"
        size="small"
        controls-position="right"
        style="width: 100px"
      />
      <span class="dg-hint">源语言请在各页顶栏选择；日语务必选「日语 ja」勿用自动</span>
    </div>
  </nav>
</template>

<style scoped lang="scss">
.app-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 16px 0;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.nav-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px 16px;
}

.nav-links {
  display: flex;
  gap: 4px;
}

.nav-link {
  padding: 8px 14px;
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  text-decoration: none;
  border-radius: 6px 6px 0 0;
  border: 1px solid transparent;
  border-bottom: none;
  margin-bottom: -1px;

  &:hover {
    color: var(--el-color-primary);
  }

  &.active {
    color: var(--el-color-primary);
    background: var(--el-bg-color-page);
    border-color: var(--el-border-color-lighter);
  }
}

.nav-asr {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  margin-bottom: 4px;
}

.nav-deepgram {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 0 0 8px;
  border-top: 1px solid var(--el-border-color-extra-light);
  padding-top: 8px;
}

.asr-label,
.dg-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.asr-doc {
  font-size: 12px;
  color: var(--el-color-primary);
  text-decoration: none;
  white-space: nowrap;

  &:hover {
    text-decoration: underline;
  }
}

.dg-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.hint-icon {
  margin-left: 2px;
  color: var(--el-text-color-secondary);
  cursor: help;
}

.option-desc {
  display: block;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  line-height: 1.3;
}
</style>
