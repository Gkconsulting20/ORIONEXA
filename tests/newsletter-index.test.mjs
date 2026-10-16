import test from "node:test";
import assert from "node:assert/strict";
import { mergeNewsletterIndexes } from "../cloudflare/newsletter-index.mjs";

test("copied archives are listed once and database metadata wins", () => {
  const bundled = [1, 2, 3, 4].map(issue => ({ issue, status: "generated" }));
  const copied = [1, 2, 3, 4, 5].map(issue => ({ issue, status: "sent" }));
  const result = mergeNewsletterIndexes(bundled, copied);
  assert.deepEqual(result.map(x => x.issue), [5, 4, 3, 2, 1]);
  assert.ok(result.every(x => x.status === "sent"));
  assert.equal(bundled[0].status, "generated");
});

test("string and number issue IDs identify the same edition", () => {
  assert.deepEqual(mergeNewsletterIndexes([{ issue: "1" }], [{ issue: 1, sentCount: 2 }]),
    [{ issue: 1, sentCount: 2 }]);
});

test("empty indexes and invalid editions are handled explicitly", () => {
  assert.deepEqual(mergeNewsletterIndexes([], []), []);
  assert.throws(() => mergeNewsletterIndexes([{ issue: "invalid" }], []), TypeError);
});
