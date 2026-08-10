const canonicalSiteOrigin = "https://framewearable.com";
const wwwSiteOrigin = "https://www.framewearable.com";

function isLoopbackHostname(hostname: string) {
  return hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]";
}

/**
 * Allows ordinary same-origin form posts plus the site's exact www-to-apex
 * redirect. Browsers can cache the old permanent redirect and serialize the
 * redirected POST origin as `null`, so that case additionally requires
 * unforgeable same-site navigation metadata supplied by the browser.
 */
export function hasAllowedFormRequestOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (!origin) return true;

  if (origin === "null") {
    const fetchSite = request.headers.get("sec-fetch-site");
    return (
      requestUrl.origin === canonicalSiteOrigin &&
      (fetchSite === "same-origin" || fetchSite === "same-site") &&
      request.headers.get("sec-fetch-mode") === "navigate" &&
      request.headers.get("sec-fetch-dest") === "document"
    );
  }

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  if (originUrl.origin === requestUrl.origin) return true;
  return (
    requestUrl.origin === canonicalSiteOrigin &&
    originUrl.origin === wwwSiteOrigin
  );
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
