"""2. Lee el JSONL catalán de kaikki en streaming y lo reduce a lo que necesitamos.

Salida (build/out/):
  ca_entries.jsonl  una línea por entrada (palabra + categoría gramatical) con glosas, género, formas…
  ca_formof.json    forma flexionada -> [lemas] (sacado de los sentidos «form of»), para mapear wordfreq.

Uso: python -I build/02_wiktionary.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import KAIKKI_CA, OUT, dump, progress, progress_end  # noqa: E402

POS_MAP = {
    "noun": "noun", "verb": "verb", "adj": "adj", "adv": "adv", "pron": "pron", "prep": "prep",
    "postp": "prep", "conj": "conj", "det": "det", "article": "det", "intj": "intj", "num": "num",
    "phrase": "phrase", "prep_phrase": "phrase", "adv_phrase": "phrase", "proverb": "phrase",
    "contraction": "prep",
}
# etiquetas que marcan una forma como no estándar (se indexa, pero no va a la tabla)
NONSTD = {"Valencia", "Valencian", "Balearic", "Northern", "Northwestern", "Alguerese", "dialectal",
          "archaic", "obsolete", "rare", "nonstandard", "colloquial", "Mallorca", "Minorca", "Ibiza",
          "Roussillon", "Algherese", "uncommon", "proscribed", "misspelling"}
PAREN = re.compile(r"\([^)]*\)")


def cats_of(o) -> set[str]:
    out = {c["name"] if isinstance(c, dict) else c for c in o.get("categories", [])}
    for s in o.get("senses", []):
        out |= {c["name"] if isinstance(c, dict) else c for c in s.get("categories", [])}
    return out


def gender_of(o) -> str | None:
    gs = set()
    for h in o.get("head_templates", []):
        a = h.get("args", {})
        for k in ("1", "g", "g2", "2"):
            v = a.get(k, "")
            if not isinstance(v, str):
                continue
            if v.startswith("mf") or v in ("m-f", "mfbysense"):
                gs |= {"m", "f"}
            elif v.startswith("m"):
                gs.add("m")
            elif v.startswith("f"):
                gs.add("f")
        if gs:
            break
    if not gs:
        for s in o.get("senses", []):
            t = set(s.get("tags", []))
            if "masculine" in t and "feminine" in t:
                gs |= {"m", "f"}
            elif "masculine" in t:
                gs.add("m")
            elif "feminine" in t:
                gs.add("f")
            if gs:
                break
    if gs == {"m", "f"}:
        return "mf"
    return gs.pop() if gs else None


def conj_class(o, cats: set[str]) -> str | None:
    tt = ""
    for f in o.get("forms", []):
        if "table-tags" in f.get("tags", []):
            tt = f.get("form", "")
            break
    if "irregular" in tt or "Catalan irregular verbs" in cats:
        return "irregular"
    if "conjugation-1" in tt or "Catalan first conjugation verbs" in cats:
        return "1a"
    if "conjugation-2" in tt or "Catalan second conjugation verbs" in cats:
        return "2a"
    if "Catalan third conjugation verbs with -eix-" in cats:
        return "3a-incoativa"
    if "Catalan third conjugation verbs without -eix-" in cats:
        return "3a-pura"
    if "conjugation-3" in tt:
        return "3a-incoativa"   # la mayoría de verbos en -ir son incoativos
    return None


def clean_gloss(g: str) -> str:
    g = PAREN.sub("", g).strip(" .;:,")
    return re.sub(r"\s+", " ", g)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    total = KAIKKI_CA.stat().st_size
    done = 0
    n_out = 0
    formof: dict[str, set[str]] = {}
    with open(KAIKKI_CA, encoding="utf-8") as f, \
            open(OUT / "ca_entries.jsonl", "w", encoding="utf-8", newline="\n") as w:
        for line in f:
            done += len(line.encode("utf-8"))
            progress(done >> 20, total >> 20, "procesando Wiktionary catalán")
            o = json.loads(line)
            if o.get("lang_code") != "ca":
                continue
            word = o.get("word", "")
            pos = POS_MAP.get(o.get("pos", ""))
            senses = o.get("senses", [])
            glosses, base = [], None
            for s in senses:
                tags = set(s.get("tags", []))
                fo = s.get("form_of") or s.get("alt_of")
                if fo:
                    for t in fo:
                        if t.get("word") and t["word"] != word:
                            formof.setdefault(word, set()).add(t["word"])
                    if "reflexive" in tags or "pronominal" in tags:
                        base = fo[0].get("word")
                    continue
                if {"form-of", "alt-of", "abbreviation", "initialism"} & tags:
                    continue
                for g in s.get("glosses", [])[:1]:
                    g = clean_gloss(g)
                    if g:
                        glosses.append(g)
            if pos is None or not word:
                continue
            pronominal = bool(re.search(r"(-se|-se'n|'s|-s'hi|-se-la|-se-les|-se-ho|-s'en)$", word)) and pos == "verb"
            if not glosses and not (pronominal and base):
                continue
            cats = cats_of(o)
            rec = {"w": word, "pos": pos, "glosses": glosses[:8]}
            if base:
                rec["base"] = base
            if pos in ("noun", "adj"):
                g = gender_of(o)
                fem = plural = fpl = None
                for fm in o.get("forms", []):
                    t = set(fm.get("tags", []))
                    form = fm.get("form", "")
                    if not form or t & NONSTD or "alternative" in t:
                        continue
                    if t == {"feminine"} and not fem:
                        fem = form
                    elif (t == {"plural"} or t == {"masculine", "plural"}) and not plural:
                        plural = form
                    elif t == {"feminine", "plural"} and not fpl:
                        fpl = form
                if pos == "adj":
                    g = "mf" if (fem is None or fem == word) else "m"
                    if fem == word:
                        fem = None
                if g:
                    rec["gender"] = g
                if fem:
                    rec["fem"] = fem
                if plural:
                    rec["plural"] = plural
                if fpl:
                    rec["fpl"] = fpl
            if pos == "verb":
                rec["conj"] = conj_class(o, cats)
                if pronominal:
                    rec["pronominal"] = True
                forms = []
                for fm in o.get("forms", []):
                    if fm.get("source") != "conjugation":
                        continue
                    t = fm.get("tags", [])
                    if not fm.get("form") or "table-tags" in t or "inflection-template" in t:
                        continue
                    forms.append([fm["form"], *t])
                rec["forms"] = forms
            w.write(json.dumps(rec, ensure_ascii=False) + "\n")
            n_out += 1
    dump({k: sorted(v) for k, v in formof.items()}, OUT / "ca_formof.json")
    progress_end()
    print(f"ca_entries.jsonl: {n_out} entradas; ca_formof.json: {len(formof)} formas")


if __name__ == "__main__":
    main()
