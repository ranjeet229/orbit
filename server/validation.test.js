import test from "node:test";
import assert from "node:assert/strict";
import {
  registration,
  credentials,
  messageInput,
  conversationInput,
} from "./validation.js";
test("signup normalizes email and trims name", () => {
  const data = registration.parse({
    name: "  Alex Morgan  ",
    email: "ALEX@example.com",
    password: "long-password",
    token: "token",
  });
  assert.equal(data.email, "alex@example.com");
  assert.equal(data.name, "Alex Morgan");
});
test("rejects weak credentials and missing human verification", () => {
  for (const data of [
    { email: "bad", password: "password", token: "t" },
    { email: "a@b.com", password: "short", token: "t" },
    { email: "a@b.com", password: "password", token: "" },
  ])
    assert.equal(credentials.safeParse(data).success, false);
});
test("rejects empty, oversized, and object messages", () => {
  for (const text of ["  ", "x".repeat(4001), { $ne: null }])
    assert.equal(messageInput.safeParse({ text }).success, false);
});
test("rejects invalid participant ids and oversized groups", () => {
  assert.equal(
    conversationInput.safeParse({ members: ["not-an-id"] }).success,
    false,
  );
  assert.equal(
    conversationInput.safeParse({ members: Array(21).fill("a".repeat(24)) })
      .success,
    false,
  );
});
test("rejects passwords that bcrypt would silently truncate", () => {
  assert.equal(
    credentials.safeParse({
      email: "a@b.com",
      password: "🔐".repeat(20),
      token: "token",
    }).success,
    false,
  );
});
