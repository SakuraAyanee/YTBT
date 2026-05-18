/** SRT 导入最大行数 */
export const MAX_SRT_LINES = 500

/** 映射时向两侧扩展的搜索窗口（秒），不改变导出时间轴 */
export const DEFAULT_MAP_PADDING_SEC = 0.05

/** 单元与行重叠时长占单元时长比例低于此则忽略（0 = 任意重叠） */
export const DEFAULT_MIN_OVERLAP_RATIO = 0

/** 按轴切音：每行两侧扩展（秒） */
export const DEFAULT_CLIP_PADDING_SEC = 0.12

/** 拼接音轨时行与行之间的静音间隔（秒） */
export const DEFAULT_CLIP_GAP_SEC = 0.25

export const MIN_CLIP_DURATION_SEC = 0.15

export type TimedAsrFillMode = 'concat' | 'fullmap'

export const TIMED_ASR_FILL_MODE_OPTIONS = [
  { label: '按轴切音拼接（推荐）', value: 'concat' as const },
  { label: '全片转写再映射', value: 'fullmap' as const },
]
