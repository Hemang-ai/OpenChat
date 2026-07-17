import assert from "node:assert/strict";
import test from "node:test";
import { hasValidFileSignature } from "../lib/utils/validation.ts";

test("accepts expected PDF and DOCX signatures", () => {
  assert.equal(hasValidFileSignature("policy.pdf", Buffer.from("%PDF-1.7\n")), true);
  assert.equal(hasValidFileSignature("guide.docx", Buffer.from([0x50, 0x4b, 0x03, 0x04])), true);
});

test("rejects renamed executables and binary text", () => {
  assert.equal(hasValidFileSignature("malware.pdf", Buffer.from("MZ executable")), false);
  assert.equal(hasValidFileSignature("binary.txt", Buffer.from([0x41, 0x00, 0x42])), false);
});
