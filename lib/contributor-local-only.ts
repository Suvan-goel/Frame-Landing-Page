const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const CONTRIBUTOR_FEATURE_ROUTE_ROOTS = [
  "/founding-contributors",
  "/contributors",
  "/admin/contributors",
  "/api/founding-contributors",
  "/api/contributors",
] as const;

const CONTRIBUTOR_ASSET_PATHS = new Set(["/og-founding-contributors.png"]);

function normalizeContributorPath(pathname: string) {
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
  return normalizedPath.replaceAll("\\", "/").replace(/\/{2,}/g, "/");
}

export function isContributorFeatureEnabled(value: string | null | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function isLoopbackHost(host: string | null) {
  const normalized = host?.trim().toLowerCase() ?? "";

  return [...LOCAL_HOSTS].some(
    (localHost) =>
      normalized === localHost || normalized.startsWith(`${localHost}:`),
  );
}

export function isContributorFeaturePath(pathname: string) {
  const normalizedPath = normalizeContributorPath(pathname);

  if (CONTRIBUTOR_ASSET_PATHS.has(normalizedPath)) return true;

  return CONTRIBUTOR_FEATURE_ROUTE_ROOTS.some(
    (root) =>
      normalizedPath === root || normalizedPath.startsWith(`${root}/`),
  );
}

export function isContributorLocalOnlyPath(pathname: string) {
  const normalizedPath = normalizeContributorPath(pathname);
  return (
    isContributorFeaturePath(normalizedPath) ||
    normalizedPath === "/api/stripe/webhook" ||
    normalizedPath.startsWith("/api/stripe/webhook/")
  );
}

export function isLocalContributorRequest(request: Request) {
  return isLoopbackHost(new URL(request.url).host);
}
