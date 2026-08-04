/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  isContributorLocalOnlyPath,
  isLoopbackHost,
} from "../lib/contributor-local-only";

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
    const optimizedImageSource =
      url.pathname === "/_vinext/image" ? url.searchParams.get("url") : null;
    const isContributorRequest =
      isContributorLocalOnlyPath(url.pathname) ||
      (optimizedImageSource
        ? isContributorLocalOnlyPath(
            new URL(optimizedImageSource, url).pathname,
          )
        : false);

    if (isContributorRequest && !isLocalRequest) {
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

    const response = await handler.fetch(
      new Request(request, { headers: appHeaders }),
      env,
      ctx,
    );

    return withPublicResponseHeaders(response, url);
  },
};

export default worker;
