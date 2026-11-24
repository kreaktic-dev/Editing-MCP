// prints shot ranges and a mid frame of every camera key (for stills)
import { SHOTS, TOTAL } from "../src/videos/pisa/story";
console.log("TOTAL", TOTAL);
for (const s of SHOTS) console.log(s.id, s.a, s.b, s.light, s.era);
console.log(SHOTS.map((s) => Math.round((s.a + s.b) / 2)).join(","));
