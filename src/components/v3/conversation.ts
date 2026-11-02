/**
 * The conversation, as a state tree.
 *
 * Every line the assistant says is written here rather than generated, so the
 * site has no model behind it and cannot wander off or invent a claim about
 * Ghanshyam. Facts come from the same data the other two designs use.
 *
 * It asks for a name before it says anything else. Partly because that is
 * what a person does when they answer a door, and partly because knowing it
 * means the rest of the conversation can stop sounding like a brochure — and
 * the contact form at the end has one fewer question to ask.
 *
 * `{name}` in any line is replaced with what the visitor gave, or dropped
 * along with the rest of its sentence if they did not give one.
 */

/**
 * A quick reply. `ask` sends a question to Elio's model, as if typed; `next`
 * moves to another scripted turn (only the job fit and the message form are
 * scripted now, since a script cannot answer what someone actually asks).
 */
export type Choice = { label: string; next?: string; ask?: string };

export type Field = "name" | "email" | "message";

export type Node = {
  id: string;
  /** Typed one after another, each on its own line. */
  lines: string[];
  /**
   * Other ways of saying the same opening, one picked per visit, so Elio
   * doesn't greet everyone like a parrot. Each entry replaces lines.
   */
  variants?: string[][];
  /** The last line carries the cursor and reads as the question. */
  prompt?: string;
  /** Other wordings of the prompt, picked alongside the variant. */
  prompts?: string[];
  choices?: Choice[];
  /** Asks for one thing at a time, keeping the back-and-forth. */
  input?: { field: Field; placeholder: string; next: string };
  /** Shown under the choices, as plain text rather than a pill. */
  aside?: string;
  /** Where the aside's link goes. The inbox unless it says otherwise. */
  asideTo?: "email" | "file";
  /**
   * What the assistant puts on its own screen while saying this: the title of
   * a dossier item, "stats", or "greeting". The turns that name a particular
   * piece of work show it, so the screen illustrates the answer rather than
   * watching it being given.
   */
  shows?: string;
  /** The expression to wear while saying it. */
  mood?: "neutral" | "happy" | "thinking" | "surprised" | "wink" | "sleepy";
  end?: boolean;
};

export const ASSISTANT = "Elio";

export const NODES: Record<string, Node> = {
  root: {
    id: "root",
    lines: [
      `Hi, I'm ${ASSISTANT}, Ghanshyam's robot assistant. Ask me anything about his work, skills or experience, or paste a job description for an honest fit check.`,
    ],
    variants: [
      [`Hey there. I'm ${ASSISTANT}, the robot who knows Ghanshyam's work inside out. Ask me anything, or paste a job description and I'll tell you honestly how he fits.`],
      [`Oh, a visitor! I'm ${ASSISTANT}. I run this place for Ghanshyam: his projects, his skills, his whole story. Paste a job description and I'll give you a straight fit check.`],
      [`Hello! ${ASSISTANT} here, Ghanshyam's robot sidekick. I can walk you through what he's built, or read a job description and tell you where he fits and where he doesn't.`],
      [`Welcome in. I'm ${ASSISTANT}, part TV, part tour guide. Ask me about Ghanshyam's AI work, or drop in a job description for an honest match.`],
      [`Hi, I'm ${ASSISTANT}. Think of me as Ghanshyam's portfolio, but one that talks back. Ask away, or paste a role and I'll check the fit.`],
    ],
    prompt: "What should I call you?",
    prompts: ["What should I call you?", "What's your name?", "Who do I have the pleasure of talking to?", "And you are?"],
    mood: "neutral",
    input: { field: "name", placeholder: "Your name", next: "intro" },
    aside: "Or walk straight past me:",
  },

  intro: {
    id: "intro",
    lines: [
      "Good to meet you{comma_name}.",
      "Ghanshyam is an AI engineer in Pune: three years of production work, nine projects shipped. Ask me anything, about him or not.",
    ],
    variants: [
      ["Nice to meet you{comma_name}.", "Quick version: Ghanshyam builds LLM apps, RAG and agents, and he's obsessed with evaluating them properly. Three years in production, based in Pune."],
      ["Great to have you here{comma_name}.", "Ghanshyam is an AI engineer in Pune. He's shipped LLM products to 300+ daily users and nine projects of his own. Where shall we dig in?"],
      ["Hey{comma_name}, good to meet you.", "I'll keep it short: AI engineer, Pune, three years of production LLM work, and a habit of building things like me in his spare time."],
      ["Lovely to meet you{comma_name}.", "Ghanshyam turns LLMs into products people actually use, and checks they behave before they ship. Ask me anything, about him or not."],
    ],
    prompt: "Where would you like to start?",
    prompts: ["Where would you like to start?", "What would you like to know first?", "Where shall we begin?", "What brings you here?"],
    shows: "greeting",
    mood: "happy",
    choices: [
      { label: "What has he built?", ask: "What has he built? Give me the highlights." },
      { label: "What is he best at?", ask: "What is he strongest at, with evidence?" },
      { label: "Check a job fit", next: "jd" },
      { label: "Is he open to work?", ask: "Is he open to work, and what is he looking for?" },
    ],
    aside: "Or see everything in one list:",
    asideTo: "file",
  },

  /** A returning visitor skips the name question; {last} is filled in by the page. */
  welcome: {
    id: "welcome",
    lines: ["Welcome back{comma_name}. {last}"],
    variants: [
      ["Look who's back{comma_name}! {last}"],
      ["Oh, hello again{comma_name}. {last}"],
      ["You came back{comma_name}! My screen lit up. {last}"],
      ["Welcome back{comma_name}, I kept your seat warm. {last}"],
    ],
    prompt: "What shall we look at?",
    prompts: ["What shall we look at?", "Where were we?", "What's on your mind today?"],
    shows: "greeting",
    mood: "happy",
    choices: [
      { label: "What has he built?", ask: "What has he built? Give me the highlights." },
      { label: "What is he best at?", ask: "What is he strongest at, with evidence?" },
      { label: "Check a job fit", next: "jd" },
      { label: "Is he open to work?", ask: "Is he open to work, and what is he looking for?" },
    ],
    aside: "Or see everything in one list:",
    asideTo: "file",
  },

  jd: {
    id: "jd",
    mood: "thinking",
    lines: [
      "Paste a job description and I'll tell you honestly how he fits: what matches, with evidence, and what doesn't. No sales pitch, I promise. Mostly.",
    ],
    prompt: "Go on, paste it below.",
  },

  work: {
    id: "work",
    lines: [
      "Seven shipped projects. Not notebooks that run once on a laptop. Things with users, uptime and a URL.",
    ],
    prompt: "Which kind interests you?",
    mood: "neutral",
    choices: [
      { label: "Language models", next: "work_llm" },
      { label: "Computer vision", next: "work_cv" },
      { label: "The measurable ones", next: "numbers" },
      { label: "Something else", next: "intro" },
    ],
    aside: "All seven are in the index:",
    asideTo: "file",
  },

  work_llm: {
    id: "work_llm",
    shows: "Innerbloom",
    mood: "neutral",
    lines: [
      "Innerbloom is a journal that runs entirely on your own machine: Ollama, FastAPI, zero telemetry. Three personas, streaming chat, sentiment across sixteen emotions.",
      "Living NPCs gives game characters a memory and a voice. Unity, ChatGPT API, Meta Lip Sync. They remember what you told them an hour ago, which is more than most people manage.",
    ],
    prompt: "Where next?",
    choices: [
      { label: "Computer vision", next: "work_cv" },
      { label: "Is he available?", next: "hiring" },
      { label: "Send him a message", next: "form_email" },
    ],
  },

  work_cv: {
    id: "work_cv",
    shows: "Sign Translator",
    mood: "neutral",
    lines: [
      "Sign Translator reads the ASL alphabet live from a webcam. MediaPipe tracks twenty-one hand landmarks a frame and a PyTorch classifier turns the geometry between them into twenty-six letters.",
      "Super Resolution puts four times the detail into an image that never had it, prompt-guided, running locally. The Falcon 9 model predicts whether a first stage comes back in one piece, which is really a cost question wearing a physics costume.",
    ],
    prompt: "Where next?",
    choices: [
      { label: "Language models", next: "work_llm" },
      { label: "The measurable ones", next: "numbers" },
      { label: "Send him a message", next: "form_email" },
    ],
  },

  numbers: {
    id: "numbers",
    shows: "stats",
    mood: "surprised",
    lines: [
      "Three years in production. Seven shipped projects across AI, vision, machine learning and language. Ninety-five per cent and better on the deployed vision systems, and a forty-five per cent lift in engagement from the generative characters.",
      "He would want me to say those are measured, not estimated.",
    ],
    prompt: "Anything else?",
    choices: [
      { label: "Show me the work", next: "work" },
      { label: "Is he available?", next: "hiring" },
      { label: "Ask me something", next: "ask" },
    ],
  },

  stack: {
    id: "stack",
    shows: "ML / Deep Learning",
    mood: "neutral",
    lines: [
      "Python and SQL underneath, PyTorch and TensorFlow on top, Hugging Face and BERT for anything that reads, YOLO and OpenCV for anything that looks.",
      "AWS and GCP to run it, Docker and Git so it runs the same tomorrow, Tableau and Power BI when somebody senior needs to see it without reading code.",
    ],
    prompt: "Shall I go on?",
    choices: [
      { label: "The whole toolkit", next: "ask" },
      { label: "Show me the work", next: "work" },
      { label: "Is he available?", next: "hiring" },
    ],
    aside: "Every tool, grouped, is in the index:",
    asideTo: "file",
  },

  hiring: {
    id: "hiring",
    shows: "Open to roles · 2026",
    mood: "happy",
    lines: [
      "Open to roles for 2026. Based in Pune, working Indian Standard Time, and entirely comfortable with remote, hybrid or on-site.",
      "AI engineer, data scientist, data analyst. The title matters less to him than whether the work reaches people.",
    ],
    prompt: "Shall I take a message?",
    choices: [
      { label: "Yes, let's talk", next: "form_email" },
      { label: "Show me the work first", next: "work" },
      { label: "Ask me something", next: "ask" },
    ],
  },

  ask: {
    id: "ask",
    mood: "neutral",
    lines: ["Sure. Ask me anything: his projects, his skills, his experience, or whether he fits your role."],
    choices: [
      { label: "Does he know PyTorch?", ask: "Does he know PyTorch?" },
      { label: "Where has he worked?", ask: "Where has he worked, and what did he do there?" },
      { label: "His best project?", ask: "Which project would you show a hiring manager first, and why?" },
    ],
  },

  form_email: {
    id: "form_email",
    mood: "neutral",
    lines: ["Right{comma_name}. Two questions and I will stop asking."],
    prompt: "Where does a reply go?",
    input: { field: "email", placeholder: "you@company.com", next: "form_message" },
  },

  form_message: {
    id: "form_message",
    mood: "neutral",
    lines: ["Noted."],
    prompt: "And what should I tell him?",
    input: { field: "message", placeholder: "The role, the project, the question…", next: "sent" },
  },

  sent: {
    id: "sent",
    mood: "happy",
    end: true,
    lines: [
      "Done. It's on his desk now, with your address to reply to.",
      "Thank you{comma_name}. He reads every one of these himself.",
    ],
  },
};

export const ROOT = "root";

/**
 * Puts the visitor's name into a line, or takes the gap out cleanly.
 *
 * `{name}` is the bare name and `{comma_name}` is ", Priya" — written that way
 * so a line reads properly for someone who skipped the question, instead of
 * leaving a comma stranded in front of a full stop.
 */
export function fill(line: string, name?: string) {
  return line
    .replace(/\{comma_name\}/g, name ? `, ${name}` : "")
    .replace(/\{name\}/g, name ?? "")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}
