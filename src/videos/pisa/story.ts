// Timeline of "The Tower That Refused to Stand Up" (the Leaning Tower of Pisa). Every shot, camera key, reaction and
// tower move is anchored to a WORD of the voice-over (words.json: estimated until the real voice arrives; replace the
// file with real word timings and the whole film re-times itself). Camera grammar from the skill: cuts on big jumps,
// smootherstep glides 18-40 f, every hold creeps in (no static hold), flip kicks on impacts, 4-5 deg rolls.
import WORDS from "./words.json";

export const FPS = 30;
export const D0 = 0; // ground level (m)
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;

// ---------------- words ----------------
type Word = { w: string; s: number; e: number };
const WS = (WORDS as Word[]).map((x) => ({ ...x, k: x.w.toLowerCase().replace(/[^a-z0-9']/g, "") }));
/** start time (s) of the n-th occurrence of a phrase in the voice-over */
export const at = (phrase: string, n = 0): number => {
  const p = phrase.toLowerCase().split(/\s+/).map((x) => x.replace(/[^a-z0-9']/g, ""));
  let seen = 0;
  for (let i = 0; i + p.length <= WS.length; i++) {
    if (p.every((x, j) => WS[i + j].k === x)) { if (seen === n) return WS[i].s; seen++; }
  }
  throw new Error("story.ts: phrase not in words.json: " + phrase);
};
/** end time of the last word of a phrase */
export const end = (phrase: string, n = 0) => {
  const t = at(phrase, n), i = WS.findIndex((x) => x.s === t);
  return WS[i + phrase.split(/\s+/).length - 1].e;
};
export const Fr = (t: number) => Math.round(t * FPS);
const fa = (p: string, n = 0) => Fr(at(p, n));
export const TOTAL = Fr(WS[WS.length - 1].e + 0.7);

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Era = "plan" | "pit" | "medieval" | "pause" | "1934" | "1990" | "modern";
export type ShotDef = { id: number; a: number; b: number; light: Light; era: Era; sunAz?: number; sunEl?: number };
const CUTS = [0, fa("It's"), fa("So the builders"), fa("By the second"), fa("Luckily"), fa("everybody drops"), fa("a hundred years"), fa("When they"),
  fa("So now"), fa("In nineteen"), fa("It leans"), fa("You see"), fa("By nineteen ninety"), fa("The tower swung"), fa("They could"), TOTAL];
const ERA: [Light, Era][] = [["day", "medieval"], ["day", "plan"], ["day", "pit"], ["day", "medieval"], ["day", "medieval"], ["day", "medieval"],
  ["golden", "pause"], ["day", "medieval"], ["day", "medieval"], ["day", "1934"], ["day", "1934"], ["golden", "modern"], ["day", "1990"], ["day", "1990"], ["day", "modern"]];
export const SHOTS: ShotDef[] = ERA.map(([light, era], i) => ({ id: i + 1, a: CUTS[i], b: CUTS[i + 1], light, era }));
SHOTS[1].sunAz = 120;
SHOTS[6].sunAz = 135; SHOTS[6].sunEl = 20; SHOTS[11].sunAz = -45; SHOTS[11].sunEl = 20; // the pause: warm sunset on the marble // aerial: front-lit town
/** crossfades at place/time changes; white flash after the hook */
export const XFADE: Record<number, number> = { 7: 8, 8: 8, 10: 8, 12: 8, 13: 8, 15: 8 };
export const FLASH_AT = CUTS[1];
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- the tower ----------------
// 8 storeys: ground (10 m) + 6 open galleries (5 m) + bell chamber (6.5 m). Leans toward +x about its base centre.
export const R_OUT = 7.6, R_CORE = 6.3, H_GROUND = 10, H_LOG = 5, H_BELL = 6.5, R_BELL = 5.0;
export const storeyH = (k: number) => (k === 0 ? H_GROUND : k === 7 ? H_BELL : H_LOG);
export const storeyY = (k: number) => (k === 0 ? 0 : H_GROUND + (k - 1) * H_LOG);
export type TowerState = { floors: number; lean: number; curve: number; sink: number; scaffold: boolean };
const lin = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + ((y1 - y0) * smooth((x - x0) / (x1 - x0)));
  }
  return pts[pts.length - 1][1];
};
// lean in degrees (cartoon-exaggerated: 1990's real 5.5 deg reads as 7 here)
export const T_TIP = at("tipping"), T_FURTHER = at("further"), T_SWUNG = at("swung"), T_SQUEEZE = at("squeeze");
export const towerState = (id: number, t: number): TowerState => {
  switch (id) {
    case 1: return { floors: 8, lean: 6, curve: 1, sink: 0.4, scaffold: false };
    case 2: case 3: return { floors: 0, lean: 0, curve: 0, sink: 0, scaffold: false };
    case 4: return { floors: lin([[at("second floor"), 1.0], [at("the whole thing"), 2.0], [at("already"), 2.6]], t), lean: lin([[T_TIP - 0.1, 0], [T_TIP + 0.45, 3]], t), curve: 0, sink: 0, scaffold: true };
    case 5: case 6: return { floors: 2.6, lean: 3, curve: 0, sink: 0.05, scaffold: true };
    case 7: return { floors: 2.6, lean: 3, curve: 0, sink: 0.05 + 0.25 * smooth((t - T_SQUEEZE) / 0.5), scaffold: false };
    case 8: return { floors: lin([[at("When they") + 0.6, 2.6], [at("hide the"), 3.0], [at("new floors"), 5.2], [at("low side") + 0.6, 8]], t), lean: 3.6, curve: lin([[at("by building"), 0], [at("low side") + 0.4, 1]], t), sink: 0.3, scaffold: true };
    case 9: return { floors: 8, lean: 4, curve: 1, sink: 0.3, scaffold: false };
    case 10: return { floors: 8, lean: 4.5, curve: 1, sink: 0.3, scaffold: false };
    case 11: return { floors: 8, lean: lin([[T_FURTHER - 0.05, 4.5], [T_FURTHER + 0.35, 7.2]], t), curve: 1, sink: lin([[T_FURTHER - 0.05, 0.3], [T_FURTHER + 0.35, 0.65]], t), scaffold: false };
    case 12: return { floors: 8, lean: 4, curve: 1, sink: 0.4, scaffold: false };
    case 13: return { floors: 8, lean: 7, curve: 1, sink: 0.65, scaffold: false };
    case 14: return { floors: 8, lean: lin([[T_SWUNG, 7], [at("centimeters") + 0.4, 5.5]], t), curve: 1, sink: 0.6, scaffold: false };
    default: return { floors: 8, lean: 5.5, curve: 1, sink: 0.6, scaffold: false };
  }
};
/** world position of a point on the tower axis at height h (base lean only, small-angle curve ignored) */
export const towerPt = (s: TowerState, h: number, dx = 0): V3 => {
  const a = (s.lean * Math.PI) / 180;
  return [Math.sin(a) * h + Math.cos(a) * dx, Math.cos(a) * h - Math.sin(a) * dx - s.sink, 0];
};

// ---------------- places ----------------
export const MATT: V3 = [34, 0, 44]; // the explanation's mattress (golden lawn, tower behind)
export const DRILL: V3 = [-12, 0, 3]; // 1990 soil extraction on the high (-x) side
export const TRUCK: V3 = [22, 0, 7]; // 1934 concrete
export const T_PUSH = at("Put more"), T_SINK = at("sinks"), T_DROP = at("drops"), T_TOOLS = at("tools"), T_WAR = at("war"), T_STOP = at("stopped");

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mixC = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mixC(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
/** slow sideways drift (m/frame) so even pure zoom holds keep parallax */
const drift = (s: Shot, f: number, f0: number, v: V3): Shot => ({ ...s, pos: [s.pos[0] + v[0] * (f - f0), s.pos[1] + v[1] * (f - f0), s.pos[2] + v[2] * (f - f0)] });
const A = SHOTS.map((s) => s.a);
const sa = (id: number) => A[id - 1];

const CAMS: Record<number, Key[]> = {
  // 1 hook: the finished, bent tower over worried medieval builders; tilt up the tower, dutch angle on "falling over"
  1: [
    { f: 0, s: (f) => drift(dolly([3.2, 1.3, 38.5], [0, 4.2, 26], pushK(f, 0, 0.003), { fov: 44, roll: 0.02 }), f, 0, [-0.012, 0, 0]) },
    { f: fa("a tower") - 12, dur: 34, s: (f) => drift(dolly([9, 2.5, 64], [3, 21, 0], pushK(f, fa("a tower"), 0.0025), { fov: 48 }), f, fa("a tower"), [-0.02, 0.01, 0]) },
    { f: fa("falling"), cut: true, s: (f) => dolly([-2.0, 0.95, 33.6], [0.6, 3.4, 20], pushK(f, fa("falling"), 0.003, 0.007, 30), { fov: 46, roll: -0.075 }) },
  ],
  // 2 1173: aerial of the empty site, glide down to the cheering town
  2: [
    { f: sa(2), s: (f) => drift(zoom([46, 34, 78], [-4, 2, 0], 42, pushK(f, sa(2), 0.002)), f, sa(2), [-0.03, 0, 0]) },
    { f: fa("fanciest") - 18, dur: 36, s: (f) => dolly([10, 3.2, 31], [-2, 2.5, 4], pushK(f, fa("fanciest"), 0.0025, 0.006, 30), { fov: 44, roll: 0.04 }) },
  ],
  // 3 the pit: down into the hole, low in the clay, the boot sinks
  3: [
    { f: sa(3), s: (f) => drift(dolly([7.5, 4.2, 17.5], [0, -2.2, 1], pushK(f, sa(3), 0.0025), { fov: 46 }), f, sa(3), [-0.015, 0, 0]) },
    { f: fa("three meters"), cut: true, s: (f) => dolly([5.5, -1.3, 8.5], [0, -1.6, 1], pushK(f, fa("three meters"), 0.002, 0.006, 30), { fov: 44, roll: -0.04 }) },
    { f: fa("soft"), cut: true, s: (f) => dolly([1.6, -2.35, 6.4], [0.2, -2.75, 3.6], pushK(f, fa("soft"), 0.003), { fov: 38, roll: 0.03 }) },
  ],
  // 4 second floor: rising stub, then it tips (kick + roll)
  4: [
    { f: sa(4), s: (f) => drift(dolly([12, 2.6, 46], [1, 7, 0], pushK(f, sa(4), 0.0025), { fov: 44 }), f, sa(4), [-0.025, 0, 0]) },
    { f: fa("already") - 10, dur: 22, s: (f) => dolly([5, 1.3, 36], [1.5, 7, 0], pushK(f, fa("already"), 0.002, 0.006, 30), { fov: 44, roll: 0.05 }) },
  ],
  // 5 war: soldiers march past the stub, the builders watch
  5: [
    { f: sa(5), s: (f) => dolly([-9 + 0.04 * (f - sa(5)), 2.0, 46], [-1 + 0.03 * (f - sa(5)), 4, 22], pushK(f, sa(5), 0.002), { fov: 42 }) },
    { f: fa("war") - 8, dur: 20, s: (f) => dolly([-7 + 0.04 * (f - sa(5)), 1.6, 42], [-1 + 0.03 * (f - sa(5)), 3, 24], pushK(f, fa("war"), 0.002, 0.006, 28), { fov: 40, roll: -0.04 }) },
  ],
  // 6 tools drop: MS of the builders -> ground insert as the shovels hit (kick)
  6: [
    { f: sa(6), s: (f) => dolly([1.5, 1.7, 33], [0, 1.6, 25], pushK(f, sa(6), 0.003), { fov: 40 }) },
    { f: fa("tools") + 2, cut: true, s: (f) => dolly([0.8, 0.45, 29.6], [0, 0.25, 25.6], pushK(f, fa("tools"), 0.003), { fov: 40, roll: 0.04 }) },
    { f: fa("for almost") - 4, cut: true, s: (f) => drift(dolly([-6, 1.6, 42], [2, 3, 22], pushK(f, fa("for almost"), 0.0025), { fov: 44 }), f, fa("for almost"), [0.02, 0, 0]) },
  ],
  // 7 the pause: a century at sunset, then low at the base on "squeeze tight"
  7: [
    { f: sa(7) - 4, s: (f) => drift(dolly([24, 5, 46], [1, 7, 0], pushK(f, sa(7), 0.002), { fov: 42 }), f, sa(7), [-0.03, 0.004, 0]) },
    { f: fa("saved"), cut: true, s: (f) => dolly([22, 2.4, 32], [2, 7, 0], pushK(f, fa("saved"), 0.0025), { fov: 44, roll: 0.03 }) },
    { f: fa("squeeze") - 10, dur: 20, s: (f) => dolly([14, 0.9, 19], [6.2, 1.6, 4.5], pushK(f, fa("squeeze"), 0.002, 0.007, 30), { fov: 40, roll: -0.04 }) },
  ],
  // 8 they come back: crane up with the new floors
  8: [
    { f: sa(8) - 4, s: (f) => drift(dolly([12, 1.8, 40], [0, 5, 14], pushK(f, sa(8), 0.0025), { fov: 46 }), f, sa(8), [-0.02, 0, 0]) },
    { f: fa("by building") - 20, dur: 40, s: (f) => drift(dolly([28, 16, 62], [2, 24, 0], pushK(f, fa("by building"), 0.002), { fov: 46 }), f, fa("by building"), [-0.03, 0.01, 0]) },
    { f: fa("low side") - 6, cut: true, s: (f) => dolly([20, 36, 30], [3.5, 34, 0], pushK(f, fa("low side"), 0.002, 0.006, 26), { fov: 42, roll: 0.04 }) },
  ],
  // 9 the banana: whole tower from the side, then a builder holds a banana up beside it
  9: [
    { f: sa(9), s: (f) => drift(dolly([-4, 6, 82], [3, 23, 0], pushK(f, sa(9), 0.002), { fov: 44 }), f, sa(9), [0.03, 0, 0]) },
    { f: fa("bent") - 10, dur: 22, s: (f) => drift(dolly([-4, 6, 76], [3, 23, 0], pushK(f, fa("bent"), 0.002, 0.006, 26), { fov: 44, roll: -0.045 }), f, sa(9), [0.03, 0, 0]) },
    { f: fa("like a banana"), cut: true, s: (f) => dolly([0.2, 1.75, 48.2], [0.5, 3.7, 30], pushK(f, fa("like a banana"), 0.003), { fov: 44, roll: 0.03 }) },
  ],
  // 10 1934: the dictator points, then the concrete truck pumps at the base
  10: [
    { f: sa(10) - 4, s: (f) => dolly([2.0, 1.45, 35.5], [-1.2, 1.9, 28], pushK(f, sa(10), 0.0025), { fov: 40, roll: 0.02 }) },
    { f: fa("embarrassing") - 6, dur: 18, s: (f) => dolly([1.6, 1.5, 33.3], [-1.3, 1.95, 28], pushK(f, fa("embarrassing"), 0.002, 0.006, 26), { fov: 38, roll: -0.04 }) },
    { f: fa("orders"), cut: true, s: (f) => drift(dolly([-7, 0.9, 42], [0, 12, 14], pushK(f, fa("orders"), 0.0025), { fov: 48, roll: 0.03 }), f, fa("orders"), [0.02, 0, 0]) },
    { f: fa("so his"), cut: true, s: (f) => drift(dolly([42, 4.5, 19], [11, 2.6, 3], pushK(f, fa("so his"), 0.0025, 0.005, 30), { fov: 44 }), f, fa("so his"), [-0.02, 0, 0]) },
  ],
  // 11 it leans even further: wide, kick on "further"
  11: [
    { f: sa(11), s: (f) => dolly([-8, 1.8, 50], [1, 15, 0], pushK(f, sa(11), 0.0025, 0.006, 24), { fov: 50 }) },
    { f: fa("further") - 2, dur: 18, s: (f) => dolly([-8, 1.8, 50], [1, 15, 0], pushK(f, sa(11), 0.0025, 0.006, 24), { fov: 50, roll: -0.07 }) },
  ],
  // 12 the mattress (golden lawn)
  12: [
    { f: sa(12) - 4, s: (f) => drift(dolly([MATT[0] - 3.2, 1.7, MATT[2] + 6.2], [MATT[0] - 0.2, 0.95, MATT[2]], pushK(f, sa(12), 0.0025), { fov: 42 }), f, sa(12), [0.01, 0, 0]) },
    { f: fa("Put more") - 12, dur: 26, s: (f) => dolly([MATT[0] - 1.4, 1.2, MATT[2] + 4.6], [MATT[0] + 0.1, 0.85, MATT[2]], pushK(f, fa("Put more"), 0.002), { fov: 40, roll: 0.03 }) },
    { f: fa("sinks") - 6, dur: 20, s: (f) => dolly([MATT[0] - 1.0, 0.75, MATT[2] + 3.6], [MATT[0] + 0.3, 0.6, MATT[2]], pushK(f, fa("sinks"), 0.002, 0.007, 26), { fov: 38, roll: -0.045 }) },
  ],
  // 13 1990: closed, cables; then the soil drill on the high side
  13: [
    { f: sa(13) - 4, s: (f) => drift(dolly([-16, 3, 62], [-3, 17, 0], pushK(f, sa(13), 0.0025), { fov: 46 }), f, sa(13), [0.03, 0, 0]) },
    { f: fa("shut it") - 8, dur: 20, s: (f) => drift(dolly([-14, 2.2, 52], [-3, 13, 0], pushK(f, fa("shut it"), 0.002, 0.006, 26), { fov: 46, roll: 0.04 }), f, sa(13), [0.03, 0, 0]) },
    { f: fa("and engineers"), cut: true, s: (f) => drift(dolly([DRILL[0] - 7.5, 1.8, DRILL[2] + 10.5], [DRILL[0] + 0.5, 1.2, DRILL[2]], pushK(f, fa("and engineers"), 0.0025), { fov: 42 }), f, fa("and engineers"), [0.015, 0, 0]) },
  ],
  // 14 swung back: wide front, the tower eases back; cheer on "stopped"
  14: [
    { f: sa(14) - 4, s: (f) => drift(dolly([5, 2.2, 56], [1, 17, 0], pushK(f, sa(14), 0.0025), { fov: 48 }), f, sa(14), [-0.02, 0, 0]) },
    { f: fa("stopped") - 8, dur: 20, s: (f) => drift(dolly([4, 1.6, 50], [1, 15, 0], pushK(f, fa("stopped"), 0.002, 0.006, 24), { fov: 48, roll: 0.04 }), f, sa(14), [-0.02, 0, 0]) },
  ],
  // 15 tourists holding it up; crane out over the square to the end
  15: [
    { f: sa(15) - 4, s: (f) => dolly([-1.5, 1.35, 48], [1.2, 8.5, 18], pushK(f, sa(15), 0.0025), { fov: 46 }) },
    { f: fa("But nobody") - 12, dur: 26, s: (f) => dolly([-0.6, 1.55, 39.4], [-0.9, 2.0, 34.2], pushK(f, fa("But nobody"), 0.002, 0.006, 28), { fov: 46, roll: -0.04 }) },
    { f: fa("standing up") - 6, dur: 56, s: (f) => drift(dolly([26, 26, 70], [2, 13, 0], pushK(f, fa("standing up"), 0.002), { fov: 46 }), f, fa("standing up"), [-0.02, 0.01, 0]) },
  ],
};

// impact kicks: image offset flips sign each frame, decays over 7 f
const KICKS: [number, number][] = [[T_TIP + 0.2, 1.0], [T_TOOLS + 0.15, 0.7], [T_FURTHER + 0.2, 1.6], [at("squeeze") + 0.1, 0.5], [at("sinks") + 0.1, 0.5]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(f / FPS);
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};

// ---------------- lens ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 12, focus: () => [0, 1.6, 28] },                 // builders sharp, tower soft
  { f: fa("a tower") - 12, dur: 34, cInf: 0 },                     // the tower reveal
  { f: fa("falling"), cInf: 13, focus: () => [0, 1.7, 27.5] },
  { f: sa(2), cInf: 0 },
  { f: fa("soft"), cInf: 14 },                                     // boot insert
  { f: sa(4), cInf: 0 },
  { f: sa(6), cInf: 12, focus: () => [0, 1.6, 25.4] },
  { f: fa("tools") + 2, cInf: 14 },
  { f: fa("for almost") - 4, cInf: 0 },
  { f: fa("saved"), cInf: 7 },
  { f: sa(8), cInf: 0 },
  { f: fa("like a banana"), cInf: 14, focus: () => [1.2, 2.2, 44.4] },
  { f: sa(10), cInf: 12, focus: () => [-1.2, 2.0, 28] },
  { f: fa("orders"), cInf: 0 },
  { f: fa("so his"), cInf: 6 },
  { f: sa(11), cInf: 0 },
  { f: sa(12), cInf: 10, focus: () => [MATT[0], 0.95, MATT[2]] },
  { f: sa(13), cInf: 0 },
  { f: fa("and engineers"), cInf: 9 },
  { f: sa(14), cInf: 0 },
  { f: sa(15), cInf: 6, focus: () => [0, 1.6, 34] },
  { f: fa("But nobody") - 12, dur: 26, cInf: 12, focus: () => [-0.9, 2.0, 34.2] },
  { f: fa("standing up") - 6, dur: 40, cInf: 0 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

/** near framing objects: visible a <= f < b inside their own shot */
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [
  { a: sa(12), b: sa(13), kit: "plant_bushDetailed", pos: [MATT[0] + 1.9, 0, MATT[2] + 3.2], s: 0.9, yaw: 0.4 },
  { a: sa(2), b: sa(3), kit: "plant_bushLarge", pos: [7.5, 0, 28.5], s: 1.2 },
];

/** height of the mattress top under the kid's feet (world.ts dents the same amount) */
export const mattressTop = (t: number) => {
  const shift = smooth((t - T_PUSH) / 0.6);
  return D0 + 0.44 - (0.06 + 0.1 * shift + 0.06 * smooth((t - T_SINK) / 0.4));
};
