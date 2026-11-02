import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { social } from "@/data/portfolio";

const links = [
  { href: "#top", label: "Home", external: false },
  { href: "#work", label: "Projects", external: false },
  { href: "#services", label: "Services", external: false },
  { href: "#about", label: "About", external: false },
  { href: social.blog, label: "Journal", external: true },
];

export function FloatingNav() {
  return (
    <div className="no-print fixed inset-x-0 bottom-4 z-50 flex justify-center px-3 sm:bottom-6 sm:px-4">
      <nav
        className="relative flex items-center gap-3 overflow-hidden p-2 shadow-[0_25px_60px_-25px_rgba(0,0,0,0.55)] sm:gap-5 sm:p-3"
        style={{
          backdropFilter: "blur(64px)",
          WebkitBackdropFilter: "blur(64px)",
          backgroundColor: "rgba(0, 0, 0, 0.24)",
          borderRadius: "34px",
          opacity: 1,
        }}
      >
        <Link
          href="#top"
          aria-label="Home"
          className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-[16px] shadow-[0_6px_14px_-4px_rgba(0,0,0,0.45)] sm:h-14 sm:w-14 sm:rounded-[22px]"
          style={{
            background:
              "linear-gradient(140deg, #fcd9b6 0%, #f5a572 45%, #d97842 100%)",
          }}
        >
          <Image
            src="/ghanshyam.png"
            alt="Ghanshyam Paunikar"
            width={56}
            height={56}
            className="h-full w-full object-cover"
            priority
          />
        </Link>

        <ul className="hidden items-center gap-5 px-5 sm:flex md:gap-7 md:px-7">
          {links.map((l) => (
            <li key={l.label}>
              <a
                href={l.href}
                target={l.external ? "_blank" : undefined}
                rel={l.external ? "noreferrer" : undefined}
                className="font-display text-[15px] uppercase tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)] transition-opacity hover:opacity-75"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <a
          href="#contact"
          className="inline-flex items-center gap-2 rounded-[16px] bg-white px-4 py-2.5 font-display text-[13px] uppercase tracking-wide text-black shadow-[0_4px_12px_-4px_rgba(0,0,0,0.4)] transition-colors hover:bg-zinc-100 ring-2 ring-amber-400 sm:gap-4 sm:rounded-[22px] sm:px-7 sm:py-3.5 sm:text-[15px]"
        >
          Contact <Plus className="h-4 w-4" strokeWidth={2} />
        </a>
      </nav>
    </div>
  );
}
