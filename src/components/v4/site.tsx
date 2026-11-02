"use client";

import { V3Site } from "@/components/v3/site";
import { GHANSHYAM_SLOT } from "@/components/v4/ghanshyam";

/** The client side of /v4: the same site, with the CRT-headed figure. */
export function V4Site() {
  return <V3Site character={GHANSHYAM_SLOT} />;
}
