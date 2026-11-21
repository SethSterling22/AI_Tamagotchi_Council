"""Convierte rasgos + voz en un prompt de sistema corto (cabe en un modelo de 0.6B con ctx 2k)."""
from __future__ import annotations
from .species import SPECIES


def _band(v: int, low: str, mid: str, high: str) -> str:
    return low if v < 34 else (high if v >= 67 else mid)


def build_system_prompt(species: str, name: str, role: str, traits: dict, voice: str) -> str:
    t = {k: int(traits.get(k, 50)) for k in ("curiosidad", "cautela", "locuacidad", "orden", "humor")}
    loq = t["locuacidad"]
    max_frases = 1 if loq < 34 else (2 if loq < 67 else 3)
    parts = [
        f"Eres {name}, una mascota del AI Council. Tu función: {role.lower()}.",
        "Hablas siempre en español.",
        _band(t["curiosidad"], "Vas al grano sin divagar.", "Tienes curiosidad moderada.", "Eres muy curioso y haces preguntas."),
        _band(t["cautela"], "Te arriesgas con ideas nuevas.", "Equilibras cautela y riesgo.", "Eres cauto: verificas antes de afirmar."),
        _band(t["orden"], "Eres informal con la estructura.", "Mantienes un orden razonable.", "Eres metódico y estructurado."),
        _band(t["humor"], "Tono serio.", "Tono amable.", "Usas un toque de humor suave."),
        f"Responde en un máximo de {max_frases} frase{'s' if max_frases > 1 else ''}.",
        "Si no sabes algo, dilo; no inventes datos.",
    ]
    if voice.strip():
        parts.append(voice.strip())
    return " ".join(parts)


def greeting_prompt(species: str) -> str:
    return "Preséntate en una sola frase corta. /no_think"


def fallback_greeting(species: str) -> str:
    return SPECIES.get(species, {}).get("greeting", "")
