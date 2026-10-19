"""8. Build final: borrador (+ pulido de Haiku si existe) -> app/public/data/
   entries.json, index.json, conj.json y manifest.json (febles.json lo escribe 07_febles.py).

- Con build/out/polished.json: zh, pinyin, en, es, ex, pos y género salen del pulido.
- Sin él: se usa el borrador del pivote.
- En ambos casos se excluyen las entradas sin zh, es o en (contrato §2).
Uso: python -I build/merge.py
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import DATA, OUT, dump, load, norm  # noqa: E402
from schema import Entry  # noqa: E402

FILES = ["entries.json", "index.json", "conj.json", "febles.json"]
HAN = re.compile(r"^[㐀-鿿（）()、，，·]+$")
TONE_NUM = re.compile(r"[a-zü]+[1-5]\b")


def clean_list(xs, n=3) -> list[str]:
    out = []
    for x in xs or []:
        if isinstance(x, str):
            x = x.strip()
            if x and x not in out:
                out.append(x)
    return out[:n]


def apply_polish(e: dict, p: dict, cedict_simp: dict) -> dict:
    e = dict(e)
    zh = [z for z in clean_list(p.get("zh")) if HAN.match(z)]
    py = [x.strip() for x in (p.get("pinyin") or []) if isinstance(x, str)]
    if zh:
        if len(py) != len(zh) or any(TONE_NUM.search(x) for x in py):
            # pinyin desalineado: lo rehacemos con CC-CEDICT palabra a palabra
            py = [cedict_simp.get(z, "").lower() for z in zh]
            keep = [i for i, x in enumerate(py) if x]
            zh, py = [zh[i] for i in keep], [py[i] for i in keep]
        e["zh"], e["pinyin"] = zh, [x.lower() for x in py]
    for k in ("en", "es"):
        v = clean_list(p.get(k))
        if v:
            e[k] = v
    if p.get("pos"):
        e["pos"] = p["pos"]
    g = p.get("gender")
    if e["pos"] in ("noun", "adj") and g in ("m", "f", "mf"):
        e["gender"] = g
    elif e["pos"] not in ("noun", "adj"):
        e.pop("gender", None)
    for k in ("fem", "plural"):
        if p.get(k):
            e[k] = p[k]
        elif k in p and p[k] is None and e["pos"] not in ("noun", "adj"):
            e.pop(k, None)
    ex = p.get("ex") or {}
    if ex.get("ca") and ex.get("zh") and len(ex["ca"].split()) <= 12:
        e["ex"] = {"ca": ex["ca"].strip(), "zh": ex["zh"].strip()}
        if ex.get("en"):
            e["ex"]["en"] = ex["en"].strip()
    if e["pos"] == "verb":
        v = p.get("verb") or {}
        verb = {"conj": v.get("conj") or (e.get("verb") or {}).get("conj") or "irregular"}
        if v.get("pronominal") or (e.get("verb") or {}).get("pronominal"):
            verb["pronominal"] = True
        e["verb"] = verb
    else:
        e.pop("verb", None)
    return e


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    draft = load(OUT / "draft.json")
    conj_all = load(OUT / "conj.json")
    forms = load(OUT / "forms.json")
    pol_path = OUT / "polished.json"
    polished = load(pol_path) if pol_path.exists() else {}
    cedict_simp = load(OUT / "cedict.json")["simp"]
    mode = f"pulido ({len(polished)})" if polished else "borrador del pivote (sin pulido)"

    entries, dropped = [], []
    for e in draft:
        if e["id"] in polished:
            e = apply_polish(e, polished[e["id"]], cedict_simp)
        for k in ("zh", "en", "es"):
            e[k] = clean_list(e.get(k))
        e["pinyin"] = [x.strip() for x in (e.get("pinyin") or [])][:len(e["zh"])]   # sin deduplicar
        if not (e["zh"] and e["es"] and e["en"]) or len(e["zh"]) != len(e["pinyin"]):
            dropped.append(e["id"])
            continue
        ordered = {k: e[k] for k in ("id", "ca", "pos", "gender", "fem", "plural", "zh", "pinyin", "en", "es",
                                     "ex", "freq", "verb") if e.get(k) is not None}
        Entry.model_validate(ordered)
        entries.append(ordered)
    entries.sort(key=lambda x: (x["freq"], x["id"]))
    ids = {e["id"] for e in entries}
    freq_of = {e["id"]: e["freq"] for e in entries}

    # índices
    idx_forms: dict[str, list] = {}
    for eid in ids:
        for form, tag in forms.get(eid, []):
            lst = idx_forms.setdefault(norm(form), [])
            if [eid, tag] not in lst:
                lst.append([eid, tag])
    idx_zh: dict[str, list] = {}
    idx_es: dict[str, list] = {}
    idx_en: dict[str, list] = {}
    for e in entries:
        for z in e["zh"]:
            idx_zh.setdefault(z.strip(), []).append(e["id"])
        for s in e["es"]:
            idx_es.setdefault(norm(s), []).append(e["id"])
        for s in e["en"]:
            k = norm(re.sub(r"\([^)]*\)", "", s))
            keys = {k, re.sub(r"^(to|a|an|the) ", "", k)}
            for kk in keys:
                if kk:
                    idx_en.setdefault(kk, []).append(e["id"])
    def by_freq(d):
        return {k: sorted(dict.fromkeys(v), key=lambda i: freq_of.get(i, 10 ** 9)) for k, v in sorted(d.items())}
    for lst in idx_forms.values():
        lst.sort(key=lambda x: freq_of.get(x[0], 10 ** 9))
    index = {"forms": dict(sorted(idx_forms.items())), "zh": by_freq(idx_zh), "es": by_freq(idx_es),
             "en": by_freq(idx_en)}
    verbs = {e["id"] for e in entries if e["pos"] == "verb"}
    conj = {eid: conj_all[eid] for eid in sorted(conj_all) if eid in verbs}

    DATA.mkdir(parents=True, exist_ok=True)
    dump(entries, DATA / "entries.json")
    dump(index, DATA / "index.json")
    dump(conj, DATA / "conj.json")
    if not (DATA / "febles.json").exists():
        print("AVISO: falta febles.json; ejecuta build/07_febles.py")

    files = [{"name": n, "bytes": (DATA / n).stat().st_size, "sha256": sha256(DATA / n)}
             for n in FILES if (DATA / n).exists()]
    today = time.strftime("%Y-%m-%d")
    version = f"{today}.1"
    old_p = DATA / "manifest.json"
    if old_p.exists():
        old = load(old_p)
        ov = old.get("version", "")
        if ov.startswith(today):
            same = [f["sha256"] for f in old.get("files", [])] == [f["sha256"] for f in files]
            n = int(ov.split(".")[-1]) if ov.split(".")[-1].isdigit() else 0
            version = ov if same else f"{today}.{n + 1}"
    n_forms = sum(len(v) for v in idx_forms.values())
    manifest = {"version": version,
                "counts": {"entries": len(entries), "forms": n_forms, "verbs": len(conj),
                           "with_example": sum(1 for e in entries if e.get("ex"))},
                "source": "polished" if polished else "pivot",
                "files": files}
    dump(manifest, DATA / "manifest.json", pretty=True)
    total = sum(f["bytes"] for f in files) + (DATA / "manifest.json").stat().st_size
    print(f"modo: {mode}")
    print(f"entries.json: {len(entries)} entradas ({len(dropped)} excluidas por faltar zh/es/en)")
    print(f"index.json: {len(idx_forms)} formas distintas, {n_forms} pares forma->entrada; "
          f"zh {len(idx_zh)}, es {len(idx_es)}, en {len(idx_en)}")
    print(f"conj.json: {len(conj)} verbos; versión {version}; total {total / 1e6:.2f} MB")
    dump(dropped, OUT / "dropped.json")


if __name__ == "__main__":
    main()
