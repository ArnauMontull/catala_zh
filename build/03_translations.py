"""3. Extrae de las tablas de traducción del Wiktionary inglés (kaikki, .jsonl.gz ~520 MB,
~3,3 GB sin comprimir) los pares catalán / mandarín / español por acepción. Lectura en streaming
con gzip, línea a línea: nunca se descomprime a disco ni se carga entero.

Salida: build/out/en_trans.jsonl, una línea por acepción inglesa con traducciones:
  {"w": "boy", "pos": "noun", "sense": "male child", "ca": [...], "zh": [[simp, roman], ...], "es": [...]}

Uso: python -I build/03_translations.py
"""
from __future__ import annotations

import gzip
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import KAIKKI_EN, OUT, progress, progress_end  # noqa: E402

BAD_TAGS = {"Dungan", "Hokkien", "Cantonese", "Wu", "Hakka", "Min", "Teochew", "obsolete", "archaic"}


def simp(word: str) -> str:
    # "男僕 /男仆" -> tradicional / simplificado: nos quedamos con el simplificado
    if "/" in word:
        word = word.split("/")[-1]
    return word.strip().rstrip("!！?？")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    total = KAIKKI_EN.stat().st_size
    n_lines = n_out = 0
    with open(KAIKKI_EN, "rb") as raw, gzip.open(raw, "rt", encoding="utf-8") as f, \
            open(OUT / "en_trans.jsonl", "w", encoding="utf-8", newline="\n") as w:
        for line in f:
            n_lines += 1
            if n_lines % 2000 == 0:
                progress(raw.tell() >> 20, total >> 20, "traducciones del Wiktionary inglés")
            if '"translations"' not in line:
                continue
            o = json.loads(line)
            if o.get("lang_code") != "en":
                continue
            trs = list(o.get("translations", []))
            for s in o.get("senses", []):
                trs += s.get("translations", [])
            by_sense: dict[str, dict] = {}
            for t in trs:
                lang = t.get("lang", "")
                code = t.get("code") or t.get("lang_code")
                word = t.get("word", "")
                if not word or len(word) > 40:
                    continue
                key = None
                if code == "ca" and lang == "Catalan":
                    key = "ca"
                elif lang == "Chinese Mandarin" and not (set(t.get("tags", [])) & BAD_TAGS):
                    key = "zh"
                elif code == "es" and lang == "Spanish":
                    key = "es"
                if key is None:
                    continue
                d = by_sense.setdefault(t.get("sense", ""), {"ca": [], "zh": [], "es": []})
                if key == "zh":
                    item = [simp(word), t.get("roman", "")]
                else:
                    item = word.strip()
                if item not in d[key]:
                    d[key].append(item)
            for sense, d in by_sense.items():
                if not (d["zh"] or d["es"]):
                    continue
                w.write(json.dumps({"w": o.get("word"), "pos": o.get("pos"), "sense": sense, **d},
                                   ensure_ascii=False) + "\n")
                n_out += 1
    progress_end()
    print(f"en_trans.jsonl: {n_out} acepciones con traducciones ({n_lines} líneas leídas)")


if __name__ == "__main__":
    main()
