require("dotenv").config();
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";
const dbPath = process.env.DATABASE_PATH || "./data/commerce.db";

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error("Set SESSION_SECRET to a random value of at least 32 characters.");
  process.exit(1);
}
if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD === "change-this-to-a-strong-unique-password") {
  console.error("Set ADMIN_USERNAME and a strong, unique ADMIN_PASSWORD before starting.");
  process.exit(1);
}

fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
const db = new SQLiteStore(dbPath);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('resource','event','announcement')),
    title_si TEXT NOT NULL,
    title_en TEXT NOT NULL,
    description_si TEXT NOT NULL DEFAULT '',
    description_en TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    link TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
const count = db.prepare("SELECT COUNT(*) AS n FROM content").get().n;
if (count === 0) {
  const insert = db.prepare(`INSERT INTO content
    (type,title_si,title_en,description_si,description_en,category,link,date)
    VALUES (@type,@title_si,@title_en,@description_si,@description_en,@category,@link,@date)`);
  const seed = db.transaction((items) => items.forEach((item) => insert.run(item)));
  seed([
    {type:"announcement",title_si:"Commerce Section වෙත සාදරයෙන් පිළිගනිමු",title_en:"Welcome to the Commerce Section",description_si:"නවතම නිවේදන සහ අධ්‍යාපනික සම්පත් මෙතැනින් බලන්න.",description_en:"Find the latest announcements and learning resources here.",category:"Notice",link:"",date:""},
    {type:"resource",title_si:"ගිණුම්කරණය — ආදර්ශ සම්පත",title_en:"Accounting — Sample Resource",description_si:"මෙය උදාහරණයක් පමණි. Admin Panel එකෙන් සැබෑ සම්පත් එක් කරන්න.",description_en:"This is a sample entry. Add real resources from the admin panel.",category:"Accounting",link:"",date:""},
    {type:"event",title_si:"ඉදිරි වැඩසටහන",title_en:"Upcoming Event",description_si:"මෙය උදාහරණ event එකකි. නිවැරදි විස්තර Admin Panel එකෙන් යාවත්කාලීන කරන්න.",description_en:"This is a sample event. Update it with real details in the admin panel.",category:"Commerce",link:"",date:""}
  ]);
}

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.set("trust proxy", isProduction ? 1 : false);
app.use(session({
  name: "commerce.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: isProduction, maxAge: 1000 * 60 * 60 * 8 },
  // For a single-instance deployment, the default store is adequate. For multi-instance use,
  // configure a shared session store before scaling horizontally.
}));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait 15 minutes and try again." } });

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: "Please sign in as an administrator." });
}
function clean(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}
function validateContent(body) {
  const type = clean(body.type, 30);
  if (!["resource","event","announcement"].includes(type)) return "Invalid content type.";
  const item = {
    type,
    title_si: clean(body.title_si, 180),
    title_en: clean(body.title_en, 180),
    description_si: clean(body.description_si, 2000),
    description_en: clean(body.description_en, 2000),
    category: clean(body.category, 80),
    link: clean(body.link, 500),
    date: clean(body.date, 30)
  };
  if (!item.title_si || !item.title_en) return "Please enter both Sinhala and English titles.";
  if (item.link && !/^https?:\/\//i.test(item.link)) return "Links must begin with http:// or https://.";
  return item;
}

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.get("/api/content", (req, res) => {
  const items = db.prepare("SELECT id,type,title_si,title_en,description_si,description_en,category,link,date,created_at FROM content ORDER BY CASE type WHEN 'announcement' THEN 0 WHEN 'event' THEN 1 ELSE 2 END, date DESC, id DESC").all();
  res.json(items);
});
app.get("/api/admin/session", (req, res) => res.json({ authenticated: !!(req.session && req.session.isAdmin), username: req.session?.isAdmin ? process.env.ADMIN_USERNAME : null }));
app.post("/api/admin/login", loginLimiter, async (req, res) => {
  const username = clean(req.body.username, 100);
  const password = String(req.body.password ?? "");
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;
  // Compare password hash to avoid direct plaintext comparison; credentials are configured as environment variables.
  const hash = await bcrypt.hash(expectedPass, 10);
  const userOk = username === expectedUser;
  const passOk = await bcrypt.compare(password, hash);
  if (!userOk || !passOk) return res.status(401).json({ error: "Username or password is incorrect." });
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Could not start a secure session." });
    req.session.isAdmin = true;
    req.session.save((saveErr) => {
      if (saveErr) return res.status(500).json({ error: "Could not save session." });
      res.json({ ok: true, username: expectedUser });
    });
  });
});
app.post("/api/admin/logout", requireAdmin, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("commerce.sid", { httpOnly: true, sameSite: "lax", secure: isProduction });
    res.json({ ok: true });
  });
});
app.post("/api/content", requireAdmin, (req, res) => {
  const item = validateContent(req.body);
  if (typeof item === "string") return res.status(400).json({ error: item });
  const result = db.prepare(`INSERT INTO content (type,title_si,title_en,description_si,description_en,category,link,date)
    VALUES (@type,@title_si,@title_en,@description_si,@description_en,@category,@link,@date)`).run(item);
  res.status(201).json({ id: result.lastInsertRowid });
});
app.put("/api/content/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid content ID." });
  const item = validateContent(req.body);
  if (typeof item === "string") return res.status(400).json({ error: item });
  const result = db.prepare(`UPDATE content SET type=@type,title_si=@title_si,title_en=@title_en,
    description_si=@description_si,description_en=@description_en,category=@category,link=@link,date=@date WHERE id=@id`)
    .run({ ...item, id });
  if (!result.changes) return res.status(404).json({ error: "Content not found." });
  res.json({ ok: true });
});
app.delete("/api/content/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid content ID." });
  const result = db.prepare("DELETE FROM content WHERE id = ?").run(id);
  if (!result.changes) return res.status(404).json({ error: "Content not found." });
  res.json({ ok: true });
});

app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`Commerce Section website running on port ${PORT}`));
