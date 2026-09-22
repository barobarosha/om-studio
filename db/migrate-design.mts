// Загружаем .env до подключения к БД (в проде переменные уже заданы окружением)
try {
  const { readFileSync, existsSync } = await import("fs");
  if (existsSync(".env")) {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*(?:\s+#.*)?$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
} catch {}
import { getDb } from "../api/queries/connection";
import { sql } from "drizzle-orm";
const db = getDb();
// 1. колонки
for (const ddl of [
  "ALTER TABLE products ADD COLUMN design VARCHAR(50) NULL AFTER size",
  "ALTER TABLE products ADD COLUMN shape VARCHAR(30) NULL AFTER design",
]) {
  try { await db.execute(sql.raw(ddl)); console.log("ok:", ddl.slice(0, 60)); }
  catch (e: any) { console.log("skip:", (e.message as string).slice(0, 80)); }
}
// 2. backfill design (приоритет: от специфичного к общему)
const HAY = "LOWER(CONCAT_WS(' ', p.name, c.name, p.description))";
const cases: [string, string][] = [
  ["оникс|onyx", "Оникс"],
  ["травертин|travertin", "Травертин"],
  ["терраццо|terrazzo|veneziano", "Терраццо"],
  ["мрамор|marble|marvel|calacatta|калакатта|statuario|carrara|каррара", "Мрамор"],
  ["бетон|beton|concrete|цемент", "Бетон"],
  ["металл|metal|оксид|oxide", "Металл"],
  ["кирпич|brick", "Кирпич"],
  ["дерев|wood|rovere", "Дерево"],
  ["камен|камень|stone|pietra|сланец|slate|известняк|limestone|песчаник", "Камень"],
];
const whens = cases.map(([re, v]) => `WHEN ${HAY} REGEXP '${re}' THEN '${v}'`).join("\n  ");
const updDesign = `
  UPDATE products p LEFT JOIN collections c ON c.id = p.collection_id
  SET p.design = CASE
  ${whens}
  ELSE NULL END`;
let r: any = await db.execute(sql.raw(updDesign));
console.log("design backfilled, affected:", r[0].affectedRows);
// 3. backfill shape — считаем в TS: в данных встречаются размеры с запятыми,
// из-за которых SQL CAST(... AS DECIMAL) падает с "Truncated incorrect DECIMAL"
const { guessShape } = await import("../api/importers/normalize");
const all: any = await db.execute(sql`SELECT id, name, size FROM products`);
const byShape = new Map<string, number[]>();
for (const row of all[0]) {
  const s = guessShape(row.name ?? "", row.size ?? undefined);
  if (!s) continue;
  (byShape.get(s) ?? byShape.set(s, []).get(s)!).push(row.id);
}
for (const [shape, ids] of byShape) {
  for (let i = 0; i < ids.length; i += 1000) {
    const chunk = ids.slice(i, i + 1000);
    await db.execute(sql.raw(`UPDATE products SET shape='${shape}' WHERE id IN (${chunk.join(",")})`));
  }
  console.log(`shape '${shape}': ${ids.length}`);
}
// 4. контроль
const check: any = await db.execute(sql`SELECT design, count(*) c FROM products WHERE design IS NOT NULL GROUP BY design ORDER BY c DESC`);
console.log(check[0]);
const check2: any = await db.execute(sql`SELECT shape, count(*) c FROM products WHERE shape IS NOT NULL GROUP BY shape ORDER BY c DESC`);
console.log(check2[0]);
process.exit(0);
