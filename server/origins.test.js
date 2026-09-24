import test from "node:test";
import assert from "node:assert/strict";
import { allowedOrigins } from "./origins.js";

test("development accepts loopback aliases on the configured port only", () => {
  const origins = allowedOrigins("http://localhost:5173", false);
  assert.ok(origins.includes("http://127.0.0.1:5173"));
  assert.ok(origins.includes("http://localhost:5173"));
  assert.ok(origins.includes("http://[::1]:5173"));
  assert.ok(!origins.includes("http://localhost:5174"));
  assert.ok(!origins.includes("https://evil.example"));
  assert.ok(!origins.includes("http://localhost.evil.example:5173"));
});
test("production and nonlocal hosts receive no development aliases", () => {
  assert.deepEqual(allowedOrigins("https://chat.example.com", true), [
    "https://chat.example.com",
  ]);
  assert.deepEqual(allowedOrigins("http://localhost:5173", true), [
    "http://localhost:5173",
  ]);
  assert.deepEqual(allowedOrigins("https://chat.example.com", false), [
    "https://chat.example.com",
  ]);
});
