#!/usr/bin/env python3
"""
Scans Ghanshyam's cloned GitHub repositories and writes docs/github-projects.md:
a section per repository (what it is, languages, files, libraries, models,
techniques, metrics found in code and notebook outputs) and an index from
every library, model and technique to the repositories that use it, with the
files where it appears.

    python3 scripts/scan-repos.py <dir-with-cloned-repos>

Only what is in the code counts: imports, declared dependencies, estimator and
layer names, and technique keywords. Repos that are copies of other people's
work are listed separately and left out of the index.
"""
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / "docs" / "github-projects.md"

# Not his own code: listed, never credited.
NOT_HIS = {
    "Face-Mask": "a copy of Karan-Malik/FaceMaskDetector",
    "Sentiment-Analysis": "a copy of the text2vec R package",
    "Unitychatgpt": "the open-source OpenAI-Unity package his AI-NPC project depends on",
}
COURSEWORK = {
    "IBM-Capstone": "IBM Data Science Professional Certificate capstone",
    "Data-Visualization-with-Python-offered-by-IBM": "labs from IBM's Data Visualization with Python course",
    "Python-Project-for-Data-Science-IBM": "IBM Python Project for Data Science assignment",
    "DSTools": "IBM Data Science Tools and Ecosystem assignment",
}
TITLES = {
    "innerbloom": "Innerbloom — local AI journal",
    "Translator-Sign-Language": "Sign Language Translator (ASL letters, ASL words, BSL words)",
    "f1-race-predictor": "F1 Race Predictor",
    "carbonwatcher": "CarbonWatcher (PyPI package)",
    "carbonwatcher-docs": "CarbonWatcher documentation site",
    "Image-Resolution-Upscaler": "Image Resolution Upscaler / super-resolution research code",
    "AI-NPC": "AI NPC: Living Characters (MSc dissertation)",
    "IBM-Capstone": "SpaceX Falcon 9 landing prediction (IBM capstone)",
    "Air-Calculator": "Air Calculator (hand-gesture calculator)",
    "Crypto-trends": "Crypto trends dashboard (Power BI)",
    "GhanshyamPaunikar.github.io": "Earlier personal website",
    "Data-Visualization-with-Python-offered-by-IBM": "IBM Data Visualization with Python labs",
    "Python-Project-for-Data-Science-IBM": "Extracting and visualising stock data (IBM)",
    "DSTools": "Data Science Tools and Ecosystem (IBM)",
}

# A plain-English summary per repository, from reading the code and READMEs.
SUMMARY = {
    "innerbloom": "A 100% local AI journal (zero telemetry). FastAPI backend (~5,700 lines, ~50 endpoints) on Ollama: default chat model qwen2.5:7b (started on Llama 3.2 3B), embeddings mxbai-embed-large (1024-dim). Each entry is classified in one pass into emotion (16 fixed labels), intensity, summary, tags, themes and people. Custom retrieval: semantic chunking with max-pooling, hybrid keyword + cosine search, cited answers. Agent chat streamed as JSONL (classify, plan, tools, draft) with three personas. Insight engines (contradictions, emotional triggers, wellbeing radar, life story), memory graph (IDF-weighted Jaccard + clustering), people CRM, Spotify mood correlation (OAuth PKCE), crisis detection with helplines. Single-page front end (~5,500 lines). No LangChain or vector database.",
    "Translator-Sign-Language": "Three stages of sign-language recognition. (1) ASL alphabet: MediaPipe 21 hand landmarks, wrist-normalised, geometric rules / classifier, live webcam. (2) ASL words: a SignTransformer (4-layer transformer encoder, attention pooling, learned positions) over 1,662-dim MediaPipe Holistic features on a WLASL-100 subset. (3) BSL words: 100 words, 741 clips (~38 min) scraped from signbsl.com across 18 signers; Bi-LSTM over pose + both hands, AdamW + cosine schedule, per-class confusion report, cross-signer splits; text-to-sign playback and a browser demo. Honest results: 16-26% top-1 on all 100 words, 43% on the 46 best-covered, vs 1-2% chance; ~80% train vs ~20% held-out (overfitting from 5-8 clips per word).",
    "f1-race-predictor": "Predicts F1 finishing positions. Data: Jolpica/Ergast API 2018-2025 (~3,500 driver-race rows) plus FastF1 practice and qualifying laps (best lap, long-run pace, teammate quali gap, consistency). Features: grid, recent form, circuit history, team points share and more. Model: weighted ensemble of XGBoost, HistGradientBoosting, GradientBoosting and a LightGBM ranker, recency-weighted samples, time-aware 5-fold CV, 1,000x Monte Carlo for win probabilities, SHAP explanations. MAE 3.41 +/- 0.11 positions vs ~4.5 for 'grid = finish'. FastAPI backend, Vue 3 front end, Railway deploy, 24 pytest tests.",
    "carbonwatcher": "A pip package (carbonwatcher, v0.3.0 on PyPI) that measures energy, CO2 and cost of ML training runs and LLM API calls. Energy from Intel RAPL, NVIDIA NVML and Apple powermetrics, DRAM estimates, PUE; location-aware grid intensity; LLM token tracking for Anthropic, OpenAI, Ollama, Hugging Face and llama.cpp; epoch-based extrapolation; CLI that wraps any script; monthly dashboards, goals and team reports. ~4,300 lines, 44 pytest tests.",
    "carbonwatcher-docs": "Next.js + TypeScript documentation site for CarbonWatcher (CLI, Python API, LLM tracking, hardware, dashboards, team reports).",
    "Image-Resolution-Upscaler": "Two things. A Gradio app around Stable Diffusion x4 (prompt-guided 4x upscaling; float32 on CPU because Apple MPS float16 gave wrong output). And his own super-resolution research code: 'Fastv2', a residual channel-attention network with pixel-shuffle upsamplers for 2x/3x/4x/6x, trained with AdamW, StepLR, mixed precision and L1 + LPIPS perceptual loss on multi-scale pairs; PSNR/SSIM evaluation, an A/B test script comparing checkpoints, speed tests, LAM attribution maps for interpretability, and a live screen-capture overlay that upscales a window in real time (optionally torch.compile).",
    "AI-NPC": "Unity MSc dissertation project. NPC persona 'Aarya' on gpt-3.5-turbo-0613 with conversation memory and a word limit; Oculus voice dictation (speech to text), Wit text-to-speech, Oculus Lip Sync, and keyword-triggered NPC actions (the model adds an action keyword, Unity fires an event). Demo: youtu.be/XglIWsSAWKk.",
    "IBM-Capstone": "SpaceX Falcon 9 first-stage landing prediction. Data from the SpaceX REST API and Wikipedia scraping; wrangling and one-hot encoding; EDA with SQL and charts; Folium map; Plotly Dash dashboard; GridSearchCV over logistic regression, SVM, decision tree and KNN (tree best in CV at 0.889; all 0.833 accuracy, F1 0.889 on test).",
    "Air-Calculator": "A calculator you operate with finger gestures in the air: OpenCV webcam at 1280x720, MediaPipe hand tracking, finger counting.",
    "Crypto-trends": "A Power BI cryptocurrency dashboard; note every file on GitHub is currently empty (0 bytes).",
    "Data-Visualization-with-Python-offered-by-IBM": "Course labs: pandas preprocessing, Matplotlib line/area/histogram/bar charts, waffle charts, word clouds, regression plots and Folium maps.",
    "Python-Project-for-Data-Science-IBM": "Course assignment: extracting and visualising stock data.",
}

# Work that is real but not in these repositories, so the index still answers it.
ELSEWHERE = [
    ("Semantic segmentation", "Zummit Infolabs job (résumé): UNet MRI segmentation, +15% cancer detection accuracy"),
    ("U-Net", "Zummit Infolabs job (résumé)"),
    ("Medical imaging", "Zummit Infolabs job (résumé)"),
    ("LLM fine-tuning", "Sigma AI job (résumé); Falcon-7B QLoRA (Medium, Apr 2025)"),
    ("QLoRA / LoRA / PEFT", "Falcon-7B mental-health chatbot (Medium, Apr 2025)"),
    ("Object detection", "YOLOv5 brine-shrimp counter (Medium, May 2025)"),
    ("YOLO (YOLOv5)", "brine-shrimp counter (Medium, May 2025)"),
    ("Active learning", "brine-shrimp counter (Medium, May 2025)"),
    ("Roboflow annotation", "brine-shrimp counter (Medium, May 2025)"),
    ("Dashboards", "Sigma AI job (résumé): real-time quality dashboards"),
    ("Evaluation pipelines", "Sigma AI job (résumé)"),
]

# Import name → readable library name.
LIBS = {
    "numpy": "NumPy", "pandas": "pandas", "scipy": "SciPy", "sklearn": "scikit-learn",
    "torch": "PyTorch", "torchvision": "torchvision", "tensorflow": "TensorFlow", "keras": "Keras",
    "xgboost": "XGBoost", "lightgbm": "LightGBM", "catboost": "CatBoost", "shap": "SHAP",
    "transformers": "Hugging Face Transformers", "diffusers": "Hugging Face diffusers",
    "accelerate": "Hugging Face Accelerate", "peft": "PEFT", "bitsandbytes": "bitsandbytes",
    "datasets": "Hugging Face Datasets", "trl": "TRL", "lpips": "LPIPS", "pytorch_msssim": "pytorch-msssim",
    "cv2": "OpenCV", "mediapipe": "MediaPipe", "PIL": "Pillow", "skimage": "scikit-image",
    "imageio": "imageio", "matplotlib": "Matplotlib", "seaborn": "Seaborn", "plotly": "Plotly",
    "dash": "Plotly Dash", "folium": "Folium", "gradio": "Gradio", "fastapi": "FastAPI",
    "uvicorn": "Uvicorn", "flask": "Flask", "pydantic": "Pydantic", "httpx": "httpx",
    "requests": "requests", "aiofiles": "aiofiles", "bs4": "BeautifulSoup", "lxml": "lxml",
    "sqlite3": "SQLite", "sqlalchemy": "SQLAlchemy", "joblib": "joblib", "numba": "Numba",
    "mss": "mss (screen capture)", "pytest": "pytest", "click": "Click", "rich": "Rich",
    "anthropic": "Anthropic API", "openai": "OpenAI API", "ollama": "Ollama", "llama_cpp": "llama.cpp",
    "pynvml": "NVIDIA NVML", "psutil": "psutil", "yfinance": "yfinance", "fastf1": "FastF1",
    "tqdm": "tqdm", "wordcloud": "WordCloud", "pywaffle": "PyWaffle", "sentence_transformers": "Sentence Transformers",
    "langchain": "LangChain", "faiss": "FAISS", "chromadb": "Chroma", "nltk": "NLTK", "spacy": "spaCy",
    "statsmodels": "statsmodels", "tiktoken": "tiktoken", "geopy": "geopy", "yaml": "PyYAML",
    "multiprocessing": "multiprocessing", "asyncio": "asyncio", "threading": "threading",
    "argparse": "argparse", "json": None, "os": None, "sys": None, "re": None, "time": None,
}
# Patterns in code → model or technique, so "random forest" or
# "semantic segmentation" can be traced to a file.
PATTERNS = {
    # classic ML
    "Logistic regression": r"LogisticRegression\b",
    "Support vector machine (SVM)": r"\bSVC\b|\bSVR\b|svm\.",
    "Decision tree": r"DecisionTree(Classifier|Regressor)",
    "Random forest": r"RandomForest(Classifier|Regressor)",
    "K-nearest neighbours": r"KNeighbors(Classifier|Regressor)",
    "Gradient boosting (scikit-learn)": r"\bGradientBoosting(Classifier|Regressor)",
    "HistGradientBoosting": r"HistGradientBoosting(Classifier|Regressor)",
    "XGBoost model": r"XGB(Classifier|Regressor|Ranker)",
    "LightGBM ranker": r"LGBMRanker|lgb\.LGBMRanker|lgb_rank",
    "Linear regression": r"\bLinearRegression\b",
    "K-means clustering": r"\bKMeans\b",
    "PCA": r"\bPCA\(",
    "Grid search": r"GridSearchCV",
    "Cross-validation": r"cross_val_score|KFold|TimeSeriesSplit|GroupKFold|StratifiedKFold|cv=\d",
    "One-hot encoding": r"get_dummies|OneHotEncoder",
    "Feature scaling": r"StandardScaler|MinMaxScaler|RobustScaler",
    "Train/test split": r"train_test_split",
    "Confusion matrix": r"confusion_matrix",
    "Monte Carlo simulation": r"[Mm]onte[ _-]?[Cc]arlo|n_sims|n_simulations",
    "Ensembling": r"VotingClassifier|StackingClassifier|self\.weights\s*=|ensemble_weights",
    "Sample weighting": r"sample_weight",
    "SHAP explanations": r"shap\.",
    "Feature engineering": r"feature[s]?_eng|engineer(ed)?_feature|def (add|build|make)_features",
    # deep learning
    "Convolutional neural network (CNN)": r"nn\.Conv2d|Conv2D\(",
    "U-Net": r"\bU-?Net\b",
    "Residual blocks": r"ResidualBlock|ResBlock",
    "Channel attention (RCAB)": r"ChannelAttention|RCAB",
    "Pixel shuffle / sub-pixel upsampling": r"PixelShuffle",
    "LSTM / Bi-LSTM": r"nn\.LSTM|LSTM\(",
    "Transformer encoder": r"TransformerEncoder(Layer)?|SignTransformer",
    "Multi-head attention": r"MultiheadAttention",
    "Attention pooling": r"AttentionPool",
    "Positional encoding": r"PositionalEncoding|pos_emb",
    "Dropout": r"nn\.Dropout|Dropout\(",
    "Layer / batch normalisation": r"nn\.LayerNorm|nn\.BatchNorm|BatchNormalization",
    "AdamW optimiser": r"AdamW",
    "Learning-rate scheduling": r"lr_scheduler|CosineAnnealing|StepLR|OneCycle",
    "Mixed precision (AMP)": r"GradScaler|autocast",
    "torch.compile": r"torch\.compile",
    "Perceptual loss (LPIPS)": r"lpips\.LPIPS|perceptual",
    "L1 / MSE loss": r"L1Loss|MSELoss|mse_loss",
    "PSNR / SSIM metrics": r"psnr|ssim",
    "Super-resolution": r"super[-_ ]?resolution|upscal(e|er)",
    "Diffusion model (Stable Diffusion)": r"StableDiffusion|stable-diffusion|diffusers",
    "Interpretability (LAM attribution maps)": r"\bLAM\b|attribution_map|saliency",
    "Data augmentation": r"def augment|augmentation|RandomHorizontalFlip|ColorJitter|RandomResizedCrop",
    "Early stopping / checkpointing": r"early_stop|patience\s*=|save_checkpoint|torch\.save\(",
    "Semantic segmentation": r"semantic[ _-]segmentation|segmentation_models|DeepLab|SegFormer|Mask ?R-?CNN|\bU-?Net\b",
    "Object detection": r"\bYOLO|yolov\d|detectMultiScale|non_max_suppression|\bDETR\b|FasterRCNN",
    "Haar cascades": r"haarcascade|CascadeClassifier",
    "Hand landmark tracking": r"mp\.solutions\.hands|HandLandmarker|hand_landmarker|HAND_CONNECTIONS",
    "Pose estimation": r"PoseLandmarker|pose_landmarker|mp\.solutions\.pose|Holistic",
    "Sign language recognition": r"WLASL|\bgloss|sign language|SignTransformer|\bBSL\b|\bASL\b",
    "Real-time webcam inference": r"VideoCapture\(0\)|webcam",
    # LLMs / NLP
    "Large language models": r"ollama|gpt-3\.5|gpt-4|CreateChatCompletion|anthropic\.|openai\.|llama|qwen|/api/generate",
    "Embeddings": r"/api/embed|mxbai|nomic-embed|SentenceTransformer|def _?embed",
    "Semantic search / RAG": r"cosine|semantic_search|def _?retrieve|def search_entries",
    "Hybrid search (keyword + semantic)": r"hybrid",
    "Chunking": r"def _?\w*chunk\w*\(",
    "AI agent loop / tool use": r"/chat/agent|tool_call|def _?plan\w*\(|TOOLS\s*=",
    "Streaming responses": r"StreamingResponse|stream=True|text/event-stream",
    "Prompt engineering": r"system_prompt|SYSTEM_PROMPT|personality|GetInstructions|PERSONAS?\b",
    "Emotion / sentiment analysis": r"emotion|sentiment",
    "Token counting": r"tiktoken|count_tokens|input_tokens|prompt_eval_count",
    "Speech to text": r"Dictation|SpeechRecognition|webkitSpeechRecognition|[Ww]hisper",
    "Text to speech": r"TTSWit|TTSSpeaker|speechSynthesis|text_to_speech",
    "Lip sync": r"LipSync",
    "OAuth (PKCE)": r"PKCE|code_verifier",
    "Crisis detection / safety": r"crisis|self[- ]harm",
    # data / engineering
    "Web scraping": r"BeautifulSoup|read_html|def scrape",
    "REST API consumption": r"requests\.get\(|httpx\.(get|AsyncClient|Client)|fetch\(",
    "SQL queries": r"SELECT\s+.+\s+FROM|%sql|sqlite3\.connect",
    "Caching": r"lru_cache|@cache\b|cache_dir|_cache\b",
    "Background jobs / threads": r"BackgroundTasks|threading\.Thread|ThreadPool",
    "Energy measurement (RAPL / NVML)": r"RAPL|rapl|nvml|powermetrics",
    "Carbon accounting": r"gCO2|carbon_intensity|co2_kg|grid_intensity",
    "CLI tool": r"argparse\.ArgumentParser|@click\.|add_subparsers",
    "Unit tests (pytest)": r"def test_",
    "Unity (C#)": r"MonoBehaviour|UnityEngine",
    "Geospatial maps": r"folium\.|Marker\(|MarkerCluster",
    "Dashboard": r"dash\.Dash|dcc\.Graph",
}
CODE_EXT = {".py", ".ipynb", ".cs", ".js", ".ts", ".tsx", ".html", ".r", ".R"}
SKIP_DIRS = {".git", "node_modules", "Library", "Packages", "Temp", "obj", "__pycache__", ".next"}


def text_of(path: Path) -> str:
    try:
        if path.suffix == ".ipynb":
            nb = json.loads(path.read_text(errors="ignore"))
            parts = []
            for c in nb.get("cells", []):
                parts.append("".join(c.get("source", "")))
            return "\n".join(parts)
        return path.read_text(errors="ignore")
    except Exception:
        return ""


def notebook_metrics(path: Path) -> list[str]:
    try:
        nb = json.loads(path.read_text(errors="ignore"))
    except Exception:
        return []
    found = []
    for c in nb.get("cells", []):
        for o in c.get("outputs", []):
            t = "".join(o.get("text", "")) or "".join(o.get("data", {}).get("text/plain", ""))
            for m in re.finditer(r"(accuracy|f1|r2|rmse|mae|auc|precision|recall|score)[^\n]{0,40}?(\d\.\d{2,4})", t, re.I):
                found.append(f"{m.group(1)} {m.group(2)}")
    return found[:12]


repos = sorted(p for p in ROOT.iterdir() if p.is_dir() and (p / ".git").exists() or (p.is_dir() and p.name == "DSTools"))
per_repo = {}
index = defaultdict(lambda: defaultdict(set))  # term -> repo -> files

for repo in repos:
    name = repo.name
    files = [
        f for f in repo.rglob("*")
        if f.is_file() and not (set(f.relative_to(repo).parts) & SKIP_DIRS)
    ]
    code = [f for f in files if f.suffix in CODE_EXT and f.stat().st_size < 3_000_000]
    langs = defaultdict(int)
    for f in code:
        langs[{".py": "Python", ".ipynb": "Jupyter", ".cs": "C#", ".js": "JavaScript", ".ts": "TypeScript",
               ".tsx": "TypeScript/React", ".html": "HTML"}.get(f.suffix, f.suffix)] += 1
    libs = defaultdict(set)
    hits = defaultdict(set)
    loc = 0
    metrics = []
    for f in code:
        t = text_of(f)
        rel = str(f.relative_to(repo))
        loc += t.count("\n")
        if f.suffix in (".py", ".ipynb"):
            for m in re.finditer(r"^\s*(?:from|import)\s+([A-Za-z_][\w]*)", t, re.M):
                lib = LIBS.get(m.group(1))
                if lib:
                    libs[lib].add(rel)
            if f.suffix == ".ipynb":
                metrics += [f"{rel}: {x}" for x in notebook_metrics(f)]
        if f.suffix == ".cs":
            for m in re.finditer(r"^using\s+([\w.]+);", t, re.M):
                ns = m.group(1).split(".")[0]
                if ns in ("UnityEngine", "OpenAI", "Oculus", "Meta", "Facebook"):
                    libs[{"UnityEngine": "Unity", "OpenAI": "OpenAI-Unity", "Oculus": "Oculus SDK",
                          "Meta": "Meta Voice SDK", "Facebook": "Wit.ai"}[ns]].add(rel)
        if f.suffix in (".js", ".html") and re.search(r"vue(@\d|\.global)", t):
            libs["Vue.js"].add(rel)
        if f.suffix in (".ts", ".tsx") and "next" in t:
            libs["Next.js"].add(rel)
        if f.suffix == ".html" and name not in ("innerbloom", "Translator-Sign-Language", "f1-race-predictor"):
            continue  # a web page's prose, not code
        for term, pat in PATTERNS.items():
            if re.search(pat, t):
                hits[term].add(rel)
    # Declared dependencies.
    for req in [f for f in files if f.name in ("requirements.txt", "pyproject.toml", "package.json", "setup.py")]:
        t = req.read_text(errors="ignore").lower()
        for imp, lib in LIBS.items():
            if lib and re.search(rf"(^|[\s\"'\[]){re.escape(imp.replace('_', '-'))}([\s=<>~\[,\"']|$)", t, re.M):
                libs[lib].add(str(req.relative_to(repo)))
        for dep in ("lightgbm", "fastf1", "vue", "next", "react", "tailwindcss"):
            if dep in t:
                libs[{"lightgbm": "LightGBM", "fastf1": "FastF1", "vue": "Vue.js", "next": "Next.js",
                      "react": "React", "tailwindcss": "Tailwind CSS"}[dep]].add(str(req.relative_to(repo)))
    tests = sum(text_of(f).count("def test_") for f in code if "test" in f.name)
    per_repo[name] = dict(langs=dict(langs), libs=libs, hits=hits, loc=loc, files=len(files), code=len(code),
                          tests=tests, metrics=metrics)
    if name not in NOT_HIS:
        for lib, fs in libs.items():
            index[lib][name] |= fs
        for term, fs in hits.items():
            index[term][name] |= fs


def files_note(fs, n=3):
    fs = sorted(fs)
    more = f" +{len(fs) - n} more" if len(fs) > n else ""
    return ", ".join(f"`{f}`" for f in fs[:n]) + more


lines = [
    "# Ghanshyam Paunikar — GitHub projects in detail",
    "",
    "Generated by `scripts/scan-repos.py` from the code of every public repository at",
    "github.com/GhanshyamPaunikar: imports, declared dependencies, model and layer names,",
    "technique keywords and notebook outputs. Each entry names the files it was found in.",
    "",
    "## Index: library, model or technique → projects",
    "",
]
for term in sorted(index, key=str.lower):
    where = "; ".join(f"**{TITLES.get(r, r)}** ({files_note(fs, 2)})" for r, fs in sorted(index[term].items()))
    lines.append(f"- **{term}**: {where}")
lines += ["", "## Not in these repositories (from his résumé and Medium)", ""]
for term, where in ELSEWHERE:
    lines.append(f"- **{term}**: {where}")
lines += ["", "## Repositories", ""]
for name, d in per_repo.items():
    title = TITLES.get(name, name)
    lines.append(f"### {title}  (`{name}`)")
    if name in NOT_HIS:
        lines += [f"Not his own work: {NOT_HIS[name]}. Not credited anywhere.", ""]
        continue
    if name in COURSEWORK:
        lines.append(f"Coursework: {COURSEWORK[name]}.")
    if name in SUMMARY:
        lines.append(SUMMARY[name])
        lines.append("")
    lines.append(f"- Size: {d['files']} files, {d['code']} code files, ~{d['loc']:,} lines of code"
                 + (f", {d['tests']} tests" if d["tests"] else ""))
    if d["langs"]:
        lines.append("- Languages: " + ", ".join(f"{k} ({v})" for k, v in sorted(d["langs"].items(), key=lambda x: -x[1])))
    if d["libs"]:
        lines.append("- Libraries: " + ", ".join(sorted(d["libs"])))
    models = [t for t in d["hits"] if t in PATTERNS and list(PATTERNS).index(t) < list(PATTERNS).index("Embeddings")]
    other = [t for t in d["hits"] if t not in models]
    if models:
        lines.append("- Models and ML techniques: " + ", ".join(sorted(models)))
    if other:
        lines.append("- Other techniques: " + ", ".join(sorted(other)))
    if d["metrics"]:
        lines.append("- Results printed in notebooks: " + "; ".join(d["metrics"][:8]))
    lines.append("")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(lines) + "\n")
print(f"wrote {OUT} ({len(index)} index terms, {len(per_repo)} repos)")

# A compact copy for PIX's prompt: the index without file lists, the work
# found elsewhere, and the summaries.
compact = ["Where each library, model and technique appears in his GitHub code (scanned from the code itself):"]
for term in sorted(index, key=str.lower):
    compact.append(f"- {term}: " + "; ".join(TITLES.get(r, r) for r in sorted(index[term])))
compact.append("Also, outside the public repos: " + "; ".join(f"{t}: {w}" for t, w in ELSEWHERE) + ".")
compact.append("Project summaries from the code:")
for name, text in SUMMARY.items():
    compact.append(f"- {TITLES.get(name, name)}: {text}")
TS = Path(__file__).resolve().parent.parent / "src" / "data" / "github-projects.ts"
TS.write_text(
    "// Generated by scripts/scan-repos.py from the code of his public repositories. Do not edit by hand.\n"
    "export const GITHUB_PROJECTS = " + json.dumps("\n".join(compact)) + ";\n"
)
print(f"wrote {TS} ({len(' '.join(compact))} chars)")
