export const PREORDER_TAX_POLICY_VERSION =
  "uk-remote-seller-2026-08-09-v1";

// This is the private Stripe Tax origin for the current operating model. It is
// not the public seller correspondence address. Update it when the business or
// physical-goods ship-from location changes, then bump the policy version.
export const PREORDER_TAX_HEAD_OFFICE_COUNTRY = "GB";

// Add two-letter state codes only after the company's adviser confirms that a
// live US sales-tax registration is required. Bump the policy version whenever
// this list changes so the prior approval cannot silently carry forward.
export const PREORDER_REQUIRED_US_TAX_REGISTRATION_STATES: readonly string[] = [];

export function isPreorderTaxReviewApproved(
  approvedVersion: string | null | undefined,
) {
  return approvedVersion?.trim() === PREORDER_TAX_POLICY_VERSION;
}

export function comparePreorderUsTaxRegistrationStates(
  activeStates: Iterable<string>,
) {
  const normalize = (state: string) => state.trim().toUpperCase();
  const active = [...new Set([...activeStates].map(normalize).filter(Boolean))].sort();
  const required = [
    ...new Set(
      PREORDER_REQUIRED_US_TAX_REGISTRATION_STATES.map(normalize).filter(Boolean),
    ),
  ].sort();
  const activeSet = new Set(active);
  const requiredSet = new Set(required);

  return {
    matches:
      active.length === required.length &&
      active.every((state) => requiredSet.has(state)),
    active,
    required,
    missing: required.filter((state) => !activeSet.has(state)),
    unexpected: active.filter((state) => !requiredSet.has(state)),
  };
}
