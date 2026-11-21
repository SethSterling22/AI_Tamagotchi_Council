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
CREATE TABLE IF NOT EXISTS tasks(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  title TEXT NOT NULL, prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',            -- queued | running | done | failed
  created_at REAL NOT NULL, started_at REAL, finished_at REAL,
  attempts INTEGER NOT NULL DEFAULT 0, next_try_at REAL NOT NULL DEFAULT 0,
  result TEXT, error TEXT, tokens INTEGER, ms INTEGER, tps REAL, truncated INTEGER NOT NULL DEFAULT 0,
  seen_at REAL
);
CREATE INDEX IF NOT EXISTS tasks_pet ON tasks(pet_id, status);
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


# ---------------------------------------------------------------- encomiendas
TASK_SELECT = "SELECT t.*, p.name AS pet_name, p.species AS pet_species FROM tasks t JOIN pets p ON p.id = t.pet_id"


def _task(r) -> dict:
    d = dict(r)
    d["error"] = json.loads(d["error"]) if d["error"] else None
    d["truncated"] = bool(d["truncated"])
    return d


def insert_task(pet_id: int, title: str, prompt: str) -> int:
    c = conn()
    cur = c.execute("INSERT INTO tasks(pet_id,title,prompt,created_at) VALUES(?,?,?,?)", (pet_id, title, prompt, time.time()))
    c.commit()
    return cur.lastrowid


def get_task(task_id: int):
    r = conn().execute(TASK_SELECT + " WHERE t.id=?", (task_id,)).fetchone()
    return _task(r) if r else None


def list_tasks(status=None, limit=100):
    q, a = TASK_SELECT, ()
    if status:
        q, a = q + " WHERE t.status=?", (status,)
    return [_task(r) for r in conn().execute(q + " ORDER BY t.id DESC LIMIT ?", (*a, limit))]


def next_tasks(now: float):
    """La encomienda más antigua lista de cada mascota que no tenga otra en marcha."""
    return [_task(r) for r in conn().execute(TASK_SELECT + """
        WHERE t.status='queued' AND t.next_try_at<=?
          AND NOT EXISTS (SELECT 1 FROM tasks r WHERE r.pet_id=t.pet_id AND r.status='running')
          AND t.id = (SELECT MIN(q.id) FROM tasks q WHERE q.pet_id=t.pet_id AND q.status='queued' AND q.next_try_at<=?)
        ORDER BY t.id""", (now, now))]


def start_task(task_id: int, now: float) -> bool:
    c = conn()
    n = c.execute("UPDATE tasks SET status='running', started_at=? WHERE id=? AND status='queued'", (now, task_id)).rowcount
    c.commit()
    return n == 1


def finish_task(task_id: int, now: float, r: dict):
    c = conn()
    c.execute("""UPDATE tasks SET status='done', finished_at=?, attempts=attempts+1, result=?, error=NULL,
                 tokens=?, ms=?, tps=?, truncated=? WHERE id=?""",
              (now, r["text"], r.get("tokens"), r.get("ms"), r.get("tps"), int(bool(r.get("truncated"))), task_id))
    c.commit()


def fail_task(task_id: int, now: float, error: dict, max_attempts: int, backoff: float) -> dict:
    """Cuenta el intento; vuelve a la cola con espera creciente o queda fallida al agotar los intentos."""
    c = conn()
    att = c.execute("SELECT attempts FROM tasks WHERE id=?", (task_id,)).fetchone()["attempts"] + 1
    final = att >= max_attempts
    c.execute("UPDATE tasks SET status=?, attempts=?, error=?, finished_at=?, next_try_at=? WHERE id=?",
              ("failed" if final else "queued", att, json.dumps(error), now if final else None,
               0 if final else now + backoff * att, task_id))
    c.commit()
    return {"attempts": att, "final": final}


def requeue_running() -> int:
    """Al arrancar el lobby, lo que quedó «en marcha» se perdió con el proceso: vuelve a la cola."""
    c = conn()
    n = c.execute("UPDATE tasks SET status='queued', started_at=NULL WHERE status='running'").rowcount
    c.commit()
    return n


def retry_task(task_id: int) -> bool:
    c = conn()
    n = c.execute("""UPDATE tasks SET status='queued', attempts=0, next_try_at=0, error=NULL, finished_at=NULL
                     WHERE id=? AND status='failed'""", (task_id,)).rowcount
    c.commit()
    return n == 1


def mark_seen(task_id: int, now: float):
    c = conn()
    c.execute("UPDATE tasks SET seen_at=COALESCE(seen_at, ?) WHERE id=? AND status='done'", (now, task_id))
    c.commit()


def delete_task(task_id: int) -> bool:
    c = conn()
    n = c.execute("DELETE FROM tasks WHERE id=? AND status!='running'", (task_id,)).rowcount
    c.commit()
    return n == 1


def task_summary() -> dict:
    out = {}
    for r in conn().execute("SELECT id, pet_id, status, started_at, seen_at FROM tasks"):
        s = out.setdefault(r["pet_id"], {"queued": 0, "running": None, "unseen": 0, "failed": 0})
        if r["status"] == "queued":
            s["queued"] += 1
        elif r["status"] == "running":
            s["running"] = {"id": r["id"], "started_at": r["started_at"]}
        elif r["status"] == "failed":
            s["failed"] += 1
        elif r["seen_at"] is None:
            s["unseen"] += 1
    return out
