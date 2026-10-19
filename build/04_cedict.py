"""4. Lee CC-CEDICT (gz, streaming) y prepara:
  - simp: palabra simplificada -> pinyin con marcas de tono ("hái zi")
  - alt:  palabra con varias lecturas -> todas sus lecturas
  - t2s:  tradicional -> simplificado
  - rev:  glosa inglesa normalizada -> [[simplificado, posición de la glosa, nº de glosas], ...]

Salida: build/out/cedict.json. Uso: python -I build/04_cedict.py
"""
from __future__ import annotations

import gzip
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import CEDICT, OUT, dump  # noqa: E402

LINE = re.compile(r"^(\S+) (\S+) \[([^\]]*)\] /(.*)/\s*$")
SKIP_DEF = re.compile(r"^(variant of|old variant|archaic variant|surname|CL:|see |used in|abbr\.|"
                      r"also written|erhua variant|Japanese variant|pr\.|\(old\)|\(archaic\)|\(dialect\)|"
                      r"\(Tw\)|\(Cantonese\)|\(literary\)|\(classical\)|\(onom\.\)|\(slang\)|\(Internet slang\))",
                      re.I)
PAREN = re.compile(r"\([^)]*\)")
TONES = {"a": "āáǎà", "e": "ēéěè", "i": "īíǐì", "o": "ōóǒò", "u": "ūúǔù", "ü": "ǖǘǚǜ"}


def mark_syllable(syl: str) -> str:
    m = re.match(r"^([A-Za-züÜv:]+)([1-5])$", syl)
    if not m:
        return syl.replace("u:", "ü").replace("v", "ü")
    body, tone = m.group(1).replace("u:", "ü").replace("v", "ü").replace("U:", "Ü"), int(m.group(2))
    if tone == 5:
        return body
    low = body.lower()
    if "a" in low:
        i = low.index("a")
    elif "e" in low:
        i = low.index("e")
    elif "ou" in low:
        i = low.index("o")
    else:
        idx = [k for k, ch in enumerate(low) if ch in "aeiouü"]
        if not idx:
            return body
        i = idx[-1]
    ch = low[i]
    rep = TONES[ch][tone - 1]
    if body[i].isupper():
        rep = rep.upper()
    return body[:i] + rep + body[i + 1:]


def pinyin_marks(numbered: str) -> str:
    return " ".join(mark_syllable(s) for s in numbered.split())


def norm_def(d: str) -> str:
    d = PAREN.sub("", d).strip().lower()
    d = re.sub(r"^to ", "", d)
    d = re.sub(r"^(a|an|the) ", "", d)
    return re.sub(r"\s+", " ", d).strip(" .,;!?")


def main() -> None:
    simp: dict[str, str] = {}
    best: dict[str, int] = {}
    alt: dict[str, list] = {}
    t2s: dict[str, str] = {}
    rev: dict[str, list] = {}
    with gzip.open(CEDICT, "rt", encoding="utf-8") as f:
        for line in f:
            if line.startswith("#"):
                continue
            m = LINE.match(line)
            if not m:
                continue
            trad, sim, pin, defs = m.groups()
            proper = pin[:1].isupper()
            pm = pinyin_marks(pin)
            ndef = 0 if proper else defs.count("/") + 1
            if sim not in simp or ndef > best.get(sim, -1):
                simp[sim] = pm
                best[sim] = ndef
            alts = alt.setdefault(sim, [])
            if pm not in alts:
                alts.append(pm)
            if trad != sim and trad not in t2s:
                t2s[trad] = sim
            if proper:
                continue
            dl = [d for d in defs.split("/") if d and not SKIP_DEF.match(d)]
            for i, d in enumerate(dl):
                for part in d.split(";"):
                    k = norm_def(part)
                    if not k or len(k) > 40:
                        continue
                    lst = rev.setdefault(k, [])
                    if not any(x[0] == sim for x in lst):
                        lst.append([sim, i, len(dl)])
    alt = {k: v for k, v in alt.items() if len(v) > 1}
    dump({"simp": simp, "alt": alt, "t2s": t2s, "rev": rev}, OUT / "cedict.json")
    print(f"cedict.json: {len(simp)} palabras, {len(rev)} glosas inglesas")


if __name__ == "__main__":
    main()
