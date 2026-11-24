// usage: node scripts/stills.mjs <outPrefix> <frame,frame,...> [scale]  (bundles once, jpeg)
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
const [prefix, frames, scale = "0.5"] = process.argv.slice(2);
fs.mkdirSync(path.dirname(prefix), { recursive: true });
// GPU by default (ANGLE: Direct3D on Windows, so an RTX card renders it). In the cloud container (no GPU) we fall back
// to the preinstalled headless Chromium + SwiftShader. Override with CHROME=<path> and GL=angle|swangle|egl|vulkan.
const CLOUD = "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const browserExecutable = process.env.CHROME || (fs.existsSync(CLOUD) ? CLOUD : null);
const chromiumOptions = { gl: process.env.GL || (browserExecutable === CLOUD ? "swangle" : "angle") };
const serveUrl = await bundle({ entryPoint: path.resolve(process.env.ENTRY || "src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: process.env.COMP || "PisaShort", browserExecutable, chromiumOptions });
const onBrowserLog = (l) => { if (l.type === "error" || l.type === "warning") console.log(`[${l.type}]`, l.text.slice(0, 300)); };
for (const f of frames.split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame: f, output: `${prefix}${f}.jpg`, imageFormat: "jpeg", jpegQuality: 88, scale: Number(scale),
    browserExecutable, chromiumOptions, timeoutInMilliseconds: 300000, onBrowserLog });
  console.log("still", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
