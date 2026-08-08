export type PreorderConfirmationResult = {
  status?: string;
  error?: string;
};

export type PreorderConfirmationRecovery = {
  eyebrow: string;
  heading: string;
  message: string;
  primaryAction:
    | { kind: "retry"; label: string }
    | { kind: "link"; label: string; href: string };
};

export type PreorderShippingAddress = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

function addressValue(address: Record<string, unknown>, key: string) {
  const value = address[key];
  return typeof value === "string" ? value.trim() : "";
}

export function publicPreorderShippingAddress(
  address: Record<string, unknown>,
): PreorderShippingAddress | null {
  const line1 = addressValue(address, "line1");
  const line2 = addressValue(address, "line2");
  const city = addressValue(address, "city");
  const state = addressValue(address, "state");
  const postalCode = addressValue(address, "postal_code");
  const country = addressValue(address, "country");
  if (!line1 || !city || !state || !postalCode || !country) return null;

  return {
    line1,
    ...(line2 ? { line2 } : {}),
    city,
    state,
    postalCode,
    country,
  };
}

export function preorderShippingAddressLines(address: PreorderShippingAddress) {
  const locality = `${address.city}, ${address.state} ${address.postalCode}`;
  return [
    address.line1,
    address.line2,
    locality,
    address.country === "US" ? "United States" : address.country,
  ].filter((value): value is string => Boolean(value));
}

export function preorderItemDescription(quantity: number) {
  return quantity === 1 ? "one Frame" : `${quantity} Frames`;
}

export function preorderConfirmationRecovery(
  result: PreorderConfirmationResult,
): PreorderConfirmationRecovery {
  if (result.status === "invalid") {
    return {
      eyebrow: "Payment confirmation",
      heading: "We couldn’t find this confirmation.",
      message:
        "This link may be incomplete or outdated. If you completed payment, open the secure management link in your confirmation email or contact pre-order support.",
      primaryAction: { kind: "link", label: "Return to pre-order", href: "/preorder/review" },
    };
  }

  if (result.status === "expired" || result.status === "unpaid") {
    return {
      eyebrow: "Payment not completed",
      heading: "Your pre-order wasn’t completed.",
      message:
        "Frame has not recorded a completed payment for this session. Return to the pre-order review when you’re ready to try again.",
      primaryAction: { kind: "link", label: "Return to pre-order", href: "/preorder/review" },
    };
  }

  if (result.status === "rate_limited") {
    return {
      eyebrow: "Confirmation temporarily paused",
      heading: "Please wait before checking again.",
      message:
        "There have been too many confirmation checks from this connection. Wait a few minutes, then try again.",
      primaryAction: { kind: "retry", label: "Check again" },
    };
  }

  return {
    eyebrow: "Payment confirmation",
    heading: "We’re having trouble loading your confirmation.",
    message:
      "Your confirmation is temporarily unavailable. Check again, or contact pre-order support if this continues.",
    primaryAction: { kind: "retry", label: "Check again" },
  };
}
