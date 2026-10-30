/** E90: the stored upload filename must never reach the header raw — a quote
 *  added header parameters and \r or \n made Node throw (500). No DB needed. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { inlineContentDisposition } from "./contentDisposition.js";

test("testE90_filenameIsSafeInTheHeader", () => {
  const h = inlineContentDisposition('cr"; filename*=UTF-8\'\'evil.html\r\nX-Injected: 1.pdf');
  assert.doesNotMatch(h, /[\r\n]/);
  assert.equal((h.match(/"/g) ?? []).length, 2, `only the two quotes we add: ${h}`);
  assert.equal((h.match(/filename\*=/g) ?? []).length, 1, h);
  assert.match(inlineContentDisposition("CR-2026.pdf"), /^inline; filename="CR-2026\.pdf"; filename\*=UTF-8''CR-2026\.pdf$/);
  assert.match(inlineContentDisposition("سجل.pdf"), /filename\*=UTF-8''%D8%B3%D8%AC%D9%84\.pdf$/);
});
