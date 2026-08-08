import { notFound, redirect } from "next/navigation";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";

export const dynamic = "force-dynamic";

export default async function PreorderPage() {
  if (!(await isPreorderSalesPageEnabled())) notFound();

  redirect("/preorder/review?source=preorder_redirect");
}
