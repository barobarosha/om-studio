// Запросы каталога: фильтры, список, карточка, бренды, коллекции.

import { and, asc, desc, eq, sql, isNull, inArray, gte, lte, like, or, SQL } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { brands, collections, productImages, products, suppliers } from "@db/schema";

export interface CatalogFilters {
  category?: string;
  brandIds?: number[];
  countries?: string[];
  colors?: string[];
  surfaces?: string[];
  sizes?: string[];
  collections?: string[];
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
  if (f.inStockOnly) conds.push(inArray(products.availabilityStatus, ["in_stock", "low_stock"]));
  if (f.onSale) conds.push(sql`${products.oldPrice} IS NOT NULL AND ${products.oldPrice} > ${products.price}`);
  if (f.priceMin !== undefined) conds.push(gte(products.price, String(f.priceMin)));
  if (f.priceMax !== undefined) conds.push(lte(products.price, String(f.priceMax)));
  if (f.search) {
    const q = `%${f.search.trim()}%`;
    conds.push(
      or(like(products.name, q), like(products.sku, q), like(products.externalId, q), like(brands.name, q))!,
    );
  }
  return conds;
}

export async function listProducts(f: CatalogFilters) {
  const db = getDb();
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

export async function getFacets(f: CatalogFilters) {
  const db = getDb();
  const conds = buildWhere({ ...f, brandIds: undefined, countries: undefined, colors: undefined, surfaces: undefined, sizes: undefined });
  const where = and(...conds);
  const [brandRows, countryRows, colorRows, surfaceRows, sizeRows, [priceRange]] = await Promise.all([
    db
      .select({ id: brands.id, name: brands.name, slug: brands.slug, cnt: sql<number>`count(*)` })
      .from(products)
      .innerJoin(brands, eq(products.brandId, brands.id))
      .where(where)
      .groupBy(brands.id)
      .orderBy(desc(sql`count(*)`))
      .limit(100),
    db
      .select({ value: products.country, cnt: sql<number>`count(*)` })
      .from(products)
      .where(and(where, sql`${products.country} IS NOT NULL`))
      .groupBy(products.country)
      .orderBy(desc(sql`count(*)`))
      .limit(50),
    db
      .select({ value: products.color, cnt: sql<number>`count(*)` })
      .from(products)
      .where(and(where, sql`${products.color} IS NOT NULL`))
      .groupBy(products.color)
      .orderBy(desc(sql`count(*)`))
      .limit(60),
    db
      .select({ value: products.surface, cnt: sql<number>`count(*)` })
      .from(products)
      .where(and(where, sql`${products.surface} IS NOT NULL`))
      .groupBy(products.surface)
      .orderBy(desc(sql`count(*)`))
      .limit(40),
    db
      .select({ value: products.size, cnt: sql<number>`count(*)` })
      .from(products)
      .where(and(where, sql`${products.size} IS NOT NULL`))
      .groupBy(products.size)
      .orderBy(desc(sql`count(*)`))
      .limit(60),
    db
      .select({ min: sql<number>`min(${products.price})`, max: sql<number>`max(${products.price})` })
      .from(products)
      .where(and(where, sql`${products.price} IS NOT NULL`)),
  ]);
  return {
    brands: brandRows,
    countries: countryRows.filter((r) => r.value),
    colors: colorRows.filter((r) => r.value),
    surfaces: surfaceRows.filter((r) =>
      r.value && /матов|глянц|лаппат|сатин|структур|полиров|антискольз|противоскольз/i.test(r.value),
    ),
    sizes: sizeRows.filter((r) => r.value).map((r) => ({ ...r, value: r.value!.replace(/[х×]/g, "x") })),
    priceMin: priceRange?.min ? Number(priceRange.min) : 0,
    priceMax: priceRange?.max ? Number(priceRange.max) : 0,
  };
}

export async function getProductBySlug(slug: string) {
  const db = getDb();
  const rows = await db
    .select({ p: products, brandName: brands.name, brandSlug: brands.slug, collectionName: collections.name, supplierName: suppliers.name })
    .from(products)
    .leftJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(collections, eq(products.collectionId, collections.id))
    .leftJoin(suppliers, eq(products.supplierId, suppliers.id))
    .where(eq(products.slug, slug))
    .limit(1);
  if (!rows.length) return null;
  const r = rows[0];
  const images = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, r.p.id))
    .orderBy(asc(productImages.sortOrder));
  // похожие: та же коллекция или бренд
  const similarConds = [eq(products.status, "active"), isNull(products.duplicateOfId), sql`${products.id} != ${r.p.id}`];
  if (r.p.collectionId) similarConds.push(eq(products.collectionId, r.p.collectionId));
  else if (r.p.brandId) similarConds.push(eq(products.brandId, r.p.brandId));
  const similar = await db
    .select({ id: products.id, name: products.name, slug: products.slug, price: products.price, priceUnit: products.priceUnit, availabilityStatus: products.availabilityStatus, size: products.size })
    .from(products)
    .where(and(...similarConds))
    .limit(8);
  const simIds = similar.map((s) => s.id);
  const simImgs = simIds.length
    ? await db.select().from(productImages).where(and(inArray(productImages.productId, simIds), eq(productImages.sortOrder, 0)))
    : [];
  const simMap = new Map(simImgs.map((i) => [i.productId, i.url]));
  return {
    ...r.p,
    brandName: r.brandName,
    brandSlug: r.brandSlug,
    collectionName: r.collectionName,
    supplierName: r.supplierName,
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
    .orderBy(desc(sql`count(${products.id})`))
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
  return db.execute(sql`
    SELECT r.id, s.name AS supplier, s.code, r.started_at AS startedAt, r.finished_at AS finishedAt,
           r.status, r.total_rows AS totalRows, r.created, r.updated, r.skipped, r.deactivated, r.errors
    FROM import_runs r JOIN suppliers s ON s.id = r.supplier_id
    ORDER BY r.id DESC LIMIT 40
  `).then((r: any) => r[0]);
}
