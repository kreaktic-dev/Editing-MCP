// dumps the picture timeline (shots, word anchors) to out/pisa/timeline.json for the sound scripts
import fs from "node:fs";
import { SHOTS, TOTAL, FPS, at, end, XFADE, FLASH_AT, camAt } from "../src/videos/pisa/story";
const P = ["Builders", "falling", "It's", "fanciest", "whole world", "So the builders", "dig", "three meters", "soft", "By the second", "tipping", "Luckily", "war",
  "everybody drops", "tools", "for almost", "a hundred years", "saved", "squeeze", "When they", "by building", "low side", "So now", "bent", "like a banana", "In nineteen",
  "embarrassing", "orders", "so his", "pump", "It leans", "further", "You see", "mattress", "Put more", "sinks", "By nineteen ninety", "shut it", "and engineers", "pulled",
  "The tower swung", "centimeters", "stopped", "They could", "perfectly straight", "But nobody", "hold up", "standing up", "itself"];
const anchors = Object.fromEntries(P.map((p) => [p, at(p)]));
// camera cuts / glide midpoints (whoosh candidates): big frame-to-frame camera jumps or fast moves
const moves: { t: number; v: number; cut: boolean }[] = [];
for (const s of SHOTS) {
  let prev = camAt(s.id, s.a);
  for (let f = s.a + 1; f < s.b; f++) {
    const c = camAt(s.id, f);
    const d = Math.hypot(...c.pos.map((x, i) => x - prev.pos[i])) + 0.3 * Math.hypot(...c.look.map((x, i) => x - prev.look[i])) + Math.abs(c.fov - prev.fov) * 0.1;
    moves.push({ t: f / FPS, v: d, cut: d > 2.5 });
    prev = c;
  }
}
fs.mkdirSync("out/pisa", { recursive: true });
fs.writeFileSync("out/pisa/timeline.json", JSON.stringify({ fps: FPS, total: TOTAL, dur: TOTAL / FPS, flash: FLASH_AT / FPS, xfade: XFADE,
  shots: SHOTS.map((s) => ({ id: s.id, a: s.a, b: s.b, light: s.light, era: s.era })), anchors, words_end: end("itself"), moves }, null, 0));
console.log("ok", TOTAL);
