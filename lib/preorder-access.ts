import {
  isDraftPreorderVersion,
  PREORDER_PRODUCT_STATUS_VERSION,
  PREORDER_SELLER_DETAILS_COMPLETE,
  PREORDER_TERMS_VERSION,
  PREORDER_WARRANTY_DETAILS_COMPLETE,
} from "./preorder";
import { isLoopbackHost } from "./contributor-local-only";
import { isPreorderPublicLaunchConfigured } from "./preorder-live-smoke-access";

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

const PREORDER_CUSTOMER_SERVICE_ROUTE_ROOTS = [
  "/preorder/manage",
  "/api/preorders/manage",
] as const;

export type PreorderMode = "off" | "test" | "live";

export function normalizePreorderMode(value: string | undefined): PreorderMode {
  return value === "test" || value === "live" ? value : "off";
}

export function isPreorderLiveApproved(input: {
  mode?: string;
  approvedTermsVersion?: string;
  approvedProductStatusVersion?: string;
}) {
  return (
    normalizePreorderMode(input.mode) === "live" &&
    PREORDER_SELLER_DETAILS_COMPLETE &&
    PREORDER_WARRANTY_DETAILS_COMPLETE &&
    !isDraftPreorderVersion(PREORDER_TERMS_VERSION) &&
    input.approvedTermsVersion === PREORDER_TERMS_VERSION &&
    !isDraftPreorderVersion(PREORDER_PRODUCT_STATUS_VERSION) &&
    input.approvedProductStatusVersion === PREORDER_PRODUCT_STATUS_VERSION
  );
}

export function isPreorderRequestAllowed(input: {
  host: string | null;
  mode?: string;
  approvedTermsVersion?: string;
  approvedProductStatusVersion?: string;
  publicLaunchEnabled?: string;
  verifiedLiveSmokeOrderId?: string;
}) {
  if (isLoopbackHost(input.host)) return true;
  return (
    isPreorderLiveApproved(input) &&
    isPreorderPublicLaunchConfigured({
      enabled: input.publicLaunchEnabled,
      verifiedOrderId: input.verifiedLiveSmokeOrderId,
    })
  );
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

export function isPreorderCustomerServicePath(pathname: string) {
  return matchesRouteRoot(pathname, PREORDER_CUSTOMER_SERVICE_ROUTE_ROOTS);
}

export function isPreorderPath(pathname: string) {
  return isPublicPreorderPath(pathname) || isPreorderAdminPath(pathname);
}
