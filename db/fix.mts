import { getDb } from "../api/queries/connection";
import { sql } from "drizzle-orm";
const db = getDb();
await db.execute(sql`UPDATE products SET size = REPLACE(REPLACE(REPLACE(size,'х','x'),'×','x'),' ','') WHERE size IS NOT NULL`);
console.log('sizes normalized');
process.exit(0);
