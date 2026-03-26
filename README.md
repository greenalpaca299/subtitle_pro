# Subtitle AI Pro - 智能实时/视频字幕生成工具

Subtitle AI Pro 是一款功能强大、多引擎驱动的桌面字幕工具。它支持**实时音频捕捉转录**、**大语言模型驱动的实时翻译**，以及**全自动化的离线视频字幕生成**。

## 🚀 核心功能

- **双模操作**：
  - **实时模式**：捕捉系统/应用音频，在透明悬浮窗中实时显示中英/日文字幕。
  - **离线模式**：上传视频文件，全自动识别、并行翻译并生成 SRT 字幕文件。
- **多引擎支持**：
  - **ASR（识别）**：本地 Whisper (faster-whisper)、阿里 SenseVoice (高性能中文识别)、OpenAI Whisper API。
  - **翻译**：Google 翻译、本地离线 NLLB 模型、**本地大模型 (Ollama/Qwen)**、OpenAI GPT。
- **智能化增强**：
  - **Prompt 支持**：支持为 ASR 识别和 LLM 翻译提供自定义 Prompt（提示词），引导术语和文风。
  - **并行翻译加速**：离线处理采用多线程并行翻译技术，效率提升 5-10 倍。
- **工作流自动化**：
  - **自动归档**：离线生成的字幕会自动放置到原视频目录下，文件名完美匹配。
  - **缓存清理**：自动删除处理过程中的临时视频缓存，节省硬盘空间。
- **专业级交互**：
  - **透明悬浮窗**：支持鼠标穿透锁定、位置重置、实时动态渲染。
  - **日志追踪**：右侧面板保留完整的转录历史记录。

## 🛠️ 环境准备

1. **Python 后端 (ASR/Translation Engine)**:
   - 建议 Python 3.9+。
   - 安装依赖：`pip install fastapi uvicorn faster-whisper funasr deep-translator zhconv python-multipart requests imageio-ffmpeg`。
   - (可选) 如需使用 Ollama，请确保 [Ollama](https://ollama.com/) 已安装并运行。

2. **Node 前端 (Electron UI)**:
   - 安装依赖：`npm install`。

## 🏃 快速启动

### 1. 启动后端
```bash
cd python_engine
python main.py
```
*提示：首次使用本地模型会触发自动下载，请确保网络连接。*

### 2. 启动前端
```bash
npm run dev
```

## 📖 使用指南

- **实时转录**：点击“开始捕捉音频”，选择“屏幕(Screen)”源以捕获系统声音。
- **大模型翻译**：在翻译引擎中选择 Ollama 或 OpenAI，可以填入自定义 Prompt（例如：“请用正式的学术风格翻译这段话”）。
- **视频字幕**：直接拖拽视频到上传区。处理完成后，生成的 `.srt` 文件会自动出现在你原视频所在的文件夹里。

---
*Powered by Electron, FastAPI, and Advanced AI Models.*
