import React, { useEffect, useState, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import { createPortal } from 'react-dom'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { 
  Play, 
  Square, 
  Languages, 
  Lock, 
  Unlock, 
  UploadCloud, 
  Maximize,
  Mic,
  X,
  Monitor,
  Video,
  Settings,
  RefreshCw,
  Cpu,
  History,
  Info,
  Activity,
  ChevronRight
} from 'lucide-react'
import './index.css'

// --- Types ---
interface CaptureSource {
  id: string
  name: string
  thumbnail: string
  isScreen: boolean
}

// --- Components ---

const SourceSelectionModal = ({ 
  isOpen, 
  sources, 
  onClose, 
  onSelect, 
  isLoading, 
  onRefresh 
}: { 
  isOpen: boolean, 
  sources: CaptureSource[], 
  onClose: () => void, 
  onSelect: (id: string) => void, 
  isLoading: boolean, 
  onRefresh: () => void 
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => { document.body.style.overflow = 'auto' }
  }, [isOpen])

  if (!isOpen) return null;
  
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 md:p-12 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden scale-in-center">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
              <Monitor className="text-blue-600" size={24} />
              请选择捕捉源
            </h2>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
              <Info size={14} className="text-blue-500" />
              提示：捕捉系统声音通常需要选择“屏幕(Screen)”源
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors px-4 py-2 rounded-xl hover:bg-blue-50" 
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              刷新列表
            </button>
            <button 
              className="p-2.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-all" 
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-100 rounded-full"></div>
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
              </div>
              <p className="text-slate-500 font-bold animate-pulse">正在获取可用窗口...</p>
            </div>
          ) : sources.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center gap-6 text-center">
              <div className="bg-white p-8 rounded-full shadow-sm border border-slate-100">
                <Monitor size={48} className="text-slate-200 mx-auto" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-800">未发现可捕捉的窗口</h3>
                <p className="text-slate-400 text-sm max-w-xs">请确认应用未被最小化，或点击上方刷新按钮。</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {sources.map((source) => (
                <div 
                  key={source.id} 
                  className="group cursor-pointer space-y-3"
                  onClick={() => onSelect(source.id)}
                >
                  <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-transparent group-hover:border-blue-500 transition-all shadow-sm group-hover:shadow-xl">
                    <img src={source.thumbnail} className="w-full h-full object-cover" alt={source.name} />
                    <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                      <div className="bg-blue-600 text-white p-3 rounded-full shadow-lg">
                        <Play fill="currentColor" size={20} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-1">
                    <p className="text-xs font-bold truncate text-slate-600 group-hover:text-blue-600">
                      {source.name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

const MainApp = () => {
  const [text, setText] = useState('')
  const [recording, setRecording] = useState(false)
  const [isTranslate, setIsTranslate] = useState(false)
  const [sourceLang, setSourceLang] = useState('zh')
  const [targetLang, setTargetLang] = useState('en')
  const [isOverlayLocked, setIsOverlayLocked] = useState(true)
  
  // 离线处理状态
  const [offlineStatus, setOfflineStatus] = useState<any>('')
  const [progress, setProgress] = useState(0)
  const [progressStatus, setProgressStatus] = useState('')
  const [isOfflineProcessing, setIsOfflineProcessing] = useState(false)

  // 引擎配置状态
  const [asrEngine, setAsrEngine] = useState('local')
  const [asrModel, setAsrModel] = useState('whisper-1')
  const [asrPrompt, setAsrPrompt] = useState('')
  const [transEngine, setTransEngine] = useState('ollama')
  const [transModel, setTransModel] = useState('translategemma:12b')
  const [transPrompt, setTransPrompt] = useState('')
  const [ollamaModels, setOllamaModels] = useState<string[]>([]) 
  const [apiUrl, setApiUrl] = useState('http://localhost:11434/v1') 
  const [apiKey, setApiKey] = useState('')
  const [captureInterval, setCaptureInterval] = useState(2000)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSourcesLoading, setIsSourcesLoading] = useState(false)
  const [sources, setSources] = useState<CaptureSource[]>([])
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<any>(null)
  const logEndRef = useRef<HTMLDivElement>(null)
  const lastTextRef = useRef<string>('')

  useEffect(() => {
    const fetchOllamaModels = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/ollama_models')
        const data = await res.json()
        if (data.models) setOllamaModels(data.models)
      } catch (err) { console.error(err) }
    }
    if (transEngine === 'ollama') fetchOllamaModels()
  }, [transEngine])

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [text])

  const toggleLock = () => {
    const next = !isOverlayLocked
    setIsOverlayLocked(next)
    // @ts-ignore
    window.electronAPI.setOverlayLock(next)
  }

  const startCapture = async (sourceId: string) => {
    setIsModalOpen(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // @ts-ignore
          mandatory: { chromeMediaSource: 'desktop' }
        },
        video: {
          // @ts-ignore
          mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId }
        }
      })

      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length === 0) {
        stream.getTracks().forEach(t => t.stop())
        alert('未检测到音频轨道！请选择“屏幕(Screen)”源。')
        return
      }

      streamRef.current = stream 
      const mediaRecorder = new MediaRecorder(new MediaStream([audioTracks[0]]), { mimeType: 'audio/webm; codecs=opus' })
      mediaRecorderRef.current = mediaRecorder
      
      mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          const formData = new FormData()
          formData.append('file', e.data, 'audio.webm')
          formData.append('is_translate', String(isTranslate))
          formData.append('source_lang', sourceLang)
          formData.append('target_lang', targetLang)
          formData.append('asr_engine', asrEngine)
          formData.append('asr_model', asrModel)
          formData.append('asr_prompt', asrPrompt)
          formData.append('trans_engine', transEngine)
          formData.append('trans_model', transModel)
          formData.append('trans_prompt', transPrompt)
          formData.append('api_url', apiUrl)
          formData.append('api_key', apiKey)

          try {
            const response = await fetch('http://127.0.0.1:8000/asr', { method: 'POST', body: formData })
            const data = await response.json()
            if (data.text && data.text !== lastTextRef.current) {
              lastTextRef.current = data.text
              const display = (isTranslate && data.translated_text) ? `${data.text}\n${data.translated_text}` : data.text
              // @ts-ignore
              window.electronAPI.updateSubtitles(display)
              setText(prev => {
                const time = new Date().toLocaleTimeString([], { hour12: false })
                return prev + (prev ? '\n' : '') + `[${time}] ${display}`
              })
            }
          } catch (err) { console.error(err) }
        }
      }

      mediaRecorder.start()
      intervalRef.current = setInterval(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop()
          mediaRecorder.start()
        }
      }, captureInterval)
      setRecording(true)
    } catch (e) { alert('捕获失败') }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // 重置输入框，确保下一次选择相同文件也能触发
    const target = e.target;
    const cleanupInput = () => { target.value = ''; };

    const taskId = Math.random().toString(36).substring(7)
    setIsOfflineProcessing(true)
    setProgress(0)
    setProgressStatus('正在初始化...')
    setOfflineStatus('')

    // @ts-ignore
    const originalPath = file.path || ''
    const formData = new FormData()
    formData.append('file', file)
    // ... 其他参数保持不变 ...
    formData.append('source_lang', sourceLang)
    formData.append('target_lang', targetLang)
    formData.append('is_translate', String(isTranslate))
    formData.append('asr_engine', asrEngine)
    formData.append('asr_model', asrModel)
    formData.append('asr_prompt', asrPrompt)
    formData.append('trans_engine', transEngine)
    formData.append('trans_model', transModel)
    formData.append('trans_prompt', transPrompt)
    formData.append('api_url', apiUrl)
    formData.append('api_key', apiKey)
    formData.append('task_id', taskId)
    if (originalPath) formData.append('original_path', originalPath)

    const poller = setInterval(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/progress/${taskId}`)
        const data = await res.json()
        setProgress(data.progress)
        setProgressStatus(data.status)
        if (data.progress >= 100) clearInterval(poller)
      } catch (e) { console.error(e) }
    }, 1000)

    try {
      const res = await fetch('http://127.0.0.1:8000/process_video', { method: 'POST', body: formData })
      const data = await res.json()
      clearInterval(poller)
      setIsOfflineProcessing(false)
      cleanupInput()

      if (data.status === 'success') {
        setOfflineStatus(
          <div className="flex flex-col items-center gap-2 relative z-50">
            <span className="text-emerald-600 font-black">处理完成！</span>
            <p className="text-[10px] text-slate-500">字幕已尝试放置到原视频目录</p>
            <div className="flex gap-2">
              <a 
                href={`http://127.0.0.1:8000${data.download_url}`} 
                target="_blank" 
                className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-xs font-bold"
              >
                下载 SRT (备用)
              </a>
              <button 
                onClick={() => setOfflineStatus('')}
                className="px-4 py-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors text-xs font-bold"
              >
                再转一部
              </button>
            </div>
          </div>
        )
        setText(data.full_text)
      } else { setOfflineStatus('处理失败: ' + data.message) }
    } catch (e) { 
      clearInterval(poller); 
      setIsOfflineProcessing(false); 
      setOfflineStatus('网络错误'); 
      cleanupInput();
    }
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      <header className="px-8 py-5 bg-white border-b flex justify-between items-center shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="bg-linear-to-tr from-blue-600 to-indigo-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-200">
            <Languages size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black">Subtitle<span className="text-blue-600">AI</span> Pro</h1>
            <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase">Intelligence Transcription</p>
          </div>
        </div>
        <button 
          onClick={() => window.electronAPI.recenterOverlay()} 
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
        >
          <Maximize size={16} /> 重置字幕位置
        </button>
      </header>

      <main className="flex-1 p-6 grid grid-cols-12 gap-6 overflow-hidden max-w-[1600px] mx-auto w-full">
        {/* Left Panel */}
        <div className="col-span-12 lg:col-span-4 space-y-6 overflow-y-auto pr-2 custom-scrollbar flex flex-col">
          {/* Real-time Section */}
          <section className="bg-white p-8 rounded-[32px] shadow-xl shadow-slate-200/50 border border-white space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-blue-600">
                <Activity size={20} className={recording ? 'animate-pulse' : ''} />
                <h2 className="text-lg font-black text-slate-800">实时捕捉控制</h2>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-slate-700">
                  <Languages size={18} className={isTranslate ? 'text-blue-600' : 'text-slate-400'} />
                  <span className="font-bold text-sm">翻译模式</span>
                </div>
                <input type="checkbox" className="w-5 h-5" checked={isTranslate} onChange={e => setIsTranslate(e.target.checked)} />
              </div>

              <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">识别语言</p>
                    <select value={sourceLang} onChange={e => setSourceLang(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none">
                      <option value="zh">简体中文</option><option value="en">English</option><option value="ja">日本語</option><option value="ko">한국어</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">目标语言</p>
                    <select value={targetLang} onChange={e => setTargetLang(e.target.value)} disabled={!isTranslate} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none disabled:opacity-50">
                      <option value="zh">简体中文</option><option value="en">English</option><option value="ja">日本語</option><option value="ko">한국어</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">识别提示词 (ASR Prompt - 可选)</p>
                  <input 
                    type="text" 
                    value={asrPrompt} 
                    onChange={e => setAsrPrompt(e.target.value)} 
                    placeholder="引导特定术语、人名..." 
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20" 
                  />
                </div>

                <div className="pt-2 border-t border-slate-200 space-y-3">
                   <div className="flex items-center gap-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase w-16">识别引擎</p>
                      <select value={asrEngine} onChange={e => setAsrEngine(e.target.value)} className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none">
                        <option value="local">Whisper (本地)</option>
                        <option value="sense_voice">SenseVoice</option>
                        <option value="openai">OpenAI API</option>
                      </select>
                   </div>
                   {isTranslate && (
                    <>
                      <div className="flex items-center gap-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase w-16">翻译引擎</p>
                          <select 
                            value={transEngine} 
                            onChange={(e) => {
                              setTransEngine(e.target.value)
                              if (e.target.value === 'ollama') {
                                setTransModel('translategemma:12b')
                                setApiUrl('http://localhost:11434/v1')
                              } else if (e.target.value === 'openai') {
                                setApiUrl('https://api.openai.com/v1')
                              }
                            }} 
                            className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none"
                          >
                            <option value="google">Google</option>
                            <option value="local_nllb">NLLB (本地离线)</option>
                            <option value="ollama">Ollama (本地)</option>
                            <option value="openai">OpenAI API</option>
                          </select>
                      </div>

                      {(transEngine === 'ollama' || transEngine === 'openai' || asrEngine === 'openai') && (
                        <div className="space-y-3 mt-2 p-3 bg-slate-50/50 rounded-2xl border border-slate-100">
                          <div className="space-y-1">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">API URL</p>
                            <input 
                              type="text" 
                              value={apiUrl} 
                              onChange={(e) => setApiUrl(e.target.value)} 
                              placeholder="API 地址..." 
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20" 
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">API KEY</p>
                            <input 
                              type="password" 
                              value={apiKey} 
                              onChange={(e) => setApiKey(e.target.value)} 
                              placeholder="API 密钥..." 
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20" 
                            />
                          </div>
                          {(transEngine === 'ollama' || transEngine === 'openai') && (
                            <div className="space-y-1">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">翻译提示词 (Optional)</p>
                              <textarea 
                                value={transPrompt} 
                                onChange={(e) => setTransPrompt(e.target.value)} 
                                placeholder="引导翻译风格..." 
                                rows={2}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" 
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </>
                   )}
                </div>
              </div>

              <button 
                onClick={() => recording ? (
                  // @ts-ignore
                  (clearInterval(intervalRef.current), mediaRecorderRef.current?.stop(), streamRef.current?.getTracks().forEach(t => t.stop()), setRecording(false))
                ) : (
                  // @ts-ignore
                  (setIsSourcesLoading(true), setIsModalOpen(true), window.electronAPI.getSources().then(s => { setSources(s); setIsSourcesLoading(false); }))
                )}
                className={`w-full py-5 rounded-[24px] font-black text-lg transition-all flex items-center justify-center gap-3 shadow-lg ${
                  recording ? 'bg-white border-2 border-rose-500 text-rose-600' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
                }`}
              >
                {recording ? <><Square size={24} fill="currentColor" /> 停止捕捉</> : <><Mic size={24} /> 开始捕捉音频</>}
              </button>
            </div>
          </section>

          {/* Offline Section */}
          <section className="bg-white p-8 rounded-[32px] shadow-xl shadow-slate-200/50 border border-white space-y-4">
            <h2 className="font-black flex items-center gap-2 text-slate-700"><UploadCloud size={20} className="text-blue-500"/> 离线视频处理</h2>
            <div className="relative border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all group cursor-pointer">
              <input type="file" accept="video/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} />
              <UploadCloud size={32} className="text-slate-300 mx-auto mb-2 group-hover:text-blue-500 group-hover:-translate-y-1 transition-all" />
              <p className="text-slate-500 font-bold text-xs">点击或拖拽视频文件</p>
              
              {isOfflineProcessing && (
                <div className="mt-4 space-y-2 px-2">
                  <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase">
                    <span className="truncate max-w-[150px]">{progressStatus}</span>
                    <span className="text-blue-600">{progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border">
                    <div className="h-full bg-linear-to-r from-blue-500 to-indigo-600 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                  </div>
                </div>
              )}
              {offlineStatus && !isOfflineProcessing && <div className="mt-4 animate-in fade-in">{offlineStatus}</div>}
            </div>
          </section>
        </div>

        {/* Right Panel - Log */}
        <div className="col-span-12 lg:col-span-8 flex flex-col min-h-0 bg-white rounded-[32px] border border-white shadow-xl shadow-slate-200/50 overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><History size={20} /></div>
              <h2 className="text-lg font-black text-slate-800">实时转录日志</h2>
            </div>
            <button onClick={() => setText('')} className="text-[10px] font-black text-slate-300 hover:text-rose-500 uppercase tracking-widest transition-colors">Clear Log</button>
          </div>
          
          <div className="flex-1 p-8 overflow-y-auto bg-slate-50/30 custom-scrollbar relative">
            {text ? (
              <div className="space-y-4 font-mono text-sm">
                {text.split('\n').map((line, i) => (
                  <div key={i} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm text-slate-600 leading-relaxed animate-in slide-in-from-left-2">
                    {line}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-30 grayscale space-y-4">
                <Mic size={48} className="text-slate-200" />
                <p className="text-slate-400 font-bold">等待转录内容汇聚...</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <SourceSelectionModal 
        isOpen={isModalOpen} 
        sources={sources} 
        isLoading={isSourcesLoading}
        onClose={() => setIsModalOpen(false)} 
        onSelect={startCapture} 
        onRefresh={() => {
          setIsSourcesLoading(true);
          // @ts-ignore
          window.electronAPI.getSources().then(s => { setSources(s); setIsSourcesLoading(false); });
        }}
      />
    </div>
  )
}

const OverlayApp = () => {
  const [subtitle, setSubtitle] = useState('')
  const [isDragMode, setIsDragMode] = useState(false)
  const timerRef = useRef<any>(null)
  
  useEffect(() => {
    // @ts-ignore
    window.electronAPI.onSubtitleData((data: string) => {
      if (!data) return
      setSubtitle(data)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setSubtitle(''), 5000)
    })
    // @ts-ignore
    window.electronAPI.onToggleDragMode((mode: boolean) => setIsDragMode(mode))
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  return (
    <div className={`flex flex-col items-center justify-center h-full px-12 transition-all duration-500 ${isDragMode ? 'bg-blue-600/10 ring-4 ring-blue-500/30 rounded-[40px] ring-inset cursor-move' : ''}`} style={isDragMode ? { WebkitAppRegion: 'drag' } as any : {}}>
      {isDragMode && (
        <div className="absolute top-6 flex items-center justify-center pointer-events-none w-full animate-bounce">
          <div className="bg-blue-600 text-white px-8 py-3 rounded-full text-lg font-black shadow-2xl flex items-center gap-3">
            <Maximize size={24} /> 可拖动模式 (锁定后隐藏)
          </div>
        </div>
      )}
      {subtitle && (
        <div 
          className="subtitle-box animate-in fade-in zoom-in-95" 
          style={{ 
            background: 'rgba(15, 23, 42, 0.9)', 
            backdropFilter: 'blur(16px)',
            border: '2px solid rgba(255,255,255,0.1)', 
            borderRadius: '32px', 
            padding: '24px 48px', 
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', 
            color: '#ffffff', 
            textAlign: 'center',
            fontSize: '40px',
            fontWeight: 900,
            textShadow: '0 2px 8px rgba(0,0,0,0.5)'
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/overlay" element={<OverlayApp />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
)
