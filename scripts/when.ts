import { at, Fr } from "../src/videos/pisa/story";
for (const p of process.argv.slice(2)) console.log(p, Fr(at(p)));
