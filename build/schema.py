"""Tipos del contrato (CONTRATOS.md §2) en Python: validación (pydantic) y esquema JSON para Haiku."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

Pos = Literal["noun", "verb", "adj", "adv", "pron", "prep", "conj", "det", "intj", "num", "phrase"]
Gender = Literal["m", "f", "mf"]
ConjClass = Literal["1a", "2a", "3a-incoativa", "3a-pura", "irregular"]

TENSES = ["ind.pres", "ind.imperf", "ind.pret", "ind.fut", "cond.pres", "ind.perf", "ind.plusq",
          "ind.pret_perif", "ind.fut_perf", "cond.perf", "subj.pres", "subj.imperf", "subj.perf",
          "subj.plusq", "imp"]
PERSONS = ["1s", "2s", "3s", "1p", "2p", "3p"]
# Etiquetas de index.forms: las del contrato + "pl", "f", "f.pl" para sustantivos y adjetivos
FORM_TAGS = {f"{t}.{p}" for t in TENSES for p in PERSONS} | {"np.ger", "np.part", "lemma", "pl", "f", "f.pl"}


class Example(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ca: str = Field(min_length=1)
    zh: str = Field(min_length=1)
    en: Optional[str] = None

    @field_validator("ca")
    @classmethod
    def short(cls, v: str) -> str:
        if len(v.split()) > 12:   # el contrato pide ≤ 10; margen para clíticos con guion
            raise ValueError("ejemplo demasiado largo")
        return v


class Verb(BaseModel):
    model_config = ConfigDict(extra="forbid")
    conj: ConjClass
    pronominal: Optional[bool] = None


class Entry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    ca: str
    pos: Pos
    gender: Optional[Gender] = None
    fem: Optional[str] = None
    plural: Optional[str] = None
    zh: list[str] = Field(min_length=1, max_length=3)
    pinyin: list[str] = Field(min_length=1, max_length=3)
    en: list[str] = Field(min_length=1, max_length=3)
    es: list[str] = Field(min_length=1, max_length=3)
    ex: Optional[Example] = None
    freq: int = Field(ge=1)
    verb: Optional[Verb] = None

    @field_validator("pinyin")
    @classmethod
    def aligned(cls, v, info):
        zh = info.data.get("zh")
        if zh is not None and len(zh) != len(v):
            raise ValueError("pinyin no alineado con zh")
        return v


# --- esquema JSON para output_config.format (Haiku). Mismo esquema que ExplainResponse.entry
#     (Entry sin freq) con el ejemplo obligatorio. Sin min/maxItems: no los admite el formato
#     estricto; los límites (1-3) se piden en el prompt y se recortan en merge.py.
def _s(**kw):
    return {"type": "string", **kw}


ENTRY_SCHEMA = {
    "type": "object",
    "properties": {
        "id": _s(),
        "ca": _s(),
        "pos": {"type": "string", "enum": list(Pos.__args__)},
        "gender": {"anyOf": [{"type": "string", "enum": ["m", "f", "mf"]}, {"type": "null"}]},
        "fem": {"anyOf": [_s(), {"type": "null"}]},
        "plural": {"anyOf": [_s(), {"type": "null"}]},
        "zh": {"type": "array", "items": _s()},
        "pinyin": {"type": "array", "items": _s()},
        "en": {"type": "array", "items": _s()},
        "es": {"type": "array", "items": _s()},
        "ex": {"type": "object", "properties": {"ca": _s(), "zh": _s(), "en": _s()},
               "required": ["ca", "zh", "en"], "additionalProperties": False},
        "verb": {"anyOf": [{"type": "object", "properties": {
            "conj": {"type": "string", "enum": list(ConjClass.__args__)},
            "pronominal": {"type": "boolean"}}, "required": ["conj", "pronominal"],
            "additionalProperties": False}, {"type": "null"}]},
    },
    "required": ["id", "ca", "pos", "gender", "fem", "plural", "zh", "pinyin", "en", "es", "ex", "verb"],
    "additionalProperties": False,
}

BATCH_SCHEMA = {
    "type": "object",
    "properties": {"entries": {"type": "array", "items": ENTRY_SCHEMA}},
    "required": ["entries"],
    "additionalProperties": False,
}
