import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import { Turnstile } from "@marsidev/react-turnstile";
import {
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Eye,
  EyeOff,
  Heart,
  Info,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Smile,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import "./styles.css";

async function api(url, body, method) {
  const res = await fetch("/api" + url, {
    method: method || (body ? "POST" : "GET"),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res
    .json()
    .catch(() => ({ error: "The server is unavailable. Please try again." }));
  if (!res.ok) throw Error(data.error || "Request failed.");
  return data;
}
const initials = (name) =>
  name
    ?.split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
function Avatar({ user, online, large }) {
  return (
    <div
      className={`avatar ${user?.color || "violet"} ${large ? "large" : ""}`}
    >
      {initials(user?.name || "Orbit")} {online && <i />}
    </div>
  );
}
function Logo() {
  return (
    <div className="logo">
      <span className="orbit-symbol">
        o<span />
      </span>
      orbit<span className="logo-dot">.</span>
    </div>
  );
}
function Modal({ onClose, label, children }) {
  const ref = useRef();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.querySelector("input,button")?.focus();
    const keyboard = (event) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const controls = [
        ...ref.current.querySelectorAll(
          'button:not(:disabled),input,textarea,[tabindex="0"]',
        ),
      ];
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <section
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </section>
    </div>
  );
}
const demoUser = {
  _id: "me",
  name: "Alex Morgan",
  email: "alex@example.com",
  color: "violet",
};
const demoPeople = [
  { _id: "a", name: "Sofia Chen", color: "peach" },
  { _id: "b", name: "Oliver James", color: "mint" },
  { _id: "c", name: "Amelia Rose", color: "blue" },
];
const demoChats = [
  {
    _id: "demo1",
    members: [demoUser, demoPeople[0]],
    lastMessage: "That sounds like a plan! ✨",
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "demo2",
    name: "The creative corner",
    members: [demoUser, ...demoPeople],
    lastMessage: "Oliver: Just shared a little inspiration",
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "demo3",
    members: [demoUser, demoPeople[1]],
    lastMessage: "Coffee sometime this week?",
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "demo4",
    members: [demoUser, demoPeople[2]],
    lastMessage: "You have to see this place 🌿",
    updatedAt: new Date().toISOString(),
  },
];
const demoMessages = [
  {
    _id: "m1",
    conversation: "demo1",
    sender: demoPeople[0],
    text: "Hey Alex! How’s your afternoon going? ☀️",
    createdAt: new Date(Date.now() - 360000).toISOString(),
    readBy: ["a", "me"],
  },
  {
    _id: "m2",
    conversation: "demo1",
    sender: demoUser,
    text: "Pretty good! Taking a little break from the usual. What about you?",
    createdAt: new Date(Date.now() - 300000).toISOString(),
    readBy: ["a", "me"],
  },
  {
    _id: "m3",
    conversation: "demo1",
    sender: demoPeople[0],
    text: "Same here. I found this lovely little café with a rooftop garden 🌿",
    createdAt: new Date(Date.now() - 240000).toISOString(),
    readBy: ["a", "me"],
  },
  {
    _id: "m4",
    conversation: "demo1",
    sender: demoPeople[0],
    text: "We should go this weekend. Good coffee, a bit of sunshine, zero deadlines.",
    createdAt: new Date(Date.now() - 180000).toISOString(),
    readBy: ["a", "me"],
  },
  {
    _id: "m5",
    conversation: "demo1",
    sender: demoUser,
    text: "You had me at good coffee ☕ Saturday?",
    createdAt: new Date(Date.now() - 120000).toISOString(),
    readBy: ["a", "me"],
  },
  {
    _id: "m6",
    conversation: "demo1",
    sender: demoPeople[0],
    text: "That sounds like a plan! ✨",
    createdAt: new Date(Date.now() - 60000).toISOString(),
    readBy: ["a", "me"],
  },
];
function Auth({ onLogin, onDemo }) {
  const [signup, setSignup] = useState(false),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [token, setToken] = useState("");
  const turnstile = useRef();
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await api("/auth/" + (signup ? "signup" : "login"), {
        ...data,
        token,
      });
      onLogin(result.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setToken("");
      turnstile.current?.reset();
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-art">
        <Logo />
        <div className="art-copy">
          <span className="eyebrow">
            <span className="tiny-dot" /> MADE FOR REAL CONNECTION
          </span>
          <h1>
            Your people.
            <br />
            Your space.
            <br />
            <em>A little closer.</em>
          </h1>
          <p>
            From everyday hellos to the big little moments.
            <br />
            Make room for conversations that matter.
          </p>
        </div>
        <div className="floating-chat first">
          <Avatar user={demoPeople[0]} />
          <div>
            <b>Sofia Chen</b>
            <p>Same time, same café? ☕</p>
          </div>
          <span>now</span>
        </div>
        <div className="floating-chat second">
          <span className="wave">👋</span>
          <div>
            <b>A good conversation starts here.</b>
            <p>Less scrolling. More connecting.</p>
          </div>
        </div>
        <div className="art-bottom">
          <div className="mini-avatars">
            {demoPeople.map((u) => (
              <Avatar key={u._id} user={u} />
            ))}
          </div>
          <span>A small space for your favorite people.</span>
          <Sparkles size={22} />
        </div>
        <div className="orb orb-one" />
        <div className="orb orb-two" />
      </section>
      <section className="auth-form-area">
        <div className="auth-form-wrap">
          <div className="form-icon">
            <MessageCircle />
          </div>
          <span className="eyebrow">YOUR NEXT HELLO STARTS HERE</span>
          <h2>
            {signup ? "Find your orbit." : "Welcome back."}
            <span>✦</span>
          </h2>
          <p className="muted">
            {signup
              ? "A fresh space for you and your favorite people."
              : "Good conversations have a way of picking right back up."}
          </p>
          <form onSubmit={submit}>
            {signup && (
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  placeholder="Alex Morgan"
                  minLength={2}
                  maxLength={40}
                  required
                />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                maxLength={254}
                required
              />
            </label>
            <label>
              Password
              <div className="password">
                <input
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete={signup ? "new-password" : "current-password"}
                  placeholder={
                    signup
                      ? "Create a password (8+ characters)"
                      : "Enter your password"
                  }
                  minLength={8}
                  maxLength={72}
                  required
                />
                <button
                  type="button"
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <div className="secure-note">
              <ShieldCheck size={15} /> A quick security check, then you’re in.
            </div>
            <Turnstile
              key={signup ? "signup" : "login"}
              ref={turnstile}
              siteKey={
                import.meta.env.VITE_TURNSTILE_SITE_KEY ||
                "1x00000000000000000000AA"
              }
              onSuccess={setToken}
              onExpire={() => setToken("")}
              onError={() => {
                setToken("");
                setError(
                  "Security check unavailable. Check your connection and retry.",
                );
              }}
              options={{ theme: "light", action: signup ? "signup" : "login" }}
            />
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <button className="primary submit" disabled={busy || !token}>
              {busy
                ? "One moment…"
                : signup
                  ? "Create your account"
                  : "Step into your orbit"}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="auth-switch">
            <span>
              {signup ? "Already have an account?" : "Don't have an account?"}
            </span>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => {
                setSignup(!signup);
                setError("");
                setToken("");
                setShow(false);
              }}
            >
              {signup ? "Sign in" : "Sign up"}
            </button>
          </div>
          <div className="divider">
            <span>just looking around?</span>
          </div>
          <button className="demo-button" onClick={onDemo}>
            Explore the interactive demo <ArrowUpRight size={16} />
          </button>
          <p className="auth-small">
            <LockKeyhole size={13} /> Your space. Thoughtfully protected.
          </p>
        </div>
        <footer>
          © {new Date().getFullYear()} Orbit{" "}
          <span>Good company. Anywhere.</span>
        </footer>
      </section>
    </main>
  );
}
function App() {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [demo, setDemo] = useState(false),
    [chats, setChats] = useState([]),
    [selected, setSelected] = useState(null),
    [messages, setMessages] = useState([]),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All"),
    [draft, setDraft] = useState(""),
    [error, setError] = useState(""),
    [connected, setConnected] = useState(false),
    [online, setOnline] = useState([]),
    [typing, setTyping] = useState(null),
    [modal, setModal] = useState(false),
    [info, setInfo] = useState(false),
    [query, setQuery] = useState(""),
    [results, setResults] = useState([]),
    [picked, setPicked] = useState([]),
    [groupName, setGroupName] = useState(""),
    [sending, setSending] = useState(false),
    [emoji, setEmoji] = useState(false),
    [hasOlder, setHasOlder] = useState(false),
    [unread, setUnread] = useState({});
  const socket = useRef(),
    conversationPanel = useRef(),
    bottom = useRef(),
    active = useRef(selected),
    typingTimer = useRef(),
    demoHistory = useRef([...demoMessages]),
    pendingReads = useRef(new Set()),
    skipScroll = useRef(false);
  active.current = selected;
  useEffect(() => {
    if (!user) return;
    const handleEscape = (event) => {
      if (event.key !== "Escape" || event.isComposing || event.repeat) return;
      // Dialogs handle their own Escape key; keep the underlying chat open.
      if (modal || info) return;
      if (emoji) {
        event.preventDefault();
        setEmoji(false);
        return;
      }
      if (selected) {
        event.preventDefault();
        active.current = null;
        setSelected(null);
        setTyping(null);
        clearTimeout(typingTimer.current);
        conversationPanel.current?.focus({ preventScroll: true });
      } else if (event.target instanceof HTMLElement && event.target.closest('.search-box')) {
        event.target.blur();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [user, selected, modal, info, emoji]);
  useEffect(() => {
    api("/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!user || demo) return;
    let alive = true;
    api("/conversations")
      .then((d) => {
        if (alive) setChats(d);
      })
      .catch((e) => setError(e.message));
    const s = io({ withCredentials: true, path: '/api/server/socket.io', transports: ['websocket'] });
    socket.current = s;
    s.on("connect", () => {
      setConnected(true);
      api("/conversations")
        .then((d) => {
          if (alive) setChats(d);
        })
        .catch(() => {});
      const reconnectChat = active.current;
      if (reconnectChat)
        api(`/conversations/${reconnectChat}/messages`)
          .then((d) => {
            if (alive && active.current === reconnectChat) setMessages(d);
          })
          .catch(() => {});
    });
    s.on("disconnect", () => {
      setConnected(false);
      setOnline([]);
    });
    s.on("connect_error", () => {
      setConnected(false);
      setOnline([]);
    });
    s.on("online", setOnline);
    s.on("presence", (p) =>
      setOnline((v) =>
        p.online ? [...new Set([...v, p.id])] : v.filter((id) => id !== p.id),
      ),
    );
    s.on("conversation", (c) =>
      setChats((v) => [c, ...v.filter((x) => x._id !== c._id)]),
    );
    s.on("message", (m) => {
      if (m.sender._id !== user._id)
        s.emit("delivered", {
          conversation: m.conversation,
          messageIds: [m._id],
        });
      setChats((v) =>
        v
          .map((c) =>
            c._id === m.conversation
              ? { ...c, lastMessage: m.text, updatedAt: m.createdAt }
              : c,
          )
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
      );
      if (active.current === m.conversation) {
        setMessages((v) => (v.some((x) => x._id === m._id) ? v : [...v, m]));
      } else if (m.sender._id !== user._id)
        setUnread((v) => ({
          ...v,
          [m.conversation]: (v[m.conversation] || 0) + 1,
        }));
    });
    s.on("typing", (p) => {
      if (p.conversation === active.current) {
        setTyping(p.user);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(null), 2200);
      }
    });
    s.on("delivery:batch", (_messages, acknowledge) =>
      acknowledge({ received: true }),
    );
    function applyReceipt(p, field) {
      if (p.conversation === active.current)
        setMessages((v) =>
          v.map((m) =>
            p.messageIds.includes(m._id)
              ? { ...m, [field]: [...new Set([...(m[field] || []), p.user])] }
              : m,
          ),
        );
    }
    s.on("read", (p) => applyReceipt(p, "readBy"));
    s.on("delivered", (p) => applyReceipt(p, "deliveredBy"));
    return () => {
      alive = false;
      s.disconnect();
      clearTimeout(typingTimer.current);
    };
  }, [user, demo]);
  useEffect(() => {
    if (!selected) return;
    setError("");
    setTyping(null);
    setDraft("");
    setUnread((v) => ({ ...v, [selected]: 0 }));
    let alive = true;
    if (demo) {
      setMessages(
        demoHistory.current.filter((m) => m.conversation === selected),
      );
      setHasOlder(false);
      return;
    }
    setMessages([]);
    api(`/conversations/${selected}/messages`)
      .then((d) => {
        if (alive) {
          setMessages((current) =>
            [
              ...new Map([...d, ...current].map((m) => [m._id, m])).values(),
            ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
          );
          setHasOlder(d.length === 50);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [selected, demo]);
  useEffect(() => {
    if (!user || !selected || demo || !connected || modal || info) return;
    const root = bottom.current?.parentElement;
    if (!root) return;
    const unreadMessages = new Set(
      messages
        .filter(
          (m) =>
            m.conversation === selected &&
            m.sender._id !== user._id &&
            !m.readBy.includes(user._id),
        )
        .map((m) => m._id),
    );
    if (!unreadMessages.size) return;
    const visible = new Set();
    let timer;
    const markVisible = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (
          document.visibilityState !== "visible" ||
          !document.hasFocus() ||
          active.current !== selected
        )
          return;
        const ids = [...visible]
          .filter(
            (id) => unreadMessages.has(id) && !pendingReads.current.has(id),
          )
          .slice(0, 500);
        if (!ids.length) return;
        ids.forEach((id) => pendingReads.current.add(id));
        try {
          await api(`/conversations/${selected}/read`, { messageIds: ids });
          if (active.current === selected)
            setMessages((current) =>
              current.map((m) =>
                ids.includes(m._id)
                  ? { ...m, readBy: [...new Set([...m.readBy, user._id])] }
                  : m,
              ),
            );
        } catch {
        } finally {
          ids.forEach((id) => pendingReads.current.delete(id));
        }
      }, 150);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.dataset.messageId;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        });
        markVisible();
      },
      { root, threshold: 0.1 },
    );
    root
      .querySelectorAll("[data-message-id]")
      .forEach((element) => observer.observe(element));
    document.addEventListener("visibilitychange", markVisible);
    window.addEventListener("focus", markVisible);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", markVisible);
      window.removeEventListener("focus", markVisible);
    };
  }, [user, selected, demo, connected, messages, modal, info]);
  useEffect(() => {
    if (skipScroll.current) {
      skipScroll.current = false;
      return;
    }
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typing]);
  useEffect(() => {
    if (!modal) return;
    let alive = true;
    const timer = setTimeout(() => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      if (demo) {
        setResults(
          demoPeople.filter((u) =>
            u.name.toLowerCase().includes(query.toLowerCase()),
          ),
        );
        return;
      }
      api("/users?q=" + encodeURIComponent(query))
        .then((d) => {
          if (alive) setResults(d);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, modal, demo]);
  function enterDemo() {
    demoHistory.current = [...demoMessages];
    setDemo(true);
    setUser(demoUser);
    setChats(demoChats);
    setSelected("demo1");
    setOnline(["a", "b"]);
  }
  const chat = chats.find((c) => c._id === selected);
  const peer = chat?.members.find((m) => m._id !== user?._id);
  const title = (c) =>
    c.name ||
    c.members.find((m) => m._id !== user?._id)?.name ||
    "Conversation";
  async function send(e) {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    const id = selected;
    setSending(true);
    setError("");
    try {
      const m = demo
        ? {
            _id: crypto.randomUUID(),
            conversation: id,
            sender: user,
            text: draft.trim(),
            createdAt: new Date().toISOString(),
            readBy: [user._id],
          }
        : await api(`/conversations/${id}/messages`, { text: draft });
      if (demo) demoHistory.current.push(m);
      if (active.current === id) {
        setMessages((v) => (v.some((x) => x._id === m._id) ? v : [...v, m]));
        setDraft("");
      }
      setChats((v) =>
        v.map((c) => (c._id === id ? { ...c, lastMessage: m.text } : c)),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }
  async function createChat() {
    if (!picked.length) return;
    try {
      const c = demo
        ? {
            _id: crypto.randomUUID(),
            members: [user, ...picked],
            name: picked.length > 1 ? groupName || "Our circle" : undefined,
            lastMessage: "Say hello 👋",
          }
        : await api("/conversations", {
            members: picked.map((u) => u._id),
            name: groupName,
          });
      setChats((v) => [c, ...v.filter((x) => x._id !== c._id)]);
      setSelected(c._id);
      setModal(false);
      setPicked([]);
      setQuery("");
      setGroupName("");
    } catch (e) {
      setError(e.message);
    }
  }
  async function logout() {
    try {
      if (!demo) await api("/auth/logout", {});
      setUser(null);
      setDemo(false);
      setChats([]);
      setSelected(null);
      setMessages([]);
      setError("");
      setUnread({});
      setOnline([]);
      setInfo(false);
      setModal(false);
      setFilter("All");
      setSearch("");
    } catch (e) {
      setError(e.message);
    }
  }
  async function older() {
    const id = selected;
    try {
      const d = await api(
        `/conversations/${selected}/messages?before=${encodeURIComponent(messages[0].createdAt)}`,
      );
      if (active.current !== id) return;
      skipScroll.current = true;
      setMessages((v) => [
        ...new Map([...d, ...v].map((m) => [m._id, m])).values(),
      ]);
      setHasOlder(d.length === 50);
    } catch (e) {
      setError(e.message);
    }
  }
  if (loading)
    return (
      <div className="loading">
        <Logo />
        <span>Making a little space for you…</span>
      </div>
    );
  if (!user) return <Auth onLogin={setUser} onDemo={enterDemo} />;
  return (
    <div className="workspace">
      <nav className="rail">
        <div className="rail-brand">
          o<span />
        </div>
        <button
          className="rail-active"
          aria-label="Conversations"
          onClick={() => setSelected(null)}
        >
          <MessageCircle />
        </button>
        <button aria-label="New group" onClick={() => setModal(true)}>
          <Users />
        </button>
        <div className="rail-spacer" />
        <button aria-label="About Orbit" onClick={() => setInfo(!info)}>
          <CircleHelp />
        </button>
        <button aria-label="Sign out" onClick={logout}>
          <LogOut size={20} />
        </button>
        <Avatar user={user} />
      </nav>
      <aside className={`sidebar ${selected ? "mobile-hide" : ""}`}>
        <header className="sidebar-header">
          <Logo />
          <span className="small-badge">LET’S CONNECT</span>
        </header>
        <div className="greeting">
          <span>YOUR EVERYDAY, TOGETHER</span>
          <h1>
            A little closer<span>✦</span>
          </h1>
          <p>Good conversations live here.</p>
        </div>
        <div className="inbox-title">
          <h2>
            Messages <span>{chats.length}</span>
          </h2>
          <button
            className="new-chat"
            aria-label="Start a conversation"
            onClick={() => setModal(true)}
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="search-box">
          <Search size={17} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a conversation"
            aria-label="Find a conversation"
          />
          <span>⌕</span>
        </div>
        <div className="filters">
          {["All", "Unread", "Groups"].map((f) => (
            <button
              className={filter === f ? "active" : ""}
              key={f}
              onClick={() => setFilter(f)}
            >
              {f}
              {f === "All" && <span>{chats.length}</span>}
            </button>
          ))}
        </div>
        <div className="chat-list">
          {chats
            .filter(
              (c) =>
                title(c).toLowerCase().includes(search.toLowerCase()) &&
                (filter !== "Groups" || c.members.length > 2) &&
                (filter !== "Unread" || unread[c._id]),
            )
            .map((c) => {
              const p = c.members.find((m) => m._id !== user._id);
              return (
                <button
                  className={`chat-card ${selected === c._id ? "selected" : ""}`}
                  key={c._id}
                  onClick={() => setSelected(c._id)}
                >
                  <Avatar
                    user={c.name ? { name: c.name, color: "mint" } : p}
                    online={!c.name && online.includes(p?._id)}
                  />
                  <div className="chat-preview">
                    <div>
                      <b>{title(c)}</b>
                      <time>
                        {c.updatedAt
                          ? new Date(c.updatedAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "now"}
                      </time>
                    </div>
                    <p>{c.lastMessage}</p>
                  </div>
                  {!!unread[c._id] && (
                    <span className="unread" aria-label={`${unread[c._id]} unread messages`}>
                      {unread[c._id] > 99 ? "99+" : unread[c._id]}
                    </span>
                  )}
                </button>
              );
            })}
          {!chats.length && (
            <div className="no-chats">
              <MessageCircle />
              <h3>Your next hello awaits.</h3>
              <p>Tap + to find a friend by name or exact email.</p>
            </div>
          )}
        </div>
        <div className="account">
          <Avatar user={user} />
          <div>
            <b>{user.name}</b>
            <span>
              <i className="tiny-dot" />
              {demo
                ? "Exploring Orbit"
                : connected
                  ? "Connected & ready"
                  : "Reconnecting…"}
            </span>
          </div>
          <button aria-label="Account details" onClick={() => setInfo(!info)}>
            <ChevronDown size={17} />
          </button>
        </div>
      </aside>
      <main ref={conversationPanel} tabIndex={-1} className={`conversation ${!selected ? "mobile-hide" : ""}`}>
        {demo && (
          <div className="demo-banner">
            <Sparkles size={14} /> Interactive demo · messages stay in this
            session{" "}
            <button onClick={logout}>
              Create an account <ArrowUpRight size={13} />
            </button>
          </div>
        )}
        {chat ? (
          <>
            <header className="conversation-header">
              <button
                className="mobile-back"
                aria-label="Back to chats"
                onClick={() => setSelected(null)}
              >
                <ArrowLeft />
              </button>
              <Avatar
                user={chat.name ? { name: chat.name, color: "mint" } : peer}
                online={!chat.name && online.includes(peer?._id)}
              />
              <div>
                <h2>{title(chat)}</h2>
                {chat.name && <p>{chat.members.length} people in this circle</p>}
              </div>
              <button
                className="info-button"
                aria-label="Conversation details"
                onClick={() => setInfo(!info)}
              >
                <Info size={21} />
              </button>
            </header>
            <div className="messages">
              <div className="conversation-start">
                <span>
                  <Heart size={13} />
                </span>
                A little space for the two of you
                {chat.name ? " (and your circle)" : ""}.
              </div>
              <div className="date-divider">
                <span>
                  {messages.length
                    ? new Date(
                        messages[messages.length - 1].createdAt,
                      ).toLocaleDateString([], {
                        month: "long",
                        day: "numeric",
                      })
                    : "Today"}
                </span>
              </div>
              {hasOlder && (
                <button className="older" onClick={older}>
                  Load earlier messages
                </button>
              )}
              {messages.map((m, i) => {
                const mine = m.sender._id === user._id;
                const recipients = chat.members.filter(
                  (member) => member._id !== user._id,
                );
                const read =
                  recipients.length > 0 &&
                  recipients.every((member) => m.readBy.includes(member._id));
                const delivered =
                  read ||
                  (recipients.length > 0 &&
                    recipients.every((member) =>
                      (m.deliveredBy || []).includes(member._id),
                    ));
                return (
                  <div
                    className={`message-row ${mine ? "mine" : ""}`}
                    key={m._id}
                    data-message-id={m._id}
                  >
                    {!mine && <Avatar user={m.sender} />}
                    <div className="message-content">
                      {!mine &&
                        (i === 0 ||
                          messages[i - 1].sender._id !== m.sender._id) && (
                          <span className="sender-name">{m.sender.name}</span>
                        )}
                      <div className="bubble">{m.text}</div>
                      <div className="message-meta">
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {mine &&
                          (read ? (
                            <CheckCheck
                              size={16}
                              className="receipt-read"
                              aria-label="Read"
                              role="img"
                            >
                              <title>Read</title>
                            </CheckCheck>
                          ) : delivered ? (
                            <CheckCheck
                              size={16}
                              className="receipt-delivered"
                              aria-label="Delivered"
                              role="img"
                            >
                              <title>Delivered</title>
                            </CheckCheck>
                          ) : (
                            <Check size={16} aria-label="Sent" role="img">
                              <title>Sent</title>
                            </Check>
                          ))}
                      </div>
                    </div>
                  </div>
                );
              })}
              {!messages.length && (
                <div className="empty-conversation">
                  <span>👋</span>
                  <h2>Every friendship starts with a hello.</h2>
                  <p>Go on, make the first move.</p>
                </div>
              )}
              {typing && (
                <div className="typing">
                  <i />
                  <i />
                  <i />
                  <span>Someone is typing</span>
                </div>
              )}
              <div ref={bottom} />
            </div>
            {error && (
              <div className="error chat-error" role="alert">
                {error}
                <button onClick={() => setError("")} aria-label="Dismiss error">
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="composer-wrap">
              {emoji && (
                <div className="emoji-picker">
                  {[
                    "😊",
                    "💜",
                    "✨",
                    "👋",
                    "☕",
                    "🌿",
                    "😂",
                    "🎉",
                    "❤️",
                    "👍",
                  ].map((e) => (
                    <button
                      key={e}
                      aria-label={`Insert ${e}`}
                      onClick={() => {
                        setDraft((v) => v + e);
                        setEmoji(false);
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
              <form className="composer" onSubmit={send}>
                <button
                  type="button"
                  aria-label="Choose an emoji"
                  onClick={() => setEmoji(!emoji)}
                >
                  <Smile size={22} />
                </button>
                <textarea
                  value={draft}
                  maxLength={4000}
                  rows={1}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    socket.current?.emit("typing", { conversation: selected });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(e);
                    }
                  }}
                  placeholder={`Message ${chat.name || peer?.name.split(" ")[0]}…`}
                  aria-label="Message"
                />
                <span className="char-count">
                  {draft.length > 3500 ? `${draft.length}/4000` : ""}
                </span>
                <button
                  className="send-button"
                  disabled={!draft.trim() || sending}
                  aria-label="Send message"
                >
                  <Send size={18} />
                </button>
              </form>
              <div className="composer-caption">
                <LockKeyhole size={11} /> A private conversation. A shared
                little world.
                <span>Enter to send · Shift + Enter for a new line</span>
              </div>
            </div>
          </>
        ) : (
          <div className="welcome">
            <div className="welcome-orbit">
              <MessageCircle size={44} />
              <span>✦</span>
            </div>
            <span className="eyebrow">LESS DISTANCE. MORE CONNECTION.</span>
            <h1>Your world, a little closer.</h1>
            <p>
              Pick a conversation or start a new one.
              <br />
              There’s always something worth sharing.
            </p>
            <button className="primary" onClick={() => setModal(true)}>
              Say hello <Plus size={18} />
            </button>
            {error && <p className="error">{error}</p>}
          </div>
        )}
      </main>
      {info && (
        <Modal onClose={() => setInfo(false)} label="Conversation details">
          <button
            className="close"
            onClick={() => setInfo(false)}
            aria-label="Close details"
          >
            <X />
          </button>
          <span className="eyebrow">YOUR LITTLE CIRCLE</span>
          <h2>{chat ? title(chat) : "Hello, " + user.name}</h2>
          <p className="muted">
            {chat ? "The people who make this space yours." : user.email}
          </p>
          {chat?.members.map((u) => (
            <div className="person" key={u._id}>
              <Avatar user={u} />
              <div>
                <b>{u.name}</b>
                <p>{u.email || "Demo participant"}</p>
              </div>
            </div>
          ))}
          <div className="detail-note">
            <ShieldCheck /> Account protection with Cloudflare Turnstile.
            Messages are stored on the server; end-to-end encryption is not
            implemented.
          </div>
        </Modal>
      )}
      {modal && (
        <Modal onClose={() => setModal(false)} label="Start a conversation">
          <button
            className="close"
            aria-label="Close new conversation"
            onClick={() => setModal(false)}
          >
            <X />
          </button>
          <span className="eyebrow">MAKE A LITTLE CONNECTION</span>
          <h2>A new hello.</h2>
          <p className="muted">
            Find someone by name or exact email. Select multiple people for a
            group.
          </p>
          <div className="search-box">
            <Search size={17} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people (2+ characters)"
            />
          </div>
          <div className="picked">
            {picked.map((u) => (
              <button
                key={u._id}
                onClick={() =>
                  setPicked((v) => v.filter((p) => p._id !== u._id))
                }
              >
                {u.name}
                <X size={12} />
              </button>
            ))}
          </div>
          {results.map((u) => (
            <button
              className="person person-button"
              key={u._id}
              onClick={() =>
                setPicked((v) =>
                  v.some((p) => p._id === u._id)
                    ? v.filter((p) => p._id !== u._id)
                    : [...v, u],
                )
              }
            >
              <Avatar user={u} />
              <div>
                <b>{u.name}</b>
                <p>{u.email}</p>
              </div>
              {picked.some((p) => p._id === u._id) ? (
                <Check size={18} />
              ) : (
                <Plus size={18} />
              )}
            </button>
          ))}
          {query.length >= 2 && !results.length && (
            <p className="muted">
              No people found. Invite your friend to sign up first.
            </p>
          )}
          {picked.length > 1 && (
            <label>
              Group name
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                maxLength={60}
                placeholder="The creative corner"
              />
            </label>
          )}
          {error && <p className="error">{error}</p>}
          <button
            className="primary submit"
            disabled={!picked.length}
            onClick={createChat}
          >
            Start a conversation <ArrowRight size={18} />
          </button>
        </Modal>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
