import fs from "fs";
const key = fs.readFileSync(".env.local","utf8").match(/TRIPO_API_KEY=(.+)/)[1].trim();
const r = await fetch("https://api.tripo3d.ai/v2/openapi/user/balance", {
  headers: { Authorization: `Bearer ${key}` },
});
const d = await r.json();
console.log("STATUS", r.status);
console.log(JSON.stringify(d, null, 2));
