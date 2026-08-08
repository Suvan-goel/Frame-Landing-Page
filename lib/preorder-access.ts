import {
  isDraftPreorderVersion,
  PREORDER_SELLER_DETAILS_COMPLETE,
  PREORDER_TERMS_VERSION,
} from "./preorder";
import { isLoopbackHost } from "./contributor-local-only";

const PREORDER_PUBLIC_ROUTE_ROOTS = [
  "/preorder",
  "/preorders",
  "/api/preorders",
] as const;

const PREORDER_ADMIN_ROUTE_ROOTS = [
  "/admin/preorders",
  "/api/admin/preorders",
  "/api/admin/preorders.csv",
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
    PREORDER_SELLER_DETAILS_COMPLETE &&
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

function normalizePathname(pathname: string) {
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

  return normalizedPath;
}

function matchesRouteRoot(pathname: string, roots: readonly string[]) {
  const normalizedPath = normalizePathname(pathname);

  return roots.some(
    (root) => normalizedPath === root || normalizedPath.startsWith(`${root}/`),
  );
}

export function isPublicPreorderPath(pathname: string) {
  return matchesRouteRoot(pathname, PREORDER_PUBLIC_ROUTE_ROOTS);
}

export function isPreorderAdminPath(pathname: string) {
  return matchesRouteRoot(pathname, PREORDER_ADMIN_ROUTE_ROOTS);
}

export function isPreorderPath(pathname: string) {
  return isPublicPreorderPath(pathname) || isPreorderAdminPath(pathname);
}
