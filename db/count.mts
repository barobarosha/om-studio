import { getDb } from "../api/queries/connection";
import { sql } from "drizzle-orm";
const db = getDb();
const r: any = await db.execute(sql`SELECT s.code, COUNT(*) c FROM products p JOIN suppliers s ON s.id=p.supplier_id GROUP BY s.code`);
console.log(r[0]);
const runs: any = await db.execute(sql`SELECT s.code, r.status, r.errors, r.total_rows, r.created, r.updated FROM import_runs r JOIN suppliers s ON s.id=r.supplier_id ORDER BY r.id DESC LIMIT 6`);
console.log(runs[0]);
process.exit(0);
