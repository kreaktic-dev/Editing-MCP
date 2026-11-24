# Word timings (src/videos/pisa/words.json) from the real voice-over, without a speech-recognition model:
# the script text is known (SCRIPT.md), so we find the pauses in the recording, fit the sentence boundaries to the
# best pauses (dynamic programming: long pauses, sentence lengths proportional to their syllables), and spread each
# sentence's words over its voiced time by syllable count, snapping word starts to energy onsets nearby.
# usage: python scripts/align_words.py voice.wav [--offset 0.0]
#   (or, if you have word timestamps from any STT tool as JSON [{w, s, e}], just copy them to src/videos/pisa/words.json)
import json, re, subprocess, sys
import numpy as np

wav = sys.argv[1]
off = float(sys.argv[sys.argv.index("--offset") + 1]) if "--offset" in sys.argv else 0.0
SR = 16000
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", wav, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"], capture_output=True).stdout
x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
hop = 160  # 10 ms
env = np.sqrt(np.convolve(x ** 2, np.ones(400) / 400, "same")[::hop] + 1e-10)
db = 20 * np.log10(env)
floor, peak = np.percentile(db, 10), np.percentile(db, 95)
voiced = db > floor + 0.35 * (peak - floor)
T = len(voiced) * hop / SR
idx = np.where(voiced)[0]
t_on, t_off = idx[0] * hop / SR, (idx[-1] + 1) * hop / SR
# pauses: unvoiced runs >= 80 ms inside the speech
gaps, i = [], idx[0]
while i < idx[-1]:
    if not voiced[i]:
        j = i
        while j < len(voiced) and not voiced[j]:
            j += 1
        if (j - i) * hop / SR >= 0.08:
            gaps.append((i * hop / SR, j * hop / SR))
        i = j
    else:
        i += 1

txt = open("SCRIPT.md", encoding="utf-8").read().split("## Voice-over")[1].split("\n", 2)[2]
lines = [l.strip() for l in txt.splitlines() if l.strip()]
sents = [s.strip() for l in lines for s in re.split(r"(?<=[.?!])\s+", l) if s.strip()]
syl = lambda w: max(1, len(re.findall(r"[aeiouy]+", re.sub(r"[^a-z]", "", w.lower()))))
words = [[re.sub(r"[^\w'-]", "", w) for w in s.split()] for s in sents]
W = np.array([sum(syl(w) for w in ws) for ws in words], float)
n, m = len(sents), len(gaps)
rate = W.sum() / ((t_off - t_on) - 0.25 * (n - 1))  # syllables per second of speech

# DP: choose gap g[k] after sentence k (k = 0..n-2), increasing
NEG = -1e18
best = np.full((n, m + 1), NEG); arg = np.zeros((n, m + 1), int)
def score_sent(k, a, b):
    exp = W[k] / rate
    return -3.0 * ((b - a) / exp - 1) ** 2
G = [(t_on, t_on)] + gaps  # index 0 = virtual start
for j in range(1, m + 1):
    best[0, j] = score_sent(0, t_on, G[j][0]) + np.log(G[j][1] - G[j][0] + 1e-3)
for k in range(1, n - 1):
    for j in range(k + 1, m + 1):
        for i in range(k, j):
            if best[k - 1, i] <= NEG / 2: continue
            v = best[k - 1, i] + score_sent(k, G[i][1], G[j][0]) + np.log(G[j][1] - G[j][0] + 1e-3)
            if v > best[k, j]: best[k, j], arg[k, j] = v, i
jl = max(range(1, m + 1), key=lambda j: best[n - 2, j] + score_sent(n - 1, G[j][1], t_off))
cuts = [jl]
for k in range(n - 2, 0, -1):
    cuts.append(arg[k, cuts[-1]])
cuts = cuts[::-1]
bounds = [(t_on if k == 0 else G[cuts[k - 1]][1], G[cuts[k]][0] if k < n - 1 else t_off) for k in range(n)]

# onsets (energy rises) for snapping
d = np.diff(db, prepend=db[0])
onsets = [k * hop / SR for k in range(1, len(db)) if voiced[k] and (not voiced[k - 1] or d[k] > 4)]
out = []
for (a, b), ws in zip(bounds, words):
    sy = np.array([syl(w) for w in ws], float)
    c = np.concatenate([[0], np.cumsum(sy)]) / sy.sum()
    starts = a + c[:-1] * (b - a)
    for k, (w, s) in enumerate(zip(ws, starts)):
        near = [o for o in onsets if abs(o - s) < 0.07 and a - 0.01 <= o < b]
        s2 = min(near, key=lambda o: abs(o - s)) if near and k > 0 else s
        e = a + c[k + 1] * (b - a)
        out.append({"w": w, "s": round(s2 + off, 3), "e": round(e + off, 3)})
for k in range(1, len(out)):  # keep monotonic
    out[k]["s"] = max(out[k]["s"], out[k - 1]["s"] + 0.05)
json.dump(out, open("src/videos/pisa/words.json", "w"), indent=0)
print(f"{len(out)} words, {n} sentences, speech {t_on:.2f}-{t_off:.2f} s of {T:.2f} s; sentence starts:",
      ", ".join(f"{b[0]:.2f}" for b in bounds))
