"""Ejecutor de encomiendas: solo trabaja de NOCHE (según el horario del usuario), una encomienda a la vez
por mascota (cada nodo carga un solo modelo) y únicamente si su nodo está en línea. Un nodo caído no
gasta intentos: la encomienda espera a que vuelva. El registro del lobby nunca guarda el texto encargado.
"""
from __future__ import annotations
import os
import threading
import time

from . import cycle, db, persona, probe as P
from .species import LIMITS, SPECIES


class Runner:
    def __init__(self, monitor, max_attempts=3, backoff=300.0, timeout=None):
        self.mon, self.max_attempts, self.backoff = monitor, max_attempts, backoff
        # 400 tokens a ~3 tok/s más la lectura del prompt en la Pi 4: varios minutos (medido en Ocelote)
        self.timeout = timeout or float(os.environ.get("COUNCIL_TASK_TIMEOUT", 900))
        self.sync = False

    def tick(self, now: float):
        if not cycle.state(now)["work"]:
            return
        for t in db.next_tasks(now):
            if (self.mon.rt.get(t["pet_id"]) or {}).get("state") != "online":
                continue  # nodo caído o con error: la encomienda espera sin gastar intentos
            pet = db.get_pet(t["pet_id"])
            if pet and db.start_task(t["id"], now):
                db.add_event(t["pet_id"], "task_start", f"empieza la encomienda #{t['id']}")
                self.mon.bump()
                self.launch(t, pet, now)

    def launch(self, task, pet, now):
        if self.sync:
            self.work(task, pet, now)
        else:
            threading.Thread(target=self.work, args=(task, pet, now), daemon=True, name=f"encomienda-{task['id']}").start()

    def work(self, task, pet, now):
        # el reloj de tick() (no time.time()) marca inicio, fin y esperas: así las pruebas pueden simular la noche
        t0 = time.monotonic()
        end = lambda: now + (time.monotonic() - t0)
        sp = SPECIES[pet["species"]]
        system = persona.build_system_prompt(pet["species"], pet["name"], sp["role"], pet["traits"], pet["voice"], task=True)
        prompt = f"Encomienda: {task['title']}\n\n{task['prompt']}"
        try:
            r = P.generate(pet["host"], pet["port"], pet["model"], system, prompt, LIMITS["task_output_tokens"], self.timeout)
            db.finish_task(task["id"], end(), r)
            db.add_event(pet["id"], "task_done", f"encomienda #{task['id']} lista · {r.get('tokens') or '?'} tok"
                                                 + (f" · {r['tps']} tok/s" if r.get("tps") else "") + (" · cortada" if r.get("truncated") else ""))
        except P.ProbeError as e:
            f = db.fail_task(task["id"], end(), e.as_dict(), self.max_attempts, self.backoff)
            db.add_event(pet["id"], "task_failed", f"encomienda #{task['id']} falló ({e.code}) · intento {f['attempts']}/{self.max_attempts}"
                                                   + ("" if f["final"] else " · se reintentará"))
        except Exception as e:  # nunca dejar una encomienda «en marcha» para siempre
            db.fail_task(task["id"], end(), {"state": "error", "code": "INTERNAL", "message": repr(e)[:200]},
                         self.max_attempts, self.backoff)
        finally:
            self.mon.bump()
