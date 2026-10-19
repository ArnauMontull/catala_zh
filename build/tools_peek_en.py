"""Inspección: primeras entradas inglesas con traducciones ca (gz, streaming).
Uso: python -I build/tools_peek_en.py <jsonl.gz> palabra [palabra...]"""
import gzip
import json
import sys
sys.stdout.reconfigure(encoding="utf-8")

path, words = sys.argv[1], set(sys.argv[2:])
found = 0
with gzip.open(path, "rt", encoding="utf-8") as f:
    for i, line in enumerate(f):
        if not any(f'"word": "{w}"' in line for w in words):
            continue
        o = json.loads(line)
        if o.get("word") not in words:
            continue
        tr = o.get("translations", [])
        for s in o.get("senses", []):
            tr += s.get("translations", [])
        print(o["word"], o.get("pos"), "ntr", len(tr), "top-level keys", sorted(o.keys()))
        for t in tr:
            if t.get("code") in ("ca", "cmn", "es", "zh") or t.get("lang_code") in ("ca", "cmn", "es", "zh"):
                print("  ", json.dumps(t, ensure_ascii=False))
        found += 1
        if found >= 3:
            break
