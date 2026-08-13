import { getDb } from "../api/queries/connection";
import { sql } from "drizzle-orm";
const db = getDb();
await db.execute(sql`CREATE TABLE IF NOT EXISTS custom_sources (
  id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name varchar(255) NOT NULL,
  url text NOT NULL,
  format varchar(20) NOT NULL,
  active tinyint(1) NOT NULL DEFAULT 1,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
console.log("custom_sources created");
process.exit(0);
