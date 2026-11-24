# Sound for "The Tower That Refused to Stand Up": an original light Tuscan tarantella (6/8, G major: mandolin tremolo,
# accordion pad, tuba oom-pah, tambourine, glockenspiel) cut to the picture's word anchors, plus synthesized SFX.
# Reads out/pisa/timeline.json (npx tsx scripts/anchors.ts). Writes out/pisa/audio/{music,sfx,bed}.wav.
# The voice-over is mixed later by pisa_mix.py (music ducked under the words, -14 LUFS).
import json, os, sys
import numpy as np
from dsp import SR, ns, rng, pan, place, fades, dbg, make_ir, convolve_st, integrated, lp, hp, bp, colored, smooth_noise, momentary_max
import instruments as I
import sfx_gen as G
import wave

ROOT = os.path.dirname(os.path.abspath(__file__))
TL = json.load(open(os.path.join(ROOT, "..", "out", "pisa", "timeline.json")))
DUR = TL["dur"]
N = ns(DUR)
A = TL["anchors"]
SH = {s["id"]: (s["a"] / 30, s["b"] / 30) for s in TL["shots"]}
OUT = os.path.join(ROOT, "..", "out", "pisa", "audio")
os.makedirs(OUT, exist_ok=True)
R = rng(1234)
F = I.m2f


def write(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x.T * 32767).astype("<i2").tobytes())


# ============================================================ music
E = 0.2           # eighth note (s): 6/8 at 100 dotted-quarter bpm, bar = 1.2 s
BAR = 6 * E
# theme (bar, eighth, length in eighths, midi) - our own tune, G major, mandolin register
THEME = [
    (0, 0, 2, 74), (0, 2, 1, 71), (0, 3, 2, 74), (0, 5, 1, 76),
    (1, 0, 2, 79), (1, 2, 1, 78), (1, 3, 1, 76), (1, 4, 1, 74), (1, 5, 1, 72),
    (2, 0, 2, 71), (2, 2, 1, 72), (2, 3, 2, 74), (2, 5, 1, 71),
    (3, 0, 3, 69), (3, 3, 1, 67), (3, 4, 1, 69), (3, 5, 1, 71),
    (4, 0, 2, 74), (4, 2, 1, 71), (4, 3, 2, 74), (4, 5, 1, 76),
    (5, 0, 2, 79), (5, 2, 1, 81), (5, 3, 1, 83), (5, 4, 1, 81), (5, 5, 1, 79),
    (6, 0, 2, 78), (6, 2, 1, 76), (6, 3, 2, 72), (6, 5, 1, 69),
    (7, 0, 3, 67), (7, 3, 3, 67),
]
CHORDS = ["G", "C", "G", "D", "G", "C", "D", "G"]
CH = {"G": (43, [55, 59, 62]), "C": (48, [55, 60, 64]), "D": (50, [54, 57, 62]), "Gm": (43, [55, 58, 62]), "Eb": (51, [55, 58, 63]),
      "Cm": (48, [55, 60, 63]), "D7": (50, [54, 57, 60]), "Em": (40, [55, 59, 64]), "Am": (45, [57, 60, 64])}

tracks = {k: np.zeros((2, N)) for k in ["mand", "acc", "tuba", "tamb", "glock", "brass", "box", "pluck", "timp", "cym", "snare"]}
SEND = {"mand": 0.18, "acc": 0.22, "tuba": 0.1, "tamb": 0.08, "glock": 0.28, "brass": 0.2, "box": 0.3, "pluck": 0.2, "timp": 0.25, "cym": 0.2, "snare": 0.12}
LEVEL = {"mand": 0, "acc": -6, "tuba": -3, "tamb": -13, "glock": -7, "brass": -2, "box": -2, "pluck": -4, "timp": -5, "cym": -12, "snare": -8}


def add(k, x, t, p=0.0, g=1.0):
    x = np.asarray(x, float)
    place(tracks[k], pan(x, p) if x.ndim == 1 else x, t, g)


def mandolin(f, dur, vel, t, p=0.0):
    """tremolo mandolin: fast repeated plucks over the note length"""
    n = max(1, int(dur / 0.055))
    for k in range(n):
        add("mand", I.pluck(f * (1 + R.normal(0, 0.0015)), vel * (0.75 + 0.25 * (k % 2)), R, 0.25, bright=0.75), t + k * 0.055, p)


def phrase(t0, bars, transpose=0, inst="mand", vel=0.7, gate=1.0, tempo=1.0, chords=True, harm=True, tamb=True, chordmap=None):
    """play theme bars `bars` (indices) starting at t0; returns end time"""
    e = E * tempo
    for j, b in enumerate(bars):
        tb = t0 + j * 6 * e
        for (bar, s, l, m) in THEME:
            if bar != b:
                continue
            ts, d, f = tb + s * e, l * e * gate, F(m + transpose)
            if inst == "mand":
                mandolin(f, d, vel, ts, -0.15)
            elif inst == "glock":
                add("glock", I.glock(f * 2, vel, R), ts, 0.3)
            elif inst == "box":
                add("box", I.musicbox(f * 2, vel, R), ts, 0.0)
            elif inst == "pluck":
                add("pluck", I.pluck(f, vel, R, 0.6, bright=0.6), ts, 0.1)
            elif inst == "brass":
                add("brass", I.brass(f / 2, d * 0.95, vel, R, "horn"), ts, 0.0)
        if chords:
            name = (chordmap or CHORDS)[b % 8]
            root, triad = CH[name]
            add("tuba", I.brass(F(root + transpose), 0.35 * tempo, 0.7, R, "tuba"), tb, -0.1)
            add("tuba", I.brass(F(root + 7 + transpose), 0.35 * tempo, 0.6, R, "tuba"), tb + 3 * e, -0.1)
            if harm:
                add("acc", I.pad([F(x + transpose) for x in triad], 6 * e - 0.05, 0.5, R, att=0.03, rel=0.12, warm=1800,
                                 trem=lambda t: 1 + 0.18 * np.sin(2 * np.pi * 6.5 * t)), tb, 0.25)
        if tamb:
            for k in range(6):
                add("tamb", I.brush(0.55 if k % 3 == 0 else 0.3, R, 0.18, swish=False), tb + k * e, 0.4)
                if k % 3 == 0:
                    add("tamb", 0.4 * I.triangle(0.15, R, 0.2, 6200), tb + k * e, 0.4)
    return t0 + len(bars) * 6 * e


def gate_out(t_cut, fade=0.03, keys=None):
    """silence the band after t_cut (music stops dead on a story beat)"""
    a, z = ns(t_cut), ns(t_cut + fade)
    for k in keys or tracks:
        x = tracks[k]
        x[:, a:z] *= np.linspace(1, 0, max(1, z - a))[None, :]
        x[:, z:] = 0


def music():
    # hook: theme bars 0-3, the band stops on the white flash with a stab
    t_flash = TL["flash"]
    phrase(0.05, [0, 1, 2, 3])
    gate_out(t_flash - 0.02)
    for m in [55, 62, 67, 71]:
        add("brass", I.brass(F(m), 0.25, 0.85, R, "stab", scoop=-12), t_flash, (m - 62) / 20)
    add("cym", I.cymbal(0.5, R), t_flash)
    # 1173 -> the pit -> second floor: theme again, glock doubling on "fanciest"
    t = SH[2][0] + 0.25
    t = phrase(t, [4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7], vel=0.62)
    phrase(A["fanciest"] - 0.05, [5, 6], inst="glock", chords=False, tamb=False, vel=0.5)
    # the tower tips: dead stop + sliding tuba
    tip = A["tipping"]
    gate_out(tip - 0.03)
    add("brass", I.brass(F(43), 1.1, 0.9, R, "tuba", fall=-7), tip, 0.0)
    add("timp", I.timpani(F(43), 0.9, R), tip + 0.05)
    # war: snare roll + military fife call, then the tools drop (silence for the clanks)
    w0 = SH[5][0]
    for k in range(int((SH[6][0] + 0.9 - w0) / 0.1)):
        add("snare", I.snare(0.35 + 0.25 * (k % 4 == 0), R, 0.2), w0 + k * 0.1, 0.1)
    for j, (m, d) in enumerate([(67, 0.15), (67, 0.15), (72, 0.3), (67, 0.15), (72, 0.15), (76, 0.5)]):
        add("brass", I.fife(F(m), d, 0.7, R) if hasattr(I, "fife") else I.brass(F(m), d, 0.7, R, "horn"), A["war"] - 0.2 + sum(x[1] for x in [(67, 0.15), (67, 0.15), (72, 0.3), (67, 0.15), (72, 0.15), (76, 0.5)][:j]), 0.2)
    gate_out(A["tools"] - 0.02)
    # the century-long pause: music box, half tempo, accordion pad; ends on "squeeze" with a pluck chord
    p0 = SH[7][0] + 0.1
    phrase(p0, [0, 1, 2, 3], inst="box", tempo=1.55, tamb=False, chords=False, vel=0.55)
    add("acc", I.pad([F(x) for x in [55, 59, 62, 67]], SH[7][1] - p0, 0.45, R, att=1.2, rel=1.0, warm=1200), p0, 0.0)
    gate_out(SH[7][1] + 0.3, 0.4, ["box", "acc"])
    add("pluck", sum(I.pluck(F(m), 0.6, R, 0.9) for m in [43, 50, 55, 59]), A["squeeze"] + 0.02, 0.0)
    # they come back + the banana: the band builds again, glock button on "banana"
    t = SH[8][0] + 0.1
    phrase(t, [0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3], vel=0.72)
    phrase(A["by building"], [4, 5, 6, 7], inst="glock", chords=False, tamb=False, vel=0.45)
    gate_out(SH[10][0] - 0.08, 0.15)
    for k, m in enumerate([79, 83, 86, 91]):
        add("glock", I.glock(F(m), 0.6, R), A["like a banana"] + 0.08 + k * 0.06, 0.3)
    # 1934: pompous G-minor march for the dictator (brass + snare, 2/4 feel), cut dead on "further"
    t = SH[10][0] + 0.05
    gm = ["Gm", "Cm", "Gm", "D7", "Gm", "Eb", "D7", "Gm"]
    phrase(t, [0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3], inst="brass", transpose=-12, vel=0.62, tamb=False, harm=False, chordmap=gm)
    for k in range(int((SH[11][1] - t) / (3 * E))):
        add("snare", I.snare(0.5 if k % 2 == 0 else 0.3, R, 0.25), t + k * 3 * E, 0.1)
    gate_out(A["further"] - 0.02)
    add("timp", I.timpani(F(38), 1.0, R, 2.6), A["further"] + 0.04)
    add("brass", I.brass(F(46), 1.4, 0.9, R, "tuba", fall=-12), A["further"] + 0.05, 0.0)
    add("cym", I.cymbal(0.7, R, 2.8), A["further"] + 0.05)
    # the mattress: pizzicato, light, boing at "sinks"
    t = SH[12][0] + 0.2
    phrase(t, [0, 1, 2, 3, 4, 5], inst="pluck", vel=0.6, tamb=False, chords=True, harm=False)
    gate_out(A["sinks"] - 0.03, 0.06, ["pluck", "tuba"])
    add("pluck", I.pluck(F(43), 0.9, R, 1.0), A["sinks"] + 0.05, 0.0)
    # 1990: tension ostinato (low plucks on E minor), accordion swell into "swung back"
    t = SH[13][0] + 0.1
    for k in range(int((SH[13][1] - t) / E)):
        m = [40, 47, 52, 47, 40, 47][k % 6]
        add("pluck", I.pluck(F(m), 0.55 + 0.25 * (k % 6 == 0), R, 0.5, bright=0.3), t + k * E, -0.1)
    add("acc", I.pad([F(x) for x in [52, 55, 59]], SH[13][1] - t, 0.4, R, att=2.0, rel=0.4, warm=900), t, 0.0)
    # swung back: rising resolve chord, cheer on "stopped"
    s0 = A["The tower swung"]
    add("acc", I.pad([F(x) for x in [55, 59, 62, 67]], A["stopped"] - s0 + 0.2, 0.5, R, att=1.0, rel=0.3, warm=1600), s0, 0.0)
    for k, m in enumerate([67, 71, 74, 79]):
        add("glock", I.glock(F(m), 0.6, R), A["stopped"] + k * 0.07, 0.25)
    add("cym", I.cymbal(0.4, R), A["stopped"])
    # tourists: full band, theme to the end, button on the last word
    t = SH[15][0] + 0.05
    end = TL["words_end"]
    phrase(t, [0, 1, 2, 3, 4, 5, 6, 7], vel=0.75)
    phrase(A["But nobody"], [4, 5, 6], inst="glock", chords=False, tamb=False, vel=0.45)
    gate_out(end + 0.02, 0.05)
    for m in [43, 55, 62, 67, 71, 79]:
        add("brass" if m < 70 else "glock", I.brass(F(m), 0.35, 0.85, R, "stab") if m < 70 else I.glock(F(m), 0.7, R), end + 0.08, (m - 60) / 30)
    add("cym", I.cymbal(0.55, R), end + 0.08)
    add("timp", I.timpani(F(43), 0.8, R), end + 0.08)

    hall = make_ir(1.4, 7, pre=0.018, hf=1.4)
    dry, wet = np.zeros((2, N)), np.zeros(N)
    ref = -20.0
    for k, x in tracks.items():
        if not np.any(x):
            continue
        g = dbg(ref + LEVEL[k] - integrated(x))
        dry += x * g
        wet += SEND[k] * (x * g).mean(0)
    out = dry + 0.7 * convolve_st(wet, hall)
    return hp(out, 30, 2)


# ============================================================ sfx
S = np.zeros((2, N))
SW = np.zeros(N)


def fx(x, t, db=-20.0, p=0.0, send=0.1, lpf=None, mode="event"):
    """place a sound so that its loudness is `db` LUFS (event: momentary max; bed: integrated)"""
    x = np.asarray(x, float)
    x = pan(x, p) if x.ndim == 1 else x
    if lpf:
        x = lp(x, lpf, 1)
    cur = momentary_max(x) if mode == "event" else integrated(x)
    if np.isfinite(cur):
        x = x * dbg(db - cur)
    place(S, x, t)
    if send:
        G._place_mono(SW, send * x.mean(0), t)


def rumble(dur, r, f=60):
    n = ns(dur)
    y = lp(colored(n, r, 1.5), f, 2) * (1 + 0.5 * smooth_noise(n, r, 3))
    return fades(y, 0.08, 0.4)


def scrape(r, dur=0.35):
    n = ns(dur)
    t = np.arange(n) / SR
    y = bp(colored(n, r, 0.3), 600, 3500, 2) * np.exp(-t / 0.12) + lp(colored(n, r, 1.0), 300) * np.exp(-((t - 0.25) / 0.03) ** 2) * 2
    return fades(y, 0.003, 0.05)


def squelch(r):
    n = ns(0.6)
    t = np.arange(n) / SR
    f = 180 + 500 * np.exp(-t / 0.12)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.15) * 0.6 + lp(colored(n, r, 0.8), 900) * np.exp(-t / 0.08)
    return fades(y + 0.5 * G.bubbles(0.6, r, 25, 200, 900), 0.002, 0.08)


def boing(r, f0=180, f1=420, dur=0.55):
    t = np.arange(ns(dur)) / SR
    f = f0 + (f1 - f0) * (1 - np.exp(-t / 0.06)) * (1 + 0.12 * np.sin(2 * np.pi * 14 * t) * np.exp(-t / 0.2))
    return fades(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22), 0.002, 0.06)


def drill(dur, r):
    n = ns(dur)
    t = np.arange(n) / SR
    f = 95 + 6 * np.sin(2 * np.pi * 2.3 * t)
    y = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.4 + bp(colored(n, r, 0.2), 1500, 5000) * 0.25 * (1 + np.sin(2 * np.pi * 11 * t))
    return fades(lp(y, 3500), 0.15, 0.3)


def shutter(r):
    n = ns(0.12)
    t = np.arange(n) / SR
    y = hp(r.standard_normal(n), 2500) * (np.exp(-t / 0.004) + 0.6 * np.exp(-((t - 0.06) / 0.004) ** 2))
    return y


def sfx():
    r = R
    day = [i for i in SH if i not in (7, 12)]
    # ambience: birds + breeze by day, crickets + soft wind at sunset; town murmur in crowd shots
    for i in day:
        a, b = SH[i]
        fx(G.breeze(b - a + 0.4, r, 0.6), a - 0.2, -42, mode="bed", send=0)
        fx(G.bird_chirps(b - a, r, 0.4), a, -40, p=0.4, mode="bed", send=0.05)
    for i in (7, 12):
        a, b = SH[i]
        fx(G.crickets(b - a, r, 3), a, -42, mode="bed", send=0)
        fx(G.breeze(b - a, r, 0.5), a, -44, mode="bed", send=0)
    from sfx import _murmur, _cheer
    for i in (2, 15):
        a, b = SH[i]
        fx(_murmur(b - a, r, 14), a, -36, mode="bed", send=0.05)
    # whooshes on camera cuts and fast glides (one per burst)
    last = -9
    for m in TL["moves"]:
        if (m["cut"] or m["v"] > 0.9) and m["t"] - last > 0.8:
            last = m["t"]
            fx(G.whoosh(0.6, r, 0.12 if m["cut"] else 0.3, 300, 2400), m["t"] - (0.1 if m["cut"] else 0.3), -30 if m["cut"] else -33, p=r.uniform(-0.3, 0.3))
    # hook: stone groan under "falling over", flash shimmer
    fx(G.creak(1.4, r, 40, 70, scale=0.5), A["falling"] - 0.4, -27, send=0.2)
    fx(rumble(1.6, r), A["falling"] - 0.2, -30, send=0)
    fx(G.whoosh(0.5, r, 0.05, 1200, 6000), TL["flash"] - 0.03, -29)
    # 1173: cheer on "fanciest"
    fx(_cheer(3.0, r), A["fanciest"] - 0.1, -27, mode="bed", send=0.15)
    # the pit: digging scrapes + dirt thuds, the boot squelch on "soft"
    a, b = SH[3]
    for k in range(int((b - a) / 0.42)):
        fx(scrape(r), a + 0.1 + k * 0.42 + r.uniform(0, 0.15), -33, p=r.uniform(-0.6, 0.6))
    fx(squelch(r), A["soft"] + 0.02, -23, p=0.05)
    # tipping: stone groan + thump
    fx(G.creak(1.0, r, 30, 55, scale=0.45), A["tipping"] - 0.25, -25, send=0.2)
    fx(rumble(1.4, r, 70), A["tipping"], -27, send=0)
    fx(G.hammer_hit(r, 1.6), A["tipping"] + 0.2, -26, send=0.2)
    fx(G.whoa(r), A["tipping"] + 0.25, -31, p=-0.2)
    # war: marching boots + distant horn
    a, b = SH[5]
    for k in range(int((b - a + 0.6) / 0.31)):
        fx(G.boot(r, 0.8), a + k * 0.31, -34, p=-0.5 + 0.9 * k / max(1, (b - a) / 0.31))
    # tools: three clanks with bounces, then running steps
    for k in range(3):
        tc = A["tools"] + 0.12 + 0.09 * k
        fx(G.clink(r, r.uniform(1800, 2600), 0.3, 1.2), tc, -24, p=-0.3 + 0.3 * k)
        fx(G.clink(r, r.uniform(2400, 3200), 0.15, 0.8), tc + 0.11, -32, p=-0.3 + 0.3 * k)
    for k in range(10):
        fx(G.stroll_step(r, 0.8), A["for almost"] + k * 0.17, -36, p=-0.6)
    # the pause: time-lapse wind swell, squeeze squish
    fx(G.whoosh(SH[7][1] - SH[7][0], r, 1.2, 200, 900, tail=1.5), SH[7][0], -36, send=0.1)
    fx(squelch(r), A["squeeze"] + 0.05, -26)
    fx(G.creak(0.6, r, 45, 30, scale=0.5), A["squeeze"] + 0.1, -29)
    # come back: chisels and stone blocks landing as the floors rise
    a, b = SH[8]
    for k in range(int((b - a - 1) / 0.55)):
        fx(G.hammer_hit(r, 0.4), a + 0.9 + k * 0.55 + r.uniform(0, 0.1), -34, p=r.uniform(-0.6, 0.6))
    for tt_ in (A["by building"], A["by building"] + 0.9, A["low side"]):
        fx(G.hammer_hit(r, 1.3), tt_, -29, send=0.2)
    fx(boing(r, 300, 650, 0.4), A["like a banana"] + 0.05, -28)
    # 1934: mixer drum churn, concrete gloop
    a, b = SH[10]
    fx(rumble(b - A["so his"] + 0.3, r, 110) + 0.3 * G.rattle(b - A["so his"] + 0.3, r, 20), A["so his"] - 0.1, -33, mode="bed", send=0)
    fx(G.bubbles(b - A["pump"], r, 14, 150, 700), A["pump"], -32, mode="bed", send=0)
    # further: big groan + crash + gasp
    fx(G.creak(1.6, r, 25, 45, scale=0.4), A["further"] - 0.4, -23, send=0.25)
    fx(rumble(2.4, r, 80), A["further"] + 0.05, -24, send=0)
    fx(G.hammer_hit(r, 2.0), A["further"] + 0.2, -23, send=0.3)
    fx(G.whoa(r), A["further"] + 0.3, -28, p=-0.3)
    # mattress: spring squeaks on each weight shift, boing on "sinks"
    for tq in (SH[12][0] + 0.5, A["Put more"] + 0.1, A["Put more"] + 0.5):
        fx(G.swing_squeak(r, 0.8), tq, -31, p=0.1)
    fx(boing(r, 160, 90, 0.7), A["sinks"] + 0.05, -26)
    # 1990: drill, puffs of soil; cable twang on "shut it"
    fx(drill(SH[13][1] - A["and engineers"] + 0.2, r), A["and engineers"] - 0.05, -31, mode="bed", send=0.05)
    fx(G.clink(r, 180, 1.2, 0.4), A["shut it"], -32, send=0.2)
    # swung back: long stone creak, cheer + applause on "stopped"
    fx(G.creak(2.0, r, 50, 25, scale=0.45), A["The tower swung"] + 0.1, -28, send=0.2)
    fx(_cheer(2.8, r), A["stopped"] - 0.05, -28, mode="bed", send=0.15)
    # tourists: camera shutters
    a, b = SH[15]
    for k in range(9):
        fx(shutter(r), a + 0.4 + k * 0.62 + r.uniform(0, 0.3), -33, p=r.uniform(-0.7, 0.7))
    yard = make_ir(0.9, 8, pre=0.008, hf=1.8, early=[(0.11, 0.5, -0.4), (0.19, 0.35, 0.5)])
    out = S + 0.5 * convolve_st(SW, yard)
    out = hp(out, 25, 2)
    return out


if __name__ == "__main__":
    m = music()
    s = sfx()
    e = ns(DUR - 0.1)
    for x in (m, s):
        x[:, e:] *= np.linspace(1, 0, N - e)[None, :] ** 2
    # balance as a bed under a voice at about -16 LUFS: music ~ -26, sfx events peak ~ -24 (voice decides the final mix)
    m = m * dbg(-25.0 - integrated(m))
    write(os.path.join(OUT, "music.wav"), m)
    write(os.path.join(OUT, "sfx.wav"), s)
    bed = m + s
    write(os.path.join(OUT, "bed.wav"), bed)
    print("music", round(integrated(m), 1), "sfx", round(integrated(s), 1), "bed", round(integrated(bed), 1), "LUFS")
