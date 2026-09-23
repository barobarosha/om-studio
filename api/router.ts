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
import { appSettings, leads, notifyTargets } from "@db/schema";
import { and, desc, eq } from "drizzle-orm";
import { runAllImports, runCustomSource } from "./importers/run";

const filtersInput = z.object({
  category: z.string().optional(),
  brandIds: z.array(z.number()).optional(),
  countries: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  surfaces: z.array(z.string()).optional(),
  sizes: z.array(z.string()).optional(),
  designs: z.array(z.string()).optional(),
  shapes: z.array(z.string()).optional(),
  collections: z.array(z.string()).optional(),
  largeFormat: z.boolean().optional(), // только крупноформат: обе стороны ≥ 120 см
  mosaic: z.boolean().optional(), // только мозаика
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

// примитивный rate-limit по IP: не чаще 1 заявки в 3 минуты
const leadHits = new Map<string, number>();
const LEAD_RATE_LIMIT_MS = 3 * 60_000; // 3 минуты между заявками с одного IP
// rate-limit на подбор пароля админки: не чаще 5 попыток в 5 минут с IP
const loginHits = new Map<string, { count: number; resetAt: number }>();

// ─── Уведомления о заявках (Telegram / MAX / e-mail) ────────────────────────────────────────────────────────────────────────────────────────────
const LEAD_TITLES: Record<string, string> = {
  availability: "Узнать наличие",
  callback: "Обратный звонок",
  consultation: "Консультация",
  project: "Проект на подбор",
};

function leadText(l: { formType: string; name: string; phone: string; productName?: string; email?: string; comment?: string; pageUrl?: string }): string {
  const lines = [`Новая заявка: ${LEAD_TITLES[l.formType] ?? l.formType}`, `Имя: ${l.name}`, `Телефон: ${l.phone}`];
  if (l.productName) lines.push(`Товар: ${l.productName}`);
  if (l.email) lines.push(`E-mail: ${l.email}`);
  if (l.comment) lines.push(`Комментарий: ${l.comment}`);
  if (l.pageUrl) lines.push(`Страница: ${l.pageUrl}`);
  return lines.join("\n");
}

// Отправка не блокирует сохранение заявки: ошибки только в консоль сервера
async function notifyAboutLead(input: { formType: string; name: string; phone: string; productName?: string; email?: string; comment?: string; pageUrl?: string }) {
  const db = getDb();
  const targets = await db
    .select()
    .from(notifyTargets)
    .where(and(eq(notifyTargets.formType, input.formType), eq(notifyTargets.active, true)));
  if (targets.length === 0) return;
  const settingsRows = await db.select().from(appSettings);
  const s: Record<string, string> = {};
  for (const r of settingsRows) s[r.key] = r.value ?? "";
  const text = leadText(input);
  const results = await Promise.allSettled(
    targets.map(async (t) => {
      if (t.channel === "telegram") {
        if (!s.telegram_bot_token) throw new Error("telegram_bot_token не задан в админке");
        const res = await fetch(`https://api.telegram.org/bot${s.telegram_bot_token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: t.target, text }),
        });
        if (!res.ok) throw new Error(`Telegram HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      } else if (t.channel === "max") {
        if (!s.max_bot_token) throw new Error("max_bot_token не задан в админке");
        const res = await fetch(`https://platform-api.max.ru/messages?chat_id=${encodeURIComponent(t.target)}`, {
          method: "POST",
          headers: { Authorization: s.max_bot_token, "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error(`MAX HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      } else {
        if (!s.smtp_host || !s.mail_from) throw new Error("SMTP/отправитель не заданы в админке");
        let nodemailer: any;
        try {
          nodemailer = await import("nodemailer");
        } catch {
          throw new Error("Для отправки e-mail установите пакет: npm i nodemailer");
        }
        const port = Number(s.smtp_port || 465);
        const transport = nodemailer.default.createTransport({
          host: s.smtp_host,
          port,
          secure: port === 465,
          auth: s.smtp_user ? { user: s.smtp_user, pass: s.smtp_pass } : undefined,
        });
        await transport.sendMail({
          from: s.mail_from,
          to: t.target,
          subject: `Заявка с сайта: ${LEAD_TITLES[input.formType] ?? input.formType}`,
          text,
        });
        transport.close?.();
      }
    }),
  );
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(`[notify:${targets[i].channel} → ${targets[i].target}]`, r.reason);
  });
}

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
      if (now - last < LEAD_RATE_LIMIT_MS) {
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
      void notifyAboutLead(input).catch((e) => console.error("[leads] уведомления не отправлены:", e));
      return { ok: true, id: Number(r.insertId) };
    }),
  }),

  admin: createRouter({
    login: publicQuery.input(z.object({ password: z.string().max(200) })).mutation(({ input, ctx }) => {
      const ip = String((ctx as any)?.req?.headers?.get?.("x-forwarded-for") ?? "anon");
      const now = Date.now();
      const rec = loginHits.get(ip);
      if (rec && now < rec.resetAt && rec.count >= 5) {
        throw new Error("Слишком много попыток. Попробуйте через несколько минут.");
      }
      if (input.password !== ADMIN_PASSWORD) {
        const next = rec && now < rec.resetAt ? { count: rec.count + 1, resetAt: rec.resetAt } : { count: 1, resetAt: now + 5 * 60_000 };
        loginHits.set(ip, next);
        throw new Error("Неверный пароль");
      }
      loginHits.delete(ip);
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
    // Поиск недостающих фото на сайтах фабрик (партиями, чтобы не блокировать админку)
    findPhotos: publicQuery
      .input(z.object({ limit: z.number().int().min(1).max(200).optional() }).optional())
      .mutation(async ({ input, ctx }) => {
        checkAdmin(ctx);
        const { findMissingPhotos } = await import("./importers/photos");
        return findMissingPhotos(input?.limit ?? 30);
      }),
    leads: createRouter({
      list: publicQuery.query(({ ctx }) => {
        checkAdmin(ctx);
        const db = getDb();
        return db.select().from(leads).orderBy(desc(leads.createdAt)).limit(500);
      }),
    }),

    notify: createRouter({
      list: publicQuery.query(async ({ ctx }) => {
        checkAdmin(ctx);
        const db = getDb();
        const [targets, settingsRows] = await Promise.all([
          db.select().from(notifyTargets).orderBy(desc(notifyTargets.createdAt)),
          db.select().from(appSettings),
        ]);
        return { targets, settings: Object.fromEntries(settingsRows.map((r) => [r.key, r.value ?? ""])) };
      }),
      add: publicQuery
        .input(
          z.object({
            formType: z.enum(["availability", "callback", "consultation", "project"]),
            channel: z.enum(["telegram", "max", "email"]),
            target: z.string().min(1).max(512),
          }),
        )
        .mutation(async ({ input, ctx }) => {
          checkAdmin(ctx);
          const db = getDb();
          await db.insert(notifyTargets).values(input).onDuplicateKeyUpdate({ set: { active: true } });
          return { ok: true };
        }),
      remove: publicQuery.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
        checkAdmin(ctx);
        const db = getDb();
        await db.delete(notifyTargets).where(eq(notifyTargets.id, input.id));
        return { ok: true };
      }),
      setSetting: publicQuery
        .input(z.object({ key: z.string().min(1).max(100), value: z.string().max(4000) }))
        .mutation(async ({ input, ctx }) => {
          checkAdmin(ctx);
          const db = getDb();
          await db.insert(appSettings).values({ key: input.key, value: input.value }).onDuplicateKeyUpdate({ set: { value: input.value } });
          return { ok: true };
        }),
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