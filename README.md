# 实时视频字幕生成工具 (Real-time Video Subtitles Tool)

## 快速启动

### 1. 启动 Python ASR 引擎
确保已安装 Python 3.8+，然后在 `python_engine` 目录下运行：
```bash
cd subtitle-tool/python_engine
pip install fastapi uvicorn faster-whisper python-multipart pydantic
python main.py
```
*提示：首次运行会自动下载 Faster-Whisper tiny 模型。*

### 2. 启动 Electron 应用
在项目根目录下运行：
```bash
cd subtitle-tool
npm install
npm run dev
```

## 功能说明
- **开始捕捉**: 点击后选择要捕捉的屏幕或窗口，应用将开始提取音频进行实时识别。
- **开启实时翻译**: 勾选后，识别到的文本将自动翻译为选定的语言。
- **悬浮窗**: 字幕会自动显示在一个透明的悬浮窗口中，您可以将其移动到视频上方。
- **离线处理**: 在“离线视频处理”部分上传视频文件，系统将生成对应的字幕。

## 技术架构
- **前端**: React + Vite + Tailwind (CSS 模拟)
- **桌面端**: Electron (透明悬浮窗, desktopCapturer 音频捕捉)
- **后端**: FastAPI + Faster-Whisper (本地 AI 推理)
