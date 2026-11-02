/**
 * Grounding corpus for the site assistant.
 *
 * This file is the ONLY source of truth the assistant is allowed to answer from.
 * It is small enough to fit entirely in the model's context, so there is no
 * vector store or retrieval step — the whole corpus is sent as a cached system
 * prompt. For a corpus this size that is both cheaper and strictly more reliable
 * than embedding search, which can silently miss the one chunk that mattered.
 *
 * Every fact carries a stable id. The assistant cites those ids, and the UI
 * resolves them back to labels so a visitor can see what an answer was based on.
 *
 * If a claim is not in this file, the assistant must say it does not know.
 */

export type Fact = {
  id: string;
  label: string;
  body: string;
};

export const IDENTITY = {
  name: "Ghanshyam Paunikar",
  title: "AI Engineer",
  location: "Pune, India",
  timezone: "IST (UTC +05:30)",
  email: "ghanshyampaunikar@gmail.com",
  site: "https://ghanshyampaunikar.com",
  linkedin: "https://www.linkedin.com/in/ghanshyampaunikar/",
  github: "https://github.com/GhanshyamPaunikar",
  resume: "/Ghanshyam-Paunikar-Resume.pdf",
};

/**
 * Things visitors reliably ask that are NOT in the corpus.
 * The assistant is instructed to decline these explicitly rather than guess.
 * Fill any of these in and move it into FACTS to let the assistant answer it.
 */
export const KNOWN_UNKNOWNS = [
  "Visa status, work authorisation, or sponsorship requirements for any country",
  "Notice period or earliest start date",
  "Reasons for leaving any previous role",
  "References or contact details for former managers",
  "Salary, CTC or compensation expectations (he discusses pay directly with employers, not through this site)",
];

export const FACTS: Fact[] = [
  // ─── Summary ───────────────────────────────────────────────────────────
  {
    id: "profile.summary",
    label: "Professional summary",
    body: `Ghanshyam Paunikar is an AI Engineer with over three years of building LLM-powered applications end to end, across UI, backend services and model orchestration, and an MSc in Data Science and AI from the University of Liverpool. He designs RAG pipelines for enterprise knowledge retrieval and grounding, builds LLM workflows and agents with multi-step reasoning and tool use in LangChain, LangGraph and AutoGen, and integrates models through Azure AI Foundry and hosted APIs. His specialty is LLM evaluation: frameworks for accuracy, hallucination detection, relevance and safety, automated benchmarking of prompt chains and agents, and metrics such as precision, recall and grounding fidelity. He builds data pipelines with Databricks, PySpark and Delta Lake, retrieval layers with PostgreSQL and pgvector, Python APIs and React front ends, made ready for production with logging, monitoring and security. Earlier he fine-tuned language models and trained a deep learning model that improved cancer detection accuracy by 15%. He is based in Pune, India (IST, UTC+05:30). He enjoys taking a problem from a rough idea all the way to a working, deployed and monitored solution, and cares most about AI that genuinely helps people: healthcare accuracy, mental wellness, and everyday work.`,
  },
  {
    id: "profile.focus",
    label: "Areas of focus",
    body: `Core areas: full-stack AI applications (Python APIs with FastAPI, React and TypeScript front ends), RAG and grounding, AI agents with LangGraph, LangChain and AutoGen, LLM evaluation (accuracy, hallucination, relevance, safety, golden datasets, automated benchmarking), data pipelines (Databricks, PySpark, Delta Lake, SQL), retrieval with PostgreSQL and pgvector, Azure AI Foundry and Azure OpenAI, and production readiness (logging, monitoring with Langfuse and OpenTelemetry, Docker, CI/CD, security). Also machine learning, fine-tuning (LoRA, QLoRA), computer vision and NLP. He describes his work as production-grade rather than prototype-stage.`,
  },
  {
    id: "profile.contact",
    label: "Contact and links",
    body: `Email: ghanshyampaunikar@gmail.com. Website: ghanshyampaunikar.com. LinkedIn: linkedin.com/in/ghanshyampaunikar. GitHub: github.com/GhanshyamPaunikar. His CV is under the Résumé tab at the top of the site, with a Download button, or at /Ghanshyam-Paunikar-Resume.pdf.`,
  },
  {
    id: "profile.availability",
    label: "Availability",
    body: `His role at Sigma AI ran until September 2026, and he has since moved back to India from London. He is open to roles now.
Work setup: he is looking for remote roles first. Hybrid or on-site also works for any office in Pune; an office in or near Kharadi is even better. He is not looking to relocate away from Pune for on-site work.
Compensation: not shared on this site; he discusses salary directly with employers.
Not on record: notice period or earliest start date, and visa or work-authorisation status for other countries; those must be asked of Ghanshyam directly.`,
  },

  // ─── Experience ────────────────────────────────────────────────────────
  {
    id: "exp.sigma",
    label: "LLM Engineer, Sigma AI",
    body: `LLM Engineer at Sigma AI, London, UK, from April 2024 to September 2026 (about two and a half years).
- Built LLM-powered applications end to end, from backend services and model orchestration to the review tools used daily by 300+ transcribers and reviewers.
- Developed LLM evaluation frameworks with golden datasets scoring accuracy, groundedness, faithfulness and hallucinations, plus automated regression benchmarking of prompt chains before every release.
- Defined and monitored LLM performance metrics with Langfuse and OpenTelemetry, and ran experiments comparing models and prompts, including fine-tuning with LoRA/PEFT.
- Built LLM workflows and agent-style chains with LangChain and LangGraph using multi-step reasoning, tool use, and retrieval for grounding.
- Built data pipelines and Python APIs (FastAPI) integrated with internal data sources, with logging, monitoring and data privacy controls.
- Fine-tuned Large Language Models with LoRA/PEFT on transcription and annotation datasets, improving guideline adherence and output consistency.
- Built LLM-powered QA pipelines that detect transcription errors and formatting deviations automatically, cutting manual review effort and accelerating delivery timelines.
- Built evaluation and regression harnesses with golden datasets scoring groundedness, faithfulness and accuracy, run before every release to catch errors early.
- Added guardrails and Pydantic schema validation to reduce hallucinations and formatting failures, and instrumented pipelines with Langfuse and OpenTelemetry for cost, latency and quality.
- Engineered automated data processing and evaluation pipelines in Python, decreasing analysis turnaround time by 30%.
- Designed real-time dashboards tracking annotator productivity, agreement scores and quality metrics, giving leadership actionable operational insights.
- Worked with platform, data and operations teams to ship production-ready AI, reducing error rates by 12%.
Technologies: Python, LangChain, LangGraph, LLM APIs, LoRA/PEFT, Hugging Face Transformers, PyTorch, Pydantic, pytest, FastAPI, Docker, Langfuse, OpenTelemetry, SQL.`,
  },
  {
    id: "exp.vec",
    label: "Data Scientist Intern, Virtual Engineering Centre",
    body: `Data Scientist Intern at the Virtual Engineering Centre, University of Liverpool, Liverpool, UK, from October 2023 to March 2024.
- Built an LLM integration for automated case-study processing in Python: Google Forms collected structured submissions, OpenAI API calls handled prompt-based processing, and outputs were generated automatically, cutting manual processing time by about 60%.
- Embedded generative AI in an existing business workflow used for real business case-study submissions, from input collection through API calls to automated handling of each case.
- Evaluated results against the manual process with technical stakeholders and reported performance through Power BI dashboards for project progress and resource allocation.
- Developed Python-based automation in NVIDIA Omniverse, reducing repetitive 3D layout design effort by about 40% during project testing.
Technologies: Python, OpenAI API, SQL, TensorFlow, Tableau, Power BI.`,
  },
  {
    id: "exp.zummit",
    label: "Data Scientist, Zummit Infolabs",
    body: `Data Scientist at Zummit Infolabs, Bangalore, India, from February 2021 to October 2021.
- Architected and fine-tuned a UNet-based deep learning model for MRI image segmentation using PyTorch, achieving a 15% improvement in cancer detection accuracy.
- Built end-to-end data preprocessing and model deployment pipelines with augmentation and normalisation, reducing training time by 20%.
- Benchmarked state-of-the-art computer vision architectures against baseline models, translating findings into design decisions that improved segmentation performance.
- Communicated complex deep learning findings to non-technical medical stakeholders weekly, bridging ML research and clinical decision-making.
Technologies: Python, PyTorch, OpenCV, NumPy, Pandas, Scikit-learn, Matplotlib.`,
  },
  {
    id: "exp.timeline",
    label: "Career timeline",
    body: `Timeline: B.E. Mechanical Engineering (2016 – 2020), then Data Scientist at Zummit Infolabs, Bangalore (Feb 2021 – Oct 2021), then MSc Data Science and Artificial Intelligence at the University of Liverpool (Sep 2022 – Sep 2023), then Data Scientist Intern at the Virtual Engineering Centre, University of Liverpool (Oct 2023 – Mar 2024), then LLM Engineer at Sigma AI, London (Apr 2024 – Sep 2026). Total professional experience is over three years (about three and a half), excluding the full-time MSc year.`,
  },

  // ─── Education ─────────────────────────────────────────────────────────
  {
    id: "edu.msc",
    label: "MSc, University of Liverpool",
    body: `MSc in Data Science and Artificial Intelligence, University of Liverpool, UK, September 2022 to September 2023. His MSc dissertation was the AI NPC: Living Characters project — a modular NPC system with AI-driven dialogue, real-time voice recognition, lip-sync animation and sentiment-aware emotional responses.`,
  },

  {
    id: "edu.be",
    label: "B.E., Raisoni College",
    body: `B.E. in Mechanical Engineering, Raisoni College, RTMNU (Rashtrasant Tukadoji Maharaj Nagpur University), Nagpur, India, 2016 to 2020. An engineering degree, which he followed with an MSc in Data Science and AI.`,
  },

  // ─── Projects ──────────────────────────────────────────────────────────
  {
    id: "proj.npc",
    label: "AI NPC: Living Characters",
    body: `AI NPC: Living Characters — GPT-3.5, Unity, C#, Meta Voice SDK (Wit.ai), Oculus LipSync. His MSc dissertation project. NPCs you talk to by voice: Wit.ai speech-to-text, GPT-3.5 in character with the conversation history, Wit.ai text-to-speech, and lip-synced facial animation; the model can trigger in-game actions by keyword, an early form of tool calling. Reported a 45% engagement lift. Repository: github.com/GhanshyamPaunikar/AI-NPC`,
  },
  {
    id: "proj.innerbloom",
    label: "Innerbloom (AI journal)",
    body: `Innerbloom — Ollama, FastAPI, local JSON storage. A 100% local AI journal with zero telemetry. Features streaming agent chat with three personas (Companion, Observer, Challenger), 16-emotion tagging, a Wellbeing Radar tracking burnout and spiral patterns, a People social CRM, and a Memory Graph. Everything runs on the user's own machine via local LLMs and semantic search; entries are analysed for emotion, intensity and themes, and the journal can be queried conversationally to surface contradictions, emotional triggers and long-term patterns. Repository: github.com/GhanshyamPaunikar/innerbloom`,
  },
  {
    id: "proj.carbonwatcher",
    label: "CarbonWatcher",
    body: `CarbonWatcher — Python, Intel RAPL, NVIDIA NVML. Installable via "pip install carbonwatcher". Tracks energy consumption, CO2 and cost for ML training runs and LLM API calls across Anthropic, OpenAI, Ollama and Hugging Face. Includes location-aware grid intensity, a CLI with monthly dashboards and team reports, and 44 pytest tests. Repository: github.com/GhanshyamPaunikar/carbonwatcher`,
  },
  {
    id: "proj.f1",
    label: "F1 Race Predictor",
    body: `F1 Race Predictor — XGBoost, HistGBR, LightGBM, FastAPI, Vue.js, SHAP; was deployed on Railway. An ensemble (including a LightGBM learning-to-rank model) trained across 8 F1 seasons (about 3,500 driver-race rows, 22 leakage-safe features including weather and practice pace). Runs 2,000 Monte Carlo races for win probabilities, predicts DNF risk, and explains each driver with SHAP. An earlier 12-feature version scored a cross-validated MAE of 3.41 positions. Podium and full 20-driver grid predictions. Repository: github.com/GhanshyamPaunikar/f1-race-predictor`,
  },
  {
    id: "proj.upscaler",
    label: "Image Resolution Upscaler",
    body: `Image Resolution Upscaler — Stable Diffusion x4, PyTorch, diffusers, Gradio. Prompt-guided 4x super-resolution via latent diffusion, hallucinating sharp high-frequency detail at four times the original resolution. Configurable diffusion steps and noise levels; auto-caches a 1.7 GB model on first run. Runs locally with a Gradio UI. Repository: github.com/GhanshyamPaunikar/Image-Resolution-Upscaler`,
  },
  {
    id: "proj.asl",
    label: "ASL Sign Language Recogniser",
    body: `Sign Language Recogniser — MediaPipe, PyTorch, OpenCV. Real-time ASL alphabet reading from 21 MediaPipe hand landmarks using geometric rules on finger positions (about 10 letters out of the box), then word-level work: a PyTorch Transformer scaffold for ASL words and a BSL recogniser on his own scraped dataset (741 clips, 100 words) with a Bi-LSTM, evaluated on held-out signers (16-18% top-1 on 100 words), plus text-to-sign and a browser demo. Repository: github.com/GhanshyamPaunikar/Translator-Sign-Language`,
  },
  {
    id: "proj.falcon9",
    label: "SpaceX Falcon 9 Landing Prediction",
    body: `SpaceX Falcon 9 Landing Prediction — his IBM Data Science Capstone. Predicts whether the Falcon 9 first stage will land successfully, enabling launch cost estimation. Built with classification models, exploratory data analysis, SQL, Folium maps and a Plotly Dash dashboard. Repository: github.com/GhanshyamPaunikar/IBM-Capstone`,
  },

  {
    id: "proj.zeul",
    label: "Zeul (Android wallpaper app)",
    body: `Zeul — Kotlin, Jetpack Compose, Material 3, Supabase (Postgres). A free, open-source (GPL-3.0) Android wallpaper app: curated HD and AMOLED feeds, a "For You" feed that learns from picked styles, search with tag autocomplete and colour/device filters, full-screen preview with fake home and lock screens, apply with crop, blur and dim, community uploads, favourites that work offline, and an auto wallpaper changer. Launched 12 October 2026. Built by two developers in about two weeks, each working with their own Claude Code agent and coordinating through a written contract of shared tables, RPCs and interfaces, a task board and hand-off notes in git, with CI building and testing every push. Ghanshyam built the Android app: UI, data layer, preview, search, onboarding, tablet layouts and background work; his co-developer Raunak Patil built the backend, dashboard, ads and billing, design system and launch. Repository (Raunak's account, both credited): github.com/raunakpatil/ZeulWallpaperApp`,
  },
  {
    id: "proj.piano",
    label: "Piano Tutor",
    body: `Piano Tutor — JavaScript (plain ES modules, no build step), HTML, CSS, Electron for the Mac and Windows apps, Web MIDI, with Python tooling. A Synthesia-style app for learning piano: notes fall toward a keyboard where every key is named (C D E or Do Re Mi). Listen, Practice (the song waits for the right note) and Play along modes; left hand, right hand or both; tempo down to 50%; loop any section; a scrolling grand-staff sheet music view generated from the song; metronome; keyboard sizes from 25 to 88 keys with out-of-range notes folded into range; sustain pedal; 30-second previews; a MIDI library from any folder; works offline. Works with any USB or Bluetooth MIDI keyboard, or the computer keyboard. Free, with a one-time purchase to remove ads. Released October 2026. Repository: github.com/GhanshyamPaunikar/piano-tutor`,
  },

  // ─── Skills ────────────────────────────────────────────────────────────
  {
    id: "skills.languages",
    label: "Programming languages",
    body: `Programming languages: Python, SQL, C#, JavaScript, TypeScript, Kotlin, and C++ (exposure).`,
  },
  {
    id: "skills.genai",
    label: "Generative AI & LLMs",
    body: `Generative AI and LLMs: LLMs, prompt engineering, fine-tuning (LoRA, QLoRA, PEFT), Hugging Face Transformers, BERT, OpenAI, Claude, Gemini, Ollama, diffusion models.`,
  },
  {
    id: "skills.agentic",
    label: "Agentic AI & RAG",
    body: `Agentic AI and RAG: RAG and grounding, LLM workflows, AI agents with multi-step reasoning and tool use, LangGraph, LangChain, AutoGen, CrewAI, LlamaIndex, multi-agent systems, Model Context Protocol (MCP), summarisation and search, embeddings, indexing strategies, vector search (pgvector, FAISS, Azure AI Search).`,
  },
  {
    id: "skills.ml",
    label: "ML & deep learning",
    body: `ML and deep learning: PyTorch, TensorFlow, Keras, Scikit-learn, XGBoost, LightGBM, reinforcement learning, video pretraining.`,
  },
  {
    id: "skills.vision_nlp",
    label: "Computer vision & NLP",
    body: `Computer vision and NLP: OpenCV, YOLO (object detection), UNet (segmentation), SRGAN, CNNs, LSTMs, MediaPipe, NER, spaCy, tokenization, sentiment analysis.`,
  },
  {
    id: "skills.eval",
    label: "LLM evaluation & safety",
    body: `LLM evaluation and safety: evaluation frameworks for accuracy, hallucination, relevance and safety; precision, recall and grounding fidelity; golden datasets; automated benchmarking of prompt chains and agents; Ragas, DeepEval, Langfuse, OpenTelemetry, guardrails, Pydantic, prompt engineering, responsible AI.`,
  },
  {
    id: "skills.web",
    label: "Backend & front end",
    body: `Full stack: Python, FastAPI, Flask, REST APIs, React, TypeScript, Next.js, Streamlit, Vue.js, Gradio.`,
  },
  {
    id: "skills.cloud",
    label: "Cloud & MLOps",
    body: `Cloud and production readiness: Azure AI Foundry, Azure OpenAI, Azure AI Search, Microsoft Copilot Studio, AWS, GCP, Docker, Kubernetes, CI/CD (GitHub Actions, Jenkins), logging and monitoring (Langfuse, OpenTelemetry), security (Entra ID, OAuth), MLflow, Weights and Biases, Git.`,
  },
  {
    id: "skills.data",
    label: "Data & visualisation",
    body: `Data and retrieval: Databricks, PySpark, Delta Lake, feature stores, PostgreSQL, pgvector, Snowflake, SQL, data modelling, Pandas, NumPy, SciPy. Visualisation: Power BI, Tableau, Plotly, Matplotlib, Seaborn.`,
  },
  {
    id: "skills.tools",
    label: "Tools & platforms",
    body: `Tools and platforms: Claude Code (skills, plugins), Microsoft Copilot Studio, Power Platform, Unity, Unreal Engine, Blender, NVIDIA Omniverse.`,
  },
  {
    id: "skills.other",
    label: "Other tools",
    body: `Also used across projects: Kotlin, Jetpack Compose and Supabase for Android (Zeul); JavaScript, Electron and Web MIDI for desktop apps (Piano Tutor); Unity and C# for real-time and XR work, Meta Voice SDK (Wit.ai) and Oculus LipSync for voice, Ollama for local LLM inference, Gradio, Vue.js, Railway, MediaPipe, Stable Diffusion and the diffusers library, Intel RAPL and NVIDIA NVML for energy telemetry.`,
  },
  {
    id: "skills.spoken",
    label: "Spoken languages",
    body: `Spoken languages: English (fluent), Hindi (native), Marathi (fluent), German (A1).`,
  },

  // ─── Certifications ────────────────────────────────────────────────────
  {
    id: "certs.main",
    label: "Certifications",
    body: `Certifications: Claude Code 101 (Anthropic Education, completed June 2026); Data Science Professional Certificate (IBM); Generative AI: Elevate Your Data Science Career (IBM); Machine Learning with Python (IBM); Responsible Generative AI Specialisation (University of Michigan); Elements of AI (University of Helsinki); Artificial Intelligence (DRDO, Government of India); Supervised ML — Logistic Regression and Naive Bayes (Great Learning); Unsupervised Machine Learning — K-Means (Great Learning); Machine Learning with Python Foundations (LinkedIn Learning); SQL for Data Analysis (LinkedIn Learning); Data Visualization (Kaggle); ML, Data Science and Deep Learning with Python (Udemy); Python Programming for Artificial Intelligence (Udemy); Artificial Intelligence and AR in Unity + Xcode (Udemy).`,
  },

  // ─── Writing ───────────────────────────────────────────────────────────
  {
    id: "pubs.articles",
    label: "Publications & articles",
    body: `Articles he has published: "Modern AI Applications in Video Gaming"; "Innerbloom AI Journal: What I Built After Months of Journaling Into a Void"; "Fine-tuning Falcon-7B with QLoRA on a Mental Health Conversational Dataset"; "Counting Brine Shrimp in Videos with YOLOv5 and Active Learning" (object detection with YOLOv5). These are articles, not peer-reviewed journal or conference papers.`,
  },

  // ─── Other ─────────────────────────────────────────────────────────────
  {
    id: "other.hobbies",
    label: "Hobbies and interests",
    body: `Outside work: badminton, swimming, rollerblading, photography, videography and video editing, travelling, adventure sports, and listening to music (his Spotify is linked at the top right of the site). He keeps up with the latest in AI as a habit, and he grew up watching documentaries.`,
  },
  {
    id: "other.volunteering",
    label: "Volunteering",
    body: `Volunteer in Community Outreach at the Spread Smile Foundation, focused on education, healthcare and community development.`,
  },
  {
    id: "other.writing",
    label: "Writing and other links",
    body: `He writes at medium.com/@ghanshyampaunikar and freetechtweets.blogspot.com. Instagram: instagram.com/ghanshyampaunikar.`,
  },
  {
    id: "work.brine-shrimp",
    label: "Counting brine shrimp in video (computer vision, YOLOv5, active learning)",
    body: `Work he did and wrote up on Medium (May 2025), not one of the nine portfolio projects: counting brine shrimp (Artemia) in video, a genuinely hard detection problem because they are tiny, translucent and cluster together. Background subtraction overcounted and off-the-shelf YOLOv8 missed them, so he built his own pipeline: background subtraction to draft bounding boxes automatically, refined by hand in Roboflow; a fine-tuned YOLOv5s model trained in Google Colab; then an active-learning loop (predict on new frames, correct the mistakes, retrain), which cut annotation time sharply and beat DETR on efficiency. It shows the instinct that matters in applied computer vision: diagnosing why the standard tools fail and designing the data pipeline around it. Bring it up for computer vision, object detection, YOLO, small-object detection, video analytics, data labelling or active learning questions, alongside the ASL recogniser, the image upscaler and his MRI segmentation work at Zummit.`,
  },
  {
    id: "writing.articles",
    label: "His Medium articles, and when each one fits",
    body: `- "Innerbloom AI Journal — What I Built After Months of Journaling Into a Void": why and how he built Innerbloom. Fits any question about Innerbloom, local LLMs, RAG or mental-health tech.
- "Modern AI Applications in Video Gaming": his University of Liverpool MSc dissertation (2023, supervised by Professor Boris Konev), the Living NPCs project: a Unity NPC driven by GPT-3.5 with Meta Oculus Voice for speech in and out and a custom emotion model, so it holds context-aware conversations and reacts to how the player feels. Fits Living NPCs, game AI, voice AI, conversational agents.
- "Counting Brine Shrimp in Videos: A Practical Guide with YOLOv5 and Active Learning": see the brine shrimp work. Fits computer vision, object detection, YOLO, active learning.
- "Fine-tuning of Falcon-7B Large Language Model using QLoRA on Mental Health Conversational Dataset" (April 2025): fine-tuned the open Falcon-7B on consumer-grade hardware with QLoRA (4-bit quantisation plus LoRA adapters through Hugging Face PEFT) to build a mental-health support chatbot on a curated conversational dataset, avoiding the memory cost and catastrophic forgetting of full fine-tuning. Fits fine-tuning, LoRA, QLoRA, PEFT, open-source LLMs.`,
  },
  {
    id: "meta.assistant",
    label: "About this assistant",
    body: `This assistant, Elio, is itself one of Ghanshyam's projects: a robot with an old TV for a head, on his portfolio site. It answers with Claude Sonnet 5.5 behind a rate-limited Next.js API route on Vercel, streaming so it can start speaking before the whole answer is written, and falls back to the portfolio's own search if the model can't be reached. All his facts, the evidence behind each skill and a snapshot of his public GitHub fit in the model's context, so there is no vector store and no retrieval misses. It speaks with an Azure neural voice that acts out its mood, its face and body move with the sound, it listens through Azure speech-to-text, and it remembers returning visitors on their own device only. It is checked by an evaluation suite of single questions and multi-turn conversations. No API key ever reaches the browser.`,
  },
];

/** Serialised corpus. Stable ordering keeps the prompt cache warm. */
export const CORPUS_TEXT = FACTS.map(
  (f) => `<fact id="${f.id}" label="${f.label}">\n${f.body}\n</fact>`,
).join("\n\n");

/** Safe to import from client components — ids and short labels only. */
export const FACT_LABELS: Record<string, string> = Object.fromEntries(
  FACTS.map((f) => [f.id, f.label]),
);
