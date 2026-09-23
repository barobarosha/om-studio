// Поиск фото для товаров без картинок (всё работает без VPN — только Яндекс и сайты фабрик).
// Стратегия:
//  1) если у товара есть sourceUrl — парсим страницу товара (og:image / ссылки на изображения);
//  2) иначе ищем изображения через Яндекс Картинки по «бренд коллекция название»,
//     фильтруем результаты по релевантности (совпадение слов в подписи/домене) и скачиваем оригиналы.
// Скачанные изображения сохраняются в public/uploads/products/<id>-<n>.<ext> и записываются в product_images.

import { sql } from "drizzle-orm";
import { mkdir, writeFile } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { getDb } from "../queries/connection";
import { productImages } from "@db/schema";

const execFileP = promisify(execFile);

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const UPLOAD_DIR = path.resolve(process.cwd(), "public/uploads/products");

// Домены фабрик и профильных магазинов, которым доверяем при поиске
const TRUSTED = /italon|atlasconcorde|florim|marazzi|mirage|imola|fap\.|ragno|coem|fondovalle|flaviker|abk|refin|lea\.|porcelanosa|grespania|apavisa|peronda|equipe|dualgres|vives|azteca|pamesa|saloni|keraben|apegrupo|adex|naxos|vallelunga|fioranese|santagostino|cerdomus|delconca|energieker|gardeniaorchidea|iris|casalgrande|panaria|cotto|emilgroup|serenissima|cersaie|kerranova|kerama|estima|uralceramica|grasaro|italceramica|kerservice|viaceramica|keramoteka|plitka-sd[ae]l|kерам/i;

const IMG_EXT = /\.(jpe?g|png|webp)(\?|#|$)/i;

function absUrl(u: string, base: string): string | null {
  try {
    const url = new URL(u, base);
    if (!/^https?:$/.test(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Извлекает кандидатов на фото товара из HTML страницы */
function extractImages(html: string, pageUrl: string): string[] {
  const out: string[] = [];
  const push = (u?: string | null) => {
    if (!u) return;
    const a = absUrl(u, pageUrl);
    if (a && IMG_EXT.test(a) && !out.includes(a)) out.push(a);
  };
  // og:image
  for (const m of html.matchAll(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/gi)) push(m[1]);
  for (const m of html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/gi)) push(m[1]);
  // itemprop / link image_src
  for (const m of html.matchAll(/<link[^>]+rel=["']image_src["'][^>]*href=["']([^"']+)["']/gi)) push(m[1]);
  for (const m of html.matchAll(/itemprop=["']image["'][^>]*(?:content|src)=["']([^"']+)["']/gi)) push(m[1]);
  // JSON-LD "image":"..."
  for (const m of html.matchAll(/"image"\s*:\s*"([^"]+\.(?:jpe?g|png|webp)[^"]*)"/gi)) push(m[1].replace(/\\u002F/g, "/").replace(/\\\//g, "/"));
  // большие картинки из src/data-src
  for (const m of html.matchAll(/(?:data-src|src)=["']([^"']*(?:upload|uploads|product|catalog|image|foto|photo|iblock|resize_cache)[^"']*\.(?:jpe?g|png|webp))[^"']*["']/gi)) push(m[1]);
  return out.filter((u) => !/logo|icon|sprite|blank|placeholder|loader|payment|delivery|banner/i.test(u)).slice(0, 4);
}

async function fetchText(url: string, timeoutMs = 12000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*" }, signal: ctrl.signal, redirect: "follow" });
    clearTimeout(t);
    if (!r.ok) throw new Error("http " + r.status);
    const ct = r.headers.get("content-type") ?? "";
    if (!ct.includes("text") && !ct.includes("html") && !ct.includes("json")) return null;
    const text = await r.text();
    // Яндекс распознаёт Node-fetch по TLS-отпечатку и отдаёт капчу — переспрашиваем через curl
    if (/captcha|showcaptcha/i.test(text)) throw new Error("captcha");
    return text;
  } catch {
    return curlText(url, timeoutMs);
  }
}

/** Загрузка через curl — у него другой TLS-отпечаток, Яндекс его пропускает без капчи */
async function curlText(url: string, timeoutMs = 15000): Promise<string | null> {
  try {
    const { stdout } = await execFileP(
      "curl",
      ["-sL", "--compressed", "--max-time", String(Math.ceil(timeoutMs / 1000)), "-H", `User-Agent: ${UA}`, "-H", "Accept: text/html,*/*", url],
      { maxBuffer: 8 * 1024 * 1024, encoding: "utf8" },
    );
    if (!stdout || /captcha|showcaptcha/i.test(stdout)) return null;
    return stdout;
  } catch {
    return null;
  }
}

interface YandexImageItem {
  url: string; // прямая ссылка на оригинал картинки
  alt: string; // подпись
  domain: string; // домен источника
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Поиск изображений через Яндекс Картинки (без капчи, без VPN).
 * Возвращает прямые ссылки на оригиналы + подпись и домен для оценки релевантности.
 */
async function findImagesYandex(query: string): Promise<YandexImageItem[]> {
  const html = await fetchText(`https://yandex.ru/images/search?text=${encodeURIComponent(query)}`);
  if (!html || /captcha|showcaptcha/i.test(html)) return [];
  const dec = decodeEntities(html);
  const items: YandexImageItem[] = [];
  const re =
    /"alt":"((?:[^"\\]|\\.)*)","width":\d+,"height":\d+,"origWidth":\d+,"origHeight":\d+,"origUrl":"((?:[^"\\]|\\.)*)","snippet":\{"title":"(?:[^"\\]|\\.)*","domain":"((?:[^"\\]|\\.)*)"/gs;
  for (const m of dec.matchAll(re)) {
    const alt = m[1].replace(/\\"/g, '"');
    const url = m[2].replace(/\\\//g, "/").replace(/\\u002F/gi, "/");
    const domain = m[3];
    if (!IMG_EXT.test(url)) continue;
    if (/yandex\.|yastatic|avatars\.mds/i.test(url)) continue;
    if (/logo|icon|sprite|blank|placeholder|banner|scheme|shema|chertezh/i.test(url)) continue;
    if (items.some((i) => i.url === url)) continue;
    items.push({ url, alt, domain });
    if (items.length >= 15) break;
  }
  return items;
}

const STOPWORDS = new Set([
  "керамогранит", "плитка", "керамическая", "мозаика", "для", "пол", "пола", "стен", "стены",
  "купить", "цена", "руб", "см", "мм", "м2", "кв", "шт", "упаковке", "обрезной", "матовый",
  "глянцевый", "lapidare", "tile", "tiles", "porcelain", "stoneware", "the", "and", "di", "del",
]);

/** Значимые токены товара: бренд, коллекция, слова названия, размер */
function productTokens(p: { name: string; brandName: string | null; collectionName: string | null; size?: string | null }): string[] {
  const raw = [p.brandName, p.collectionName, p.name.replace(/\/.*/, "")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const toks = raw
    .split(/[^a-zа-яё0-9]+/i)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
  return [...new Set(toks)];
}

/** Оценка релевантности картинки товару: совпадение токенов в подписи, бонус за доверенный домен */
function scoreImage(item: YandexImageItem, tokens: string[]): number {
  const hay = `${item.alt} ${item.domain}`.toLowerCase();
  let score = 0;
  for (const t of tokens) if (hay.includes(t)) score += 1;
  if (TRUSTED.test(item.domain)) score += 2;
  return score;
}

async function download(url: string, file: string): Promise<boolean> {
  let buf: Buffer | null = null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "image/*,*/*" }, signal: ctrl.signal });
    clearTimeout(t);
    if (r.ok) buf = Buffer.from(await r.arrayBuffer());
  } catch {
    // ниже попробуем через curl
  }
  if (!buf) {
    try {
      const { stdout } = await execFileP(
        "curl",
        ["-sL", "--compressed", "--max-time", "15", "-H", `User-Agent: ${UA}`, "-H", "Accept: image/*,*/*", url],
        { maxBuffer: 16 * 1024 * 1024, encoding: "buffer" },
      );
      buf = stdout as unknown as Buffer;
    } catch {
      return false;
    }
  }
  if (!buf || buf.length < 4096 || buf.length > 15 * 1024 * 1024) return false; // слишком маленькие = заглушки
  // проверяем сигнатуру: JPEG/PNG/WEBP
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  const isWebp = buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP";
  if (!isJpg && !isPng && !isWebp) return false;
  try {
    await writeFile(file, buf);
    return true;
  } catch {
    return false;
  }
}

export interface PhotoSearchResult {
  scanned: number;
  hadSourceUrl: number;
  found: number;
  saved: number;
  failed: number;
  errors: string[];
}

/** Находит до `limit` активных товаров без фото и пытается подобрать им изображения */
export async function findMissingPhotos(limit = 100): Promise<PhotoSearchResult> {
  const db = getDb();
  const res: PhotoSearchResult = { scanned: 0, hadSourceUrl: 0, found: 0, saved: 0, failed: 0, errors: [] };
  await mkdir(UPLOAD_DIR, { recursive: true });

  // Журнал попыток: не дёргаем повторно товары, для которых искали в последние 7 дней
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS photo_search_log (
      product_id INT PRIMARY KEY,
      attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const rows = await db.execute(sql`
    SELECT p.id, p.name, p.source_url AS sourceUrl, b.name AS brandName, c.name AS collectionName
    FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN collections c ON c.id = p.collection_id
    WHERE p.status = 'active' AND p.duplicate_of_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM product_images i WHERE i.product_id = p.id)
      AND NOT EXISTS (
        SELECT 1 FROM photo_search_log l
        WHERE l.product_id = p.id AND l.attempted_at > NOW() - INTERVAL 7 DAY
      )
    ORDER BY p.id DESC
    LIMIT ${Number(limit)}
  `).then((r: any) => r[0] as { id: number; name: string; sourceUrl: string | null; brandName: string | null; collectionName: string | null }[]);

  // фиксируем попытку сразу, чтобы следующие партии шли по новым товарам
  for (const p of rows) {
    await db.execute(sql`INSERT INTO photo_search_log (product_id) VALUES (${p.id}) ON DUPLICATE KEY UPDATE attempted_at = NOW()`);
  }

  const processOne = async (p: (typeof rows)[number]) => {
    res.scanned++;
    try {
      let images: string[] = [];
      if (p.sourceUrl) {
        // Есть прямая ссылка на страницу товара — парсим её
        res.hadSourceUrl++;
        const html = await fetchText(p.sourceUrl);
        if (html) images = extractImages(html, p.sourceUrl);
      }
      if (!images.length) {
        // Ищем картинки через Яндекс Картинки
        const q = [p.brandName, p.collectionName, p.name.replace(/\/.*/, "")].filter(Boolean).join(" ").slice(0, 150);
        const tokens = productTokens(p);
        const found = await findImagesYandex(q);
        const minScore = tokens.length >= 2 ? 2 : 1;
        images = found
          .map((it) => ({ it, s: scoreImage(it, tokens) }))
          .filter((x) => x.s >= minScore)
          .sort((a, b) => b.s - a.s)
          .slice(0, 3)
          .map((x) => x.it.url);
      }
      if (!images.length) {
        res.failed++;
        return;
      }
      res.found++;
      let sort = 0;
      let savedAny = false;
      for (const img of images.slice(0, 2)) {
        const ext = (img.match(IMG_EXT)?.[1] ?? "jpg").toLowerCase().replace("jpeg", "jpg");
        const fname = `${p.id}-${sort}.${ext}`;
        const fpath = path.join(UPLOAD_DIR, fname);
        if (await download(img, fpath)) {
          await db.insert(productImages).values({ productId: p.id, url: `/uploads/products/${fname}`, sortOrder: sort });
          sort++;
          res.saved++;
          savedAny = true;
        }
      }
      if (!savedAny) res.failed++;
    } catch (e: any) {
      res.failed++;
      if (res.errors.length < 10) res.errors.push(`#${p.id}: ${String(e?.message ?? e).slice(0, 120)}`);
    }
  };

  // Обрабатываем по 3 товара параллельно — быстрее, но не ддосим Яндекс
  for (let i = 0; i < rows.length; i += 3) {
    await Promise.all(rows.slice(i, i + 3).map(processOne));
  }
  return res;
}
