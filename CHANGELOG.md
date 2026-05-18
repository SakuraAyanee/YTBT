# 更新日志

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)（`主版本.次版本.修订号`）。

## [1.1.0] - 2026-05-19

### 新增

- **自动打轴**页面（`/auto-timing`）：词级 ASR → 按停顿与每行字数（默认≤18 字）生成时间轴
- **轴先导填词**页面（`/timed-asr`）：导入 SRT/ASS 空轴，支持全片映射与按轴切音拼接填词
- 全局 ASR 切换：WhisperX（Replicate）与 Deepgram Nova
- 顶栏 VAD、词级对齐、Deepgram Nova 选项等可配置项
- 文档：`docs/核心技术栈.md`

### 改进

- 视频预览与字幕切分、CJK 文本处理
- 工作台 IndexedDB 草稿与转写缓存指纹

### 说明

- 1.1.0 为当前功能集的基线发布；若你此前未打过 `v1.0.0` 标签，可直接从 1.1.0 开始管理版本。

[1.1.0]: https://github.com/你的用户名/YTBT/releases/tag/v1.1.0
