export const profile = {
  name: "Ghanshyam Paunikar",
  firstName: "Ghanshyam",
  lastName: "Paunikar",
  title: "AI Engineer",
  roles: ["AI Engineer", "LLM Engineer", "AI & Data Engineer"],
  location: "Pune, India",
  timezone: "IST (UTC +05:30)",
  status: "Open to roles · 2026",
  email: "ghanshyampaunikar@gmail.com",
  summary:
    "Pune-based AI Engineer, previously LLM Engineer at Sigma AI. Three-plus years building LLM-powered applications end to end: RAG for grounded answers, LangGraph agents with tool use, evaluation frameworks that catch hallucinations before release, Python APIs and React front ends. Not prototypes. Things that ship.",
};

export const stats = [
  { value: "3+", label: "Years in production AI" },
  { value: "95%+", label: "Model accuracy across deployed CV systems" },
  { value: "7", label: "Shipped projects across AI, CV, ML & NLP" },
  { value: "45%", label: "Engagement lift from GenAI characters" },
];

export const services = [
  {
    title: "Applied Generative AI",
    description: "LLM products, RAG pipelines, chat agents, and voice-driven characters. From concept to evaluated, monitored release.",
    items: ["ChatGPT API", "RAG", "LangChain", "Eleven Labs"],
  },
  {
    title: "Computer Vision",
    description: "Real-time detection, tracking and super-resolution. Deployed on edge devices with 95%+ accuracy across difficult conditions.",
    items: ["YOLO", "UNet", "OpenCV", "SRGAN"],
  },
  {
    title: "NLP & Semantic Search",
    description: "Classification, NER, embeddings and retrieval. The quiet infrastructure that makes enterprise text actually useful.",
    items: ["BERT", "Transformers", "Hugging Face", "FAISS"],
  },
  {
    title: "Data Analytics",
    description: "Pipelines, dashboards, A/B tests and statistical modelling. Turning telemetry into decisions your team can act on.",
    items: ["Pandas", "SQL", "Tableau", "Power BI"],
  },
  {
    title: "MLOps & Cloud",
    description: "Reproducible training, cost-sane inference and on-call-friendly observability. Models that don't surprise you at 3am.",
    items: ["AWS", "GCP", "Docker", "Git"],
  },
  {
    title: "AI for Play & Interaction",
    description: "Unity, XR and conversational agents. Bringing models into real-time experiences where latency and personality both matter.",
    items: ["Unity", "C#", "Meta Lip Sync", "AR / VR"],
  },
];

export const skills: Record<string, string[]> = {
  "Generative AI & LLMs": [
    "LLMs", "Prompt Engineering", "LoRA / QLoRA / PEFT", "Hugging Face",
    "OpenAI", "Claude", "Gemini", "Ollama",
  ],
  "Agentic AI & RAG": [
    "LangGraph", "LangChain", "AutoGen", "CrewAI", "LlamaIndex", "MCP",
    "Tool Calling", "RAG", "FAISS / pgvector",
  ],
  "ML / Deep Learning": [
    "PyTorch", "TensorFlow", "Keras", "Scikit-learn", "XGBoost", "LightGBM",
    "Reinforcement Learning",
  ],
  "Computer Vision / NLP": [
    "OpenCV", "YOLO", "UNet", "SRGAN", "MediaPipe", "NER", "spaCy",
    "Sentiment Analysis",
  ],
  "LLM Evaluation & Safety": [
    "Ragas", "DeepEval", "Golden Datasets", "Langfuse", "OpenTelemetry",
    "Guardrails", "Pydantic",
  ],
  "Languages & Backend": [
    "Python", "SQL", "C#", "JavaScript", "TypeScript", "Kotlin", "FastAPI",
    "Flask", "React", "Vue.js",
  ],
  "Cloud & MLOps": [
    "Azure AI Foundry", "Azure OpenAI", "Azure AI Search", "AWS", "GCP",
    "Docker", "Kubernetes", "CI/CD",
  ],
  "Data & Visualisation": [
    "Databricks", "PySpark", "Delta Lake", "PostgreSQL", "Snowflake",
    "Pandas", "Power BI", "Plotly",
  ],
};

export type Project = {
  title: string;
  displayTitle: string;
  category: string;
  year: string;
  tags: string[];
  /** The tools it is built with, shown as capsules in the project list. */
  stack?: string[];
  href?: string;
  gradient: string;
  image?: string;
  description?: string;
};

export const projects: Project[] = [
  {
    title: "Innerbloom",
    displayTitle: "Innerbloom",
    category: "Generative AI",
    year: "2025",
    tags: ["LLM", "RAG", "Journal"],
    stack: ["Python", "Ollama", "FastAPI", "RAG", "Tool-calling agent", "PWA"],
    href: "https://ghanshyampaunikar.com/innerbloom",
    gradient:
      "radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 80%), linear-gradient(135deg, #1c1917 0%, #44403c 35%, #a16207 70%, #fbbf24 100%)",
    image: "/Journal.png",
    description: "A 100% local AI journal with zero telemetry, built on Ollama and FastAPI. A tool-calling agent plans, searches past entries with hybrid RAG and streams cited answers in three personas. 16-emotion tagging, a Wellbeing Radar for burnout and spiral patterns, a People social CRM and a Memory Graph. Built to run fully offline on your own computer with a local model; the live demo uses Gemini in a private sandbox so you can try it in the browser.",
  },
  {
    title: "AI NPC: Living Characters",
    displayTitle: "Living NPCs",
    category: "Generative AI",
    year: "2024",
    tags: ["GenAI", "Unity", "Voice"],
    stack: ["Unity", "C#", "GPT-3.5", "Meta Voice SDK", "Oculus LipSync"],
    href: "https://github.com/GhanshyamPaunikar/AI-NPC",
    gradient:
      "radial-gradient(ellipse at 50% 30%, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 75%), linear-gradient(135deg, rgba(45,0,54,0.5) 0%, rgba(107,33,168,0.4) 30%, rgba(236,72,153,0.3) 70%, rgba(245,158,11,0.3) 100%)",
    image: "/AI NPC.png",
    description: "MSc dissertation: NPCs you talk to by voice. Speech becomes text with Meta's Wit.ai, GPT-3.5 answers in character and keeps the conversation's context, and the reply is spoken back with lip-synced facial animation. The model can also trigger in-game actions, an early form of tool calling. Built in Unity with C#.",
  },
  {
    title: "Image Resolution Upscaler",
    displayTitle: "Super Resolution",
    category: "Deep Learning",
    year: "2023",
    tags: ["Stable Diffusion", "PyTorch", "Gradio"],
    stack: ["PyTorch", "Stable Diffusion x4", "diffusers", "Gradio"],
    href: "https://github.com/GhanshyamPaunikar/Image-Resolution-Upscaler",
    gradient:
      "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 80%), linear-gradient(135deg, #4c0519 0%, #a21caf 40%, #ec4899 80%, #f9a8d4 100%)",
    image: "/Upscaler.webp",
    description: "4x image upscaling via Stable Diffusion x4 Upscaler. Hallucinate sharp, prompt-guided high-frequency detail at four times the original resolution. Runs locally with a Gradio UI and a 1.7 GB cached model.",
  },
  {
    title: "F1 Race Predictor",
    displayTitle: "F1 Predictor",
    category: "Machine Learning",
    year: "2024",
    tags: ["XGBoost", "FastF1", "Vue.js"],
    stack: ["XGBoost", "LightGBM", "FastAPI", "Vue.js", "SHAP"],
    href: "https://github.com/GhanshyamPaunikar/f1-race-predictor",
    gradient:
      "radial-gradient(ellipse at 50% 30%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 80%), linear-gradient(135deg, #0f0f0f 0%, #7f1d1d 40%, #dc2626 75%, #f97316 100%)",
    image: "/F1 race car.jpeg",
    description: "Predicts F1 finishing order with an XGBoost, HistGBR, Gradient Boosting and LightGBM ranking ensemble trained on 8 seasons (2018 to 2025) and 22 leakage-safe features, including weather and practice pace. 2,000 Monte Carlo races give win probabilities, and SHAP explains each driver's prediction.",
  },
  {
    title: "ASL Sign Language Recogniser",
    displayTitle: "Sign Translator",
    category: "Computer Vision",
    year: "2026",
    tags: ["MediaPipe", "PyTorch", "OpenCV"],
    stack: ["PyTorch", "MediaPipe", "Bi-LSTM", "Transformer", "OpenCV"],
    href: "https://github.com/GhanshyamPaunikar/Translator-Sign-Language",
    gradient:
      "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.6) 80%), linear-gradient(135deg, rgba(12,74,110,0.5) 0%, rgba(3,105,161,0.4) 50%, rgba(6,182,212,0.3) 100%)",
    image: "/project5.png",
    description: "Sign recognition from MediaPipe hand and pose landmarks. A real-time webcam ASL alphabet reader built on landmark geometry, then a word-level BSL recogniser: an own dataset of 741 clips for 100 words, a PyTorch Bi-LSTM tested on signers it never saw, text-to-sign playback and a browser demo.",
  },
  {
    title: "Carbon Watcher",
    displayTitle: "Carbon Watcher",
    category: "Sustainability AI",
    year: "2026",
    tags: ["Python", "ML", "Data"],
    stack: ["Python", "Intel RAPL", "NVIDIA NVML", "pytest", "pip package"],
    href: "https://github.com/GhanshyamPaunikar/carbonwatcher",
    image: "/carbon.png",
    gradient:
      "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.5) 80%), linear-gradient(135deg, #052e16 0%, #166534 40%, #4ade80 80%, #bbf7d0 100%)",
    description: "Published pip package (pip install carbonwatcher) that tracks the energy, CO2 and cost of ML training runs and LLM API calls (Anthropic, OpenAI, Ollama, Hugging Face). Reads real hardware power counters, uses live location-aware grid intensity, and has a CLI with team reports and monthly dashboards.",
  },
  {
    title: "Zeul: Android Wallpaper App",
    displayTitle: "Zeul",
    category: "Android App",
    year: "2026",
    tags: ["Kotlin", "Jetpack Compose", "Supabase"],
    stack: ["Kotlin", "Jetpack Compose", "Supabase", "Material 3", "Claude Code agents"],
    href: "https://github.com/raunakpatil/ZeulWallpaperApp",
    gradient:
      "radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 80%), linear-gradient(135deg, #0c0a09 0%, #431407 45%, #ea580c 85%, #fdba74 100%)",
    image: "/zeul.jpg",
    description: "Free, open-source Android wallpaper app with HD and AMOLED feeds, community uploads and an auto wallpaper changer. Built by two developers in about two weeks, each with a Claude Code agent; Ghanshyam built the Android app: UI, data layer, preview, search, onboarding and background work.",
  },
  {
    title: "Piano Tutor",
    displayTitle: "Piano Tutor",
    category: "Desktop App",
    year: "2026",
    tags: ["JavaScript", "Electron", "MIDI"],
    stack: ["JavaScript", "Electron", "Web MIDI", "HTML / CSS", "Python tooling"],
    href: "https://ghanshyampaunikar.com/pianotutor",
    gradient:
      "radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 80%), linear-gradient(135deg, #0b1020 0%, #1e3a8a 45%, #3b82f6 75%, #34d399 100%)",
    image: "/piano-tutor.jpg",
    description: "Learn piano with falling notes and every key named. Practice mode waits for the right note, hands can be learned separately, tempo and loops are adjustable, and sheet music scrolls above. Works with any MIDI keyboard; Mac, Windows and web.",
  },
  {
    title: "SpaceX Falcon 9 Landing Prediction",
    displayTitle: "Falcon 9 Predictor",
    category: "Data Science",
    year: "2024",
    tags: ["Python", "Scikit-learn", "IBM"],
    stack: ["Python", "SQL", "Classification", "Folium", "Plotly Dash"],
    href: "https://github.com/GhanshyamPaunikar/IBM-Capstone",
    gradient:
      "radial-gradient(ellipse at 50% 30%, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.6) 80%), linear-gradient(135deg, #020617 0%, #0f172a 40%, #1e3a5f 75%, #2563eb 100%)",
    image: "/spacexrocketreturn.webp",
    description: "IBM Data Science Capstone. Predicts whether SpaceX Falcon 9's first stage will successfully land, enabling cost estimation for rocket launches. Built with classification models, EDA, SQL, Folium maps and a Plotly Dash dashboard.",
  },
];

export type Cert = { name: string; issuer?: string; year?: string; note?: string; href?: string };

/**
 * What each certificate covered, from each course's published syllabus, keyed
 * by its short name. Shown on Elio's screen when a certificate is looked at.
 */
export const certSkills: Record<string, string[]> = {
  "Claude Code 101": ["Claude Code", "Agentic coding", "AI-assisted development", "Prompting for code"],
  "Data Science Pro": ["Python", "SQL", "Pandas", "Data visualisation", "Machine learning", "Jupyter"],
  "Generative AI": ["Prompt engineering", "LLMs for data work", "Data augmentation", "GenAI tools"],
  "ML with Python": ["Regression", "Classification", "Clustering", "Scikit-learn", "Model evaluation"],
  "Responsible GenAI": ["AI ethics", "Bias and fairness", "AI governance", "Risk assessment"],
  "Elements of AI": ["AI fundamentals", "Search and problem solving", "Neural networks", "AI in society"],
  "AI DRDO": ["AI foundations", "Machine learning", "Applied AI"],
  "Supervised ML": ["Logistic regression", "Naïve Bayes", "Model evaluation"],
  "Unsupervised ML": ["K-Means", "Clustering", "Feature scaling"],
  "ML Foundations": ["NumPy", "Pandas", "Data preparation", "Scikit-learn basics"],
  "SQL Analysis": ["SQL queries", "Joins", "Aggregation", "Data analysis"],
  "Data Viz": ["Seaborn", "Matplotlib", "Chart design", "Exploratory analysis"],
  "ML & Deep Learning": ["Deep learning", "Neural networks", "TensorFlow / Keras", "Python for data science"],
  "Python for AI": ["Python", "AI programming", "Algorithms", "Data structures"],
  "AI & AR in Unity": ["Unity", "AR", "AI in games", "C#", "Xcode"],
};

export const certifications: Cert[] = [
  {
    name: "Claude Code 101",
    issuer: "Anthropic",
    note: "Claude Code 101",
    href: "https://verify.skilljar.com/c/mbpvtvkrqikz",
  },
  {
    name: "Data Science Professional Certificate",
    issuer: "IBM",
    note: "Data Science Pro",
    href: "https://www.coursera.org/account/accomplishments/professional-cert/0Y8DSVXT8GJN",
  },
  {
    name: "Generative AI: Elevate Your Data Science Career",
    issuer: "IBM",
    note: "Generative AI",
    href: "https://www.coursera.org/account/accomplishments/verify/INTRKWEDJ5VH",
  },
  {
    name: "Machine Learning with Python",
    issuer: "IBM",
    note: "ML with Python",
    href: "https://www.coursera.org/account/accomplishments/verify/QI5NMFM97ZZJ",
  },
  {
    name: "Responsible Generative AI Specialisation",
    issuer: "University of Michigan",
    note: "Responsible GenAI",
    href: "https://www.coursera.org/account/accomplishments/specialization/QHT0EF83A674",
  },
  {
    name: "Elements of AI",
    issuer: "University of Helsinki",
    note: "Elements of AI",
    href: "https://certificates.mooc.fi/validate/s769bl1msv",
  },
  {
    name: "Artificial Intelligence",
    issuer: "DRDO, Govt. of India",
    note: "AI DRDO",
  },
  {
    name: "Supervised ML: Logistic Regression & Naïve Bayes",
    issuer: "Great Learning",
    note: "Supervised ML",
    href: "https://www.mygreatlearning.com/certificate/CVAPCKRS",
  },
  {
    name: "Unsupervised Machine Learning: K-Means",
    issuer: "Great Learning",
    note: "Unsupervised ML",
    href: "https://www.mygreatlearning.com/certificate/ZDHJWXQJ",
  },
  {
    name: "Machine Learning with Python: Foundations",
    issuer: "LinkedIn Learning",
    note: "ML Foundations",
    href: "https://www.linkedin.com/learning/certificates/bf5a20058035852d19771fc4c899cab2ff1933967ad1c164e235f4b602eaf2a3",
  },
  {
    name: "SQL for Data Analysis",
    issuer: "LinkedIn Learning",
    note: "SQL Analysis",
    href: "https://www.linkedin.com/learning/certificates/88380d7e247af0f3bd2e7b5c3b72f0f92846044154df163145ea39d3c52b7093",
  },
  {
    name: "Data Visualization",
    issuer: "Kaggle",
    note: "Data Viz",
    href: "https://www.kaggle.com/learn/certification/ghanshyampaunikar/data-visualization",
  },
{
    name: "ML, Data Science & Deep Learning with Python",
    issuer: "Udemy",
    note: "ML & Deep Learning",
    href: "https://www.udemy.com/certificate/UC-e757298e-bc16-4d91-9029-53604423d3ba/",
  },
  {
    name: "Python Programming for Artificial Intelligence",
    issuer: "Udemy",
    note: "Python for AI",
    href: "https://www.udemy.com/certificate/UC-d40bae60-f65a-46e0-ab76-6686577de364/",
  },
  {
    name: "Artificial Intelligence & AR in Unity + Xcode",
    issuer: "Udemy",
    note: "AI & AR in Unity",
    href: "https://www.udemy.com/certificate/UC-f367b214-9e87-4b92-8936-1fe7bdc19c75/",
  },
];

export const volunteering = {
  org: "Spread Smile Foundation",
  role: "Volunteer · Community Outreach",
  focus: ["Education", "Healthcare", "Community Development"],
};

export const education = {
  university: "University of Liverpool",
  degree: "Master's degree, Data Science & AI",
  logo: "https://www.google.com/s2/favicons?sz=128&domain=liverpool.ac.uk",
};

/** His Medium articles, so Elio can hand over the one it mentions. */
export const articles = [
  {
    id: "innerbloom",
    title: "Innerbloom AI Journal — What I Built After Months of Journaling Into a Void",
    href: "https://medium.com/@ghanshyampaunikar/ai-journal-for-my-mental-health-8a687edb13db",
  },
  {
    id: "ai-gaming",
    title: "Modern AI Applications in Video Gaming",
    href: "https://medium.com/@ghanshyampaunikar/modern-ai-applications-in-video-gaming-f1038cb772ef",
  },
  {
    id: "brine-shrimp",
    title: "Counting Brine Shrimp in Videos: A Practical Guide with YOLOv5 and Active Learning",
    href: "https://medium.com/@ghanshyampaunikar/counting-brine-shrimp-in-videos-a-practical-guide-with-yolov5-and-active-learning-6383a1dd607b",
  },
  {
    id: "falcon-qlora",
    title: "Fine-tuning Falcon-7B with QLoRA on a Mental Health Conversational Dataset",
    href: "https://medium.com/@ghanshyampaunikar/fine-tuning-of-falcon-7b-large-language-model-using-qlora-on-mental-health-conversational-dataset-ef461b10126e",
  },
];

export const social = {
  linkedin: "https://www.linkedin.com/in/ghanshyampaunikar/",
  github: "https://github.com/GhanshyamPaunikar",
  instagram: "https://www.instagram.com/ghanshyampaunikar/",
  blog: "https://freetechtweets.blogspot.com/",
  medium: "https://medium.com/@ghanshyampaunikar",
  buymeacoffee: "https://buymeacoffee.com/ghanshyampaunikar",
  spotify: "https://open.spotify.com/user/w3jcygtlfghzxfmx0wz3x6383",
};

export const marqueeItems = [
  "Generative AI",
  "Computer Vision",
  "NLP",
  "MLOps",
  "Data Analytics",
  "Edge AI",
  "RAG Pipelines",
  "Voice Systems",
];
