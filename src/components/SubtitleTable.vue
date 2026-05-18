<script setup lang="ts">
import { computed } from 'vue'
import type { SubtitleSegment } from '@/types/subtitle'
import { useWorkbenchStore } from '@/stores/workbench'
import { formatTimeRange } from '@/utils/time'

const props = defineProps<{
  segments?: SubtitleSegment[]
  activeSegmentId?: string | null
  emptyText?: string
}>()

const workbench = useWorkbenchStore()

const tableData = computed(() => props.segments ?? workbench.segments)
const activeId = computed(() => props.activeSegmentId ?? workbench.activeSegmentId)

const emit = defineEmits<{
  seek: [id: string]
}>()

function rowClass({ row }: { row: { id: string } }) {
  return row.id === activeId.value ? 'row-active' : ''
}

function onRowClick(row: { id: string }) {
  emit('seek', row.id)
}
</script>

<template>
  <el-table
    :data="tableData"
    height="100%"
    stripe
    highlight-current-row
    :row-class-name="rowClass"
    :empty-text="emptyText ?? '字幕将显示在这里'"
    @row-click="onRowClick"
  >
    <el-table-column label="时间轴" width="168" show-overflow-tooltip>
      <template #default="{ row }">
        {{ formatTimeRange(row.start, row.end) }}
      </template>
    </el-table-column>
    <el-table-column label="说话人" width="100" prop="speaker" show-overflow-tooltip />
    <el-table-column label="原文" min-width="160" prop="text" show-overflow-tooltip />
    <el-table-column label="译文" min-width="160" show-overflow-tooltip>
      <template #default="{ row }">
        <span v-if="row.translatedText">{{ row.translatedText }}</span>
        <el-tag v-else-if="row.status === 'translating'" size="small" type="info">翻译中</el-tag>
        <span v-else class="muted">—</span>
      </template>
    </el-table-column>
    <el-table-column label="状态" width="72" align="center">
      <template #default="{ row }">
        <el-tag v-if="row.status === 'done'" type="success" size="small">完成</el-tag>
        <el-tag v-else-if="row.status === 'error'" type="danger" size="small">失败</el-tag>
        <el-tag v-else-if="row.status === 'translating'" type="warning" size="small">中</el-tag>
        <el-tag v-else-if="!row.text?.trim()" type="info" size="small">空</el-tag>
        <el-tag v-else size="small">待译</el-tag>
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped lang="scss">
:deep(.row-active) {
  background-color: var(--el-color-primary-light-9) !important;
}

.muted {
  color: var(--el-text-color-placeholder);
}
</style>
