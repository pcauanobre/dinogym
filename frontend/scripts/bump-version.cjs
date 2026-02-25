const fs = require("fs");
const path = require("path");

const pkgPath = path.join(__dirname, "..", "package.json");
const p = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

const v = p.version.split(".");
v[2] = +v[2] + 1;
p.version = v.join(".");

fs.writeFileSync(pkgPath, JSON.stringify(p, null, 2) + "\n");

const publicDir = path.join(__dirname, "..", "public");
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
fs.writeFileSync(
  path.join(publicDir, "version.json"),
  JSON.stringify({ version: p.version }) + "\n"
);

console.log("Version bumped to", p.version);
