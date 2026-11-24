// camera motion audit: per shot, the slowest frame (should never be ~0) and the biggest frame-to-frame speed jump
// outside planned cuts / kicks (should be small = eased)
import { SHOTS, camAt, kickAt, FPS } from "../src/videos/pisa/story";
const sp = (a: any, b: any) => Math.hypot(...a.pos.map((x: number, i: number) => x - b.pos[i])) + 0.15 * Math.hypot(...a.look.map((x: number, i: number) => x - b.look[i])) + 0.05 * Math.abs(a.fov - b.fov) + 2 * Math.abs(a.roll - b.roll);
for (const s of SHOTS) {
  const v: number[] = [];
  for (let f = s.a + 1; f < s.b; f++) v.push(sp(camAt(s.id, f), camAt(s.id, f - 1)));
  let minV = 1e9, minF = 0, jump = 0, jF = 0;
  v.forEach((x, i) => { const f = s.a + 1 + i; if (x < minV) { minV = x; minF = f; }
    if (i > 0) { const k = kickAt(f / FPS) || kickAt((f - 1) / FPS); const big = x > 1.5 || v[i - 1] > 1.5; if (!k && !big) { const d = Math.abs(x - v[i - 1]); if (d > jump) { jump = d; jF = f; } } } });
  console.log(`shot ${String(s.id).padStart(2)}  slowest ${minV.toFixed(4)} @${minF}  biggest speed jump ${jump.toFixed(4)} @${jF}  median ${[...v].sort((a, b) => a - b)[v.length >> 1].toFixed(4)}`);
}
