import {
  isDraftPreorderVersion,
  PREORDER_TERMS_VERSION,
} from "./preorder";
import { isLoopbackHost } from "./contributor-local-only";

const PREORDER_ROUTE_ROOTS = [
  "/preorder",
  "/preorders",
  "/admin/preorders",
  "/api/preorders",
] as const;

export type PreorderMode = "off" | "test" | "live";

export function normalizePreorderMode(value: string | undefined): PreorderMode {
  return value === "test" || value === "live" ? value : "off";
}

export function isPreorderLiveApproved(input: {
  mode?: string;
  approvedTermsVersion?: string;
}) {
  return (
    normalizePreorderMode(input.mode) === "live" &&
    !isDraftPreorderVersion(PREORDER_TERMS_VERSION) &&
    input.approvedTermsVersion === PREORDER_TERMS_VERSION
  );
}

export function isPreorderRequestAllowed(input: {
  host: string | null;
  mode?: string;
  approvedTermsVersion?: string;
}) {
  if (isLoopbackHost(input.host)) return true;
  return isPreorderLiveApproved(input);
}

export function isPreorderPath(pathname: string) {
  let normalizedPath = pathname;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const decodedPath = decodeURIComponent(normalizedPath);
      if (decodedPath === normalizedPath) break;
      normalizedPath = decodedPath;
    } catch {
      break;
    }
  }
  normalizedPath = normalizedPath.replaceAll("\\", "/").replace(/\/{2,}/g, "/");

  return PREORDER_ROUTE_ROOTS.some(
    (root) => normalizedPath === root || normalizedPath.startsWith(`${root}/`),
  );
}
