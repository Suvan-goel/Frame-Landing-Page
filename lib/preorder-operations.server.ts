import { getSupabaseAdmin } from "./supabase-admin.server";

export type PreorderEnvironment = "test" | "live";
export type PreorderSalesStatus = "open" | "paused" | "sold_out";

export type PreorderSalesSnapshot = {
  environment: PreorderEnvironment;
  salesStatus: PreorderSalesStatus;
  inventoryLimit: number;
  unitLimit: number;
  paidUnits: number;
  reservedUnits: number;
  remainingUnits: number;
  inventoryRemainingUnits: number;
  updatedAt: string;
  updatedBy: string | null;
};

type SnapshotRow = {
  environment: PreorderEnvironment;
  sales_status: PreorderSalesStatus;
  inventory_limit: number | string;
  unit_limit: number | string;
  paid_units: number | string;
  reserved_units: number | string;
  remaining_units: number | string;
  inventory_remaining_units: number | string;
  updated_at: string;
  updated_by: string | null;
};

export class PreorderAvailabilityError extends Error {
  constructor(
    public readonly reason:
      | "paused"
      | "sold_out"
      | "already_completed"
      | "unavailable",
  ) {
    super(reason);
    this.name = "PreorderAvailabilityError";
  }
}

export function preorderEnvironmentForMode(
  mode: "off" | "test" | "live",
): PreorderEnvironment | null {
  if (mode === "test" || mode === "live") return mode;
  return null;
}

function numberValue(value: number | string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("Pre-order sales totals are invalid.");
  }
  return parsed;
}

function snapshotFromRow(row: SnapshotRow): PreorderSalesSnapshot {
  return {
    environment: row.environment,
    salesStatus: row.sales_status,
    inventoryLimit: numberValue(row.inventory_limit),
    unitLimit: numberValue(row.unit_limit),
    paidUnits: numberValue(row.paid_units),
    reservedUnits: numberValue(row.reserved_units),
    remainingUnits: numberValue(row.remaining_units),
    inventoryRemainingUnits: numberValue(row.inventory_remaining_units),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

export async function getPreorderSalesSnapshot(
  environment: PreorderEnvironment,
) {
  const supabase = await getSupabaseAdmin();
  const result = await supabase.rpc("get_preorder_sales_snapshot", {
    p_environment: environment,
  });
  if (result.error) throw result.error;
  const rows = result.data as SnapshotRow[] | null;
  const row = rows?.[0];
  if (!row) throw new Error(`Pre-order ${environment} controls are not configured.`);
  return snapshotFromRow(row);
}

export async function updatePreorderSalesControl(input: {
  environment: PreorderEnvironment;
  salesStatus: PreorderSalesStatus;
  unitLimit: number;
  updatedBy: string;
}) {
  const current = await getPreorderSalesSnapshot(input.environment);
  if (input.unitLimit < current.paidUnits + current.reservedUnits) {
    throw new Error("Released capacity cannot be lower than paid units and active checkout reservations.");
  }
  const supabase = await getSupabaseAdmin();
  const updated = await supabase
    .from("preorder_sales_controls")
    .update({
      sales_status: input.salesStatus,
      unit_limit: input.unitLimit,
      updated_by: input.updatedBy.trim().toLowerCase(),
      updated_at: new Date().toISOString(),
    })
    .eq("environment", input.environment)
    .select("environment")
    .maybeSingle();
  if (updated.error) throw updated.error;
  if (!updated.data) {
    throw new Error(`Pre-order ${input.environment} controls were not found.`);
  }
  return getPreorderSalesSnapshot(input.environment);
}

export async function reservePreorderCheckout(input: {
  requestKey: string;
  environment: PreorderEnvironment;
  sku: string;
  quantity: number;
  unitAmount: number;
  currency: string;
  estimatedDelivery: string;
  source: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  termsVersion: string;
  productStatusVersion: string;
  termsAcceptedAt: string;
  productStatusAcknowledgedAt: string;
  marketingOptIn: boolean;
  marketingConsentAt: string | null;
}) {
  const supabase = await getSupabaseAdmin();
  const result = await supabase.rpc("reserve_preorder_checkout", {
    p_request_key: input.requestKey,
    p_environment: input.environment,
    p_sku: input.sku,
    p_quantity: input.quantity,
    p_unit_amount: input.unitAmount,
    p_currency: input.currency,
    p_estimated_delivery: input.estimatedDelivery,
    p_source: input.source,
    p_utm_source: input.utmSource,
    p_utm_medium: input.utmMedium,
    p_utm_campaign: input.utmCampaign,
    p_terms_version: input.termsVersion,
    p_product_status_version: input.productStatusVersion,
    p_terms_accepted_at: input.termsAcceptedAt,
    p_product_status_acknowledged_at: input.productStatusAcknowledgedAt,
    p_marketing_opt_in: input.marketingOptIn,
    p_marketing_consent_at: input.marketingConsentAt,
  });

  if (result.error) {
    if (result.error.message.includes("PREORDER_PAUSED")) {
      throw new PreorderAvailabilityError("paused");
    }
    if (result.error.message.includes("PREORDER_SOLD_OUT")) {
      throw new PreorderAvailabilityError("sold_out");
    }
    if (result.error.message.includes("PREORDER_REQUEST_ALREADY_COMPLETED")) {
      throw new PreorderAvailabilityError("already_completed");
    }
    console.error("Pre-order capacity reservation failed", result.error);
    throw new PreorderAvailabilityError("unavailable");
  }
  if (typeof result.data !== "string") {
    throw new PreorderAvailabilityError("unavailable");
  }
  return result.data;
}

export async function releasePreorderCheckoutReservation(intentId: string) {
  const supabase = await getSupabaseAdmin();
  const result = await supabase
    .from("preorder_checkout_intents")
    .update({ status: "failed", updated_at: new Date().toISOString() })
    .eq("id", intentId)
    .eq("status", "created");
  if (result.error) {
    console.error("Pre-order capacity reservation release failed", result.error);
  }
}
