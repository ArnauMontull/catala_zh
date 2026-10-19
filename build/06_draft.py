"""6. Borrador de entradas + conjugaciones + formas, a partir del Wiktionary y del pivote.

Entrada:  build/out/{ca_entries.jsonl, freq.json, en_trans.jsonl, cedict.json}
Salida:   build/out/draft.json  (Entry[] del contrato; zh/es/pinyin pueden faltar)
          build/out/conj.json   (Record<entryId, Conj>)
          build/out/forms.json  (entryId -> [[forma, etiqueta], ...])

Pivote: glosa inglesa -> (a) tablas de traducción del Wiktionary inglés, triangulando la acepción
que también traduce al catalán este lema; (b) primera acepción de la palabra inglesa; (c) CC-CEDICT.
Uso: python -I build/06_draft.py [--max-entries 6000]
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import OUT, dump, load, progress, progress_end  # noqa: E402

from wordfreq import get_frequency_dict  # noqa: E402

MAX_ENTRIES = int(sys.argv[sys.argv.index("--max-entries") + 1]) if "--max-entries" in sys.argv else 6000
POS_ORDER = ["verb", "noun", "adj", "adv", "pron", "det", "prep", "conj", "intj", "num", "phrase"]
EN_POS = {"noun": "noun", "verb": "verb", "adj": "adj", "adv": "adv", "pron": "pron", "prep": "prep",
          "conj": "conj", "det": "det", "article": "det", "intj": "intj", "num": "num", "phrase": "phrase",
          "prep_phrase": "phrase"}
PERSONS = ["1s", "2s", "3s", "1p", "2p", "3p"]
SIMPLE = {("indicative", "present"): "ind.pres", ("indicative", "imperfect"): "ind.imperf",
          ("indicative", "preterite"): "ind.pret", ("indicative", "future"): "ind.fut",
          ("subjunctive", "present"): "subj.pres", ("subjunctive", "imperfect"): "subj.imperf"}
AUX = {
    "ind.perf": (["he", "has", "ha", "hem", "heu", "han"], "part"),
    "ind.plusq": (["havia", "havies", "havia", "havíem", "havíeu", "havien"], "part"),
    "ind.pret_perif": (["vaig", "vas", "va", "vam", "vau", "van"], "inf"),
    "ind.fut_perf": (["hauré", "hauràs", "haurà", "haurem", "haureu", "hauran"], "part"),
    "cond.perf": (["hauria", "hauries", "hauria", "hauríem", "hauríeu", "haurien"], "part"),
    "subj.perf": (["hagi", "hagis", "hagi", "hàgim", "hàgiu", "hagin"], "part"),
    "subj.plusq": (["hagués", "haguessis", "hagués", "haguéssim", "haguéssiu", "haguessin"], "part"),
}
TENSES = ["ind.pres", "ind.imperf", "ind.pret", "ind.fut", "cond.pres", "ind.perf", "ind.plusq",
          "ind.pret_perif", "ind.fut_perf", "cond.perf", "subj.pres", "subj.imperf", "subj.perf",
          "subj.plusq", "imp"]
NONSTD = {"Valencia", "Valencian", "Balearic", "Northern", "Northwestern", "Alguerese", "dialectal",
          "archaic", "obsolete", "rare", "nonstandard", "colloquial", "Mallorca", "Minorca", "Ibiza",
          "Roussillon", "Algherese", "uncommon", "proscribed", "misspelling", "negative", "alternative"}
CLITICS = ("em ", "et ", "es ", "ens ", "us ", "me'n ", "te'n ", "se'n ", "ens n'", "us n'",
           "m'", "t'", "s'", "-me", "-te", "-se")
ZH_FREQ = get_frequency_dict("zh")
ES_FREQ = get_frequency_dict("es")
JUNK_GLOSS = re.compile(r"(letter|name of the|musical note|note of the|solf|syllable|abbreviation|initialism|symbol)", re.I)


def words(s: str) -> set[str]:
    return {w for w in re.findall(r"[a-z]+", s.lower()) if w not in {"a", "an", "the", "to", "of", "or", "and"}}


# --------------------------------------------------------------------------- utilidades
def person_of(tags: set[str]) -> str | None:
    if "second-person-semantically" in tags:      # imperativo de cortesía (vostè / vostès)
        return "3p" if "plural" in tags else "3s"
    p = "1" if "first-person" in tags else "2" if "second-person" in tags else "3" if "third-person" in tags else None
    if p is None:
        return None
    if "plural" in tags:
        return p + "p"
    if "singular" in tags or "imperative" in tags:
        return p + "s"
    return None


def tense_of(tags: set[str]) -> str | None:
    if "imperative" in tags:
        return "imp"
    if "conditional" in tags:
        return "cond.pres"
    for (m, t), k in SIMPLE.items():
        if m in tags and t in tags:
            return k
    return None


def split_clitic(form: str) -> tuple[str, str]:
    """'em dutxo' -> ('em', 'dutxo');  "m'alegro" -> ("m'", 'alegro')."""
    for c in ("me'n ", "te'n ", "se'n ", "ens n'", "us n'", "em ", "et ", "es ", "ens ", "us ", "m'", "t'", "s'"):
        if form.startswith(c):
            return c.strip(), form[len(c):]
    return "", form


def attach(clitic: str, word: str) -> str:
    """Clítico reforzado/elidido delante de un auxiliar (he, havia, vaig…)."""
    if not clitic:
        return word
    base = {"m'": "em", "t'": "et", "s'": "es"}.get(clitic, clitic)
    vowel = word[:1].lower() in "aeiouàèéíòóúh"
    if base in ("em", "et", "es"):
        return (base[1] + "'" + word) if vowel else f"{base} {word}"
    if base in ("me'n", "te'n", "se'n"):
        return (base[:2] + " n'" + word) if vowel else f"{base} {word}"
    if base in ("ens n'", "us n'"):
        return (base + word) if vowel else f"{base[:-2]} en {word}"
    return f"{base} {word}"


def build_conj(lemma: str, forms: list[list[str]]):
    """forms de wiktextract -> (Conj del contrato, [[forma, etiqueta]] para el índice)."""
    table: dict[str, list[str]] = {t: [""] * 6 for t in TENSES}
    np_ = ["", "", "", "", "", ""]
    index: list[tuple[str, str]] = []
    for f in forms:
        form, tags = f[0], set(f[1:])
        if form.startswith("no "):
            continue
        std = not (tags & NONSTD)
        if "infinitive" in tags:
            if std and not np_[0]:
                np_[0] = form
            index.append((form, "lemma"))
            continue
        if "gerund" in tags:
            if std and not np_[1]:
                np_[1] = form
            index.append((form, "np.ger"))
            continue
        if "participle" in tags:
            slot = 2 + (1 if "feminine" in tags else 0) + (2 if "plural" in tags else 0)
            if std and not np_[slot]:
                np_[slot] = form
            index.append((form, "np.part"))
            continue
        t, p = tense_of(tags), person_of(tags)
        if t is None or p is None:
            continue
        i = PERSONS.index(p)
        if std and not table[t][i]:
            table[t][i] = form
        index.append((form, f"{t}.{p}"))
    if not np_[0]:
        np_[0] = lemma
    table["imp"][0] = ""
    # tiempos compuestos y perifrásticos: haver + participio / anar + infinitivo
    part, inf = np_[2], np_[0]
    inf_bare = re.sub(r"(-se|-se'n|'s|-s'hi|-ne|'n)$", "", inf)
    for t, (aux, kind) in AUX.items():
        if not table[t][0]:
            for i in range(6):
                pres = table["ind.pres"][i]
                cl, _ = split_clitic(pres)
                tail = part if kind == "part" else inf_bare
                if not tail:
                    continue
                table[t][i] = attach(cl, f"{aux[i]} {tail}")
    conj = {t: v for t, v in table.items() if any(v)}
    conj["np"] = np_
    return conj, index


def en_items(glosses: list[str], pos: str) -> list[str]:
    out: list[str] = []
    for g in glosses:
        parts = [p.strip() for p in re.split(r"[;,]", g) if p.strip()]
        for k, p in enumerate(parts):
            if pos == "verb" and k > 0 and not p.startswith("to ") and parts[0].startswith("to "):
                p = "to " + p
            if len(p) > 45 or p.lower().startswith(("used ", "indicates ", "expresses ", "denotes ")):
                continue
            if p not in out:
                out.append(p)
    if not out and glosses:
        out = [glosses[0][:60]]
    return out[:3]


def en_key(s: str) -> str:
    s = re.sub(r"\([^)]*\)", "", s.lower()).strip()
    s = re.sub(r"^(to|a|an|the) ", "", s)
    return re.sub(r"\s+", " ", s).strip(" .,;!?")


# --------------------------------------------------------------------------- pivote
class Pivot:
    def __init__(self) -> None:
        ced = load(OUT / "cedict.json")
        self.simp, self.alt, self.t2s, self.rev = ced["simp"], ced["alt"], ced["t2s"], ced["rev"]
        self.by_ca: dict[str, list[dict]] = {}
        self.by_en: dict[tuple[str, str], list[dict]] = {}
        with open(OUT / "en_trans.jsonl", encoding="utf-8") as f:
            for line in f:
                r = json.loads(line)
                r["pos"] = EN_POS.get(r.get("pos"), r.get("pos"))
                self.by_en.setdefault((r["w"].lower(), r["pos"]), []).append(r)
                for c in r["ca"]:
                    self.by_ca.setdefault(c, []).append(r)

    def to_simp(self, w: str) -> str:
        if w in self.simp:
            return w
        if w in self.t2s:
            return self.t2s[w]
        return "".join(self.t2s.get(ch, ch) for ch in w)

    def pinyin(self, w: str, roman: str = "") -> str:
        if w in self.simp:
            if roman and w in self.alt:
                key = roman.replace(" ", "").lower()
                for p in self.alt[w]:
                    if p.replace(" ", "").lower() == key:
                        return p.lower()
            return self.simp[w].lower()
        # segmentación voraz con CC-CEDICT
        out, i = [], 0
        while i < len(w):
            for j in range(len(w), i, -1):
                if w[i:j] in self.simp:
                    out.append(self.simp[w[i:j]].lower())
                    i = j
                    break
            else:
                return roman
        return " ".join(out)

    def zh_ok(self, w: str) -> bool:
        return bool(w) and all("㐀" <= ch <= "鿿" for ch in w) and len(w) <= 6

    def valid_zh(self, zh: list) -> list:
        return [z for z in zh if self.zh_ok(self.to_simp(z[0].strip()))]

    def lookup(self, lemma: str, pos: str, ens: list[str]) -> tuple[list, list, str]:
        """-> (zh [[simp, roman]], es [str], fuente)"""
        keys = [en_key(e) for e in ens]
        # (a) triangulación: acepciones inglesas que traducen al catalán este mismo lema
        cands = [r for r in self.by_ca.get(lemma, []) if r["pos"] == pos]
        if cands:
            def score(r):
                k = r["w"].lower()
                s = 0
                if k in keys:
                    s += 10 - keys.index(k) * 2
                if any(k in en_key(r["sense"]) or en_key(r["sense"]) in keys for k in keys):
                    s += 1
                return -s
            cands.sort(key=score)
        zh, es, src = [], [], []
        if cands and score(cands[0]) < 0:
            zh = self.valid_zh([z for r in cands[:3] for z in r["zh"]])
            es = [e for r in cands[:3] for e in r["es"]]
            if zh or es:
                src.append("wikt-tri")
        # (b) acepción de la palabra inglesa (misma categoría; si no hay, cualquiera): solo rellena lo que falte
        if not zh or not es:
            allw = set().union(*(words(e) for e in ens)) if ens else set()
            bz, be = [], []
            for k in keys[:2]:
                rs = [r for p in dict.fromkeys([pos, *EN_POS.values(), "name"])
                      for r in self.by_en.get((k, p), [])]
                if not rs:
                    continue
                # misma categoría gramatical primero; luego la acepción que más se parece al resto de glosas
                rs.sort(key=lambda r: (r["pos"] != pos, -len(words(r["sense"]) & (allw - {k})),
                                       not (r["zh"] and r["es"])))
                z1 = next((r["zh"] for r in rs if self.valid_zh(r["zh"])), [])
                e1 = next((r["es"] for r in rs if r["es"]), [])
                bz += self.valid_zh(z1)[:2]
                be += e1[:2]
            if (not zh and bz) or (not es and be):
                src.append("wikt-en")
            zh = zh or bz
            es = es or be
        # (c) CC-CEDICT por la glosa inglesa
        if not zh:
            for k in keys[:2]:
                best = sorted(self.rev.get(k, []), key=lambda c: -(ZH_FREQ.get(c[0], 1e-9) / (1 + c[1]) / (1 + 0.2 * c[2])))
                zh += [[c[0], ""] for c in best[:2]]
            if zh:
                src.append("cedict")
        return zh, es, "+".join(src)

    def finalize(self, zh: list, es: list):
        zs, ps = [], []
        for w, roman in zh:
            w = self.to_simp(w.strip())
            if not self.zh_ok(w) or w in zs:
                continue
            p = self.pinyin(w, roman)
            if not p:
                continue
            zs.append(w)
            ps.append(p)
            if len(zs) == 3:
                break
        e2 = []
        for e in es:
            e = re.sub(r"\s*\([^)]*\)", "", e).strip()
            if e and e not in e2 and len(e) <= 40 and (len(e.split()) <= 3 or not e2):
                e2.append(e)

        def es_freq(x: str) -> float:
            return min((ES_FREQ.get(t, 0) for t in x.lower().split()), default=0)
        first = e2[0] if e2 else None
        e2 = [x for x in e2 if es_freq(x) >= 1e-7 or x == first]   # fuera jerga y rarezas
        e2.sort(key=lambda x: -(es_freq(x) * (3 if x == first else 1)))
        return zs, ps, e2[:3]


# --------------------------------------------------------------------------- main
def main() -> None:
    recs: dict[str, dict[str, dict]] = {}
    with open(OUT / "ca_entries.jsonl", encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            d = recs.setdefault(r["w"], {})
            if r["pos"] in d:                       # misma palabra y categoría: fusionar
                old = d[r["pos"]]
                old["glosses"] += [g for g in r["glosses"] if g not in old["glosses"]]
                for k in ("gender", "fem", "plural", "fpl", "conj", "base"):
                    if k in r and k not in old:
                        old[k] = r[k]
                if not old.get("forms") and r.get("forms"):
                    old["forms"] = r["forms"]
            else:
                d[r["pos"]] = r
    freq = load(OUT / "freq.json")
    pv = Pivot()

    entries, conj, forms_out = [], {}, {}
    stats = {"wikt-tri": 0, "wikt-en": 0, "cedict": 0, "wikt-en+cedict": 0, "": 0}
    for n, (lemma, rank) in enumerate(freq):
        progress(n, len(freq), "borrador de entradas (pivote)")
        if len(entries) >= MAX_ENTRIES:
            break
        by_pos = recs.get(lemma, {})
        cands = []
        for r in by_pos.values():
            gl = [g for g in r["glosses"] if not JUNK_GLOSS.search(g) and g.lower() != lemma.lower()]
            if gl or r.get("base"):
                cands.append({**r, "glosses": gl})
        cands.sort(key=lambda r: (-len(r["glosses"]), POS_ORDER.index(r["pos"])))
        for k, r in enumerate(cands[:2]):
            if len(entries) >= MAX_ENTRIES:
                break
            eid = lemma if k == 0 else f"{lemma}#{k + 1}"
            glosses = r["glosses"]
            if not glosses and r.get("base") in recs and "verb" in recs[r["base"]]:
                glosses = recs[r["base"]]["verb"]["glosses"]
            en = en_items(glosses, r["pos"])
            if not en:
                continue
            zh, es, src = pv.lookup(lemma, r["pos"], en)
            stats[src] = stats.get(src, 0) + 1
            zs, ps, es2 = pv.finalize(zh, es)
            e = {"id": eid, "ca": lemma, "pos": r["pos"]}
            if r["pos"] in ("noun", "adj") and r.get("gender"):
                e["gender"] = r["gender"]
            if r.get("fem"):
                e["fem"] = r["fem"]
            if r.get("plural"):
                e["plural"] = r["plural"]
            e.update({"zh": zs, "pinyin": ps, "en": en, "es": es2, "freq": rank})
            idx: list[tuple[str, str]] = [(lemma, "lemma")]
            if r["pos"] == "verb":
                e["verb"] = {"conj": r.get("conj") or "irregular"}
                if r.get("pronominal"):
                    e["verb"]["pronominal"] = True
                if r.get("forms"):
                    c, fi = build_conj(lemma, r["forms"])
                    conj[eid] = c
                    idx += fi
                    # sin clítico, para que «dutxo» encuentre «dutxar-se»
                    idx += [(split_clitic(f)[1], t) for f, t in fi if split_clitic(f)[0]]
            else:
                for key, tag in (("plural", "pl"), ("fem", "f"), ("fpl", "f.pl")):
                    if r.get(key):
                        idx.append((r[key], tag))
            seen, uniq = set(), []
            for f_, t in idx:
                if (f_, t) not in seen:
                    seen.add((f_, t))
                    uniq.append([f_, t])
            forms_out[eid] = uniq
            entries.append(e)
    progress_end()
    dump(entries, OUT / "draft.json")
    dump(conj, OUT / "conj.json")
    dump(forms_out, OUT / "forms.json")
    full = sum(1 for e in entries if e["zh"] and e["es"] and e["en"])
    print(f"draft.json: {len(entries)} entradas ({full} con zh+es+en); verbos con tabla: {len(conj)}")
    print("fuente del pivote:", stats)


if __name__ == "__main__":
    main()
