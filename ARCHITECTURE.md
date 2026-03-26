# Subtitle AI Pro - 项目代码架构与详细设计文档

本项目是一个混合架构的桌面应用程序，前端基于 Electron + React + Vite，后端基于 FastAPI (Python)。主要功能包括屏幕音频实时捕捉、语音识别（ASR）、多引擎实时翻译（包括 Ollama/Qwen 等大语言模型）以及离线视频字幕生成。

---

## 一、 系统整体架构图

```text
+-------------------------------------------------------+
|                   前端 (Electron)                     |
|                                                       |
|  +----------------+     +--------------------------+  |
|  |                |     |                          |  |
|  | UI 渲染与控制  |     |  MediaRecorder 捕捉引擎  |  |
|  | (React, Vite)  |<--->|  (获取系统或麦克风音频)  |  |
|  |                |     |                          |  |
|  +--------+-------+     +-------------+------------+  |
|           |                           |               |
|     (IPC) |                           | HTTP POST     |
|           v                           v               |
|  +----------------+        +-----------------------+  |
|  | 悬浮字幕窗口   |        |   API 参数 & 音频切片 |  |
|  | (Overlay App)  |        |  (API_URL, Model 等)  |  |
|  +----------------+        +-----------------------+  |
+---------------------------------------|---------------+
                                        |
================= [ HTTP / REST API ] ===================
                                        |
+---------------------------------------v---------------+
|                 后端 (Python FastAPI)                 |
|                                                       |
|  +---------------------+   +-----------------------+  |
|  |   API 路由与处理    |   |     Ollama 接口     |  |
|  |   (/asr, /process)  |<->|  (/ollama_models)   |  |
|  +---------+-----------+   +-----------------------+  |
|            |                                          |
|            v                                          |
|  +---------------------+   +-----------------------+  |
|  |    ASR 引擎层       |   |     翻译引擎层      |  |
|  | (Faster-Whisper/    |   | (Google/NLLB/Ollama/  |  |
|  |  SenseVoice/OpenAI) |   |  OpenAI)              |  |
|  +---------------------+   +-----------------------+  |
+-------------------------------------------------------+
```

---

## 二、 后端核心架构解析 (`python_engine/main.py`)

后端主要由 FastAPI 提供服务，负责处理音频切片、调用 ASR 模型，并进行翻译分发。

### 1. 核心模型加载与初始化
这部分代码在应用启动时执行，确保模型驻留内存，提升处理速度。

```python
# 加载 Whisper 语音识别模型
def load_whisper_model(size, device_type=None):
    try:
        # 如果指定了 CUDA，则使用 GPU 加速和 float16 精度降低显存占用
        if device_type == "cuda":
            logger.info(f"Loading Whisper {size} on CUDA...")
            return WhisperModel(size, device="cuda", compute_type="float16")
        # 否则回退到 CPU 模式，使用 int8 精度以保证速度
        logger.info(f"Loading Whisper {size} on CPU...")
        return WhisperModel(size, device="cpu", compute_type="int8")
    except Exception as e:
        # 容错：如果加载失败，默认加载最小的 base 模型
        logger.error(f"Whisper Load Error: {e}")
        return WhisperModel("base", device="cpu", compute_type="int8")

# 实例化全局单例 Whisper 模型
whisper_model = load_whisper_model(WHISPER_MODEL_SIZE, "cuda" if os.getenv("USE_CUDA", "true") == "true" else "cpu")
```

### 2. 翻译引擎分发中心 (`perform_translation`)
该函数是翻译功能的核心枢纽，它根据前端传来的参数，将文本路由到相应的翻译服务。

```python
def perform_translation(text, source_lang, target_lang, trans_engine="google", api_url="", api_key="", trans_model="gpt-3.5-turbo"):
    # 防御性编程：文本为空直接返回
    if not text or not text.strip(): return ""
    # 如果源语言和目标语言一致，无需翻译
    if source_lang == target_lang: return text
    
    # 路由 1: 本地离线翻译模型 (NLLB)
    if trans_engine == "local_nllb":
        res = local_translator.translate(text, target_lang)
        if res: return res
        # 如果本地翻译失败，静默降级到 Google 翻译
        trans_engine = "google"

    # 路由 2: 大语言模型 (OpenAI 或 Ollama/Qwen)
    if (trans_engine == "openai" or trans_engine == "ollama") and (api_url or trans_engine == "ollama"):
        try:
            # 智能补全：针对 Ollama 自动填入默认本地 URL
            actual_url = api_url if api_url else "http://localhost:11434/v1"
            # 拼接符合 OpenAI 规范的 API 路径
            url = f"{actual_url.rstrip('/')}/chat/completions"
            
            # 构造鉴权 Header，Ollama 默认不需要 Key，但为了兼容规范传入 'ollama'
            headers = {"Authorization": f"Bearer {api_key if api_key else 'ollama'}", "Content-Type": "application/json"}
            # 将短语言代码映射为 LLM 易懂的英文描述，提升翻译准确率
            prompt_lang = {"zh": "Simplified Chinese", "en": "English", "ja": "Japanese", "ko": "Korean"}.get(target_lang, "Simplified Chinese")
            
            # 构造对话 Payload
            payload = {
                "model": trans_model, 
                "messages": [
                    # System Prompt: 限定大模型行为，防止其输出闲聊废话
                    {"role": "system", "content": f"You are a professional subtitle translator. Translate the input text into {prompt_lang}. Keep the original format. Return only the translated text without any explanation."},
                    # User Prompt: 需要翻译的原文
                    {"role": "user", "content": text}
                ],
                "temperature": 0.3 # 降低发散性，保证翻译结果稳定
            }
            
            # 发送网络请求，设置 60s 超时时间防止大模型推理阻塞
            res = requests.post(url, headers=headers, json=payload, timeout=60)
            # 解析并提取返回的纯文本结果
            return res.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.error(f"LLM Trans Error ({trans_engine}): {e}")
            # 如果是 Ollama 服务异常，直接把错误显示在前端，方便排查
            if trans_engine == "ollama": return f"[Ollama Error: {e}]"
            # OpenAI 异常则降级
            trans_engine = "google"

    # 路由 3: 默认兜底的免费 Google 翻译
    try:
        lang_map = {"zh": "zh-CN", "en": "en", "ja": "ja", "ko": "ko"}
        target = lang_map.get(target_lang, "en")
        return GoogleTranslator(source='auto', target=target).translate(text)
    except: return "[Trans Error]"
```

### 3. Ollama 模型自动发现接口
为了前端能够下拉选择模型，后端主动读取本地 Ollama 的镜像列表。

```python
@app.get("/ollama_models")
async def get_ollama_models():
    try:
        # 请求本地 Ollama 的 tag 列表接口
        res = requests.get("http://localhost:11434/api/tags", timeout=5)
        if res.status_code == 200:
            # 解析 JSON 中的 models 数组
            models = res.json().get("models", [])
            # 提取每个模型的 name 字段返回给前端
            return {"models": [m["name"] for m in models]}
        return {"models": []}
    except Exception as e:
        logger.error(f"Failed to fetch Ollama models: {e}")
        return {"models": []} # 失败时返回空数组，避免前端崩溃
```

### 5. 离线视频处理接口 (`/process_video`)
该接口用于处理完整的视频文件，生成 SRT 字幕，并支持与实时 ASR 相同的引擎选择。

```python
@app.post("/process_video")
async def process_video(
    file: UploadFile = File(...),
    asr_engine: str = Form("local"), # 支持自选 ASR 引擎
    is_translate: str = Form("false"),
    # ... 其他参数对齐 /asr 接口
):
    # 逻辑流程：
    # 1. 保存视频文件
    # 2. 根据 asr_engine 调用模型 (Whisper, SenseVoice 等)
    # 3. 如果是 SenseVoice，调用 clean_sense_voice_text 过滤标签
    # 4. 遍历识别出的 segments，按需调用 perform_translation
    # 5. 格式化并保存为 .srt 文件，返回下载链接
```
```

---

## 三、 前端与交互核心解析 (`src/main.tsx`)

前端主要负责 UI 状态维护和浏览器原生的 `MediaRecorder` 音频捕捉，以及通过 FormData 将复杂配置发送给后端。

### 1. 状态管理与初始化
定义了所有 UI 可控的参数，包括我们在界面上增加的动态字段。

```typescript
// 引擎相关状态
const [asrEngine, setAsrEngine] = useState('local')
const [transEngine, setTransEngine] = useState('google')
const [transModel, setTransModel] = useState('gpt-3.5-turbo') 
const [ollamaModels, setOllamaModels] = useState<string[]>([]) 

// 新增：动态截取间隔时间，默认 2000ms
const [captureInterval, setCaptureInterval] = useState(2000) 

const [apiUrl, setApiUrl] = useState('https://api.openai.com/v1')
const [apiKey, setApiKey] = useState('')

// 获取 Ollama 模型列表的副作用函数
const fetchOllamaModels = async () => {
  try {
    const res = await fetch('http://127.0.0.1:8000/ollama_models')
    const data = await res.json()
    if (data.models && data.models.length > 0) {
      setOllamaModels(data.models)
      // 容错：如果当前输入的模型不在本地列表中，则强制选中列表的第一个
      if (!data.models.includes(transModel)) {
        setTransModel(data.models[0])
      }
    }
  } catch (err) {
    console.error('Failed to fetch Ollama models:', err)
  }
}

// 监听翻译引擎切换事件，一旦切到 'ollama'，立刻请求本地模型列表
useEffect(() => {
  if (transEngine === 'ollama') {
    fetchOllamaModels()
  }
}, [transEngine])
```

### 2. 核心：实时音频捕捉循环 (`startCapture`)
这是前端最核心的逻辑，它通过 `getUserMedia` 获取系统或麦克风声音，并通过定时器不断切片发送到后端。

```typescript
const startCapture = async (sourceId: string) => {
  try {
    // 1. 调用浏览器 API 获取指定窗口或桌面的流
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: 'desktop' } },
      video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId } }
    })

    const audioTracks = stream.getAudioTracks()
    // 权限或选择错误检查（Windows 必须选 Screen 才能捕获音频）
    if (audioTracks.length === 0) return alert('未检测到音频轨道！')

    // 2. 为了节省带宽，只抽取音频轨道创建新的纯音频流
    const audioOnlyStream = new MediaStream([audioTracks[0]])
    
    // 初始化录音器，采用 opus 编码以提供较好的音质和较小的体积
    const mediaRecorder = new MediaRecorder(audioOnlyStream, { 
      mimeType: 'audio/webm; codecs=opus' 
    })
    
    // 3. 定义数据产生时的回调（即定时器 stop 时会触发此事件）
    mediaRecorder.ondataavailable = async (e) => {
      if (e.data.size > 0) {
        // 构建多重表单数据，把 UI 上的所有配置一次性传给后端
        const formData = new FormData()
        formData.append('file', e.data, 'audio.webm')
        formData.append('is_translate', String(isTranslate))
        formData.append('source_lang', sourceLang) 
        formData.append('target_lang', targetLang)
        formData.append('asr_engine', asrEngine)
        formData.append('trans_engine', transEngine)
        formData.append('trans_model', transModel) 
        formData.append('api_url', apiUrl)
        formData.append('api_key', apiKey)

        try {
          // 发送切片到后端 /asr 接口
          const response = await fetch('http://127.0.0.1:8000/asr', { 
            method: 'POST', 
            body: formData 
          })
          const data = await response.json()
          
          if (data.text && data.text.trim()) {
            // 查重逻辑：防止静音片段引发的 Whisper 重复输出
            if (data.text === lastTextRef.current) return
            lastTextRef.current = data.text

            // 构造悬浮窗最终显示的字符串格式
            let finalDisplay = data.text
            if (isTranslate && data.translated_text) {
              finalDisplay = `${data.text}\n${data.translated_text}`
            }
            
            // 通过 Electron 的 IPC 通信，把文字发送给透明悬浮窗口
            window.electronAPI.updateSubtitles(finalDisplay)
            
            // 更新右侧日志面板的状态
            setText(prev => { ... })
          }
        } catch (err) { console.error(err) }
      }
    }

    // 4. 启动录制循环，核心的 "心跳" 机制
    mediaRecorder.start()
    intervalRef.current = setInterval(() => {
      if (mediaRecorder.state === 'recording') {
        // 先停再起，强制触发上面的 ondataavailable 事件，产生切片文件
        mediaRecorder.stop()
        mediaRecorder.start()
      }
    }, captureInterval) // 使用了界面动态绑定的 captureInterval 变量 (如 2000ms)

  } catch (e) { 
    // 异常处理
  }
}
```

### 3. UI 交互渲染联动
根据用户的选择动态呈现不同的控件。

```tsx
// 引擎选择下拉框的联动逻辑
<select 
  value={transEngine}
  onChange={(e) => {
    setTransEngine(e.target.value)
    // 快捷操作：选中 Ollama 时自动填充默认地址和默认模型名
    if (e.target.value === 'ollama') {
      setApiUrl('http://localhost:11434/v1')
      setTransModel('qwen2.5')
    }
  }}
>
  <option value="google">Google 翻译</option>
  <option value="ollama">本地大模型 (Ollama/Qwen)</option>
</select>

// 模型的动态渲染：如果是 Ollama 则渲染获取到的下拉列表，否则渲染文本框供外部大模型手填
{isTranslate && transEngine === 'ollama' ? (
  <select value={transModel} onChange={(e) => setTransModel(e.target.value)}>
    {ollamaModels.length > 0 ? (
      ollamaModels.map(m => <option key={m} value={m}>{m}</option>)
    ) : (
      <option value="">未发现本地模型，请先下载</option>
    )}
  </select>
) : (
  <input type="text" value={transModel} onChange={(e) => setTransModel(e.target.value)} />
)}
```

---

## 四、 总结与流程概览

1. **配置阶段**：用户在 React 前端设置好 ASR 引擎、捕获间隔 (如 2000ms)、翻译引擎 (如 Ollama)、模型 (自动加载的 `qwen2.5`)。
2. **捕获阶段**：用户点击开始，浏览器每隔 2000ms 强制停止并重新启动录音器，将这 2s 的系统音频打包成 `.webm` 格式通过 POST 发送到后端。
3. **识别与翻译 (后端)**：
   - FastAPI 接收文件，通过 `Whisper` 模型（本地 GPU 运算）转写为文本。
   - 过滤幻听词和进行繁简转换后，若开启翻译，触发 `perform_translation`。
   - 将文本包装成 OpenAI 的 JSON 格式结构，请求本地 `http://localhost:11434/v1/chat/completions`。
   - 解析 Ollama 的推理结果返回给前端。
4. **渲染阶段**：前端拿到合并后的中英文字符串，一方面追加到右侧历史日志中，另一方面通过 Electron IPC 发送给透明的 Overlay 窗口进行屏幕中心展示。
