import assert from "node:assert/strict";
import test from "node:test";

import { buildAttioNameValue, splitFullName } from "../src/attio.js";

test("splits a conventional full name", () => {
  assert.deepEqual(buildAttioNameValue({ Name: "Ada Lovelace" }), {
    first_name: "Ada",
    last_name: "Lovelace",
    full_name: "Ada Lovelace",
  });
});

test("collapses whitespace without losing multi-part first names", () => {
  assert.deepEqual(buildAttioNameValue({ Name: "  Jean   Luc   Picard " }), {
    first_name: "Jean Luc",
    last_name: "Picard",
    full_name: "Jean Luc Picard",
  });
});

test("supports Attio's last-name-first comma convention", () => {
  assert.deepEqual(splitFullName("Doe, Jane"), {
    firstName: "Jane",
    lastName: "Doe",
  });
  assert.deepEqual(buildAttioNameValue({ Name: "Doe, Jane" }), {
    first_name: "Jane",
    last_name: "Doe",
    full_name: "Doe, Jane",
  });
});

test("keeps a one-word name valid for Attio", () => {
  assert.deepEqual(buildAttioNameValue({ Name: "Cher" }), {
    first_name: "Cher",
    last_name: "Cher",
    full_name: "Cher",
  });
});

test("fills a missing surname from an explicitly supplied first name", () => {
  assert.deepEqual(buildAttioNameValue({ "First Name": "Prince" }), {
    first_name: "Prince",
    last_name: "Prince",
    full_name: "Prince",
  });
});

test("preserves explicit first and last names", () => {
  assert.deepEqual(
    buildAttioNameValue({
      Name: "Ada Lovelace",
      "First Name": "Ada",
      "Last Name": "Lovelace",
    }),
    {
      first_name: "Ada",
      last_name: "Lovelace",
      full_name: "Ada Lovelace",
    },
  );
});

test("omits the name attribute only when no name was supplied", () => {
  assert.equal(buildAttioNameValue({}), null);
});
