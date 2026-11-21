"""SQLite del lobby. Una conexión por hilo; WAL para que el monitor y la web no se bloqueen."""
from __future__ import annotations
import json
import os
import re
import sqlite3
import threading
import time

SCHEMA = """
CREATE TABLE IF NOT EXISTS pets(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  species TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 11434,
  model TEXT NOT NULL DEFAULT '',
  traits TEXT NOT NULL DEFAULT '{}',
  voice TEXT NOT NULL DEFAULT '',
  stats TEXT NOT NULL DEFAULT '{}',
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  created_at REAL NOT NULL,
  last_state TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT,
  last_seen REAL
);
CREATE TABLE IF NOT EXISTS branches(
  pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL, name TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(pet_id, idx)
);
CREATE TABLE IF NOT EXISTS events(
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL NOT NULL, pet_id INTEGER, kind TEXT NOT NULL, detail TEXT
);
CREATE INDEX IF NOT EXISTS ev_ts ON events(ts DESC);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
"""
_local = threading.local()
_open_lock = threading.Lock()  # pasar a WAL con otra conexión abriendo a la vez da «database is locked» sin esperar


def path() -> str:
    return os.environ.get("COUNCIL_DB", os.path.join(os.path.dirname(__file__), "..", "data", "council.db"))


def conn() -> sqlite3.Connection:
    p = path()
    c = getattr(_local, "c", None)
    if c is None or getattr(_local, "p", None) != p:
        with _open_lock:
            if p != ":memory:":
                os.makedirs(os.path.dirname(os.path.abspath(p)), exist_ok=True)
            c = sqlite3.connect(p, timeout=10)
            c.row_factory = sqlite3.Row
            c.execute("PRAGMA foreign_keys=ON")
            if p != ":memory:":
                c.execute("PRAGMA journal_mode=WAL")
            c.executescript(SCHEMA)
        _local.c, _local.p = c, p
    return c


def slugify(s: str) -> str:
    s = s.lower().translate(str.maketrans("áéíóúñü", "aeiounu"))
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "mascota"


def row_to_pet(r, branches) -> dict:
    return {"id": r["id"], "slug": r["slug"], "name": r["name"], "species": r["species"], "host": r["host"],
            "port": r["port"], "model": r["model"], "traits": json.loads(r["traits"]), "voice": r["voice"],
            "stats": json.loads(r["stats"]), "level": r["level"], "xp": r["xp"], "points": r["points"],
            "created_at": r["created_at"], "branches": branches}


def _branches(c, pet_id):
    return [{"idx": b["idx"], "name": b["name"], "level": b["level"]}
            for b in c.execute("SELECT * FROM branches WHERE pet_id=? ORDER BY idx", (pet_id,))]


def list_pets():
    c = conn()
    return [row_to_pet(r, _branches(c, r["id"])) for r in c.execute("SELECT * FROM pets ORDER BY id")]


def get_pet(pet_id: int):
    c = conn()
    r = c.execute("SELECT * FROM pets WHERE id=?", (pet_id,)).fetchone()
    return row_to_pet(r, _branches(c, r["id"])) if r else None


def unique_slug(base: str, exclude_id=None) -> str:
    c, slug, n = conn(), base, 2
    while True:
        r = c.execute("SELECT id FROM pets WHERE slug=?", (slug,)).fetchone()
        if not r or r["id"] == exclude_id:
            return slug
        slug, n = f"{base}-{n}", n + 1


def insert_pet(p: dict) -> int:
    c = conn()
    cur = c.execute(
        "INSERT INTO pets(slug,name,species,host,port,model,traits,voice,stats,level,xp,points,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (p["slug"], p["name"], p["species"], p["host"], p["port"], p["model"], json.dumps(p["traits"]), p["voice"],
         json.dumps(p["stats"]), p.get("level", 1), p.get("xp", 0), p.get("points", 0), time.time()))
    pid = cur.lastrowid
    for i, (name, lvl) in enumerate(p["branches"]):
        c.execute("INSERT INTO branches(pet_id,idx,name,level) VALUES(?,?,?,?)", (pid, i, name, lvl))
    c.commit()
    return pid


def update_pet(pet_id: int, fields: dict):
    c = conn()
    cols = {"name", "host", "port", "model", "voice", "slug"}
    sets, vals = [], []
    for k, v in fields.items():
        if k in cols:
            sets.append(f"{k}=?"); vals.append(v)
        elif k in ("traits", "stats"):
            sets.append(f"{k}=?"); vals.append(json.dumps(v))
    if sets:
        c.execute(f"UPDATE pets SET {', '.join(sets)} WHERE id=?", (*vals, pet_id))
    if "branches" in fields:
        for i, (name, lvl) in enumerate(fields["branches"]):
            c.execute("UPDATE branches SET name=?, level=? WHERE pet_id=? AND idx=?", (name, lvl, pet_id, i))
    c.commit()


def delete_pet(pet_id: int):
    c = conn()
    c.execute("DELETE FROM pets WHERE id=?", (pet_id,))
    c.execute("DELETE FROM events WHERE pet_id=?", (pet_id,))
    c.commit()


def save_state(pet_id: int, state: str, error, seen):
    c = conn()
    c.execute("UPDATE pets SET last_state=?, last_error=?, last_seen=COALESCE(?,last_seen) WHERE id=?",
              (state, json.dumps(error) if error else None, seen, pet_id))
    c.commit()


def saved_states() -> dict:
    return {r["id"]: (r["last_state"], json.loads(r["last_error"]) if r["last_error"] else None, r["last_seen"])
            for r in conn().execute("SELECT id,last_state,last_error,last_seen FROM pets")}


def add_event(pet_id, kind: str, detail: str = ""):
    c = conn()
    c.execute("INSERT INTO events(ts,pet_id,kind,detail) VALUES(?,?,?,?)", (time.time(), pet_id, kind, detail))
    c.execute("DELETE FROM events WHERE id NOT IN (SELECT id FROM events ORDER BY id DESC LIMIT 500)")
    c.commit()


def events(limit=50, pet_id=None):
    c = conn()
    q, a = "SELECT * FROM events", ()
    if pet_id:
        q, a = q + " WHERE pet_id=?", (pet_id,)
    return [dict(r) for r in c.execute(q + " ORDER BY id DESC LIMIT ?", (*a, limit))]


def get_setting(key: str):
    r = conn().execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return json.loads(r["value"]) if r else None


def set_setting(key: str, value):
    c = conn()
    c.execute("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
              (key, json.dumps(value)))
    c.commit()
