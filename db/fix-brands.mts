// Разовая переклассификация:
// 1) товары из бренда-заглушки «Плитка» → реальные бренды (по первому слову названия);
// 2) пересчёт характеристики «дизайн» без учёта описания (фикс п. 6).
// Запуск из папки проекта:  npx tsx db/fix-brands.mts
import { readFileSync } from "fs";
try {
  for (const l of readFileSync(".env", "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*(?:\s+#.*)?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL не найден. Запускайте из корня проекта.");
  process.exit(1);
}

const { getDb } = await import("../api/queries/connection");
const { products, brands, collections } = await import("@db/schema");
const { and, eq, isNull, sql, like } = await import("drizzle-orm");
const { norm, slugify, guessDesign } = await import("../api/importers/normalize");

// префикс названия (ПЕРВОЕ слово, верхний регистр) → имя бренда в справочнике
const MAP: Record<string, string> = {
  PORCELANOSA: "PORCELANOSA",
  MIRAGE: "MIRAGE",
  EQUIPE: "EQUIPE",
  PERONDA: "PERONDA CERAMICAS",
  GRESPANIA: "GRESPANIA",
  HARMONY: "HARMONY",
  MUSEUM: "MUSEUM",
  COLORKER: "COLORKER",
  MUTINA: "MUTINA",
  MAYOR: "MAYOR",
  TERZADIMENSIONE: "TERZADIMENSIONE",
  EXAGRES: "EXAGRES",
  LANTIC: "L'ANTIC COLONIAL",
  BUTECH: "BUTECH",
};

const db = getDb();

// --- фаза 1: бренды ---
const junk = await db.select().from(brands).where(eq(brands.name, "Плитка")).limit(1);
if (!junk.length) {
  console.log("Бренд «Плитка» не найден — фаза 1 пропущена.");
} else {
  const junkId = junk[0].id;
  const allBrands = await db.select().from(brands);
  const byNorm = new Map(allBrands.map((b) => [b.nameNorm, b]));

  const report: string[] = [];
  for (const [prefix, brandName] of Object.entries(MAP)) {
    let brand = byNorm.get(norm(brandName));
    if (!brand) {
      // создаём недостающий бренд
      let slug = slugify(brandName) || `brand-${Date.now()}`;
      const [r] = await db.insert(brands).values({ name: brandName, nameNorm: norm(brandName), slug, active: true });
      brand = { id: Number((r as any).insertId), name: brandName, nameNorm: norm(brandName), slug, country: null, active: true } as any;
      byNorm.set(brand.nameNorm, brand);
      report.push(`+ создан бренд «${brandName}»`);
    }
    const res = await db
      .update(products)
      .set({ brandId: brand.id })
      .where(and(eq(products.brandId, junkId), like(products.name, `${prefix} %`)));
    report.push(`«${prefix}» → ${brandName}: ${(res as any).affectedRows ?? "?"} шт.`);
  }
  const left = await db
    .select({ c: sql<number>`count(*)` })
    .from(products)
    .where(and(eq(products.brandId, junkId), eq(products.status, "active"), isNull(products.duplicateOfId)));
  report.push(`Осталось под «Плиткой» (активных): ${Number(left[0]?.c ?? 0)} шт.`);
  console.log("=== БРЕНДЫ ===\n" + report.join("\n"));
}

// --- фаза 2: пересчёт дизайна без описания ---
const rows = await db
  .select({ id: products.id, name: products.name, design: products.design, collectionName: collections.name })
  .from(products)
  .leftJoin(collections, eq(products.collectionId, collections.id))
  .where(and(eq(products.status, "active"), isNull(products.duplicateOfId)))
  .limit(25000);
let changed = 0;
for (const r of rows) {
  const next = guessDesign(r.name ?? undefined, r.collectionName ?? undefined);
  const nextVal = next ?? null;
  if (nextVal !== (r.design ?? null)) {
    await db.update(products).set({ design: nextVal }).where(eq(products.id, r.id));
    changed++;
  }
}
console.log(`=== ДИЗАЙН ===\nПересчитано записей: ${changed} из ${rows.length}`);

process.exit(0);