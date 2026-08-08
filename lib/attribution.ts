export function cleanAttribution(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ").slice(0, 100);
  return cleaned || null;
}

function cleanScalarQueryValue(searchParams: URLSearchParams, field: string) {
  const values = searchParams.getAll(field);
  return values.length === 1 ? cleanAttribution(values[0]) : null;
}

export function preorderReviewRedirectPath(searchParams: URLSearchParams) {
  const outgoing = new URLSearchParams({
    source: cleanScalarQueryValue(searchParams, "source") ?? "preorder_redirect",
  });
  for (const field of ["utm_source", "utm_medium", "utm_campaign"] as const) {
    const value = cleanScalarQueryValue(searchParams, field);
    if (value) outgoing.set(field, value);
  }
  return `/preorder/review?${outgoing.toString()}`;
}
