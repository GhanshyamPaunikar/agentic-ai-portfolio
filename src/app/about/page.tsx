import type { Metadata } from "next";
import Link from "next/link";
import { Instrument_Sans } from "next/font/google";

import { FACTS, IDENTITY } from "@/data/assistant-knowledge";
import { skills, social } from "@/data/portfolio";

/**
 * Ghanshyam on one plain page: everything the main site says through Elio,
 * the tabs and the 3D scene, as text a search engine (or anyone without
 * JavaScript) can read. Built from the same facts Elio answers from, so the
 * two never disagree.
 */

const text = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500"], display: "swap" });

export const metadata: Metadata = {
  title: "About · AI Engineer in Pune",
  description:
    "Ghanshyam Paunikar, AI Engineer in Pune: experience at Sigma AI, the University of Liverpool's Virtual Engineering Centre and Zummit Infolabs, projects, skills, education and certifications.",
  alternates: { canonical: "/about" },
};

const fact = (id: string) => FACTS.find((f) => f.id === id);

/** A fact's body as a first line and its bullet points. */
function split(body: string) {
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  return {
    lead: lines.filter((l) => !l.startsWith("- ") && !l.startsWith("Technologies:")).join(" "),
    points: lines.filter((l) => l.startsWith("- ")).map((l) => l.slice(2)),
    tech: lines.find((l) => l.startsWith("Technologies:"))?.replace(/^Technologies:\s*/, "").replace(/\.$/, ""),
  };
}

const EXPERIENCE = ["exp.sigma", "exp.vec", "exp.zummit"];
const EDUCATION = ["edu.msc", "edu.be"];
const PROJECTS = FACTS.filter((f) => f.id.startsWith("proj."));

export default function About() {
  const summary = fact("profile.summary")?.body ?? "";
  const certs = fact("certs.main")?.body.replace(/^Certifications:\s*/, "") ?? "";
  const writing = fact("pubs.articles")?.body ?? "";
  const hobbies = fact("other.hobbies")?.body ?? "";

  return (
    <main className={`${text.className} min-h-screen bg-[#f3f4f6] px-5 py-12 text-[#16181c] sm:px-10`}>
      <article className="mx-auto max-w-[760px]">
        <Link href="/" className="text-[14px] text-black/50 transition-colors hover:text-black">
          ← Back to the site
        </Link>
        <h1 className="mt-6 text-[clamp(32px,5vw,48px)] font-medium leading-[1.05] tracking-[-0.025em]">
          {IDENTITY.name}
        </h1>
        <p className="mt-2 text-[18px] text-black/60">AI/ML Engineer · Pune, India · open to roles</p>
        <p className="mt-6 text-[17px] leading-[1.6] text-black/75">{summary}</p>
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
          <a className="underline" href={`mailto:${IDENTITY.email}`}>{IDENTITY.email}</a>
          <a className="underline" href={social.linkedin}>LinkedIn</a>
          <a className="underline" href={social.github}>GitHub</a>
          <a className="underline" href={social.medium}>Medium</a>
          <a className="underline" href={IDENTITY.resume}>Résumé (PDF)</a>
        </p>

        <h2 className="mt-12 text-[24px] font-medium">Experience</h2>
        {EXPERIENCE.map((id) => {
          const f = fact(id);
          if (!f) return null;
          const { lead, points, tech } = split(f.body);
          return (
            <section key={id} className="mt-6">
              <h3 className="text-[18px] font-medium">{f.label}</h3>
              <p className="mt-1 text-[15px] text-black/60">{lead}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-[1.55] text-black/75">
                {points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              {tech && <p className="mt-2 text-[14px] text-black/50">Technologies: {tech}</p>}
            </section>
          );
        })}

        <h2 className="mt-12 text-[24px] font-medium">Projects</h2>
        {PROJECTS.map((f) => (
          <section key={f.id} className="mt-5">
            <h3 className="text-[17px] font-medium">{f.label}</h3>
            <p className="mt-1 text-[15px] leading-[1.55] text-black/75">{f.body}</p>
          </section>
        ))}

        <h2 className="mt-12 text-[24px] font-medium">Skills</h2>
        <dl className="mt-4 space-y-3 text-[15px]">
          {Object.entries(skills).map(([group, items]) => (
            <div key={group}>
              <dt className="font-medium">{group}</dt>
              <dd className="text-black/70">{items.join(", ")}</dd>
            </div>
          ))}
        </dl>

        <h2 className="mt-12 text-[24px] font-medium">Education</h2>
        {EDUCATION.map((id) => {
          const f = fact(id);
          return f ? (
            <section key={id} className="mt-4">
              <h3 className="text-[17px] font-medium">{f.label}</h3>
              <p className="mt-1 text-[15px] leading-[1.55] text-black/75">{f.body}</p>
            </section>
          ) : null;
        })}

        <h2 className="mt-12 text-[24px] font-medium">Certifications</h2>
        <p className="mt-3 text-[15px] leading-[1.6] text-black/75">{certs}</p>

        <h2 className="mt-12 text-[24px] font-medium">Writing</h2>
        <p className="mt-3 text-[15px] leading-[1.6] text-black/75">{writing}</p>

        <h2 className="mt-12 text-[24px] font-medium">Outside work</h2>
        <p className="mt-3 text-[15px] leading-[1.6] text-black/75">{hobbies}</p>

        <p className="mt-12 text-[15px] text-black/60">
          Or <Link className="underline" href="/">ask Elio</Link>, the robot on the home page, anything about his work.
        </p>
      </article>
    </main>
  );
}
