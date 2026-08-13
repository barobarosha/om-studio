// Адаптеры поставщиков: каждый приводит свою выгрузку к NormalizedProduct[].
// Ошибка одного адаптера не останавливает остальные (см. run.ts).

import { parse as csvParse } from "csv-parse/sync";
import { XMLParser } from "fast-xml-parser";
import * as XLSX from "xlsx";
import * as iconv from "iconv-lite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NormalizedProduct } from "./normalize";
import {
  availabilityFromQty,
  extractSize,
  extractThickness,
  guessCategory,
  normalizeCountry,
  normalizeSize,
  normalizeSurface,
  normalizeUnit,
  toNum,
} from "./normalize";



async function fetchBuf(url: string, auth?: { user: string; pass: string }): Promise<Buffer> {
  const headers: Record<string, string> = {};
  if (auth) headers.Authorization = "Basic " + Buffer.from(`${auth.user}:${auth.pass}`).toString("base64");
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(300_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      lastErr = e;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
  throw lastErr;
}

const xmlParser = () =>
  new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", trimValues: true, parseTagValue: false });

const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

// ─── 1. Керамотека (CSV cp1251, basic auth, обновление раз в час) ───────────
export async function loadKeramoteka(): Promise<NormalizedProduct[]> {
  const buf = await fetchBuf("https://www.keramoteka.ru/export/keramoteka_export.csv", {
    user: "dealer",
    pass: "iFmDB3PQd2",
  });
  const text = iconv.decode(buf, "win1251");
  const rows: Record<string, string>[] = csvParse(text, {
    columns: true,
    delimiter: ";",
    skip_empty_lines: true,
    relax_column_count: true,
  });
  const out: NormalizedProduct[] = [];
  for (const r of rows) {
    const name = (r.Name ?? "").trim();
    if (!name) continue;
    const msk = toNum(r.Stock_MSK);
    const spb = toNum(r.Stock_SPB);
    const total = (msk ?? 0) + (spb ?? 0);
    const price = toNum(r.Price);
    out.push({
      externalId: (r.Code ?? name).trim(),
      sku: (r.Code ?? "").trim() || undefined,
      name,
      brandName: r.Brand?.trim() || undefined,
      collectionName: r.Collection?.trim() || undefined,
      category: guessCategory({ name }),
      price,
      priceUnit: normalizeUnit(r.U_M),
      stockMsk: msk,
      stockSpb: spb,
      stockQty: msk !== undefined || spb !== undefined ? total : undefined,
      availabilityStatus: availabilityFromQty(msk !== undefined || spb !== undefined ? total : undefined),
      country: normalizeCountry(r.Country),
      size: extractSize(r.Size ?? ""),
      images: r.Image ? [r.Image.trim()] : [],
    });
  }
  return out;
}

// ─── 2. Керамика Сервис (XLSX, приоритетный источник цен) ───────────────────
export async function loadKerService(): Promise<NormalizedProduct[]> {
  const buf = await fetchBuf("https://partners.ker-service.ru/upload/catalog_export.xlsx");
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  const hdr = (rows[0] as string[]).map(String);
  const col = (name: string) => hdr.findIndex((h) => h.includes(name));
  const c = {
    article: col("Артикул"), name: col("Наименование элемента"), brand: col("Производитель"),
    collection: col("Коллекция"), country: col("Страна"), url: col("URL товара"),
    unit: col("Базовая единица"), qty: col("Доступное количество"), material: col("Материал"),
    surface: col("Тип поверхности"), color: col("Цвет"), dlina: col("Длина"), shirina: col("Ширина"),
    retail: col('Цена "Розничная склад"'), image: col("Детальная картинка"),
    more: col("Картинки [MORE_PHOTO]"), lifecycle: col("Жизненный цикл"),
  };
  const out: NormalizedProduct[] = [];
  for (const r of rows.slice(1)) {
    const cells = r as unknown[];
    const article = String(cells[c.article] ?? "").trim();
    const name = String(cells[c.name] ?? "").trim();
    if (!article || !name) continue; // строки-заголовки брендов пропускаем
    const qty = toNum(cells[c.qty]);
    const dlina = toNum(cells[c.dlina]);
    const shirina = toNum(cells[c.shirina]);
    const images: string[] = [];
    const mainImg = String(cells[c.image] ?? "").trim();
    if (mainImg.startsWith("http")) images.push(mainImg);
    const more = String(cells[c.more] ?? "");
    for (const u of more.split(/[;,\n]/)) {
      const t = u.trim();
      if (t.startsWith("http")) images.push(t);
    }
    const lifecycle = String(cells[c.lifecycle] ?? "").toLowerCase();
    out.push({
      externalId: article,
      sku: article,
      name,
      brandName: String(cells[c.brand] ?? "").trim() || undefined,
      collectionName: String(cells[c.collection] ?? "").trim() || undefined,
      category: guessCategory({ material: String(cells[c.material] ?? ""), name }),
      price: toNum(cells[c.retail]), // дилерские цены НЕ выводим (по требованию заказчика)
      priceUnit: normalizeUnit(String(cells[c.unit] ?? "")),
      stockQty: qty,
      availabilityStatus: availabilityFromQty(qty),
      country: normalizeCountry(String(cells[c.country] ?? "")),
      color: String(cells[c.color] ?? "").trim() || undefined,
      surface: normalizeSurface(String(cells[c.surface] ?? "")),
      size: dlina && shirina ? `${dlina}x${shirina}` : extractSize(name),
      images,
      sourceUrl: String(cells[c.url] ?? "").trim() || undefined,
      attrs: lifecycle.includes("элиминир") ? { "Жизненный цикл": "Выводится из ассортимента" } : undefined,
    });
  }
  return out;
}

// ─── 3. Toscana Design (XML остатков, обновление раз в час) ─────────────────
export async function loadToscana(): Promise<NormalizedProduct[]> {
  const buf = await fetchBuf("https://toscana-design.ru/userfiles/to_download/toscana-ostatki.xml");
  const doc = xmlParser().parse(buf.toString("utf-8"));
  const items = arr(doc?.Каталог?.Номенклатура);
  const out: NormalizedProduct[] = [];
  for (const it of items) {
    const nameFull = String(it["@_Наименование"] ?? "").trim();
    const article = String(it["@_Артикул"] ?? "").trim();
    if (!nameFull || !article) continue;
    // Наименование: "ONYX&MORE WHITE ONYX SATIN 6MM 120X280 R (766020) 120x280 Неглазурованный керамогранит"
    const name = nameFull.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
    const stock = arr(it.Остаток).reduce((s, o) => s + (toNum(o?.["@_Количество"]) ?? 0), 0);
    const collMatch = name.match(/^([A-ZА-Я0-9&' -]+?)\s+[A-ZА-Я]/);
    out.push({
      externalId: article,
      sku: article,
      name,
      collectionName: collMatch?.[1]?.trim(),
      category: guessCategory({ name: nameFull }),
      price: toNum(it["@_Цена"]),
      priceUnit: "м²",
      stockQty: stock,
      availabilityStatus: availabilityFromQty(stock),
      size: extractSize(name),
      thickness: extractThickness(name),
      surface: normalizeSurface(name),
      images: [],
    });
  }
  return out;
}

// ─── Общий разбор YML (Яндекс.Маркет формат) ────────────────────────────────
interface YmlCtx { brandFromCategory?: boolean }

function parseYml(text: string, ctx: YmlCtx = {}): NormalizedProduct[] {
  const doc = xmlParser().parse(text);
  const shop = doc?.yml_catalog?.shop ?? {};
  const cats: Record<string, { name: string; parentId?: string }> = {};
  for (const c of arr(shop?.categories?.category)) {
    cats[String(c["@_id"])] = { name: String(c["#text"] ?? "").trim(), parentId: c["@_parentId"] ? String(c["@_parentId"]) : undefined };
  }
  const catPath = (id?: string): string[] => {
    const path: string[] = [];
    let cur = id ? cats[id] : undefined;
    let guard = 0;
    while (cur && guard++ < 5) {
      path.unshift(cur.name);
      cur = cur.parentId ? cats[cur.parentId] : undefined;
    }
    return path;
  };
  const out: NormalizedProduct[] = [];
  for (const o of arr(shop?.offers?.offer)) {
    const name = String(o.name ?? o.model ?? "").trim();
    if (!name) continue;
    const params: Record<string, string> = {};
    for (const p of arr(o.param)) {
      const k = String(p["@_name"] ?? "").trim();
      const v = String(p["#text"] ?? "").trim();
      if (k && v) params[k] = v;
    }
    const path = catPath(o.categoryId !== undefined ? String(o.categoryId) : undefined);
    const vendor = String(o.vendor ?? "").trim();
    const vendorCode = String(o.vendorCode ?? "").trim();
    const brandName = vendor || (ctx.brandFromCategory ? path[0] : undefined) || path[path.length - 2];
    const collectionName = vendorCode || (ctx.brandFromCategory && path.length > 1 ? path[path.length - 1] : undefined);
    const qty = toNum(o.quantity);
    const pictures = arr(o.picture)
      .flatMap((p) => String(p).split(";"))
      .map((s) => s.trim())
      .filter((s) => s.startsWith("http"));
    const available = o["@_available"];
    const material = params["Материал"] ?? path[0] ?? "";
    const surfaceRaw = params["Вид поверхности"] ?? params["Поверхность"];
    out.push({
      externalId: String(o["@_id"] ?? name),
      sku: String(o.barcode ?? o.model ?? "").trim() || undefined,
      name,
      brandName: brandName?.trim() || undefined,
      collectionName: collectionName?.trim() || undefined,
      category: guessCategory({ material, name }),
      description: typeof o.description === "string" ? o.description.trim() : undefined,
      price: toNum(o.price),
      oldPrice: toNum(o.oldprice),
      priceUnit: normalizeUnit(String(o.UM ?? "м²")),
      stockQty: qty,
      availabilityStatus:
        qty !== undefined ? availabilityFromQty(qty) : available === "true" ? "in_stock" : available === "false" ? "out_of_stock" : "unknown",
      color: params["Цвет"],
      surface: normalizeSurface(surfaceRaw),
      size: normalizeSize(params["Формат"]) ?? extractSize(name),
      thickness: params["Толщина"],
      attrs: Object.keys(params).length ? params : undefined,
      images: pictures,
      sourceUrl: typeof o.url === "string" ? o.url : undefined,
    });
  }
  return out;
}

// ─── 4. Бомонд (YML cp1251) ──────────────────────────────────────────────────
export async function loadBomond(): Promise<NormalizedProduct[]> {
  const buf = await fetchBuf("https://bomondceramica.ru/bitrix/catalog_export/plitka_custom.php");
  return parseYml(iconv.decode(buf, "win1251"), { brandFromCategory: true });
}

// ─── 5. ViaCeramica (YML cp1251) ─────────────────────────────────────────────
export async function loadViaCeramica(): Promise<NormalizedProduct[]> {
  const buf = await fetchBuf(
    "https://viaceramica.online/index.php?route=extension/module/viaceramica_api&secret_key=hmlx4WPh",
  );
  return parseYml(iconv.decode(buf, "win1251"));
}

// ─── 6. Керам (kerum-stock, custom XML, UTF-8) ───────────────────────────────
export async function loadKerum(): Promise<NormalizedProduct[]> {
  const buf = await fetchBuf("http://kerum-stock.ru/i-store/exp/stock.php?l=riversan1&p=1102riversan");
  const doc = xmlParser().parse(buf.toString("utf-8"));
  const out: NormalizedProduct[] = [];
  for (const a of arr(doc?.catalogue?.article)) {
    const name = String(a.name ?? "").trim();
    if (!name) continue;
    const qty = toNum(a.stock);
    const images: string[] = [];
    for (const k of ["min", "int"]) {
      const u = String(a[k] ?? "").trim();
      if (u.startsWith("http")) images.push(u);
    }
    out.push({
      externalId: String(a.idfull ?? a.id ?? name),
      sku: String(a.id ?? "").trim() || undefined,
      name,
      brandName: String(a.brand ?? "").trim() || undefined,
      collectionName: String(a.collection ?? "").trim() || undefined,
      category: guessCategory({ type: String(a.type ?? ""), name }),
      price: toNum(a.retail) ?? toNum(a.price), // розница в приоритете
      priceUnit: normalizeUnit(String(a.unit ?? "м2")),
      stockQty: qty,
      availabilityStatus: availabilityFromQty(qty),
      country: normalizeCountry(String(a.country ?? "")),
      size: normalizeSize(String(a.size ?? "").replace(/X/g, "x")) ?? extractSize(name),
      thickness: String(a.thickness ?? "").trim() || undefined,
      attrs: a.application ? { Назначение: String(a.application) } : undefined,
      images,
    });
  }
  return out;
}

// ─── 7. Apextile (CSV cp1251, файл от заказчика) ────────────────────────────
export async function loadApextile(): Promise<NormalizedProduct[]> {
  const buf = readFileSync(join(process.cwd(), "db/data/apextile.csv"));
  const text = iconv.decode(buf, "win1251");
  const rows: Record<string, string>[] = csvParse(text, {
    columns: true,
    delimiter: ";",
    skip_empty_lines: true,
    relax_column_count: true,
  });
  const out: NormalizedProduct[] = [];
  for (const r of rows) {
    const name = (r["name : Название"] ?? "").trim();
    if (!name) continue;
    const hidden = (r["hidden : Скрыто"] ?? "").trim();
    if (hidden === "1") continue;
    const qty = toNum(r["amount : Количество"]);
    const images = (r["image : Иллюстрация"] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.startsWith("http"));
    out.push({
      externalId: (r["kind_id : ID"] ?? r["article : Артикул"] ?? name).trim(),
      sku: (r["article : Артикул"] ?? "").trim() || undefined,
      name,
      brandName: (r["vendor : Производитель"] ?? "").trim() || undefined,
      category: guessCategory({ material: r["cf_tip_materiala : Тип материала"], name }),
      description: (r["body : Описание"] ?? "").trim() || undefined,
      price: toNum(r["price : Цена"]),
      oldPrice: toNum(r["price_old : Старая цена"]),
      priceUnit: normalizeUnit(r["unit : Единица измерения"]),
      stockQty: qty,
      availabilityStatus: availabilityFromQty(qty),
      country: normalizeCountry(r["cf_strana : Страна"]),
      color: (r["cf_cvet_725 : Цвет"] ?? "").trim() || undefined,
      surface: normalizeSurface(r["cf_poverhnost_ : Поверхность"]),
      size: normalizeSize(r["cf_osnovnoj_razmer_793 : Основной размер"]) ?? extractSize(name),
      thickness: (r["cf_tolsina : Толщина"] ?? "").trim() || undefined,
      attrs: r["cf_oblast_primenenia : Область применения"]
        ? { Назначение: r["cf_oblast_primenenia : Область применения"].trim() }
        : undefined,
      images,
    });
  }
  return out;
}

export const SOURCES = {
  kerservice: { name: "Керамика Сервис", importType: "xlsx", priority: 100, loader: loadKerService },
  keramoteka: { name: "Керамотека", importType: "csv", priority: 50, loader: loadKeramoteka },
  toscana: { name: "Toscana Design", importType: "xml", priority: 40, loader: loadToscana },
  bomond: { name: "Бомонд", importType: "yml", priority: 30, loader: loadBomond },
  viaceramica: { name: "ViaCeramica", importType: "yml", priority: 30, loader: loadViaCeramica },
  kerum: { name: "Керам", importType: "xml", priority: 30, loader: loadKerum },
  apextile: { name: "Apextile", importType: "csv", priority: 20, loader: loadApextile },
} as const;

export type SourceCode = keyof typeof SOURCES;

// ─── Универсальный загрузчик для источников, добавленных через админку ───────

const HEADER_MAP: Record<string, RegExp> = {
  name: /^name$|наименование|название/i,
  brand: /^brand$|бренд|фабрика|производитель|vendor/i,
  collection: /коллекц|collection/i,
  sku: /артикул|article|code|код/i,
  price: /рознич|retail|^price$|цена/i,
  qty: /остаток|количество|stock|наличие|quantity|amount/i,
  image: /изображ|картинк|image|picture|фото|л?инк/i,
  size: /размер|size|формат/i,
  country: /страна|country/i,
  color: /цвет|color|colour/i,
  surface: /поверхност|surface/i,
  unit: /единиц|unit|u_m/i,
};

function mapHeaders(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    for (const [key, re] of Object.entries(HEADER_MAP)) {
      if (map[key] === undefined && re.test(h)) map[key] = i;
    }
  });
  return map;
}

function rowsToNormalized(headers: string[], rows: unknown[][]): NormalizedProduct[] {
  const c = mapHeaders(headers);
  if (c.name === undefined) throw new Error("Не найдена колонка с наименованием товара");
  const cell = (r: unknown[], i?: number) => (i === undefined ? "" : String(r[i] ?? "").trim());
  const out: NormalizedProduct[] = [];
  for (const r of rows) {
    const name = cell(r, c.name);
    if (!name) continue;
    const qty = toNum(cell(r, c.qty));
    out.push({
      externalId: cell(r, c.sku) || name,
      sku: cell(r, c.sku) || undefined,
      name,
      brandName: cell(r, c.brand) || undefined,
      collectionName: cell(r, c.collection) || undefined,
      category: guessCategory({ name }),
      price: toNum(cell(r, c.price)),
      priceUnit: normalizeUnit(cell(r, c.unit)),
      stockQty: qty,
      availabilityStatus: availabilityFromQty(qty),
      country: normalizeCountry(cell(r, c.country)),
      color: cell(r, c.color) || undefined,
      surface: normalizeSurface(cell(r, c.surface)),
      size: normalizeSize(cell(r, c.size)) ?? extractSize(name),
      images: cell(r, c.image)
        .split(/[;,\n]/)
        .map((s) => s.trim())
        .filter((s) => s.startsWith("http")),
    });
  }
  return out;
}

export async function loadGenericSource(format: string, url: string): Promise<NormalizedProduct[]> {
  const buf = await fetchBuf(url);
  if (format === "yml") {
    let text = buf.toString("utf-8");
    if (/windows-1251/i.test(text.slice(0, 300))) text = iconv.decode(buf, "win1251");
    return parseYml(text);
  }
  if (format === "csv") {
    let text = buf.toString("utf-8");
    if (text.includes("")) text = iconv.decode(buf, "win1251");
    const first = text.split("\n", 1)[0];
    const delimiter = (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) ? ";" : ",";
    const rows: string[][] = csvParse(text, { delimiter, skip_empty_lines: true, relax_column_count: true });
    return rowsToNormalized(rows[0] ?? [], rows.slice(1));
  }
  if (format === "xlsx") {
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
    return rowsToNormalized((rows[0] as unknown[]).map(String), rows.slice(1));
  }
  throw new Error(`Неподдерживаемый формат: ${format}`);
}
