"""Herramienta de inspección: imprime entradas de kaikki para unas palabras (streaming).
Uso: python -I build/tools_peek.py <jsonl> palabra [palabra...]"""
import json
import sys
sys.stdout.reconfigure(encoding="utf-8")

path, words = sys.argv[1], set(sys.argv[2:])
with open(path, encoding="utf-8") as f:
    for line in f:
        o = json.loads(line)
        if o.get("word") in words:
            o2 = dict(o)
            forms = o2.pop("forms", [])
            o2.pop("sounds", None)
            o2.pop("etymology_text", None)
            o2.pop("etymology_templates", None)
            o2.pop("descendants", None)
            print(json.dumps(o2, ensure_ascii=False)[:2500])
            print("FORMS", len(forms))
            for fm in forms[:80]:
                print("  ", fm.get("form"), fm.get("tags"), fm.get("source", ""))
            print("-----")
