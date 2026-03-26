from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
from deep_translator import GoogleTranslator
import zhconv
import os
import shutil
import uuid
import logging
import requests
import ctranslate2
import transformers
import re
import uvicorn
import datetime
from fastapi.staticfiles import StaticFiles

# --- 自动配置 ffmpeg ---
try:
    import imageio_ffmpeg
    ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
    ffmpeg_dir = os.path.dirname(ffmpeg_path)
    if ffmpeg_dir not in os.environ["PATH"]:
        os.environ["PATH"] = ffmpeg_dir + os.path.pathsep + os.environ["PATH"]
    logging.info(f"✅ Auto-configured ffmpeg: {ffmpeg_path}")
except ImportError:
    logging.warning("⚠️ imageio-ffmpeg not found.")

# --- SenseVoice 支持检查 ---
try:
    from funasr import AutoModel
    HAS_SENSE_VOICE = True
except ImportError:
    HAS_SENSE_VOICE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# --- 目录配置 ---
BASE_DIR = os.path.dirname(__file__)
MODEL_DIR = os.path.join(BASE_DIR, "models")
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_OFFLINE"] = "1"

# --- ASR 配置 ---
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL", "large-v3-turbo") 

PROMPT_MAP = {
    "zh": "简体中文。",
    "ja": "日本語。",
    "en": "English.",
    "ko": "한국어。"
}

VAD_PARAMS = {
    "min_silence_duration_ms": 1000,
    "speech_pad_ms": 400,
    "threshold": 0.4 
}

ASR_STABILITY_PARAMS = {
    "beam_size": 5,
    "best_of": 5,
    "no_speech_threshold": 0.6,
    "log_prob_threshold": -1.0,
    "compression_ratio_threshold": 2.4,
    "condition_on_previous_text": True
}

def clean_sense_voice_text(text):
    if not text: return ""
    return re.sub(r'<\|.*?\|>', '', text).strip()

def is_hallucination(text):
    if not text: return True
    h_list = ["谢谢观看", "大家下次再见", "请订阅", "字幕组", "Thanks for watching", "視聴ありがとうございました"]
    clean_text = text.strip().replace("。", "").replace(".", "")
    return any(h in clean_text for h in h_list) or len(clean_text) <= 1

def load_whisper_model(size):
    try:
        device = "cuda" if os.getenv("USE_CUDA", "true") == "true" else "cpu"
        compute_type = "float16" if device == "cuda" else "int8"
        logger.info(f"Loading Whisper {size} on {device}...")
        return WhisperModel(size, device=device, compute_type=compute_type)
    except Exception as e:
        logger.error(f"Whisper Load Error: {e}")
        return WhisperModel("base", device="cpu", compute_type="int8")

whisper_model = load_whisper_model(WHISPER_MODEL_SIZE)

sense_voice_model = None
def get_sense_voice():
    global sense_voice_model
    if sense_voice_model is None and HAS_SENSE_VOICE:
        sense_voice_model = AutoModel(model="iic/SenseVoiceSmall", device="cuda:0")
    return sense_voice_model

class LocalTranslator:
    def __init__(self):
        self.translator = None
        self.tokenizer = None
        self.path = os.path.join(MODEL_DIR, "nllb-200-distilled-600M-ct2")
    def translate(self, text, target_lang):
        try:
            if self.translator is None:
                if not os.path.exists(self.path): return None
                from transformers import NllbTokenizer
                self.tokenizer = NllbTokenizer.from_pretrained(self.path, local_files_only=True)
                self.translator = ctranslate2.Translator(self.path, device="cuda" if ctranslate2.get_cuda_device_count()>0 else "cpu")
            lang_map = {"zh": "zho_Hans", "en": "eng_Latn", "ja": "jpn_Jpan", "ko": "kor_Hang"}
            src = self.tokenizer.convert_ids_to_tokens(self.tokenizer.encode(text))
            res = self.translator.translate_batch([src], target_prefix=[[lang_map.get(target_lang, "eng_Latn")]])
            return self.tokenizer.decode(self.tokenizer.convert_tokens_to_ids(res[0].hypotheses[0][1:]))
        except: return None

local_translator = LocalTranslator()

def perform_translation(text, source_lang, target_lang, trans_engine="google", api_url="", api_key="", trans_model="gpt-3.5-turbo"):
    if not text or not text.strip() or source_lang == target_lang: return text
    
    if trans_engine == "local_nllb":
        res = local_translator.translate(text, target_lang)
        if res: return res
        trans_engine = "google"

    if trans_engine in ["openai", "ollama"]:
        try:
            url = (api_url if api_url else ("http://localhost:11434/v1" if trans_engine == "ollama" else "https://api.openai.com/v1")).rstrip('/') + "/chat/completions"
            headers = {"Authorization": f"Bearer {api_key if api_key else 'ollama'}", "Content-Type": "application/json"}
            target_name = {"zh": "Simplified Chinese", "en": "English", "ja": "Japanese"}.get(target_lang, "Simplified Chinese")
            payload = {
                "model": trans_model,
                "messages": [{"role": "system", "content": f"Translate to {target_name}. Return ONLY translated text."}, {"role": "user", "content": text}],
                "temperature": 0.2
            }
            res = requests.post(url, headers=headers, json=payload, timeout=30).json()
            return res["choices"][0]["message"]["content"].strip()
        except: pass

    try:
        t_map = {"zh": "zh-CN", "en": "en", "ja": "ja", "ko": "ko"}
        return GoogleTranslator(source='auto', target=t_map.get(target_lang, "en")).translate(text)
    except: return text

@app.get("/ollama_models")
async def get_ollama_models():
    try:
        res = requests.get("http://localhost:11434/api/tags", timeout=3).json()
        return {"models": [m["name"] for m in res.get("models", [])]}
    except: return {"models": []}

def format_timestamp(seconds: float):
    td = datetime.timedelta(seconds=seconds)
    ts = str(td).split(".")
    if len(ts) == 1: return f"0{ts[0]},000"
    return f"0{ts[0]},{ts[1][:3]}"

@app.post("/asr")
async def transcribe_and_translate(
    file: UploadFile = File(...), is_translate: str = Form("false"),
    source_lang: str = Form("zh"), target_lang: str = Form("en"),
    asr_engine: str = Form("local"), asr_model: str = Form("whisper-1"), asr_prompt: str = Form(""),
    trans_engine: str = Form("google"), trans_model: str = Form("gpt-3.5-turbo"),
    api_url: str = Form(""), api_key: str = Form("")
):
    temp = f"temp_{uuid.uuid4()}.webm"
    try:
        with open(temp, "wb") as f: shutil.copyfileobj(file.file, f)
        if os.path.getsize(temp) < 100: return {"text": "", "translated_text": ""}
        
        raw_text = ""
        if asr_engine == "sense_voice" and HAS_SENSE_VOICE:
            res = get_sense_voice().generate(input=temp, cache={}, language=source_lang, use_itn=True)
            raw_text = clean_sense_voice_text(res[0]["text"])
        elif asr_engine == "openai" and api_key:
            url = (api_url if api_url else "https://api.openai.com/v1").rstrip('/') + "/audio/transcriptions"
            with open(temp, "rb") as af:
                res = requests.post(url, headers={"Authorization": f"Bearer {api_key}"}, files={"file": af}, data={"model": asr_model, "language": source_lang}).json()
                raw_text = res.get("text", "")
        else:
            prompt = asr_prompt if asr_prompt else PROMPT_MAP.get(source_lang, "简体中文。")
            segs, _ = whisper_model.transcribe(temp, language=source_lang, vad_filter=True, vad_parameters=VAD_PARAMS, initial_prompt=prompt, **ASR_STABILITY_PARAMS)
            raw_text = "".join([s.text for s in segs]).strip()

        if is_hallucination(raw_text): return {"text": "", "translated_text": ""}
        processed = zhconv.convert(raw_text, 'zh-cn') if source_lang == "zh" else raw_text
        trans = perform_translation(processed, source_lang, target_lang, trans_engine, api_url, api_key, trans_model) if is_translate == "true" else ""
        return {"text": processed, "translated_text": trans}
    finally:
        if os.path.exists(temp): os.remove(temp)

progress_store = {}

@app.get("/progress/{task_id}")
async def get_progress(task_id: str):
    return progress_store.get(task_id, {"progress": 0, "status": "等待中..."})

@app.post("/process_video")
async def process_video(
    file: UploadFile = File(...), source_lang: str = Form("zh"), target_lang: str = Form("en"),
    is_translate: str = Form("false"), asr_engine: str = Form("local"), asr_model: str = Form("whisper-1"), asr_prompt: str = Form(""),
    trans_engine: str = Form("google"), trans_model: str = Form("gpt-3.5-turbo"),
    api_url: str = Form(""), api_key: str = Form(""), task_id: str = Form(None)
):
    tid = task_id if task_id else str(uuid.uuid4())
    progress_store[tid] = {"progress": 5, "status": "正在准备..."}
    safe_name = re.sub(r'[^\w\.-]', '_', file.filename)
    v_path = os.path.join(OUTPUT_DIR, f"{tid}_{safe_name}")
    srt_path = v_path + ".srt"
    
    try:
        with open(v_path, "wb") as f: shutil.copyfileobj(file.file, f)
        progress_store[tid] = {"progress": 15, "status": "识别中..."}
        
        segs_data = []
        if asr_engine == "local":
            prompt = asr_prompt if asr_prompt else PROMPT_MAP.get(source_lang, "简体中文。")
            segs, info = whisper_model.transcribe(v_path, language=source_lang, vad_filter=True, vad_parameters=VAD_PARAMS, initial_prompt=prompt, **ASR_STABILITY_PARAMS)
            for s in segs:
                segs_data.append({"start": s.start, "end": s.end, "text": s.text.strip()})
                progress_store[tid] = {"progress": min(90, 15 + int((s.end/info.duration)*70)), "status": f"识别中: {int(s.end)}s"}
        else:
            # 简化非Local引擎处理
            res = await transcribe_and_translate(file, "false", source_lang, target_lang, asr_engine, asr_model, asr_prompt, "google", "", api_url, api_key)
            segs_data = [{"start": 0, "end": 30, "text": res.get("text", "")}]

        srt_out = ""
        for i, s in enumerate(segs_data, 1):
            if is_hallucination(s["text"]): continue
            txt = zhconv.convert(s["text"], 'zh-cn') if source_lang=="zh" else s["text"]
            disp = txt
            if is_translate == "true":
                tr = perform_translation(txt, source_lang, target_lang, trans_engine, api_url, api_key, trans_model)
                if tr and tr != txt: disp = f"{txt}\n{tr}"
            srt_out += f"{i}\n{format_timestamp(s['start'])} --> {format_timestamp(s['end'])}\n{disp}\n\n"
        
        with open(srt_path, "w", encoding="utf-8") as f: f.write(srt_out)
        progress_store[tid] = {"progress": 100, "status": "完成！"}
        return {"status": "success", "download_url": f"/outputs/{os.path.basename(srt_path)}", "full_text": "已生成 SRT"}
    except Exception as e:
        progress_store[tid] = {"progress": 0, "status": f"失败: {str(e)}"}
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
