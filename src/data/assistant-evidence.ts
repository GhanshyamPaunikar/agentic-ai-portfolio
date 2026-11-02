import "server-only";

import snapshot from "@/data/github-snapshot.json";
import { GITHUB_PROJECTS } from "@/data/github-projects";
import { certifications, certSkills } from "@/data/portfolio";

/**
 * Where each of Ghanshyam's skills is proven, for questions like "does he
 * know Docker?" or "has he used PyTorch in a job?".
 *
 * Kept apart from assistant-knowledge.ts because the chat widget imports that
 * file's labels into the browser; this one is server-only and goes straight
 * into Elio's prompt, after the main facts.
 *
 * Evidence is ranked: used in a job, built in a project, public on GitHub,
 * taught by a certificate, or only listed on his CV. Nothing here may claim
 * more than the facts do; "CV only" is an honest answer, not a gap.
 */

type Evidence = { skill: string; job?: string; project?: string; github?: string; cert?: string; cvOnly?: boolean };

const EVIDENCE: Evidence[] = [
  // Languages and frameworks
  {
    skill: "Python",
    job: "Sigma AI (data processing and evaluation pipelines, 30% faster analysis); Zummit Infolabs (PyTorch MRI model)",
    project: "Innerbloom, CarbonWatcher, F1 Race Predictor, Image Upscaler, ASL Recogniser, Falcon 9 capstone",
    github: "most of his repositories are Python",
    cert: "IBM Data Science Professional; Python Programming for AI (Udemy)",
  },
  {
    skill: "SQL",
    project: "Falcon 9 capstone (SQL analysis)",
    cert: "SQL for Data Analysis (LinkedIn Learning); IBM Data Science Professional",
  },
  { skill: "C#", project: "Living NPCs (Unity, C#)", github: "AI-NPC repo", cert: "AI and AR in Unity (Udemy)" },
  { skill: "FastAPI / Python APIs", job: "Sigma AI (Python APIs and data pipelines integrated with internal data sources, with logging, monitoring and data privacy controls)", project: "Innerbloom backend (about 50 endpoints); F1 Race Predictor API" },
  { skill: "Full-stack AI applications", job: "Sigma AI (LLM-powered applications end to end, from backend services and model orchestration to review tools used daily by 300+ people)", project: "this portfolio (Next.js, React, TypeScript, a streaming LLM API route with rate limiting and a Redis store); Innerbloom (FastAPI backend with RAG and agent chat); F1 Race Predictor (FastAPI and Vue.js, live on Railway)" },
  { skill: "pytest / testing", job: "Sigma AI (in his stack)", project: "pytest suites in CarbonWatcher (44 tests), F1 Predictor (24) and Innerbloom (8)" },
  { skill: "Flask", cvOnly: true },
  { skill: "Pandas, NumPy", cert: "IBM Data Science Professional; ML with Python Foundations (LinkedIn)", project: "Falcon 9 capstone data analysis" },
  { skill: "SciPy", cvOnly: true },
  { skill: "React / TypeScript / JavaScript / Vue.js", project: "this portfolio (React, Next.js and TypeScript); Piano Tutor (JavaScript, Electron); F1 Race Predictor front end (Vue.js)", github: "carbonwatcher-docs site (TypeScript)" },

  // ML and deep learning
  {
    skill: "PyTorch",
    job: "Zummit Infolabs (UNet MRI segmentation, +15% cancer detection accuracy)",
    project: "his own super-resolution network (Fastv2: residual channel-attention blocks, 2x to 6x, trained with mixed precision and an L1 + LPIPS loss); a SignTransformer for word-level sign recognition; a Bi-LSTM for BSL words; the ASL letter classifier",
  },
  { skill: "TensorFlow / Keras", cert: "ML, Data Science and Deep Learning with Python (Udemy)", cvOnly: true },
  {
    skill: "Scikit-learn and classical ML",
    project: "F1 Race Predictor (XGBoost, HistGBR, Gradient Boosting and LightGBM ranking ensemble, season-held-out validation); Falcon 9 classification models",
    cert: "IBM Machine Learning with Python; Great Learning Supervised and Unsupervised ML",
  },
  { skill: "XGBoost / gradient boosting", project: "F1 Race Predictor (XGBoost, HistGradientBoosting, GradientBoosting and a LightGBM ranker, with recency-weighted samples and SHAP explanations)" },
  { skill: "Model evaluation and testing", project: "PSNR/SSIM/LPIPS evaluation and model A/B tests in the upscaler; per-class confusion matrices and cross-signer splits for BSL; pytest suites in CarbonWatcher (44 tests), F1 Predictor (24) and Innerbloom (8)" },
  { skill: "Explainable AI", project: "SHAP for the F1 model; LAM attribution maps for the super-resolution network" },
  {
    skill: "LLMs and fine-tuning",
    job: "Sigma AI (fine-tuned LLMs on transcription and annotation data for 300+ reviewers; LLM-powered QA pipelines)",
    project: "Innerbloom (local LLMs via Ollama); Living NPCs (GPT-3.5); this site's assistant Elio",
  },
  { skill: "LoRA, QLoRA, PEFT", project: "fine-tuned Falcon-7B with QLoRA (Hugging Face PEFT) on a mental-health conversational dataset, written up on Medium (April 2025)" },
  { skill: "RAG, grounding and semantic search", job: "Sigma AI, in production (retrieval for grounding inside the LangGraph workflows behind the LLM applications used daily by 300+ transcribers and reviewers)", project: "Innerbloom (hybrid keyword and semantic retrieval over a private journal, with cited answers)" },
  { skill: "AI agents / agentic AI", job: "Sigma AI (LangChain and LangGraph workflows and agent-style chains with multi-step reasoning and tool use)", project: "Innerbloom (an agent that plans, searches by meaning and synthesises; streaming chat with three personas; a planner picks tools, built from scratch without a framework)" },
  { skill: "LangChain, LangGraph", job: "Sigma AI (LLM workflows and agent-style chains with multi-step reasoning, tool use and retrieval)", project: "Innerbloom (the same plan, call tools, answer pattern, hand-built)" },
  { skill: "Tool calling", job: "Sigma AI (tool use in LangGraph agent chains)" },
  { skill: "AutoGen, CrewAI, LlamaIndex, MCP (Model Context Protocol)", cvOnly: true },
  { skill: "LLM evaluation and guardrails", job: "Sigma AI (evaluation frameworks with golden datasets scoring accuracy, groundedness, faithfulness and hallucinations; automated regression benchmarking of prompt chains before every release; LLM performance metrics and model and prompt comparisons; guardrails and Pydantic schema validation; Langfuse and OpenTelemetry tracing for cost, latency and quality)" },
  { skill: "Ragas, DeepEval", cvOnly: true },
  { skill: "Generative AI in business workflows / OpenAI API", job: "Virtual Engineering Centre, University of Liverpool (OpenAI-powered case-study processing in a live workflow, manual processing down about 60%)" },
  { skill: "Prompt engineering", job: "Sigma AI", cert: "IBM Generative AI", project: "Elio, this site's assistant" },
  { skill: "Hugging Face", job: "Sigma AI (Hugging Face Transformers for LoRA/PEFT fine-tuning)", project: "Image Upscaler (Hugging Face diffusers); CarbonWatcher tracks Hugging Face calls" },
  { skill: "Transformers, BERT", job: "Sigma AI (Hugging Face Transformers)" },
  { skill: "Diffusion models / Stable Diffusion", project: "Image Upscaler (Stable Diffusion x4, latent diffusion)" },
  { skill: "Reinforcement learning", cvOnly: true },

  // Vision and NLP
  { skill: "Computer vision", job: "Zummit Infolabs (MRI segmentation)", project: "ASL Recogniser and its BSL word-level follow-up; Image Upscaler; YOLOv5 brine-shrimp counter (Medium)", github: "Air-Calculator" },
  { skill: "OpenCV", project: "ASL Recogniser", github: "Air-Calculator (hand-tracked air maths)" },
  { skill: "MediaPipe", project: "ASL Recogniser (21 hand landmarks)", github: "Air-Calculator" },
  { skill: "CNNs", job: "Zummit Infolabs (UNet)", project: "YOLOv5 object detection (Medium)" },
  { skill: "UNet / medical imaging", job: "Zummit Infolabs" },
  { skill: "Super-resolution (SRGAN)", project: "Image Upscaler uses diffusion rather than SRGAN; SRGAN itself is on his CV" },
  { skill: "YOLO", project: "YOLOv5 to count brine shrimp in video, with active learning and semi-automated annotation in Roboflow (Medium, May 2025)" },
  { skill: "LSTMs / sequence models", project: "Bi-LSTM recognising 100 British Sign Language words from pose and hand landmarks (BSL follow-up to the ASL project)" },
  { skill: "NER, tokenisation", cvOnly: true },
  { skill: "Sentiment analysis / NLP", project: "Living NPCs (sentiment-aware responses); Innerbloom (16-emotion tagging)" },
  { skill: "Speech and voice", project: "Living NPCs (Meta Voice SDK speech-to-text and text-to-speech, Oculus lip-sync)" },
  { skill: "FAISS / vector databases", project: "Innerbloom semantic search", cvOnly: true },

  // Data
  { skill: "Dashboards", job: "Sigma AI (real-time quality and productivity dashboards for leadership); Virtual Engineering Centre (Power BI dashboards for project progress and resource allocation)", project: "Falcon 9 (Plotly Dash); CarbonWatcher team dashboards" },
  { skill: "Plotly", project: "Falcon 9 capstone (Plotly Dash)" },
  { skill: "Matplotlib, Seaborn", cert: "Data Visualization (Kaggle)", github: "Data-Visualization-with-Python (IBM labs)" },
  { skill: "Power BI", job: "Virtual Engineering Centre, University of Liverpool (Power BI dashboards reporting results to technical stakeholders)" },
  { skill: "Tableau", job: "Virtual Engineering Centre (in the internship's tool stack)" },
  { skill: "Data annotation and evaluation", job: "Sigma AI (annotation QA, agreement scores, error rate down 12%)" },

  // Cloud and MLOps
  { skill: "Model deployment", job: "Zummit Infolabs (deployment pipelines, training time down 20%)", project: "F1 Race Predictor (FastAPI app deployed on Railway)" },
  { skill: "MLOps / energy and cost tracking", project: "CarbonWatcher (pip package: energy, CO2 and cost of training runs and LLM calls)" },
  { skill: "Git and GitHub", github: "17 public repositories" },
  { skill: "Docker", job: "Sigma AI (in his LLM pipeline stack)" },
  { skill: "PostgreSQL", project: "Zeul (Supabase Postgres backend, with tables and RPCs shared with his co-developer)", cvOnly: true },
  { skill: "Databricks, PySpark, Delta Lake, feature stores, pgvector, Snowflake", cvOnly: true },
  { skill: "Azure AI Foundry, Azure OpenAI, Azure AI Search, Copilot Studio, Entra ID, OAuth", cvOnly: true },
  { skill: "Kubernetes, AWS, GCP, MLflow, Weights and Biases, CI/CD (GitHub Actions, Jenkins)", project: "CI building and testing every push for Zeul", cvOnly: true },
  { skill: "3D and simulation automation", job: "Virtual Engineering Centre (Python automation in NVIDIA Omniverse, repetitive 3D layout work down about 40%)" },

  // Other
  { skill: "Unity, AR, game AI", project: "Living NPCs", github: "AI-NPC", cert: "AI and AR in Unity + Xcode (Udemy)" },
  { skill: "Local / private AI (Ollama)", project: "Innerbloom (100% local, zero telemetry); CarbonWatcher tracks Ollama" },
  { skill: "AI ethics and responsible AI", cert: "Responsible Generative AI (University of Michigan)" },
  { skill: "Web front end (React, Next.js, three.js)", project: "this portfolio site, with its 3D robot Elio" },
];

const line = (e: Evidence) =>
  [
    e.job && `job: ${e.job}`,
    e.project && `project: ${e.project}`,
    e.github && `GitHub: ${e.github}`,
    e.cert && `certificate: ${e.cert}`,
    e.cvOnly && "listed on his CV",
  ]
    .filter(Boolean)
    .join("; ");

const CERT_TAUGHT = certifications
  .map((c) => {
    const taught = c.note ? certSkills[c.note] : undefined;
    return `${c.name} (${c.issuer ?? "issuer not listed"})${taught ? `: ${taught.join(", ")}` : ""}`;
  })
  .join("\n");

type Repo = { name: string; description: string; languages: string[]; readme: string; updated: string };

/** Repos that are copies of other people's projects, not his work. */
const NOT_HIS = new Set(["Face-Mask", "Sentiment-Analysis"]);

const REPOS = (snapshot.repos as Repo[])
  .filter((r) => !NOT_HIS.has(r.name))
  .map((r) => {
    const what = r.description || r.readme;
    return `${r.name}${r.languages.length ? ` [${r.languages.join(", ")}]` : ""}${what ? `: ${what}` : ""} (updated ${r.updated})`;
  })
  .join("\n");

export const EVIDENCE_TEXT = `<fact id="skills.evidence" label="Where each skill is proven">
For each skill, the strongest evidence first: job, then project, then GitHub, then certificate, then CV listing. A project counts only for the skill it is listed against here: do not claim a project used a tool unless this list says so.
${EVIDENCE.map((e) => `- ${e.skill}: ${line(e)}`).join("\n")}
</fact>

<fact id="certs.taught" label="What each certificate taught">
${CERT_TAUGHT}
</fact>

<fact id="github.repos" label="His public GitHub repositories (github.com/${snapshot.user}, snapshot ${snapshot.takenAt})">
${REPOS}
</fact>

<fact id="writing.medium" label="His Medium articles (medium.com/@ghanshyampaunikar)">
- "Innerbloom AI Journal — What I Built After Months of Journaling Into a Void" (April 2026): why he built Innerbloom; it began with Llama 3.2 3B whose answers "felt thin", then was rebuilt as an agent that plans, searches by meaning and synthesises.
- "Counting Brine Shrimp in Videos: A Practical Guide with YOLOv5 and Active Learning" (May 2025): small-object detection with YOLOv5s, active learning and semi-automated annotation (background subtraction, then Roboflow), trained in Google Colab; chosen over YOLOv8 and DETR for this task.
- "Fine-tuning of Falcon-7B Large Language Model using QLoRA on Mental Health Conversational Dataset" (April 2025): a mental-health support chatbot, fine-tuned with QLoRA/PEFT so a 7B model fits consumer hardware.
</fact>

<fact id="proj.details" label="More project details">
- F1 Race Predictor: data from the Jolpica/Ergast F1 API, 2018 to 2025 (180 races); 22 leakage-safe features such as grid position, recent form, circuit history, weather and practice pace; ensemble of XGBoost 0.30 + HistGradientBoosting 0.25 + GradientBoosting 0.15 + a LightGBM LambdaRank ranker 0.30; GroupKFold cross-validation holding out whole seasons, compared with the naive "grid equals finish" baseline (an earlier 12-feature version scored MAE 3.41 against about 4.5); 2,000 Monte Carlo races for win probabilities; SHAP explanations per driver.
- Sign language: the ASL alphabet recogniser worked best for the roughly ten geometrically distinct letters. Its follow-up recognises 100 British Sign Language words from 741 clips (about 38 minutes, 18 signers) with a Bi-LSTM over MediaPipe pose and both hands, plus text-to-sign playback; a work in progress whose write-up is honest that cross-signer accuracy is the hard part.
- Innerbloom: default local model qwen2.5:7b, embeddings mxbai-embed-large (1024-dim), semantic chunking, hybrid keyword and semantic search, cited answers, crisis detection that surfaces helplines.
- CarbonWatcher: published on PyPI (latest version 0.3.0); about 4,300 lines of Python with 44 tests.
- Image Upscaler, beyond the Stable Diffusion app: his own trainable super-resolution network, an evaluation and A/B-testing toolkit, and a live overlay that upscales part of the screen in real time.
- F1 Predictor, latest version: also uses FastF1 practice and qualifying laps (long-run pace, teammate qualifying gap) and a Vue 3 front end.
- Falcon 9 capstone: compared logistic regression, SVM, decision tree and KNN with grid search; all reached 83% test accuracy (F1 0.89), the tree did best in cross-validation (0.89).
- Innerbloom backend: about 5,700 lines of FastAPI with 50 endpoints and its own retrieval (no LangChain or vector database).
- Living NPCs: Unity with GPT-3.5 dialogue, Oculus Lip Sync and Wit text-to-speech; a demo video is on YouTube.
</fact>

<fact id="github.code" label="What is in his GitHub code, library by library">
${GITHUB_PROJECTS}
</fact>

<fact id="profile.site" label="This website">
This portfolio, ghanshyampaunikar.com, is his own build: Next.js, React and TypeScript, a 3D robot (Elio) modelled in Blender and rendered with three.js, a painted backdrop, and Elio's conversation running on Claude Sonnet 5.5 behind a streaming, rate-limited API route, grounded in these facts, with voice, speech input and on-device memory of returning visitors.
</fact>`;
