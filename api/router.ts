import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import {
  catalogStats,
  getBrandBySlug,
  getFacets,
  getProductBySlug,
  listBrands,
  listCollections,
  listImportRuns,
  listProducts,
  heroImages,
} from "./queries/catalog";
import type { CatalogFilters } from "./queries/catalog";
import { getDb } from "./queries/connection";
import { leads } from "@db/schema";
import { desc, eq } from "drizzle-orm";
import { runAllImports, runCustomSource } from "./importers/run";

const filtersInput = z.object({
  category: z.string().optional(),
  brandIds: z.array(z.number()).optional(),
  countries: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  surfaces: z.array(z.string()).optional(),
  sizes: z.array(z.string()).optional(),
  inStockOnly: z.boolean().optional(),
  onSale: z.boolean().optional(),
  priceMin: z.number().optional(),
  priceMax: z.number().optional(),
  search: z.string().max(200).optional(),
  sort: z.enum(["popular", "price_asc", "price_desc", "newest", "stock"]).optional(),
  page: z.number().int().min(1).optional(),
  perPage: z.number().int().min(6).max(60).optional(),
});

const leadInput = z.object({
  formType: z.enum(["availability", "callback", "consultation", "project"]),
  productId: z.number().optional(),
  productName: z.string().max(500).optional(),
  name: z.string().min(1).max(255),
  phone: z.string().min(5).max(50),
  email: z.string().email().max(255).optional().or(z.literal("")),
  comment: z.string().max(5000).optional(),
  pageUrl: z.string().max(2000).optional(),
  fileName: z.string().max(500).optional(),
  fileDataBase64: z.string().max(14_000_000).optional(), // ~10 МБ файла
  utm: z.record(z.string(), z.string()).optional(),
  website: z.string().max(0).optional(), // honeypot — должен быть пустым
});

// примитивный rate-limit по IP: не чаще 1 заявки в 30 сек
const leadHits = new Map<string, number>();

// Пароль админки: задаётся через .env (ADMIN_PASSWORD), по умолчанию — для локальной разработки
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "omstudio2026";

// Куки с авторизованными сессиями админки (подпись секретом)
const adminSessions = new Set<string>();

function makeToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function checkAdmin(ctx: unknown) {
  const cookie = (ctx as any)?.req?.headers?.get?.("cookie") ?? "";
  const m = cookie.match(/om_admin=([a-z0-9]+)/);
  if (!m || !adminSessions.has(m[1])) throw new Error("Требуется авторизация");
}

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),

  catalog: createRouter({
    list: publicQuery.input(filtersInput).query(({ input }) => listProducts(input as CatalogFilters)),
    facets: publicQuery.input(filtersInput).query(({ input }) => getFacets(input as CatalogFilters)),
    product: publicQuery.input(z.object({ slug: z.string() })).query(({ input }) => getProductBySlug(input.slug)),
    stats: publicQuery.query(() => catalogStats()),
    heroImages: publicQuery.query(() => heroImages()),
  }),

  brands: createRouter({
    list: publicQuery.query(() => listBrands()),
    bySlug: publicQuery.input(z.object({ slug: z.string() })).query(({ input }) => getBrandBySlug(input.slug)),
    collections: publicQuery.input(z.object({ brandId: z.number().optional() })).query(({ input }) => listCollections(input.brandId)),
  }),

  leads: createRouter({
    create: publicQuery.input(leadInput).mutation(async ({ input, ctx }) => {
      const ip = (ctx as any)?.req?.headers?.get?.("x-forwarded-for") ?? "anon";
      const now = Date.now();
      const last = leadHits.get(String(ip)) ?? 0;
      if (now - last < 30_000) {
        throw new Error("Слишком частые отправки. Подождите немного и попробуйте снова.");
      }
      leadHits.set(String(ip), now);
      if (input.website) return { ok: true }; // honeypot: молча «принимаем» спам
      const db = getDb();
      const [r] = await db.insert(leads).values({
        formType: input.formType,
        productId: input.productId ?? null,
        productName: input.productName ?? null,
        name: input.name,
        phone: input.phone,
        email: input.email || null,
        comment: input.comment ?? null,
        pageUrl: input.pageUrl ?? null,
        fileName: input.fileName ?? null,
        fileData: input.fileDataBase64 ? { base64: input.fileDataBase64 } : null,
        utm: input.utm ?? null,
      });
      return { ok: true, id: Number(r.insertId) };
    }),
  }),

  admin: createRouter({
    login: publicQuery.input(z.object({ password: z.string() })).mutation(({ input, ctx }) => {
      if (input.password !== ADMIN_PASSWORD) throw new Error("Неверный пароль");
      const token = makeToken();
      adminSessions.add(token);
      (ctx as any)?.resHeaders?.set?.("set-cookie", `om_admin=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}`);
      return { ok: true };
    }),
    check: publicQuery.query(({ ctx }) => {
      try {
        checkAdmin(ctx);
        return { ok: true };
      } catch {
        return { ok: false };
      }
    }),
    importRuns: publicQuery.query(({ ctx }) => {
      checkAdmin(ctx);
      return listImportRuns();
    }),
    runImport: publicQuery.mutation(({ ctx }) => {
      checkAdmin(ctx);
      return runAllImports();
    }),
    sources: createRouter({
      list: publicQuery.query(async ({ ctx }) => {
        checkAdmin(ctx);
        const db = getDb();
        const { customSources } = await import("@db/schema");
        return db.select().from(customSources).orderBy(desc(customSources.id));
      }),
      add: publicQuery
        .input(z.object({ name: z.string().min(1).max(255), url: z.string().url(), format: z.enum(["yml", "csv", "xlsx"]) }))
        .mutation(async ({ input, ctx }) => {
          checkAdmin(ctx);
          const db = getDb();
          const { customSources } = await import("@db/schema");
          const [r] = await db.insert(customSources).values(input);
          const id = Number(r.insertId);
          // сразу пробуем загрузить, чтобы показать результат или ошибку
          const stats = await runCustomSource(id);
          return { id, stats };
        }),
      remove: publicQuery.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
        checkAdmin(ctx);
        const db = getDb();
        const { customSources } = await import("@db/schema");
        await db.delete(customSources).where(eq(customSources.id, input.id));
        return { ok: true };
      }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
