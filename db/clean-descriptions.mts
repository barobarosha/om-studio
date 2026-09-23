// Загружаем .env до подключения к БД
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
import { cleanText } from "../api/importers/normalize";

// Одноразовая чистка описаний от mojibake/BOM («п»ї», «ï»¿» и т.п.),
// попавших в базу из старых выгрузок. Новые импорты чистятся автоматически.
const db = getDb();
const r: any = await db.execute(sql`SELECT id, description FROM products WHERE description IS NOT NULL AND description != ''`);
let fixed = 0;
const updates: [number, string][] = [];
for (const row of r[0]) {
  const cleaned = cleanText(row.description);
  if (cleaned !== undefined && cleaned !== row.description) {
    updates.push([row.id, cleaned ?? null as any]);
  }
}
for (const [id, desc] of updates) {
  await db.execute(sql`UPDATE products SET description = ${desc} WHERE id = ${id}`);
  fixed++;
}
console.log(`Проверено: ${r[0].length}, исправлено: ${fixed}`);
process.exit(0);
