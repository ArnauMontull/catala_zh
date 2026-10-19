"""5. Lista de frecuencia: wordfreq top_n_list('ca', 12000) -> lemas que existen en el Wiktionary.

Una forma flexionada de la lista (p. ej. «és», «tinc») cuenta para su lema («ser», «tenir»).
Salida: build/out/freq.json = [[lema, rango], ...] en orden de frecuencia (rango 1 = más común).
Uso: python -I build/05_frequency.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import OUT, dump, load  # noqa: E402

from wordfreq import top_n_list, zipf_frequency  # noqa: E402

N = 13000
MIN_ZIPF = 3.5
STOP = {"dar"}  # «de» como forma arcaica de «dar»
WORD = re.compile(r"^[a-zàèéíïòóúüç·'\-]+$")


def main() -> None:
    lemmas: set[str] = set()
    with open(OUT / "ca_entries.jsonl", encoding="utf-8") as f:
        for line in f:
            lemmas.add(json.loads(line)["w"])
    formof: dict[str, list[str]] = load(OUT / "ca_formof.json")

    seen: dict[str, int] = {}
    order: list[str] = []
    for tok in top_n_list("ca", N):
        tok = tok.replace("l.l", "l·l")
        if not WORD.match(tok) or (len(tok) == 1 and tok not in ("a", "i", "o", "e")):
            continue
        # lema de una forma flexionada: solo si el propio lema es frecuente (evita «molt» -> «moldre»)
        cands = [lm for lm in formof.get(tok, []) if lm in lemmas and lm not in STOP
                 and zipf_frequency(lm, "ca") >= MIN_ZIPF]
        if tok in lemmas:
            cands.append(tok)
        for lm in cands:
            if lm not in seen:
                seen[lm] = len(order) + 1
                order.append(lm)
    dump([[lm, seen[lm]] for lm in order], OUT / "freq.json")
    print(f"freq.json: {len(order)} lemas a partir de {N} formas de wordfreq")


if __name__ == "__main__":
    main()
