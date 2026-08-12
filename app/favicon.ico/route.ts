export function GET(request: Request) {
  return Response.redirect(
    new URL("/favicon-transparent.png", request.url),
    308,
  );
}
