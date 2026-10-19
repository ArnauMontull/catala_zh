"""Utilidades compartidas por los scripts de build/ (rutas, norm, progreso)."""
from __future__ import annotations

import json
import re
import sys
import time
import unicodedata
from pathlib import Path

BUILD = Path(__file__).resolve().parent
ROOT = BUILD.parent                      # catala_zh/
LIFE_OS = ROOT.parent
RAW = BUILD / "raw"
OUT = BUILD / "out"
BATCH = BUILD / "batch"
DATA = ROOT / "app" / "public" / "data"

KAIKKI_CA = RAW / "kaikki_ca" / "kaikki.org-dictionary-Catalan.jsonl"
KAIKKI_EN = RAW / "kaikki_en" / "kaikki.org-dictionary-English.jsonl.gz"
CEDICT = RAW / "cedict" / "cedict_1_0_ts_utf-8_mdbg.txt.gz"

TASK = "catala_datos"

_COMBINING = re.compile(r"[̀-ͯ]")
_SPACES = re.compile(r"\s+")


def norm(s: str) -> str:
    """Normalización del contrato (sección 1). Idéntica a la de la app (TS)."""
    s = unicodedata.normalize("NFD", s.lower())
    s = _COMBINING.sub("", s)
    s = s.replace("·", "").replace(".", "")
    return _SPACES.sub(" ", s).strip()


# --- barra de progreso -------------------------------------------------------
try:
    if str(LIFE_OS) not in sys.path:
        sys.path.append(str(LIFE_OS))
    from scripts.progreso import marcar as _marcar, terminar as _terminar  # type: ignore
except Exception:  # pragma: no cover - sin LIFE_OS, sin barra
    _marcar = _terminar = None

_last = [0.0]


def progress(done: int, total: int, text: str = "", force: bool = False) -> None:
    """Actualiza la ventana de progreso como mucho cada 0,5 s."""
    if _marcar is None:
        return
    now = time.time()
    if force or now - _last[0] > 0.5 or done >= total:
        _last[0] = now
        try:
            _marcar(TASK, int(done), max(int(total), 1), text)
        except OSError:
            pass


def progress_end() -> None:
    if _terminar is not None:
        try:
            _terminar(TASK)
        except OSError:
            pass


def dump(obj, path: Path, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        if pretty:
            json.dump(obj, f, ensure_ascii=False, indent=1)
        else:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


def load(path: Path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)
