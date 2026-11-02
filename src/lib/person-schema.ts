import { IDENTITY } from "@/data/assistant-knowledge";
import { social } from "@/data/portfolio";

/**
 * Who this site is about, in schema.org terms, for search engines. This is
 * what lets Google connect a search for his name to this site and to his
 * LinkedIn, GitHub and writing as the same person.
 */
export const PERSON_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: IDENTITY.name,
  url: IDENTITY.site,
  image: `${IDENTITY.site}/ghanshyam.png`,
  jobTitle: "AI/ML Engineer",
  description:
    "AI Engineer in Pune with over three years building LLM applications end to end: RAG, LangGraph agents and LLM evaluation frameworks at Sigma AI, Python APIs and React front ends, and earlier a model that lifted cancer detection accuracy by 15%.",
  email: `mailto:${IDENTITY.email}`,
  address: { "@type": "PostalAddress", addressLocality: "Pune", addressRegion: "Maharashtra", addressCountry: "IN" },
  alumniOf: [
    { "@type": "CollegeOrUniversity", name: "University of Liverpool" },
    { "@type": "CollegeOrUniversity", name: "Raisoni College, RTMNU" },
  ],
  knowsAbout: [
    "Machine Learning",
    "Generative AI",
    "Large Language Models",
    "LLM fine-tuning",
    "Agentic AI",
    "LangGraph",
    "Retrieval-augmented generation",
    "Computer Vision",
    "Natural Language Processing",
    "PyTorch",
    "Python",
    "MLOps",
  ],
  sameAs: [social.linkedin, social.github, social.medium, social.blog, social.instagram],
};
