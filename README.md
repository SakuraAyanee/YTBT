# YTBT · 视频字幕AI自动打轴翻译-生成Aegisub可识别.srt文件

**当前版本：1.1.0** · 详见 [CHANGELOG.md](./CHANGELOG.md)

Vue 3 + Element Plus 个人工作台：拖拽视频 → [WhisperX](https://replicate.com/victor-upmeet/whisperx) 转写 → OpenAI 翻译为中文 → 导出 SRT。

## 环境要求

- Node.js 18+（推荐 20+）
- Replicate API Token
- JieKou AI（或其它 OpenAI 兼容中转）API Key
- （可选）HuggingFace Token：开启说话人分离时必填

## 配置

复制 `.env.example` 为 `.env.local` 并填写：

```env
VITE_REPLICATE_API_TOKEN=r8_xxx
VITE_LLM_API_BASE_URL=https://api.jiekou.ai/openai
VITE_LLM_API_KEY=你的JieKou密钥
VITE_LLM_MODEL=gpt-4o-mini
VITE_HUGGINGFACE_TOKEN=hf_xxx
```


## 开发

```bash
npm install
npm run dev
```

浏览器打开控制台提示的地址（默认 `http://localhost:5173`）。

## 使用流程

1. 拖拽或选择视频/音频（视频默认本机抽音轨为 MP3 再上传）
2. 若需说话人分离，勾选并填写 HuggingFace Token（需在 HF 接受 [pyannote](https://huggingface.co/pyannote) 相关模型协议）
3. 点击 **WhisperX 转写**（上传 + GPU 推理，长视频可能需数分钟）
4. 点击 **翻译为中文**（gpt-4o-mini 批量翻译）
5. **导出 SRT**（双语 / 仅中文 / 仅原文）

## 架构说明

- `/replicate` → `api.replicate.com`（解决浏览器 CORS，Token 由 `vite.config.ts` 注入）
- `/openai` → `VITE_LLM_API_BASE_URL`（默认 `https://api.jiekou.ai/openai`）
- 翻译接口：`POST /v1/chat/completions`（OpenAI Chat Completions 常规模式，非 streaming）
- 转写：`POST /v1/predictions` + `version=victor-upmeet/whisperx:{hash}`（非官方模型不可用 `/models/.../predictions`）
- `align_output=true`，`language=null`（自动检测）
- 翻译：口语化中文，去语气词，不审查脏话；`VITE_LLM_MODEL` 需与 JieKou 控制台可用模型一致

## 视频抽音轨（ffmpeg.wasm）

- 勾选顶栏 **「视频抽音轨」**（默认开启）后，转写前会在浏览器内用 ffmpeg 提取 `16kHz / 64kbps` 单声道 MP3，再上传至 Replicate。
- 播放器仍使用原视频预览；仅上传音频，体积通常比整段视频小一个数量级。
- 首次使用需从 CDN 加载 ffmpeg 核心（约 30MB），请保持网络畅通。

## 本地草稿（刷新不丢）

- **字幕与译文**：IndexedDB（`ytbt-cache`），转写/翻译完成后自动保存；刷新页面会自动恢复上次会话（含视频文件）。
- **界面选项**：`localStorage` 键 `ytbt:ui`（视频抽音轨、说话人分离开关）。
- 顶栏 **「清除草稿」** 可删除本机缓存；更换视频文件不会删除旧文件缓存，仅开始新会话。

## 大文件说明

[victor-upmeet/whisperx](https://replicate.com/victor-upmeet/whisperx) 适合数小时内、约数百 MB 以内的媒体。超大文件可改用 [whisperx-a40-large](https://replicate.com/victor-upmeet/whisperx-a40-large)（需在 `src/services/replicate.ts` 中修改 `MODEL` 常量）。
