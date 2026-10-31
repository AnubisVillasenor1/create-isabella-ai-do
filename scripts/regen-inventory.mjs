import fs from "node:fs";
import path from "node:path";
function collect(d) {
  let out = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, e.name);
    if (e.isDirectory()) out = out.concat(collect(full));
    else if (e.name.endsWith(".ts")) out.push(full);
  }
  return out;
}
const routes = [];
const re = /app\.(get|post|put|delete|patch)\(\s*(["'`])([^"'`]+)\2/g;
for (const f of collect("src")) {
  const s = fs.readFileSync(f, "utf8");
  let m;
  while ((m = re.exec(s)) !== null) routes.push((m[1] || "").toUpperCase() + " " + m[3]);
}
routes.sort();
fs.writeFileSync("test/deployment/route-inventory.json", JSON.stringify(routes, null, 2) + "\n");
console.log("routes:", routes.length);
