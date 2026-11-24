// The bell tower: 8 storeys of white marble (blind-arcade ground floor, six open galleries of columns and arches, bell
// chamber), built as nested groups so every storey can grow (scale.y), the whole tower can lean about its base and the
// upper floors can bend back (the 1272 builders' "banana" correction). Wooden scaffold for the medieval shots.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ctex, rep, rng } from "./paint";
import { lam } from "./build";
import { R_OUT, R_CORE, R_BELL, storeyH, TowerState } from "./story";

const MARBLE = "#efe6d6", MARBLE2 = "#e4d8c3", GREY = "#b9b0a4";
/** marble wall with dark arched doorways (galleries) or shallow blind arches (ground floor) */
const wallTex = (kind: "gallery" | "ground" | "bell") => ctex("pisaWall" + kind, 1024, 256, (g, r) => {
  g.fillStyle = MARBLE; g.fillRect(0, 0, 1024, 256);
  for (let y = 0; y < 256; y += 22) { // faint grey courses
    g.fillStyle = r() < 0.5 ? "rgba(150,140,128,0.10)" : "rgba(255,255,250,0.10)"; g.fillRect(0, y, 1024, 11);
    g.fillStyle = "rgba(120,108,96,0.25)"; g.fillRect(0, y, 1024, 1.5);
  }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(130,120,110,${0.05 + r() * 0.06})`; g.beginPath(); g.ellipse(r() * 1024, r() * 256, 20 + r() * 40, 6 + r() * 10, 0, 0, 6.3); g.fill(); }
  const n = kind === "bell" ? 6 : 8, w = 1024 / n;
  for (let k = 0; k < n; k++) {
    const cx = k * w + w / 2, aw = w * (kind === "ground" ? 0.78 : 0.42), top = kind === "ground" ? 40 : 70, bot = kind === "ground" ? 256 : 236;
    g.beginPath(); g.moveTo(cx - aw / 2, bot); g.lineTo(cx - aw / 2, top + aw / 2); g.arc(cx, top + aw / 2, aw / 2, Math.PI, 0); g.lineTo(cx + aw / 2, bot); g.closePath();
    if (kind === "ground") { g.fillStyle = MARBLE2; g.fill(); g.strokeStyle = "rgba(90,78,70,0.55)"; g.lineWidth = 5; g.stroke(); }
    else {
      g.fillStyle = "#3b3140"; g.fill(); g.strokeStyle = "#cfc3b0"; g.lineWidth = 8; g.stroke();
      g.fillStyle = "rgba(255,210,150,0.10)"; g.fillRect(cx - aw / 2, bot - 30, aw, 30);
    }
    // small round marble inlay (the tower's rosettes)
    g.fillStyle = "#c9bca8"; g.beginPath(); g.arc(cx + w / 2, 40, 10, 0, 6.3); g.fill();
  }
});
/** the arcade band: opaque spandrels over transparent arch openings (alpha cut-out), one arch per column bay */
const archTex = () => ctex("pisaArch", 512, 128, (g) => {
  g.clearRect(0, 0, 512, 128);
  g.fillStyle = MARBLE; g.fillRect(0, 0, 512, 128);
  g.globalCompositeOperation = "destination-out";
  g.beginPath(); g.moveTo(16, 128); g.lineTo(16, 74); g.arc(256, 74 + 0, 240, Math.PI, 0); g.lineTo(496, 128); g.closePath(); g.fill();
  g.globalCompositeOperation = "source-over";
  g.strokeStyle = "rgba(110,98,88,0.8)"; g.lineWidth = 10; g.beginPath(); g.arc(256, 74, 245, Math.PI * 1.02, Math.PI * 1.98); g.stroke();
  g.fillStyle = "rgba(120,108,96,0.35)"; g.fillRect(0, 0, 512, 8);
});

const cyl = (r: number, h: number, seg: number, open = false) => new THREE.CylinderGeometry(r, r, h, seg, 1, open).translate(0, h / 2, 0);

export class Tower {
  root = new THREE.Group();
  storeys: THREE.Group[] = [];
  scaffold = new THREE.Group();
  private anchors: THREE.Object3D[] = [];
  private poles!: THREE.Mesh; private rings: THREE.Mesh[] = [];
  constructor() {
    const marble = lam("pisaMarble", () => ({ color: MARBLE }));
    const ledge = lam("pisaLedge", () => ({ color: "#e9dfcd" }));
    const colM = lam("pisaCol", () => ({ color: "#f3ece0" }));
    const roofM = lam("pisaRoof", () => ({ color: "#a86f55" }));
    const arch = lam("pisaArchM", () => ({ map: archTex(), alphaTest: 0.5, side: THREE.DoubleSide }));
    let parent: THREE.Object3D = this.root;
    for (let k = 0; k < 8; k++) {
      const h = storeyH(k), grp = new THREE.Group();
      grp.position.y = k === 0 ? 0 : storeyH(k - 1);
      const add = (geo: THREE.BufferGeometry, m: THREE.Material) => { const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = true; grp.add(mesh); };
      if (k === 0) {
        const t = rep(wallTex("ground"), 3, 1);
        add(cyl(R_OUT, h - 0.6, 64), lam("pisaGround", () => ({ map: t })));
        add(cyl(R_OUT + 0.45, 0.9, 64), ledge); // plinth
        // engaged half-columns of the blind arcade
        const cols: THREE.BufferGeometry[] = [];
        for (let i = 0; i < 15; i++) { const a = (i / 15) * Math.PI * 2; cols.push(cyl(0.32, h - 1.2, 10).translate(Math.cos(a) * R_OUT, 0.6, Math.sin(a) * R_OUT)); }
        add(mergeGeometries(cols), colM);
        add(cyl(R_OUT + 0.5, 0.6, 64).translate(0, h - 0.6, 0), ledge);
      } else {
        const bell = k === 7, ro = bell ? R_BELL : R_OUT, rc = bell ? R_BELL - 1.3 : R_CORE, n = bell ? 16 : 30;
        const t = rep(wallTex(bell ? "bell" : "gallery"), bell ? 2 : 3, 1);
        add(cyl(rc, h, 48, true), lam("pisaCore" + (bell ? "B" : "G"), () => ({ map: t, side: THREE.DoubleSide })));
        add(cyl(ro + 0.35, 0.45, 64), ledge); // gallery floor
        const cols: THREE.BufferGeometry[] = [];
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2, x = Math.cos(a) * ro, z = Math.sin(a) * ro;
          cols.push(cyl(0.2, h - 1.55, 8).translate(x, 0.45, z));
          cols.push(new THREE.BoxGeometry(0.55, 0.22, 0.55).translate(x, h - 1.0, z)); // capital
        }
        add(mergeGeometries(cols), colM);
        const band = new THREE.CylinderGeometry(ro + 0.02, ro + 0.02, 0.95, n * 6, 1, true).translate(0, h - 0.45 - 0.47, 0);
        const uv = band.attributes.uv as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * n);
        add(band, arch);
        add(cyl(ro + 0.3, 0.45, 64).translate(0, h - 0.45, 0), ledge); // cornice
        if (bell) {
          add(new THREE.CylinderGeometry(ro + 0.4, ro + 0.6, 0.5, 48).translate(0, h, 0), ledge);
          add(new THREE.CylinderGeometry(rc - 0.3, rc + 0.4, 1.2, 32).translate(0, h + 0.5, 0), roofM);
          for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; add(new THREE.BoxGeometry(0.35, 0.6, 0.35).translate(Math.cos(a) * (ro + 0.3), h + 0.55, Math.sin(a) * (ro + 0.3)), ledge); }
        }
      }
      parent.add(grp);
      this.storeys.push(grp);
      parent = grp;
    }
    // anchors for cables (world positions read every frame): gallery 3, high (-x) side
    for (const a of [0.6, -0.6, 2.4, -2.4]) {
      const o = new THREE.Object3D(); o.position.set(-Math.cos(a) * (R_CORE + 0.2), 3, Math.sin(a) * (R_CORE + 0.2)); this.storeys[3].add(o); this.anchors.push(o);
    }
    // scaffold: poles + rails around the growing top (child of root, sized per frame)
    const wood = lam("pisaPoleL", () => ({ color: "#c29262" }));
    const poles: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2 + 0.1; poles.push(new THREE.CylinderGeometry(0.085, 0.085, 1, 6).translate(Math.cos(a) * 8.7, 0.5, Math.sin(a) * 8.7)); }
    const sm = new THREE.Mesh(mergeGeometries(poles), wood);
    sm.castShadow = true; sm.receiveShadow = true;
    this.poles = sm;
    this.scaffold.add(sm);
    const ringG = new THREE.TorusGeometry(8.7, 0.08, 4, 48).rotateX(Math.PI / 2);
    for (let j = 0; j < 8; j++) { const m = new THREE.Mesh(ringG, wood); m.castShadow = true; this.rings.push(m); this.scaffold.add(m); }
    this.root.add(this.scaffold);
    void rng; void GREY; void marble;
  }
  pose(s: TowerState) {
    this.root.position.set(0, -s.sink, 0);
    this.root.rotation.set(0, 0, (-s.lean * Math.PI) / 180);
    let top = 0;
    this.storeys.forEach((g, k) => {
      const grow = Math.max(0, Math.min(1, s.floors - k));
      g.visible = grow > 0.001;
      g.scale.y = Math.max(0.001, grow);
      // the 1272 correction: floors 3+ bend back toward vertical, one more step each (cumulative)
      g.rotation.z = k >= 3 ? (1.5 * s.curve * Math.PI) / 180 : 0;
      if (grow > 0) top += storeyH(k) * grow;
    });
    this.scaffold.visible = s.scaffold && s.floors > 0.2;
    const H = Math.max(1, top + 1.5);
    this.poles.scale.set(1, H, 1);
    this.rings.forEach((m, j) => { const y = 2.2 + j * 2.6; m.visible = y < H - 0.3; m.position.y = y; });
    this.root.updateMatrixWorld(true);
  }
  anchorWorld(i: number, out: THREE.Vector3) { return this.anchors[i].getWorldPosition(out); }
}
