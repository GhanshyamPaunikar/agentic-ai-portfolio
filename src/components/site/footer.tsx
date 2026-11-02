"use client";

import Image from "next/image";
import { Rss } from "lucide-react";
import { social, profile } from "@/data/portfolio";
import {
  GitHubIcon,
  InstagramIcon,
  LinkedInIcon,
} from "@/components/site/social-icons";

const MediumIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zm7.42 0c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/>
  </svg>
);

const navLinks = [
  { href: "#top",      label: "Home" },
  { href: "#work",     label: "Projects" },
  { href: "#services", label: "Services" },
  { href: "#about",    label: "About" },
  { href: "#contact",  label: "Contact" },
];

const socialItems = [
  { href: social.linkedin,  label: "LinkedIn",  Icon: LinkedInIcon },
  { href: social.github,    label: "GitHub",    Icon: GitHubIcon },
  { href: social.instagram, label: "Instagram", Icon: InstagramIcon },
  { href: social.medium,    label: "Medium",    Icon: MediumIcon },
  { href: social.blog,      label: "Blog",      Icon: Rss },
];

export function Footer() {
  return (
    <footer className="bg-[var(--background)] px-5 pb-5">
      <div className="relative mx-auto w-full max-w-[1920px] overflow-hidden rounded-[40px] bg-[#161616] px-6 pt-12 pb-10 sm:rounded-[80px] sm:px-12 sm:pt-16 sm:pb-12 lg:rounded-[120px] lg:px-20 lg:pt-20 lg:pb-14">
        {/* Background video */}
        <video
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_170732_8a9ccda6-5cff-4628-b164-059c500a2b41.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover opacity-70 pointer-events-none"
        />
        <div className="relative z-10 mx-auto max-w-[1500px]">

          {/* Top grid — 4 equal columns */}
          <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">

            {/* Col 1 — contact */}
            <div className="flex flex-col gap-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
                Contact me
              </p>
              <a
                href={`mailto:${profile.email}`}
                className="break-all text-sm font-medium text-white transition-colors hover:text-amber-400 sm:text-base"
              >
                {profile.email}
              </a>
              <Image
                src="/gp-logo.png"
                alt="GP Logo"
                width={168}
                height={168}
                className="mt-2 h-24 w-24 opacity-80 sm:h-32 sm:w-32 lg:h-[168px] lg:w-[168px]"
              />
            </div>

            {/* Col 2 — nav */}
            <div className="flex flex-col gap-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
                Navigate
              </p>
              <ul className="space-y-3">
                {navLinks.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="inline-flex items-baseline gap-2 font-display text-xl uppercase text-white transition-colors hover:text-amber-400 sm:text-2xl"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 3 — social */}
            <div className="flex flex-col gap-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
                Social
              </p>
              <ul className="space-y-3">
                {socialItems.map(({ href, label, Icon }) => (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-3 text-sm text-white/60 transition-colors hover:text-white"
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 4 — support / status */}
            <div className="flex flex-col gap-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
                Support
              </p>
              <a
                href={social.buymeacoffee}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-all hover:bg-zinc-100"
              >
                ☕ Buy me a coffee
              </a>
            </div>

          </div>

          {/* Copyright */}
          <div className="mt-8 text-center">
            <p className="text-xs text-zinc-600">
              © {new Date().getFullYear()} {profile.name}. All rights reserved.
            </p>
          </div>

        </div>
      </div>
    </footer>
  );
}
