import { getDb } from "../api/queries/connection";
import { sql } from "drizzle-orm";
const db = getDb();
const kws = ["мрамор","оникс","бетон","травертин","дерев","камен","камень","металл","терраццо","terrazzo","гранит","сланец","известняк","песчаник","кирпич","ткань","кожа","marble","onyx","hexagon","гексагон","шестигранн","мозаик","mosaico","mosaic"];
for (const k of kws) {
  const r: any = await db.execute(sql.raw(`SELECT count(*) c FROM products WHERE status='active' AND (LOWER(name) LIKE '%${k}%' OR LOWER(COALESCE((SELECT name FROM collections WHERE id=products.collection_id),'')) LIKE '%${k}%')`));
  console.log(k, r[0][0].c);
}
const sizes: any = await db.execute(sql`SELECT size, count(*) c FROM products WHERE status='active' AND size IS NOT NULL GROUP BY size ORDER BY c DESC LIMIT 25`);
console.log(sizes[0].map((r:any)=>`${r.size}:${r.c}`).join("  "));
process.exit(0);
