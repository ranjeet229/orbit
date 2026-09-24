import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
await fs.mkdir("test-results", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:5173");
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  await page.screenshot({
    path: "test-results/login-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await page.getByLabel("Your name").fill("Alex Example");
  await page.getByLabel("Email address").fill("alex@example.com");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Password", { exact: true }).getAttribute("type"),
    "text",
  );
  await page.screenshot({
    path: "test-results/signup-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Explore the interactive demo" })
    .click();
  await page.getByRole("heading", { name: "Sofia Chen" }).waitFor();
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Browser-tested hello");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page
    .getByRole("main")
    .getByText("Browser-tested hello", { exact: true })
    .waitFor();
  await page.screenshot({
    path: "test-results/chat-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Choose an emoji" }).click();
  await page.getByRole("button", { name: "Insert 💜", exact: true }).click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Message", exact: true })
      .inputValue(),
    "💜",
  );
  await page
    .getByRole("button", { name: "Start a conversation", exact: true })
    .click();
  await page.getByPlaceholder("Search people (2+ characters)").fill("Oliver");
  await page
    .locator(".modal")
    .getByRole("button", { name: "OJ Oliver James" })
    .click();
  await page
    .getByRole("button", { name: "Start a conversation", exact: true })
    .last()
    .click();
  await page.getByRole("heading", { name: "Oliver James" }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/chat-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.getByRole("button", { name: "Back to chats" }).click();
  await page.getByRole("heading", { name: "A little closer" }).waitFor();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  await page.screenshot({
    path: "test-results/login-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: login/signup UI, password visibility, demo messaging, emoji, conversation creation, desktop/mobile layouts, no browser exceptions.",
  );
} finally {
  await browser.close();
}
