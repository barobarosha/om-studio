// Серверные маршруты: товарный фид Яндекс Директа, sitemap, robots, планировщик импортов.

import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import cron from "node-cron";
import { getDb } from "./queries/connection";
import { products, brands, productImages } from "@db/schema";
import { and, eq, isNull, sql, inArray } from "drizzle-orm";
import { runAllImports } from "./importers/run";

const BASE_URL = process.env.SITE_URL ?? "https://plitka.om-studio.pro";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function yandexFeed(): Promise<string> {
  const db = getDb();
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      price: products.price,
      oldPrice: products.oldPrice,
      availabilityStatus: products.availabilityStatus,
      category: products.category,
      brandName: brands.name,
      country: products.country,
      size: products.size,
      surface: products.surface,
      color: products.color,
    })
    .from(products)
    .leftJoin(brands, eq(products.brandId, brands.id))
    .where(
      and(
        eq(products.status, "active"),
        isNull(products.duplicateOfId),
        sql`${products.price} IS NOT NULL AND ${products.price} > 0`,
      ),
    )
    .limit(50000);
  const ids = rows.map((r) => r.id);
  const imgs: { productId: number; url: string }[] = [];
  for (let i = 0; i < ids.length; i += 1000) {
    const chunk = ids.slice(i, i + 1000);
    const found = await db
      .select({ productId: productImages.productId, url: productImages.url })
      .from(productImages)
      .where(and(inArray(productImages.productId, chunk), eq(productImages.sortOrder, 0)));
    imgs.push(...found);
  }
  const imgMap = new Map(imgs.map((i) => [i.productId, i.url]));

  const offers = rows
    .map((p) => {
      const img = imgMap.get(p.id);
      const params = [
        p.size ? `<param name="Размер">${esc(p.size)} см</param>` : "",
        p.surface ? `<param name="Поверхность">${esc(p.surface)}</param>` : "",
        p.color ? `<param name="Цвет">${esc(p.color)}</param>` : "",
        p.country ? `<param name="Страна">${esc(p.country)}</param>` : "",
      ].join("");
      return `<offer id="${p.id}" available="${p.availabilityStatus === "in_stock" || p.availabilityStatus === "low_stock"}">
<name>${esc(p.name)}</name>
<url>${BASE_URL}/product/${p.slug}</url>
<price>${Number(p.price)}</price>
${p.oldPrice && Number(p.oldPrice) > Number(p.price) ? `<oldprice>${Number(p.oldPrice)}</oldprice>` : ""}
<currencyId>RUB</currencyId>
<categoryId>${p.category === "plitka" ? 2 : 1}</categoryId>
${p.brandName ? `<vendor>${esc(p.brandName)}</vendor>` : ""}
${img ? `<picture>${esc(img)}</picture>` : ""}
${params}
</offer>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE yml_catalog SYSTEM "shops.dtd">
<yml_catalog date="${new Date().toISOString().slice(0, 16).replace("T", " ")}">
<shop>
<name>ОМ Студия — керамогранит и плитка</name>
<company>ОМ Студия</company>
<url>${BASE_URL}</url>
<currencies><currency id="RUB" rate="1"/></currencies>
<categories>
<category id="1">Керамогранит</category>
<category id="2">Керамическая плитка</category>
</categories>
<offers>
${offers}
</offers>
</shop>
</yml_catalog>`;
}

async function sitemap(): Promise<string> {
  const db = getDb();
  const prods = await db
    .select({ slug: products.slug, updatedAt: products.updatedAt })
    .from(products)
    .where(and(eq(products.status, "active"), isNull(products.duplicateOfId)))
    .limit(49000);
  const brs = await db.select({ slug: brands.slug }).from(brands).where(eq(brands.active, true));
  const staticPages = ["", "catalog", "catalog/keramogranit", "catalog/plitka", "brands", "collections", "sale", "delivery", "contacts", "privacy"];
  const urls = [
    ...staticPages.map((p) => `<url><loc>${BASE_URL}/${p}</loc><changefreq>daily</changefreq></url>`),
    ...brs.map((b) => `<url><loc>${BASE_URL}/brands/${b.slug}</loc><changefreq>weekly</changefreq></url>`),
    ...prods.map(
      (p) =>
        `<url><loc>${BASE_URL}/product/${p.slug}</loc><lastmod>${p.updatedAt.toISOString().slice(0, 10)}</lastmod><changefreq>daily</changefreq></url>`,
    ),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
}

export function registerSiteRoutes(app: Hono<{ Bindings: HttpBindings }>) {
  app.get("/feed/yandex.xml", async (c) => {
    c.header("Content-Type", "application/xml; charset=utf-8");
    c.header("Cache-Control", "public, max-age=1800");
    return c.body(await yandexFeed());
  });
  app.get("/feeds/products.yml", async (c) => {
    c.header("Content-Type", "application/xml; charset=utf-8");
    c.header("Cache-Control", "public, max-age=1800");
    return c.body(await yandexFeed());
  });
  app.get("/sitemap.xml", async (c) => {
    c.header("Content-Type", "application/xml; charset=utf-8");
    return c.body(await sitemap());
  });
  app.get("/robots.txt", (c) => {
    c.header("Content-Type", "text/plain; charset=utf-8");
    return c.body(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /search
Clean-param: brand&country&color&surface&size&pmin&pmax&sort&page&stock /catalog

Sitemap: ${BASE_URL}/sitemap.xml
`);
  });
}

let schedulerStarted = false;
export function startImportScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  // Выгрузки поставщиков обновляются раз в час — синхронизируем каталог
  cron.schedule("7 * * * *", async () => {
    console.log("[cron] hourly import started", new Date().toISOString());
    try {
      const res = await runAllImports();
      console.log("[cron] import done", JSON.stringify(res));
    } catch (e) {
      console.error("[cron] import failed", e);
    }
  });
  console.log("[cron] hourly import scheduler registered");
}
