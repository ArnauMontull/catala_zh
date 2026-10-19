"""Tests de los datos generados (app/public/data). Ejecuta: .venv/Scripts/python.exe -m pytest catala_zh/build/tests"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import pytest

BUILD = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BUILD))
from common import DATA, OUT, norm  # noqa: E402
from schema import FORM_TAGS, TENSES, Entry  # noqa: E402

POLISHED = (OUT / "polished.json").exists() and json.loads((DATA / "manifest.json").read_text("utf-8"))["source"] == "polished"


def _load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def entries():
    return _load("entries.json")


@pytest.fixture(scope="session")
def by_id(entries):
    return {e["id"]: e for e in entries}


@pytest.fixture(scope="session")
def index():
    return _load("index.json")


@pytest.fixture(scope="session")
def conj():
    return _load("conj.json")


def test_norm():
    assert norm("Col·legi") == "collegi"
    assert norm("què") == "que"
    assert norm("  L.L  ESPAI   gran ") == "ll espai gran"


def test_tinc_is_tenir(index):
    assert ["tenir", "ind.pres.1s"] in index["forms"]["tinc"]


def test_menjo_is_menjar(index):
    assert any(eid == "menjar" for eid, _ in index["forms"]["menjo"])


def test_lemma_in_forms(index, entries):
    for e in entries[:500]:
        assert [e["id"], "lemma"] in index["forms"][norm(e["ca"])]


def test_nen_is_masculine_noun(by_id):
    assert by_id["nen"]["pos"] == "noun"
    assert by_id["nen"]["gender"] == "m"
    assert by_id["nen"].get("fem") == "nena"


@pytest.mark.xfail(not POLISHED, strict=False,
                   reason="Sin pulido de Haiku el pivote (glosa inglesa -> zh) no garantiza que 你好 apunte a «hola»")
def test_nihao_is_hola(index, by_id):
    assert any(by_id[i]["ca"] == "hola" for i in index["zh"]["你好"])


def test_entries_validate(entries):
    ids = set()
    for e in entries:
        Entry.model_validate(e)
        assert e["id"] not in ids
        ids.add(e["id"])
        assert all(not any("一" <= c <= "鿿" for c in p) for p in e["pinyin"])
    assert len(entries) >= 4500


def test_index_shape(index, by_id):
    assert set(index) == {"forms", "zh", "es", "en"}
    for k, lst in index["forms"].items():
        assert norm(k) == k
        for eid, tag in lst:
            assert eid in by_id
            assert tag in FORM_TAGS, tag
    for key in ("zh", "es", "en"):
        for k, lst in index[key].items():
            assert lst and all(i in by_id for i in lst)
            if key != "zh":
                assert norm(k) == k


def test_conj_keys(conj, by_id):
    allowed = set(TENSES) | {"np"}
    assert len(conj) > 300
    for eid, c in conj.items():
        assert by_id[eid]["pos"] == "verb"
        assert set(c) <= allowed, set(c) - allowed
        assert len(c["np"]) == 6 and c["np"][0]
        assert "ind.pres" in c
        for t, v in c.items():
            assert len(v) == 6, (eid, t)
        if "imp" in c:
            assert c["imp"][0] == ""


def test_conj_tenir_full(conj):
    c = conj["tenir"]
    assert set(c) == set(TENSES) | {"np"}
    assert c["ind.pres"] == ["tinc", "tens", "té", "tenim", "teniu", "tenen"]
    assert c["ind.perf"][0] == "he tingut"
    assert c["ind.pret_perif"][3] == "vam tenir"
    assert c["subj.plusq"][5] == "haguessin tingut"
    assert c["np"] == ["tenir", "tenint", "tingut", "tinguda", "tinguts", "tingudes"]


def test_febles():
    f = _load("febles.json")
    ids = set()
    for s in f["sections"]:
        assert {"id", "title_en", "title_zh", "body_en", "body_zh", "examples"} <= set(s)
        assert s["id"] not in ids
        ids.add(s["id"])
        assert 3 <= len(s["examples"]) <= 5
        for ex in s["examples"]:
            assert set(ex) == {"ca", "zh", "en"}
        if "table" in s:
            assert all(len(r) == len(s["table"]["head"]) for r in s["table"]["rows"])


def test_manifest_and_size():
    m = _load("manifest.json")
    assert m["version"] and m["counts"]["entries"] == len(_load("entries.json"))
    total = 0
    for f in m["files"]:
        p = DATA / f["name"]
        data = p.read_bytes()
        assert len(data) == f["bytes"]
        assert hashlib.sha256(data).hexdigest() == f["sha256"]
        total += len(data)
    assert {f["name"] for f in m["files"]} >= {"entries.json", "index.json", "conj.json", "febles.json"}
    assert sum(p.stat().st_size for p in DATA.iterdir() if p.is_file()) < 15 * 1024 * 1024


def test_apply_polish_unit():
    import merge
    draft = {"id": "nen", "ca": "nen", "pos": "noun", "gender": "m", "fem": "nena", "plural": "nens",
             "zh": ["男仆"], "pinyin": ["nán pú"], "en": ["boy"], "es": [], "freq": 252}
    pol = {"id": "nen", "ca": "nen", "pos": "noun", "gender": "m", "fem": "nena", "plural": "nens",
           "zh": ["男孩", "小孩", "孩子", "儿童"], "pinyin": ["nan2 hai2"], "en": ["boy", "child"],
           "es": ["niño"], "ex": {"ca": "El nen juga al parc.", "zh": "男孩在公园玩。", "en": "The boy plays in the park."},
           "verb": None}
    e = merge.apply_polish(draft, pol, {"男孩": "nán hái", "小孩": "xiǎo hái", "孩子": "hái zi"})
    assert e["zh"] == ["男孩", "小孩", "孩子"] and e["pinyin"] == ["nán hái", "xiǎo hái", "hái zi"]
    assert e["es"] == ["niño"] and e["ex"]["zh"] == "男孩在公园玩。" and "verb" not in e
    Entry.model_validate(e)


def test_polish_requests_shape():
    import polish_batch
    reqs, mapping = polish_batch.requests_from_draft()
    assert len(reqs) == len(mapping) and all(len(v) <= polish_batch.GROUP for v in mapping.values())
    p = reqs[0]["params"]
    assert p["model"] == "claude-haiku-5-5"
    assert p["output_config"]["effort"] == "low" and p["output_config"]["format"]["type"] == "json_schema"
    assert p["system"][0]["cache_control"] == {"type": "ephemeral"}
    est = polish_batch.estimate(reqs)
    assert 0 < est["usd_batch"] < 2
