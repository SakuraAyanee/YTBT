/** 游戏实况：每行约 ≤18 字（CJK 可见字符） */
export const DEFAULT_AUTO_TIMING_MAX_CHARS = 18

/** 词间间隙超过此值（秒）视为新句/新行候选 */
export const DEFAULT_GAP_THRESHOLD_SEC = 0.32

/** 单行最长显示时间（秒） */
export const DEFAULT_MAX_LINE_DURATION_SEC = 7

/** 单行最短显示时间（秒） */
export const DEFAULT_MIN_LINE_DURATION_SEC = 0.45

/** 过短行合并阈值（可见字数） */
export const DEFAULT_MIN_CHARS_PER_LINE = 4

/** 行尾略延长（秒），贴住尾音 */
export const DEFAULT_END_PADDING_SEC = 0.06

/** 行尾吸附：若与下一词间隙大于此值，将 end 收到间隙中点 */
export const DEFAULT_LINE_END_SNAP_MIN_GAP_SEC = 0.12

export const AUTO_TIMING_UI_KEY = 'ytbt:auto-timing-ui'

/** 自动打轴 → 轴先导填词 传递时间轴 */
export const TIMED_ASR_HANDOFF_KEY = 'ytbt:handoff-timed-asr'
