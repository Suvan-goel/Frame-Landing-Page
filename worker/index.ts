/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  isContributorLocalOnlyPath,
  isLoopbackHost,
} from "../lib/contributor-local-only";
import {
  isPreorderAdminPath,
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
  PREORDER_STAGING_ACCESS_SECRET?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
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

function withPublicResponseHeaders(response: Response, url: URL) {
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

  if (headers.get("content-type")?.startsWith("text/html")) {
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("X-Content-Type-Options", "nosniff");
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

    if (url.hostname.toLowerCase() === "www.framewearable.com") {
      return Response.redirect(
        `https://framewearable.com${url.pathname}${url.search}`,
        308,
      );
    }

    const isLocalRequest = isLoopbackHost(url.host);
    const stagingConfigured = isPreorderStagingConfigured({
      mode: env.PREORDER_MODE,
      secret: env.PREORDER_STAGING_ACCESS_SECRET,
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
        return new Response("Not found", {
          status: 404,
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "text/plain; charset=utf-8",
            "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff",
            "X-Robots-Tag": "noindex, nofollow",
          },
        });
      }
      const cookie = await createPreorderStagingCookieValue(
        env.PREORDER_STAGING_ACCESS_SECRET as string,
      );
      return new Response(null, {
        status: 303,
        headers: {
          "Cache-Control": "no-store",
          Location: "/preorder/review?source=private_staging",
          "Referrer-Policy": "no-referrer",
          "Set-Cookie": preorderStagingCookieHeader(cookie),
          "X-Content-Type-Options": "nosniff",
          "X-Robots-Tag": "noindex, nofollow",
        },
      });
    }

    if (
      !isLocalRequest &&
      stagingConfigured &&
      url.pathname === PREORDER_STAGING_EXIT_PATH
    ) {
      return new Response(null, {
        status: 303,
        headers: {
          "Cache-Control": "no-store",
          Location: "/",
          "Set-Cookie": clearPreorderStagingCookieHeader(),
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const stagingRequestAllowed =
      !isLocalRequest &&
      (await isPreorderStagingCookieAllowed({
        mode: env.PREORDER_MODE,
        secret: env.PREORDER_STAGING_ACCESS_SECRET,
        cookieHeader: request.headers.get("cookie"),
      }));
    const optimizedImageSource =
      url.pathname === "/_vinext/image" ? url.searchParams.get("url") : null;
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
      }) || stagingRequestAllowed;

    if (
      (isContributorRequest && !isLocalRequest) ||
      (isPublicPreorderRequest && !preorderRequestAllowed) ||
      (isSharedStripeWebhook && request.method !== "POST")
    ) {
      return new Response("Not found", {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
          "X-Robots-Tag": "noindex, nofollow",
        },
      });
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const appHeaders = new Headers(request.headers);
    appHeaders.set(
      "x-frame-contributor-local-request",
      isLocalRequest ? "1" : "0",
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

    const response = await handler.fetch(
      new Request(request, { headers: appHeaders }),
      env,
      ctx,
    );

    return withPublicResponseHeaders(response, url);
  },
};

export default worker;
