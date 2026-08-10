import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  evaluatePreorderEmailReadiness,
  PREORDER_EMAIL_FROM_ADDRESS,
  PREORDER_EMAIL_FROM_NAME,
  PREORDER_EMAIL_REPLY_TO,
  preorderEmailReadinessBlockers,
} from "../lib/preorder-email-readiness.ts";

function readyInput() {
  return {
    apiKey: "re_live_transactional_1234567890",
    from: `${PREORDER_EMAIL_FROM_NAME} <${PREORDER_EMAIL_FROM_ADDRESS}>`,
    operationsRecipient: PREORDER_EMAIL_REPLY_TO,
    replyTo: PREORDER_EMAIL_REPLY_TO,
    dns: {
      rootMx: ["0 framewearable-com.mail.protection.outlook.com."],
      rootTxt: ["v=spf1 include:secureserver.net -all"],
      dmarcTxt: [
        "v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc@example.com;",
      ],
      resendDkimTxt: [`p=${"A".repeat(120)}`],
      resendReturnPathTxt: ["v=spf1 include:amazonses.com ~all"],
      resendReturnPathMx: ["10 feedback-smtp.us-east-1.amazonses.com."],
    },
  };
}

test("accepts the authenticated Frame sender and protective public DNS", () => {
  const checks = evaluatePreorderEmailReadiness(readyInput());

  assert.equal(checks.length, 8);
  assert.equal(checks.every((check) => check.ready), true);
  assert.deepEqual(preorderEmailReadinessBlockers(readyInput()), []);
});

test("blocks unsafe sender, routing, authentication, and anti-spoofing configuration", () => {
  const input = readyInput();
  input.apiKey = "re_your-api-key";
  input.from = "Frame Orders <orders@example.com>";
  input.operationsRecipient = "owner@example.com";
  input.replyTo = "noreply@example.com";
  input.dns.rootMx = [];
  input.dns.rootTxt.push("v=spf1 include:another.example ~all");
  input.dns.resendDkimTxt = [];
  input.dns.resendReturnPathMx = [];
  input.dns.dmarcTxt = ["v=DMARC1; p=none;"];

  assert.deepEqual(
    evaluatePreorderEmailReadiness(input)
      .filter((check) => !check.ready)
      .map((check) => check.name),
    [
      "Email provider credential",
      "Pre-order sender identity",
      "Pre-order reply and operations routing",
      "Support inbox mail routing",
      "Domain SPF policy",
      "Resend DKIM",
      "Resend return path",
      "Domain anti-spoofing policy",
    ],
  );
});

test("fails closed with one clear blocker when public DNS cannot be read", () => {
  const input = readyInput();
  input.dns = null;
  const checks = evaluatePreorderEmailReadiness(input);

  assert.equal(checks.length, 4);
  assert.equal(checks.at(-1)?.name, "Email DNS availability");
  assert.equal(checks.at(-1)?.ready, false);
});

test("wires the same email identity and DNS gate through sending and both launch checks", async () => {
  const [sender, launchReadiness, checkScript, dedicatedScript] = await Promise.all([
    readFile(new URL("../lib/preorder-email.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/preorder-launch-readiness.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/check-preorder-readiness.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/check-preorder-email-readiness.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(sender, /reply_to: PREORDER_EMAIL_REPLY_TO/);
  assert.match(launchReadiness, /getPreorderEmailDnsSnapshot/);
  assert.match(launchReadiness, /preorderEmailReadinessBlockers/);
  assert.match(checkScript, /evaluatePreorderEmailReadiness/);
  assert.match(dedicatedScript, /No email was sent and no setting was changed/);
});
