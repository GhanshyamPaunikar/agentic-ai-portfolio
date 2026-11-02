"use client";

import { usePathname } from "next/navigation";

/**
 * The site footer and floating nav belong to the original design, which now
 * lives at /v2. Every other route carries its own chrome, so this allows
 * rather than denies — a new route gets nothing by default instead of
 * inheriting the old site's furniture by accident.
 *
 * Children are server components rendered on the server and passed through as
 * props — this wrapper only decides whether to mount them.
 */
export function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (!pathname?.startsWith("/v2")) return null;
  return <>{children}</>;
}
