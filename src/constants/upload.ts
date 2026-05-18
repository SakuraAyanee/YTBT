/**
 * 客户端提示用上限（MB）。超过仅警告，不阻止上传。
 * Replicate Files API 自身仍有上限（常见约 100MB 内），过大仍会返回 File too large。
 * 可通过 .env.local 的 VITE_MAX_UPLOAD_MB 调整提示阈值。
 */
export const MAX_UPLOAD_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB) || 500
