import { getDb } from "../api/queries/connection";
import { sql } from "drizzle-orm";
const db = getDb();
const r:any = await db.execute(sql`SELECT availability_status s, COUNT(*) c FROM products WHERE status='active' AND duplicate_of_id IS NULL GROUP BY availability_status`);
console.log(r[0]);
const m:any = await db.execute(sql`SELECT MAX(stock_qty) m FROM products`);
console.log('max qty:', m[0]);
process.exit(0);
