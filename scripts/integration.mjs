import { MongoMemoryServer } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { once } from "node:events";
import { io } from "socket.io-client";
import { randomBytes } from "node:crypto";
import { chromium } from "@playwright/test";
const db = await MongoMemoryServer.create();
const origin = "http://localhost:4011";
const base = "http://127.0.0.1:4011";
const child = spawn(process.execPath, ["server/index.js"], {
  env: {
    ...process.env,
    NODE_ENV: "development",
    PORT: "4011",
    APP_ORIGIN: origin,
    MONGODB_URI: db.getUri(),
    JWT_SECRET: randomBytes(48).toString("hex"),
    TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
child.stderr.on("data", (d) => process.stderr.write(d));
const sockets = [];
async function request(
  route,
  { body, cookie, expected = 200, requestOrigin = origin } = {},
) {
  const response = await fetch(base + "/api" + route, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Origin: requestOrigin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  assert.equal(response.status, expected, JSON.stringify(data));
  return { data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
try {
  await Promise.race([
    once(child.stdout, "data"),
    new Promise((_, reject) =>
      setTimeout(() => reject(Error("Startup timeout")), 20000),
    ),
  ]);
  await request("/auth/me", { expected: 401 });
  await request("/auth/signup", {
    body: {},
    requestOrigin: "https://evil.example",
    expected: 403,
  });
  const accounts = [];
  for (const name of ["Alice", "Bob", "Carol"])
    accounts.push(
      await request("/auth/signup", {
        body: {
          name,
          email: name.toLowerCase() + "@example.com",
          password: "test-password-123",
          token: "XXXX.DUMMY.TOKEN.XXXX",
        },
      }),
    );
  const [a, b, c] = accounts;
  const login = await request("/auth/login", {
    body: {
      email: "alice@example.com",
      password: "test-password-123",
      token: "XXXX.DUMMY.TOKEN.XXXX",
    },
  });
  await request("/auth/login", {
    body: {
      email: "alice@example.com",
      password: "wrong-password",
      token: "XXXX.DUMMY.TOKEN.XXXX",
    },
    expected: 401,
  });
  const chat = (
    await request("/conversations", {
      cookie: a.cookie,
      body: { members: [b.data.user._id] },
    })
  ).data;
  const duplicate = (
    await request("/conversations", {
      cookie: b.cookie,
      body: { members: [a.data.user._id] },
    })
  ).data;
  assert.equal(chat._id, duplicate._id);
  await request(`/conversations/${chat._id}/messages`, {
    cookie: c.cookie,
    expected: 404,
  });
  await request(`/conversations/${chat._id}/messages`, {
    cookie: c.cookie,
    body: { text: "intrusion" },
    expected: 404,
  });
  const socket = io(base, {
    extraHeaders: { Origin: origin, Cookie: b.cookie },
    transports: ["websocket"],
    reconnection: false,
  });
  sockets.push(socket);
  await Promise.race([
    once(socket, "connect"),
    new Promise((_, reject) =>
      setTimeout(() => reject(Error("Socket timeout")), 10000),
    ),
  ]);
  const event = once(socket, "message");
  await request(`/conversations/${chat._id}/messages`, {
    cookie: a.cookie,
    body: { text: "Hello in realtime!" },
    expected: 201,
  });
  const [message] = await Promise.race([
    event,
    new Promise((_, reject) =>
      setTimeout(() => reject(Error("Message timeout")), 5000),
    ),
  ]);
  assert.equal(message.text, "Hello in realtime!");
  const unseen = await request(`/conversations/${chat._id}/messages`, {
    cookie: a.cookie,
    body: { text: "A newer message not yet viewed" },
    expected: 201,
  });
  await request(`/conversations/${chat._id}/read`, {
    cookie: b.cookie,
    body: { messageIds: [message._id] },
  });
  const history = (
    await request(`/conversations/${chat._id}/messages`, { cookie: a.cookie })
  ).data;
  assert.equal(history.length, 2);
  assert.ok(history[0].readBy.includes(b.data.user._id));
  assert.equal(
    history
      .find((m) => m._id === unseen.data._id)
      .readBy.includes(b.data.user._id),
    false,
  );
  await request("/auth/logout", { cookie: login.cookie, body: {} });
  await request("/auth/me", { cookie: login.cookie, expected: 401 });
  await request("/auth/me", { cookie: a.cookie });
  const group = (
    await request("/conversations", {
      cookie: a.cookie,
      body: {
        members: [b.data.user._id, c.data.user._id],
        name: "Test circle",
      },
    })
  ).data;
  assert.equal(group.members.length, 3);
  await request(`/conversations/${group._id}/messages`, {
    cookie: c.cookie,
    body: { text: "Hello group" },
    expected: 201,
  });
  assert.equal(
    (
      await request(`/conversations/${group._id}/messages`, {
        cookie: b.cookie,
      })
    ).data[0].text,
    "Hello group",
  );
  await request(`/conversations/${chat._id}/read`, {
    cookie: c.cookie,
    body: {},
    expected: 404,
  });
  if (process.env.ORBIT_BROWSER_TEST === "1") {
    const browser = await chromium.launch({
      channel: "msedge",
      headless: true,
    });
    try {
      const page = await browser.newPage();
      await page.goto(origin);
      await page.getByRole("button", { name: "Sign up", exact: true }).click();
      await page.getByLabel("Your name").fill("Dana");
      await page.getByLabel("Email address").fill("dana@example.com");
      await page
        .getByLabel("Password", { exact: true })
        .fill("test-password-123");
      await page
        .getByRole("button", { name: "Create your account", exact: true })
        .click({ timeout: 30000 });
      await page
        .getByRole("button", { name: "Start a conversation", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Start a conversation", exact: true })
        .click();
      await page
        .getByPlaceholder("Search people (2+ characters)")
        .fill("Alice");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /Alice/ })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Start a conversation", exact: true })
        .click();
      await page.getByRole("heading", { name: "Alice", exact: true }).waitFor();
      await page
        .getByRole("textbox", { name: "Message", exact: true })
        .fill("Hello from the real browser");
      await page
        .getByRole("button", { name: "Send message", exact: true })
        .click();
      await page
        .getByRole("main")
        .getByText("Hello from the real browser", { exact: true })
        .waitFor();
      const aliceChats = (await request("/conversations", { cookie: a.cookie }))
        .data;
      const danaChat = aliceChats.find((c) =>
        c.members.some((m) => m.name === "Dana"),
      );
      assert.ok(danaChat);
      await request(`/conversations/${danaChat._id}/messages`, {
        cookie: a.cookie,
        body: { text: "A live reply from Alice" },
        expected: 201,
      });
      await page
        .getByRole("main")
        .getByText("A live reply from Alice", { exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await page.getByLabel("Email address").fill("dana@example.com");
      await page
        .getByLabel("Password", { exact: true })
        .fill("test-password-123");
      await page
        .getByRole("button", { name: "Step into your orbit", exact: true })
        .click({ timeout: 30000 });
      await page
        .getByRole("button", { name: /Alice.*A live reply from Alice/ })
        .click();
      await page
        .getByRole("main")
        .getByText("Hello from the real browser", { exact: true })
        .waitFor();
      console.log(
        "PASS: real browser signup, Cloudflare test widget, cookie session, user search, message persistence, realtime reply, logout and login.",
      );
    } finally {
      await browser.close();
    }
  }
  console.log(
    "PASS: signup, login, origin protection, membership enforcement, direct-chat deduplication, realtime delivery, read receipts, session revocation. Isolated database only.",
  );
} finally {
  sockets.forEach((s) => s.disconnect());
  child.kill();
  await once(child, "exit").catch(() => {});
  await db.stop();
}
