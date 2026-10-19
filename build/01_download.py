"""1. Descarga las fuentes a build/raw/<fuente>/ (datos no confiables; no se ejecuta nada de ahí).

Uso: python -I build/01_download.py [--no-en]
  --no-en  salta el volcado inglés de kaikki (traducciones ca/cmn/es; ~520 MB comprimido).
"""
from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import CEDICT, KAIKKI_CA, KAIKKI_EN, progress, progress_end  # noqa: E402

SOURCES = [
    ("CC-CEDICT", "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz", CEDICT),
    ("kaikki Catalan", "https://kaikki.org/dictionary/Catalan/kaikki.org-dictionary-Catalan.jsonl", KAIKKI_CA),
    # El JSONL inglés sin comprimir pesa ~3,3 GB; el .gz (~520 MB) se lee en streaming con gzip.
    ("kaikki English (gz)", "https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl.gz", KAIKKI_EN),
]


def fetch(name: str, url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "catala_zh-build/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        total = int(r.headers.get("Content-Length") or 0)
        if dest.exists() and total and dest.stat().st_size == total:
            print(f"= {name}: ya descargado ({total/1e6:.1f} MB)")
            return
        tmp = dest.with_suffix(dest.suffix + ".part")
        done = 0
        with open(tmp, "wb") as f:
            while chunk := r.read(1 << 20):
                f.write(chunk)
                done += len(chunk)
                progress(done // (1 << 20), max(total // (1 << 20), 1), f"descargando {name}")
        tmp.replace(dest)
    print(f"+ {name}: {done/1e6:.1f} MB -> {dest}")


def main() -> None:
    skip_en = "--no-en" in sys.argv
    for name, url, dest in SOURCES:
        if skip_en and dest == KAIKKI_EN:
            continue
        fetch(name, url, dest)
    progress_end()


if __name__ == "__main__":
    main()
