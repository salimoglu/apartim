const fs = require("fs");
const base = "https://salimoglu.github.io/apartim/";
const src = fs.readFileSync("sw.js", "utf8");
const assets = [...src.matchAll(/"\.\/[^"]+"/g)].map((m) => m[0].slice(1, -1));

(async () => {
  let fail = 0;
  for (const a of assets) {
    const u = base + a.replace(/^\.\//, "");
    const r = await fetch(u);
    if (!r.ok) {
      console.log("FAIL", r.status, u);
      fail++;
    }
  }
  console.log(fail ? fail + " failed" : "all ok", assets.length, "assets");
})();
