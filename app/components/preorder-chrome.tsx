import { SiteHeader } from "./site-header";

export function PreorderHeader({
  backHref = "/",
  backLabel = "Back to home",
}: {
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <SiteHeader
      backHref={backHref}
      backLabel={backLabel}
      links={[{ href: "/preorder/terms", label: "Pre-order terms" }]}
    />
  );
}
