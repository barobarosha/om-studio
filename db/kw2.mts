import { getDb } from "../api/queries/connection";
import { sql } from "drizzle-orm";
const db = getDb();
const kws: Record<string,string[]> = {
  "мрамор": ["мрамор","marble","marvel","calacatta","калакатта","statuario","carrara","каррара"],
  "оникс": ["оникс","onyx"],
  "бетон": ["бетон","beton","concrete","цемент","cement"],
  "травертин": ["травертин","travertin"],
  "дерево": ["дерев","wood","rovere","oak"],
  "камень": ["камен","stone","pietra","сланец","slate","известняк","limestone","песчаник"],
  "металл": ["металл","metal","оксид","oxide","rust","ржав"],
  "терраццо": ["терраццо","terrazzo","veneziano"],
  "кирпич": ["кирпич","brick"],
  "ткань/кожа": ["ткань","fabric","кожа","leather"],
};
for (const [label, variants] of Object.entries(kws)) {
  const cond = variants.map(v => `LOWER(CONCAT_WS(' ', p.name, c.name, p.description)) LIKE '%${v}%'`).join(" OR ");
  const r: any = await db.execute(sql.raw(`SELECT count(*) c FROM products p LEFT JOIN collections c ON c.id=p.collection_id WHERE p.status='active' AND (${cond})`));
  console.log(label, r[0][0].c);
}
const d: any = await db.execute(sql`SELECT count(*) c, count(description) dc FROM products WHERE status='active'`);
console.log("total", d[0][0].c, "with description", d[0][0].dc);
process.exit(0);
