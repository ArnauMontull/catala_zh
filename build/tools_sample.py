"""Inspección: muestra entradas de un JSON de Entry[] (ids concretos o N al azar con semilla).
Uso: python -I build/tools_sample.py <entries.json> [--random N --seed S] [id ...]"""
import json
import random
import sys
sys.stdout.reconfigure(encoding="utf-8")

path = sys.argv[1]
args = sys.argv[2:]
data = json.load(open(path, encoding="utf-8"))
by_id = {e["id"]: e for e in data}
if "--random" in args:
    n = int(args[args.index("--random") + 1])
    seed = int(args[args.index("--seed") + 1]) if "--seed" in args else 0
    pick = random.Random(seed).sample(data, n)
else:
    pick = [by_id[i] for i in args if i in by_id]
for e in pick:
    print(f'{e["id"]:<16} {e["pos"]:<5} {e.get("gender",""):<2} f{e["freq"]:<5} zh={e["zh"]} py={e["pinyin"]} '
          f'es={e["es"]} en={e["en"]}' + (f' ex={e["ex"]}' if e.get("ex") else ""))
