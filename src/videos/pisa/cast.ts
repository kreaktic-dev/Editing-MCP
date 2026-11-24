// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, townsfolk, KID, fxBurst, fxSplash, fxStars, fxCreak, fxPuff, fxShadow, fxContact, INK, SKINS,
  Outfit, Expr, FrontOpts, SideOpts, Prop,
} from "./toon";
import { FPS, D0, SHOTS, V3, smooth, clamp01, at, end, TowerState, MATT, DRILL, TRUCK, T_TIP, T_FURTHER, T_TOOLS, T_WAR, T_STOP, T_PUSH, T_SINK, T_SQUEEZE, mattressTop } from "./story";
import { LIGHTS } from "./lights";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
export const SU_SWING = 2.3 / 1830; // swing canvas: rope of 1830 units = 2.3 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), casts its silhouette
 *  when world.ts says so (golden). Drawn after the contact blobs (renderOrder 1). */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    // rim width is in output pixels: tell the card shader the render height (1920 = 1080 x 1920 frame)
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      // no mipmaps: at grazing views the mip chain averages the blob with its white surround and it fades out
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const FOLK = [0, 1, 2, 3, 4, 5].map((v) => townsfolk(v));
// our cast for Pisa
const TUNIC = ["#8a5a3c", "#3f6fb5", "#b5653f", "#5d7a3a", "#7b5ac9", "#a8743a"];
const builder = (v: number, old = false): Outfit => ({
  jacket: TUNIC[v % 6], pants: ["#4a3a2e", "#3b3f52", "#5a4a3a"][v % 3], boots: "#4a3426", skin: SKINS[v % 4],
  hat: old ? "hair" : v % 3 === 1 ? "hair" : "cap", cap: ["#c0353a", "#e2a33c", "#2f6a43", "#3f6fb5"][v % 4], hair: old ? "#e4e1da" : ["#4a3020", "#2a201a", "#7a4a2a"][v % 3],
  moustache: old ? "#ecebe6" : v % 4 === 2 ? "#4a3020" : undefined, build: v % 5 === 3 ? "stout" : "adult", belt: "#6a4a30",
});
const BUILDERS = [0, 1, 2, 3, 4, 5].map((v) => builder(v));
const OLD = [0, 1, 2, 3, 4, 5].map((v) => builder(v, true));
const SPEAR: Outfit = { jacket: "#b23a3a", pants: "#3d4440", boots: INK, hat: "helmet", rifle: true, belt: "#f1e3bf", buttons: "#e8c45a" };
const DUCE: Outfit = { jacket: "#26232b", pants: "#26232b", boots: INK, hat: "cap", cap: "#2e2a36", build: "stout", belt: "#5a4a3a", buttons: "#e8c45a", skin: "#f5c9a0" };
const AIDE = (v: number): Outfit => ({ jacket: "#2f3340", pants: "#2f3340", boots: INK, hat: "tophat", skin: SKINS[v % 4], moustache: v % 2 ? "#2a201a" : undefined });
const WORKER = (v: number): Outfit => ({ jacket: ["#6f7f95", "#8a7a5a", "#5d6a7a"][v % 3], pants: "#3b3f52", boots: "#3a2a1e", hat: "cap", cap: "#5a5f6a", skin: SKINS[(v + 1) % 4] });
const ENGINEER = (v: number): Outfit => ({ jacket: ["#f08a2c", "#e2453c", "#f2c230"][v % 3], pants: "#3b5b9a", boots: "#4a3426", hat: "hardhat", skin: SKINS[(v + 2) % 4], moustache: v % 3 === 1 ? "#4a3426" : undefined });
const TOURIST = (v: number): Outfit => {
  const tee = ["#e2453c", "#3fa7d6", "#f2c230", "#7bc45a", "#d96fb0", "#ffffff", "#f08a2c"][v % 7];
  const o: Outfit = { jacket: tee, pants: ["#3b5b9a", "#d9c08a", "#4a4f5e", "#7a9a5a"][v % 4], boots: ["#f4f1ea", "#2b2d36", "#c0353a"][v % 3], skin: SKINS[v % 4],
    hat: v % 3 === 0 ? "cap" : "hair", cap: ["#2f6a43", "#e2453c", "#3f6fb5"][v % 3], hair: ["#4a3020", "#e4c27a", "#2a201a", "#a0522d"][v % 4] };
  return v % 4 === 1 ? { ...o, dress: ["#d96fb0", "#3fa7d6", "#f2c230"][v % 3] } : o;
};
const vOf = (i: number) => (i * 7 + (i >> 2)) % 4;
/** head-shape seed: 7 shapes, so marching soldiers in step still share canvases */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
/** the sun of the world that is calling: the attached root whose sun target sits on this camera's view axis */
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** front / side view and mirroring for someone at (x, z) walking along (dx, dz); fs = foreshortening of the walk */
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
/** reference expression and action changes land 0-3 f before the word onset */
const LEAD = 2 / FPS;
/** eyelid 0 open .. 1 shut. Reference: gaps 0.5-2.3 s, 4-frame blink half / shut / shut / half, plus a blink across
 *  every expression swap (the shut frames hide the swap) */
const LID = [0.5, 1, 1, 0.5];
const SWAPS: Record<number, number[]> = { 1: [at("falling")], 4: [T_TIP], 5: [T_WAR], 6: [T_TOOLS], 10: [at("embarrassing")], 11: [T_FURTHER], 14: [T_STOP] };
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13)); // next blink 0.5-2.3 s later
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a standing / sitting card (review rounds 2-4), multiply, blue-violet: a TIGHT contact pool right under
 *  the feet (~.5 on screen at the core) so nobody floats, plus by day (cards cast no real shadow) a lighter soft tail
 *  stretched AWAY from the sun, length ~1.6 m / tan(sun elevation), capped. Golden: world.ts casts real card shadows. */
const CONTACT: Record<"day" | "golden", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h; // feet at v = .2 of the card
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- crowd by shot ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };
const P = (who: Who) => who;
/** a standing character facing the lens, with contact shadow */
const stand = (cam: CamInfo, out: Stage, who: Who, x: number, z: number, fo: FrontOpts, y = D0, sc = 1, shadow = true, mirror = false) => {
  out.places.push({ ...person(cam, who, x, y, z, { side: false, mirror: false }, fo, {}, sc), mirror });
  if (shadow) blob(out, x, y, z, sc);
};
/** a character walking from a to b (side view when seen across, front/back otherwise) */
const walk = (cam: CamInfo, out: Stage, who: Who, x: number, z: number, dx: number, dz: number, t: number, speed: number, expr: Expr, y = D0) => {
  const view = viewOf(cam, x, z, dx, dz), phase = q(((t * speed) / 1.4 + hh(who.i, 5)) % 1, 120);
  const fo: FrontOpts = { mode: "stroll", phase, expr, blink: lidAt(t, who.i) };
  const so: SideOpts = { mode: "march", phase, expr, stomp: 0.55, stride: 0.875 * view.fs, blink: lidAt(t, who.i) };
  out.places.push(person(cam, who, x, y, z, view, fo, so));
  blob(out, x, y, z);
};
const B = (i: number, old = false): Who => ({ i, o: old ? OLD[i % 6] : BUILDERS[i % 6], okey: (old ? "o" : "b") + (i % 6) });
const L = LEAD;
const lean2tilt = (s: TowerState) => q(Math.min(16, s.lean * 2.2), 4);

const hook = (cam: CamInfo, t: number, s: TowerState, out: Stage) => {
  const spots: [number, number][] = [[-2.6, 28.6], [-0.9, 27.4], [0.9, 28.2], [2.6, 27.2], [4.2, 28.8]];
  spots.forEach(([x, z], i) => {
    const fall = t > at("falling") - L;
    const expr: Expr = fall ? (i % 2 ? "shock" : "nervous") : i === 2 ? "dazed" : "nervous";
    stand(cam, out, B(i), x, z, { mode: "stand", expr, blink: lidAt(t, i, SWAPS[1]), headTilt: lean2tilt(s), tilt: fall ? q(3 + i, 4) : 2, prop: i === 3 ? "plan" : null });
  });
};
const plan = (cam: CamInfo, t: number, out: Stage) => {
  const cheer = t > at("fanciest") - L;
  for (let i = 0; i < 16; i++) {
    const a = Math.PI * (0.15 + 0.7 * (i / 15)), r = 11 + (i % 3) * 1.6, x = Math.cos(a) * r * 1.1, z = Math.sin(a) * r;
    const kid = i % 6 === 4, o = kid ? KID : FOLK[i % 6];
    const hop = kid && cheer ? Math.max(0, Math.sin(t * 8 + i)) * 0.16 : 0;
    const expr: Expr = cheer ? (["grin", "laugh", "smile_closed", "relief_open"] as Expr[])[i % 4] : (["smile", "neutral", "smile_closed"] as Expr[])[i % 3];
    stand(cam, out, { i: 200 + i, o, okey: kid ? "kid" : `f${i % 6}` }, x, z, { mode: "stand", expr, wave: cheer && i % 3 !== 2 ? q(Math.sin(t * 9 + i * 1.3), 30) : undefined, blink: lidAt(t, 200 + i) }, D0 + hop, kid ? 0.72 : 1);
  }
  stand(cam, out, B(3), 2.2, 9.6, { mode: "stand", expr: "grin", prop: "plan", blink: lidAt(t, 3), facing: -1 });
};
const pit = (cam: CamInfo, t: number, out: Stage) => {
  const spots: [number, number][] = [[0.3, 3.4], [-3.4, 1.2], [3.6, 0.2], [-1.2, -2.6], [4.6, -4.2], [-5.6, -3.4]];
  const tSoft = at("soft");
  spots.forEach(([x, z], i) => {
    const k = q(0.5 + 0.5 * Math.sin(t * 4.2 + i * 1.9), 12);
    const sink = i === 0 ? 0.22 * smooth((t - tSoft) / 0.3) : 0;
    const expr: Expr = i === 0 && t > tSoft - L ? "nervous" : (["neutral", "stern", "smile_closed"] as Expr[])[i % 3];
    stand(cam, out, B(i), x, z, { mode: "stand", expr, prop: ["shovel", k], blink: lidAt(t, i) }, D0 - 3 - sink, 1, true);
    if (i % 2 === 0) { // clods flying off the shovels
      const u = q((t * 0.7 + i * 0.3) % 1, 30);
      if (u < 0.5) out.fx.push({ key: `puff${q(u * 2, 30)}`, cw: 400, ch: 400, draw: (p) => fxPuff(p, q(u * 2, 30)), x: x - 0.4, y: D0 - 2.7 + u * 1.2, z: z + 0.1, w: 0.5, h: 0.5 });
    }
  });
  const u = (t - tSoft) / 0.6;
  if (u > 0 && u < 1) out.fx.push({ key: `splashM${q(u, 30)}`, cw: 800, ch: 800, draw: (p) => mudSplash(p, q(u, 30)), x: 0.3, y: D0 - 3 + 0.3, z: 3.5, w: 1.2, h: 1.2 });
};
/** brown mud blobs flying out of a squelch, 800 x 800 canvas */
const mudSplash = (p: Pen, t: number) => {
  const e = 1 - (1 - t) ** 2;
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (1.08 + 0.84 * (i / 8)), r = 80 + 300 * e * (0.7 + 0.3 * ((i * 7) % 3) / 2), gy = 260 * t * t;
    p.ell(400 + Math.cos(a) * r, 560 + Math.sin(a) * r + gy, 34 * (1 - 0.5 * t), 26 * (1 - 0.5 * t), i % 2 ? "#6b4229" : "#8a5a38", 9);
  }
  if (t < 0.6) p.ell(400, 600, 170 * (0.6 + t), 44, "#5e3a24", 9);
};
const tipping = (cam: CamInfo, t: number, s: TowerState, out: Stage, id: number) => {
  const spots: [number, number][] = [[-4.2, 25], [-1.6, 26.2], [1.2, 25.4], [3.8, 26.6]];
  spots.forEach(([x, z], i) => {
    const after = id === 4 ? t > T_TIP - L : true;
    const war = id === 5 && t > T_WAR - L;
    const expr: Expr = id === 4 ? (after ? (i % 2 ? "shock" : "nervous") : "smile_closed") : war ? (i % 2 ? "shock" : "nervous") : "nervous";
    stand(cam, out, B(i), x, z, { mode: "stand", expr, headTilt: after ? lean2tilt(s) : 0, blink: lidAt(t, i, SWAPS[id]), prop: i === 1 && id === 4 ? ["shovel", 0.2] : null });
  });
  if (id === 5) { // soldiers march across behind the builders
    const t0 = SHOTS[4].a / FPS;
    for (let i = 0; i < 12; i++) {
      const row = i >> 1, x = -30 + 2.6 * (t - t0) - row * 1.5, z = 30.6 + (i & 1) * 1.1;
      const ph = q(((t - t0) * 1.6 + 0.1 * (i & 1)) % 1, 120), view = viewOf(cam, x, z, 1, 0);
      const who: Who = { i: 300 + i, o: SPEAR, okey: "spear" };
      out.places.push(person(cam, who, x, D0, z, view, { mode: "march", phase: ph, expr: "stern", blink: lidAt(t, 300 + i) }, { mode: "march", phase: ph, expr: "stern", stride: view.fs, stomp: 1 }));
      blob(out, x, D0, z);
    }
  }
};
const tools = (cam: CamInfo, t: number, out: Stage) => {
  const away = at("for almost") - 0.2;
  const spots: [number, number][] = [[-1.7, 25.4], [0, 25.8], [1.6, 25.1]];
  spots.forEach(([x, z], i) => {
    if (t < away) stand(cam, out, B(i), x, z, { mode: "stand", expr: t > T_TOOLS - L ? "relief_open" : "nervous", prop: t < T_TOOLS ? ["shovel", 0.3] : null, blink: lidAt(t, i, SWAPS[6]) });
    else walk(cam, out, B(i), x - 2.3 * (t - away) - 1.2 * i, z + 0.6 * (t - away), -1, 0.25, t, 1.6, "relief_open");
    // the shovel falls flat on the ground
    const u = clamp01((t - T_TOOLS) / 0.25);
    if (t > T_TOOLS - 0.05) out.fx.push({ key: "shovelFx", cw: 200, ch: 600, draw: shovelCard, x: x + 0.35 + 0.1 * i, y: D0 + 0.03 + 0.8 * (1 - u) * (1 - u), z: z - 0.15, w: 0.4, h: 1.2, flat: u >= 1, rot: u >= 1 ? 0.9 + i : (1 - u) * 0.3 + u * 1.4 });
  });
};
const shovelCard = (p: Pen) => {
  p.band([[100, 40], [100, 420]], "#8a5a34", 26, 8, "round");
  p.poly([[50, 420], [150, 420], [140, 540], [100, 585], [60, 540]], "#8d949c", 9);
};
const pause = (cam: CamInfo, t: number, s: TowerState, out: Stage) => {
  for (const [x, z, r] of [[-1.3, 25.2, 0.9], [0.4, 25.0, 2.0], [2.1, 24.8, 2.7]] as const)
    out.fx.push({ key: "shovelFx", cw: 200, ch: 600, draw: shovelCard, x, y: D0 + 0.03, z, w: 0.4, h: 1.2, flat: true, rot: r });
  // "squeeze tight": the ground presses together at the base
  const u = (t - T_SQUEEZE) / 0.9;
  if (u > 0 && u < 1) for (const [x, z] of [[7.4, 3.6], [6.2, 5.6], [8.1, 1.2]] as const)
    out.fx.push({ key: `creak${q(u, 30)}`, cw: 300, ch: 300, draw: (p) => fxCreak(p, q(u, 30)), x, y: D0 + 0.5, z, w: 1.1, h: 1.1 });
  if (u > 0 && u < 0.7) out.fx.push({ key: `puff${q(u / 0.7, 30)}`, cw: 400, ch: 400, draw: (p) => fxPuff(p, q(u / 0.7, 30)), x: 7.9, y: D0 + 0.35, z: 4.6, w: 1.4, h: 1.4, soft: true });
  void s;
};
const comeBack = (cam: CamInfo, t: number, s: TowerState, out: Stage) => {
  const t0 = SHOTS[7].a / FPS;
  const spots: [number, number][] = [[-3.8, 25.4], [-1.4, 26.4], [1.2, 25.6], [3.6, 26.8], [5.6, 25.2]];
  spots.forEach(([x, z], i) => {
    const arrive = t0 + 0.25 * i + 1.2;
    if (t < arrive) walk(cam, out, B(i, true), x - 2.4 * (arrive - t), z, 1, 0, t, 1.3, "smile");
    else stand(cam, out, B(i, true), x, z, { mode: "stand", expr: t > at("hide") - L ? (i % 2 ? "smile_closed" : "grin") : "neutral", prop: i === 1 ? "plan" : null, blink: lidAt(t, 50 + i), headTilt: i === 1 ? 0 : q(-s.curve * 6, 4) });
  });
};
const bananaGuy = (cam: CamInfo, t: number, out: Stage, id: number) => {
  if (t < at("like a banana") - 0.05) return;
  stand(cam, out, B(2, true), 0.08, 44.6, { mode: "stand", expr: "grin", prop: "banana", blink: lidAt(t, 52), headTilt: -8 });
  void id;
};
const duce = (cam: CamInfo, t: number, out: Stage, id: number) => {
  const shock = id === 11 && t > T_FURTHER - L;
  const fo: FrontOpts = { mode: "stand", expr: shock ? "shock" : t > at("embarrassing") - L ? "stern" : "neutral", prop: shock ? null : t > at("orders") - L || id === 10 ? "point" : null, blink: lidAt(t, 90, SWAPS[id]), facing: 1 };
  if (id === 10) {
    stand(cam, out, { i: 90, o: DUCE, okey: "duce" }, -1.2, 28, fo);
    for (const [k, x, z] of [[0, -3.4, 28.8], [1, 0.8, 29.4]] as const)
      stand(cam, out, { i: 91 + k, o: AIDE(k), okey: "aide" + k }, x, z, { mode: "stand", expr: t > at("embarrassing") - L ? "nervous" : "neutral", blink: lidAt(t, 91 + k) });
    // workers at the truck
    for (const [k, x, z] of [[0, 12.6, 6.4], [1, 11.0, 8.4], [2, 14.4, 4.2]] as const)
      stand(cam, out, { i: 95 + k, o: WORKER(k), okey: "wk" + k }, x, z, { mode: "stand", expr: (["neutral", "stern", "smile_closed"] as Expr[])[k], prop: k === 1 ? "point" : null, blink: lidAt(t, 95 + k) });
    const u = (t - at("pump")) % 0.8;
    if (t > at("pump")) out.fx.push({ key: `puffC${q(u / 0.8, 30)}`, cw: 400, ch: 400, draw: (p) => fxPuff(p, q(u / 0.8, 30)), x: 8.4, y: D0 + 0.4, z: 2.9, w: 1.0, h: 1.0, soft: true });
  } else {
    stand(cam, out, { i: 90, o: DUCE, okey: "duce" }, -2.4, 32, fo);
    for (const [k, x, z] of [[0, -4.3, 33], [1, -0.6, 33.4]] as const)
      stand(cam, out, { i: 91 + k, o: AIDE(k), okey: "aide" + k }, x, z, { mode: "stand", expr: shock ? "shock" : "nervous", blink: lidAt(t, 91 + k, SWAPS[11]), headTilt: shock ? 10 : 0 });
    for (const [k, x, z] of [[0, 12.4, 12.8], [1, 10.4, 14.6]] as const)
      stand(cam, out, { i: 95 + k, o: WORKER(k), okey: "wk" + k }, x, z, { mode: "stand", expr: shock ? "shock" : "neutral", blink: lidAt(t, 95 + k, SWAPS[11]) });
    if (t > T_FURTHER && t < T_FURTHER + 0.35) {
      const u = (t - T_FURTHER) / 0.35;
      out.fx.push({ key: `burstG${q(u, 30)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 30), "#f4efe6"), x: 7.8, y: D0 + 0.5, z: 3, w: 4, h: 4 });
    }
  }
};
const mattressKid = (cam: CamInfo, t: number, out: Stage) => {
  const shift = smooth((t - T_PUSH) / 0.6), sink = smooth((t - T_SINK) / 0.4);
  const y = mattressTop(t), roll = -(0.05 + 0.13 * shift + 0.06 * sink);
  const expr: Expr = t > T_SINK - L ? "shock" : t > T_PUSH - L ? "nervous" : "smile";
  const pl = person(cam, { i: 120, o: KID, okey: "kid" }, MATT[0] + 0.12 * shift, y, MATT[2], { side: false, mirror: false },
    { mode: "stand", expr, blink: lidAt(t, 120), wave: shift > 0.5 ? q(Math.sin(t * 10), 30) : undefined }, {}, 0.8);
  out.places.push({ ...pl, roll });
  blob(out, MATT[0] + 0.15 * shift, y, MATT[2], 0.75, 0.8);
};
const nineties = (cam: CamInfo, t: number, out: Stage, id: number) => {
  if (id === 13) {
    for (const [k, x, z] of [[0, DRILL[0] - 2.4, DRILL[2] + 3], [1, DRILL[0] + 2.2, DRILL[2] + 3.6], [2, DRILL[0] - 2.0, DRILL[2] + 6.2]] as const)
      stand(cam, out, { i: 130 + k, o: ENGINEER(k), okey: "eng" + k }, x, z, { mode: "stand", expr: (["stern", "smile_closed", "neutral"] as Expr[])[k], prop: k === 2 ? "plan" : null, blink: lidAt(t, 130 + k) });
    const t0 = at("pulled");
    if (t > t0) for (let n = 0; n < 3; n++) {
      const u = ((t - t0) * 1.4 + n / 3) % 1;
      out.fx.push({ key: `puffS${q(u, 30)}`, cw: 400, ch: 400, draw: (p) => fxPuff(p, q(u, 30)), x: DRILL[0] - 0.6 - u * 0.9, y: D0 + 0.3 + u * 1.0, z: DRILL[2] - 1.4 - u * 0.8, w: 0.9, h: 0.9, soft: true });
    }
  } else {
    const spots: [number, number][] = [[-3.6, 28.2], [-1.2, 29.2], [1.4, 28.4], [3.8, 29.6]];
    spots.forEach(([x, z], k) => {
      const yay = t > T_STOP - L;
      stand(cam, out, { i: 130 + k, o: ENGINEER(k), okey: "eng" + k }, x, z, { mode: "stand", expr: yay ? (k % 2 ? "relief_open" : "grin") : "nervous", wave: yay && k !== 2 ? q(Math.sin(t * 9 + k), 30) : undefined, blink: lidAt(t, 130 + k, SWAPS[14]) }, D0 + (yay && k === 1 ? Math.max(0, Math.sin((t - T_STOP) * 9)) * 0.15 : 0));
    });
  }
};
const tourists = (cam: CamInfo, t: number, out: Stage) => {
  // a row of tourists all pushing the air toward the tower (mirrored so everyone pushes toward it), phones on the flanks
  const spots: [number, number, Prop][] = [[-0.9, 34.2, "hold"], [-3.4, 33.0, "hold"], [1.6, 33.4, "hold"], [3.9, 35.0, "hold"], [-2.2, 29.6, "hold"],
    [2.8, 29.2, "hold"], [-5.4, 28.4, "hold"], [5.6, 30.4, "hold"], [-4.3, 40.6, "phone"], [3.9, 41.2, "phone"], [-6.8, 35.4, "phone"], [6.8, 33.4, "phone"]];
  const tSt = at("standing up");
  spots.forEach(([x, z, prop], i) => {
    const relief = prop === "hold" && t > tSt + 0.4 && i % 2 === 0;
    const expr: Expr = prop === "hold" ? (relief ? "relief" : (["stern", "pained", "grin", "stern"] as Expr[])[i % 4]) : (["smile", "grin", "smile_closed"] as Expr[])[i % 3];
    const toRight = x < 1.5;
    stand(cam, out, { i: 150 + i, o: TOURIST(i), okey: "tour" + i }, x, z,
      { mode: "stand", expr, prop, blink: lidAt(t, 150 + i), facing: prop === "phone" ? 0 : 1, tilt: prop === "hold" ? 5 : 0 }, D0, 1, true, prop === "hold" && !toRight);
  });
  const t0 = SHOTS[14].a / FPS;
  for (let k = 0; k < 2; k++) walk(cam, out, { i: 170 + k, o: TOURIST(3 + k), okey: "tw" + k }, -18 + 1.2 * (t - t0) + k * 1.1, 42 + k * 0.4, 1, 0, t, 1.2, "smile");
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, s: TowerState, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  LNAME = SHOTS[id - 1].light;
  findSun(cam, SUN);
  switch (id) {
    case 1: hook(cam, t, s, out); break;
    case 2: plan(cam, t, out); break;
    case 3: pit(cam, t, out); break;
    case 4: case 5: tipping(cam, t, s, out, id); break;
    case 6: tools(cam, t, out); break;
    case 7: pause(cam, t, s, out); break;
    case 8: comeBack(cam, t, s, out); break;
    case 9: bananaGuy(cam, t, out, id); break;
    case 10: case 11: duce(cam, t, out, id); break;
    case 12: mattressKid(cam, t, out); break;
    case 13: case 14: nineties(cam, t, out, id); break;
    case 15: tourists(cam, t, out); break;
  }
  void P; void fxStars; void end; void TRUCK; void bodyFront; void bodySide;
  return out;
};
export { FPS };
