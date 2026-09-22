import { getDb } from "../api/queries/connection";
import { sql } from "drizzle-orm";
const db = getDb();
const r: any = await db.execute(sql.raw("UPDATE products SET size=NULL WHERE size REGEXP '^0([.,]0+)?x' OR size REGEXP 'x0([.,]0+)?$'"));
console.log("nulled junk sizes:", r[0].affectedRows);
process.exit(0);
