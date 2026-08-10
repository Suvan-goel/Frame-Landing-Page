import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("starts pre-order numbering at 10 without reusing issued numbers", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260810130000_start_preorder_numbers_at_ten.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /pg_get_serial_sequence/);
  assert.match(migration, /select last_value from %s/);
  assert.match(migration, /select max\(order_number\)/);
  assert.match(migration, /greatest\(\s*9,/);
  assert.match(migration, /perform setval/);
});
