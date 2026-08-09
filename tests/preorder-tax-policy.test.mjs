import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  comparePreorderUsTaxRegistrationStates,
  isPreorderTaxReviewApproved,
  PREORDER_REQUIRED_US_TAX_REGISTRATION_STATES,
  PREORDER_TAX_HEAD_OFFICE_COUNTRY,
  PREORDER_TAX_POLICY_VERSION,
} from "../lib/preorder-tax-policy.ts";

test("defines the current UK remote-seller pre-order tax policy", () => {
  assert.equal(PREORDER_TAX_HEAD_OFFICE_COUNTRY, "GB");
  assert.deepEqual(PREORDER_REQUIRED_US_TAX_REGISTRATION_STATES, []);
  assert.equal(isPreorderTaxReviewApproved(undefined), false);
  assert.equal(isPreorderTaxReviewApproved(""), false);
  assert.equal(isPreorderTaxReviewApproved(PREORDER_TAX_POLICY_VERSION), true);
});

test("allows zero US registrations and rejects unapproved active states", () => {
  assert.deepEqual(comparePreorderUsTaxRegistrationStates([]), {
    matches: true,
    active: [],
    required: [],
    missing: [],
    unexpected: [],
  });

  const unexpected = comparePreorderUsTaxRegistrationStates(["ca", "CA"]);
  assert.equal(unexpected.matches, false);
  assert.deepEqual(unexpected.active, ["CA"]);
  assert.deepEqual(unexpected.unexpected, ["CA"]);

  const unscoped = comparePreorderUsTaxRegistrationStates(["UNKNOWN"]);
  assert.equal(unscoped.matches, false);
  assert.deepEqual(unscoped.unexpected, ["UNKNOWN"]);
});

test("wires the approved tax policy through runtime and launch checks", async () => {
  const [readiness, checkScript, runtimeEnv, environmentExample] = await Promise.all([
    readFile(new URL("../lib/preorder-launch-readiness.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/check-preorder-readiness.mjs", import.meta.url), "utf8"),
    readFile(new URL("../lib/runtime-env.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);

  assert.match(readiness, /getRuntimeValue\("PREORDER_TAX_REVIEW_APPROVED_VERSION"\)/);
  assert.match(readiness, /isPreorderTaxReviewApproved/);
  assert.match(readiness, /PREORDER_TAX_HEAD_OFFICE_COUNTRY/);
  assert.match(readiness, /comparePreorderUsTaxRegistrationStates/);
  assert.doesNotMatch(readiness, /head_office\?\.address\?\.country !== "US"/);
  assert.match(checkScript, /PREORDER_TAX_REVIEW_APPROVED_VERSION/);
  assert.match(runtimeEnv, /PREORDER_TAX_REVIEW_APPROVED_VERSION\?: string/);
  assert.match(environmentExample, /^PREORDER_TAX_REVIEW_APPROVED_VERSION=$/m);
});
