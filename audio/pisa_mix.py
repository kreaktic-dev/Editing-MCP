# Final mix: voice + music + SFX, music ducked under the words, true-peak limited, -14 LUFS integrated (Shorts).
# Skill's standard mix: music +3 dB, SFX -6 dB relative to the bed balance, voice unchanged (it sets the reference).
# usage: python audio/pisa_mix.py [voice.wav]     (no voice: a music+SFX preview at -18 LUFS)
#        python audio/pisa_mix.py voice.wav --mux out/pisa/video_1.mp4 out/pisa/final.mp4
import json, os, subprocess, sys
import numpy as np
from dsp import SR, ns, dbg, integrated, lp, true_peak

ROOT = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(ROOT, "..", "out", "pisa", "audio")


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).T.astype(np.float64)


def write(path, x):
    import wave
    x = np.clip(x, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x.T * 32767).astype("<i2").tobytes())


def duck_curve(n, spans, depth_db=-7.0, att=0.06, rel=0.35):
    g = np.zeros(n)
    for a, b in spans:
        g[max(0, ns(a - 0.06)): ns(b + 0.1)] = 1
    # smooth attack/release (one-pole both ways)
    out, y = np.zeros(n), 0.0
    ka, kr = 1 - np.exp(-1 / (att * SR)), 1 - np.exp(-1 / (rel * SR))
    for i in range(0, n, 64):
        tgt = g[i]
        y += (ka if tgt > y else kr) * 64 * (tgt - y) if abs(tgt - y) > 1e-4 else 0
        y = min(1, max(0, y))
        out[i:i + 64] = y
    return dbg(depth_db * out)


def limiter(x, ceil_db=-1.0):
    c = dbg(ceil_db)
    peak = np.max(np.abs(x), axis=0)
    w = ns(0.004)
    nb = -(-len(peak) // w)
    pb = np.pad(peak, (0, nb * w - len(peak))).reshape(nb, w).max(1)
    pb = np.maximum(pb, np.maximum(np.roll(pb, 1), np.roll(pb, -1)))
    env = np.repeat(pb, w)[: len(peak)]
    g = np.minimum(1, c / np.maximum(env, 1e-9))
    g = np.convolve(g, np.ones(w) / w, "same")
    return x * g[None, :]


def main():
    args = sys.argv[1:]
    mux = None
    if "--mux" in args:
        i = args.index("--mux"); mux = args[i + 1:i + 3]; args = args[:i]
    m, s = load(os.path.join(A, "music.wav")), load(os.path.join(A, "sfx.wav"))
    n = m.shape[1]
    m *= dbg(3.0); s *= dbg(-6.0) * dbg(6.0)  # skill mix: music +3, sfx -6 (stems were built 6 dB hot)
    if args:
        v = load(args[0])
        v = v[:, :n] if v.shape[1] >= n else np.pad(v, ((0, 0), (0, n - v.shape[1])))
        v *= dbg(-16.0 - integrated(v))  # voice reference
        words = json.load(open(os.path.join(ROOT, "..", "src", "videos", "pisa", "words.json")))
        spans, cur = [], None
        for w in words:
            if cur and w["s"] - cur[1] < 0.3: cur[1] = w["e"]
            else:
                if cur: spans.append(tuple(cur))
                cur = [w["s"], w["e"]]
        spans.append(tuple(cur))
        mix = v + m * duck_curve(n, spans)[None, :] + s
        target = -14.0
    else:
        mix = m + s
        target = -18.0
    mix *= dbg(target - integrated(mix))
    mix = limiter(mix, -1.0)
    out = os.path.join(A, "mix.wav" if args else "preview_mix.wav")
    write(out, mix)
    print(out, "integrated %.1f LUFS, true peak %.1f dBTP" % (integrated(mix), true_peak(mix)))
    if mux:
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", mux[0], "-i", out, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
                        "-shortest", mux[1]], check=True)
        print("muxed ->", mux[1])


if __name__ == "__main__":
    main()
