import assert from "node:assert/strict";
import test from "node:test";
import { unsubscribeWaitlist } from "../lib/waitlist-unsubscribe.server.ts";

const TOKEN = "123e4567-e89b-42d3-a456-426614174000";
const UNSUBSCRIBED_AT = "2026-08-10T12:00:00.000Z";

function createRepositoryFixture(initialRecord = null) {
  let record = initialRecord ? { ...initialRecord } : null;
  return {
    repository: {
      async markUnsubscribed(token, unsubscribedAt) {
        if (!record || record.token !== token || record.unsubscribedAt) {
          return false;
        }
        record.unsubscribedAt = unsubscribedAt;
        return true;
      },
      async findByToken(token) {
        return record?.token === token
          ? { unsubscribedAt: record.unsubscribedAt }
          : null;
      },
    },
    currentRecord() {
      return record;
    },
  };
}

test("unsubscribes a matching active waitlist record", async () => {
  const fixture = createRepositoryFixture({ token: TOKEN, unsubscribedAt: null });

  const status = await unsubscribeWaitlist(
    fixture.repository,
    TOKEN,
    UNSUBSCRIBED_AT,
  );

  assert.equal(status, "unsubscribed");
  assert.equal(fixture.currentRecord().unsubscribedAt, UNSUBSCRIBED_AT);
});

test("keeps repeat unsubscribe requests idempotent", async () => {
  const fixture = createRepositoryFixture({
    token: TOKEN,
    unsubscribedAt: UNSUBSCRIBED_AT,
  });

  const status = await unsubscribeWaitlist(
    fixture.repository,
    TOKEN,
    "2026-08-10T13:00:00.000Z",
  );

  assert.equal(status, "already_unsubscribed");
  assert.equal(fixture.currentRecord().unsubscribedAt, UNSUBSCRIBED_AT);
});

test("reports an unknown unsubscribe token", async () => {
  const fixture = createRepositoryFixture();

  assert.equal(
    await unsubscribeWaitlist(fixture.repository, TOKEN, UNSUBSCRIBED_AT),
    "not_found",
  );
});

test("fails when an active record was not actually updated", async () => {
  const repository = {
    async markUnsubscribed() {
      return false;
    },
    async findByToken() {
      return { unsubscribedAt: null };
    },
  };

  await assert.rejects(
    unsubscribeWaitlist(repository, TOKEN, UNSUBSCRIBED_AT),
    /could not be confirmed/i,
  );
});

test("propagates database failures", async () => {
  const repository = {
    async markUnsubscribed() {
      throw new Error("fixture database failure");
    },
    async findByToken() {
      return null;
    },
  };

  await assert.rejects(
    unsubscribeWaitlist(repository, TOKEN, UNSUBSCRIBED_AT),
    /fixture database failure/,
  );
});
