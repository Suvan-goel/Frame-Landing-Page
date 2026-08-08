function isLoopbackHostname(hostname: string) {
  return hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]";
}

/**
 * Returns the browser origin only when it represents the request's public
 * origin. Loopback requests may arrive through a local preview proxy whose
 * visible port differs from the app server's internal port.
 */
export function verifiedRequestOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (!origin) return requestUrl.origin;

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return null;
  }

  if (originUrl.origin === requestUrl.origin) return originUrl.origin;
  if (
    !isLoopbackHostname(requestUrl.hostname) ||
    !isLoopbackHostname(originUrl.hostname) ||
    originUrl.protocol !== requestUrl.protocol
  ) {
    return null;
  }

  return originUrl.origin;
}
