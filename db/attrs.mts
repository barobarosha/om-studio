import { getDb } from "../api/queries/connection";
import { sql } from "drizzle-orm";
const db = getDb();
const r: any = await db.execute(sql`
  SELECT attrs FROM products WHERE attrs IS NOT NULL AND attrs != '{}' AND attrs != 'null' LIMIT 4000
`);
const keys: Record<string, number> = {};
const samples: Record<string, Set<string>> = {};
for (const row of r[0]) {
  try {
    const o = typeof row.attrs === "string" ? JSON.parse(row.attrs) : row.attrs;
    for (const [k, v] of Object.entries(o)) {
      keys[k] = (keys[k] ?? 0) + 1;
      (samples[k] ??= new Set()).add(String(v).slice(0, 40));
    }
  } catch {}
}
console.log(Object.entries(keys).sort((a,b)=>b[1]-a[1]).slice(0,30).map(([k,c])=>`${k}: ${c} | ${[...(samples[k]??[])].slice(0,6).join(" ; ")}`).join("\n"));
// примеры названий с дизайном
const d: any = await db.execute(sql`SELECT name FROM products WHERE LOWER(name) LIKE '%мрамор%' LIMIT 3`);
console.log("мрамор sample:", d[0].map((x:any)=>x.name));
process.exit(0);
