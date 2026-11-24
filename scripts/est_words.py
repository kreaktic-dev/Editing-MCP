# Estimated word timings (words.json) from SCRIPT.md at ~3.7 words/s, used until the real voice-over arrives.
# Replace src/videos/pisa/words.json with real timings (scripts/align_words.py) and everything re-times itself.
import json, re
txt = open("SCRIPT.md", encoding="utf-8").read().split("## Voice-over")[1].split("\n", 2)[2]
lines = [l.strip() for l in txt.splitlines() if l.strip()]
t, out = 0.12, []
for l in lines:
    ws = l.split()
    for i, w in enumerate(ws):
        clean = re.sub(r"[^\w'-]", "", w)
        syl = max(1, len(re.findall(r"[aeiouy]+", clean.lower())))
        d = 0.16 + 0.085 * syl
        out.append({"w": clean, "s": round(t, 3), "e": round(t + d, 3)})
        t += d + (0.12 if w[-1] in ",." else 0.0) + (0.1 if w[-1] in ".?" else 0)
    t += 0.08
k = 59.5 / t
for o in out: o["s"] = round(o["s"] * k, 3); o["e"] = round(o["e"] * k, 3)
t *= k
json.dump(out, open("src/videos/pisa/words.json", "w"), indent=0)
print(len(out), "words, ends", round(t, 2), "s")
