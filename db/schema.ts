import {
  mysqlTable,
  serial,
  varchar,
  text,
  int,
  decimal,
  boolean,
  timestamp,
  json,
  uniqueIndex,
  index,
  bigint,
} from "drizzle-orm/mysql-core";

// ─── Поставщики ──────────────────────────────────────────────────────────────
export const suppliers = mysqlTable("suppliers", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(), // keramoteka, kerservice, ...
  name: varchar("name", { length: 255 }).notNull(),
  sourceUrl: text("source_url"),
  importType: varchar("import_type", { length: 50 }).notNull(), // csv | xlsx | yml | xml
  // чем больше число — тем приоритетнее источник при дедупликации брендов
  priority: int("priority").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Бренды ──────────────────────────────────────────────────────────────────
export const brands = mysqlTable(
  "brands",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    nameNorm: varchar("name_norm", { length: 255 }).notNull(), // lowercased, trimmed
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    country: varchar("country", { length: 255 }),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("brands_norm_uniq").on(t.nameNorm)],
);

// ─── Коллекции ───────────────────────────────────────────────────────────────
export const collections = mysqlTable(
  "collections",
  {
    id: serial("id").primaryKey(),
    brandId: bigint("brand_id", { mode: "number", unsigned: true }),
    name: varchar("name", { length: 255 }).notNull(),
    nameNorm: varchar("name_norm", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    active: boolean("active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("collections_brand_norm_uniq").on(t.brandId, t.nameNorm),
    index("collections_slug_idx").on(t.slug),
  ],
);

// ─── Товары ──────────────────────────────────────────────────────────────────
export const products = mysqlTable(
  "products",
  {
    id: serial("id").primaryKey(),
    supplierId: bigint("supplier_id", { mode: "number", unsigned: true }).notNull(),
    externalId: varchar("external_id", { length: 255 }).notNull(), // ID/артикул у поставщика
    sku: varchar("sku", { length: 255 }),
    name: varchar("name", { length: 512 }).notNull(),
    nameNorm: varchar("name_norm", { length: 512 }).notNull(), // для дедупликации
    slug: varchar("slug", { length: 512 }).notNull().unique(),
    brandId: bigint("brand_id", { mode: "number", unsigned: true }),
    collectionId: bigint("collection_id", { mode: "number", unsigned: true }),
    category: varchar("category", { length: 50 }).notNull().default("keramogranit"), // keramogranit | plitka
    description: text("description"),
    price: decimal("price", { precision: 12, scale: 2 }),
    oldPrice: decimal("old_price", { precision: 12, scale: 2 }),
    priceUnit: varchar("price_unit", { length: 20 }).default("м²"),
    availabilityStatus: varchar("availability_status", { length: 30 }).notNull().default("unknown"), // in_stock | low_stock | out_of_stock | preorder | unknown
    stockQty: decimal("stock_qty", { precision: 14, scale: 3 }),
    stockMsk: decimal("stock_msk", { precision: 14, scale: 3 }),
    stockSpb: decimal("stock_spb", { precision: 14, scale: 3 }),
    country: varchar("country", { length: 255 }),
    color: varchar("color", { length: 255 }),
    surface: varchar("surface", { length: 255 }),
    size: varchar("size", { length: 100 }),
    thickness: varchar("thickness", { length: 50 }),
    attrs: json("attrs"), // прочие нормализованные характеристики {ключ: значение}
    sourceUrl: text("source_url"),
    // если товар-дубль: ссылка на «главный» товар от приоритетного поставщика
    duplicateOfId: bigint("duplicate_of_id", { mode: "number", unsigned: true }),
    status: varchar("status", { length: 20 }).notNull().default("active"), // active | hidden | archived
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex("products_supplier_ext_uniq").on(t.supplierId, t.externalId),
    index("products_brand_idx").on(t.brandId),
    index("products_category_idx").on(t.category),
    index("products_status_idx").on(t.status),
    index("products_dedup_idx").on(t.brandId, t.nameNorm),
    index("products_price_idx").on(t.price),
  ],
);

// ─── Изображения товаров ─────────────────────────────────────────────────────
export const productImages = mysqlTable(
  "product_images",
  {
    id: serial("id").primaryKey(),
    productId: bigint("product_id", { mode: "number", unsigned: true }).notNull(),
    url: text("url").notNull(),
    sortOrder: int("sort_order").notNull().default(0),
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);

// ─── Лиды / заявки ───────────────────────────────────────────────────────────
export const leads = mysqlTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    formType: varchar("form_type", { length: 50 }).notNull(), // availability | callback | consultation | project
    productId: bigint("product_id", { mode: "number", unsigned: true }),
    productName: varchar("product_name", { length: 512 }),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }).notNull(),
    email: varchar("email", { length: 255 }),
    comment: text("comment"),
    pageUrl: text("page_url"),
    fileName: varchar("file_name", { length: 512 }),
    fileData: json("file_data"), // base64 вложение (дизайн-проект), до ~8 МБ
    utm: json("utm"),
    status: varchar("status", { length: 20 }).notNull().default("new"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("leads_created_idx").on(t.createdAt)],
);

// ─── Журнал импортов ─────────────────────────────────────────────────────────
export const importRuns = mysqlTable("import_runs", {
  id: serial("id").primaryKey(),
  supplierId: bigint("supplier_id", { mode: "number", unsigned: true }).notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
  status: varchar("status", { length: 20 }).notNull().default("running"), // running | ok | error
  totalRows: int("total_rows").notNull().default(0),
  created: int("created").notNull().default(0),
  updated: int("updated").notNull().default(0),
  skipped: int("skipped").notNull().default(0),
  deactivated: int("deactivated").notNull().default(0),
  errors: text("errors"),
});

// ─── Пользовательские источники (добавляются из админки без разработчика) ────
export const customSources = mysqlTable("custom_sources", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  url: text("url").notNull(),
  // yml — стандартный YML/XML Яндекс.Маркета; csv / xlsx — таблицы с авто-распознаванием колонок
  format: varchar("format", { length: 20 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
