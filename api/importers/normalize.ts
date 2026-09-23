// Общие типы и утилиты нормализации данных поставщиков

export interface NormalizedProduct {
  externalId: string;
  sku?: string;
  name: string;
  brandName?: string;
  collectionName?: string;
  category: "keramogranit" | "plitka";
  description?: string;
  price?: number;
  oldPrice?: number;
  priceUnit?: string;
  stockQty?: number;
  stockMsk?: number;
  stockSpb?: number;
  availabilityStatus: "in_stock" | "low_stock" | "out_of_stock" | "preorder" | "unknown";
  country?: string;
  color?: string;
  surface?: string;
  size?: string;
  design?: string;
  shape?: string;
  thickness?: string;
  attrs?: Record<string, string>;
  images: string[];
  sourceUrl?: string;
}

const TR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .split("")
    .map((c) => TR[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** Нормализация для дедупликации: регистр, лишние пробелы, х/x, кавычки */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[«»"„"']/g, "")
    .replace(/[х×]/g, "x")
    .replace(/\s+/g, " ")
    .trim();
}

export function toNum(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

export function normalizeSize(s?: string): string | undefined {
  if (!s) return undefined;
  const t = s.trim().replace(/[х×*]/gi, "x").replace(/\s+/g, "");
  return t || undefined;
}

const SIZE_RE = /(\d+(?:[.,]\d+)?)\s*[xх×*]\s*(\d+(?:[.,]\d+)?)/i;

export function extractSize(text: string): string | undefined {
  const m = text.match(SIZE_RE);
  if (!m) return undefined;
  return `${m[1].replace(",", ".")}x${m[2].replace(",", ".")}`;
}

export function extractThickness(text: string): string | undefined {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*мм/i) || text.match(/(\d+(?:[.,]\d+)?)\s*mm/i);
  return m ? `${m[1].replace(",", ".")} мм` : undefined;
}

const SURFACE_MAP: [RegExp, string][] = [
  [/лаппат|lappat|\blap\b/i, "Лаппатированная"],
  [/глянц|gloss|glo\b|polish|полир/i, "Глянцевая"],
  [/сатин|satin/i, "Сатиновая"],
  [/структур|struct|рельеф|текстур/i, "Структурированная"],
  [/матов|matt|mat\b|natural|натурал/i, "Матовая"],
  [/антислип|grip|anti-?slip/i, "Антискользящая"],
];

export function normalizeSurface(s?: string): string | undefined {
  if (!s) return undefined;
  for (const [re, val] of SURFACE_MAP) if (re.test(s)) return val;
  const t = s.trim();
  // не подставляем длинные свободные тексты (например, целое название) как поверхность
  if (!t || t.length > 30) return undefined;
  return t[0].toUpperCase() + t.slice(1);
}

const COUNTRY_MAP: Record<string, string> = {
  италия: "Италия", italy: "Италия",
  испания: "Испания", spain: "Испания",
  россия: "Россия", russia: "Россия",
  китай: "Китай", china: "Китай",
  португалия: "Португалия", portugal: "Португалия",
  индия: "Индия", india: "Индия",
  германия: "Германия", germany: "Германия",
  польша: "Польша", poland: "Польша",
  франция: "Франция", france: "Франция",
  турция: "Турция", беларусь: "Беларусь",
};

export function normalizeCountry(s?: string): string | undefined {
  if (!s) return undefined;
  const key = s.trim().toLowerCase();
  return COUNTRY_MAP[key] ?? s.trim();
}

export function guessCategory(opts: {
  material?: string;
  type?: string;
  name?: string;
  size?: string;
}): "keramogranit" | "plitka" {
  const m = `${opts.material ?? ""} ${opts.type ?? ""}`.toLowerCase();
  if (/керамогранит|керамическ(ий|ого) гранит|gres|porcelain|кг\b/.test(m)) return "keramogranit";
  if (/плитка|керамика|tile|мозаик|керамичес/.test(m)) return "plitka";
  const n = (opts.name ?? "").toLowerCase();
  if (/керамогранит/.test(n)) return "keramogranit";
  if (/плитка|мозаик/.test(n)) return "plitka";
  // мелкоформат (до 25 см по большей стороне) — как правило настенная плитка
  if (opts.size) {
    const m = opts.size.match(/(\d+(?:[.,]\d+)?)\s*[xх×*]\s*(\d+(?:[.,]\d+)?)/i);
    if (m && Math.max(parseFloat(m[1].replace(",", ".")), parseFloat(m[2].replace(",", "."))) <= 25) return "plitka";
  }
  return "keramogranit";
}

export function availabilityFromQty(qty?: number): NormalizedProduct["availabilityStatus"] {
  if (qty === undefined) return "unknown";
  if (qty <= 0) return "out_of_stock";
  if (qty < 20) return "low_stock";
  return "in_stock";
}

/** Нормализация единицы измерения цены */
export function normalizeUnit(u?: string): string {
  if (!u) return "м²";
  const s = u.trim().toLowerCase();
  if (/м2|м²|sq|кв\.?\s*м|квадрат/.test(s)) return "м²";
  if (/шт/.test(s)) return "шт";
  if (/короб|упак/.test(s)) return "кор.";
  return u.trim();
}

// ─── Очистка текстов из выгрузок ────────────────────────────────────────────
// В выгрузках поставщиков встречаются:
//  - «п»ї» в начале — UTF-8 BOM (EF BB BF), прочитанный в однобайтовой кодировке;
//  - типичная mojibake UTF-8→cp1251: «РџР»РёС‚РєР°», «в„–», «В» и т.п.;
//  - управляющие символы и лишние пробелы.
/** Чистит текст из выгрузки: убирает BOM-мусор, кракозябры, управляющие символы */
export function cleanText(s?: string | null): string | undefined {
  if (!s) return undefined;
  let t = s;
  // BOM, прочитанный в разных неверных кодировках
  t = t.replace(/^(?:п»ї|п»С—|п»С|п»|ï»¿|п»i|\uFEFF)+\s*/i, "");
  // остаточные mojibake-фрагменты в любом месте строки
  t = t.replace(/п»ї|ï»¿|\uFEFF/g, "");
  // управляющие символы, кроме перевода строки/табуляции
  // eslint-disable-next-line no-control-regex
  t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ");
  // множественные пробелы
  t = t.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n");
  t = t.trim();
  // после очистки строка могла опустеть или остаться мусором без букв
  if (!t || !/[0-9A-Za-zА-Яа-яЁё]/.test(t)) return undefined;
  return t;
}

// ─── Дизайн и форма (вычисляемые фильтры) ───────────────────────────────────

/** Порядок важен: более специфичные дизайны проверяются раньше (травертин ≠ камень) */
const DESIGN_MAP: [RegExp, string][] = [
  [/оникс|onyx/i, "Оникс"],
  [/травертин|travertin/i, "Травертин"],
  [/терраццо|terrazzo|veneziano/i, "Терраццо"],
  [/мрамор|marble|marvel|calacatta|калакатта|statuario|carrara|каррара/i, "Мрамор"],
  [/бетон|beton|concrete|цемент/i, "Бетон"],
  [/металл|metal|оксид|oxide/i, "Металл"],
  [/кирпич|brick/i, "Кирпич"],
  [/дерев|wood|rovere/i, "Дерево"],
  [/камен|камень|stone|pietra|сланец|slate|известняк|limestone|песчаник/i, "Камень"],
];

/** Определяет дизайн по названию товара, коллекции и описанию */
export function guessDesign(name?: string, collection?: string, description?: string): string | undefined {
  const hay = `${name ?? ""} ${collection ?? ""} ${description ?? ""}`;
  for (const [re, val] of DESIGN_MAP) if (re.test(hay)) return val;
  return undefined;
}

/** Определяет форму по названию (шестигранник) и размеру (квадрат/прямоугольник) */
export function guessShape(name?: string, size?: string): string | undefined {
  if (name && /hexagon|гексагон|шестигранн|esagon/i.test(name)) return "Шестигранник";
  if (!size) return undefined;
  const m = size.match(/(\d+(?:[.,]\d+)?)\s*[xх×*]\s*(\d+(?:[.,]\d+)?)/i);
  if (!m) return undefined;
  const a = parseFloat(m[1].replace(",", "."));
  const b = parseFloat(m[2].replace(",", "."));
  if (!a || !b) return undefined;
  return Math.abs(a - b) < 0.01 ? "Квадрат" : "Прямоугольник";
}
