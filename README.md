# Orbit

A responsive realtime chat app built with React, Node.js, Express, MongoDB, and Socket.IO. Ivory surfaces, violet message bubbles, animated conversation transitions, a mobile layout, and dedicated login/signup screens.

## Run locally

Requires Node.js 22.12+ and access to your MongoDB Atlas cluster.

```powershell
npm.cmd install
npm.cmd run dev
```

Open **http://localhost:5173** or **http://127.0.0.1:5173**. Development allows both loopback names on the configured port; production allows only `APP_ORIGIN`. Use the same address in each session because browser cookies are specific to the hostname. Vite stops if port 5173 is busy instead of silently switching ports. On macOS/Linux, use `npm` instead of `npm.cmd`.

Your actual `.env` is already created and ignored by Git. It includes the supplied Atlas URI, database name `orbit`, a generated signing secret, and Cloudflare's official development test keys. No `.env.example` is needed. Never commit `.env` or put the database URI in a `VITE_` variable: Vite variables are public.

In Atlas, allow your development machine's IP under Network Access and ensure the database user has read/write access to `orbit`. If startup reports a connection failure, check credentials, IP access, and DNS/firewall access to Atlas. Do not disable TLS verification. Rotate the database password shared in the conversation and update `MONGODB_URI` before deployment.

Create two accounts in separate browser profiles (or normal/incognito windows). Click **+**, search the other person's name or exact email, select them, and start chatting. Select multiple people for a group. Demo mode uses sample conversations and does not save messages or create accounts.

## Features

- Signup/login with bcrypt password hashes, HTTP-only session cookies, server-side session revocation, and logout.
- Direct and group conversations, persisted messages, earlier-message pagination, emoji picker, online indicators, typing events, and read receipts.
- Presence updates when a conversation is created, on reconnect, and when the last connected tab closes. Green dots indicate a connected account. Message ticks are gray single (sent), gray double (delivered), or blue double (read). Read receipts require the message to be visible in the focused chat; background tabs do not mark messages read. Group double ticks require all other participants to receive/read the message.
- Conversation filtering and in-session unread badges. Unread counters reset on reload.
- Server-side participant checks for messages/read receipts/typing, input validation, rate limits, origin protection, security headers, and Cloudflare Turnstile validation.
- Responsive layout, keyboard message submission, password visibility controls, and reduced-motion support.

## Cloudflare setup — your steps

Local development already uses **test keys that always pass**. These are for testing, not bot protection. Real keys must come from your Cloudflare account.

1. Sign in at https://dash.cloudflare.com/ and open **Turnstile**. Add a widget and name it `Orbit`.
2. Add your application's hostname, for example `chat.yourdomain.com`, and choose **Managed** mode. For real-key local testing, create a separate development widget with `localhost` allowed.
3. Copy the public **site key** into `VITE_TURNSTILE_SITE_KEY` in `.env`.
4. Copy the private **secret key** into `TURNSTILE_SECRET_KEY` in `.env`. Keep this key on the server; do not send it through chat or commit it.
5. Set `TURNSTILE_HOSTNAME` to the exact hostname without `https://` or a path. Set `APP_ORIGIN` to the full browser origin, such as `https://chat.yourdomain.com`.
6. Restart the app. After changing a site key for a deployment, rebuild the frontend with `npm.cmd run build`.
7. Confirm a valid challenge allows signup/login and a missing or invalid token fails. The server validates tokens with Cloudflare; checking only the browser widget is insufficient.

Turnstile works without moving your DNS to Cloudflare. It protects these forms; it does not automatically enable Cloudflare's reverse proxy, WAF, or all-site protection. To add those, connect your domain in Cloudflare, follow its DNS onboarding, proxy the app record, and use a valid origin certificate with **Full (strict)** TLS. Restrict direct origin access through your hosting provider/firewall if you need edge protections to be mandatory. Do not put interactive WAF challenges on `/socket.io/`; they can break socket connections.

References: [Cloudflare setup](https://developers.cloudflare.com/turnstile/get-started/), [server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).

## Deployment

Deploy one Node service with MongoDB Atlas. Express serves `dist/` and the API/socket endpoint on the same origin.

```powershell
npm.cmd run build
npm.cmd start
```

Set `NODE_ENV=production`, a secure `APP_ORIGIN`, real Turnstile keys, `TURNSTILE_HOSTNAME`, and a strong `JWT_SECRET` in the host's secret settings. Set them before building (the public site key is embedded at build time). Production startup rejects test secret keys. Use HTTPS and configure your host to support WebSocket upgrades. Set `TRUST_PROXY` only when you know the exact number of trusted reverse proxies in front of Express; an incorrect value can weaken IP rate limiting. Never expose this development server publicly with test keys.

## Checks

```powershell
npm.cmd test
npm.cmd run build
node scripts/integration.mjs
```

The integration test downloads a temporary MongoDB binary, uses an isolated disposable database, and calls Cloudflare with official test credentials. It needs network access, and never uses your Atlas database. It checks authentication, cross-origin rejection, access control, socket delivery, read receipts, and logout revocation.

For the complete real-browser signup/login and live-reply test (Microsoft Edge installed):

```powershell
$env:ORBIT_BROWSER_TEST='1'
npm.cmd run test:integration
```

With the development server running, `npm.cmd run test:browser` checks the demo UI at desktop/mobile sizes and saves screenshots in `test-results/`. `npm.cmd run check:db` verifies Atlas connectivity without creating records.

`npm.cmd run test:presence` uses two browser accounts and a temporary database to check new-contact online indicators, delivery/read tick colors, background-tab behavior, multiple tabs, disconnects, queued delivery after reconnect, and persistent receipts. It requires Microsoft Edge and network access for Cloudflare's test validation. It does not start or stop your development servers.

## Scope and next steps

This is an initial chat application, not a full WhatsApp/Facebook clone. It does not implement end-to-end encryption, calls, uploads, email verification, password recovery, push notifications, moderation/blocking, or account deletion. Email delivery credentials and recovery flows should be added before a public launch. Messages are stored on the server and should be protected with deployment TLS, database access controls, and backups. Presence and rate-limit state are per process; multi-instance deployments need a shared Socket.IO adapter, shared presence/rate-limit storage, and a deployment review. No claim of a completed security audit is made.
