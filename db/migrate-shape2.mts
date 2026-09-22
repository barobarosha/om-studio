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
import { guessShape } from "../api/importers/normalize";
const db = getDb();
const r: any = await db.execute(sql`SELECT id, name, size FROM products`);
const byShape = new Map<string, number[]>();
for (const row of r[0]) {
  const s = guessShape(row.name ?? "", row.size ?? undefined);
  if (!s) continue;
  (byShape.get(s) ?? byShape.set(s, []).get(s)!).push(row.id);
}
for (const [shape, ids] of byShape) {
  for (let i = 0; i < ids.length; i += 1000) {
    const chunk = ids.slice(i, i + 1000);
    await db.execute(sql.raw(`UPDATE products SET shape='${shape}' WHERE id IN (${chunk.join(",")})`));
  }
  console.log(shape, ids.length);
}
process.exit(0);
