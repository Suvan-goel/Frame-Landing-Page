const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const CONTRIBUTOR_ROUTE_ROOTS = [
  "/founding-contributors",
  "/contributors",
  "/admin/contributors",
  "/api/founding-contributors",
  "/api/contributors",
  "/api/stripe/webhook",
] as const;

const CONTRIBUTOR_ASSET_PATHS = new Set(["/og-founding-contributors.png"]);

export function isLoopbackHost(host: string | null) {
  const normalized = host?.trim().toLowerCase() ?? "";

  return [...LOCAL_HOSTS].some(
    (localHost) =>
      normalized === localHost || normalized.startsWith(`${localHost}:`),
  );
}

export function isContributorLocalOnlyPath(pathname: string) {
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

  if (CONTRIBUTOR_ASSET_PATHS.has(normalizedPath)) return true;

  return CONTRIBUTOR_ROUTE_ROOTS.some(
    (root) =>
      normalizedPath === root || normalizedPath.startsWith(`${root}/`),
  );
}

export function isLocalContributorRequest(request: Request) {
  return isLoopbackHost(new URL(request.url).host);
}
