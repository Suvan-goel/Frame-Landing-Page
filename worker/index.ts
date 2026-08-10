/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  isContributorFeatureEnabled,
  isContributorFeaturePath,
  isContributorLocalOnlyPath,
  isLoopbackHost,
} from "../lib/contributor-local-only";
import {
  isPreorderAdminPath,
  isPreorderLiveApproved,
  isPublicPreorderPath,
  isPreorderRequestAllowed,
} from "../lib/preorder-access";
import {
  clearPreorderStagingCookieHeader,
  createPreorderStagingCookieValue,
  verifyPreorderStagingAccessToken,
  isPreorderStagingConfigured,
  isPreorderStagingCookieAllowed,
  PREORDER_STAGING_ACCESS_PATH,
  PREORDER_STAGING_EXIT_PATH,
  preorderStagingCookieHeader,
} from "../lib/preorder-staging-access";
import {
  clearPreorderLiveSmokeCookieHeader,
  createPreorderLiveSmokeCookieValue,
  isPreorderLiveSmokeConfigured,
  isPreorderLiveSmokeCookieAllowed,
  PREORDER_LIVE_SMOKE_ACCESS_PATH,
  PREORDER_LIVE_SMOKE_EXIT_PATH,
  preorderLiveSmokeCookieHeader,
  verifyPreorderLiveSmokeAccessToken,
} from "../lib/preorder-live-smoke-access";
import { preorderReviewRedirectPath } from "../lib/attribution";
import {
  TRACKING_POLICY_ENDPOINT,
  trackingPolicyForRequest,
} from "../lib/tracking-policy";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
  PREORDER_MODE?: string;
  PREORDER_LEGAL_APPROVED_VERSION?: string;
  PREORDER_PRODUCT_STATUS_APPROVED_VERSION?: string;
  PREORDER_STAGING_ACCESS_SECRET?: string;
  PREORDER_LIVE_SMOKE_ACCESS_SECRET?: string;
  PREORDER_PUBLIC_LAUNCH_ENABLED?: string;
  PREORDER_LIVE_SMOKE_VERIFIED_ORDER_ID?: string;
  PREORDER_MAINTENANCE_SECRET?: string;
  CONTRIBUTOR_FEATURE_ENABLED?: string;
  SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}

const STATIC_CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "autoplay=()",
  "camera=()",
  "display-capture=()",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "publickey-credentials-create=()",
  "publickey-credentials-get=()",
  "serial=()",
  "usb=()",
  "xr-spatial-tracking=()",
].join(", ");

function configuredConnectionOrigins(env: Env) {
  const origins = new Set<string>();
  for (const value of [env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_URL]) {
    if (!value) continue;
    try {
      const configuredUrl = new URL(value);
      if (configuredUrl.protocol !== "https:") continue;
      origins.add(configuredUrl.origin);
      origins.add(configuredUrl.origin.replace(/^https:/, "wss:"));
    } catch {
      // An invalid integration URL must not broaden the browser allowlist.
    }
  }
  return [...origins];
}

function contentSecurityPolicy(url: URL, env: Env) {
  const isLocalRequest = isLoopbackHost(url.host);
  const scriptSources = [
    "'self'",
    "'unsafe-inline'",
    ...(isLocalRequest ? ["'unsafe-eval'"] : []),
    "https://connect.facebook.net",
  ];
  const connectSources = [
    "'self'",
    ...(isLocalRequest ? ["ws:"] : []),
    ...configuredConnectionOrigins(env),
    "https://connect.facebook.net",
    "https://www.facebook.com",
  ];
  const directives = [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://www.facebook.com",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    "media-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
  ];
  if (url.protocol === "https:" && !isLocalRequest) {
    directives.push("upgrade-insecure-requests");
  }
  return directives.join("; ");
}

function withPublicResponseHeaders(response: Response, url: URL, env: Env) {
  const headers = new Headers(response.headers);
  const extension = Object.keys(STATIC_CONTENT_TYPES).find((candidate) =>
    url.pathname.toLowerCase().endsWith(candidate),
  );

  if (
    response.ok &&
    extension &&
    (!headers.has("content-type") ||
      headers.get("content-type") === "application/octet-stream")
  ) {
    headers.set("Content-Type", STATIC_CONTENT_TYPES[extension]);
  }

  if (response.ok && url.pathname.startsWith("/assets/")) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if (response.ok && extension) {
    headers.set(
      "Cache-Control",
      "public, max-age=2592000, stale-while-revalidate=86400",
    );
  }

  const sensitiveDocument =
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/contributors") ||
    url.pathname === "/preorder/manage" ||
    url.pathname === "/preorder/success" ||
    url.pathname === PREORDER_STAGING_ACCESS_PATH ||
    url.pathname === PREORDER_STAGING_EXIT_PATH ||
    url.pathname === PREORDER_LIVE_SMOKE_ACCESS_PATH ||
    url.pathname === PREORDER_LIVE_SMOKE_EXIT_PATH;
  headers.set(
    "Referrer-Policy",
    sensitiveDocument ? "no-referrer" : "strict-origin-when-cross-origin",
  );
  headers.set("Permissions-Policy", PERMISSIONS_POLICY);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-XSS-Protection", "0");

  const isLocalRequest = isLoopbackHost(url.host);
  if (url.protocol === "https:" && !isLocalRequest) {
    headers.set("Strict-Transport-Security", "max-age=31536000");
  }

  if (headers.get("content-type")?.startsWith("text/html")) {
    headers.set("Content-Security-Policy", contentSecurityPolicy(url, env));
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const respond = (response: Response) =>
      withPublicResponseHeaders(response, url, env);

    const isWwwRequest = url.hostname.toLowerCase() === "www.framewearable.com";
    if (
      isWwwRequest &&
      (request.method === "GET" || request.method === "HEAD")
    ) {
      return respond(Response.redirect(
        `https://framewearable.com${url.pathname}${url.search}`,
        308,
      ));
    }

    const isLocalRequest = isLoopbackHost(url.host);
    const stagingConfigured = isPreorderStagingConfigured({
      mode: env.PREORDER_MODE,
      secret: env.PREORDER_STAGING_ACCESS_SECRET,
    });
    const liveApproved = isPreorderLiveApproved({
      mode: env.PREORDER_MODE,
      approvedTermsVersion: env.PREORDER_LEGAL_APPROVED_VERSION,
      approvedProductStatusVersion: env.PREORDER_PRODUCT_STATUS_APPROVED_VERSION,
    });
    const liveSmokeConfigured =
      liveApproved &&
      isPreorderLiveSmokeConfigured({
        mode: env.PREORDER_MODE,
        publicLaunchEnabled: env.PREORDER_PUBLIC_LAUNCH_ENABLED,
        verifiedOrderId: env.PREORDER_LIVE_SMOKE_VERIFIED_ORDER_ID,
        secret: env.PREORDER_LIVE_SMOKE_ACCESS_SECRET,
      });

    if (!isLocalRequest && url.pathname === PREORDER_STAGING_ACCESS_PATH) {
      const token = url.searchParams.get("token") ?? "";
      const allowed =
        stagingConfigured &&
        (await verifyPreorderStagingAccessToken(
          token,
          env.PREORDER_STAGING_ACCESS_SECRET as string,
        ));
      if (!allowed) {
        return respond(new Response("Not found", {
          status: 404,
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "text/plain; charset=utf-8",
            "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff",
            "X-Robots-Tag": "noindex, nofollow",
          },
        }));
      }
      const cookie = await createPreorderStagingCookieValue(
        env.PREORDER_STAGING_ACCESS_SECRET as string,
      );
      return respond(new Response(null, {
        status: 303,
        headers: {
          "Cache-Control": "no-store",
          Location: "/preorder/review?source=private_staging",
          "Referrer-Policy": "no-referrer",
          "Set-Cookie": preorderStagingCookieHeader(cookie),
          "X-Content-Type-Options": "nosniff",
          "X-Robots-Tag": "noindex, nofollow",
        },
      }));
    }

    if (
      !isLocalRequest &&
      stagingConfigured &&
      url.pathname === PREORDER_STAGING_EXIT_PATH
    ) {
      return respond(new Response(null, {
        status: 303,
        headers: {
          "Cache-Control": "no-store",
          Location: "/",
          "Set-Cookie": clearPreorderStagingCookieHeader(),
          "X-Content-Type-Options": "nosniff",
        },
      }));
    }

    if (!isLocalRequest && url.pathname === PREORDER_LIVE_SMOKE_ACCESS_PATH) {
      const token = url.searchParams.get("token") ?? "";
      const allowed =
        liveSmokeConfigured &&
        (await verifyPreorderLiveSmokeAccessToken(
          token,
          env.PREORDER_LIVE_SMOKE_ACCESS_SECRET as string,
        ));
      if (!allowed) {
        return respond(new Response("Not found", {
          status: 404,
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "text/plain; charset=utf-8",
            "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff",
            "X-Robots-Tag": "noindex, nofollow",
          },
        }));
      }
      const cookie = await createPreorderLiveSmokeCookieValue(
        env.PREORDER_LIVE_SMOKE_ACCESS_SECRET as string,
      );
      return respond(new Response(null, {
        status: 303,
        headers: {
          "Cache-Control": "no-store",
          Location: "/preorder/review?source=private_live_smoke",
          "Referrer-Policy": "no-referrer",
          "Set-Cookie": preorderLiveSmokeCookieHeader(cookie),
          "X-Content-Type-Options": "nosniff",
          "X-Robots-Tag": "noindex, nofollow",
        },
      }));
    }

    if (
      !isLocalRequest &&
      liveSmokeConfigured &&
      url.pathname === PREORDER_LIVE_SMOKE_EXIT_PATH
    ) {
      return respond(new Response(null, {
        status: 303,
        headers: {
          "Cache-Control": "no-store",
          Location: "/",
          "Referrer-Policy": "no-referrer",
          "Set-Cookie": clearPreorderLiveSmokeCookieHeader(),
          "X-Content-Type-Options": "nosniff",
        },
      }));
    }

    const stagingRequestAllowed =
      !isLocalRequest &&
      (await isPreorderStagingCookieAllowed({
        mode: env.PREORDER_MODE,
        secret: env.PREORDER_STAGING_ACCESS_SECRET,
        cookieHeader: request.headers.get("cookie"),
      }));
    const liveSmokeRequestAllowed =
      !isLocalRequest &&
      liveApproved &&
      (await isPreorderLiveSmokeCookieAllowed({
        mode: env.PREORDER_MODE,
        publicLaunchEnabled: env.PREORDER_PUBLIC_LAUNCH_ENABLED,
        verifiedOrderId: env.PREORDER_LIVE_SMOKE_VERIFIED_ORDER_ID,
        secret: env.PREORDER_LIVE_SMOKE_ACCESS_SECRET,
        cookieHeader: request.headers.get("cookie"),
      }));
    const optimizedImageSource =
      url.pathname === "/_vinext/image" ? url.searchParams.get("url") : null;
    const contributorFeatureEnabled = isContributorFeatureEnabled(
      env.CONTRIBUTOR_FEATURE_ENABLED,
    );
    const isContributorFeatureRequest =
      isContributorFeaturePath(url.pathname) ||
      (optimizedImageSource
        ? isContributorFeaturePath(
            new URL(optimizedImageSource, url).pathname,
          )
        : false);
    const isContributorRequest =
      isContributorLocalOnlyPath(url.pathname) ||
      (optimizedImageSource
        ? isContributorLocalOnlyPath(
            new URL(optimizedImageSource, url).pathname,
          )
        : false);
    const isPreorderAdminRequest = isPreorderAdminPath(url.pathname);
    const isPublicPreorderRequest = isPublicPreorderPath(url.pathname);
    const isSharedStripeWebhook = url.pathname === "/api/stripe/webhook";
    const preorderRequestAllowed =
      isPreorderRequestAllowed({
        host: url.host,
        mode: env.PREORDER_MODE,
        approvedTermsVersion: env.PREORDER_LEGAL_APPROVED_VERSION,
        approvedProductStatusVersion: env.PREORDER_PRODUCT_STATUS_APPROVED_VERSION,
        publicLaunchEnabled: env.PREORDER_PUBLIC_LAUNCH_ENABLED,
        verifiedLiveSmokeOrderId: env.PREORDER_LIVE_SMOKE_VERIFIED_ORDER_ID,
      }) || stagingRequestAllowed || liveSmokeRequestAllowed;

    if (
      (isContributorFeatureRequest && !contributorFeatureEnabled) ||
      (isContributorRequest && !isLocalRequest) ||
      (isPublicPreorderRequest && !preorderRequestAllowed) ||
      (isSharedStripeWebhook && request.method !== "POST")
    ) {
      return respond(new Response("Not found", {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
          "X-Robots-Tag": "noindex, nofollow",
        },
      }));
    }

    if (url.pathname === TRACKING_POLICY_ENDPOINT) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return respond(new Response("Method not allowed", {
          status: 405,
          headers: {
            Allow: "GET, HEAD",
            "Cache-Control": "private, no-store",
            "Content-Type": "text/plain; charset=utf-8",
            "X-Content-Type-Options": "nosniff",
          },
        }));
      }

      const body = JSON.stringify({ mode: trackingPolicyForRequest(request) });
      return respond(new Response(request.method === "HEAD" ? null : body, {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Type": "application/json; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
        },
      }));
    }

    if (
      url.pathname === "/preorder" &&
      (request.method === "GET" || request.method === "HEAD")
    ) {
      return respond(new Response(null, {
        status: 307,
        headers: {
          "Cache-Control": "no-store",
          Location: preorderReviewRedirectPath(url.searchParams),
          "X-Content-Type-Options": "nosniff",
          "X-Robots-Tag": "noindex, nofollow",
        },
      }));
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return respond(await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths));
    }

    const appHeaders = new Headers(request.headers);
    let appUrl = url;
    if (isWwwRequest) {
      appUrl = new URL(
        `https://framewearable.com${url.pathname}${url.search}`,
      );
      if (appHeaders.get("origin") === url.origin) {
        appHeaders.set("origin", appUrl.origin);
      }
    }
    appHeaders.set(
      "x-frame-contributor-local-request",
      isLocalRequest && contributorFeatureEnabled ? "1" : "0",
    );
    appHeaders.set(
      "x-frame-preorder-sales-request",
      preorderRequestAllowed ? "1" : "0",
    );
    appHeaders.set(
      "x-frame-preorder-admin-request",
      isPreorderAdminRequest ? "1" : "0",
    );
    appHeaders.set(
      "x-frame-preorder-staging-request",
      stagingRequestAllowed ? "1" : "0",
    );
    appHeaders.set(
      "x-frame-preorder-live-smoke-request",
      liveSmokeRequestAllowed ? "1" : "0",
    );

    let appRequest = new Request(request, { headers: appHeaders });
    if (appUrl !== url) {
      appRequest = new Request(appUrl, appRequest);
      const requestCf = (request as Request & { cf?: unknown }).cf;
      if (requestCf !== undefined) {
        Object.defineProperty(appRequest, "cf", { value: requestCf });
      }
    }

    const response = await handler.fetch(appRequest, env, ctx);

    return respond(response);
  },
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    if (!env.PREORDER_MAINTENANCE_SECRET) {
      console.error("PREORDER_MAINTENANCE_SECRET is not configured; delivery deadlines were not processed.");
      return;
    }
    const request = new Request(
      "https://framewearable.com/api/internal/preorders/delivery-delay-expirations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.PREORDER_MAINTENANCE_SECRET}`,
        },
      },
    );
    ctx.waitUntil(
      handler.fetch(request, env, ctx).then(async (response) => {
        if (!response.ok) {
          console.error(
            `Pre-order delivery deadline task failed with status ${response.status}.`,
          );
        }
      }),
    );
  },
};

export default worker;
