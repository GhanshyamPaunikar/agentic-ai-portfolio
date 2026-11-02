"use client";

import { useEffect, useState } from "react";

/**
 * Where the downloaded character model lives, kept in its own module so the
 * page can ask whether it exists without importing the Three.js bundle.
 */
export const MODEL_URL = "/models/avatar.glb";

/**
 * Lighting for the scene.
 *
 * The 4K EXR this came from is 80MB — more than twenty times the rest of the
 * site — and an environment map is never looked at directly, only reflected.
 * This is the same Ferndale studio probe at 1K in Radiance HDR: 1.5MB, and
 * indistinguishable in the reflections at the size anything is drawn here.
 * Poly Haven publishes it CC0, so it carries no attribution requirement.
 */
export const ENV_URL = "/models/ferndale_studio_12_1k.hdr";

/**
 * Attribution for the model.
 *
 * CC BY requires the credit to be given in a manner reasonable to the medium,
 * which a credits page satisfies as well as an overlay does — so it is carried
 * in public/models/README.md and the project README rather than on the page
 * itself. Kept here because it is a term of the licence that permits the file
 * to be used at all, and so it travels with the file if the credit page is
 * ever rewritten.
 */
export const MODEL_CREDIT: {
  title: string;
  author: string;
  licence: string;
  source: string;
  licenceUrl: string;
} | null = {
  title: "TV Head",
  author: "sBjamms",
  licence: "CC BY 4.0",
  source: "https://sketchfab.com/3d-models/tv-head-0ae68369ffb445f284625884b96b47eb",
  licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
};

/** HEAD request, so a missing model falls back instead of suspending forever. */
export function useModelPresent(url: string | null = MODEL_URL) {
  // No URL to check: the caller already knows its model ships with the site.
  const [present, setPresent] = useState<boolean | null>(url === null ? true : null);
  useEffect(() => {
    if (url === null) return;
    let alive = true;
    fetch(url, { method: "HEAD" })
      .then((r) => alive && setPresent(r.ok))
      .catch(() => alive && setPresent(false));
    return () => {
      alive = false;
    };
  }, [url]);
  return present;
}
