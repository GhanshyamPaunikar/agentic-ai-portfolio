"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";

import { projects, profile } from "@/data/portfolio";
import { ITEMS, type Item, type SectionName } from "@/components/v3/dossier";
import type { Panel } from "@/components/v3/face";

/** The tabs on the bar: four shelves of the file, and the résumé. */
export type ShelfName = SectionName | "Resume";

export const SHELF_TABS: { shelf: ShelfName; label: string }[] = [
  { shelf: "The work", label: "Projects" },
  { shelf: "Certifications", label: "Certificates" },
  { shelf: "Toolkit", label: "Skills" },
  { shelf: "Background", label: "Background" },
  { shelf: "Resume", label: "Résumé" },
];

/** Each issuer's logo: a file of its own where there is a good one, else its site icon. */
const LOCAL_LOGO: Record<string, string> = {
  IBM: "/v3/logos/ibm.jpg",
  "University of Helsinki": "/v3/logos/helsinki.jpg",
  "DRDO, Govt. of India": "/v3/logos/drdo.png",
  Kaggle: "/v3/logos/kaggle.png",
};
const ISSUER_SITE: Record<string, string> = {
  Anthropic: "anthropic.com",
  "University of Michigan": "umich.edu",
  "Great Learning": "mygreatlearning.com",
  "LinkedIn Learning": "linkedin.com",
  Udemy: "udemy.com",
};
const logo = (meta: string) => {
  const issuer = meta.split(" · ")[0];
  if (LOCAL_LOGO[issuer]) return LOCAL_LOGO[issuer];
  return (
    ISSUER_SITE[issuer] &&
    `https://www.google.com/s2/favicons?domain=${ISSUER_SITE[issuer]}&sz=128`
  );
};

const RESUME_PDF = "/Ghanshyam-Paunikar-Resume.pdf";
const RESUME_IMG = "/v3/resume.jpg";

const INK = "text-[#1d2026]";

/** The round black button the sketches use for "open this". */
function OpenDot({
  href,
  label,
  download,
}: {
  href?: string;
  label: string;
  download?: boolean;
}) {
  if (!href) {
    return (
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#eceef2] text-[14px] text-black shadow-[0_2px_6px_rgba(20,24,30,0.12)] hover:bg-[#e3e6eb]"
      >
        ↗
      </span>
    );
  }
  return (
    <a
      href={href}
      target={download ? undefined : "_blank"}
      rel="noreferrer"
      download={download}
      aria-label={label}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#eceef2] text-[14px] text-black shadow-[0_2px_6px_rgba(20,24,30,0.12)] hover:bg-[#e3e6eb] transition-transform duration-200 hover:scale-[1.08]"
    >
      {download ? "↓" : "↗"}
    </a>
  );
}

/**
 * One shelf, on a sky-blue panel over the left 40% of the window that fades
 * into the painting at its edge. Pointing at anything puts it on Elio's screen.
 */
export function Shelf({
  shelf,
  start,
  onClose,
  onShow,
  reduced,
}: {
  shelf: ShelfName;
  /** An item id to bring into view, when someone arrived on a link to one. */
  start?: string | null;
  onClose: () => void;
  onShow: (panel: Panel | null) => void;
  reduced: boolean;
}) {
  const items = useMemo(
    () => (shelf === "Resume" ? [] : ITEMS.filter((i) => i.section === shelf)),
    [shelf],
  );

  // The screen keeps Elio's face until something is pointed at, and goes back
  // to it when the pointer moves away. Arriving on a link to one item shows
  // that item straight away.
  useEffect(() => {
    const linked = start ? items.find((i) => i.id === start) : undefined;
    onShow(linked ? linked.panel : null);
  }, [items, start, onShow]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  useEffect(() => {
    if (!start) return;
    const id = requestAnimationFrame(() =>
      document
        .getElementById(`v3s-${start}`)
        ?.scrollIntoView({ block: "center" }),
    );
    return () => cancelAnimationFrame(id);
  }, [start]);

  const look = (i: Item) => () => onShow(i.panel);
  const away = () => onShow(null);
  const rise = (n: number) =>
    reduced
      ? undefined
      : {
          animation: `v3rise 380ms ${Math.min(n, 10) * 45}ms both cubic-bezier(.16,1,.3,1)`,
        };

  // The projects need a wide column; the other shelves are as wide as what
  // is on them, so the fade starts just after the last word, not mid-page.
  const wide = shelf === "The work";

  return (
    <div
      data-no-pix
      className={`absolute inset-y-0 left-0 z-10 max-lg:w-full max-lg:min-w-0 max-lg:bg-[rgb(250,250,249)] ${
        wide
          ? "w-[43%] min-w-[420px] lg:bg-[linear-gradient(90deg,rgb(250,250,249)_0%,rgba(250,250,249,0.97)_78%,rgba(250,250,249,0)_100%)]"
          : "w-fit max-w-[70%] xl:max-w-[60%] lg:bg-[linear-gradient(90deg,rgb(250,250,249)_0%,rgba(250,250,249,0.97)_calc(100%_-_260px),rgba(250,250,249,0.9)_calc(100%_-_210px),rgba(250,250,249,0.72)_calc(100%_-_160px),rgba(250,250,249,0.45)_calc(100%_-_110px),rgba(250,250,249,0.2)_calc(100%_-_60px),rgba(250,250,249,0.06)_calc(100%_-_25px),rgba(250,250,249,0)_100%)]"
      } ${INK}`}
      style={{
        animation: reduced ? undefined : "v3fade 260ms ease-out both",
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close and go back"
        className={`absolute right-6 top-[68px] z-10 inline-flex max-sm:right-4 max-sm:top-[62px] items-center gap-1.5 rounded-full bg-[#eceef2] px-3.5 py-1.5 text-[14px] text-black shadow-[0_2px_6px_rgba(20,24,30,0.12)] transition-colors hover:bg-[#e3e6eb] sm:right-8 ${wide ? "lg:right-[20%]" : "lg:right-[230px]"}`}
      >
        <span aria-hidden>✕</span> Close
      </button>
      <div
        className={`h-full overflow-y-auto px-6 pb-12 pt-[116px] max-sm:px-4 max-sm:pb-10 max-sm:pt-[108px] [&>*]:min-h-full [scrollbar-width:none] sm:px-8 ${
          wide ? "lg:pr-[20%]" : "lg:pr-[230px]"
        }`}
      >
        {shelf === "The work" && (
          <Projects items={items} look={look} away={away} rise={rise} />
        )}

        {shelf === "Certifications" && (
          <ul className="flex min-h-full w-fit max-w-full flex-col justify-center gap-4 py-4 max-sm:w-full max-sm:gap-3.5">
            {[...items]
              .sort(
                (x, y) =>
                  Number(x.meta.startsWith("DRDO")) -
                  Number(y.meta.startsWith("DRDO")),
              )
              .map((c, n) => (
                <li
                  key={c.id}
                  id={`v3s-${c.id}`}
                  onMouseEnter={look(c)}
                  onMouseLeave={away}
                  className="flex items-center gap-4"
                  style={rise(n)}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-white shadow-[0_2px_6px_rgba(20,24,30,0.12)] ring-1 ring-black/[0.07] font-mono text-[12px] text-black/60">
                    {logo(c.meta) ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a small remote logo
                      <img
                        src={logo(c.meta)}
                        alt=""
                        className="h-full w-full rounded-full bg-white object-contain p-1.5"
                      />
                    ) : (
                      (c.meta.split(" ")[0] ?? "").slice(0, 3)
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 items-baseline gap-2.5 pr-6 max-sm:flex-col max-sm:gap-0.5 max-sm:pr-2">
                    <span className="shrink-0 text-[19px] leading-tight tracking-[-0.01em] max-sm:shrink max-sm:text-[16.5px]">
                      {c.title}
                    </span>
                    <span className="truncate font-mono text-[14px] text-[#1d2026]/80 max-sm:whitespace-normal max-sm:text-[12.5px] max-sm:leading-snug">
                      {c.meta}
                    </span>
                  </span>
                  <OpenDot
                    href={c.href}
                    label={`Open the ${c.title} credential`}
                  />
                </li>
              ))}
          </ul>
        )}

        {shelf === "Toolkit" && (
          <div className="flex min-h-full max-w-[460px] flex-col justify-center gap-4">
            {items.map((g, n) => (
              <section
                key={g.id}
                id={`v3s-${g.id}`}
                onMouseEnter={look(g)}
                onMouseLeave={away}
                className="py-1"
                style={rise(n)}
              >
                <h3 className="text-[19px] font-semibold tracking-[-0.01em] max-sm:text-[17px]">
                  {g.title}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2 max-sm:mt-2.5 max-sm:gap-1.5">
                  {(g.chips ?? []).map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-[#e9ebf0] px-4 py-1.5 text-[14px] tracking-[-0.01em] text-black/75 shadow-[0_2px_6px_rgba(20,24,30,0.18)] max-sm:px-3 max-sm:py-1 max-sm:text-[13px]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {shelf === "Background" && (
          <Background items={items} look={look} show={(p: Panel) => () => onShow(p)} away={away} rise={rise} />
        )}

        {shelf === "Resume" && (
          <div style={rise(0)}>
            <div className="mb-3 flex justify-end">
              <a
                href={RESUME_PDF}
                download
                className="inline-flex items-center gap-2 rounded-full bg-[#eceef2] px-4 py-2 text-[14px] text-black shadow-[0_2px_6px_rgba(20,24,30,0.12)] transition-colors hover:bg-[#e3e6eb]"
              >
                <span aria-hidden>↓</span> Download
              </a>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- a tall static page at its own size */}
            <img
              src={RESUME_IMG}
              alt={`${profile.name}, résumé`}
              className="w-full rounded-[14px] shadow-[0_14px_40px_-20px_rgba(20,24,30,0.55)]"
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** Projects: a narrow column of filters, and a card per project. */
function Projects({
  items,
  look,
  away,
  rise,
}: {
  items: Item[];
  look: (i: Item) => () => void;
  away: () => void;
  rise: (n: number) => React.CSSProperties | undefined;
}) {
  const meta = useMemo(
    () => new Map(projects.map((p) => [p.displayTitle, p])),
    [],
  );

  // A numbered index: a picture, what it is, what it does, what it is built
  // with. Elio's screen still shows the big picture of whichever is pointed
  // at, but the list has to make sense on its own, on a phone, at a glance.
  return (
    <div className="flex min-h-full flex-col justify-center">
      <ol className="space-y-7 max-sm:space-y-6">
        {items.map((i, n) => {
          const p = meta.get(i.title);
          return (
            <li
              key={i.id}
              id={`v3s-${i.id}`}
              onMouseEnter={look(i)}
              onMouseLeave={away}
              className="flex items-start gap-5 max-sm:gap-3"
              style={rise(n)}
            >
              {p?.image ? (
                <span className="relative mt-1 aspect-[4/3] w-[104px] shrink-0 overflow-hidden rounded-xl bg-[#e9ebf0] shadow-[0_2px_8px_rgba(20,24,30,0.16)] max-sm:w-[76px] max-sm:rounded-lg">
                  <Image src={p.image} alt="" fill sizes="(max-width: 640px) 76px, 104px" className="object-cover" />
                </span>
              ) : (
                <span className="w-7 shrink-0 pt-1.5 font-mono text-[14px] max-sm:w-5 max-sm:pt-1 max-sm:text-[12px] text-[#1d2026]/60">
                  {String(n + 1).padStart(2, "0")}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2.5">
                  <span className="text-[22px] max-sm:text-[18px] leading-tight tracking-[-0.015em]">
                    {i.title}
                  </span>
                  {p && (
                    <span className="font-mono text-[13px] text-[#1d2026]/70">
                      {p.category}
                    </span>
                  )}
                </span>
                {i.body && (
                  <span className="mt-1.5 block text-[15px] leading-[1.55] max-sm:text-[14px] text-[#1d2026]/85">
                    {i.body}
                  </span>
                )}
                <span className="mt-2.5 flex flex-wrap gap-1.5">
                  {(p?.stack ?? i.chips ?? []).map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-[#e9ebf0] px-3 py-1 text-[12.5px] leading-none text-black/75 shadow-[0_2px_6px_rgba(20,24,30,0.18)]"
                    >
                      {t}
                    </span>
                  ))}
                </span>
              </span>
              <OpenDot href={i.href} label={`Open ${i.title}`} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The story behind each Background entry, for every layout of the shelf. */
const LIFE: Record<
  string,
  {
    group: string;
    role: string;
    org: string;
    when: string;
    years: string;
    place: string;
    short: string;
    points: string[];
    chips: string[];
    mark: string;
  }
> = {
  experience: {
    group: "Experience",
    role: "LLM Engineer",
    org: "Sigma AI",
    when: "Apr 2024 – Sep 2026",
    years: "2024–26",
    place: "London",
    short:
      "Fine-tuned LLMs for 300+ reviewers; QA pipelines, eval harnesses and guardrails.",
    points: [
      "Fine-tuned LLMs with LoRA/PEFT on transcription and annotation data for 300+ reviewers",
      "LLM-powered QA pipelines and golden-dataset eval harnesses run before every release",
      "Guardrails and Pydantic validation, traced with Langfuse and OpenTelemetry",
      "Evaluation pipelines in Python, analysis 30% faster; error rates down 12%",
    ],
    chips: ["LLMs", "LangGraph", "Evaluation", "Guardrails"],
    mark: "/v3/logos/sigma.jpg",
  },
  vec: {
    group: "Experience",
    role: "Data Scientist Intern",
    org: "Virtual Engineering Centre",
    when: "Oct 2023 – Mar 2024",
    years: "2023–24",
    place: "Liverpool, UK",
    short: "Generative AI in a live business workflow, manual processing down 60%.",
    points: [
      "OpenAI-powered case-study processing in Python, manual work down about 60%",
      "Results reported to stakeholders through Power BI dashboards",
      "Python automation in NVIDIA Omniverse, 3D layout effort down 40%",
    ],
    chips: ["Generative AI", "Python", "Power BI"],
    mark: "https://www.google.com/s2/favicons?domain=liverpool.ac.uk&sz=128",
  },
  zummit: {
    group: "Experience",
    role: "Data Scientist",
    org: "Zummit Infolabs",
    when: "Feb 2021 – Oct 2021",
    years: "2021",
    place: "Bangalore",
    short:
      "PyTorch UNet for MRI segmentation, cancer detection accuracy up 15%.",
    points: [
      "UNet in PyTorch for MRI segmentation, +15% cancer detection accuracy",
      "Preprocessing and deployment pipelines, training time down 20%",
      "Weekly findings for non-technical medical stakeholders",
    ],
    chips: ["PyTorch", "Computer vision", "Medical imaging"],
    mark: "/v3/logos/zummit.jpg",
  },
  education: {
    group: "Education",
    role: "MSc Data Science & AI",
    org: "University of Liverpool",
    when: "Sep 2022 – Sep 2023",
    years: "2022–23",
    place: "Liverpool, UK",
    short: "Dissertation: Living NPCs, AI characters with voice and emotion.",
    points: [
      "Dissertation: Living NPCs, AI game characters with voice, lip-sync and emotion",
      "45% engagement lift",
    ],
    chips: ["Data Science", "AI", "Unity"],
    mark: "https://www.google.com/s2/favicons?domain=liverpool.ac.uk&sz=128",
  },
  be: {
    group: "Education",
    role: "B.E. Mechanical Engineering",
    org: "Raisoni College, RTMNU",
    when: "",
    years: "",
    place: "Nagpur, India",
    short: "Engineering degree before the move into data science and AI.",
    points: ["B.E. in Mechanical Engineering, Rashtrasant Tukadoji Maharaj Nagpur University"],
    chips: ["Engineering"],
    mark: "/v3/logos/raisoni.png",
  },
  volunteering: {
    group: "Volunteering",
    role: "Volunteer, Community Outreach",
    org: "Spread Smile Foundation",
    when: "",
    years: "",
    place: "India",
    short: "Education, healthcare and community development.",
    points: ["Education, healthcare and community development"],
    chips: ["Education", "Healthcare", "Community"],
    mark: "/v3/logos/spread-smile.jpg",
  },
};

/** Writing on Medium, newest first. */
const ARTICLES = [
  {
    title: "Modern AI Applications in Video Gaming",
    url: "https://medium.com/@ghanshyampaunikar/modern-ai-applications-in-video-gaming-f1038cb772ef",
    image: "/v3/articles/a1.png",
    info: "How AI shapes game characters, worlds and players today.",
  },
  {
    title: "Innerbloom AI Journal: What I Built After Months of Journaling Into a Void",
    url: "https://medium.com/@ghanshyampaunikar/ai-journal-for-my-mental-health-8a687edb13db",
    image: "/v3/articles/a2.png",
    info: "An AI journal built for my own mental health, and what it taught me.",
  },
  {
    title: "Counting Brine Shrimp in Videos with YOLOv5 and Active Learning",
    url: "https://medium.com/@ghanshyampaunikar/counting-brine-shrimp-in-videos-a-practical-guide-with-yolov5-and-active-learning-6383a1dd607b",
    image: "/v3/articles/a3.png",
    info: "A practical guide to counting shrimp in video with YOLOv5 and active learning.",
  },
  {
    title: "Fine-tuning Falcon-7B with QLoRA on a Mental Health Conversational Dataset",
    url: "https://medium.com/@ghanshyampaunikar/fine-tuning-of-falcon-7b-large-language-model-using-qlora-on-mental-health-conversational-dataset-ef461b10126e",
    image: "/v3/articles/a4.png",
    info: "Fine-tuning Falcon-7B with QLoRA to hold supportive mental health conversations.",
  },
];

function Mark({ mark }: { mark: string }) {
  const shadow = "shadow-[0_2px_6px_rgba(20,24,30,0.12)] ring-1 ring-black/[0.07]";
  return (
    <span
      className={`grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-white ${shadow}`}
    >
      {mark.length > 2 ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small logo
        <img
          src={mark}
          alt=""
          className={`h-full w-full ${mark.includes("sigma") ? "object-cover" : "object-contain p-1"}`}
        />
      ) : (
        <span className="text-[15px] font-semibold text-[#1d2026]">{mark}</span>
      )}
    </span>
  );
}

function Background({
  items,
  look,
  show,
  away,
  rise,
}: {
  items: Item[];
  look: (i: Item) => () => void;
  show: (p: Panel) => () => void;
  away: () => void;
  rise: (n: number) => React.CSSProperties | undefined;
}) {
  // Newest first.
  const order = ["experience", "vec", "education", "zummit", "be", "volunteering"];
  const rows = items
    .filter((i) => LIFE[i.id])
    .sort((x, y) => order.indexOf(x.id) - order.indexOf(y.id))
    .map((i) => ({ item: i, life: LIFE[i.id] }));
  const sub = "font-mono text-[14px] text-[#1d2026]/80";

  // Rows with logos, like the certificates, then the writing.
  return (
    <div className="flex min-h-full max-w-[480px] flex-col justify-center gap-10 max-sm:gap-8">
    <ul className="flex flex-col gap-6 max-sm:gap-5">
      {rows.map(({ item, life }, n) => (
        <li
          key={item.id}
          id={`v3s-${item.id}`}
          onMouseEnter={look(item)}
          onMouseLeave={away}
          className="flex items-start gap-4"
          style={rise(n)}
        >
          <Mark mark={life.mark} />
          <div className="min-w-0">
            <p className="flex flex-wrap items-baseline gap-x-2.5">
              <span className="text-[19px] tracking-[-0.01em] max-sm:text-[17px] max-sm:leading-snug">
                {life.role}, {life.org}
              </span>
              <span className={sub}>
                {[life.place, life.years].filter(Boolean).join(" · ")}
              </span>
            </p>
            <p className="mt-1 max-w-[56ch] text-[15px] leading-[1.55] max-sm:text-[14px] text-[#1d2026]/85">
              {life.short}
            </p>
          </div>
        </li>
      ))}
    </ul>
    <section aria-labelledby="v3s-articles" style={rise(rows.length)}>
      <h3 id="v3s-articles" className="mb-4 font-mono text-[12px] uppercase tracking-[0.18em] text-[#1d2026]/60">
        Articles
      </h3>
      <ul className="flex flex-col gap-4">
        {ARTICLES.map((a) => (
          <li
            key={a.url}
            className="flex items-start gap-4"
            onMouseEnter={show({ kicker: "Article · Medium", title: a.title, image: a.image, tap: "Read", onTap: () => window.open(a.url, "_blank", "noopener") })}
            onMouseLeave={away}
          >
            <Mark mark="https://www.google.com/s2/favicons?domain=medium.com&sz=128" />
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="group min-w-0 pt-0.5">
              <span className="text-[17px] leading-snug tracking-[-0.01em] group-hover:underline max-sm:text-[15px]">
                {a.title}
              </span>
              <span className="mt-1 block text-[15px] leading-[1.55] text-[#1d2026]/85 max-sm:text-[14px]">{a.info}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
    </div>
  );
}
