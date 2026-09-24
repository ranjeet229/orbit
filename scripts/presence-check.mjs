import { MongoMemoryServer } from "mongodb-memory-server";
import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";

const db = await MongoMemoryServer.create();
const origin = "http://localhost:4012";
const child = spawn(process.execPath, ["server/index.js"], {
  env: {
    ...process.env,
    PORT: "4012",
    NODE_ENV: "development",
    APP_ORIGIN: origin,
    MONGODB_URI: db.getUri(),
    JWT_SECRET: randomBytes(48).toString("hex"),
    TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
child.stderr.on("data", (d) => process.stderr.write(d));
let browser;
async function api(route, body, cookie) {
  const response = await fetch(origin + "/api" + route, {
    method: body ? "POST" : "GET",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  assert.ok(response.ok, JSON.stringify(data));
  return { data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
try {
  await once(child.stdout, "data");
  const accounts = [];
  for (const name of ["Alice", "Bob"])
    accounts.push(
      await api("/auth/signup", {
        name,
        email: name + "@example.com",
        password: "test-password-123",
        token: "XXXX.DUMMY.TOKEN.XXXX",
      }),
    );
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const contexts = [],
    pages = [];
  for (const account of accounts) {
    const context = await browser.newContext();
    contexts.push(context);
    await context.addCookies([
      {
        name: "orbit",
        value: account.cookie.slice("orbit=".length),
        url: origin,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    const page = await context.newPage();
    pages.push(page);
    await page.goto(origin);
    await expect(
      page.getByText("Connected & ready", { exact: true }),
    ).toBeVisible();
  }
  const [a, b] = pages;
  // Both are already connected before they become contacts: this reproduced the reported bug.
  const chat = (
    await api(
      "/conversations",
      { members: [accounts[1].data.user._id] },
      accounts[0].cookie,
    )
  ).data;
  await a.getByRole("button", { name: /Bob/ }).click();
  await expect(a.locator(".conversation-header p")).toHaveCount(0);
  await expect(a.locator(".conversation-header .avatar i")).toBeVisible();
  await a
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Delivered but not read");
  await a.getByRole("button", { name: "Send message", exact: true }).click();
  const row = a
    .locator(".message-row")
    .filter({ hasText: "Delivered but not read" });
  await expect(
    row.getByRole("img", { name: "Delivered", exact: true }),
  ).toBeVisible();
  await expect(row.getByRole("img", { name: "Read", exact: true })).toHaveCount(
    0,
  );
  await b.bringToFront();
  await b.getByRole("button", { name: /Alice/ }).click();
  await expect(b.locator(".conversation-header .avatar i")).toBeVisible();
  await expect(
    row.getByRole("img", { name: "Read", exact: true }),
  ).toBeVisible();
  await expect(row.locator(".receipt-read")).toHaveCSS(
    "color",
    "rgb(21, 157, 229)",
  );

  const hiddenTab = await contexts[1].newPage();
  const bobCDP = await contexts[1].newCDPSession(b);
  await bobCDP.send("Emulation.setFocusEmulationEnabled", { enabled: false });
  await hiddenTab.goto("about:blank");
  await hiddenTab.bringToFront();
  await expect
    .poll(() =>
      b.evaluate(
        () => document.visibilityState !== "visible" || !document.hasFocus(),
      ),
    )
    .toBe(true);
  await api(
    `/conversations/${chat._id}/messages`,
    { text: "Do not read in a background tab" },
    accounts[0].cookie,
  );
  const backgroundRow = a
    .locator(".message-row")
    .filter({ hasText: "Do not read in a background tab" });
  await expect(
    backgroundRow.getByRole("img", { name: "Delivered", exact: true }),
  ).toBeVisible();
  // Wait beyond the visibility debounce to ensure this is not merely a delayed receipt.
  await new Promise((resolve) => setTimeout(resolve, 700));
  const history = (
    await api(`/conversations/${chat._id}/messages`, null, accounts[0].cookie)
  ).data;
  assert.equal(
    history
      .find((m) => m.text === "Do not read in a background tab")
      .readBy.includes(accounts[1].data.user._id),
    false,
  );
  await b.bringToFront();
  await expect(
    backgroundRow.getByRole("img", { name: "Read", exact: true }),
  ).toBeVisible();

  const extraBob = await contexts[1].newPage();
  await extraBob.goto(origin);
  await expect(
    extraBob.getByText("Connected & ready", { exact: true }),
  ).toBeVisible();
  await b.close();
  await expect(a.locator(".conversation-header .avatar i")).toBeVisible();
  await contexts[1].close();
  await expect(a.locator(".conversation-header .avatar i")).toHaveCount(0);
  await a
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Queued while offline");
  await a.getByRole("button", { name: "Send message", exact: true }).click();
  const queuedRow = a
    .locator(".message-row")
    .filter({ hasText: "Queued while offline" });
  await expect(
    queuedRow.getByRole("img", { name: "Sent", exact: true }),
  ).toBeVisible();
  const reconnected = await browser.newContext();
  await reconnected.addCookies([
    {
      name: "orbit",
      value: accounts[1].cookie.slice("orbit=".length),
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const bobBack = await reconnected.newPage();
  await bobBack.goto(origin);
  await expect(
    queuedRow.getByRole("img", { name: "Delivered", exact: true }),
  ).toBeVisible();
  await bobBack.getByRole("button", { name: /Alice/ }).click();
  await expect(
    queuedRow.getByRole("img", { name: "Read", exact: true }),
  ).toBeVisible();
  await a.reload();
  await a.getByRole("button", { name: /Bob/ }).click();
  await expect(a.locator(".receipt-read")).toHaveCount(3);
  console.log(
    "PASS: newly-created contacts show online + green dots; delivered gray ticks; read blue ticks; background tabs do not read; focus triggers read; multiple tabs preserve presence; last disconnect goes offline; receipts persist after reload.",
  );
} finally {
  await browser?.close();
  child.kill();
  await once(child, "exit").catch(() => {});
  await db.stop();
}
