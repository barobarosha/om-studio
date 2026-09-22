import { getDb } from "../api/queries/connection";
import { sql } from "drizzle-orm";
const db = getDb();
const d: any = await db.execute(sql`SELECT design, count(*) c FROM products WHERE design IS NOT NULL GROUP BY design ORDER BY design`);
console.log("design:", d[0].map((r:any)=>`${r.design}:${r.c}`).join("  "));
const s: any = await db.execute(sql`SELECT shape, count(*) c FROM products WHERE shape IS NOT NULL GROUP BY shape ORDER BY shape`);
console.log("shape:", s[0].map((r:any)=>`${r.shape}:${r.c}`).join("  "));
process.exit(0);
