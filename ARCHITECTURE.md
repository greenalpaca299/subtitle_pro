# Subtitle AI Pro - 系统架构与详细设计方案

本项目采用分布式混合架构（Frontend: Electron/React, Backend: FastAPI/Python），通过分层解耦实现了高性能的实时转录与离线视频处理功能。

## 一、 系统架构图

```text
+-------------------------+      +-------------------------+
|     Electron UI 层      | <--> |   FastAPI 计算引擎层    |
| (React + Vite + Tailwind)|      | (Python + AI Models)    |
+-----------+-------------+      +-----------+-------------+
            |                                |
      +-----+-----+                    +-----+-----+
      | 系统捕捉  |                    | ASR 核心  | (Whisper, SenseVoice)
      | (IPC+API) |                    | 翻译核心  | (Parallel Translation)
      +-----------+                    +-----------+
```

---

## 二、 关键模块设计

### 1. 实时捕捉模块 (Real-time Pipeline)
- **机制**：Electron 利用 `desktopCapturer` 获取屏幕源，通过 `MediaRecorder` 对系统音频进行 2 秒一次的 Webm 切片。
- **流程**：`Webm 切片` -> `FastAPI /asr` -> `ASR 识别` -> `LLM/Google 翻译` -> `返回前端` -> `IPC 通信` -> `Overlay 渲染`。

### 2. 离线视频处理模块 (Offline Video Pipeline)
这是系统的重度计算模块，经过多次优化以支持工业级处理。
- **多线程调度**：接口采用 `Thread Pool` 机制（非阻塞式 `def` 函数），确保耗时任务运行时，进度查询接口（`/progress`）依然流畅响应。
- **并行翻译 (Speed Boost)**：利用 `concurrent.futures.ThreadPoolExecutor` 同时发起多个翻译请求（支持 Google, Ollama, OpenAI）。这比传统的串行翻译快 5-10 倍。
- **路径重映射**：前端捕获视频的真实路径（`file.path`），后端处理完成后，利用 `shutil` 将生成的 SRT 文件自动“归位”到原视频目录下，并匹配文件名。

### 3. ASR 与翻译引擎支持
- **识别引擎**：
  - **Faster-Whisper**：高性能 C++ 实现的 Whisper 模型。支持 `asr_prompt` 引导特定词汇。
  - **SenseVoice**：专为中文、日文、韩文、英文优化的快速 ASR 模型。
- **翻译引擎**：
  - **LLM (Ollama/OpenAI)**：支持 `trans_prompt` 自定义系统角色，实现极具表现力的翻译效果。
  - **Local NLLB**：本地离线翻译模型，保障隐私安全。

---

## 三、 数据流动设计

### 1. 进度追踪逻辑
1. 前端上传文件并获取随机 `task_id`。
2. 后端在 `progress_store` 全局字典中实时更新任务状态：
   - `15% - 90%`：识别中。
   - `90% - 99%`：并行翻译阶段（实时显示完成片段数）。
   - `100%`：最终合并输出并清理缓存。
3. 前端通过每秒轮询（Polling）方式获取上述信息并同步进度条。

### 2. 文件生命周期管理
- **Upload**：视频上传至后端的 `outputs/` 临时目录。
- **Process**：生成同名 `.srt` 文件。
- **Move & Cleanup**：
  - 将 `.srt` 拷贝到 `original_path`（原视频目录）。
  - 删除 `outputs/` 下的缓存视频。
  - 返回 SRT 文件的备用静态下载链接。

---

## 四、 核心参数参考
- **ASR 默认 Prompt (中文)**: `"简体中文。"`
- **LLM 系统提示词**: `Translate to {TargetLang}. Return ONLY translated text.`
- **并行翻译并发数**:
  - Google: `max_workers=10`
  - LLM API: `max_workers=4` (保护显存/速率限制)

---
*Created by Subtitle AI Pro Dev Team.*
