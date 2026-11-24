// storyboard panel list -> out/pisa/board/panels.json (frame per camera beat, VO per shot)
import fs from "node:fs";
import WORDS from "../src/videos/pisa/words.json";
import { SHOTS, at, Fr, FPS } from "../src/videos/pisa/story";
const P: [number, string | null, number, string][] = [
  [1, null, 15, "Low behind the worried builders, slow drift left"],
  [1, "a tower", 22, "Glide back and up to reveal the whole bent tower"],
  [1, "falling", 10, "Cut: low dutch angle on shocked faces, push-in"],
  [2, null, 15, "1173. Aerial of the empty, roped-off site, slow zoom"],
  [2, "fanciest", 20, "Glide down to the cheering townsfolk, roll"],
  [3, null, 15, "Looking down into the 3 m foundation pit, drift"],
  [3, "three meters", 10, "Cut: low inside the pit among the diggers"],
  [3, "soft", 12, "Cut: boot sinks into the clay, mud splash"],
  [4, null, 15, "Stub rising floor by floor behind scaffolding"],
  [4, "tipping", 12, "Tower tips (kick + roll), builders tilt their heads"],
  [5, null, 25, "Soldiers march past, the builders watch, tracking right"],
  [6, null, 10, "Builders drop their shovels..."],
  [6, "tools", 8, "Cut: shovels hit the ground (kick)"],
  [6, "for almost", 12, "Cut wide: they walk away"],
  [7, null, 25, "Sunset. The abandoned stub, clouds race (time-lapse)"],
  [7, "saved", 10, "Cut: low at the base"],
  [7, "squeeze", 14, "Punch-in: the ground squeezes tight"],
  [8, null, 20, "Grey-haired builders return"],
  [8, "by building", 30, "Crane up as new floors grow, bending back"],
  [8, "low side", 8, "Cut: the taller floors on the low side"],
  [9, null, 25, "Whole tower from the side, roll on \"bent\""],
  [9, "like a banana", 10, "Cut: builder holds up a banana next to it"],
  [10, null, 20, "1934. The dictator, MS, push-in"],
  [10, "orders", 10, "Cut: low wide, he points at the tower"],
  [10, "pump", 25, "Cut: mixer lorry pumps concrete into the base"],
  [11, "further", 15, "Wide: the tower lurches further (big kick), everyone shocked"],
  [12, null, 25, "Golden lawn. Kid on a mattress"],
  [12, "Put more", 25, "Weight on one foot, that side dents"],
  [12, "sinks", 15, "Punch-in: sinks deeper"],
  [13, null, 25, "1990. Closed off, steel cables, cones and tape"],
  [13, "and engineers", 25, "Cut: drill pulls soil from the high side"],
  [14, null, 25, "The tower swings back 45 cm"],
  [14, "stopped", 12, "Engineers cheer, push-in"],
  [15, null, 25, "Today. Tourists all \"holding it up\""],
  [15, "But nobody", 22, "Push into one straining tourist"],
  [15, "standing up", 50, "Crane out over the square to the end"],
];
const W = WORDS as { w: string; s: number; e: number }[];
const panels = P.map(([id, ph, d, note], i) => {
  const s = SHOTS[id - 1], f = Math.min(s.b - 2, (ph ? Fr(at(ph)) : s.a) + d);
  return { i, id, f, t: +(f / FPS).toFixed(2), note, light: s.light, era: s.era };
});
const shots = SHOTS.map((s) => ({ id: s.id, a: s.a, b: s.b, light: s.light, era: s.era,
  vo: W.filter((w) => w.s * FPS >= s.a - 1 && w.s * FPS < s.b - 1).map((w) => w.w).join(" ") }));
fs.mkdirSync("out/pisa/board", { recursive: true });
fs.writeFileSync("out/pisa/board/panels.json", JSON.stringify({ panels, shots }, null, 1));
console.log(panels.map((p) => p.f).join(","));
