// Full render, bundled ONCE (later edits can't leak into a running render), in resumable chunks, then concat.
// usage: node scripts/render.mjs [scale=1] [concurrency=2]   (scale 1.3333 = 1440x2560 final)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
const [scale = "1", conc = "2"] = process.argv.slice(2);
const browserExecutable = process.env.CHROME || "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const chromiumOptions = { gl: "swangle" };
const D = `out/pisa/chunks_${scale}`;
fs.mkdirSync(D, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: "PisaShort", browserExecutable, chromiumOptions, timeoutInMilliseconds: 600000 });
const N = composition.durationInFrames, CH = 150;
fs.writeFileSync(`${D}/words_snapshot.json`, fs.readFileSync("src/videos/pisa/words.json"));
for (let a = 0; a < N; a += CH) {
  const b = Math.min(N - 1, a + CH - 1), f = `${D}/c_${String(a).padStart(5, "0")}.mp4`;
  if (fs.existsSync(f)) continue;
  const t0 = Date.now();
  await renderMedia({ composition, serveUrl, codec: "h264", crf: 16, scale: Number(scale), concurrency: Number(conc), frameRange: [a, b], muted: true,
    outputLocation: f + ".tmp.mp4", browserExecutable, chromiumOptions, timeoutInMilliseconds: 600000 });
  fs.renameSync(f + ".tmp.mp4", f);
  console.log(`chunk ${a}-${b} ${((Date.now() - t0) / 1000).toFixed(0)} s  (${new Date().toTimeString().slice(0, 8)})`);
}
const list = fs.readdirSync(D).filter((x) => /^c_\d+\.mp4$/.test(x)).sort().map((x) => `file '${x}'`).join("\n");
fs.writeFileSync(`${D}/list.txt`, list + "\n");
execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", `${D}/list.txt`, "-c", "copy", `out/pisa/video_${scale}.mp4`]);
console.log("done", `out/pisa/video_${scale}.mp4`);
