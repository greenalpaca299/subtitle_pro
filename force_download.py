import os
import sys

# 强制设置镜像站环境变量
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

try:
    from huggingface_hub import snapshot_download
    print("正在连接国内镜像站 (hf-mirror.com)...")
except ImportError:
    print("错误: 请先安装 huggingface_hub 库。运行: pip install huggingface_hub")
    sys.exit(1)

# 更换为目前最稳定的仓库 ID
repo_id = "jtranslate/nllb-200-distilled-600M-ct2"

# 目标路径
local_dir = r"D:\project\subtitle-tool\python_engine\models\nllb-200-distilled-600M-ct2"

def main():
    print(f"准备下载模型: {repo_id}")
    print(f"下载目录: {local_dir}")
    
    try:
        # 开始下载
        path = snapshot_download(
            repo_id=repo_id,
            local_dir=local_dir,
            local_dir_use_symlinks=False,
            # 只下载 CTranslate2 必需的文件
            allow_patterns=[
                "model.bin",
                "shared_vocabulary.json",
                "tokenizer.json",
                "config.json",
                "vocabulary.json",
                "tokenizer_config.json",
                "special_tokens_map.json",
                "sentencepiece.bpe.model"
            ]
        )
        print("\n" + "="*30)
        print("✅ 下载成功！")
        print(f"模型已保存至: {path}")
        print("现在您可以重启后端 python python_engine/main.py 了。")
        print("="*30)
    except Exception as e:
        print("\n" + "!"*30)
        print("❌ 下载失败")
        print(f"错误信息: {str(e)}")
        print("\n提示: 如果依然报错，您可以尝试在浏览器中直接打开以下链接手动下载文件：")
        print(f"https://hf-mirror.com/{repo_id}/tree/main")
        print("!"*30)

if __name__ == "__main__":
    main()
