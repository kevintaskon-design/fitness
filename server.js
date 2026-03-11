const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 4000;

const DATA_FILE = path.join(__dirname, "server-data.json");

app.use(express.json());

function safeRead() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function safeWrite(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // ignore
  }
}

app.get("/api/data", (req, res) => {
  const name = String(req.query.name || "").trim();
  if (!name) {
    res.status(400).json({ error: "missing name" });
    return;
  }
  const all = safeRead();
  const entry = all[name] || { weight: [], periodDates: [] };
  res.json(entry);
});

app.post("/api/sync", (req, res) => {
  const { name, weight, periodDates } = req.body || {};
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) {
    res.status(400).json({ error: "missing name" });
    return;
  }
  const all = safeRead();
  all[trimmed] = {
    weight: Array.isArray(weight) ? weight : [],
    periodDates: Array.isArray(periodDates) ? periodDates : []
  };
  safeWrite(all);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API server listening on http://127.0.0.1:${PORT}`);
});

