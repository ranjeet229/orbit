import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import path from "node:path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { Server } from "socket.io";
import { allowedOrigins } from "./origins.js";
import {
  credentials,
  registration,
  messageInput,
  receiptInput,
  conversationInput,
} from "./validation.js";

const production = process.env.NODE_ENV === "production";
const origin = process.env.APP_ORIGIN || "http://localhost:5173";
const origins = allowedOrigins(origin, production);
if (
  !process.env.JWT_SECRET ||
  !process.env.MONGODB_URI ||
  !process.env.TURNSTILE_SECRET_KEY
)
  throw new Error("Missing required .env settings. See README.md.");
if (
  production &&
  (process.env.JWT_SECRET.length < 32 ||
    /^[123]x0{5}/.test(process.env.TURNSTILE_SECRET_KEY) ||
    !process.env.VITE_TURNSTILE_SITE_KEY ||
    /^[123]x0{5}/.test(process.env.VITE_TURNSTILE_SITE_KEY) ||
    !process.env.TURNSTILE_HOSTNAME ||
    !origin.startsWith("https://"))
)
  throw new Error(
    "Production requires HTTPS, a strong JWT secret, real Turnstile keys and TURNSTILE_HOSTNAME.",
  );
const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true },
    password: { type: String, select: false },
    color: String,
  },
  { timestamps: true },
);
const User = mongoose.model("User", userSchema);
const Conversation = mongoose.model(
  "Conversation",
  new mongoose.Schema(
    {
      name: String,
      directKey: { type: String, unique: true, sparse: true },
      members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      lastMessage: { type: String, default: "Say hello 👋" },
    },
    { timestamps: true },
  ),
);
const Message = mongoose.model(
  "Message",
  new mongoose.Schema(
    {
      conversation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation",
        index: true,
      },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      text: String,
      readBy: [String],
      deliveredBy: [String],
    },
    { timestamps: true },
  ),
);
Message.schema.index({ conversation: 1, createdAt: -1 });
const Session = mongoose.model(
  "Session",
  new mongoose.Schema({
    _id: String,
    user: String,
    expires: { type: Date, expires: 0 },
  }),
);
const app = express();
if (process.env.TRUST_PROXY)
  app.set("trust proxy", Number(process.env.TRUST_PROXY));
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        scriptSrc: ["'self'", "https://challenges.cloudflare.com"],
        frameSrc: ["https://challenges.cloudflare.com"],
        connectSrc: ["'self'", "wss:", "https://challenges.cloudflare.com"],
        imgSrc: ["'self'", "data:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
      },
    },
  }),
);
app.use(express.json({ limit: "16kb" }), cookieParser());
app.use("/api", rateLimit({ windowMs: 60000, limit: 180 }));
app.use("/api", (req, res, next) => {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    !origins.includes(req.headers.origin)
  )
    return res.status(403).json({ error: "Request origin is not allowed." });
  next();
});
const http = createServer(app);
const io = new Server(http, {
  cors: { origin: origins, credentials: true },
  maxHttpBufferSize: 16384,
  // Same-origin polling GETs can omit Origin; cross-origin WebSocket handshakes must match.
  allowRequest: (req, cb) =>
    cb(null, !req.headers.origin || origins.includes(req.headers.origin)),
});
const publicUser = (u) => ({
  _id: String(u._id),
  name: u.name,
  email: u.email,
  color: u.color,
});
async function identify(token) {
  const payload = jwt.verify(token || "", process.env.JWT_SECRET);
  const session = await Session.findById(payload.jti);
  if (!session || session.expires < new Date()) throw Error("Expired");
  return payload;
}
async function auth(req, res, next) {
  try {
    req.identity = await identify(req.cookies.orbit);
    req.uid = req.identity.sub;
    next();
  } catch {
    res.status(401).json({ error: "Please sign in to continue." });
  }
}
const authLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 20,
  message: { error: "Too many attempts. Please try again in 15 minutes." },
});
async function verifyHuman(token, action) {
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
      }),
      signal: AbortSignal.timeout(10000),
    },
  );
  const result = await response.json();
  return (
    result.success &&
    (!production ||
      (result.hostname === process.env.TURNSTILE_HOSTNAME &&
        result.action === action))
  );
}
async function login(res, user) {
  const id = randomBytes(24).toString("hex");
  await Session.create({
    _id: id,
    user: String(user._id),
    expires: new Date(Date.now() + 7 * 86400000),
  });
  res.cookie(
    "orbit",
    jwt.sign({}, process.env.JWT_SECRET, {
      subject: String(user._id),
      jwtid: id,
      expiresIn: "7d",
    }),
    {
      httpOnly: true,
      secure: production,
      sameSite: "lax",
      maxAge: 7 * 86400000,
      path: "/",
    },
  );
  res.json({ user: publicUser(user) });
}
app.get("/api/health", (req, res) =>
  res.json({
    status: mongoose.connection.readyState === 1 ? "ok" : "unavailable",
  }),
);
app.post("/api/auth/signup", authLimit, async (req, res) => {
  const data = registration.parse(req.body);
  if (!(await verifyHuman(data.token, "signup")))
    return res
      .status(400)
      .json({ error: "Security check failed. Please try again." });
  const user = await User.create({
    name: data.name,
    email: data.email,
    password: await bcrypt.hash(data.password, 12),
    color: ["violet", "peach", "mint", "blue"][Math.floor(Math.random() * 4)],
  });
  await login(res, user);
});
app.post("/api/auth/login", authLimit, async (req, res) => {
  const data = credentials.parse(req.body);
  if (!(await verifyHuman(data.token, "login")))
    return res
      .status(400)
      .json({ error: "Security check failed. Please try again." });
  const user = await User.findOne({ email: data.email }).select("+password");
  const valid = await bcrypt.compare(
    data.password,
    user?.password ||
      "$2b$12$abcdefghijklmnopqrstuuVvp7O0QGKP6.yI1lQL.GtiRLUiCx1K",
  );
  if (!user || !valid)
    return res.status(401).json({ error: "Email or password is incorrect." });
  await login(res, user);
});
app.get("/api/auth/me", auth, async (req, res) => {
  const user = await User.findById(req.uid);
  if (!user) return res.status(401).json({ error: "Account unavailable." });
  res.json({ user: publicUser(user) });
});
app.post("/api/auth/logout", auth, async (req, res) => {
  await Session.findByIdAndDelete(req.identity.jti);
  io.in(`session:${req.identity.jti}`).disconnectSockets(true);
  res.clearCookie("orbit", { path: "/" });
  res.json({ ok: true });
});
app.get("/api/users", auth, async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2 || q.length > 60) return res.json([]);
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  res.json(
    (
      await User.find({
        _id: { $ne: req.uid },
        $or: [{ name: new RegExp(escaped, "i") }, { email: q.toLowerCase() }],
      }).limit(20)
    ).map(publicUser),
  );
});
app.get("/api/conversations", auth, async (req, res) =>
  res.json(
    await Conversation.find({ members: req.uid })
      .populate("members", "name email color")
      .sort({ updatedAt: -1 }),
  ),
);
app.post("/api/conversations", auth, async (req, res) => {
  const data = conversationInput.parse(req.body);
  const members = [...new Set([req.uid, ...data.members])];
  if (
    members.length < 2 ||
    (await User.countDocuments({ _id: { $in: members } })) !== members.length
  )
    return res.status(400).json({ error: "Choose valid participants." });
  const directKey =
    members.length === 2 ? [...members].sort().join(":") : undefined;
  let conversation = directKey && (await Conversation.findOne({ directKey }));
  if (!conversation) {
    try {
      conversation = await Conversation.create({
        members,
        ...(directKey ? { directKey } : { name: data.name || "Our circle" }),
      });
    } catch (e) {
      if (e.code !== 11000 || !directKey) throw e;
      conversation = await Conversation.findOne({ directKey });
    }
  }
  await conversation.populate("members", "name email color");
  members.forEach((id) => io.to(id).emit("conversation", conversation));
  await Promise.all(members.map(syncPresence));
  res.json(conversation);
});
async function member(id, uid) {
  return (
    mongoose.isValidObjectId(id) &&
    (await Conversation.findOne({ _id: id, members: uid }))
  );
}
app.get("/api/conversations/:id/messages", auth, async (req, res) => {
  if (!(await member(req.params.id, req.uid)))
    return res.status(404).json({ error: "Conversation not found." });
  const filter = { conversation: req.params.id };
  if (req.query.before) {
    const before = new Date(String(req.query.before));
    if (isNaN(before.getTime()))
      return res.status(400).json({ error: "Invalid date." });
    filter.createdAt = { $lt: before };
  }
  const messages = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("sender", "name color");
  res.json(messages.reverse());
});
app.post("/api/conversations/:id/messages", auth, async (req, res) => {
  const data = messageInput.parse(req.body);
  const chat = await member(req.params.id, req.uid);
  if (!chat) return res.status(404).json({ error: "Conversation not found." });
  const message = await Message.create({
    conversation: chat._id,
    sender: req.uid,
    text: data.text,
    readBy: [req.uid],
    deliveredBy: [req.uid],
  });
  await message.populate("sender", "name color");
  chat.lastMessage = data.text;
  await chat.save();
  chat.members.forEach((id) => io.to(String(id)).emit("message", message));
  res.status(201).json(message);
});
app.post("/api/conversations/:id/read", auth, async (req, res) => {
  const chat = await member(req.params.id, req.uid);
  if (!chat) return res.status(404).json({ error: "Conversation not found." });
  const { messageIds } = receiptInput.parse(req.body);
  await recordReceipt(chat, req.uid, messageIds, "read");
  res.json({ ok: true });
});
async function recordReceipt(chat, uid, messageIds, kind) {
  const field = kind === "read" ? "readBy" : "deliveredBy";
  const matching = await Message.find({
    _id: { $in: messageIds },
    conversation: chat._id,
    sender: { $ne: uid },
    [field]: { $ne: uid },
  }).select("_id");
  const ids = matching.map((m) => String(m._id));
  if (!ids.length) return;
  await Message.updateMany(
    { _id: { $in: ids } },
    {
      $addToSet:
        kind === "read"
          ? { readBy: uid, deliveredBy: uid }
          : { deliveredBy: uid },
    },
  );
  chat.members.forEach((id) =>
    io.to(String(id)).emit(kind, {
      conversation: String(chat._id),
      user: uid,
      messageIds: ids,
    }),
  );
}
const online = new Map();
io.use(async (socket, next) => {
  try {
    const cookies = Object.fromEntries(
      (socket.handshake.headers.cookie || "")
        .split(";")
        .filter((v) => v.includes("="))
        .map((v) => v.trim().split("=")),
    );
    socket.identity = await identify(cookies.orbit);
    next();
  } catch {
    next(Error("Unauthorized"));
  }
});
async function syncPresence(uid) {
  const chats = await Conversation.find({ members: uid }).select("members");
  io.to(uid).emit(
    "online",
    [...new Set(chats.flatMap((c) => c.members.map(String)))].filter((id) =>
      online.has(id),
    ),
  );
}
async function broadcastPresence(uid) {
  const chats = await Conversation.find({ members: uid }).select("members");
  const peers = new Set(chats.flatMap((c) => c.members.map(String)));
  peers.forEach((id) =>
    io.to(id).emit("presence", { id: uid, online: online.has(uid) }),
  );
}
io.on("connection", async (socket) => {
  const uid = socket.identity.sub;
  socket.join(uid);
  socket.join(`session:${socket.identity.jti}`);
  online.set(uid, (online.get(uid) || 0) + 1);
  const expiry = setTimeout(
    () => socket.disconnect(true),
    Math.max(1, socket.identity.exp * 1000 - Date.now()),
  );
  socket.on("disconnect", () => {
    clearTimeout(expiry);
    online.set(uid, Math.max(0, (online.get(uid) || 1) - 1));
    if (!online.get(uid)) {
      online.delete(uid);
      broadcastPresence(uid).catch(() => {});
    }
  });
  socket.on("delivered", async (payload = {}) => {
    try {
      const { messageIds } = receiptInput.parse(payload);
      const chat = await member(payload.conversation, uid);
      if (chat) await recordReceipt(chat, uid, messageIds, "delivered");
    } catch {}
  });
  try {
    await broadcastPresence(uid);
    await syncPresence(uid);
    const chats = await Conversation.find({ members: uid }).select("members");
    // Deliver queued messages to this device, in bounded batches; read requires viewing the chat.
    for (const chat of chats) {
      while (socket.connected) {
        const pending = await Message.find({
          conversation: chat._id,
          sender: { $ne: uid },
          deliveredBy: { $ne: uid },
        })
          .limit(500)
          .populate("sender", "name color");
        if (!pending.length) break;
        await socket.timeout(5000).emitWithAck("delivery:batch", pending);
        await recordReceipt(
          chat,
          uid,
          pending.map((m) => String(m._id)),
          "delivered",
        );
      }
    }
  } catch {}
  let lastTyping = 0;
  socket.on("typing", async ({ conversation } = {}) => {
    if (Date.now() - lastTyping < 900) return;
    lastTyping = Date.now();
    try {
      const chat = await member(conversation, uid);
      if (chat)
        chat.members
          .filter((id) => String(id) !== uid)
          .forEach((id) =>
            io.to(String(id)).emit("typing", { conversation, user: uid }),
          );
    } catch {}
  });
});
app.use(express.static(path.resolve("dist")));
app.get("/{*path}", (req, res) => {
  if (req.path.startsWith("/api/"))
    return res.status(404).json({ error: "Not found." });
  res.sendFile(path.resolve("dist/index.html"));
});
app.use((err, req, res, next) => {
  if (err.name === "ZodError")
    return res.status(400).json({ error: err.issues[0].message });
  if (err.code === 11000)
    return res
      .status(409)
      .json({ error: "An account with this email already exists." });
  res.status(500).json({ error: "Something went wrong. Please try again." });
});
try {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  await Promise.all([
    User.init(),
    Conversation.init(),
    Message.init(),
    Session.init(),
  ]);
  http.listen(process.env.PORT || 4000, () =>
    console.log("Orbit API ready on port " + (process.env.PORT || 4000)),
  );
} catch (error) {
  console.error(
    "Database connection failed. Check MongoDB credentials, Atlas network access, and DNS. (" +
      error.name +
      ")",
  );
  process.exit(1);
}
