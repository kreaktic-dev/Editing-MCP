// The whole place as one three.js scene: sky, lawn with the foundation pit, the leaning tower (tower.ts), cathedral,
// baptistery, walls and town (build.ts), era props (medieval site, 1934 concrete truck, 1990 cables + soil drill,
// modern souvenir stalls), the explanation's mattress, and the cast. update(id, f, camera) poses everything for shot
// `id` at frame f (a pure function of id + f).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { staticFile } from "remotion";
import { Batch, boxGeo, V, lam, buildPisa, Kit, Ray, kitClone, prop, quad } from "./build";
import { ctex, grassHD, stoneHD, cloudHD, rep } from "./paint";
import { Pen } from "./toon";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { Tower } from "./tower";
import { FPS, D0, SHOTS, camAt, towerState, FOREGROUND, ShotDef, V3, MATT, DRILL, TRUCK, smooth, clamp01, at, T_PUSH, T_SINK, Era } from "./story";

// ---------------- assets ----------------
const KENNEY: Record<string, string> = {
  cart: "fantasy-town/cart", "stall-red": "fantasy-town/stall-red", "stall-green": "fantasy-town/stall-green", "stall-bench": "fantasy-town/stall-bench",
  lantern: "fantasy-town/lantern", fountain: "fantasy-town/fountain-round-detail", "banner-red": "fantasy-town/banner-red", "banner-green": "fantasy-town/banner-green",
  wheel: "fantasy-town/wheel", banana: "food/banana", barrel: "food/barrel", shovel: "graveyard/shovel", "shovel-dirt": "graveyard/shovel-dirt",
  cone: "car/cone", truck: "car/truck", crate: "blaster/crate-medium", bed: "bedSingle", flower_redA: "flower_redA", flower_yellowA: "flower_yellowA",
  flower_purpleA: "flower_purpleA", rock: "rock_largeA", rockS: "rock_smallA",
};
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    kitP = Promise.all(Object.entries(KENNEY).map(([n, f]) => loader.loadAsync(staticFile(`pisa/kenney/${f}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const)))
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};

const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});
const mudTex = () => ctex("mudHD", 512, 512, (g, r) => {
  g.fillStyle = "#7a5034"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(60,36,22,${0.15 + r() * 0.2})` : `rgba(160,112,72,${0.12 + r() * 0.15})`;
    g.beginPath(); g.ellipse(r() * 512, r() * 512, 8 + r() * 30, 4 + r() * 12, r() * 3, 0, 6.3); g.fill();
  }
  for (let i = 0; i < 30; i++) { g.strokeStyle = "rgba(50,30,18,0.35)"; g.lineWidth = 2; g.beginPath(); const x = r() * 512, y = r() * 512; g.moveTo(x, y); g.quadraticCurveTo(x + 20, y + r() * 20, x + 40 + r() * 30, y + r() * 10); g.stroke(); }
});
const quiltTex = () => ctex("quilt", 512, 256, (g) => {
  g.fillStyle = "#f4f1ea"; g.fillRect(0, 0, 512, 256);
  for (let x = 0; x < 512; x += 64) { g.fillStyle = "#8fb4dd"; g.fillRect(x + 22, 0, 20, 256); }
  g.strokeStyle = "rgba(90,100,130,0.35)"; g.lineWidth = 3;
  for (let x = 0; x <= 512; x += 64) for (let y = 0; y <= 256; y += 64) { g.beginPath(); g.arc(x, y, 3, 0, 6.3); g.stroke(); }
});
const tapeTex = () => ctex("tape", 256, 32, (g) => {
  for (let x = -32; x < 256; x += 32) { g.fillStyle = "#e23b2e"; g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 0); g.lineTo(x + 32, 0); g.lineTo(x + 16, 32); g.fill(); }
  g.globalCompositeOperation = "destination-over"; g.fillStyle = "#f4f1ea"; g.fillRect(0, 0, 256, 32);
});
const stakeRopeTex = () => ctex("rope", 64, 8, (g) => { g.fillStyle = "#d9c08a"; g.fillRect(0, 0, 64, 8); g.fillStyle = "#a9884f"; for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 3, 8); });

/** every lens position of the film looking at its subject (houses and props there are left out) */
const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) for (let f = s.a - 8; f < s.b + 8; f += 3) {
    const c = camAt(s.id, Math.max(0, f)), o = V(...c.pos), look = V(...c.look);
    const fw = look.clone().sub(o), len = fw.length();
    fw.normalize();
    const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
    const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
    for (const [sx, sy] of [[0, 0], [-0.6, 0], [0.6, 0], [0, 0.6], [0, -0.4]])
      out.push({ o, d: fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty), len, core: sx === 0 && sy === 0 });
  }
  return out;
};

/** a 1930s concrete mixer lorry, built from smooth parts (clean ink, no texture shimmer). Local -x = cab, +x = rear chute.
 *  The drum carries a red spiral fin so its turning reads without any striped texture. */
const mixerTruck = () => {
  const g = new THREE.Group(), add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
  const body = lam("mixBody", () => ({ color: "#3d7a86" })), dark = lam("mixDark", () => ({ color: "#2a2c33" })), glass = lam("mixGlass", () => ({ color: "#2e3a4a" }));
  const hub = lam("mixHub", () => ({ color: "#c9ccd2" })), cream = lam("mixDrum", () => ({ color: "#e6dfcf" })), red = lam("mixRed", () => ({ color: "#c0353a" }));
  add(new RoundedBoxGeometry(5.6, 0.3, 1.3, 2, 0.06), dark, 0.4, 0.95, 0);                 // chassis
  add(new RoundedBoxGeometry(1.6, 1.55, 2.0, 3, 0.2), body, -1.55, 1.9, 0);               // cab
  add(new RoundedBoxGeometry(1.5, 0.95, 1.5, 3, 0.22), body, -3.05, 1.45, 0);             // bonnet
  add(new RoundedBoxGeometry(0.12, 0.8, 1.2, 2, 0.04), dark, -3.82, 1.45, 0);             // grille
  add(new THREE.BoxGeometry(0.05, 0.62, 1.6), glass, -2.37, 2.25, 0);                      // windscreen
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.9, 0.55, 0.05), glass, -1.5, 2.25, s * 1.015); // side windows
  for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.13, 12, 8), lam("mixLamp", () => ({ color: "#f4e6b0" })), -3.85, 1.75, s * 0.55);
  // wheels: rubber tyre + hub, fenders above
  const tyre = new THREE.CylinderGeometry(0.5, 0.5, 0.32, 28); tyre.rotateX(Math.PI / 2);
  const hubG = new THREE.CylinderGeometry(0.22, 0.22, 0.36, 16); hubG.rotateX(Math.PI / 2);
  for (const [x, s] of [[-2.9, 1], [-2.9, -1], [1.7, 1], [1.7, -1], [2.8, 1], [2.8, -1]] as const) {
    add(tyre, dark, x, 0.5, s * 0.92); add(hubG, hub, x, 0.5, s * 0.92);
  }
  for (const [x, w2, s] of [[-2.9, 1.2, 1], [-2.9, 1.2, -1], [2.25, 2.3, 1], [2.25, 2.3, -1]] as const) add(new RoundedBoxGeometry(w2, 0.14, 0.46, 2, 0.05), body, x, 1.08, s * 0.92);
  // drum on its cradle, tilted up toward the cab, chute at the rear
  for (const x of [-0.1, 2.3]) add(new RoundedBoxGeometry(0.25, x < 1 ? 1.2 : 0.75, 1.0, 2, 0.06), dark, x, x < 1 ? 1.7 : 1.45, 0);
  const tilt = new THREE.Group(); tilt.position.set(1.15, 2.05, 0); tilt.rotation.z = 0.18; g.add(tilt);
  const spin = new THREE.Group(); tilt.add(spin);
  const prof = [[0.05, -1.7], [0.45, -1.55], [0.92, -0.9], [1.05, -0.1], [0.95, 0.7], [0.62, 1.35], [0.3, 1.6], [0.28, 1.75]].map(([r, y]) => new THREE.Vector2(r, y));
  const drumG = new THREE.LatheGeometry(prof, 32); drumG.rotateZ(Math.PI / 2);
  add(drumG, cream, 0, 0, 0, spin);
  const R0 = (u: number) => 0.06 + Math.max(0.3, Math.sin(Math.PI * Math.min(1, Math.max(0, (u + 1.7) / 3.45))) * 1.06);
  const helix = new THREE.CatmullRomCurve3(Array.from({ length: 60 }, (_, k) => { const u = -1.45 + 2.85 * (k / 59), a = (k / 59) * Math.PI * 5;
    return new THREE.Vector3(-u, Math.cos(a) * R0(-u), Math.sin(a) * R0(-u)); }));
  add(new THREE.TubeGeometry(helix, 240, 0.07, 6), red, 0, 0, 0, spin); // spiral fin
  add(new RoundedBoxGeometry(0.9, 0.12, 0.45, 2, 0.04), dark, 3.25, 1.45, 0).rotation.z = -0.45; // chute
  g.userData.drum = spin;
  return g;
};

const PIT = 10, PIT_D = 3; // the foundation pit: 20 x 20 m square, 3 m deep
const ERAS: Record<string, Era[]> = {
  site: ["plan", "pit"], medieval: ["medieval", "pause"], m1934: ["1934"], m1990: ["1990"], modern: ["modern"],
};

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private fgs: { o: THREE.Object3D; a: number; b: number }[] = [];
  private tower = new Tower();
  private cap = new THREE.Group(); private pit = new THREE.Group(); private stakes = new THREE.Group();
  private eras: Record<string, THREE.Group> = {};
  private mattress: THREE.Mesh; private mattBase: Float32Array;
  private mixer: THREE.Group;
  private concrete: THREE.Mesh; private soil: THREE.Mesh; private drillBit: THREE.Mesh;
  private cables: THREE.Mesh[] = []; private cableEnds: V3[] = [[-70, 0, -26], [-70, 0, 26], [-56, 0, -48], [-56, 0, 48]];
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private v2 = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root;
    // ---- sky + light (as the bridge short: 5 stops by elevation, tone-map inverted) ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, depthTest: true,
      transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK); m.userData.a = a; m.userData.d = d;
      this.clouds.push(m); R.add(m);
    }

    // ---- ground: lawn with a square hole for the pit, the pit itself, and a cap that closes it once built ----
    const b = new Batch();
    const grass = lam("grassPisa", () => ({ map: grassHD(), color: "#8fa078" }));
    const G = 900, gq = (x0: number, x1: number, z0: number, z1: number) =>
      b.add(quad(V(x0, D0, z1), V(x1, D0, z1), V(x1, D0, z0), V(x0, D0, z0), (x1 - x0) / 4, (z1 - z0) / 4), grass);
    gq(-G, G, -G, -PIT); gq(-G, G, PIT, G); gq(-G, -PIT, -PIT, PIT); gq(PIT, G, -PIT, PIT);
    b.build(R);
    const cb = new Batch();
    const pave = lam("pisaPave", () => ({ map: rep(stoneHD("copeHD"), 1, 1) }));
    cb.add(quad(V(-PIT, D0, PIT), V(PIT, D0, PIT), V(PIT, D0, -PIT), V(-PIT, D0, -PIT), 5, 5), grass);
    const ring = new THREE.RingGeometry(0, 10.2, 64); ring.rotateX(-Math.PI / 2);
    cb.add(ring, pave, new THREE.Matrix4().makeTranslation(0, D0 + 0.03, 0));
    cb.build(this.cap);
    R.add(this.cap);
    const pb = new Batch(), mud = lam("mud", () => ({ map: mudTex() }));
    const y0 = D0 - PIT_D, P = PIT;
    pb.add(quad(V(-P, y0, P), V(P, y0, P), V(P, y0, -P), V(-P, y0, -P), 4, 4), mud);
    pb.add(quad(V(-P, y0, -P), V(P, y0, -P), V(P, D0, -P), V(-P, D0, -P), 4, 0.6), mud);
    pb.add(quad(V(P, y0, P), V(-P, y0, P), V(-P, D0, P), V(P, D0, P), 4, 0.6), mud);
    pb.add(quad(V(-P, y0, P), V(-P, y0, -P), V(-P, D0, -P), V(-P, D0, P), 4, 0.6), mud);
    pb.add(quad(V(P, y0, -P), V(P, y0, P), V(P, D0, P), V(P, D0, -P), 4, 0.6), mud);
    // dug-out heaps around the rim
    const heap = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    for (const [x, z, s] of [[-14, -6, 2.6], [13.5, -9, 3.2], [-12.5, 9, 2.2], [15, 6, 2.4]] as const)
      pb.add(heap, mud, new THREE.Matrix4().compose(V(x, D0, z), new THREE.Quaternion(), V(s * 1.4, s * 0.7, s)));
    // ladder
    const wood = lam("pisaPole", () => ({ color: "#9a6a42" }));
    for (const x of [-0.35, 0.35]) pb.add(boxGeo(V(-8.5 + x - 0.06, y0, 8.6), V(-8.5 + x + 0.06, D0 + 1.2, 8.75)), wood);
    for (let y = y0 + 0.4; y < D0 + 1; y += 0.42) pb.add(boxGeo(V(-8.9, y, 8.62), V(-8.1, y + 0.06, 8.72)), wood);
    pb.build(this.pit);
    R.add(this.pit);
    // stakes + rope marking the circle (1173 "plan")
    const sb = new Batch(), rope = lam("rope", () => ({ map: stakeRopeTex() }));
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, a2 = ((i + 1) / 16) * Math.PI * 2, x = Math.cos(a) * 8, z = Math.sin(a) * 8;
      sb.add(boxGeo(V(x - 0.06, D0, z - 0.06), V(x + 0.06, D0 + 0.7, z + 0.06)), wood);
      const x2 = Math.cos(a2) * 8, z2 = Math.sin(a2) * 8;
      sb.add(quad(V(x, D0 + 0.55, z), V(x2, D0 + 0.55, z2), V(x2, D0 + 0.6, z2), V(x, D0 + 0.6, z), 6, 1), rope);
      sb.add(quad(V(x2, D0 + 0.55, z2), V(x, D0 + 0.55, z), V(x, D0 + 0.6, z), V(x2, D0 + 0.6, z2), 6, 1), rope);
    }
    sb.build(this.stakes);
    R.add(this.stakes);

    // ---- buildings ----
    R.add(this.tower.root);
    buildPisa(R, kit, sightLines());

    // ---- era props ----
    for (const k of Object.keys(ERAS)) { this.eras[k] = new THREE.Group(); R.add(this.eras[k]); }
    const eb = (k: string, fill: (b: Batch) => void) => { const bb = new Batch(); fill(bb); bb.build(this.eras[k]); };
    const marbleBlock = lam("pisaBlock", () => ({ color: "#ece3d2" }));
    eb("medieval", (bb) => {
      prop(bb, kit, "cart", -16, D0, 9, 2.2, 0.6);
      prop(bb, kit, "barrel", -13.5, D0, 12.5, 1.1); prop(bb, kit, "barrel", -12.4, D0, 13.2, 1.1, 1);
      prop(bb, kit, "barrel", 13, D0, 12, 1.1, 0.3); prop(bb, kit, "barrel", 14.1, D0, 11.4, 1.1, 0.8);
      for (const [x, z, w] of [[16, 3, 2.2], [17.5, 5.5, 1.8], [-17, -4, 2.0], [15.6, 5, 1.6]] as const) bb.add(boxGeo(V(x - w / 2, D0, z - 0.6), V(x + w / 2, D0 + 1.0, z + 0.6)), marbleBlock);
      prop(bb, kit, "stall-bench", -15, D0, 16, 1.0, 0.4);
    });
    eb("site", (bb) => {
      prop(bb, kit, "cart", -16, D0, 12, 2.2, 0.9);
      prop(bb, kit, "shovel-dirt", 12.5, D0, 12, 1.4, 0.4);
      prop(bb, kit, "barrel", 13.5, D0, 14, 1.1);
      for (let i = 0; i < 5; i++) prop(bb, kit, ["flower_redA", "flower_yellowA", "flower_purpleA"][i % 3], -6 + i * 3.5, D0, 17 + (i % 2), 0.5);
    });
    eb("m1934", (bb) => {
      prop(bb, kit, "barrel", TRUCK[0] + 3, D0, TRUCK[2] - 3, 1.1);
      prop(bb, kit, "barrel", TRUCK[0] + 3.8, D0, TRUCK[2] - 2.2, 1.1);
      prop(bb, kit, "lantern", -6, D0, 20, 2.8); prop(bb, kit, "lantern", 6, D0, 20, 2.8);
      prop(bb, kit, "banner-red", -9, D0, 19.5, 3.6);
    });
    eb("m1990", (bb) => {
      for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2; prop(bb, kit, "cone", Math.cos(a) * 13.5, D0, Math.sin(a) * 13.5, 0.75, a); }
      const tape = lam("tape", () => ({ map: tapeTex(), side: THREE.DoubleSide }));
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2, a2 = ((i + 1) / 22) * Math.PI * 2;
        bb.add(quad(V(Math.cos(a) * 13.5, D0 + 0.55, Math.sin(a) * 13.5), V(Math.cos(a2) * 13.5, D0 + 0.55, Math.sin(a2) * 13.5),
          V(Math.cos(a2) * 13.5, D0 + 0.68, Math.sin(a2) * 13.5), V(Math.cos(a) * 13.5, D0 + 0.68, Math.sin(a) * 13.5), 3, 1), tape);
      }
      // the drill rig on the high side: tripod + motor box
      const steel = lam("rigSteel", () => ({ color: "#d9a33a" })), dark = lam("rigDark", () => ({ color: "#4a5160" }));
      const top = V(DRILL[0], D0 + 4.2, DRILL[2]);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.4, foot = V(DRILL[0] + Math.cos(a) * 1.8, D0, DRILL[2] + Math.sin(a) * 1.8);
        const g = new THREE.CylinderGeometry(0.08, 0.08, top.distanceTo(foot), 6);
        bb.add(g, steel, new THREE.Matrix4().compose(top.clone().add(foot).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), top.clone().sub(foot).normalize()), V(1, 1, 1)));
      }
      bb.add(boxGeo(V(DRILL[0] - 0.5, D0 + 3.2, DRILL[2] - 0.4), V(DRILL[0] + 0.5, D0 + 4.0, DRILL[2] + 0.4)), dark);
      bb.add(boxGeo(V(DRILL[0] + 1.5, D0, DRILL[2] + 1.2), V(DRILL[0] + 3.0, D0 + 1.1, DRILL[2] + 2.4)), steel);
    });
    eb("modern", (bb) => {
      prop(bb, kit, "stall-red", -22, D0, 27.5, 3.2, Math.PI); prop(bb, kit, "stall-green", -28, D0, 27.8, 3.2, Math.PI);
      prop(bb, kit, "stall-red", 22, D0, 27.5, 3.2, Math.PI); prop(bb, kit, "stall-bench", 26, D0, 19.5, 1.0);
      for (const x of [-34, -12, 12, 34]) prop(bb, kit, "lantern", x, D0, 20, 2.8);
      prop(bb, kit, "fountain", 40, D0, -14, 1.6);
    });
    this.eras.medieval.add(new THREE.Group());
    // concrete puddle (1934) and soil heap (1990)
    const conc = lam("concrete", () => ({ color: "#a8a7a2" }));
    const cg = new THREE.CircleGeometry(1, 40); cg.rotateX(-Math.PI / 2);
    this.concrete = new THREE.Mesh(cg, conc); this.concrete.receiveShadow = true; this.concrete.position.set(8.6, D0 + 0.04, 2.5); this.eras.m1934.add(this.concrete);
    // hose from the truck to the base
    this.mixer = mixerTruck(); this.mixer.position.set(...TRUCK); this.mixer.rotation.y = Math.PI + 0.35; this.eras.m1934.add(this.mixer);
    const hose = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(TRUCK[0] - 3.4, 1.15, TRUCK[2] + 1.2), V(TRUCK[0] - 4.6, 0.25, TRUCK[2] + 0.4), V(13, 0.17, 4.6), V(8.6, 0.17, 2.8)]), 60, 0.17, 10);
    const hm = new THREE.Mesh(hose, lam("hose2", () => ({ color: "#4a3f38" }))); hm.castShadow = true; this.eras.m1934.add(hm);
    const sg = new THREE.ConeGeometry(1, 1, 24); sg.translate(0, 0.5, 0);
    this.soil = new THREE.Mesh(sg, lam("soilHeap", () => ({ map: mudTex() }))); this.soil.castShadow = true; this.soil.receiveShadow = true;
    this.soil.position.set(DRILL[0] - 1.5, D0, DRILL[2] - 2.6); this.eras.m1990.add(this.soil);
    this.drillBit = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.4, 8), lam("rigDark", () => ({ color: "#4a5160" })));
    this.drillBit.position.set(DRILL[0], D0 + 1.6, DRILL[2]); this.eras.m1990.add(this.drillBit);
    const cm = lam("cable", () => ({ color: "#30343c" }));
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6).translate(0, 0.5, 0), cm); m.frustumCulled = false; this.cables.push(m); this.eras.m1990.add(m); }
    // the mattress (golden explanation): a quilted slab whose top dents under the kid's feet
    const mg = new THREE.BoxGeometry(2.0, 0.32, 1.4, 24, 2, 16);
    this.mattress = new THREE.Mesh(mg, lam("quilt", () => ({ map: quiltTex() })));
    this.mattress.position.set(MATT[0], D0 + 0.16 + 0.12, MATT[2]); this.mattress.castShadow = true; this.mattress.receiveShadow = true;
    this.mattBase = Float32Array.from(mg.attributes.position.array as Float32Array);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.14, 1.5), lam("bedFrame", () => ({ color: "#9a6a42" })));
    frame.position.set(MATT[0], D0 + 0.07, MATT[2]); frame.castShadow = true;
    this.eras.modern.add(this.mattress, frame);
    // foreground framing objects
    for (const fg of FOREGROUND) {
      const o = kitClone(kit, fg.kit, fg.s ?? 1);
      if (!o) continue;
      o.position.set(...fg.pos); o.rotation.y = fg.yaw ?? 0; o.visible = false;
      this.fgs.push({ o, a: fg.a, b: fg.b }); R.add(o);
    }
  }

  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(s.sunAz ?? L.az), el = THREE.MathUtils.degToRad(s.sunEl ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }
  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    // ---- light rig ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 95);
    if (s.light === "golden") Rr = Math.max(Rr, 40);
    if (dist > 25) Rr = Math.max(Rr, 60); // the whole tower and its long shadow
    this.sun.position.copy(focus).addScaledVector(sunDir, 260); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 560; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden";
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    // clouds drift; during the century-long pause they race (time-lapse)
    const lapse = id === 7 ? (t - s.a / FPS) * 0.06 : t * 0.0015;
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial, a = m.userData.a + lapse * (1 + (i % 3) * 0.2);
      m.position.set(Math.cos(a) * m.userData.d, m.position.y, Math.sin(a) * m.userData.d);
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
    }
    for (const g of this.fgs) g.o.visible = f >= g.a && f < g.b && g.a < s.b && g.b > s.a;
    // ---- site + tower + era props ----
    const ts = towerState(id, t);
    this.pit.visible = s.era === "pit";
    this.cap.visible = !this.pit.visible;
    this.stakes.visible = s.era === "plan";
    this.tower.pose(ts);
    this.tower.root.visible = ts.floors > 0;
    for (const [k, eras] of Object.entries(ERAS)) this.eras[k].visible = eras.includes(s.era);
    this.eras.modern.children.forEach((o) => { if (o === this.mattress || (o as THREE.Mesh).geometry?.type === "BoxGeometry") o.visible = id === 12; });
    if (s.era === "1934") {
      const u = clamp01((t - at("pump")) / 2.5), r = 0.3 + 2.6 * smooth(u) + (id === 11 ? 2.9 : 0);
      this.concrete.scale.set(id === 11 ? 3.2 : r, 1, id === 11 ? 3.2 : r);
      this.concrete.visible = id === 11 || t > at("pump") - 0.1;
      (this.mixer.userData.drum as THREE.Object3D).rotation.x = t * 1.6;
    }
    if (s.era === "1990") {
      const u = id === 14 ? 1 : clamp01((t - at("pulled")) / 3);
      const h = 0.4 + 1.6 * smooth(u);
      this.soil.scale.set(h * 1.1, h, h * 1.1);
      this.drillBit.rotation.y = t * 14;
      this.drillBit.position.y = D0 + 1.6 - 0.05 * Math.sin(t * 30);
      this.cables.forEach((m, i) => {
        this.tower.anchorWorld(i, this.v);
        const e2 = this.v2.set(...this.cableEnds[i]);
        const d = this.v.clone().sub(e2);
        m.position.copy(e2); m.scale.set(1, d.length(), 1);
        m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
      });
    }
    if (id === 12) this.dentMattress(t);
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, ts, { pos: cam.position, right });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e2 = this.fx(fi++);
      e2.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e2.use(!!p.soft);
      e2.mesh.visible = true;
      e2.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e2.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e2.mesh.quaternion.copy(cam.quaternion); e2.mesh.rotateZ(p.rot ?? 0); }
      e2.mesh.scale.set(p.w, p.h, 1);
      fused.push(e2);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e2 of fused) e2.bind();
    return focus;
  }

  /** the kid's weight: centred dent, then (on "Put more weight on one side") a deep dent under the right foot */
  private dentMattress(t: number) {
    const p = this.mattress.geometry.attributes.position as THREE.BufferAttribute, a = p.array as Float32Array, B = this.mattBase;
    const shift = smooth((t - T_PUSH) / 0.6), deep = 0.06 + 0.1 * shift + 0.06 * smooth((t - T_SINK) / 0.4);
    const cx = 0.28 * shift;
    for (let i = 0; i < p.count; i++) {
      const x = B[i * 3], y = B[i * 3 + 1], z = B[i * 3 + 2];
      if (y < 0.1) { a[i * 3 + 1] = y; continue; }
      const d2 = ((x - cx) / 0.42) ** 2 + (z / 0.36) ** 2;
      a[i * 3 + 1] = y - deep * Math.exp(-d2) - 0.03 * (1 - shift) * Math.exp(-(((x + 0.2) / 0.3) ** 2 + (z / 0.3) ** 2));
    }
    p.needsUpdate = true;
    this.mattress.geometry.computeVertexNormals();
  }
}
void Pen; void rep;
