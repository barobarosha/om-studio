// Движок импорта: пакетный upsert товаров, дедупликация, архивация, журнал.

import { eq, and, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { brands, collections, customSources, importRuns, productImages, products, suppliers } from "@db/schema";
import { norm, slugify } from "./normalize";
import type { NormalizedProduct } from "./normalize";
import { SOURCES, loadGenericSource } from "./sources";
import type { SourceCode } from "./sources";

function* chunks<T>(a: T[], n: number): Generator<T[]> {
  for (let i = 0; i < a.length; i += n) yield a.slice(i, i + n);
}

async function ensureSupplier(code: SourceCode): Promise<number> {
  const db = getDb();
  const def = SOURCES[code];
  const existing = await db.select().from(suppliers).where(eq(suppliers.code, code)).limit(1);
  if (existing.length) {
    await db
      .update(suppliers)
      .set({ name: def.name, importType: def.importType, priority: def.priority, active: true })
      .where(eq(suppliers.id, existing[0].id));
    return existing[0].id;
  }
  const r = await db.insert(suppliers).values({ code, name: def.name, importType: def.importType, priority: def.priority });
  return Number(r[0].insertId);
}

const brandCache = new Map<string, number>();
async function ensureBrands(items: NormalizedProduct[]): Promise<Map<string, number>> {
  const db = getDb();
  const wanted = new Map<string, { name: string; country?: string }>();
  for (const it of items) {
    if (!it.brandName) continue;
    const n = norm(it.brandName);
    if (!brandCache.has(n)) wanted.set(n, { name: it.brandName.trim(), country: it.country });
  }
  for (const [n, info] of wanted) {
    const found = await db.select().from(brands).where(eq(brands.nameNorm, n)).limit(1);
    if (found.length) {
      brandCache.set(n, found[0].id);
      continue;
    }
    let slug = slugify(info.name) || "brand";
    for (let i = 2; ; i++) {
      const dup = await db.select({ id: brands.id }).from(brands).where(eq(brands.slug, slug)).limit(1);
      if (!dup.length) break;
      slug = `${slugify(info.name)}-${i}`;
    }
    try {
      const r = await db.insert(brands).values({ name: info.name, nameNorm: n, slug, country: info.country ?? null });
      brandCache.set(n, Number(r[0].insertId));
    } catch {
      const again = await db.select().from(brands).where(eq(brands.nameNorm, n)).limit(1);
      if (again.length) brandCache.set(n, again[0].id);
    }
  }
  return brandCache;
}

async function ensureCollections(items: NormalizedProduct[], brandMap: Map<string, number>): Promise<Map<string, number>> {
  const db = getDb();
  const cache = new Map<string, number>();
  const wanted = new Map<string, { brandId: number | null; name: string }>();
  for (const it of items) {
    if (!it.collectionName) continue;
    const brandId = it.brandName ? (brandMap.get(norm(it.brandName)) ?? null) : null;
    const key = `${brandId ?? 0}|${norm(it.collectionName)}`;
    wanted.set(key, { brandId, name: it.collectionName.trim() });
  }
  for (const [key, info] of wanted) {
    const cond = info.brandId
      ? and(eq(collections.brandId, info.brandId), eq(collections.nameNorm, norm(info.name)))
      : and(isNull(collections.brandId), eq(collections.nameNorm, norm(info.name)));
    const found = await db.select().from(collections).where(cond).limit(1);
    if (found.length) {
      cache.set(key, found[0].id);
      continue;
    }
    let slug = slugify(info.name) || "collection";
    for (let i = 2; ; i++) {
      const dup = await db.select({ id: collections.id }).from(collections).where(eq(collections.slug, slug)).limit(1);
      if (!dup.length) break;
      slug = `${slugify(info.name)}-${i}`;
    }
    try {
      const r = await db.insert(collections).values({ brandId: info.brandId, name: info.name, nameNorm: norm(info.name), slug });
      cache.set(key, Number(r[0].insertId));
    } catch {
      const again = await db.select().from(collections).where(cond).limit(1);
      if (again.length) cache.set(key, again[0].id);
    }
  }
  return cache;
}

export async function runImport(code: SourceCode): Promise<{ runId: number; stats: Record<string, number> }> {
  const db = getDb();
  const supplierId = await ensureSupplier(code);
  const [run] = await db.insert(importRuns).values({ supplierId, status: "running" });
  const runId = Number(run.insertId);
  const stats = { totalRows: 0, created: 0, updated: 0, skipped: 0, deactivated: 0 };
  const errors: string[] = [];
  try {
    const items = (await SOURCES[code].loader()).filter((it) => it.externalId && it.name);
    stats.totalRows = items.length;
    const slugTag = code;

    const brandMap = await ensureBrands(items);
    const collMap = await ensureCollections(items, brandMap);

    // карта существующих товаров поставщика
    const existingRows = await db
      .select({ id: products.id, externalId: products.externalId })
      .from(products)
      .where(eq(products.supplierId, supplierId));
    const existing = new Map(existingRows.map((r) => [r.externalId, r.id]));

    const rows = items.map((it) => {
      const brandId = it.brandName ? (brandMap.get(norm(it.brandName)) ?? null) : null;
      const collKey = `${brandId ?? 0}|${norm(it.collectionName ?? "")}`;
      const collectionId = it.collectionName ? (collMap.get(collKey) ?? null) : null;
      const baseSlug = slugify(`${it.brandName ?? ""} ${it.name}`) || "product";
      // slug стабилен и уникален без доп. запросов: базовый + код поставщика + внешний ID
      const slug = `${baseSlug}-${slugTag}-${slugify(it.externalId)}`.slice(0, 200);
      return {
        supplierId,
        externalId: it.externalId.slice(0, 250),
        sku: it.sku?.slice(0, 250) ?? null,
        name: it.name.slice(0, 500),
        nameNorm: norm(`${it.collectionName ?? ""} ${it.name} ${it.size ?? ""} ${it.color ?? ""}`).slice(0, 500),
        slug,
        brandId,
        collectionId,
        category: it.category,
        description: it.description ?? null,
        price: it.price !== undefined ? String(it.price) : null,
        oldPrice: it.oldPrice !== undefined ? String(it.oldPrice) : null,
        priceUnit: it.priceUnit ?? "м²",
        availabilityStatus: it.availabilityStatus,
        stockQty: it.stockQty !== undefined ? String(it.stockQty) : null,
        stockMsk: it.stockMsk !== undefined ? String(it.stockMsk) : null,
        stockSpb: it.stockSpb !== undefined ? String(it.stockSpb) : null,
        country: it.country ?? null,
        color: it.color ?? null,
        surface: it.surface ?? null,
        size: it.size ?? null,
        thickness: it.thickness ?? null,
        attrs: it.attrs ?? null,
        sourceUrl: it.sourceUrl ?? null,
        status: "active" as const,
        lastSeenAt: new Date(),
        _images: it.images, // служебное поле, не уходит в insert
      };
    });

    const updateSet = {
      sku: sql`VALUES(sku)`,
      name: sql`VALUES(name)`,
      nameNorm: sql`VALUES(name_norm)`,
      brandId: sql`VALUES(brand_id)`,
      collectionId: sql`VALUES(collection_id)`,
      category: sql`VALUES(category)`,
      description: sql`VALUES(description)`,
      price: sql`VALUES(price)`,
      oldPrice: sql`VALUES(old_price)`,
      priceUnit: sql`VALUES(price_unit)`,
      availabilityStatus: sql`VALUES(availability_status)`,
      stockQty: sql`VALUES(stock_qty)`,
      stockMsk: sql`VALUES(stock_msk)`,
      stockSpb: sql`VALUES(stock_spb)`,
      country: sql`VALUES(country)`,
      color: sql`VALUES(color)`,
      surface: sql`VALUES(surface)`,
      size: sql`VALUES(size)`,
      thickness: sql`VALUES(thickness)`,
      attrs: sql`VALUES(attrs)`,
      sourceUrl: sql`VALUES(source_url)`,
      status: sql`VALUES(status)`,
      lastSeenAt: sql`VALUES(last_seen_at)`,
    };

    for (const chunk of chunks(rows, 200)) {
      try {
        await db
          .insert(products)
          .values(chunk.map(({ _images, ...r }) => r))
          .onDuplicateKeyUpdate({ set: updateSet });
        stats.created += chunk.filter((r) => !existing.has(r.externalId)).length;
        stats.updated += chunk.filter((r) => existing.has(r.externalId)).length;
      } catch (e) {
        stats.skipped += chunk.length;
        if (errors.length < 20) errors.push(`batch: ${(e as Error).message.slice(0, 300)}`);
      }
    }

    // id новых/обновлённых товаров для изображений
    const idRows = await db
      .select({ id: products.id, externalId: products.externalId })
      .from(products)
      .where(eq(products.supplierId, supplierId));
    const idMap = new Map(idRows.map((r) => [r.externalId, r.id]));

    const withImages = rows.filter((r) => r._images.length && idMap.has(r.externalId));
    const pids = withImages.map((r) => idMap.get(r.externalId)!);
    for (const chunk of chunks(pids, 500)) {
      await db.delete(productImages).where(inArray(productImages.productId, chunk));
    }
    const imgRows = withImages.flatMap((r) =>
      r._images.slice(0, 10).map((url, i) => ({ productId: idMap.get(r.externalId)!, url, sortOrder: i })),
    );
    for (const chunk of chunks(imgRows, 1000)) {
      try {
        await db.insert(productImages).values(chunk);
      } catch (e) {
        if (errors.length < 20) errors.push(`images: ${(e as Error).message.slice(0, 200)}`);
      }
    }

    // Пропавшие из выгрузки -> archived (не удаляем, по ТЗ)
    const seenExt = new Set(items.map((i) => i.externalId));
    const toArchive = idRows.filter((p) => !seenExt.has(p.externalId)).map((p) => p.id);
    for (const chunk of chunks(toArchive, 500)) {
      await db
        .update(products)
        .set({ status: "archived", availabilityStatus: "unknown" })
        .where(inArray(products.id, chunk));
    }
    stats.deactivated = toArchive.length;

    await db
      .update(importRuns)
      .set({ status: "ok", finishedAt: new Date(), ...stats, errors: errors.join("\n") || null })
      .where(eq(importRuns.id, runId));
  } catch (e) {
    await db
      .update(importRuns)
      .set({ status: "error", finishedAt: new Date(), ...stats, errors: (e as Error).message })
      .where(eq(importRuns.id, runId));
    throw e;
  }
  return { runId, stats };
}

/** Дедупликация: внутри бренда по nameNorm оставляем товар приоритетного поставщика */
export async function dedupe(): Promise<number> {
  const db = getDb();
  await db.update(products).set({ duplicateOfId: null });
  const dups = await db.execute(sql`
    SELECT p.id, p.brand_id, p.name_norm, s.priority
    FROM products p
    JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.status = 'active' AND p.brand_id IS NOT NULL
    ORDER BY p.brand_id, p.name_norm, s.priority DESC, p.id ASC
  `);
  const rows = (dups as any)[0] as { id: number; brand_id: number; name_norm: string }[];
  let canonicalKey = "";
  let canonicalId = 0;
  let count = 0;
  const batch: { id: number; of: number }[] = [];
  const flush = async () => {
    for (const d of batch) {
      await db.update(products).set({ duplicateOfId: d.of }).where(eq(products.id, d.id));
    }
    batch.length = 0;
  };
  for (const r of rows) {
    const key = `${r.brand_id}|${r.name_norm}`;
    if (key !== canonicalKey) {
      canonicalKey = key;
      canonicalId = r.id;
    } else {
      batch.push({ id: r.id, of: canonicalId });
      count++;
      if (batch.length >= 200) await flush();
    }
  }
  await flush();
  return count;
}

export async function runCustomSource(id: number): Promise<Record<string, unknown>> {
  const db = getDb();
  const rows = await db.select().from(customSources).where(eq(customSources.id, id)).limit(1);
  if (!rows.length) throw new Error("Источник не найден");
  const src = rows[0];
  const code = `custom_${id}`;
  const existing = await db.select().from(suppliers).where(eq(suppliers.code, code)).limit(1);
  if (existing.length) {
    await db.update(suppliers).set({ name: src.name, importType: src.format, priority: 10, active: true }).where(eq(suppliers.id, existing[0].id));
  } else {
    await db.insert(suppliers).values({ code, name: src.name, importType: src.format, priority: 10, sourceUrl: src.url });
  }
  // регистрируем загрузчик на лету и используем общий пайплайн
  (SOURCES as any)[code] = { name: src.name, importType: src.format, priority: 10, loader: () => loadGenericSource(src.format, src.url) };
  const res = await runImport(code as SourceCode);
  delete (SOURCES as any)[code];
  return res.stats;
}

export async function runAllImports(): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  for (const code of Object.keys(SOURCES) as SourceCode[]) {
    try {
      result[code] = (await runImport(code)).stats;
    } catch (e) {
      result[code] = { error: (e as Error).message }; // ошибка одного не останавливает остальные
    }
  }
  // пользовательские источники из админки
  const db = getDb();
  const custom = await db.select().from(customSources).where(eq(customSources.active, true));
  for (const src of custom) {
    try {
      result[`custom_${src.id} (${src.name})`] = await runCustomSource(src.id);
    } catch (e) {
      result[`custom_${src.id} (${src.name})`] = { error: (e as Error).message };
    }
  }
  result.duplicates = await dedupe();
  return result;
}
