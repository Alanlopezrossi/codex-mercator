"""Machine translation (English -> Spanish) of the wiki texts that have no Spanish version.

Run by the "Translate wiki" GitHub workflow after a build (which writes .cache/wiki-untranslated.json and
.cache/glossary.json). Game names (items, maps, achievements, NPCs) are swapped for placeholders before
translating and put back with their official Spanish name, so "Dragon's Stand" becomes "Defensa del Dragón"
and not a literal translation. Output: data/wiki-es.json ({"t": {english: spanish}}), merged with the old one.
Model: Helsinki-NLP/opus-mt-en-es (free, runs on the CPU). Env: LIMIT (test run), BATCH.
"""
import json, os, re, sys, time
from transformers import MarianMTModel, MarianTokenizer

LIMIT = int(os.environ.get("LIMIT") or 0)
BATCH = int(os.environ.get("BATCH") or 24)
OUT = "data/wiki-es.json"

todo = json.load(open(".cache/wiki-untranslated.json"))
gloss = json.load(open(".cache/glossary.json"))
old = json.load(open(OUT))["t"] if os.path.exists(OUT) else {}
todo = [t for t in todo if t not in old and re.search(r"[A-Za-z]{2}", t)]
if LIMIT:
    step = max(1, len(todo) // LIMIT)
    todo = todo[::step][:LIMIT]
print(f"[tr] {len(todo)} texts to translate, glossary {len(gloss)} names", flush=True)

MAXW = 8
def protect(text):
    """Longest game names first, whole words only. Returns (text with placeholders, [spanish names])."""
    words = list(re.finditer(r"[^\s]+", text))
    names, out, i, last = [], [], 0, 0
    while i < len(words):
        hit = None
        for n in range(min(MAXW, len(words) - i), 0, -1):
            a, b = words[i].start(), words[i + n - 1].end()
            cand = text[a:b]
            core = cand.rstrip(".,;:!?)").lstrip("(\"'")
            # a single capitalized word that starts a sentence is usually not a name ("Found in...")
            if n == 1 and i == 0 and len(words) > 1:
                continue
            if len(core) >= 4 and core in gloss and core[0].isupper():
                s = a + cand.index(core)
                hit = (s, s + len(core), gloss[core], n)
                break
        if hit:
            out.append(text[last:hit[0]]); out.append(f"ZQX{len(names)}"); names.append(hit[2]); last = hit[1]; i += hit[3]
        else:
            i += 1
    out.append(text[last:])
    return "".join(out), names

def restore(text, names):
    for k, es in enumerate(names):
        pat = re.compile(rf"Z\s*Q\s*X\s*{k}(?!\d)", re.I)
        if not pat.search(text):
            return None
        text = pat.sub(lambda _m: es, text, count=1)
    if re.search(r"ZQX\d", text, re.I):
        return None
    return text

tok = MarianTokenizer.from_pretrained("Helsinki-NLP/opus-mt-en-es")
model = MarianMTModel.from_pretrained("Helsinki-NLP/opus-mt-en-es")
model.eval()

def translate(batch):
    enc = tok(batch, return_tensors="pt", padding=True, truncation=True, max_length=256)
    gen = model.generate(**enc, num_beams=3, max_new_tokens=300)
    return tok.batch_decode(gen, skip_special_tokens=True)

# GW2 terms the general-purpose model gets wrong (applied after translating).
FIX = [
    (r"\b[Mm]isi[oó]n(es)? de huelga\b", lambda m: f"{m.group(0)[0]}isi{'ones' if m.group(1) else 'ón'} de ataque"),
    (r"\bFragua M[ií]stica\b", "Forja Mística"),
    (r"\b(?:Dejad[oa]s? caer|Derribad[oa]s?|Ca[ií]d[oa]s?) (?:por|de)\b", "Lo suelta"),
    (r"^Ca[ií]das? de\b", "Lo sueltan"),
    (r"\bOportunidad de caer de\b", "Probabilidad de que lo suelten"),
    (r"\b[Pp]echo(s)?\b", lambda m: "cofre" + ("s" if m.group(1) else "")),
    (r"\bart[ií]culo(s)?\b", lambda m: "objeto" + ("s" if m.group(1) else "")),
    (r"\bmontajes?\b", "monturas"),
    (r"\[Evento del Grupo\]", "[Evento de grupo]"),
    (r"\bevento del grupo\b", "evento de grupo"),
    (r"\bse reúne desde\b", "se recolecta de"),
    (r"\bnodo de Recursos\b", "nodo de recursos"),
    (r"\bjefe del mundo\b", "jefe de mundo"),
]
def fix(t):
    for pat, rep in FIX:
        t = re.sub(pat, rep, t)
    return t[:1].upper() + t[1:] if t else t

res, fails, t0 = {}, 0, time.time()
prot = [protect(t) for t in todo]
for i in range(0, len(todo), BATCH):
    chunk = prot[i:i + BATCH]
    outs = translate([p for p, _ in chunk])
    for (src, (p, names), o) in zip(todo[i:i + BATCH], chunk, outs):
        r = restore(o, names)
        if r is None and names:  # placeholders lost: try once without protecting the names
            r = translate([src])[0]
        if r and r.strip() and r.strip() != src:
            res[src] = fix(r.strip())
        else:
            fails += 1
    if (i // BATCH) % 20 == 0:
        print(f"[tr] {i + len(chunk)}/{len(todo)} ({int(time.time() - t0)} s)", flush=True)

if LIMIT:
    for k, v in list(res.items())[:LIMIT]:
        print(f"EN: {k}\nES: {v}\n")
    print(f"[tr] test run: {len(res)} ok, {fails} failed")
    sys.exit(0)
merged = {**old, **res}
json.dump({"source": "Guild Wars 2 Wiki (GFDL 1.2), machine-translated with Helsinki-NLP/opus-mt-en-es; game names kept official", "t": dict(sorted(merged.items()))}, open(OUT, "w"), ensure_ascii=False, indent=0)
print(f"[tr] done: {len(res)} new, {fails} failed, {len(merged)} total, {int(time.time() - t0)} s")
