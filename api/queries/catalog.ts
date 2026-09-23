// Запросы каталога: фильтры, список, карточка, бренды, коллекции.

import { and, asc, desc, eq, sql, isNull, inArray, gte, lte, like, or, SQL } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { brands, collections, productImages, products } from "@db/schema";

export interface CatalogFilters {
  category?: string;
  brandIds?: number[];
  countries?: string[];
  colors?: string[];
  surfaces?: string[];
  sizes?: string[];
  designs?: string[];
  shapes?: string[];
  collections?: string[]; // имена коллекций — резолвятся в collectionIds перед запросом
  collectionIds?: number[];
  largeFormat?: boolean; // крупноформат: обе стороны ≥ 120 см
  mosaic?: boolean; // только мозаика
  inStockOnly?: boolean;
  onSale?: boolean;
  priceMin?: number;
  priceMax?: number;
  search?: string;
  sort?: "popular" | "price_asc" | "price_desc" | "newest" | "stock";
  page?: number;
  perPage?: number;
}

const baseWhere = (): SQL[] => [eq(products.status, "active"), isNull(products.duplicateOfId)];

function buildWhere(f: CatalogFilters): SQL[] {
  const conds = baseWhere();
  if (f.category) conds.push(eq(products.category, f.category));
  if (f.brandIds?.length) conds.push(inArray(products.brandId, f.brandIds));
  if (f.countries?.length) conds.push(inArray(products.country, f.countries));
  if (f.colors?.length) conds.push(inArray(products.color, f.colors));
  if (f.surfaces?.length) conds.push(inArray(products.surface, f.surfaces));
  if (f.sizes?.length) conds.push(inArray(products.size, f.sizes));
  if (f.designs?.length) conds.push(inArray(products.design, f.designs));
  if (f.shapes?.length) conds.push(inArray(products.shape, f.shapes));
  if (f.collectionIds?.length) conds.push(inArray(products.collectionId, f.collectionIds));
  if (f.largeFormat)
    conds.push(sql`(${products.size} REGEXP '^[0-9]+([.,][0-9]+)?x[0-9]+([.,][0-9]+)?$'
      AND CAST(REPLACE(SUBSTRING_INDEX(${products.size}, 'x', 1), ',', '.') AS DECIMAL(10,2)) >= 120
      AND CAST(REPLACE(SUBSTRING_INDEX(${products.size}, 'x', -1), ',', '.') AS DECIMAL(10,2)) >= 120)`);
  if (f.mosaic)
    conds.push(sql`(lower(${products.name}) LIKE '%мозаик%' OR lower(${products.name}) LIKE '%mosaic%'
      OR EXISTS (SELECT 1 FROM ${collections} WHERE ${collections.id} = ${products.collectionId}
        AND (lower(${collections.name}) LIKE '%мозаик%' OR lower(${collections.name}) LIKE '%mosaic%')))`);
  if (f.inStockOnly) conds.push(inArray(products.availabilityStatus, ["in_stock", "low_stock"]));
  if (f.onSale) conds.push(sql`${products.oldPrice} IS NOT NULL AND ${products.oldPrice} > ${products.price}`);
  if (f.priceMin !== undefined) conds.push(gte(products.price, String(f.priceMin)));
  if (f.priceMax !== undefined) conds.push(lte(products.price, String(f.priceMax)));
  if (f.search) {
    const q = `%${f.search.trim()}%`;
    conds.push(
      or(
        like(products.name, q),
        like(products.sku, q),
        like(products.externalId, q),
        like(products.design, q),
        like(products.description, q),
        sql`exists (select 1 from ${brands} where ${brands.id} = ${products.brandId} and ${brands.name} like ${q})`,
        sql`exists (select 1 from ${collections} where ${collections.id} = ${products.collectionId} and ${collections.name} like ${q})`,
      )!,
    );
  }
  return conds;
}

// Имена коллекций → id (фильтр приходит со строками-именами из фасетов)
async function resolveCollectionIds(f: CatalogFilters): Promise<CatalogFilters> {
  if (!f.collections?.length) return f;
  const db = getDb();
  const rows = await db
    .select({ id: collections.id })
    .from(collections)
    .where(inArray(collections.name, f.collections));
  const ids = rows.map((r) => r.id);
  const { collections: _c, ...rest } = f;
  return { ...rest, collectionIds: ids.length ? ids : [-1] };
}

export async function listProducts(input: CatalogFilters) {
  const db = getDb();
  const f = await resolveCollectionIds(input);
  const page = Math.max(1, f.page ?? 1);
  const perPage = Math.min(60, Math.max(6, f.perPage ?? 24));
  const conds = buildWhere(f);
  const orderBy =
    f.sort === "price_asc"
      ? [asc(products.price)]
      : f.sort === "price_desc"
        ? [desc(products.price)]
        : f.sort === "newest"
          ? [desc(products.createdAt)]
          : f.sort === "stock"
            ? [desc(products.stockQty)]
            : [sql`(CASE WHEN ${products.availabilityStatus} IN ('in_stock','low_stock') THEN 1 ELSE 0 END) * 0.6 + (CASE WHEN ${products.price} IS NOT NULL THEN 1 ELSE 0 END) * 0.2 + RAND(${Math.floor(Date.now()/3600000)}) * 0.2 DESC`];

  const base = db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      price: products.price,
      oldPrice: products.oldPrice,
      priceUnit: products.priceUnit,
      availabilityStatus: products.availabilityStatus,
      stockQty: products.stockQty,
      country: products.country,
      color: products.color,
      surface: products.surface,
      size: products.size,
      category: products.category,
      brandName: brands.name,
      brandSlug: brands.slug,
      collectionName: collections.name,
    })
    .from(products)
    .leftJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(collections, eq(products.collectionId, collections.id))
    .where(and(...conds));

  const [rows, [{ total }]] = await Promise.all([
    base.orderBy(...orderBy, asc(products.id)).limit(perPage).offset((page - 1) * perPage),
    db
      .select({ total: sql<number>`count(*)` })
      .from(products)
      .leftJoin(brands, eq(products.brandId, brands.id))
      .where(and(...conds)),
  ]);

  const ids = rows.map((r) => r.id);
  const imgs = ids.length
    ? await db
        .select()
        .from(productImages)
        .where(and(inArray(productImages.productId, ids), eq(productImages.sortOrder, 0)))
    : [];
  const imgMap = new Map(imgs.map((i) => [i.productId, i.url]));
  return {
    items: rows.map((r) => ({ ...r, image: imgMap.get(r.id) ?? null })),
    total: Number(total),
    page,
    perPage,
    pages: Math.ceil(Number(total) / perPage),
  };
}

export async function getFacets(input: CatalogFilters) {
  const db = getDb();
  const f = await resolveCollectionIds(input);
  // База для фасетов — фильтры, которые НЕ образуют само-фасет:
  // иначе, например, выбор коллекции обнулял бы счётчик этой же коллекции.
  const base = buildWhere({
    category: f.category,
    largeFormat: f.largeFormat,
    mosaic: f.mosaic,
    inStockOnly: f.inStockOnly,
    onSale: f.onSale,
    priceMin: f.priceMin,
    priceMax: f.priceMax,
    search: f.search,
  });
  const noCol = and(...base, ...(f.brandIds?.length ? [inArray(products.brandId, f.brandIds)] : []));
  // внутри мульти-группы — OR, между группами — AND
  const withSel = (col: any, vals?: string[]) =>
    and(noCol, ...(f.collectionIds?.length ? [inArray(products.collectionId, f.collectionIds)] : []), ...(vals?.length ? [inArray(col, vals)] : []));
  const withBrand = (extra: SQL[]) => and(...base, ...(f.brandIds?.length ? [inArray(products.brandId, f.brandIds)] : []), ...extra);

  const [brandRows, countryRows, colorRows, surfaceRows, sizeRows, designRows, shapeRows, collectionRows, [priceRange]] = await Promise.all([
    // бренды: под все выбранные фильтры, кроме самого бренда
    db
      .select({ id: brands.id, name: brands.name, slug: brands.slug, cnt: sql<number>`count(*)` })
      .from(products)
      .innerJoin(brands, eq(products.brandId, brands.id))
      .where(withBrand([
        ...(f.countries?.length ? [inArray(products.country, f.countries)] : []),
        ...(f.colors?.length ? [inArray(products.color, f.colors)] : []),
        ...(f.surfaces?.length ? [inArray(products.surface, f.surfaces)] : []),
        ...(f.sizes?.length ? [inArray(products.size, f.sizes)] : []),
        ...(f.designs?.length ? [inArray(products.design, f.designs)] : []),
        ...(f.shapes?.length ? [inArray(products.shape, f.shapes)] : []),
        ...(f.collectionIds?.length ? [inArray(products.collectionId, f.collectionIds)] : []),
      ]))
      .groupBy(brands.id)
      .orderBy(asc(brands.name))
      .limit(200),
    db
      .select({ value: products.country, cnt: sql<number>`count(*)` })
      .from(products)
      .where(and(withSel(products.country, f.countries), sql`${products.country} IS NOT NULL`))
      .groupBy(products.country)
      .orderBy(asc(products.country))
      .limit(50),
    db
      .select({ value: products.color, cnt: sql<number>`count(*)` })
      .from(products)
      .where(and(withSel(products.color, f.colors), sql`${products.color} IS NOT NULL`))
      .groupBy(products.color)
      .orderBy(asc(products.color))
      .limit(60),
    db
      .select({ value: products.surface, cnt: sql<number>`count(*)` })
      .from(products)
      .where(and(withSel(products.surface, f.surfaces), sql`${products.surface} IS NOT NULL`))
      .groupBy(products.surface)
      .orderBy(asc(products.surface))
      .limit(40),
    // берём 60 САМЫХ ЧАСТЫХ размеров (иначе лимит съедали мелкие мозаичные форматы
    // и популярные 60x120 / 120x120 / 160x320 не попадали в фильтр),
    // а по возрастанию сторон сортируем уже в JS ниже
    db
      .select({ value: products.size, cnt: sql<number>`count(*)` })
      .from(products)
      .where(and(withSel(products.size, f.sizes), sql`${products.size} IS NOT NULL`))
      .groupBy(products.size)
      .orderBy(desc(sql`count(*)`))
      .limit(60),
    db
      .select({ value: products.design, cnt: sql<number>`count(*)` })
      .from(products)
      .where(and(withSel(products.design, f.designs), sql`${products.design} IS NOT NULL`))
      .groupBy(products.design)
      .orderBy(asc(products.design))
      .limit(30),
    db
      .select({ value: products.shape, cnt: sql<number>`count(*)` })
      .from(products)
      .where(and(withSel(products.shape, f.shapes), sql`${products.shape} IS NOT NULL`))
      .groupBy(products.shape)
      .orderBy(asc(products.shape))
      .limit(10),
    // коллекции: БЕЗ фильтра по коллекциям — иначе выбранная коллекция обнуляет сама себя,
    // а при выборе второй обе превращаются в 0 и выборка становится пустой
    db
      .select({ value: collections.name, cnt: sql<number>`count(*)` })
      .from(products)
      .innerJoin(collections, eq(products.collectionId, collections.id))
      .where(and(noCol, sql`${collections.name} IS NOT NULL`))
      .groupBy(collections.name)
      .orderBy(asc(collections.name))
      .limit(300),
    db
      .select({ min: sql<number>`min(${products.price})`, max: sql<number>`max(${products.price})` })
      .from(products)
      .where(withBrand([])),
  ]);
  // Выбранные значения должны оставаться в списках фасетов (иначе галочка
  // «теряется», когда сам фильтр сужает выборку до пределов лимита).
  const mergeSelected = <T extends { value: string | null; cnt: number }>(rows: T[], selected?: string[]): T[] => {
    if (!selected?.length) return rows;
    const missing = selected.filter((v) => !rows.some((r) => r.value === v)).map((v) => ({ value: v, cnt: 0 }) as T);
    return missing.length ? [...rows, ...missing] : rows;
  };
  return {
    brands: brandRows,
    countries: mergeSelected(countryRows, input.countries).filter((r) => r.value),
    colors: mergeSelected(colorRows, input.colors).filter((r) => r.value),
    surfaces: mergeSelected(surfaceRows, input.surfaces).filter((r) =>
      r.value && (/матов|глянц|лаппат|сатин|структур|полиров|антискольз|противоскольз/i.test(r.value) || (input.surfaces ?? []).includes(r.value)),
    ),
    sizes: mergeSelected(sizeRows, input.sizes)
      .filter((r) => r.value)
      .map((r) => ({ ...r, value: r.value!.replace(/[х×]/g, "x") }))
      .sort((a, b) => {
        const pa = a.value.toLowerCase().replace(",", ".").split("x").map(Number);
        const pb = b.value.toLowerCase().replace(",", ".").split("x").map(Number);
        return (pa[0] || 0) - (pb[0] || 0) || (pa[1] || 0) - (pb[1] || 0);
      }),
    designs: mergeSelected(designRows, input.designs).filter((r) => r.value),
    shapes: mergeSelected(shapeRows, input.shapes).filter((r) => r.value),
    // отсекаем мусорные «коллекции» из выгрузок: «2», «2СОРТ», «20X120» и т.п.
    // (выбранные пользователем значения оставляем — они должны отображаться с галочкой)
    collections: mergeSelected(collectionRows, input.collections).filter((r) => r.value && ((input.collections ?? []).includes(r.value) || (r.value.trim().length >= 3 && !/^\d+$/.test(r.value.trim()) && !/^\d+x\d+$/i.test(r.value.trim()) && !/сорт/i.test(r.value)))),
    priceMin: priceRange?.min ? Number(priceRange.min) : 0,
    priceMax: priceRange?.max ? Number(priceRange.max) : 0,
  };
}

export async function getProductBySlug(slug: string) {
  const db = getDb();
  const rows = await db
    .select({ p: products, brandName: brands.name, brandSlug: brands.slug, collectionName: collections.name })
    .from(products)
    .leftJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(collections, eq(products.collectionId, collections.id))
    .where(eq(products.slug, slug))
    .limit(1);
  if (!rows.length) return null;
  const r = rows[0];
  // наружу не отдаём данные поставщика и точные остатки — только публичные поля карточки
  const { supplierId, externalId, stockQty, stockMsk, stockSpb, nameNorm, duplicateOfId, lastSeenAt, ...publicP } = r.p as any;
  const images = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, r.p.id))
    .orderBy(asc(productImages.sortOrder));
  // похожие: сначала та же коллекция, при недостатке — бренд и тот же дизайн/размер
  const baseConds = [eq(products.status, "active"), isNull(products.duplicateOfId), sql`${products.id} != ${r.p.id}`];
  const simSelect = {
    id: products.id, name: products.name, slug: products.slug, price: products.price,
    priceUnit: products.priceUnit, availabilityStatus: products.availabilityStatus, size: products.size,
  };
  const seen = new Set<number>([r.p.id]);
  let similar: { id: number; name: string; slug: string; price: any; priceUnit: any; availabilityStatus: string; size: string | null }[] = [];
  if (r.p.collectionId) {
    const rows1 = await db.select(simSelect).from(products)
      .where(and(...baseConds, eq(products.collectionId, r.p.collectionId))).limit(8);
    similar = rows1.filter((s) => !seen.has(s.id) && seen.add(s.id));
  }
  if (similar.length < 8 && r.p.brandId) {
    const rows2 = await db.select(simSelect).from(products)
      .where(and(...baseConds, eq(products.brandId, r.p.brandId))).limit(8);
    for (const s of rows2) if (similar.length < 8 && !seen.has(s.id) && seen.add(s.id)) similar.push(s);
  }
  if (similar.length < 8) {
    const extraConds = [...baseConds];
    if (r.p.design) extraConds.push(eq(products.design, r.p.design));
    if (r.p.size) extraConds.push(eq(products.size, r.p.size));
    extraConds.push(eq(products.category, r.p.category));
    const rows3 = await db.select(simSelect).from(products)
      .where(and(...extraConds))
      .orderBy(desc(sql`${products.price} IS NOT NULL`)).limit(16);
    for (const s of rows3) if (similar.length < 8 && !seen.has(s.id) && seen.add(s.id)) similar.push(s);
  }
  const simIds = similar.map((s) => s.id);
  const simImgs = simIds.length
    ? await db.select().from(productImages).where(and(inArray(productImages.productId, simIds), eq(productImages.sortOrder, 0)))
    : [];
  const simMap = new Map(simImgs.map((i) => [i.productId, i.url]));
  return {
    ...publicP,
    brandName: r.brandName,
    brandSlug: r.brandSlug,
    collectionName: r.collectionName,
    images: images.map((i) => i.url),
    similar: similar.map((s) => ({ ...s, image: simMap.get(s.id) ?? null })),
  };
}

export async function listBrands() {
  const db = getDb();
  return db
    .select({ id: brands.id, name: brands.name, slug: brands.slug, country: brands.country, cnt: sql<number>`count(${products.id})` })
    .from(brands)
    .innerJoin(products, and(eq(products.brandId, brands.id), eq(products.status, "active"), isNull(products.duplicateOfId)))
    .where(eq(brands.active, true))
    .groupBy(brands.id)
    .orderBy(asc(brands.name));
}

export async function getBrandBySlug(slug: string) {
  const db = getDb();
  const rows = await db.select().from(brands).where(eq(brands.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function listCollections(brandId?: number) {
  const db = getDb();
  const conds = [eq(collections.active, true)];
  if (brandId) conds.push(eq(collections.brandId, brandId));
  return db
    .select({ id: collections.id, name: collections.name, slug: collections.slug, brandId: collections.brandId, brandName: brands.name, cnt: sql<number>`count(${products.id})` })
    .from(collections)
    .innerJoin(products, and(eq(products.collectionId, collections.id), eq(products.status, "active"), isNull(products.duplicateOfId)))
    .leftJoin(brands, eq(collections.brandId, brands.id))
    .where(and(...conds))
    .groupBy(collections.id)
    .orderBy(asc(collections.name))
    .limit(500);
}

export async function catalogStats() {
  const db = getDb();
  const conds = and(...baseWhere());
  const [[{ total }], [{ inStock }], [{ brandsCnt }], [{ collectionsCnt }], [lastRun]] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(products).where(conds),
    db.select({ inStock: sql<number>`count(*)` }).from(products).where(and(conds, inArray(products.availabilityStatus, ["in_stock", "low_stock"]))),
    db.select({ brandsCnt: sql<number>`count(distinct ${products.brandId})` }).from(products).where(conds),
    db.select({ collectionsCnt: sql<number>`count(distinct ${products.collectionId})` }).from(products).where(conds),
    db
      .select({ finishedAt: sql<string>`max(finished_at)` })
      .from(sql`import_runs`)
      .where(sql`status = 'ok'`),
  ]);
  return {
    total: Number(total),
    inStock: Number(inStock),
    brands: Number(brandsCnt),
    collections: Number(collectionsCnt),
    lastImportAt: lastRun?.finishedAt ?? null,
  };
}

export async function heroImages() {
  const db = getDb();
  // интерьерные/предметные фото товаров в наличии — для карусели первого экрана
  return db.execute(sql`
    SELECT i.url, p.name, p.slug FROM product_images i
    JOIN products p ON p.id = i.product_id
    WHERE p.status = 'active' AND p.duplicate_of_id IS NULL AND i.sort_order = 0
      AND p.availability_status IN ('in_stock','low_stock')
    ORDER BY RAND() LIMIT 12
  `).then((r: any) => r[0] as { url: string; name: string; slug: string }[]);
}

export async function listImportRuns() {
  const db = getDb();
  const rows = await db.execute(sql`
    SELECT r.id, s.name AS supplier, s.code, r.started_at AS startedAt, r.finished_at AS finishedAt,
           r.status, r.total_rows AS totalRows, r.created, r.updated, r.skipped, r.deactivated, r.errors
    FROM import_runs r JOIN suppliers s ON s.id = r.supplier_id
    ORDER BY r.id DESC LIMIT 40
  `).then((r: any) => r[0]);
  // сколько активных товаров каждого поставщика сейчас без фото
  const noImg = await db.execute(sql`
    SELECT s.code, count(*) AS c
    FROM products p JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.status = 'active' AND p.duplicate_of_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM product_images i WHERE i.product_id = p.id)
    GROUP BY s.code
  `).then((r: any) => r[0] as { code: string; c: number }[]);
  const map = new Map(noImg.map((r) => [r.code, Number(r.c)]));
  return rows.map((r: any) => ({ ...r, missingImages: map.get(r.code) ?? 0 }));
}
