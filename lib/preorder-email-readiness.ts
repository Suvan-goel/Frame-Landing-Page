import { SUPPORT_EMAIL } from "./company";
import { SITE_URL } from "./site";

export const PREORDER_EMAIL_DOMAIN = new URL(SITE_URL).hostname;
export const PREORDER_EMAIL_FROM_ADDRESS = `preorders@${PREORDER_EMAIL_DOMAIN}`;
export const PREORDER_EMAIL_FROM_NAME = "Frame Pre-orders";
export const PREORDER_EMAIL_REPLY_TO = SUPPORT_EMAIL;

export type PreorderEmailDnsSnapshot = {
  rootMx: string[];
  rootTxt: string[];
  dmarcTxt: string[];
  resendDkimTxt: string[];
  resendReturnPathTxt: string[];
  resendReturnPathMx: string[];
};

export type PreorderEmailReadinessCheck = {
  name: string;
  ready: boolean;
  readyDetail: string;
  blocker: string;
};

type PreorderEmailReadinessInput = {
  apiKey: string | undefined;
  from: string | undefined;
  operationsRecipient: string | undefined;
  replyTo: string;
  dns: PreorderEmailDnsSnapshot | null;
};

type DnsJsonResponse = {
  Status?: number;
  Answer?: Array<{ data?: string }>;
};

function mailbox(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  const named = normalized.match(/^(.+?)\s*<([^<>]+)>$/);
  if (named) {
    return {
      name: named[1].trim().replace(/^(["'])(.*)\1$/, "$2"),
      address: named[2].trim().toLowerCase(),
    };
  }
  return { name: "", address: normalized.toLowerCase() };
}

function validEmail(value: string | undefined) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()));
}

function txtValue(value: string) {
  return value.trim().replace(/^"|"$/g, "").replace(/"\s+"/g, "");
}

async function resolveDnsJson(name: string, type: "MX" | "TXT") {
  const url = new URL("https://cloudflare-dns.com/dns-query");
  url.searchParams.set("name", name);
  url.searchParams.set("type", type);
  const response = await fetch(url, {
    headers: { Accept: "application/dns-json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`DNS lookup failed with ${response.status}.`);
  const result = (await response.json()) as DnsJsonResponse;
  if (result.Status !== 0) throw new Error(`DNS lookup returned status ${result.Status}.`);
  return (result.Answer ?? [])
    .map((answer) => answer.data?.trim() ?? "")
    .filter(Boolean)
    .map((answer) => (type === "TXT" ? txtValue(answer) : answer));
}

export async function getPreorderEmailDnsSnapshot(): Promise<PreorderEmailDnsSnapshot> {
  const [
    rootMx,
    rootTxt,
    dmarcTxt,
    resendDkimTxt,
    resendReturnPathTxt,
    resendReturnPathMx,
  ] = await Promise.all([
    resolveDnsJson(PREORDER_EMAIL_DOMAIN, "MX"),
    resolveDnsJson(PREORDER_EMAIL_DOMAIN, "TXT"),
    resolveDnsJson(`_dmarc.${PREORDER_EMAIL_DOMAIN}`, "TXT"),
    resolveDnsJson(`resend._domainkey.${PREORDER_EMAIL_DOMAIN}`, "TXT"),
    resolveDnsJson(`send.${PREORDER_EMAIL_DOMAIN}`, "TXT"),
    resolveDnsJson(`send.${PREORDER_EMAIL_DOMAIN}`, "MX"),
  ]);
  return {
    rootMx,
    rootTxt,
    dmarcTxt,
    resendDkimTxt,
    resendReturnPathTxt,
    resendReturnPathMx,
  };
}

export function evaluatePreorderEmailReadiness(
  input: PreorderEmailReadinessInput,
): PreorderEmailReadinessCheck[] {
  const sender = mailbox(input.from);
  const providerCredentialReady =
    Boolean(input.apiKey?.startsWith("re_")) &&
    (input.apiKey?.length ?? 0) >= 20 &&
    !/(?:example|placeholder|replace|your-api-key)/i.test(input.apiKey ?? "");
  const senderReady =
    sender.name === PREORDER_EMAIL_FROM_NAME &&
    sender.address === PREORDER_EMAIL_FROM_ADDRESS;
  const routingReady =
    validEmail(input.operationsRecipient) &&
    input.operationsRecipient?.trim().toLowerCase() === SUPPORT_EMAIL.toLowerCase() &&
    input.replyTo.trim().toLowerCase() === SUPPORT_EMAIL.toLowerCase();

  const checks: PreorderEmailReadinessCheck[] = [
    {
      name: "Email provider credential",
      ready: providerCredentialReady,
      readyDetail: "A non-placeholder Resend credential is configured.",
      blocker: "Configure the restricted Resend sending credential for transactional email.",
    },
    {
      name: "Pre-order sender identity",
      ready: senderReady,
      readyDetail: `${PREORDER_EMAIL_FROM_NAME} uses the authenticated ${PREORDER_EMAIL_FROM_ADDRESS} address.`,
      blocker: `Set PREORDER_FROM_EMAIL exactly to ${PREORDER_EMAIL_FROM_NAME} <${PREORDER_EMAIL_FROM_ADDRESS}>.`,
    },
    {
      name: "Pre-order reply and operations routing",
      ready: routingReady,
      readyDetail: `Customer replies and operational alerts route to ${SUPPORT_EMAIL}.`,
      blocker: `Route both customer replies and PREORDER_OPERATIONS_EMAIL to the monitored inbox (${SUPPORT_EMAIL}).`,
    },
  ];

  if (!input.dns) {
    checks.push({
      name: "Email DNS availability",
      ready: false,
      readyDetail: "Public email-authentication DNS records are reachable.",
      blocker: "The public email-authentication DNS records could not be verified.",
    });
    return checks;
  }

  const rootSpf = input.dns.rootTxt.filter((value) => /^v=spf1\b/i.test(value));
  const dmarc = input.dns.dmarcTxt.find((value) => /^v=dmarc1\b/i.test(value));
  const dmarcPolicy = dmarc?.match(/(?:^|;)\s*p=(none|quarantine|reject)(?:;|$)/i)?.[1];
  const dkimReady = input.dns.resendDkimTxt.some(
    (value) => /^p=[a-z0-9+/]{80,}={0,2}$/i.test(value),
  );
  const returnPathSpfReady = input.dns.resendReturnPathTxt.some(
    (value) => /^v=spf1\b/i.test(value) && /include:amazonses\.com/i.test(value),
  );
  const returnPathMxReady = input.dns.resendReturnPathMx.some((value) =>
    /\bfeedback-smtp\.[a-z0-9-]+\.amazonses\.com\.?$/i.test(value),
  );

  checks.push(
    {
      name: "Support inbox mail routing",
      ready: input.dns.rootMx.length > 0,
      readyDetail: `${PREORDER_EMAIL_DOMAIN} publishes an inbound MX route for customer replies.`,
      blocker: `Publish a working MX route for ${PREORDER_EMAIL_DOMAIN} before directing customer replies there.`,
    },
    {
      name: "Domain SPF policy",
      ready:
        rootSpf.length === 1 &&
        /(?:~all|-all)(?:\s|$)/i.test(rootSpf[0] ?? ""),
      readyDetail: "The root domain publishes one bounded SPF policy for its mailbox provider.",
      blocker: "Publish exactly one valid SPF policy for the root domain and end it with ~all or -all.",
    },
    {
      name: "Resend DKIM",
      ready: dkimReady,
      readyDetail: "The Resend DKIM public key is published for authenticated messages.",
      blocker: `Publish the complete Resend DKIM TXT record at resend._domainkey.${PREORDER_EMAIL_DOMAIN}.`,
    },
    {
      name: "Resend return path",
      ready: returnPathSpfReady && returnPathMxReady,
      readyDetail: "The Resend return-path SPF and feedback MX records are published.",
      blocker: `Publish the Resend SPF TXT and feedback MX records at send.${PREORDER_EMAIL_DOMAIN}.`,
    },
    {
      name: "Domain anti-spoofing policy",
      ready: dmarcPolicy?.toLowerCase() === "quarantine" || dmarcPolicy?.toLowerCase() === "reject",
      readyDetail: `DMARC protects unauthenticated mail with a ${dmarcPolicy?.toLowerCase()} policy.`,
      blocker: `Publish a DMARC quarantine or reject policy at _dmarc.${PREORDER_EMAIL_DOMAIN}.`,
    },
  );

  return checks;
}

export function preorderEmailReadinessBlockers(input: PreorderEmailReadinessInput) {
  return evaluatePreorderEmailReadiness(input)
    .filter((check) => !check.ready)
    .map((check) => check.blocker);
}
